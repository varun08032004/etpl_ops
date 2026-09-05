'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function seedCarbonAcademy() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding Carbon Academy V1.2 curriculum structure...');

    // 1. Create the Carbon Academy Programme
    const { rows: [programme] } = await client.query(`
      INSERT INTO training_programmes (
        title, code, description, version, status, 
        duration_weeks, total_estimated_hours, passing_score_pct,
        created_by, updated_by
      ) VALUES (
        'EtherTrack Carbon Academy',
        'CA-2026',
        'Comprehensive carbon market training programme for EtherTrack employees covering climate science, carbon markets, GHG accounting, project development, methodologies, MRV, verification, registries, Indian carbon market, and EtherTrack platform operations.',
        '1.2',
        'active',
        16,
        119.5,
        70,
        (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1),
        (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1)
      )
      ON CONFLICT (code) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        version = EXCLUDED.version,
        status = EXCLUDED.status,
        duration_weeks = EXCLUDED.duration_weeks,
        total_estimated_hours = EXCLUDED.total_estimated_hours,
        passing_score_pct = EXCLUDED.passing_score_pct,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING id;
    `);
    const programmeId = programme.id;
    console.log(`  ✅ Programme created: ${programmeId}`);

    // ============================================
    // FOUNDATION CORE COURSES (C01-C05)
    // ============================================

    const foundationCourses = [
      {
        code: 'C01',
        title: 'Climate & Carbon Fundamentals',
        description: 'Establish scientific foundation for why carbon markets exist. Covers climate science, carbon cycle, greenhouse effect, and international climate policy.',
        modules: [
          { code: '1.1', title: 'Greenhouse Effect & Carbon Cycle', description: 'Radiative forcing, carbon reservoirs, CO2e calculations', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '1.2', title: 'Climate Impacts & Policy', description: 'Temperature targets, mitigation vs adaptation, NDCs', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '1.3', title: 'International Climate Architecture', description: 'UNFCCC, Kyoto, Paris Agreement, voluntary vs compliance', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 }
        ],
        total_inst: 4.0, total_prac: 1.5, total_assess: 0.5, total: 6.0, tier: 'foundation'
      },
      {
        code: 'C02',
        title: 'Carbon Markets',
        description: 'Architecture and purpose of carbon markets. Market types, instruments, evolution, and integrity.',
        modules: [
          { code: '2.1', title: 'Market Types & Instruments', description: 'Allowance vs credit vs offset, voluntary vs compliance mapping', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '2.2', title: 'Market Evolution (CDM→Article 6)', description: 'CDM → VCS → Gold Standard → CORSIA → Article 6', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '2.3', title: 'Market Integrity & Quality', description: 'Additionality, permanence, leakage, double counting', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 }
        ],
        total_inst: 4.0, total_prac: 1.5, total_assess: 0.5, total: 6.0, tier: 'foundation'
      },
      {
        code: 'C03',
        title: 'Carbon Credit Lifecycle',
        description: 'Trace a carbon credit from project conception to retirement. Every stage and actor.',
        modules: [
          { code: '3.1', title: 'Project Development → Validation', description: 'Concept → PDD → validation → registration', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '3.2', title: 'Monitoring → Verification → Issuance', description: 'Monitoring → verification → issuance → registry', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '3.3', title: 'Trading → Retirement → Claims', description: 'Secondary market → retirement → corporate claims', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 }
        ],
        total_inst: 4.0, total_prac: 1.5, total_assess: 0.5, total: 6.0, tier: 'foundation'
      },
      {
        code: 'C04',
        title: 'GHG Accounting (Scopes 1/2/3)',
        description: 'Master the GHG Protocol. Classify emissions into Scope 1/2/3, organizational boundaries, reporting.',
        modules: [
          { code: '4.1', title: 'GHG Protocol & Scopes 1/2', description: 'Corporate Standard, direct & energy indirect emissions', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '4.2', title: 'Scope 3 Mapping', description: '15 categories, screening, data collection prioritization', lessons: 3, inst_hours: 2.0, prac_hours: 0.5 },
          { code: '4.3', title: 'Inventory Design & Reporting', description: 'Base year, aggregation, GWP values, verification readiness', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 }
        ],
        total_inst: 5.0, total_prac: 2.0, total_assess: 0.5, total: 7.5, tier: 'foundation'
      },
      {
        code: 'C05',
        title: 'Emissions Calculation & Data',
        description: 'Convert activity data to emissions. Emission factor hierarchy, QA/QC, worked calculations.',
        modules: [
          { code: '5.1', title: 'Emission Factor Hierarchy', description: 'IPCC, DEFRA, IEA, EPA sources; primary > secondary > default', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '5.2', title: 'Activity Data & QA/QC', description: 'Data collection plans, uncertainty assessment, documentation', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '5.3', title: 'Worked Calculations', description: 'Fuel, electricity, travel, waste, purchased goods calculations', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 }
        ],
        total_inst: 5.0, total_prac: 2.0, total_assess: 0.5, total: 7.5, tier: 'foundation'
      }
    ];

    // ============================================
    // PROFESSIONAL CARBON CORE COURSES (C06-C12)
    // ============================================

    const professionalCourses = [
      {
        code: 'C06',
        title: 'Carbon Project Development',
        description: 'Project types, PDD structure, boundaries, stakeholder consultation, safeguards.',
        modules: [
          { code: '6.1', title: 'Project Types & Technologies', description: 'Reduction vs removal; RE, efficiency, waste, AFOLU, industrial', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '6.2', title: 'PDD Structure & Boundaries', description: 'PDD sections, geographic/temporal/sectoral boundaries, applicability', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '6.3', title: 'Stakeholder & Safeguards', description: 'Consultation design, environmental/social safeguards, FPIC', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 5.0, total_prac: 2.5, total_assess: 0.5, total: 8.0, tier: 'professional'
      },
      {
        code: 'C07',
        title: 'Additionality & Baselines',
        description: 'Barrier, investment, common practice tests. Baseline methodologies and integrity.',
        modules: [
          { code: '7.1', title: 'Additionality Tests', description: 'Barrier, investment, common practice tests; gaming identification', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '7.2', title: 'Baseline Methodologies', description: 'Historical, benchmark, modeled, dynamic baselines comparison', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '7.3', title: 'Baseline Integrity & Conservativeness', description: 'Over-crediting risks, conservativeness principles', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 }
        ],
        total_inst: 5.0, total_prac: 2.5, total_assess: 0.5, total: 8.0, tier: 'professional'
      },
      {
        code: 'C08',
        title: 'Methodologies & MRV',
        description: 'Methodology architecture, applicability conditions, MRV design, data collection, QA/QC.',
        modules: [
          { code: '8.1', title: 'Methodology Architecture', description: 'Applicability → baseline → project emissions → monitoring → calculations', lessons: 3, inst_hours: 2.0, prac_hours: 0.5 },
          { code: '8.2', title: 'Applicability Conditions', description: 'Systematic condition checking, justification documentation', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '8.3', title: 'Monitoring & MRV Design', description: 'Parameters, frequency, methods, responsibilities, QA/QC', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 }
        ],
        total_inst: 5.5, total_prac: 2.0, total_assess: 0.5, total: 8.0, tier: 'professional'
      },
      {
        code: 'C09',
        title: 'Validation & Verification',
        description: 'VVB process, document review, site visits, non-conformities, corrective actions.',
        modules: [
          { code: '9.1', title: 'Validation Process', description: 'Scope, document review, site visit, findings, corrective actions', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '9.2', title: 'Verification Process', description: 'Data verification, sampling, materiality, non-conformities', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '9.3', title: 'Non-Conformities & CARs', description: 'Classification, CAR design, closure tracking', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 4.5, total_prac: 2.0, total_assess: 0.5, total: 7.0, tier: 'professional'
      },
      {
        code: 'C10',
        title: 'Registries & Credit Issuance',
        description: 'Registry architecture, account types, transactions, issuance mechanics, retirement mechanics.',
        modules: [
          { code: '10.1', title: 'Registry Architecture', description: 'Verra, Gold Standard, CDM, CORSIA, national registries comparison', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '10.2', title: 'Account Types & Transactions', description: 'Holding, retirement, transfer, cancellation accounts; API basics', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '10.3', title: 'Issuance & Retirement Mechanics', description: 'Serial numbers, verification, retirement proof, buffer pools', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 4.5, total_prac: 2.0, total_assess: 0.5, total: 7.0, tier: 'professional'
      },
      {
        code: 'C11',
        title: 'Credit Quality & Due Diligence',
        description: 'ICVCM Core Carbon Principles, quality frameworks, red flags, structured due diligence.',
        modules: [
          { code: '11.1', title: 'Quality Dimensions (ICVCM CCP)', description: 'Additionality, permanence, leakage, baseline, monitoring, verification', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '11.2', title: 'Risk Frameworks & Red Flags', description: 'ICVCM CCP, Calyx, Sylvera frameworks; over-crediting, phantom credits', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '11.3', title: 'Due Diligence Framework', description: 'Structured DD: project→methodology→baseline→additionality→MRV→registry→commercial', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 5.0, total_prac: 2.5, total_assess: 0.5, total: 8.0, tier: 'professional'
      },
      {
        code: 'C12',
        title: 'Carbon Project Economics',
        description: 'Cost structure, revenue modeling, sensitivity analysis, breakeven, investment thresholds.',
        modules: [
          { code: '12.1', title: 'Cost Structure & Revenue Modeling', description: 'Development, validation, monitoring, verification, registry, brokerage costs', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '12.2', title: 'Sensitivity & Scenario Analysis', description: 'NPV, IRR, breakeven, sensitivity, scenario analysis, tornado charts', lessons: 3, inst_hours: 2.0, prac_hours: 1.0 },
          { code: '12.3', title: 'Breakeven & Investment Thresholds', description: 'Investment thresholds, risk-adjusted returns, portfolio implications', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 }
        ],
        total_inst: 5.0, total_prac: 2.5, total_assess: 0.0, total: 7.5, tier: 'professional'
      }
    ];

    // ============================================
    // INDIA + ETHERTRACK CORE COURSES (C13-C15)
    // ============================================

    const indiaEtherTrackCourses = [
      {
        code: 'C13',
        title: 'Indian Carbon Market & CCTS',
        description: 'CCTS framework, obligations, Indian Carbon Credit Certificates, market infrastructure.',
        modules: [
          { code: '13.1', title: 'CCTS Framework & Obligations', description: 'CCTS framework, obligated entities, compliance mechanisms', lessons: 3, inst_hours: 2.0, prac_hours: 0.5 },
          { code: '13.2', title: 'Indian Carbon Credit Certificates', description: 'CCC issuance, verification, registry, trading rules', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '13.3', title: 'Market Infrastructure & Compliance', description: 'BEE, NCCR, exchanges, registry; regulatory update mechanism', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 5.0, total_prac: 2.0, total_assess: 0.5, total: 7.5, tier: 'india_ether_track'
      },
      {
        code: 'C14',
        title: 'Marketplace & Trading',
        description: 'Market participants, trading mechanics, Indian exchanges, primary vs secondary markets.',
        modules: [
          { code: '14.1', title: 'Market Participants & Trading', description: 'Developers, validators, verifiers, registries, brokers, exchanges, buyers', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '14.2', title: 'Primary vs Secondary Markets', description: 'Pricing, volume, risk, counterparties, settlement', lessons: 3, inst_hours: 1.0, prac_hours: 0.5 },
          { code: '14.3', title: 'Indian Exchange Operations', description: 'IEX/PXIL navigation, bid/ask, settlement T+1, compliance', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 4.0, total_prac: 2.0, total_assess: 0.5, total: 6.5, tier: 'india_ether_track'
      },
      {
        code: 'C15',
        title: 'EtherTrack Platform & Workflows',
        description: 'Platform architecture, project onboarding, bridge config, monitoring→issuance→settlement workflows.',
        modules: [
          { code: '15.1', title: 'Platform Architecture & Data Flows', description: 'On-chain ↔ off-chain, registry bridge, marketplace, ledger', lessons: 3, inst_hours: 1.5, prac_hours: 0.5 },
          { code: '15.2', title: 'Project Onboarding & Bridge Config', description: 'KYC, methodology check, PDD upload, registry link, bridge config', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 },
          { code: '15.3', title: 'Monitoring → Issuance → Settlement', description: 'Data ingestion, validation, bridge trigger, mint, reconciliation', lessons: 3, inst_hours: 1.5, prac_hours: 1.0 }
        ],
        total_inst: 4.5, total_prac: 2.5, total_assess: 0.5, total: 7.5, tier: 'india_ether_track'
      }
    ];

    // ============================================
    // CAPSTONE (C16)
    // ============================================

    const capstoneCourse = {
      code: 'C16',
      title: 'Integrated Carbon Project Simulation',
      description: 'Full capstone: project brief → due diligence → financial model → market pathway → defense.',
      modules: [
        { code: '16.1', title: 'Project Brief & Data Room', description: 'Receive hypothetical project; organize data room', lessons: 3, inst_hours: 1.0, prac_hours: 2.0 },
        { code: '16.2', title: 'Full Due Diligence & Quality Score', description: 'Apply C11 framework; produce scored report', lessons: 3, inst_hours: 1.0, prac_hours: 3.0 },
        { code: '16.3', title: 'Financial Model & Market Pathway', description: 'Build model; sensitivity & scenario; go-to-market', lessons: 3, inst_hours: 0.5, prac_hours: 2.0 },
        { code: '16.4', title: 'Presentation & Defense', description: '30-min presentation + 15-min Q&A panel', lessons: 3, inst_hours: 0.5, prac_hours: 1.0 }
      ],
      total_inst: 3.0, total_prac: 8.0, total_assess: 3.5, total: 14.5, tier: 'capstone'
    };

    // Insert all courses
    const allCourses = [...foundationCourses, ...professionalCourses, ...indiaEtherTrackCourses, capstoneCourse];
    let displayOrder = 0;

    for (const course of allCourses) {
      const { rows: [courseRow] } = await client.query(`
        INSERT INTO training_courses (
          programme_id, title, code, description, version, status,
          display_order, duration_hours, passing_score_pct, is_mandatory,
          tier, total_instructional_hours, total_practical_hours, total_assessment_hours, total_hours,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, '1.2', 'active',
          $5, $6, 70, true,
          $7, $8, $9, $10, $11,
          (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1),
          (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1)
        )
        ON CONFLICT (programme_id, code) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          display_order = EXCLUDED.display_order,
          duration_hours = EXCLUDED.duration_hours,
          tier = EXCLUDED.tier,
          total_instructional_hours = EXCLUDED.total_instructional_hours,
          total_practical_hours = EXCLUDED.total_practical_hours,
          total_assessment_hours = EXCLUDED.total_assessment_hours,
          total_hours = EXCLUDED.total_hours,
          updated_at = NOW()
        RETURNING id;
      `, [
        programmeId,
        course.title,
        course.code,
        course.description,
        displayOrder++,
        course.total,
        course.tier,
        course.total_inst,
        course.total_prac,
        course.total_assess,
        course.total
      ]);
      
      const courseId = courseRow.id;
      console.log(`  ✅ Course ${course.code}: ${course.title} (${course.total}h)`);

      // Insert modules for this course
      for (let i = 0; i < course.modules.length; i++) {
        const module = course.modules[i];
        const { rows: [moduleRow] } = await client.query(`
          INSERT INTO training_modules (
            course_id, title, code, description, version, status,
            display_order, duration_hours,
            created_by, updated_by
          ) VALUES ($1, $2, $3, $4, '1.2', 'active', $5, $6,
            (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1),
            (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
          RETURNING id;
        `, [
          courseId,
          module.title,
          `${course.code}.${module.code.split('.').pop()}`,
          module.description,
          i,
          module.inst_hours + module.prac_hours
        ]);

        const moduleId = moduleRow.id;

        // Insert lessons (3 per module)
        for (let j = 0; j < module.lessons; j++) {
          await client.query(`
            INSERT INTO training_lessons (
              module_id, title, code, description, lesson_type, version, status,
              display_order, duration_minutes, is_required,
              created_by, updated_by
            ) VALUES ($1, $2, $3, $4, 'document', '1.2', 'active', $5, $6, true,
              (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1),
              (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
          `, [
            moduleId,
            `${module.title} - Lesson ${j + 1}`,
            `${module.code}.${j + 1}`,
            `Learning content for ${module.title} - Lesson ${j + 1}`,
            j,
            Math.round((module.inst_hours + module.prac_hours) / module.lessons * 60)
          ]);
        }
      }
    }

    console.log('✅ All 16 courses with 60 modules and 147 lessons seeded');

    // ============================================
    // SEED SPECIALIST TRACKS
    // ============================================

    const specialistTracks = [
      {
        track_type: 'carbon_operations',
        track_name: 'Carbon Operations',
        description: 'Core carbon project development and operations competency',
        base_tier: 'professional',
        total_hours: 54.0,
        courses: ['C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12']
      },
      {
        track_type: 'engineering_advanced',
        track_name: 'Engineering Advanced',
        description: 'Advanced engineering competencies for registry bridges, smart contracts, and platform scaling',
        base_tier: 'specialist',
        total_hours: 24.0,
        prerequisite_track_type: 'carbon_operations',
        courses: ['AE01', 'AE02', 'AE03', 'AE04', 'AE05']
      },
      {
        track_type: 'compliance_advanced',
        track_name: 'Compliance Advanced',
        description: 'Advanced compliance, regulatory change management, and audit readiness',
        base_tier: 'specialist',
        total_hours: 18.0,
        courses: ['CA01', 'CA02', 'CA03', 'CA04']
      },
      {
        track_type: 'finance_advanced',
        track_name: 'Finance Advanced',
        description: 'Advanced project finance, carbon price modeling, portfolio risk, and tax accounting',
        base_tier: 'specialist',
        total_hours: 20.0,
        courses: ['FA01', 'FA02', 'FA03', 'FA04']
      },
      {
        track_type: 'sales_business_development',
        track_name: 'Sales / Business Development',
        description: 'Client-facing carbon literacy, quality communication, deal structuring',
        base_tier: 'specialist',
        total_hours: 16.0,
        courses: ['SD01', 'SD02', 'SD03', 'SD04']
      },
      {
        track_type: 'product',
        track_name: 'Product',
        description: 'Platform features, carbon data products, registry/bridge product management',
        base_tier: 'specialist',
        total_hours: 12.0,
        courses: ['PD01', 'PD02', 'PD03']
      },
      {
        track_type: 'management',
        track_name: 'Management',
        description: 'Strategic carbon management, risk governance, market intelligence',
        base_tier: 'specialist',
        total_hours: 14.0,
        courses: ['MG01', 'MG02', 'MG03']
      }
    ];

    // Seed specialist tracks
    for (const track of specialistTracks) {
      const { rows: [trackRow] } = await client.query(`
        INSERT INTO carbon_academy_specialist_tracks (
          track_type, track_name, description, base_tier, total_hours,
          prerequisite_track_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, 
          (SELECT id FROM carbon_academy_specialist_tracks WHERE track_type = $6 LIMIT 1),
          (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1)
        )
        ON CONFLICT (track_type) DO UPDATE SET
          track_name = EXCLUDED.track_name,
          description = EXCLUDED.description,
          total_hours = EXCLUDED.total_hours,
          updated_at = NOW()
        RETURNING id;
      `, [track.track_type, track.track_name, track.description, track.base_tier, track.total_hours, track.prerequisite_track_type || null]);
      
      const trackId = trackRow.id;
      
      // Map course codes to actual course IDs and create track_courses
      if (track.courses) {
        for (let i = 0; i < track.courses.length; i++) {
          const courseCode = track.courses[i];
          const { rows: [courseRow] } = await client.query(
            `SELECT id FROM training_courses WHERE code = $1 AND programme_id = $2`,
            [courseCode, programmeId]
          );
          if (courseRow) {
            await client.query(`
              INSERT INTO carbon_academy_track_courses (track_id, course_id, is_required, display_order)
              VALUES ($1, $2, true, $3)
              ON CONFLICT (track_id, course_id) DO UPDATE SET display_order = EXCLUDED.display_order
            `, [trackId, courseRow.id, i]);
          }
        }
      }
      console.log(`  ✅ Specialist track: ${track.track_name}`);
    }

    // ============================================
    // ROLE-TRACK MAPPINGS
    // ============================================

    const roleTracks = [
      { role_name: 'Carbon Operations', department: 'Carbon', job_function: 'Carbon Operations', mandatory_track: 'carbon_operations', optional_tracks: [] },
      { role_name: 'Engineering', department: 'Engineering', job_function: 'Software Engineer', mandatory_track: 'carbon_operations', optional_tracks: ['engineering_advanced'] },
      { role_name: 'Compliance', department: 'Compliance', job_function: 'Compliance Officer', mandatory_track: 'carbon_operations', optional_tracks: ['compliance_advanced'] },
      { role_name: 'Finance', department: 'Finance', job_function: 'Financial Analyst', mandatory_track: 'carbon_operations', optional_tracks: ['finance_advanced'] },
      { role_name: 'Sales / Business Development', department: 'Sales', job_function: 'Business Development', mandatory_track: 'carbon_operations', optional_tracks: ['sales_business_development'] },
      { role_name: 'Product', department: 'Product', job_function: 'Product Manager', mandatory_track: 'carbon_operations', optional_tracks: ['product'] },
      { role_name: 'Management', department: 'Management', job_function: 'Manager', mandatory_track: 'carbon_operations', optional_tracks: ['management'] }
    ];

    for (const role of roleTracks) {
      const { rows: [mandatoryTrack] } = await client.query(
        `SELECT id FROM carbon_academy_specialist_tracks WHERE track_type = $1`,
        [role.mandatory_track]
      );
      
      const optionalTrackIds = [];
      if (role.optional_tracks && role.optional_tracks.length > 0) {
        for (const optTrack of role.optional_tracks) {
          const { rows } = await client.query(`SELECT id FROM carbon_academy_specialist_tracks WHERE track_type = $1`, [optTrack]);
          if (rows.length > 0) optionalTrackIds.push(rows[0].id);
        }
      }

      await client.query(`
        INSERT INTO carbon_academy_role_tracks (
          role_name, department, job_function, mandatory_track_id, optional_track_ids, created_by
        ) VALUES ($1, $2, $3, $4, $5, (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
        ON CONFLICT (role_name, department) DO UPDATE SET
          mandatory_track_id = EXCLUDED.mandatory_track_id,
          optional_track_ids = EXCLUDED.optional_track_ids,
          updated_at = NOW()
      `, [role.role_name, role.department, role.job_function, mandatoryTrack.id, optionalTrackIds]);
      
      console.log(`  ✅ Role mapping: ${role.role_name} → ${role.mandatory_track} (+ ${role.optional_tracks.length} optional)`);
    }

    // ============================================
    // CERTIFICATION LEVELS
    // ============================================

    const certLevels = [
      {
        level_name: 'carbon_foundations',
        level_number: 1,
        title: 'Carbon Foundations',
        description: 'Foundation carbon literacy - climate science, markets, credit lifecycle, GHG accounting, emissions calculation',
        is_mandatory: true,
        course_requirements: { required_courses: ['C01', 'C02', 'C03', 'C04', 'C05'], optional_courses: [] },
        assessment_weights: { course_assessments: 60, practical_exercises: 40 },
        minimum_overall_score: 70,
        minimum_course_score: 60,
        capstone_required: false
      },
      {
        level_name: 'carbon_operations',
        level_number: 2,
        title: 'Carbon Operations',
        description: 'Working carbon competence - project development through economics',
        is_mandatory: false,
        course_requirements: { required_courses: ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12'], optional_courses: [] },
        assessment_weights: { course_assessments: 50, practical_exercises: 30, applied_competency: 20 },
        minimum_overall_score: 75,
        minimum_course_score: 65,
        capstone_required: false
      },
      {
        level_name: 'carbon_project_analyst',
        level_number: 3,
        title: 'Carbon Project Analyst',
        description: 'Full project evaluation competency including capstone',
        is_mandatory: false,
        course_requirements: { required_courses: ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15'], optional_courses: [] },
        assessment_weights: { course_assessments: 40, practical_exercises: 25, capstone: 35 },
        minimum_overall_score: 80,
        minimum_course_score: 70,
        capstone_required: true,
        capstone_minimum_score: 80
      },
      {
        level_name: 'ether_track_carbon_specialist',
        level_number: 4,
        title: 'EtherTrack Carbon Specialist',
        description: 'Platform operations + role-specific advanced expertise',
        is_mandatory: false,
        course_requirements: { required_courses: ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16'], optional_courses: ['AE01','AE02','AE03','AE04','AE05','CA01','CA02','CA03','CA04','FA01','FA02','FA03','FA04','SD01','SD02','SD03','SD04','PD01','PD02','PD03','MG01','MG02','MG03'] },
        assessment_weights: { course_assessments: 35, practical_exercises: 20, capstone: 25, specialist_track_capstone: 20 },
        minimum_overall_score: 85,
        minimum_course_score: 75,
        capstone_required: true,
        capstone_minimum_score: 85,
        critical_competency_min: 70
      }
    ];

    for (const cert of certLevels) {
      const { rows: [certRow] } = await client.query(`
        INSERT INTO carbon_academy_certification_levels (
          level_name, level_number, title, description, is_mandatory,
          course_requirements, assessment_weights, minimum_overall_score,
          minimum_course_score, capstone_required, capstone_minimum_score,
          critical_competency_min, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
        ON CONFLICT (level_name) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          course_requirements = EXCLUDED.course_requirements,
          assessment_weights = EXCLUDED.assessment_weights,
          minimum_overall_score = EXCLUDED.minimum_overall_score,
          minimum_course_score = EXCLUDED.minimum_course_score,
          capstone_required = EXCLUDED.capstone_required,
          capstone_minimum_score = EXCLUDED.capstone_minimum_score,
          critical_competency_min = EXCLUDED.critical_competency_min,
          updated_at = NOW()
        RETURNING id;
      `, [
        cert.level_name, cert.level_number, cert.title, cert.description, cert.is_mandatory,
        JSON.stringify(cert.course_requirements),
        JSON.stringify(cert.assessment_weights),
        cert.minimum_overall_score,
        cert.minimum_course_score,
        cert.capstone_required || false,
        cert.capstone_minimum_score || null,
        cert.critical_competency_min || null
      ]);
      
      // Add course requirements
      if (cert.course_requirements && cert.course_requirements.required_courses) {
        for (const courseCode of cert.course_requirements.required_courses) {
          const { rows: [courseRow] } = await client.query(
            `SELECT id FROM training_courses WHERE code = $1 AND programme_id = $2`,
            [courseCode, programmeId]
          );
          if (courseRow) {
            await client.query(`
              INSERT INTO carbon_academy_certification_requirements (certification_level_id, course_id, is_required, minimum_score, weight)
              VALUES ($1, $2, true, 70, 1)
              ON CONFLICT (certification_level_id, course_id) DO NOTHING
            `, [certRow.id, courseRow.id]);
          }
        }
      }
      console.log(`  ✅ Certification level: ${cert.title} (Level ${cert.level_number})`);
    }

    // ============================================
    // GOVERNANCE RULES
    // ============================================

    const governanceRules = [
      { content_area: 'Climate Science', frequency: 'biennial', owner_role: 'owner', source: 'IPCC AR6+', trigger_conditions: [] },
      { content_area: 'GHG Protocol', frequency: 'annual', owner_role: 'owner', source: 'WRI/WBCSD', trigger_conditions: [] },
      { content_area: 'Methodologies (VCS/GS/CDM)', frequency: 'per_release', owner_role: 'admin', source: 'Standard bodies', trigger_conditions: [] },
      { content_area: 'Article 6 Rules', frequency: 'annual', owner_role: 'admin', source: 'UNFCCC', trigger_conditions: [] },
      { content_area: 'CCTS / Indian Regulation', frequency: 'quarterly', owner_role: 'admin', source: 'Gazette of India, BEE', trigger_conditions: ['BEE material CCTS change', 'Gazette/regulatory change', 'CERC/market rule change'] },
      { content_area: 'Registry Operations', frequency: 'per_release', owner_role: 'owner', source: 'Verra/GS/CDM/CORSIA', trigger_conditions: ['Registry rule change', 'Methodology version change', 'Issuance/retirement procedure change'] },
      { content_area: 'Credit Quality Frameworks', frequency: 'semi_annual', owner_role: 'admin', source: 'ICVCM, Calyx, Sylvera', trigger_conditions: [] },
      { content_area: 'EtherTrack Platform', frequency: 'per_release', owner_role: 'owner', source: 'Internal codebase', trigger_conditions: ['EtherTrack production workflow change', 'Critical security/architecture change'] },
      { content_area: 'Project Economics', frequency: 'annual', owner_role: 'finance', source: 'Industry benchmarks', trigger_conditions: [] },
      { content_area: 'Marketplace Rules', frequency: 'per_release', owner_role: 'admin', source: 'Exchange rules', trigger_conditions: ['Exchange trading rule change'] }
    ];

    for (const rule of governanceRules) {
      const { rows: [owner] } = await client.query(
        `SELECT id FROM staff_accounts WHERE role = $1 LIMIT 1`,
        [rule.owner_role]
      );
      
      if (owner) {
        await client.query(`
          INSERT INTO carbon_academy_governance_rules (
            content_area, review_frequency, responsible_owner, authoritative_source,
            trigger_conditions, last_reviewed, next_review_due, created_by
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
          ON CONFLICT (content_area) DO UPDATE SET
            review_frequency = EXCLUDED.review_frequency,
            responsible_owner = EXCLUDED.responsible_owner,
            authoritative_source = EXCLUDED.authoritative_source,
            trigger_conditions = EXCLUDED.trigger_conditions,
            next_review_due = EXCLUDED.next_review_due,
            updated_at = NOW()
        `, [
          rule.content_area,
          rule.frequency,
          owner.id,
          rule.source,
          JSON.stringify(rule.trigger_conditions || []),
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // next year
        ]);
      }
      console.log(`  ✅ Governance rule: ${rule.content_area} (${rule.frequency})`);
    }

    // ============================================
    // CAPSTONE REQUIREMENTS
    // ============================================

    const capstoneComponents = [
      { name: 'Due Diligence Report', weight: 30, min_score: 70 },
      { name: 'Financial Model', weight: 25, min_score: 70 },
      { name: 'Market Pathway', weight: 15, min_score: 70 },
      { name: 'Oral Defense', weight: 30, min_score: 70 }
    ];

    for (const comp of capstoneComponents) {
      await client.query(`
        INSERT INTO carbon_academy_capstone_requirements (
          programme_id, component_name, weight_percentage, description,
          minimum_score, critical_failure_rules, role_specific_depth, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1))
        ON CONFLICT (programme_id, component_name) DO UPDATE SET
          weight_percentage = EXCLUDED.weight_percentage,
          minimum_score = EXCLUDED.minimum_score,
          critical_failure_rules = EXCLUDED.critical_failure_rules,
          role_specific_depth = EXCLUDED.role_specific_depth
      `, [
        programmeId,
        comp.name,
        comp.weight,
        `${comp.name} component of C16 capstone`,
        comp.min_score,
        JSON.stringify([
          "material_red_flag_missed",
          "fundamental_financial_logic_error",
          "baseline_project_emissions_confusion",
          "credit_state_confusion",
          "assessment_integrity_violation"
        ]),
        JSON.stringify({
          carbon_operations: "Full DD, methodology, MRV, quality scoring",
          engineering: "Platform/registry workflow, bridge, settlement",
          compliance: "Regulatory analysis, evidence packaging, CCTS/Article 6",
          finance: "Financial model, NPV, IRR, sensitivity, scenario analysis",
          sales_bd: "Client assessment, commercial pathway, deal structuring",
          product: "Workflow analysis, user journey, data products",
          management: "Strategic evaluation, risk governance, portfolio decisions"
        })
      ]);
    }
    console.log('  ✅ Capstone requirements seeded');

    // ============================================
    // ASSIGN SPECIALIST TRACK COURSES
    // ============================================
    // Map track course codes to actual course IDs (only for existing C01-C16 courses)
    // Specialist track courses (AE01, CA01, FA01, etc.) are separate advanced courses
    // that will be created in a future milestone
    const trackCourseMap = {
      carbon_operations: ['C06','C07','C08','C09','C10','C11','C12']
    };

    for (const [trackType, courseCodes] of Object.entries(trackCourseMap)) {
      console.log(`  Linking courses for track: ${trackType}`);
      const { rows: [track] } = await client.query(
        `SELECT id FROM carbon_academy_specialist_tracks WHERE track_type = $1`,
        [trackType]
      );
      if (!track) {
        console.log(`  ⚠️ Track ${trackType} not found, skipping`);
        continue;
      }
      console.log(`  Found track: ${track.id}`);
      for (let i = 0; i < courseCodes.length; i++) {
        const courseCode = courseCodes[i];
        console.log(`  Linking course ${courseCode}...`);
        const { rows: [course] } = await client.query(
          `SELECT id FROM training_courses WHERE code = $1 AND programme_id = $2`,
          [courseCode, programmeId]
        );
        if (!course) {
          console.log(`  ⚠️ Course ${courseCode} not found, skipping`);
          continue;
        }
        console.log(`  Found course ${courseCode}: ${course.id}`);
        try {
          await client.query(`
            INSERT INTO carbon_academy_track_courses (track_id, course_id, is_required, display_order)
            VALUES ($1, $2, true, $3)
            ON CONFLICT (track_id, course_id) DO UPDATE SET display_order = EXCLUDED.display_order
          `, [track.id, course.id, i]);
          console.log(`  ✅ Linked ${courseCode} to track ${trackType}`);
        } catch (err) {
          console.error(`  ❌ Failed to link ${courseCode}:`, err.message);
          throw err;
        }
      }
      console.log(`  ✅ Track courses linked: ${trackType} (${courseCodes.length} courses)`);
    }

    // ============================================
    // GOVERNANCE RULES (already seeded above at lines 605-647)
    // ============================================
    console.log('  ✅ Governance rules seeded (already completed above)');

    // ============================================
    // CERTIFICATION LEVELS (already seeded at lines 496-540)
    // ============================================
// ============================================
    // ROLE-TRACK MAPPINGS
    // ============================================

    await client.query('COMMIT');
    console.log('\n✅ Carbon Academy V1.2 curriculum structure seeded successfully!');
    console.log('   - 16 courses, 60 modules, 147 lessons');
    console.log('   - 7 specialist tracks');
    console.log('  - 4 certification levels');
    console.log('  - Governance rules, capstone requirements, role mappings');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error('Stack trace:', err.stack);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedCarbonAcademy().catch(() => process.exit(1));