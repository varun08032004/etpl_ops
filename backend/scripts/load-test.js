/**
 * Load Testing Script
 * Establishes performance baselines for the ERP system
 */

'use strict';

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '10');
const TEST_DURATION = parseInt(process.env.TEST_DURATION || '30'); // seconds
const RAMP_UP = parseInt(process.env.RAMP_UP || '5'); // seconds

const ENDPOINTS = [
  { path: '/health', method: 'GET', weight: 20 },
  { path: '/api/auth/me', method: 'GET', weight: 15, auth: true },
  { path: '/api/employees', method: 'GET', weight: 15, auth: true },
  { path: '/api/finance/expense-claims', method: 'GET', weight: 10, auth: true },
  { path: '/api/invoices', method: 'GET', weight: 10, auth: true },
  { path: '/api/bills', method: 'GET', weight: 10, auth: true },
  { path: '/api/sales/deals', method: 'GET', weight: 10, auth: true },
  { path: '/api/ai/query', method: 'POST', weight: 5, auth: true, body: { question: 'What is the company leave policy?' } },
];

const TOKEN = process.env.AUTH_TOKEN || '';

function makeRequest(endpoint, token) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, BASE_URL);
    const options = {
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (endpoint.auth && token) {
      options.headers = {
        'Cookie': `internal_ops_token=${token}`,
        'Content-Type': 'application/json',
      };
    } else {
      options.headers = { 'Content-Type': 'application/json' };
    }

    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          duration: Date.now() - start,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        duration: Date.now() - start,
        success: false,
        error: err.message,
      });
    });

    if (endpoint.method === 'POST' && endpoint.body) {
      const body = JSON.stringify(endpoint.body);
      options.headers['Content-Length'] = Buffer.byteLength(body);
      req.write(body);
    }
    req.end();
  });
}

async function runLoadTest() {
  console.log('🚀 Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Test duration: ${TEST_DURATION}s`);
  console.log(`Ramp up: ${RAMP_UP}s`);
  console.log('');

  // First, try to get auth token
  const loginToken = await login();
  if (!loginToken) {
    console.warn('⚠️  Could not obtain auth token, running unauthenticated tests only');
  }

  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    errors: {},
    byEndpoint: {},
    statusCodes: {},
  };

  const startTime = Date.now();
  const endTime = startTime + TEST_DURATION * 1000;

  // Create workers
  const workers = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workers.push(runUser(i, loginToken, endTime, results));
  }

  await Promise.all(workers);

  const totalTime = Date.now() - startTime;
  printResults(results, totalTime);
}

async function login() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      email: 'admin@ethertrack.in',
      password: 'Heylove03',
    });

    const options = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.token) {
            resolve(response.token);
          } else {
            // Check cookies
            const cookies = res.headers['set-cookie'];
            if (cookies) {
              const token = cookies.find(c => c.startsWith('internal_ops_token='));
              if (token) {
                resolve(token.split(';')[0].split('=')[1]);
              }
            }
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
    });

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function runUser(userId, token, endTime, results) {
  const userToken = token;
  
  while (Date.now() < endTime) {
    // Select endpoint based on weight
    const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedEndpoint = ENDPOINTS[0];
    
    for (const endpoint of ENDPOINTS) {
      random -= endpoint.weight;
      if (random <= 0) {
        selectedEndpoint = endpoint;
        break;
      }
    }

    const start = Date.now();
    try {
      const result = await makeRequest(selectedEndpoint, userToken);
      const duration = Date.now() - start;

      results.totalRequests++;
      results.totalDuration += duration;
      results.minDuration = Math.min(results.minDuration, duration);
      results.maxDuration = Math.max(results.maxDuration, duration);

      if (result.success) {
        results.successfulRequests++;
      } else {
        results.failedRequests++;
        results.errors[result.error || `HTTP ${result.statusCode}`] = 
          (results.errors[result.error || `HTTP ${result.statusCode}`] || 0) + 1;
      }

      results.statusCodes[result.statusCode] = (results.statusCodes[result.statusCode] || 0) + 1;

      const endpointKey = `${selectedEndpoint.method} ${selectedEndpoint.path}`;
      if (!results.byEndpoint[endpointKey]) {
        results.byEndpoint[endpointKey] = { requests: 0, success: 0, failed: 0, totalDuration: 0 };
      }
      results.byEndpoint[endpointKey].requests++;
      results.byEndpoint[endpointKey].totalDuration += duration;
      if (result.success) results.byEndpoint[endpointKey].success++;
      else results.byEndpoint[endpointKey].failed++;

    } catch (err) {
      results.failedRequests++;
      results.errors[err.message] = (results.errors[err.message] || 0) + 1;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 10 + Math.random() * 50));
  }
}

function printResults(results, totalTime) {
  console.log('\n📊 LOAD TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Total Requests: ${results.totalRequests}`);
  console.log(`Successful: ${results.successfulRequests} (${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${results.failedRequests} (${((results.failedRequests / results.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`\nLatency:`);
  console.log(`  Min: ${results.minDuration}ms`);
  console.log(`  Max: ${results.maxDuration}ms`);
  console.log(`  Avg: ${(results.totalDuration / results.totalRequests).toFixed(2)}ms`);
  console.log(`\nStatus Codes:`);
  Object.entries(results.statusCodes).sort((a, b) => b[1] - a[1]).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });
  console.log('\nBy Endpoint:');
  Object.entries(results.byEndpoint).forEach(([endpoint, stats]) => {
    const avg = (stats.totalDuration / stats.requests).toFixed(2);
    console.log(`  ${endpoint}: ${stats.requests} req (${stats.success} ok, ${stats.failed} fail) - avg ${avg}ms`);
  });

  if (Object.keys(results.errors).length > 0) {
    console.log('\nErrors:');
    Object.entries(results.errors).sort((a, b) => b[1] - a[1]).forEach(([err, count]) => {
      console.log(`  ${err}: ${count}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

async function runLoadTest() {
  console.log('🚀 Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Test duration: ${TEST_DURATION}s`);
  console.log(`Ramp up: ${RAMP_UP}s`);
  console.log('');

  // First, try to get auth token
  const loginToken = await login();
  if (!loginToken) {
    console.warn('⚠️  Could not obtain auth token, running unauthenticated tests only');
  }

  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    errors: {},
    byEndpoint: {},
    statusCodes: {},
  };

  const startTime = Date.now();
  const endTime = startTime + TEST_DURATION * 1000;

  // Create workers
  const workers = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workers.push(runUser(i, loginToken, endTime, results));
  }

  await Promise.all(workers);

  const totalTime = Date.now() - startTime;
  printResults(results, totalTime);
}

async function runUser(userId, token, endTime, results) {
  const userToken = token;
  
  while (Date.now() < endTime) {
    // Select endpoint based on weight
    const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedEndpoint = ENDPOINTS[0];
    
    for (const endpoint of ENDPOINTS) {
      random -= endpoint.weight;
      if (random <= 0) {
        selectedEndpoint = endpoint;
        break;
      }
    }

    const start = Date.now();
    try {
      const result = await makeRequest(selectedEndpoint, userToken);
      const duration = Date.now() - start;

      results.totalRequests++;
      results.totalDuration += duration;
      results.minDuration = Math.min(results.minDuration, duration);
      results.maxDuration = Math.max(results.maxDuration, duration);

      if (result.success) {
        results.successfulRequests++;
      } else {
        results.failedRequests++;
        results.errors[result.error || `HTTP ${result.statusCode}`] = 
          (results.errors[result.error || `HTTP ${result.statusCode}`] || 0) + 1;
      }

      results.statusCodes[result.statusCode] = (results.statusCodes[result.statusCode] || 0) + 1;

      const endpointKey = `${selectedEndpoint.method} ${selectedEndpoint.path}`;
      if (!results.byEndpoint[endpointKey]) {
        results.byEndpoint[endpointKey] = { requests: 0, success: 0, failed: 0, totalDuration: 0 };
      }
      results.byEndpoint[endpointKey].requests++;
      results.byEndpoint[endpointKey].totalDuration += duration;
      if (result.success) results.byEndpoint[endpointKey].success++;
      else results.byEndpoint[endpointKey].failed++;

    } catch (err) {
      results.failedRequests++;
      results.errors[err.message] = (results.errors[err.message] || 0) + 1;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 10 + Math.random() * 50));
  }
}

function printResults(results, totalTime) {
  console.log('\n📊 LOAD TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Total Requests: ${results.totalRequests}`);
  console.log(`Successful: ${results.successfulRequests} (${((results.successfulRequests / results.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${results.failedRequests} (${((results.failedRequests / results.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`\nLatency:`);
  console.log(`  Min: ${results.minDuration}ms`);
  console.log(`  Max: ${results.maxDuration}ms`);
  console.log(`  Avg: ${(results.totalDuration / results.totalRequests).toFixed(2)}ms`);
  console.log(`\nStatus Codes:`);
  Object.entries(results.statusCodes).sort((a, b) => b[1] - a[1]).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });
  console.log('\nBy Endpoint:');
  Object.entries(results.byEndpoint).forEach(([endpoint, stats]) => {
    const avg = (stats.totalDuration / stats.requests).toFixed(2);
    console.log(`  ${endpoint}: ${stats.requests} req (${stats.success} ok, ${stats.failed} fail) - avg ${avg}ms`);
  });

  if (Object.keys(results.errors).length > 0) {
    console.log('\nErrors:');
    Object.entries(results.errors).sort((a, b) => b[1] - a[1]).forEach(([err, count]) => {
      console.log(`  ${err}: ${count}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest };