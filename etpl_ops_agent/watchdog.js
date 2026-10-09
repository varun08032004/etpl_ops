// Watchdog Service for EtherTrack Agent
// Runs as Windows Service (SYSTEM account) to ensure agent survives user kill attempts
// Monitors agent process and restarts it if terminated

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const AGENT_EXE_NAME = 'EtherTrack Agent.exe'; // Packaged executable name
const AGENT_DEV_PATH = path.join(__dirname, '..', 'src', 'main.js'); // Dev mode
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const RESTART_DELAY_MS = 5000; // Wait 5s before restart
const MAX_RESTARTS_PER_HOUR = 10; // Prevent restart loops
const LOG_FILE = path.join(os.homedir(), 'ethertrack-watchdog.log');

let agentProcess = null;
let restartsThisHour = 0;
let lastRestartHour = new Date().getHours();
let isShuttingDown = false;

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    // Ignore log errors
  }
}

function logError(message, error) {
  log(`ERROR: ${message} - ${error?.message || error}`);
}

// Find agent executable
function getAgentCommand() {
  // In production, the agent is installed via NSIS installer
  // Check common install locations
  const possiblePaths = [
    // Production install (NSIS default)
    path.join(process.env.LOCALAPPDATA, 'Programs', 'EtherTrack Agent', AGENT_EXE_NAME),
    path.join(process.env.PROGRAMFILES, 'EtherTrack Agent', AGENT_EXE_NAME),
    path.join(process.env['PROGRAMFILES(X86)'], 'EtherTrack Agent', AGENT_EXE_NAME),
    // Development
    process.execPath, // current node/electron executable
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback: try to run via npm/electron in dev
  if (fs.existsSync(AGENT_DEV_PATH)) {
    return process.execPath; // electron or node
  }

  return null;
}

function getAgentArgs(agentPath) {
  if (agentPath.endsWith('.exe')) {
    return ['--watchdog-mode']; // Packaged app - pass flag to indicate watchdog-managed
  }
  // Development mode - run main.js
  return [AGENT_DEV_PATH, '--watchdog-mode'];
}

// Start agent process
function startAgent() {
  if (isShuttingDown) return;

  const agentPath = getAgentCommand();
  if (!agentPath) {
    logError('Agent executable not found', new Error('Check installation'));
    return false;
  }

  const args = getAgentArgs(agentPath);
  log(`Starting agent: ${agentPath} ${args.join(' ')}`);

  try {
    agentProcess = spawn(agentPath, args, {
      detached: false, // Not detached so we can monitor it
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // Hide console window
      env: {
        ...process.env,
        ETHERTRACK_WATCHDOG: '1', // Tell agent it's managed by watchdog
        ETHERTRACK_WATCHDOG_PID: String(process.pid),
      },
    });

    agentProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) log(`[agent] ${output}`);
    });

    agentProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) log(`[agent:err] ${output}`);
    });

    agentProcess.on('close', (code, signal) => {
      log(`Agent process exited: code=${code}, signal=${signal}`);
      agentProcess = null;
      if (!isShuttingDown) {
        scheduleRestart();
      }
    });

    agentProcess.on('error', (err) => {
      logError('Agent process error', err);
      agentProcess = null;
      if (!isShuttingDown) {
        scheduleRestart();
      }
    });

    return true;
  } catch (err) {
    logError('Failed to start agent', err);
    return false;
  }
}

function scheduleRestart() {
  const now = new Date();
  const currentHour = now.getHours();

  // Reset restart counter hourly
  if (currentHour !== lastRestartHour) {
    restartsThisHour = 0;
    lastRestartHour = currentHour;
  }

  if (restartsThisHour >= MAX_RESTARTS_PER_HOUR) {
    logError('Max restarts per hour exceeded, stopping watchdog', new Error('Restart loop detected'));
    return;
  }

  restartsThisHour++;
  log(`Scheduling restart in ${RESTART_DELAY_MS}ms (restart ${restartsThisHour}/${MAX_RESTARTS_PER_HOUR} this hour)`);

  setTimeout(() => {
    if (!isShuttingDown) {
      startAgent();
    }
  }, RESTART_DELAY_MS);
}

// Check if agent is running and responsive
async function checkAgentHealth() {
  if (!agentProcess || agentProcess.killed) {
    return false;
  }

  // Process exists but might be hung - could add HTTP health check here
  // For now, just check process existence
  try {
    process.kill(agentProcess.pid, 0); // Signal 0 just checks existence
    return true;
  } catch (e) {
    return false;
  }
}

// Main monitoring loop
async function monitorLoop() {
  if (isShuttingDown) return;

  const healthy = await checkAgentHealth();
  if (!healthy) {
    log('Agent health check failed, process appears dead');
    agentProcess = null;
    scheduleRestart();
  }
}

// Graceful shutdown
function shutdown() {
  log('Watchdog shutting down...');
  isShuttingDown = true;

  if (agentProcess && !agentProcess.killed) {
    log('Terminating agent process...');
    agentProcess.kill('SIGTERM');

    // Force kill after 10 seconds
    setTimeout(() => {
      if (agentProcess && !agentProcess.killed) {
        log('Force killing agent process...');
        agentProcess.kill('SIGKILL');
      }
    }, 10000);
  }

  // Exit after cleanup
  setTimeout(() => process.exit(0), 2000);
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  logError('Uncaught exception', err);
});
process.on('unhandledRejection', (reason) => {
  logError('Unhandled rejection', reason);
});

// Start
log('=== EtherTrack Agent Watchdog Starting ===');
log(`PID: ${process.pid}`);
log(`Platform: ${os.platform()} ${os.release()}`);
log(`Check interval: ${CHECK_INTERVAL_MS}ms`);

if (!startAgent()) {
  logError('Failed to start initial agent, will retry', new Error('Initial start failed'));
  scheduleRestart();
}

// Start monitoring loop
setInterval(monitorLoop, CHECK_INTERVAL_MS);

log('Watchdog monitoring loop started');