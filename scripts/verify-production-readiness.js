#!/usr/bin/env node
/**
 * Production Readiness Verification Script
 * Validates all systems are production-ready
 */

'use strict';

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function logCheck(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${status} ${details}`);
  checks.push({ name, status, details });
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else warnings++;
}

async function httpCheck(url, expectedStatus = 200, timeout = 5000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ status: 0, error: 'Timeout' });
    });
  });
}

async function runHealthChecks() {
  console.log('\n🔍 Running Health Checks...\n');

  // Backend health
  const health = await httpCheck(`${BASE_URL}/health`);
  logCheck('Backend /health', health.status === 200 ? 'PASS' : 'FAIL', 
    health.status === 200 ? `(${health.data})` : `Status: ${health.status}`);

  // Backend readiness
  const ready = await httpCheck(`${BASE_URL}/ready`);
  logCheck('Backend /ready', ready.status === 200 ? 'PASS' : 'FAIL',
    ready.status === 200 ? `(${ready.data})` : `Status: ${ready.status}`);

  // Frontend (if accessible)
  const frontend = await httpCheck(FRONTEND_URL);
  logCheck('Frontend', frontend.status === 200 ? 'PASS' : 'WARN',
    frontend.status === 200 ? 'Accessible' : `Status: ${frontend.status} (may be expected if not running)`);
}

async function runAuthChecks() {
  console.log('\n🔐 Running Auth Checks...\n');

  // Test login endpoint exists
  const loginTest = await httpCheck(`${BASE_URL}/api/auth/login`, 405); // GET should 405
  logCheck('Auth endpoint exists', loginTest.status === 405 ? 'PASS' : 'FAIL',
    `Status: ${loginTest.status}`);

  // Rate limiting active
  const rateLimitTest = await httpCheck(`${BASE_URL}/health`);
  const hasRateLimitHeader = rateLimitTest.headers?.['x-ratelimit-limit'] !== undefined;
  logCheck('Rate limiting headers', hasRateLimitHeader ? 'PASS' : 'WARN',
    hasRateLimitHeader ? 'Present' : 'Not detected on health endpoint');
}

async function runSecurityChecks() {
  console.log('\n🛡️ Running Security Checks...\n');

  // Check for security headers
  const health = await httpCheck(`${BASE_URL}/health`);
  const headers = health.headers || {};
  
  logCheck('CSP Header', headers['content-security-policy'] ? 'PASS' : 'WARN',
    headers['content-security-policy'] ? 'Present' : 'Missing');
  
  logCheck('HSTS Header', headers['strict-transport-security'] ? 'PASS' : 'WARN',
    headers['strict-transport-security'] ? 'Present' : 'Missing (OK for HTTP)');
  
  logCheck('X-Frame-Options', headers['x-frame-options'] ? 'PASS' : 'WARN',
    headers['x-frame-options'] ? 'Present' : 'Missing');
  
  logCheck('X-Content-Type-Options', headers['x-content-type-options'] ? 'PASS' : 'WARN',
    headers['x-content-type-options'] ? 'Present' : 'Missing');

  // Check no server header leakage
  logCheck('Server Header Hidden', !headers['server'] || headers['server'] === 'nginx' ? 'PASS' : 'WARN',
    headers['server'] ? `Server: ${headers['server']}` : 'Hidden');
}

function runFileChecks() {
  console.log('\n📁 Running File Checks...\n');

  const requiredFiles = [
    'backend/Dockerfile',
    'frontend/Dockerfile',
    'docker-compose.yml',
    'render.yaml',
    '.github/workflows/ci-cd.yml',
    'docs/openapi.yaml',
    'docs/runbook.md',
    'docs/security-audit-checklist.md',
    'docs/adrs/adr-index.md',
    'SECRET_ROTATION_PROCEDURES.md',
    'backend/scripts/rotate-secret.js',
    'backend/scripts/validate-secrets.js',
    'backend/services/keyManager.js',
  ];

  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    logCheck(`Required file: ${file}`, exists ? 'PASS' : 'FAIL', exists ? 'Found' : 'MISSING');
  }

  // Check package.json scripts (backend)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'package.json'), 'utf8'));
    const scripts = pkg.scripts || {};
    
    // These scripts may be in root or not exist - check for key migration scripts
    logCheck('Script: db:migrate', scripts['db:migrate'] ? 'PASS' : 'FAIL');
    logCheck('Script: rag:ingest', scripts['rag:ingest'] ? 'PASS' : 'FAIL');
    logCheck('Script: start', scripts['start'] ? 'PASS' : 'FAIL');
    logCheck('Script: dev', scripts['dev'] ? 'PASS' : 'FAIL');
  } catch (e) {
    logCheck('backend/package.json readable', 'FAIL', e.message);
  }

  // Check frontend package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'package.json'), 'utf8'));
    const scripts = pkg.scripts || {};
    logCheck('Frontend: build script', scripts['build'] ? 'PASS' : 'FAIL');
    logCheck('Frontend: test script', scripts['test'] ? 'PASS' : 'FAIL');
  } catch (e) {
    logCheck('frontend/package.json readable', 'FAIL', e.message);
  }
}

function runDockerChecks() {
  console.log('\n🐳 Running Docker Checks...\n');

  try {
    // Check Dockerfile syntax
    const backendDockerfile = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Dockerfile'), 'utf8');
    const frontendDockerfile = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'Dockerfile'), 'utf8');
    
    logCheck('Backend Dockerfile: non-root user', 
      backendDockerfile.includes('USER ') ? 'PASS' : 'WARN');
    logCheck('Backend Dockerfile: HEALTHCHECK',
      backendDockerfile.includes('HEALTHCHECK') ? 'PASS' : 'WARN');
    logCheck('Frontend Dockerfile: multi-stage',
      frontendDockerfile.includes('FROM ') && frontendDockerfile.split('FROM ').length > 2 ? 'PASS' : 'WARN');
    logCheck('Frontend Dockerfile: nginx',
      frontendDockerfile.includes('nginx') ? 'PASS' : 'WARN');
  } catch (e) {
    logCheck('Dockerfile readable', 'FAIL', e.message);
  }

  // Check docker-compose
  try {
    const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
    logCheck('docker-compose: backend service', compose.includes('backend:') ? 'PASS' : 'FAIL');
    logCheck('docker-compose: frontend service', compose.includes('frontend:') ? 'PASS' : 'FAIL');
    logCheck('docker-compose: postgres', compose.includes('postgres') || compose.includes('database') ? 'PASS' : 'WARN');
    logCheck('docker-compose: redis', compose.includes('redis') ? 'PASS' : 'WARN');
    logCheck('docker-compose: ollama', compose.includes('ollama') ? 'PASS' : 'WARN');
  } catch (e) {
    logCheck('docker-compose.yml readable', 'FAIL', e.message);
  }
}

function runCIChecks() {
  console.log('\n⚙️ Running CI/CD Checks...\n');

  try {
    const ci = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci-cd.yml'), 'utf8');
    logCheck('CI: lint job', ci.includes('lint') ? 'PASS' : 'FAIL');
    logCheck('CI: typecheck job', ci.includes('typecheck') || ci.includes('tsc') ? 'PASS' : 'FAIL');
    logCheck('CI: test job', ci.includes('test') ? 'PASS' : 'FAIL');
    logCheck('CI: build job', ci.includes('build') ? 'PASS' : 'FAIL');
    logCheck('CI: security scan', ci.includes('audit') || ci.includes('snyk') ? 'PASS' : 'WARN');
    logCheck('CI: deploy job', ci.includes('deploy') ? 'PASS' : 'FAIL');
    logCheck('CI: staging deploy', ci.includes('staging') ? 'PASS' : 'WARN');
    logCheck('CI: production approval', ci.includes('environment:') ? 'PASS' : 'WARN');
  } catch (e) {
    logCheck('CI/CD workflow readable', 'FAIL', e.message);
  }
}

function runRenderChecks() {
  console.log('\n☁️ Running Render Config Checks...\n');

  try {
    const render = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');
    logCheck('render.yaml: backend service', render.includes('type: web') && render.includes('backend') ? 'PASS' : 'FAIL');
    logCheck('render.yaml: frontend service', render.includes('type: static') && render.includes('frontend') ? 'PASS' : 'FAIL');
    logCheck('render.yaml: cron job', render.includes('type: cron') ? 'PASS' : 'WARN');
    logCheck('render.yaml: env vars', render.includes('envVars') ? 'PASS' : 'WARN');
    logCheck('render.yaml: health check path', render.includes('/health') ? 'PASS' : 'FAIL');
  } catch (e) {
    logCheck('render.yaml readable', 'FAIL', e.message);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PRODUCTION READINESS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📋 Total:   ${checks.length}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ FAILED CHECKS:');
    checks.filter(c => c.status === 'FAIL').forEach(c => {
      console.log(`  - ${c.name}: ${c.details}`);
    });
  }

  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    checks.filter(c => c.status === 'WARN').forEach(c => {
      console.log(`  - ${c.name}: ${c.details}`);
    });
  }

  const readinessScore = Math.round((passed / (passed + failed)) * 100);
  console.log(`\n🎯 Readiness Score: ${readinessScore}%`);
  
  if (failed === 0 && readinessScore >= 90) {
    console.log('🎉 PRODUCTION READY!');
    process.exit(0);
  } else if (failed === 0) {
    console.log('✅ Ready with warnings - review before deploy');
    process.exit(0);
  } else {
    console.log('🚫 NOT READY - Fix failed checks before deploy');
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 EtherTrack Internal Ops - Production Readiness Verification');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}\n`);

  await runHealthChecks();
  await runAuthChecks();
  await runSecurityChecks();
  runFileChecks();
  runDockerChecks();
  runCIChecks();
  runRenderChecks();
  
  printSummary();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});