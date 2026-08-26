# EtherTrack Program - Current Context

**Last Updated:** 2026-08-26  
**Current Phase:** Stabilization Complete - Carbon Academy Restored  
**Next Milestone:** Phase 4.1 - Deterministic Calculation Engine (BLOCKED until stabilization gate passes)

---

## Project State

### Completed Phases
- ✅ Phase 0: Baseline / Architecture
- ✅ Phase 1: Canonical GHGP Domain Model
- ✅ Phase 2: Emission Factor Registry
- ✅ Phase 3: Unit & Normalization Engine
- ✅ Phase 3.5: Activity Normalization Engine
- ✅ **Carbon Academy Stabilization** (NEW - completed 2026-08-26)

### Active Phase
- **Phase 4: Deterministic Calculation Engine** - DESIGN/FOUNDATION ONLY - **PAUSED**

---

## Current Blocker: RESOLVED

**Carbon Academy curriculum loading failure** - FIXED

### What Was Broken
- Frontend: "Failed to load Carbon Academy curriculum"
- API: 500 errors, wrong column query
- Database: 2x duplicate modules (98 vs 49), 2x duplicate lessons (294 vs 147)
- Content: 0/147 lessons had markdown content

### Root Causes
1. Seed script ran multiple times → duplicate records
2. Lesson code format mismatch: markdown `01.2.1` vs DB `1.2.1`
3. Backend queried non-existent `status` column

### Fixes Applied
1. **Cleanup script** (`cleanup-all.js`): Removed 49 duplicate modules, 147 duplicate lessons
2. **Import script fix** (`import-lesson-content.js`): Normalized `01.2.1` → `1.2.1`
3. **Backend fix** (`training.js:108`): `status` → `content_version_status`
4. **Imported 69 lessons** with markdown content

---

## Database State (Verified)

| Entity | Count | Expected |
|--------|-------|----------|
| Programme | 1 | 1 |
| Courses | 16 | 16 |
| Modules | 49 | 49 |
| Lessons | 147 | 147 |
| Lessons with content | 69 | 147 (partial) |

**Validation:** `node scripts/validate-carbon-academy.js` ✅ PASS

---

## API Endpoints Verified

| Endpoint | Status |
|----------|--------|
| `GET /api/training/carbon-academy` | ✅ 401 (auth required) |
| `GET /api/training/programmes` | ✅ |
| `GET /api/training/my-training` | ✅ 401 (auth required) |
| `GET /api/training/lessons/:id/materials` | ✅ |

---

## Frontend Status

- Build: ✅ Pass
- TypeScript: ✅ Pass
- Route `/training/carbon-academy` → `TrainingCarbonAcademy`
- Proxy `/api/*` → `localhost:5001` configured

---

## Git Status

**Working Directory:** Clean (no uncommitted changes to committed files)  
**New Files:** 6 backend scripts, 1 frontend proxy config  
**Modified Files:** `training.js`, `import-lesson-content.js`  

**Next Commit:** `fix(academy): restore carbon academy curriculum loading`

---

## Known Risks

1. **78 lessons without content** - Only partial markdown coverage
2. **No content versioning** - All content shows as `AUTHORED`, not `PUBLISHED`
3. **C03 module discrepancy** - Markdown has 4 modules, DB has 3

---

## Do Not Touch (Preserved)

- Phase 1-3 database schema and tests (71/71 passing)
- Emission factor registry
- Unit conversion engine
- Activity normalization engine
- All existing API endpoints unrelated to training

---

## Next Exact Task

After git commit and push: **Resume Phase 4.1 - Deterministic Calculation Engine**