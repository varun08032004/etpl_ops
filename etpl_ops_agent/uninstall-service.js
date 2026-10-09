'use strict';

// Uninstall watchdog Windows Service
// Run as Administrator: node uninstall-service.js

const Service = require('node-windows').Service;

const svc = new Service({
  name: 'EtherTrackAgentWatchdog',
  script: require('path').join(__dirname, 'watchdog.js'),
});

svc.on('uninstall', () => {
  console.log('Watchdog service uninstalled successfully');
});

svc.on('error', (err) => {
  console.error('Service error:', err.message);
  if (err.message.includes('Access denied') || err.message.includes('privilege')) {
    console.error('\nERROR: This script must be run as Administrator!');
  }
});

console.log('Uninstalling EtherTrack Agent Watchdog service...');
console.log('This requires Administrator privileges.\n');

svc.uninstall();