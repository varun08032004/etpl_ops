# EtherTrack Carbon Academy — Pilot Support Runbook

**Programme:** CA-2026 EtherTrack Carbon Academy  
**Pilot:** Internal Pilot 2026  
**Version:** 1.0  
**Date:** 2026-09-01  
**Status:** Active  
**Owner:** Training Operations Lead  

---

## 1. Quick Reference

### 1.1 Key Contacts

| Role | Name | Slack | Email | Phone | Backup |
|------|------|-------|-------|-------|--------|
| **Training Ops Lead** | TBD | @training-ops-lead | training-ops@ethertrack.in | +91-XXXXXXXXXX | Training Eng Lead |
| **Platform Eng Lead** | TBD | @platform-eng-lead | platform-eng@ethertrack.in | +91-XXXXXXXXXX | Senior Platform Eng |
| **Content Lead** | TBD | @content-lead | content@ethertrack.in | +91-XXXXXXXXXX | Senior Content Eng |
| **HR Partner** | TBD | @hr-partner | hr@ethertrack.in | +91-XXXXXXXXXX | HR Lead |
| **Engineering Manager** | TBD | @eng-manager | eng-mgr@ethertrack.in | +91-XXXXXXXXXX | VP Engineering |

### 1.2 Communication Channels

| Channel | Purpose | Members | Monitoring |
|---------|---------|---------|------------|
| `#carbon-academy-pilot` | Pilot announcements, general discussion | All pilot participants + Training Ops | Training Ops (daily) |
| `#training-support` | Employee support requests | Pilot participants + Training Ops + Support | Training Ops (real-time) |
| `#training-alerts` | Automated alerts (stalled, overdue, errors) | Training Ops, Managers, Platform Eng | 24/7 |
| `#training-eng` | Engineering discussions | Platform Eng, Training Eng | Platform Eng |
| `#training-content` | Content issues, typos, corrections | Content Team, Training Eng | Content Lead |

### 1.3 Escalation Matrix

| Priority | Response | Resolution | Primary | Secondary | Executive |
|----------|----------|------------|---------|-----------|-----------|
| **P0 Critical** | 15 min | 2 hours | Platform Eng Lead | Engineering Manager | CTO |
| **P1 High** | 1 hour | 8 hours | Training Eng Lead | Platform Eng Lead | VP Eng |
| **P2 Medium** | 4 hours | 24 hours | Training Ops Lead | Training Eng Lead | - |
| **P3 Low** | Next sprint | Best effort | Training Ops Lead | - | - |

---

## 2. Common Issues & Resolution Procedures

### 2.1 Authentication & Access Issues

#### Issue: Employee cannot login
**Symptoms:** "Invalid credentials", 401 on all endpoints
**Diagnosis:**
1. Verify staff_accounts record exists and is_active=true
2. Check employee_id linked to staff_accounts
3. Verify password hash matches
4. Check failed_login_attempts for lockout

**Resolution:**
```sql
-- Check account status
SELECT id, email, is_active, employee_id, failed_login_attempts 
FROM staff_accounts WHERE email = 'user@ethertrack.in';

-- Clear failed attempts if locked out
UPDATE failed_login_attempts SET success = TRUE 
WHERE staff_account_id = 'xxx' AND success = FALSE;
```

**Escalation:** P1 if multiple users affected → Platform Eng Lead

---

#### Issue: Employee sees "No employee record linked"
**Symptoms:** 404 on `/api/training/my-training` with message "No employee record linked to this account"
**Diagnosis:**
1. Check staff_accounts.employee_id is set
2. Verify employees record exists and status='active'
3. Check foreign key relationship

**Resolution:**
```sql
-- Verify linkage
SELECT s.id, s.email, s.employee_id, e.id as emp_id, e.status
FROM staff_accounts s
LEFT JOIN employees e ON e.id = s.employee_id
WHERE s.email = 'user@ethertrack.in';

-- Fix missing employee_id
UPDATE staff_accounts SET employee_id = 'emp-uuid' WHERE email = 'user@ethertrack.in';
```

---

#### Issue: Employee cannot see assigned training
**Symptoms:** Empty assignments list, "No Training Assigned" message
**Diagnosis:**
1. Check training_assignments for employee_id
2. Verify assignment status != 'cancelled'
2. Check programme/course status = 'active' or 'published'

**Resolution:**
```sql
-- Check assignments
SELECT ta.*, p.title as programme_title, c.title as course_title
FROM training_assignments ta
LEFT JOIN training_programmes p ON p.id = ta.programme_id
LEFT JOIN training_courses c ON c.id = ta.course_id
WHERE ta.employee_id = 'emp-uuid' AND ta.status != 'cancelled';
```

---

### 2.2 Progress & Completion Issues

#### Issue: Progress not updating after lesson completion
**Symptoms:** Lesson marked complete but progress % unchanged
**Diagnosis:**
1. Check training_lesson_progress record exists
2. Verify status = 'completed' and progress_pct = 100
3. Check training_progress recalculation trigger

**Resolution:**
```sql
-- Check lesson progress
SELECT * FROM training_lesson_progress 
WHERE assignment_id = 'assign-id' AND lesson_id = 'lesson-id';

-- Manual recalculation
SELECT recalculateProgress('assign-id');
```

**Manual Recalculation API:**
```
POST /api/training/assignments/{id}/recalculate
Authorization: Bearer <token>
```

---

#### Issue: Assessment not accessible
**Symptoms:** 403 "This assessment is not part of your assigned training"
**Diagnosis:**
1. Check if employee has assignment for the programme/course
2. Verify assessment status = 'active' or 'published'
3. Check max_attempts not exceeded

**Resolution:**
```sql
-- Verify assignment exists for assessment
SELECT ta.* FROM training_assignments ta
JOIN training_assessments a ON a.id = 'assessment-id'
JOIN training_courses c ON c.id = a.course_id
WHERE ta.employee_id = 'emp-id' 
  AND ta.status IN ('assigned', 'in_progress')
  AND (ta.programme_id = c.programme_id OR ta.course_id = c.id);
```

---

#### Issue: Progress stuck at 99% or not reaching 100%
**Symptoms:** All lessons done but progress shows 99%
**Diagnosis:**
1. Check for lessons with is_required=true not completed
2. Verify all assessments passed
3. Check recalculateProgress logic

**Resolution:**
```sql
-- Find incomplete required lessons
SELECT l.* FROM training_lessons l
JOIN training_modules m ON m.id = l.module_id
JOIN training_courses c ON c.id = m.course_id
WHERE c.programme_id = 'prog-id'
  AND l.is_required = true
  AND l.id NOT IN (
    SELECT lesson_id FROM training_lesson_progress 
    WHERE assignment_id = 'assign-id' AND status = 'completed'
  );
```

---

### 2.3 Assessment Issues

#### Issue: Assessment won't start (403)
**Symptoms:** POST /assessments/:id/start returns 403
**Diagnosis:**
1. Assessment status not 'active'/'published'
2. No valid assignment for employee
2. Max attempts reached

**Resolution:**
```sql
-- Check assessment status
SELECT * FROM training_assessments WHERE id = 'assessment-id';

-- Check attempts
SELECT COUNT(*) FROM training_assessment_attempts 
WHERE assignment_id = 'assign-id' AND assessment_id = 'assessment-id';
```

---

#### Issue: Assessment submission fails
**Symptoms:** 500 error on submit, or score not calculated
**Diagnosis:**
1. Check answers format matches question types
2. Verify all required questions answered
2. Check for manual grading required questions

**Resolution:**
- Verify answers JSON structure matches question types
- Check for questions with requiresManualGrading=true
- Review error logs for specific error

---

### 2.4 Content & Display Issues

#### Issue: Lesson content not rendering
**Symptoms:** Empty content, markdown not parsed, "Content Not Yet Authored"
**Diagnosis:**
1. Check lesson.content.text exists and non-empty
2. Check lesson.content_status != 'NOT_AUTHORED'
3. Check content.format = 'markdown'

**Resolution:**
```sql
-- Check lesson content
SELECT id, code, title, content_status, content 
FROM training_lessons 
WHERE id = 'lesson-id';
```

---

#### Issue: Download returns 404 or empty file
**Symptoms:** 404 on /download, or empty .md file
**Diagnosis:**
1. Verify programme/course/module exists
2. Check database joins in download query
2. Check content generation logic

**Resolution:**
- Test download endpoint directly
- Check response Content-Type = text/markdown
- Verify Content-Disposition header

---

### 2.5 Pilot Cohort Issues

#### Issue: Employee not added to cohort
**Symptoms:** POST /pilot-cohorts/:id/members fails
**Diagnosis:**
1. Cohort exists and status='active'
2. Employee exists and status='active'
3. No duplicate cohort_id + employee_id

**Resolution:**
```sql
-- Check cohort
SELECT * FROM training_pilot_cohorts WHERE id = 'cohort-id';

-- Check employee
SELECT * FROM employees WHERE id = 'emp-id' AND status = 'active';

-- Check existing membership
SELECT * FROM training_cohort_members 
WHERE cohort_id = 'cohort-id' AND employee_id = 'emp-id';
```

---

#### Issue: Course assignments not created for cohort member
**Symptoms:** Member added but no training_assignments created
**Diagnosis:**
1. Check training_cohort_course_assignments has is_required=true
2. Verify cohort.programme_id matches course.programme_id
3. Check ON CONFLICT DO NOTHING not silently failing

**Resolution:**
```sql
-- Check course assignments
SELECT cca.*, c.title FROM training_cohort_course_assignments cca
JOIN training_courses c ON c.id = cca.course_id
WHERE cca.cohort_id = 'cohort-id' AND cca.is_required = true;

-- Manual assignment
INSERT INTO training_assignments (programme_id, course_id, employee_id, assigned_by, status, due_date, cohort_id)
VALUES ('prog-id', 'course-id', 'emp-id', 'staff-id', 'assigned', '2026-12-31', 'cohort-id')
ON CONFLICT DO NOTHING;
```

---

### 2.6 Data & Reporting Issues

#### Issue: Manager dashboard shows wrong team
**Symptoms:** Manager sees wrong employees or empty team
**Diagnosis:**
1. Check employees.manager_id = manager's employee_id
2. Check departments.hod_id = manager's employee_id
3. Verify manager's staff.employee_id is set

**Resolution:**
```sql
-- Check direct reports
SELECT * FROM employees WHERE manager_id = 'mgr-emp-id' AND status = 'active';

-- Check HOD departments
SELECT * FROM departments WHERE hod_id = 'mgr-emp-id';
```

---

#### Issue: Reports show incorrect data
**Symptoms:** Numbers don't match expectations
**Diagnosis:**
1. Check query filters (status, dates, joins)
2. Verify training_progress recalculation ran
2. Check for duplicate assignments

**Resolution:**
```sql
-- Force recalculation for all assignments in programme
SELECT recalculateProgress(id) FROM training_assignments 
WHERE programme_id = 'prog-id' AND status IN ('assigned', 'in_progress');
```

---

## 3. Operational Procedures

### 3.1 Daily Operations (Training Ops)

| Time | Task | Owner | Tool |
|------|------|-------|------|
| 09:00 | Check #training-alerts for overnight issues | Training Ops | Slack |
| 09:30 | Review stalled learners report | Training Ops | Dashboard |
| 10:00 | Review overdue assignments | Training Ops | Dashboard |
| 11:00 | Process new cohort member requests | Training Ops | Admin UI / API |
| 14:00 | Review assessment failures | Training Ops | Dashboard |
| 16:00 | Process feedback submissions | Training Ops | Feedback dashboard |
| 17:00 | Daily summary to #training-ops | Training Ops | Slack |

### 3.2 Weekly Operations

| Day | Task | Owner | Output |
|-----|------|-------|--------|
| Monday | Weekly progress report | Training Ops | Email to stakeholders |
| Tuesday | Stalled learner interventions | Training Ops + Managers | Action items |
| Wednesday | Assessment quality review | Assessment Lead | Report |
| Thursday | Content feedback review | Content Lead | Prioritized fixes |
| Friday | Weekly retrospective | Training Lead | Action items |

### 3.3 Incident Response Playbooks

#### Playbook: P0 - System Down
```
1. Acknowledge in #training-alerts (15 min)
2. Platform Eng Lead assesses scope
3. If DB: Check connection pool, restart pool if needed
4. If API: Check logs, restart pods if needed
5. If auth: Check JWT secret, Redis session store
6. Communicate status every 30 min in #training-alerts
7. Post-incident review within 24 hours
```

#### Playbook: P1 - Assessment Down
```
1. Acknowledge in #training-alerts (1 hour)
2. Check assessment service logs
3. Verify assessment records exist in DB
4. Check assessment service deployment
5. Rollback if recent deploy caused issue
4. Communicate workaround to affected users
5. Post-incident review within 24 hours
```

#### Playbook: P1 - Progress Not Saving
```
1. Acknowledge in #training-alerts (1 hour)
2. Check training_lesson_progress table for locks
3. Check recalculateProgress() function
3. Check for deadlocks in PG
4. Restart API pods if needed
4. Verify with test completion
5. Post-incident review within 24 hours
```

---

## 4. Common Administrative Tasks

### 4.1 Add Employee to Pilot Cohort
```bash
# Via API
curl -X POST https://api.ethertrack.in/api/training/pilot-cohorts/{cohort_id}/members \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"employee_ids": ["emp-uuid-1", "emp-uuid-2"]}'
```

### 4.2 Extend Deadline for Employee
```sql
-- Update assignment due date
UPDATE training_assignments 
SET due_date = '2027-01-31' 
WHERE employee_id = 'emp-id' AND programme_id = 'prog-id';
```

### 3.3 Reset Assessment Attempt
```sql
-- Delete attempt to allow retry
DELETE FROM training_assessment_attempts 
WHERE id = 'attempt-id' AND assignment_id = 'assign-id';

-- Reset lesson progress if needed
UPDATE training_lesson_progress 
SET status = 'not_started', progress_pct = 0, completed_at = NULL
WHERE assignment_id = 'assign-id' AND lesson_id = 'lesson-id';
```

### 3.4 Bulk Recalculate Progress
```sql
-- Recalculate all assignments in programme
DO $$
DECLARE
  assign RECORD;
BEGIN
  FOR assign IN 
    SELECT id FROM training_assignments 
    WHERE programme_id = 'prog-id' AND status IN ('assigned', 'in_progress')
  LOOP
    PERFORM recalculateProgress(assign.id);
  END LOOP;
END $$;
```

### 3.5 Generate Certificate Manually
```sql
-- Check eligibility
SELECT * FROM training_assignments 
WHERE id = 'assign-id' AND status = 'completed';

-- Issue certificate
SELECT checkAndIssueCertificate('assign-id');
```

### 3.6 Export Pilot Data
```bash
# Export assignments
psql -c "\COPY (SELECT * FROM training_assignments WHERE cohort_id = 'cohort-id') TO '/tmp/pilot_assignments.csv' CSV HEADER"

# Export progress
psql -c "\COPY (SELECT * FROM training_lesson_progress WHERE assignment_id IN (SELECT id FROM training_assignments WHERE cohort_id = 'cohort-id')) TO '/tmp/pilot_progress.csv' CSV HEADER"

# Export feedback
psql -c "\COPY (SELECT * FROM training_pilot_feedback WHERE cohort_id = 'cohort-id') TO '/tmp/pilot_feedback.csv' CSV HEADER"
```

---

## 5. Monitoring Queries

### 5.1 Daily Health Check
```sql
-- Cohort overview
SELECT 
  pc.name,
  COUNT(DISTINCT cm.employee_id) as members,
  COUNT(DISTINCT ta.id) as assignments,
  COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'completed') as completed,
  ROUND(AVG(tp.progress_pct)::numeric, 2) as avg_progress
FROM training_pilot_cohorts pc
LEFT JOIN training_cohort_members cm ON cm.cohort_id = pc.id
LEFT JOIN training_assignments ta ON ta.cohort_id = pc.id
LEFT JOIN training_progress tp ON tp.assignment_id = ta.id
WHERE pc.status = 'active'
GROUP BY pc.id;
```

### 5.2 Stalled Learners
```sql
SELECT 
  e.full_name, e.employee_code,
  ta.programme_id, p.title as programme,
  MAX(lp.updated_at) as last_activity,
  EXTRACT(DAY FROM NOW() - MAX(lp.updated_at)) as days_inactive
FROM training_lesson_progress lp
JOIN training_assignments ta ON ta.id = lp.assignment_id
JOIN employees e ON e.id = ta.employee_id
JOIN training_programmes p ON p.id = ta.programme_id
WHERE lp.status IN ('not_started', 'in_progress')
GROUP BY e.id, ta.programme_id
HAVING EXTRACT(DAY FROM NOW() - MAX(lp.updated_at)) >= 7
ORDER BY days_inactive DESC;
```

### 5.3 Overdue Assignments
```sql
SELECT 
  e.full_name, e.employee_code, e.work_email,
  ta.id, ta.due_date, ta.status,
  p.title as programme, c.title as course,
  EXTRACT(DAY FROM NOW() - ta.due_date) as days_overdue
FROM training_assignments ta
JOIN employees e ON e.id = ta.employee_id
LEFT JOIN training_programmes p ON p.id = ta.programme_id
LEFT JOIN training_courses c ON c.id = ta.course_id
WHERE ta.status IN ('assigned', 'in_progress', 'overdue')
  AND ta.due_date < NOW()
ORDER BY ta.due_date;
```

### 5.4 Assessment Performance
```sql
SELECT 
  a.title,
  COUNT(aa.id) as total_attempts,
  COUNT(aa.id) FILTER (WHERE aa.passed = true) as passed,
  ROUND(AVG(aa.score_pct)::numeric, 2) as avg_score,
  ROUND(
    COUNT(aa.id) FILTER (WHERE aa.passed = true AND aa.attempt_number = 1)::numeric 
    / NULLIF(COUNT(aa.id) FILTER (WHERE aa.attempt_number = 1), 0) * 100, 2
  ) as first_attempt_pass_rate
FROM training_assessment_attempts aa
JOIN training_assessments a ON a.id = aa.assessment_id
GROUP BY a.id, a.title
ORDER BY a.title;
```

---

## 6. Contact & Escalation

### 6.1 Immediate Contacts (P0/P1)
| Role | Name | Phone | Slack | Availability |
|------|------|-------|-------|--------------|
| Platform Eng Lead | TBD | +91-XXXXXXXXXX | @platform-eng-lead | 24/7 on-call |
| Training Eng Lead | TBD | +91-XXXXXXXXXX | @training-eng-lead | 9-20 IST |
| Training Ops Lead | TBD | +91-XXXXXXXXXX | @training-ops-lead | 9-18 IST |

### 6.2 External Dependencies
| Service | Contact | Escalation |
|---------|---------|------------|
| Database (Supabase) | Support portal | P0: 1hr, P1: 4hr |
| Email (SendGrid) | Support portal | P0: 1hr, P1: 8hr |
| File Storage (S3) | AWS Support | P0: 1hr, P1: 4hr |
| Slack | Slack Status + Support | Monitor statuspage |

---

## 7. Appendix: Useful Commands

```bash
# Restart API pods
kubectl rollout restart deployment/api -n production

# Check pod logs
kubectl logs -n production -l app=api --tail=100 -f

# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ethertrack';"

# Clear Redis cache (if used)
redis-cli FLUSHDB

# Check disk space
df -h /

# Check memory/CPU
kubectl top pods -n production
```

---

*Runbook Owner: Training Operations Lead*  
*Review: Weekly during pilot, Monthly after*  
*Last Updated: 2026-09-01*