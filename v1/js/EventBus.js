/**
 * Simple Event Dispatcher for component communication
 * Provides centralized event handling without tight coupling
 */
class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }
    
    this.events.get(eventName).add(callback);
    
    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to remove
   */
  off(eventName, callback) {
    if (this.events.has(eventName)) {
      this.events.get(eventName).delete(callback);
      
      // Clean up empty event sets
      if (this.events.get(eventName).size === 0) {
        this.events.delete(eventName);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventName - Name of the event
   * @param {any} data - Data to pass to subscribers
   */
  emit(eventName, data = null) {
    if (this.events.has(eventName)) {
      this.events.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for "${eventName}":`, error);
        }
      });
    }
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first emission)
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   */
  once(eventName, callback) {
    const unsubscribe = this.on(eventName, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Get all active event names (useful for debugging)
   * @returns {string[]} Array of event names
   */
  getEventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * Get subscriber count for an event (useful for debugging)
   * @param {string} eventName - Name of the event
   * @returns {number} Number of subscribers
   */
  getSubscriberCount(eventName) {
    return this.events.has(eventName) ? this.events.get(eventName).size : 0;
  }

  /**
   * Clear all event subscriptions
   */
  clear() {
    this.events.clear();
  }
}

// Create and export singleton instance
const eventBus = new EventBus();

// Add debug logging in development (browser-friendly way)
const isProduction = window.location.protocol === 'https:' && !window.location.hostname.includes('localhost');
if (!isProduction) {
  const originalEmit = eventBus.emit;
  eventBus.emit = function(eventName, data) {
    console.log(`📡 EventBus: ${eventName}`, data);
    return originalEmit.call(this, eventName, data);
  };
}

export default eventBus;