# Migration Collision Analysis Report

## Summary
Six migration ID collisions exist in the repository. Each collision pair shares the same numeric prefix (016, 017, 018, 019, 020, 041) but implements different functionality with different dependencies.

## Current Checksums (Verified 2026-10-10)

| File | SHA-256 (Full) | Size | Description |
|------|----------------|------|-------------|
| 016_agent_monitoring.sql | 9A6F7D3320C255B1373D411D6C21594ED48039A0A1AAF95F97B08063E933E53D | 7,354 bytes | Agent devices, sessions, app/website usage, screenshots, monitoring settings, productivity rules |
| 016_training_fixes.sql | D96CDFDDB4D10BAF8230876E11692E1E5EB1868086226BACAD9C839AD3732A08 | 751 bytes | Fix triggers and indexes for training tables |
| 017_device_fingerprinting.sql | 236A3D1A2D1389739F37A05F5E69C516C3C9CAE24CCD7D4B91D6C18CE93BC94C | 5,255 bytes | Hardware fingerprinting, office networks, enrollment logs, anomaly detection |
| 017_training_progress_unique.sql | C2F06DD7FF91521777B508F84DBF7E403E5693BB9F38321096DDA06F1DFEF5E5 | 180 bytes | Unique constraint on training_progress |
| 018_carbon_academy_extensions.sql | 3AD58275D5AF77FB91289EC6FCEBD5CD2E5E3A916DFB43FE1A28395520A3D95B | 20,495 bytes | Carbon Academy: learning objectives, specialist tracks, certifications, governance, capstone |
| 018_screenshot_enhancements.sql | B2F56346F31B72B6B5BAAEC26277F51A8ADD84E1B46D2D75DA8A3100B8792264 | 1,130 bytes | Multi-monitor screenshots, hash verification, watermarks |
| 019_carbon_academy_course_columns.sql | 408AC4BF72656D4EB6536F2A81169C04B895616A943D43AE3121E3ACF7BBD2DB | 657 bytes | Add tier and hour columns to training_courses/programmes |
| 019_performance_monitoring_integration.sql | 7BD3309051ADD70F7CF143685939EF15083D56D8954097EF46E5BB04B2F92F9F | 3,883 bytes | Add monitoring scores to performance reviews, work_mode to agent_sessions |
| 020_asset_device_agent_link.sql | 50D9F19011ADA8D9D0174F0AF71ED11481B79034237D8547392E0CCC0D1F92F1 | 4,564 bytes | Assets table, agent-device linking, status history, triggers |
| 020_carbon_academy_module_columns.sql | DE4794A6B2719A83F6C52931B55A0870D1D381F688A1AE7719404E4E44761CA3 | 558 bytes | Add code, tier, hour columns to training_modules |
| 041_tasks_tracker.sql | 1616B3FBCB55C77D65CDF324C0C589932059B6E47A70AB88876F7EAB08BC8D14 | 3,573 bytes | Basic Jira-like tasks (v1) |
| 041_tasks_tracker_v2.sql | EAAF7D87365D3906CAC94C8656DC3FCC4733AA79D386C92142754275393DDCEC | 10,400 bytes | Enhanced tasks with teams, versions, components, labels, watchers, votes, attachments, activity log, links (v2) |

**Note on Previous Report Discrepancy**: The previous version of this analysis incorrectly mapped 018/019 hashes to the 041 collision in the narrative. The checksum table was correct; the error was in Section 6 where it stated v1 hash was 3AD5827... and v2 was 7BD3309... — those are actually the 018/019 hashes. The correct 041 hashes are listed above.

## Collision Pair Analysis

### 1. Migration 016: Agent Monitoring vs Training Fixes
**Dependencies**: 
- `016_agent_monitoring.sql` requires `employees` table and `002_platform_sync.sql`
- `016_training_fixes.sql` requires `training_assessment_attempts` and `training_assignments` tables (from `015_training_engine.sql`)

**Tables Created/Modified**:
- Agent monitoring: `agent_devices`, `agent_sessions`, `app_usage_segments`, `website_usage_segments`, `idle_periods`, `screenshots`, `monitoring_settings`, `productivity_rules`, view `agent_active_sessions`
- Training fixes: Adds triggers/indexes to existing `training_assessment_attempts`, `training_assignments`

**Compatibility**: Independent domains (agent monitoring vs training). Training fixes are small and modify existing training tables. Agent monitoring creates new tables.

**Recommendation**: **Merge into single migration `016_agent_monitoring_and_training_fixes.sql`**. Apply agent monitoring first (creates new tables), then training fixes (adds triggers/indexes). Both can run in same transaction safely.

### 2. Migration 017: Device Fingerprinting vs Training Progress Unique
**Dependencies**:
- `017_device_fingerprinting.sql` requires `016_agent_monitoring.sql` (agent_devices, agent_sessions)
- `017_training_progress_unique.sql` requires `training_progress` table (from `015_training_engine.sql`)

**Tables Created/Modified**:
- Device fingerprinting: Adds columns to `agent_devices` and `agent_sessions`, creates `office_networks`, `device_enrollment_log`, `heartbeat_anomaly_log`, modifies `monitoring_settings`
- Training progress unique: Adds unique constraint on `training_progress(assignment_id, programme_id)`

**Compatibility**: Independent domains. Device fingerprinting extends agent monitoring tables. Training constraint is on training tables.

**Recommendation**: **Merge into `017_device_fingerprinting_and_training_constraint.sql`**. Device fingerprinting depends on merged 016. Training constraint is independent.

### 3. Migration 018: Carbon Academy Extensions vs Screenshot Enhancements
**Dependencies**:
- `018_carbon_academy_extensions.sql` requires `015_training_engine.sql`, `016_training_fixes.sql`, `017_training_progress_unique.sql`
- `018_screenshot_enhancements.sql` requires `017_device_fingerprinting.sql`

**Tables Created/Modified**:
- Carbon Academy: Creates 12 new tables (`carbon_academy_learning_objectives`, `carbon_academy_lesson_objectives`, `carbon_academy_certification_levels`, `carbon_academy_certification_requirements`, `carbon_academy_specialist_tracks`, `carbon_academy_track_courses`, `carbon_academy_role_tracks`, `carbon_academy_governance_rules`, `carbon_academy_capstone_requirements`, `carbon_academy_employee_tracks`), extends `training_exercises`, `training_assessments`, `training_content_versions`
- Screenshot enhancements: Adds columns to `screenshots` (`monitor_index`, `monitor_name`, `hash`, `watermark_applied`), modifies `monitoring_settings`

**Compatibility**: Completely different domains. Carbon Academy is a major training feature with many tables. Screenshot enhancements are monitoring improvements.

**Recommendation**: **Renumber `018_screenshot_enhancements.sql` to `018b_screenshot_enhancements.sql`** (or next available number after Carbon Academy). Keep both separate as they have different dependency chains.

### 4. Migration 019: Carbon Academy Course Columns vs Performance Monitoring Integration
**Dependencies**:
- `019_carbon_academy_course_columns.sql` requires `training_courses`, `training_programmes` (from `015_training_engine.sql`)
- `019_performance_monitoring_integration.sql` requires `018_screenshot_enhancements.sql`, `performance_reviews`, `agent_sessions`

**Tables Created/Modified**:
- Carbon Academy course columns: Adds `tier`, `total_instructional_hours`, `total_practical_hours`, `total_assessment_hours`, `total_hours` to `training_courses`; adds `tier` to `training_programmes`
- Performance monitoring: Adds `monitoring_score`, `composite_score`, `goals_completion_pct`, `monitoring_flags` to `performance_reviews`; adds `work_mode`, `location_verified_at`, `location_verified_by` to `agent_sessions`; creates view `employee_performance_summary`

**Compatibility**: Independent domains. Carbon Academy extends training tables. Performance monitoring integrates HR and monitoring.

**Recommendation**: **Renumber `019_performance_monitoring_integration.sql` to `019b_performance_monitoring_integration.sql`**.

### 5. Migration 020: Asset-Device-Agent Link vs Carbon Academy Module Columns
**Dependencies**:
- `020_asset_device_agent_link.sql` requires `019_performance_monitoring_integration.sql`, `agent_devices`
- `020_carbon_academy_module_columns.sql` requires `training_modules` (from `015_training_engine.sql`)

**Tables Created/Modified**:
- Asset-device link: Creates `assets` table, view `employee_asset_agent_status`, `agent_status_history`, trigger `trg_agent_device_update_asset`
- Carbon Academy module columns: Adds `code`, `tier`, `total_instructional_hours`, `total_practical_hours`, `total_assessment_hours`, `total_hours` to `training_modules`

**Compatibility**: Independent domains. Asset management vs training modules.

**Recommendation**: **Renumber `020_carbon_academy_module_columns.sql` to `020b_carbon_academy_module_columns.sql`**.

### 6. Migration 041: Tasks Tracker v1 vs v2
**Dependencies**: Both require `departments`, `employees`, `staff_accounts`. v2 additionally requires `teams`.

**Schema Objects**:
- **v1 (041_tasks_tracker.sql)**: 4 tables (`task_projects`, `task_sprints`, `tasks`, `task_comments`), 4 enums (`task_type`, `task_priority`, `task_status`), basic indexes
- **v2 (041_tasks_tracker_v2.sql)**: 12 tables (all v1 tables + `task_project_members`, `task_versions`, `task_components`, `task_labels`, `task_task_labels`, `task_task_components`, `task_fix_versions`, `task_affects_versions`, `task_watchers`, `task_votes`, `task_attachments`, `task_activity`, `task_links`), 5 enums (v1 + `link_type`), many-to-many relationships, activity log, task linking

**Overlap Analysis**: v2 is a superset of v1. All v1 tables exist in v2 with additional columns. v2 adds many features: project members, versions, components, labels, watchers, votes, attachments, activity log, task links.

**Creation Dates**:
- v1: 2026-10-06 12:08 PM
- v2: 2026-10-06 1:50 PM (same day, 1h42m later)

**Migration Runner References**: Neither is referenced in `scripts/run-migrations.js` (only migrations 079-083 are listed).

**Current Hashes (Verified)**:
- v1: `1616B3FBCB55C77D65CDF324C0C589932059B6E47A70AB88876F7EAB08BC8D14`
- v2: `EAAF7D87365D3906CAC94C8656DC3FCC4733AA79D386C92142754275393DDCEC`

**Recommendation**: **Replace v1 with v2** (rename `041_tasks_tracker_v2.sql` → `041_tasks_tracker.sql`, delete v1). Rationale:
- v2 is a superset with all v1 tables plus 8 additional tables
- v2 created same day as explicit "replacement" (comment says "Replaces 041_tasks_tracker.sql")
- Neither migration has been run via the migration runner
- No production deployment evidence exists for either

## Runner References & Applied Records

The migration runner (`scripts/run-migrations.js`) only executes migrations 079-083:
- `079_migration_registry.sql`
- `080_encrypt_bank_credentials.sql`
- `081_encrypt_employee_pii.sql`
- `082_backfill_bank_credentials.sql`
- `083_backfill_employee_pii.sql`

None of the colliding migrations (016-020, 041) are in the runner's execution list. No `schema_migrations` table exists in any known environment yet, so no applied-migration records are available to consult.

## Resolution Plan

### Phase 1: Merge Compatible Pairs (016, 017)
```bash
# Create merged files (preserving originals)
cat backend/db/016_agent_monitoring.sql backend/db/016_training_fixes.sql > backend/db/016_agent_monitoring_and_training_fixes.sql
cat backend/db/017_device_fingerprinting.sql backend/db/017_training_progress_unique.sql > backend/db/017_device_fingerprinting_and_training_constraint.sql
```

### Phase 2: Renumber Conflicting Pairs (018, 019, 020)
```bash
mv backend/db/018_screenshot_enhancements.sql backend/db/018b_screenshot_enhancements.sql
mv backend/db/019_performance_monitoring_integration.sql backend/db/019b_performance_monitoring_integration.sql
mv backend/db/020_carbon_academy_module_columns.sql backend/db/020b_carbon_academy_module_columns.sql
```

### Phase 3: Replace 041 v1 with v2
```bash
mv backend/db/041_tasks_tracker_v2.sql backend/db/041_tasks_tracker.sql
# Keep v1 as backup or delete after verification
# rm backend/db/041_tasks_tracker.sql (original v1)
```

### Phase 4: Update Migration Runner (if these are to be added to runner)
Add merged/renumbered migrations to `scripts/run-migrations.js` in dependency order.

### Phase 5: Test on Clean Database
Run full migration sequence on isolated test database to verify no errors.

## Risk Assessment

| Collision | Risk | Mitigation |
|-----------|------|------------|
| 016 | Low | Merge compatible, test training tables exist |
| 017 | Low | Merge compatible, verify training_progress exists |
| 018 | Medium | Different domains, renumber only |
| 019 | Medium | Different domains, renumber only |
| 020 | Medium | Different domains, renumber only |
| 041 | High | v2 replaces v1 - verify no production data on v1 |

## Do Not Execute
- Do not run any of these migrations against production
- Preserve all original files until deployment history is confirmed
- Test on isolated database before any environment deployment