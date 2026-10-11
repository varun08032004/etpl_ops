# Migration ID Collision Resolution Plan

## Summary
Six migration ID collisions exist in the repository. Each collision pair has the same numeric prefix but different functionality.

## Collision Pairs

### 1. Migration 016
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `016_agent_monitoring.sql` | 7,354 bytes | Agent devices, sessions, app/website usage, screenshots, monitoring settings, productivity rules | Requires `employees` table, `002_platform_sync.sql` |
| `016_training_fixes.sql` | 751 bytes | Fix triggers and indexes for training tables | Requires `training_assessment_attempts`, `training_assignments` |

**Resolution**: Merge into single migration `016_agent_monitoring_and_training_fixes.sql`. The training fixes are small and independent. Apply agent monitoring first (creates tables), then training fixes (adds triggers/indexes to existing training tables).

### 2. Migration 017
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `017_device_fingerprinting.sql` | 5,255 bytes | Hardware fingerprinting, office networks, enrollment logs, anomaly detection | Requires `016_agent_monitoring.sql` |
| `017_training_progress_unique.sql` | 180 bytes | Unique constraint on `training_progress` | Requires `training_progress` table |

**Resolution**: Merge into `017_device_fingerprinting_and_training_constraint.sql`. Device fingerprinting depends on 016 agent monitoring. Training constraint is independent.

### 3. Migration 018
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `018_carbon_academy_extensions.sql` | 20,495 bytes | Carbon Academy: learning objectives, specialist tracks, certifications, governance, capstone | Requires `015_training_engine.sql`, `016_training_fixes.sql`, `017_training_progress_unique.sql` |
| `018_screenshot_enhancements.sql` | 1,130 bytes | Multi-monitor screenshots, hash verification, watermarks | Requires `017_device_fingerprinting.sql` |

**Resolution**: These are completely different domains. Rename `018_screenshot_enhancements.sql` to `018b_screenshot_enhancements.sql` (or next available number after 018). Carbon Academy is a major feature; screenshot enhancements are monitoring improvements. They have different dependency chains.

### 4. Migration 019
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `019_carbon_academy_course_columns.sql` | 657 bytes | Add tier and hour columns to `training_courses` and `training_programmes` | Requires `training_courses`, `training_programmes` |
| `019_performance_monitoring_integration.sql` | 3,883 bytes | Add monitoring scores to performance reviews, work_mode to agent_sessions | Requires `018_screenshot_enhancements.sql`, `performance_reviews`, `agent_sessions` |

**Resolution**: These are independent. Rename `019_performance_monitoring_integration.sql` to `019b_performance_monitoring_integration.sql`. Carbon Academy columns are training data; performance monitoring is HR/monitoring integration.

### 5. Migration 020
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `020_asset_device_agent_link.sql` | 4,564 bytes | Assets table, agent-device linking, status history, triggers | Requires `019_performance_monitoring_integration.sql`, `agent_devices` |
| `020_carbon_academy_module_columns.sql` | 558 bytes | Add code, tier, hour columns to `training_modules` | Requires `training_modules` |

**Resolution**: Independent domains. Rename `020_carbon_academy_module_columns.sql` to `020b_carbon_academy_module_columns.sql`. Asset management vs training modules.

### 6. Migration 041
| File | Size | Description | Dependencies |
|------|------|-------------|--------------|
| `041_tasks_tracker.sql` | 3,573 bytes | Basic Jira-like tasks: projects, sprints, tasks, comments | Requires `departments`, `employees`, `staff_accounts` |
| `041_tasks_tracker_v2.sql` | 10,400 bytes | Enhanced tasks: teams, versions, components, labels, watchers, votes, attachments, activity log, links | Requires `departments`, `teams`, `employees`, `staff_accounts` |

**Resolution**: `041_tasks_tracker_v2.sql` is a superset/replacement of `041_tasks_tracker.sql`. The v2 version includes all v1 tables plus many enhancements.
- **Option A**: Delete `041_tasks_tracker.sql`, keep `041_tasks_tracker_v2.sql` as `041_tasks_tracker.sql`
- **Option B**: If v1 was already applied in any environment, create a migration `041b_tasks_tracker_v2_upgrade.sql` that adds the v2 enhancements to existing v1 tables

**Recommendation**: Option A (replace) since v2 is a complete redesign and v1 appears to be an earlier draft. No evidence v1 was deployed to production.

## Execution Order After Resolution

```
016_agent_monitoring_and_training_fixes.sql
017_device_fingerprinting_and_training_constraint.sql
018_carbon_academy_extensions.sql
018b_screenshot_enhancements.sql
019_carbon_academy_course_columns.sql
019b_performance_monitoring_integration.sql
020_asset_device_agent_link.sql
020b_carbon_academy_module_columns.sql
041_tasks_tracker.sql (renamed from v2)
...
079_migration_registry.sql
080_encrypt_bank_credentials.sql
081_encrypt_employee_pii.sql
082_backfill_bank_credentials.sql
083_backfill_employee_pii.sql
```

## Implementation Steps

1. **Backup** original collision files before any changes
2. **Merge** 016 and 017 pairs (they have compatible dependencies)
3. **Renumber** 018b, 019b, 020b (different domains, no merge needed)
4. **Replace** 041 with v2 version
5. **Update** `scripts/run-migrations.js` migration list
6. **Test** full migration sequence on clean database
7. **Verify** no breaking changes to existing environments

## Risk Assessment

| Collision | Risk | Mitigation |
|-----------|------|------------|
| 016 | Low | Merge compatible, test training tables exist |
| 017 | Low | Merge compatible, verify training_progress exists |
| 018 | Medium | Different domains, renumber only |
| 019 | Medium | Different domains, renumber only |
| 020 | Medium | Different domains, renumber only |
| 041 | High | v2 replaces v1 - verify no production data on v1 |

## Evidence for 041 Decision
- `041_tasks_tracker.sql` created: 2026-10-06 12:08 PM
- `041_tasks_tracker_v2.sql` created: 2026-10-06 1:50 PM (same day, 1.5 hours later)
- v2 is 3x larger and includes all v1 tables plus enhancements
- No migration runner references either file yet (migrations 079+ not in runner list)
- Safe to replace v1 with v2