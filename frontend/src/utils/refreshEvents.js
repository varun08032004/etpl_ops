// Simple event emitter for cross-component refresh notifications
// Usage:
// import { refreshEvents } from '../utils/refreshEvents';
// refreshEvents.emit('sync-complete');
// refreshEvents.on('sync-complete', () => { ... });

class RefreshEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }
}

export const refreshEvents = new RefreshEventEmitter();

// Pre-defined events
export const REFRESH_EVENTS = {
  SYNC_COMPLETE: 'sync-complete',
  REVENUE_UPDATED: 'revenue-updated',
  PLATFORM_DATA_UPDATED: 'platform-data-updated',
};