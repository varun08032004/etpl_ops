# EtherTrack Carbon Academy — Internal Pilot Go-Live Checklist

**Programme:** CA-2026 EtherTrack Carbon Academy  
**Pilot:** Internal Pilot 2026  
**Target Go-Live:** 2026-09-07  
**Checklist Version:** 1.0  
**Status:** In Progress  

---

## Checklist Instructions

- Each item must be verified and signed off before go-live
- Items marked **BLOCKER** prevent go-live if not complete
- Items marked **REQUIRED** should be complete but may have mitigations
- Items marked **NICE-TO-HAVE** are optional for pilot

**Go-Live Authority:** Training Lead + HR Lead + Engineering Lead (all three must approve)

---

## SECTION 1: Technical Infrastructure

### 1.1 Production Environment
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 1.1 | Production API deployed & healthy | BLOCKER | ☐ | | | Health endpoint 200 |
| 1.2 | Database migrations applied | BLOCKER | ☐ | | | Migration log |
| 1.3 | SSL certificates valid | BLOCKER | ☐ | | | Cert expiry > 90 days |
| 1.4 | CDN/assets serving correctly | REQUIRED | ☐ | | | Asset load test |
| 1.5 | CORS configured for frontend | BLOCKER | ☐ | | | CORS headers present |
| 1.6 | Rate limiting configured | REQUIRED | ☐ | | | Rate limit headers |
| 1.7 | Logging & monitoring active | REQUIRED | ☐ | | | Logs in CloudWatch/Datadog |

### 1.2 Database
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 2.1 | All training tables exist | BLOCKER | ☐ | | | Schema diff |
| 2.2 | Foreign keys enforced | BLOCKER | ☐ | | | FK constraints |
| 2.3 | Indexes on query paths | REQUIRED | ☐ | | | EXPLAIN ANALYZE |
| 2.4 | Connection pooling configured | REQUIRED | ☐ | | | Pool stats |
| 2.5 | Backup schedule active | REQUIRED | ☐ | | | Backup logs |
| 2.6 | Point-in-time recovery tested | NICE-TO-HAVE | ☐ | | | Recovery drill log |

### 1.3 Authentication & Security
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 3.1 | JWT signing key rotated | BLOCKER | ☐ | | | Key rotation log |
| 3.2 | Access token expiry 15min | BLOCKER | ☐ | | | Token decode |
| 3.3 | Refresh token expiry 7 days | BLOCKER | ☐ | | | Token decode |
| 3.4 | Session limit enforced (5) | REQUIRED | ☐ | | | Concurrent session test |
| 3.5 | Password policy enforced | REQUIRED | ☐ | | | Policy config |
| 3.6 | 2FA available for pilot users | NICE-TO-HAVE | ☐ | | | 2FA enrollment test |
| 3.8 | CORS origins restricted | BLOCKER | ☐ | | | CORS headers |
| 3.9 | CSP headers configured | REQUIRED | ☐ | | | CSP header test |

---

## SECTION 2: Curriculum & Content

### 4.1 Programme & Curriculum
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 4.1 | CA-2026 programme exists & active | BLOCKER | ☐ | | | Programme record |
| 4.2 | 16 courses created & linked | BLOCKER | ☐ | | | Course count = 16 |
| 4.3 | 49 modules created & linked | BLOCKER | ☐ | | | Module count = 49 |
| 4.4 | 147 lessons created & linked | BLOCKER | ☐ | | | Lesson count = 147 |
| 4.5 | All lessons have content | BLOCKER | ☐ | | | 0 NULL content lessons |
| 4.6 | Display orders correct | REQUIRED | ☐ | | | Visual inspection |
| 4.9 | Lesson content renders in UI | REQUIRED | ☐ | | | Manual spot check |
| 4.10 | Download endpoints work | REQUIRED | ☐ | | | Prog/Course/Module download |

### 4.2 Assessments & Exercises
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 4.10 | 16 course assessments created | BLOCKER | ☐ | | | Assessment count = 17 |
| 4.11 | Questions per assessment ≥ 5 | REQUIRED | ☐ | | | Question counts |
| 4.11 | Question types valid | REQUIRED | ☐ | | | Enum values |
| 4.12 | Correct answers marked | BLOCKER | ☐ | | | Option.is_correct |
| 4.13 | 147 exercises created | BLOCKER | ☐ | | | Exercise count = 147 |
| 4.14 | Exercise instructions present | REQUIRED | ☐ | | | Non-empty instructions |

### 4.3 Competencies
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 4.12 | 14 competencies defined | BLOCKER | ☐ | | | Competency count = 14 |
| 4.13 | Assessment↔competency mapped | REQUIRED | ☐ | | | Mapping count > 0 |
| 4.14 | Exercise↔competency mapped | REQUIRED | ☐ | | | Mapping count > 0 |

---

## SECTION 3: Pilot Operations

### 5.1 Pilot Cohort
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 5.1 | Pilot cohort(s) created | BLOCKER | ☐ | | | Cohort records |
| 5.2 | Target employees enrolled | BLOCKER | ☐ | | | Member count 10-15 |
| 5.3 | Role-based tracks assigned | BLOCKER | ☐ | | | Track assignments |
| 5.4 | Course assignments created | BLOCKER | ☐ | | | Assignment records |
| 5.5 | Due dates configured | REQUIRED | ☐ | | | Due dates set |
| 5.6 | Cohort start/end dates set | REQUIRED | ☐ | | | Dates configured |

### 5.2 Employee Assignments
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 5.7 | All pilot employees have assignments | BLOCKER | ☐ | | | Assignment count |
| 5.8 | No duplicate assignments | REQUIRED | ☐ | | | Unique constraints |
| 5.9 | Programme-level + course-level correct | REQUIRED | ☐ | | | Mix verified |
| 5.10 | Cohort ID linked to assignments | REQUIRED | ☐ | | | cohort_id populated |

### 5.3 Progress & Tracking
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 5.11 | Lesson progress tracking works | BLOCKER | ☐ | | | Start/complete API |
| 5.12 | Assessment attempts work | BLOCKER | ☐ | | | Start/submit API |
| 5.12 | Progress recalculation works | REQUIRED | ☐ | | | recalculateProgress() |
| 5.13 | Certificate issuance works | REQUIRED | ☐ | | | checkAndIssueCertificate() |

---

## SECTION 4: RBAC & Access Control

### 6.1 Role Permissions
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 6.1 | Employee: own progress only | BLOCKER | ☐ | | | 403 on others |
| 6.2 | Manager: team dashboard only | BLOCKER | ☐ | | | Team isolation |
| 6.3 | HR/Admin: all progress | BLOCKER | ☐ | | | Full access |
| 6.4 | Owner: all admin functions | BLOCKER | ☐ | | | Full access |
| 6.5 | Unauthenticated: 401 | BLOCKER | ☐ | | | 401 responses |

### 6.2 Data Isolation
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 6.6 | Employee A cannot see B's progress | BLOCKER | ☐ | | | IDOR test |
| 6.7 | Employee cannot download unauthorized | BLOCKER | ☐ | | | Authz on downloads |
| 6.8 | Manager cannot see other teams | BLOCKER | ☐ | | | Team filter test |
| 6.9 | Assessment answers never exposed | BLOCKER | ☐ | | | Answer leakage test |

---

## SECTION 5: Pilot-Specific Features

### 7.1 Pilot Cohort Management
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 7.1 | Create cohort API works | REQUIRED | ☐ | | | POST /pilot-cohorts |
| 7.2 | Add members bulk works | REQUIRED | ☐ | | | POST /:id/members |
| 7.3 | Course assignments per cohort | REQUIRED | ☐ | | | POST /:id/course-assignments |
| 7.4 | Auto-assignment on member add | REQUIRED | ☐ | | | Trigger verified |

### 7.2 Pilot Feedback
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 7.5 | Feedback submit works | REQUIRED | ☐ | | | POST /pilot-feedback |
| 7.6 | Feedback analytics work | REQUIRED | ☐ | | | GET /pilot-feedback/analytics |
| 7.7 | Feedback linked to cohort | REQUIRED | ☐ | | | cohort_id captured |

### 7.3 Competency Tracking
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 7.8 | Competencies list works | REQUIRED | ☐ | | | GET /competencies |
| 7.9 | Employee competency profile | REQUIRED | ☐ | | | GET /employees/:id/competencies |
| 7.10 | Evidence creation works | REQUIRED | ☐ | | | POST /competencies/evidence |
| 7.11 | Assessment→competency link | REQUIRED | ☐ | | | Mapping verified |

### 7.4 Manager Dashboard
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 7.12 | Manager dashboard loads | REQUIRED | ☐ | | | GET /reports/manager-dashboard |
| 7.13 | Team progress accurate | REQUIRED | ☐ | | | Data matches DB |
| 7.14 | Overdue flagging works | REQUIRED | ☐ | | | Overdue count correct |

### 7.5 Downloads
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 7.15 | Programme download | REQUIRED | ☐ | | | .md file generated |
| 7.16 | Course download | REQUIRED | ☐ | | | .md file generated |
| 7.17 | Module download | REQUIRED | ☐ | | | .md file generated |

---

## SECTION 6: Monitoring & Reliability

### 8.1 Health Checks
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 8.1 | /health endpoint returns 200 | REQUIRED | ☐ | | | Health check |
| 8.2 | Database connectivity check | REQUIRED | ☐ | | | Pool stats |
| 8.3 | External dependencies reachable | REQUIRED | ☐ | | | Storage, email |

### 8.2 Error Tracking
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 8.4 | Error tracking configured | REQUIRED | ☐ | | | Sentry/Datadog |
| 8.5 | Alerting on 5xx errors | REQUIRED | ☐ | | | Alert config |
| 8.6 | Alerting on slow queries | NICE-TO-HAVE | ☐ | | | Query alerts |

### 8.3 Performance
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 8.7 | API p95 < 500ms | REQUIRED | ☐ | | | Load test results |
| 8.8 | Programme detail < 2s | REQUIRED | ☐ | | | 147 lessons load |
| 8.9 | Carbon academy < 3s | REQUIRED | ☐ | | | Full curriculum load |

---

## SECTION 7: Documentation & Communication

### 9.1 Documentation
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 9.1 | PILOT_PLAN.md complete | REQUIRED | ☐ | | | Document exists |
| 9.2 | TRAINING_WORKLOAD_ANALYSIS.md | REQUIRED | ☐ | | | Document exists |
| 9.3 | PILOT_SUCCESS_METRICS.md | REQUIRED | ☐ | | | Document exists |
| 9.4 | PILOT_FEEDBACK_PLAN.md | REQUIRED | ☐ | | | Document exists |
| 9.5 | PILOT_SUPPORT_RUNBOOK.md | REQUIRED | ☐ | | | Document exists |
| 9.6 | PILOT_GO_LIVE_REPORT.md | REQUIRED | ☐ | | | Document exists |

### 9.2 Stakeholder Communication
| # | Check Item | Type | Status | Verified By | Date | Evidence |
|---|------------|------|--------|-------------|------|----------|
| 9.7 | Pilot participants notified | REQUIRED | ☐ | | | Email sent |
| 9.8 | Managers briefed | REQUIRED | ☐ | | | Meeting held |
| 9.9 | HR/Admin briefed | REQUIRED | ☐ | | | Meeting held |
| 9.10 | Support team trained | REQUIRED | ☐ | | | Runbook reviewed |

---

## SECTION 8: Final Go/No-Go Decision

### Go-Live Criteria

| Category | All BLOCKER items ✅ | All REQUIRED items ✅ | Decision |
|----------|---------------------|----------------------|----------|
| Technical | ☐ | ☐ | ☐ GO / ☐ NO-GO |
| Curriculum | ☐ | ☐ | ☐ GO / ☐ NO-GO |
| Operations | ☐ | ☐ | ☐ GO / ☐ NO-GO |
| Security | ☐ | ☐ | ☐ GO / ☐ NO-GO |
| Documentation | ☐ | ☐ | ☐ GO / ☐ NO-GO |

### Final Sign-Off

| Role | Name | Signature | Date | Decision |
|------|------|-----------|------|----------|
| Training Lead | | | | ☐ GO / ☐ NO-GO |
| HR Lead | | | | ☐ GO / ☐ NO-GO |
| Engineering Lead | | | | ☐ GO / ☐ NO-GO |
| Carbon Ops Lead | | | | ☐ GO / ☐ NO-GO |
| Compliance Lead | | | | ☐ GO / ☐ NO-GO |

---

## Post-Go-Live (Week 1)

| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|
| Monitor error rates hourly | Platform Eng | Day 1-7 | ☐ |
| Daily standup with pilot participants | Training Ops | Day 1-5 | ☐ |
| Manager check-in (Day 3, 7) | Training Ops | Day 3, 7 | ☐ |
| First feedback collection (Week 1) | Training Ops | Day 7 | ☐ |
| Technical retrospective | Platform Eng | Day 7 | ☐ |

---

**Checklist Owner:** Training Engineering Lead  
**Last Updated:** 2026-09-01  
**Next Review:** Daily until go-live  
**Go-Live Date:** 2026-09-07 (Target)

---

*All BLOCKER items must be ✅ for GO decision. REQUIRED items should be ✅ with documented mitigation if not.*