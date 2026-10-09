'use strict';
// services/attendanceScore.js
// Calculates attendance-based performance score for employees

const { safeQuery } = require('../db/pool');

/**
 * Calculate attendance score for an employee over a date range
 * Score starts at 100 and deducts for late arrivals and early departures
 */
async function calculateAttendanceScore(employeeId, fromDate, toDate) {
  const { rows: records } = await safeQuery(
    `SELECT 
       work_date,
       status,
       late_minutes,
       early_leave_minutes,
       clock_in,
       clock_out,
       active_seconds,
       idle_seconds,
       source
     FROM attendance_records
     WHERE employee_id = $1 AND work_date BETWEEN $2 AND $3
     ORDER BY work_date`,
    [employeeId, fromDate, toDate]
  );

  if (!records.length) {
    return {
      score: 100,
      breakdown: {
        totalWorkingDays: 0,
        daysPresent: 0,
        daysLate: 0,
        daysEarlyLeave: 0,
        daysAbsent: 0,
        daysOnLeave: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        latePenalty: 0,
        earlyLeavePenalty: 0
      },
      records: []
    };
  }

  // Get working hours config for penalty rates
  const { rows: configs } = await safeQuery(`SELECT * FROM company_working_hours`);
  const configMap = new Map(configs.map(c => [c.day_of_week, c]));

  let totalWorkingDays = 0;
  let daysPresent = 0;
  let daysLate = 0;
  let daysEarlyLeave = 0;
  let daysAbsent = 0;
  let daysOnLeave = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;
  let latePenalty = 0;
  let earlyLeavePenalty = 0;

  for (const r of records) {
    const dayOfWeek = new Date(r.work_date).getDay() === 0 ? 7 : new Date(r.work_date).getDay();
    const config = configMap.get(dayOfWeek) || { 
      late_penalty_per_min: 0.5, 
      early_leave_penalty_per_min: 0.5,
      is_working_day: dayOfWeek >= 1 && dayOfWeek <= 5
    };

    if (!config.is_working_day) continue; // Skip weekends/holidays
    
    totalWorkingDays++;

    switch (r.status) {
      case 'present':
        daysPresent++;
        break;
      case 'late':
        daysPresent++;
        daysLate++;
        break;
      case 'early_leave':
        daysPresent++;
        daysEarlyLeave++;
        break;
      case 'absent':
        daysAbsent++;
        break;
      case 'on_leave':
        daysOnLeave++;
        break;
      case 'half_day':
        daysPresent += 0.5;
        break;
    }

    if (r.late_minutes > 0) {
      totalLateMinutes += r.late_minutes;
      latePenalty += r.late_minutes * parseFloat(config.late_penalty_per_min);
    }
    if (r.early_leave_minutes > 0) {
      totalEarlyLeaveMinutes += r.early_leave_minutes;
      earlyLeavePenalty += r.early_leave_minutes * parseFloat(config.early_leave_penalty_per_min);
    }
  }

  // Base score: 100
  // Deduct for late minutes and early leave minutes
  // Also factor in attendance rate
  const attendanceRate = totalWorkingDays > 0 ? (daysPresent / totalWorkingDays) * 100 : 100;
  const totalPenalty = latePenalty + earlyLeavePenalty;
  
  // Score calculation: attendance rate weighted + penalty deduction
  // Max penalty cap at 30 points
  const penaltyScore = Math.min(totalPenalty, 30);
  const score = Math.max(0, Math.round(attendanceRate * 0.7 - penaltyScore + 30)); // Scale to 0-100

  return {
    score: Math.min(100, score),
    breakdown: {
      totalWorkingDays,
      daysPresent: Math.round(daysPresent),
      daysLate,
      daysEarlyLeave,
      daysAbsent,
      daysOnLeave,
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      latePenalty: Math.round(latePenalty * 100) / 100,
      earlyLeavePenalty: Math.round(earlyLeavePenalty * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100
    },
    records: records.map(r => ({
      date: r.work_date,
      status: r.status,
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      lateMinutes: r.late_minutes,
      earlyLeaveMinutes: r.early_leave_minutes,
      activeHours: Math.round((r.active_seconds || 0) / 3600 * 100) / 100,
      source: r.source
    }))
  };
}

/**
 * Calculate attendance scores for multiple employees (batch)
 * Used for performance review cycles
 */
async function calculateBatchAttendanceScores(employeeIds, fromDate, toDate) {
  if (!employeeIds.length) return {};

  // Get all records in one query
  const { rows: records } = await safeQuery(
    `SELECT 
       employee_id,
       work_date,
       status,
       late_minutes,
       early_leave_minutes
     FROM attendance_records
     WHERE employee_id = ANY($1) AND work_date BETWEEN $2 AND $3
     ORDER BY employee_id, work_date`,
    [employeeIds, fromDate, toDate]
  );

  // Get working hours configs
  const { rows: configs } = await safeQuery(`SELECT * FROM company_working_hours`);
  const configMap = new Map(configs.map(c => [c.day_of_week, c]));

  // Group by employee
  const byEmployee = new Map();
  for (const id of employeeIds) {
    byEmployee.set(id, {
      records: [],
      totalWorkingDays: 0,
      daysPresent: 0,
      daysLate: 0,
      daysEarlyLeave: 0,
      daysAbsent: 0,
      daysOnLeave: 0,
      totalLateMinutes: 0,
      totalEarlyLeaveMinutes: 0,
      latePenalty: 0,
      earlyLeavePenalty: 0
    });
  }

  for (const r of records) {
    const emp = byEmployee.get(r.employee_id);
    if (!emp) continue;

    const dayOfWeek = new Date(r.work_date).getDay() === 0 ? 7 : new Date(r.work_date).getDay();
    const config = configMap.get(dayOfWeek) || { 
      late_penalty_per_min: 0.5, 
      early_leave_penalty_per_min: 0.5,
      is_working_day: dayOfWeek >= 1 && dayOfWeek <= 5
    };

    if (!config.is_working_day) continue;
    
    emp.totalWorkingDays++;
    emp.records.push(r);

    switch (r.status) {
      case 'present':
        emp.daysPresent++;
        break;
      case 'late':
        emp.daysPresent++;
        emp.daysLate++;
        break;
      case 'early_leave':
        emp.daysPresent++;
        emp.daysEarlyLeave++;
        break;
      case 'absent':
        emp.daysAbsent++;
        break;
      case 'on_leave':
        emp.daysOnLeave++;
        break;
      case 'half_day':
        emp.daysPresent += 0.5;
        break;
    }

    if (r.late_minutes > 0) {
      emp.totalLateMinutes += r.late_minutes;
      emp.latePenalty += r.late_minutes * parseFloat(config.late_penalty_per_min);
    }
    if (r.early_leave_minutes > 0) {
      emp.totalEarlyLeaveMinutes += r.early_leave_minutes;
      emp.earlyLeavePenalty += r.early_leave_minutes * parseFloat(config.early_leave_penalty_per_min);
    }
  }

  // Calculate scores
  const scores = {};
  for (const [id, emp] of byEmployee) {
    const attendanceRate = emp.totalWorkingDays > 0 ? (emp.daysPresent / emp.totalWorkingDays) * 100 : 100;
    const totalPenalty = emp.latePenalty + emp.earlyLeavePenalty;
    const penaltyScore = Math.min(totalPenalty, 30);
    const score = Math.max(0, Math.round(attendanceRate * 0.7 - penaltyScore + 30));

    scores[id] = {
      score: Math.min(100, score),
      breakdown: {
        totalWorkingDays: emp.totalWorkingDays,
        daysPresent: Math.round(emp.daysPresent),
        daysLate: emp.daysLate,
        daysEarlyLeave: emp.daysEarlyLeave,
        daysAbsent: emp.daysAbsent,
        daysOnLeave: emp.daysOnLeave,
        totalLateMinutes: emp.totalLateMinutes,
        totalEarlyLeaveMinutes: emp.totalEarlyLeaveMinutes,
        latePenalty: Math.round(emp.latePenalty * 100) / 100,
        earlyLeavePenalty: Math.round(emp.earlyLeavePenalty * 100) / 100,
        attendanceRate: Math.round(attendanceRate * 100) / 100
      }
    };
  }

  return scores;
}

/**
 * Get attendance score label based on score
 */
function getAttendanceScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/**
 * Get color for score display
 */
function getAttendanceScoreColor(score) {
  if (score >= 90) return 'success';
  if (score >= 75) return 'primary';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'warning';
  return 'error';
}

module.exports = {
  calculateAttendanceScore,
  calculateBatchAttendanceScores,
  getAttendanceScoreLabel,
  getAttendanceScoreColor
};