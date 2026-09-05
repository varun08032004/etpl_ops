# EtherTrack Carbon Academy — Pilot Success Metrics

**Programme:** CA-2026 EtherTrack Carbon Academy  
**Pilot:** Internal Pilot 2026  
**Version:** 1.0  
**Date:** 2026-09-01  
**Owner:** Training Engineering Lead  

---

## 1. Metric Framework Overview

### 1.1 Metric Categories

| Category | Weight | Description |
|----------|--------|-------------|
| **Completion & Engagement** | 30% | Are employees completing the training? |
| **Learning Effectiveness** | 30% | Are they actually learning? |
| **Assessment Quality** | 20% | Are assessments valid and fair? |
| **Platform & Technical** | 10% | Is the platform reliable? |
| **Satisfaction & NPS** | 10% | Would employees recommend it? |

### 1.2 Measurement Principles

| Principle | Application |
|-----------|-------------|
| **Measurable** | Every metric has a defined query/calculation |
| **Actionable** | Each metric triggers a specific action if threshold breached |
| **Timely** | Measured at defined intervals (weekly, per-module, end-of-pilot) |
| **Attributable** | Linked to specific courses, modules, lessons, or employees |
| **Comparable** | Pre/post pilot comparison where applicable |

---

## 2. Completion & Engagement Metrics (30%)

### 2.1 Programme-Level

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Programme Completion Rate** | `Completed Assignments / Total Assignments` | ≥75% | Weekly | `training_progress` |
| **Cohort Completion Rate** | `Employees with 100% prog progress / Total cohort` | ≥70% | End of pilot | `training_progress` |
| **Time to Completion** | `Avg(completed_at - assigned_at)` for completed | ≤22 weeks | End of pilot | `training_assignments` |

### 2.2 Course-Level

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Course Completion Rate** | `Completed course assignments / Total course assignments` | ≥85% per course | Weekly | `training_progress` (course_id) |
| **Module Completion Rate** | `Completed modules / Total modules in course` | ≥90% per module | Weekly | `training_lesson_progress` |
| **Lesson Completion Rate** | `Completed lessons / Total lessons in module` | ≥90% per lesson | Weekly | `training_lesson_progress` |

### 2.3 Engagement Depth

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Avg Weekly Active Hours** | `Sum(lesson time_spent_seconds) / 3600 / Active weeks` | 6-8 hrs/week | Weekly | `training_lesson_progress.time_spent_seconds` |
| **Lesson Engagement Rate** | `Lessons with >0 time_spent / Total lessons accessed` | ≥90% | Weekly | `training_lesson_progress` |
| **Exercise Submission Rate** | `Submitted exercises / Total assigned exercises` | ≥80% | Weekly | `training_exercises` + submissions |
| **Assessment Attempt Rate** | `Started assessments / Available assessments` | ≥90% | Bi-weekly | `training_assessment_attempts` |

### 2.4 Progression Velocity

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Lessons/Week** | `Completed lessons / Active weeks` | ≥2.5 lessons/week | Weekly | `training_lesson_progress.completed_at` |
| **Module/Week** | `Completed modules / Active weeks` | ≥0.8 modules/week | Weekly | `training_progress` |
| **Stalled Learners** | `Employees with 0 progress in 7 days` | <10% of cohort | Daily | `training_lesson_progress.last_position` |

---

## 3. Learning Effectiveness Metrics (30%)

### 3.1 Competency Development

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Competency Improvement** | `Post-score - Pre-score` per competency | ≥20% avg improvement | Pre/Post pilot | `training_competency_evidence` |
| **Competency Attainment** | `Employees with ≥70% in competency / Total` | ≥70% per competency | End of pilot | `training_competency_evidence` |
| **Evidence Coverage** | `Competencies with evidence / Total competencies per role` | 100% for assigned | End of pilot | `training_competency_evidence` |

### 3.2 Knowledge Retention (Proxy)

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Assessment Retention** | `Final assessment score - Course assessment avg` | ≥0 (no decay) | End of pilot | `training_assessment_attempts` |
| **Exercise Quality** | `Graded exercises with passing score / Total graded` | ≥80% | Ongoing | `training_exercises` (graded) |

### 3.3 Application to Work (Self-Reported)

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Self-Reported Applicability** | `Avg(Q5_applicable) from feedback` | ≥4.0/5.0 | Post-course, post-pilot | `training_pilot_feedback.q5_applicable` |
| **Knowledge Application Confidence** | `Employees reporting "can apply" / Total` | ≥80% | Post-pilot survey | Feedback form |

---

## 4. Assessment Quality Metrics (20%)

### 4.1 Psychometric Quality

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Item Difficulty (p-value)** | `Correct responses / Total attempts` per question | 0.3-0.8 | Per assessment | `training_question_options` + attempts |
| **Item Discrimination** | `Point-biserial correlation` | >0.2 | Per assessment | Statistical analysis |
| **Assessment Reliability (Cronbach's α)** | `Internal consistency` | ≥0.7 | Per assessment | Statistical analysis |
| **Distractor Quality** | `Non-functional distractors / Total distractors` | <10% | Per assessment | Option analysis |

### 4.2 Assessment Performance

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **First-Attempt Pass Rate** | `Passed on attempt 1 / Total attempts` | ≥80% | Per assessment | `training_assessment_attempts` |
| **Overall Pass Rate** | `Passed any attempt / Total attempts` | ≥90% | Per assessment | `training_assessment_attempts` |
| **Avg Attempts to Pass** | `Avg(attempt_number) for passed` | ≤1.5 | Per assessment | `training_assessment_attempts` |
| **Time to Complete** | `Avg(time_spent_seconds) for submitted` | Within limit | Per assessment | `training_assessment_attempts.time_spent_seconds` |

### 4.3 Assessment Fairness

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Score Distribution** | Normality test (Shapiro-Wilk) | p > 0.05 | Per assessment | Score analysis |
| **Floor/Ceiling Effects** | `% at min/max score` | <5% each | Per assessment | Score distribution |
| **DIF (Differential Item Functioning)** | `Mantel-Haenszel` by role | No significant DIF | End of pilot | Item analysis |

---

## 5. Platform & Technical Metrics (10%)

### 5.1 Availability & Reliability

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Uptime** | `Uptime minutes / Total minutes` | ≥99.5% | Continuous | Uptime monitor |
| **API Error Rate** | `5xx responses / Total requests` | <0.1% | Continuous | API logs |
| **API Latency (p95)** | `p95(request_duration)` | <500ms | Continuous | APM |
| **Database Query p95** | `p95(query_duration)` | <200ms | Continuous | DB logs |

### 5.2 Data Integrity

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Progress Consistency** | `Discrepancies in progress recalc` | 0 | Weekly | Reconciliation job |
| **Data Loss Events** | Count of data loss incidents | 0 | Continuous | Audit logs |
| **Backup Success Rate** | `Successful backups / Scheduled` | 100% | Daily | Backup logs |

---

## 6. Satisfaction & NPS (10%)

### 6.1 Satisfaction Scores

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **Overall Satisfaction** | `Avg(Overall Satisfaction 1-5)` | ≥4.0/5.0 | Post-pilot | Feedback survey |
| **Content Quality** | `Avg(Content Quality 1-5)` | ≥4.0/5.0 | Post-course, post-pilot | Feedback |
| **Platform Usability** | `Avg(Usability 1-5)` | ≥4.0/5.0 | Post-pilot | Feedback |
| **Content Relevance** | `Avg(Relevance 1-5)` | ≥4.0/5.0 | Post-course | Feedback |
| **Assessment Fairness** | `Avg(Fairness 1-5)` | ≥4.0/5.0 | Post-assessment | Feedback |

### 6.2 Net Promoter Score

| Metric | Formula | Target | Measurement Frequency | Data Source |
|--------|---------|--------|----------------------|-------------|
| **NPS** | `%Promoters(9-10) - %Detractors(0-6)` | ≥30 | Post-pilot | Survey |
| **Would Recommend** | `% Yes to "Would recommend"` | ≥80% | Post-pilot | Survey |

### 6.3 Qualitative Themes

| Metric | Method | Target | Measurement Frequency | Data Source |
|--------|--------|--------|----------------------|-------------|
| **"What to REMOVE" themes** | Thematic analysis | Actionable list | Post-pilot | Open text analysis |
| **"What to ADD" themes** | Thematic analysis | Actionable list | Post-pilot | Open text analysis |
| **Critical Failure Reports** | Count of critical-failure triggers | 0 | Continuous | Capstone evaluation |

---

## 7. Measurement Schedule

| Timeline | Metrics Collected | Method |
|----------|-------------------|--------|
| **Pre-Pilot (Week -1)** | Baseline competency assessments | Online assessment |
| **Weekly (Weeks 1-20)** | Completion, engagement, progress, assessments | Automated LMS queries |
| **Bi-Weekly** | Assessment quality, competency evidence | Automated + manual review |
| **Week 10 (Post-Foundation)** | Foundation feedback survey | In-app survey |
| **Week 14 (Mid-Track)** | Mid-track feedback survey | In-app survey |
| **Week 20 (Post-Capstone)** | Capstone + programme feedback | In-app + email survey |
| **Week 22 (Post-Pilot)** | Exit survey, NPS, competency post-test | Email survey + assessment |
| **Week 24 (Post-Pilot + 2wks)** | Final analysis, go/no-go report | Analysis + report |

---

## 8. Data Collection & Reporting

### 8.1 Automated Dashboards

| Dashboard | Audience | Refresh | Key Widgets |
|-----------|----------|---------|-------------|
| **Pilot Command Center** | Training Lead, HR | Real-time | Cohort health, completions, alerts |
| **Manager Dashboard** | People Managers | 15 min | Team progress, overdue, scores |
| **HR/Admin Dashboard** | HR, Admin | 15 min | Cohort metrics, overdue, certs |
| **Content Quality** | Content Team | Daily | Lesson feedback, assessment stats |

### 8.2 Automated Alerts

| Alert | Trigger | Channel | Recipient |
|-------|---------|---------|-----------|
| Employee inactive 7+ days | No activity 7 days | Slack #training-alerts | Manager + Training Ops |
| Progress <50% at Week 10 | Progress <50% at midpoint | Email + Slack | HR + Manager |
| Assessment failure streak ≥3 | 3+ consecutive failures | Slack + Email | Employee + Manager + Training Ops |
| Overdue assignment | Past due date | Daily email | Employee + Manager |
| Capstone at risk (Week 18) | Not started by Week 18 | Slack + Email | HR + Training Lead |
| Critical technical error | 5xx rate >1% | PagerDuty | Platform Eng On-Call |

---

## 9. Analysis & Reporting

### 9.1 Mid-Pilot Report (Week 10)

| Section | Content |
|---------|---------|
| Executive Summary | Overall health, key risks |
| Completion Dashboard | Cohort, course, module completion |
| Engagement Analysis | Hours, velocity, stalled learners |
| Assessment Quality | Psychometrics, pass rates |
| Feedback Summary | Foundation survey results |
| Risk Register Update | New risks, mitigations |
| Recommendations | Course corrections for Phase 2 |

### 9.2 Final Pilot Report (Week 22)

| Section | Content |
|---------|---------|
| Executive Summary | Go/No-Go recommendation |
| Completion Analysis | By cohort, role, track, course |
| Learning Effectiveness | Pre/post competency, assessment quality |
| Technical Performance | Uptime, errors, latency |
| Feedback Synthesis | Quantitative + qualitative themes |
| Competency Development | Pre/post per competency per role |
| Certification Readiness | Certificate pipeline |
| Recommendations | Scale, iterate, or stop |

---

## 10. Metric Validation Rules

### 10.1 Data Quality Checks

| Check | Query | Pass Criteria |
|-------|-------|---------------|
| No NULL progress_pct | `SELECT COUNT(*) FROM training_progress WHERE progress_pct IS NULL` | 0 |
| No negative time_spent | `SELECT COUNT(*) FROM training_lesson_progress WHERE time_spent_seconds < 0` | 0 |
| Assessment scores 0-100 | `SELECT COUNT(*) FROM training_assessment_attempts WHERE score_pct < 0 OR score_pct > 100` | 0 |
| Progress ≤ 100% | `SELECT COUNT(*) FROM training_progress WHERE progress_pct > 100` | 0 |
| No orphan progress | `SELECT COUNT(*) FROM training_progress WHERE assignment_id NOT IN (SELECT id FROM training_assignments)` | 0 |

### 10.2 Statistical Validity

| Check | Method | Threshold |
|-------|--------|-----------|
| Assessment reliability | Cronbach's α | ≥0.7 |
| Item discrimination | Point-biserial | >0.2 |
| Sample size per metric | Central Limit Theorem | n ≥ 30 per cohort segment |

---

## 11. Metric Ownership & Accountability

| Metric Category | Owner | Review Cadence | Escalation |
|-----------------|-------|----------------|------------|
| Completion & Engagement | Training Ops Lead | Weekly | Training Lead |
| Learning Effectiveness | Content Lead | Bi-weekly | Training Lead |
| Assessment Quality | Assessment Lead | Bi-weekly | Training Lead |
| Platform & Technical | Platform Eng Lead | Daily | Engineering Lead |
| Satisfaction & NPS | Training Ops Lead | Per survey | Training Lead |

---

## 12. Success Thresholds Summary

| Outcome | Green (GO) | Yellow (GO WITH LIMITATIONS) | Red (NO-GO) |
|---------|------------|------------------------------|-------------|
| **Completion Rate** | ≥75% | 60-74% | <60% |
| **First-Attempt Pass** | ≥80% | 65-79% | <65% |
| **Avg Assessment Score** | ≥75% | 65-74% | <65% |
| **Competency Improvement** | ≥20% | 10-19% | <10% |
| **Platform Uptime** | ≥99.5% | 99.0-99.4% | <99.0% |
| **Satisfaction (1-5)** | ≥4.0 | 3.5-3.9 | <3.5 |
| **NPS** | ≥30 | 10-29 | <10 |
| **Critical Technical Failures** | 0 | 1-2 | >2 |

---

## 13. Decision Matrix

| Overall Score | Decision | Conditions |
|---------------|----------|------------|
| **All Green** | **GO_FOR_INTERNAL_PILOT** | Proceed to full rollout planning |
| **Mostly Green, ≤2 Yellow** | **GO_WITH_LIMITATIONS** | Proceed with documented mitigations |
| **Any Red** | **NO_GO** | Fix root causes, re-pilot |

---

*Document Owner: Training Engineering Lead*  
*Review Cadence: Weekly during pilot, Final at Week 22*  
*Related: `PILOT_PLAN.md`, `PILOT_GO_LIVE_CHECKLIST.md`, `PILOT_FEEDBACK_PLAN.md`*