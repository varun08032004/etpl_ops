'use strict';

// Install watchdog as Windows Service
// Run as Administrator: node install-service.js

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'EtherTrackAgentWatchdog',
  description: 'Ensures EtherTrack Agent monitoring process is always running. Restarts agent if killed or crashed.',
  script: path.join(__dirname, 'watchdog.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=512'
  ],
  env: {
    name: 'ETHERTRACK_WATCHDOG',
    value: '1'
  },
  wait: 2,
  grow: 0.5,
  maxRetries: 10,
  maxRestarts: 10,
  abortOnError: false,
  restartOnCrash: true,
  restartOnError: true,
  restartOnExit: true,
});

// Install event handlers
svc.on('install', () => {
  console.log('Watchdog service installed successfully');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', () => {
  console.log('Watchdog service started');
  console.log('\nService details:');
  console.log('  Name: EtherTrackAgentWatchdog');
  console.log('  Description: Ensures EtherTrack Agent monitoring process is always running');
  console.log('  Startup type: Automatic');
  console.log('  Log on as: Local System (SYSTEM account)');
  console.log('\nThe watchdog will now monitor the EtherTrack Agent and restart it if terminated.');
});

svc.on('error', (err) => {
  console.error('Service error:', err.message);
  if (err.message.includes('Access denied') || err.message.includes('privilege')) {
    console.error('\nERROR: This script must be run as Administrator!');
    console.error('Right-click PowerShell/Command Prompt and select "Run as Administrator"');
  }
});

svc.on('alreadyinstalled', () => {
  console.log('Service already installed');
});

svc.on('invalidinstallation', () => {
  console.log('Invalid installation detected, reinstalling...');
  svc.uninstall();
  setTimeout(() => svc.install(), 1000);
});

console.log('Installing EtherTrack Agent Watchdog as Windows Service...');
console.log('This requires Administrator privileges.\n');

svc.install();