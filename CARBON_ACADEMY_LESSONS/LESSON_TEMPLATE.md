# Carbon Academy Lesson Authoring Template

## Header Fields (Required)
```yaml
course_code: CXX
course_title: Course Title
module_code: X.Y
module_title: Module Title
lesson_code: X.Y.Z
lesson_title: Lesson Title
tier: foundation | professional | india_ether_track | capstone
lesson_version: 1.0
estimated_instructional_hours: X.XX
estimated_practical_hours: X.XX
estimated_assessment_hours: X.XX
```

## Required Sections

### 1. Learning Objectives (2-4, measurable, Bloom's taxonomy)
```yaml
learning_objectives:
  - "Calculate the radiative forcing contribution of CO2 given concentration changes (Bloom: Apply)"
  - "Explain the mechanism of greenhouse gas absorption in the infrared spectrum (Bloom: Understand)"
  - "Distinguish between radiative forcing and climate feedbacks (Bloom: Analyze)"
```

### 2. Prerequisites
```yaml
prerequisites: ["C01.1.1", "C01.1.2"]
```

### 3. Content Sections
```yaml
content_sections:
  - section_title: "Why This Matters"
    content: "..."
  - section_title: "Core Concept: [Title]"
    content: "..."
    subsections:
      - title: "1.1.1 Subsection"
        content: "..."
        tables: []
        formulas: []
  - section_title: "Worked Example: [Title]"
    scenario: "..."
    solution: "..."
    time_minutes: 30
    deliverable: "..."
    rubric: {}
  - section_title: "India Context"
    content: "..."
  - section_title: "EtherTrack Context"
    content: "..."
  - section_title: "Common Mistakes"
    content: []
  - section_title: "Professional Judgement Points"
    content: []
  - section_title: "Practical Exercise: [Title]"
    scenario: "..."
    task: "..."
    time_minutes: 30
    deliverable: "..."
    difficulty: "beginner|intermediate|advanced"
    skills_tested: []
    marking_rubric: {}
    model_answer: "..."
  - section_title: "Knowledge Check"
    questions: []
  - section_title: "Sources"
    sources: []
```

### 4. Practical Exercise
```yaml
practical_exercise:
  title: "Radiative Forcing Calculation"
  scenario: "A project reduces CH4 emissions by 10,000 tonnes/year..."
  task: "Calculate the annual RF reduction in W/m² and CO2e using both GWP100 and GWP20"
  time_minutes: 30
  deliverable: "Spreadsheet with RF calculation and CO2e under GWP100/GWP20"
  difficulty: "intermediate"
  skills_tested: ["RF formulas", "GWP application", "unit conversion"]
  marking_rubric:
    "correct_formula": 0.4
    "unit_conversion": 0.3
    "gwp_comparison": 0.3
  model_answer: "RF = 5.35 * ln(420/410) = 0.129 W/m²..."
```

### 5. Assessment Items
```yaml
assessment_items:
  - item_id: "C01.1.1.Q1"
    question: "What is the radiative forcing of CO2 increase from 400 to 420 ppm?"
    type: "multiple_choice"
    options: ["0.13 W/m²", "0.26 W/m²", "0.39 W/m²", "0.52 W/m²"]
    correct: "0.13 W/m²"
    difficulty: "easy"
    bloom_level: "apply"
    competency: "radiative_forcing_calculation"
    explanation: "RF = 5.35 × ln(420/400) = 5.35 × 0.0488 = 0.26 W/m²"
    source_reference: "Myhre et al. (1998)"
```

### 4. Competencies
```yaml
competencies:
  - competency_id: "radiative_forcing_calculation"
    name: "Radiative Forcing Calculation"
    category: "calculation"
    bloom_levels: ["apply"]
    description: "Calculate RF from GHG concentration changes using IPCC formulas"
```

### 5. Bloom Levels
```yaml
bloom_levels:
  - remember
  - understand
  - apply
  - analyze
  - evaluate
  - create
```

### 5. Bloom Levels
```yaml
bloom_levels:
  - remember
  - understand
  - apply
  - analyze
  - evaluate
  - create
```

### 6. Certification Mapping
```yaml
certification_mapping:
  - level: "carbon_foundations"
    courses_required: ["C01", "C02", "C03", "C04", "C05"]
  - level: "carbon_operations"
    courses_required: ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12"]
```

### 5. Source Register
```yaml
source_register:
  - source_id: "SRC-001"
    source_name: "IPCC AR6 WG1 (2021)"
    organization: "IPCC"
    document_title: "Climate Change 2021: The Physical Science Basis"
    url: "https://www.ipcc.ch/report/ar6/wg1/"
    publication_date: "2021-08-09"
    version: "AR6"
    date_accessed: "2026-01-15"
    source_type: "primary_authoritative"
    authority_level: "highest"
    lesson_usage: "C01.1.1, C01.1.2, C01.1.3, C01.2.1"
    claims_supported: ["RF formula", "Carbon cycle fluxes", "Observed impacts"]
    authority_level: "highest"
  - source_id: "SRC-002"
    source_name: "Myhre et al. (1998)"
    organization: "Geophysical Research Letters"
    document_title: "New estimates of radiative forcing due to well mixed greenhouse gases"
    url: "https://doi.org/10.1029/98GL01908"
    publication_date: "1998-06-15"
    version: "original"
    date_accessed: "2026-01-15"
    source_type: "primary_research"
    authority_level: "high"
    lesson_usage: "C01.1.1"
    claims_supported: ["RF formula CO2: 5.35 ln(C/C0)"]
    authority_level: "high"
```

### 6. Content Risk & Governance
```yaml
content_risk_level: "STATIC|DYNAMIC|HIGH-RISK"
regulatory_review_frequency: "biennial|annual|quarterly|per_release"
last_verified_date: "2026-01-15"
authoring_notes: "Pending IPCC AR7 review; GWP values may update"
```

---

## Quality Gate Checklist (Must pass before PUBLISHED)

- [ ] Content is technically accurate
- [ ] Current sources were checked (within 30 days for DYNAMIC content)
- [ ] Primary source used where applicable
- [ ] Important claims cross-checked (triangulated)
- [ ] Learning objectives are measurable (observable verbs)
- [ ] Practical application exists where appropriate
- [ ] Assessment aligns with objectives
- [ ] Answer keys verified
- [ ] Calculations verified (independent check)
- [ ] India context verified where applicable
- [ ] EtherTrack references verified against actual product behaviour
- [ ] No fabricated facts
- [ ] No fabricated citations
- [ ] No outdated regulatory information presented as current
- [ ] Version metadata complete
- [ ] Reviewer requirements satisfied
- [ ] Certification competency mapping complete
- [ ] Source register complete with all fields

---

## Authoring Workflow

### Phase 1: Research (before writing)
1. Identify authoritative sources for the topic
2. Check for updates since last review
3. Triangulate claims across 2+ sources
4. Identify any regulatory changes
5. Document sources in source_register

### Phase 2: Authoring
1. Write learning objectives first (measurable verbs)
2. Write "Why This Matters" — connect to professional need
3. Write core concept with appropriate depth
4. Include worked example with verified calculations
5. Add India/EtherTrack context
5. Create practical exercise with rubric
6. Write assessment items with explanations
6. Complete source register

### Phase 3: Quality Gate
- Run through Quality Gate Checklist
- Peer review (if available)
- Run validation script
- Mark as PUBLISHED only after all gates pass

---

## File Naming Convention
`C{XX}_Module_{X.Y}_Lessons.md` for module lesson files
`C{XX}_LESSON_{X.Y.Z}.md` for individual lesson files (optional)

## Naming Conventions
- Course: C01, C02, ..., C16
- Module: 1.1, 1.2, ..., 16.4
- Lesson: 1.1.1, 1.1.2, ..., 16.4.3
- Source IDs: SRC-001, SRC-002, ...
- Assessment: C01.1.1.Q1, C01.1.1.Q2, ...