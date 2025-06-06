import eventBus from './EventBus.js';
import database from './Database.js';
import './components/ActivityCalendar.js';
import './components/EntryModal.js';

/**
 * Main Memory Timeline Application Controller
 * Orchestrates all components and manages the app header
 */
class CalendarApp {
  constructor() {
    // DOM elements
    this.headerElement = null;
    this.entriesCountElement = null;
    this.activityCalendar = null;
    this.entryModal = null;
    this.loadingIndicator = null;
    this.errorMessage = null;
    
    // App state
    this.isHeaderExpanded = true;
    this.activityData = new Map();
    this.settings = {
      showWeekdays: true,
      showDayNumbers: true
    };
    
    // Bind methods
    this.handleToggleWeekdays = this.handleToggleWeekdays.bind(this);
    this.handleToggleNumbers = this.handleToggleNumbers.bind(this);
    this.handleSettingsToggle = this.handleSettingsToggle.bind(this);
    this.handleAddEntry = this.handleAddEntry.bind(this);
    this.handleRetry = this.handleRetry.bind(this);
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showLoading('Loading your memories...');
      
      // Get DOM elements
      this.getDOMElements();
      
      // Initialize database
      await database.init();
      
      // Notify components that database is ready
      eventBus.emit('databaseReady');
      
      // Load saved settings
      this.loadSettings();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load activity data
      await this.loadActivityData();
      
      // Update components with initial data
      this.updateCalendarComponent();
      this.updateEntriesCount();
      
      this.hideLoading();
      console.log('✅ Memory Timeline app initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize memory timeline app:', error);
      this.showError('Failed to initialize the memory timeline. Please try again.', error);
    }
  }

  /**
   * Get references to DOM elements
   */
  getDOMElements() {
    this.headerElement = document.querySelector('.app-header');
    this.entriesCountElement = document.getElementById('entriesCount');
    this.activityCalendar = document.querySelector('activity-calendar');
    this.entryModal = document.querySelector('entry-modal');
    this.loadingIndicator = document.getElementById('loadingIndicator');
    this.errorMessage = document.getElementById('errorMessage');
    
    // Validate critical elements
    if (!this.headerElement || !this.entriesCountElement || !this.activityCalendar || !this.entryModal) {
      throw new Error('Critical DOM elements not found');
    }
    
    // Ensure header starts in expanded state
    if (!this.headerElement.classList.contains('expanded')) {
      this.headerElement.classList.add('expanded');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Header control buttons
    const toggleWeekdaysBtn = document.getElementById('toggleWeekdays');
    const toggleNumbersBtn = document.getElementById('toggleNumbers');
    const settingsToggleBtn = document.getElementById('settingsToggle');
    const addEntryBtn = document.getElementById('addEntryBtn');
    const retryBtn = document.getElementById('retryBtn');

    if (toggleWeekdaysBtn) toggleWeekdaysBtn.addEventListener('click', this.handleToggleWeekdays);
    if (toggleNumbersBtn) toggleNumbersBtn.addEventListener('click', this.handleToggleNumbers);
    if (settingsToggleBtn) settingsToggleBtn.addEventListener('click', this.handleSettingsToggle);
    if (addEntryBtn) addEntryBtn.addEventListener('click', this.handleAddEntry);
    if (retryBtn) retryBtn.addEventListener('click', this.handleRetry);

    // EventBus listeners
    eventBus.on('calendarReady', this.handleCalendarReady.bind(this));
    eventBus.on('calendarScrolled', this.handleCalendarScrolled.bind(this));
    eventBus.on('daySelected', this.handleDaySelected.bind(this));
    eventBus.on('entryAdded', this.handleEntryChanged.bind(this));
    eventBus.on('entryUpdated', this.handleEntryChanged.bind(this));
    eventBus.on('entryDeleted', this.handleEntryChanged.bind(this));
    eventBus.on('modalClosed', this.handleModalClosed.bind(this));
  }

  /**
   * Load user settings from localStorage
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('memory-timeline-settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    
    // Update UI to reflect loaded settings
    this.updateSettingsUI();
  }

  /**
   * Save user settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('memory-timeline-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  /**
   * Load activity data from database
   */
  async loadActivityData() {
    try {
      const entries = await database.getAllEntries();
      
      // Create activity map from entries
      this.activityData.clear();
      entries.forEach(entry => {
        this.activityData.set(entry.date, true);
      });
      
      console.log(`📊 Loaded ${entries.length} memories, ${this.activityData.size} active days`);
      
    } catch (error) {
      console.error('Failed to load activity data:', error);
      throw error;
    }
  }

  /**
   * Update calendar component with current data
   */
  updateCalendarComponent() {
    if (this.activityCalendar) {
      this.activityCalendar.updateActivityData(this.activityData);
      this.activityCalendar.updateSettings(this.settings);
    }
  }

  /**
   * Update entries count display
   * @param {string} changedDate - Optional date that changed (for optimization)
   * @param {boolean} wasAdded - Whether activity was added (true) or removed (false)
   */
  updateEntriesCount(changedDate = null, wasAdded = null) {
    if (!this.entriesCountElement) return;
    
    let count;
    
    // Optimize: if we know what changed, calculate incrementally
    if (changedDate && wasAdded !== null) {
      const currentCount = parseInt(this.entriesCountElement.textContent) || 0;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 42);
      const changeDate = new Date(changedDate);
      
      // Only adjust count if the changed date is within our 42-day window
      if (changeDate >= cutoffDate) {
        count = wasAdded ? currentCount + 1 : Math.max(0, currentCount - 1);
      } else {
        count = currentCount; // No change needed
      }
    } else {
      // Full recalculation (fallback)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 42);
      
      count = 0;
      this.activityData.forEach((hasActivity, dateStr) => {
        const date = new Date(dateStr);
        if (hasActivity && date >= cutoffDate) {
          count++;
        }
      });
    }
    
    // Animate count change
    this.animateCountChange(count);
  }

  /**
   * Animate the count change
   */
  animateCountChange(newCount) {
    if (!this.entriesCountElement) return;
    
    const currentCount = parseInt(this.entriesCountElement.textContent) || 0;
    
    if (currentCount === newCount) return;
    
    // Simple counting animation
    const duration = 500;
    const steps = 20;
    const stepDuration = duration / steps;
    const stepSize = (newCount - currentCount) / steps;
    
    let step = 0;
    const animate = () => {
      step++;
      const current = Math.round(currentCount + (stepSize * step));
      this.entriesCountElement.textContent = current;
      
      if (step < steps) {
        setTimeout(animate, stepDuration);
      } else {
        this.entriesCountElement.textContent = newCount;
      }
    };
    
    animate();
  }

  /**
   * Update settings UI elements
   */
  updateSettingsUI() {
    const toggleWeekdaysBtn = document.getElementById('toggleWeekdays');
    const toggleNumbersBtn = document.getElementById('toggleNumbers');
    
    if (toggleWeekdaysBtn) {
      toggleWeekdaysBtn.classList.toggle('active', this.settings.showWeekdays);
      toggleWeekdaysBtn.setAttribute('aria-pressed', this.settings.showWeekdays.toString());
    }
    
    if (toggleNumbersBtn) {
      toggleNumbersBtn.classList.toggle('active', this.settings.showDayNumbers);
      toggleNumbersBtn.setAttribute('aria-pressed', this.settings.showDayNumbers.toString());
    }
  }

  // Event Handlers

  /**
   * Handle calendar ready event
   */
  handleCalendarReady() {
    console.log('📅 Calendar component ready');
    this.updateCalendarComponent();
  }

  /**
   * Handle calendar scroll events
   */
  handleCalendarScrolled(data) {
    const { scrollTop, shouldCollapse } = data;
    
    console.log(`📜 Scroll: ${scrollTop}px, should collapse: ${shouldCollapse}`);
    
    if (shouldCollapse && this.isHeaderExpanded) {
      console.log('🔽 Collapsing header');
      this.collapseHeader();
    } else if (!shouldCollapse && !this.isHeaderExpanded) {
      console.log('🔼 Expanding header');
      this.expandHeader();
    }
  }

  /**
   * Handle day selection
   */
  handleDaySelected(data) {
    console.log('📅 Day selected:', data.date);
    // Entry modal will handle this automatically via its own event listener
  }

  /**
   * Handle any entry change (add, update, delete)
   */
  async handleEntryChanged(data) {
    console.log('📝 Memory entry changed:', data);
    
    const { date } = data;
    const wasActivityBefore = this.activityData.has(date);
    
    // Instead of reloading all data, just check if this specific date has entries
    try {
      const entriesForDate = await database.getEntriesForDate(date);
      const hasActivityNow = entriesForDate.length > 0;
      
      // Update activity data incrementally
      if (hasActivityNow) {
        this.activityData.set(date, true);
      } else {
        this.activityData.delete(date);
      }
      
      // Update calendar incrementally (no visual glitch)
      if (this.activityCalendar && this.activityCalendar.updateDateActivity) {
        this.activityCalendar.updateDateActivity(date, hasActivityNow);
      } else {
        // Fallback to full update if incremental method not available
        this.updateCalendarComponent();
      }
      
      // Update entries count efficiently
      if (wasActivityBefore !== hasActivityNow) {
        // Activity state changed, update count incrementally
        this.updateEntriesCount(date, hasActivityNow);
      }
      // If no change in activity state, no need to update count
      
    } catch (error) {
      console.error('Failed to update calendar after entry change:', error);
      // Fallback to full reload on error
      await this.loadActivityData();
      this.updateCalendarComponent();
      this.updateEntriesCount();
    }
  }

  /**
   * Handle modal closed
   */
  handleModalClosed() {
    console.log('🔒 Modal closed');
    // Any cleanup or state reset can go here
  }

  /**
   * Handle toggle weekdays button
   */
  handleToggleWeekdays() {
    this.settings.showWeekdays = !this.settings.showWeekdays;
    this.updateSettingsUI();
    this.updateCalendarComponent();
    this.saveSettings();
    
    eventBus.emit('settingsChanged', this.settings);
  }

  /**
   * Handle toggle numbers button
   */
  handleToggleNumbers() {
    this.settings.showDayNumbers = !this.settings.showDayNumbers;
    this.updateSettingsUI();
    this.updateCalendarComponent();
    this.saveSettings();
    
    eventBus.emit('settingsChanged', this.settings);
  }

  /**
   * Handle settings toggle button
   */
  handleSettingsToggle() {
    console.log('⚙️ Settings toggle clicked');
    // TODO: Implement settings panel when ready
    alert('Settings panel coming soon!');
  }

  /**
   * Handle add entry button (opens modal for today)
   */
  handleAddEntry() {
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    // Trigger day selection for today
    eventBus.emit('daySelected', {
      date: todayStr,
      hasEvents: this.activityData.has(todayStr)
    });
  }

  /**
   * Handle retry button
   */
  async handleRetry() {
    this.hideError();
    await this.init();
  }

  // Header Animation

  /**
   * Collapse the header
   */
  collapseHeader() {
    if (!this.headerElement || !this.isHeaderExpanded) return;
    
    this.headerElement.classList.remove('expanded');
    this.headerElement.classList.add('collapsed');
    this.isHeaderExpanded = false;
  }

  /**
   * Expand the header
   */
  expandHeader() {
    if (!this.headerElement || this.isHeaderExpanded) return;
    
    this.headerElement.classList.remove('collapsed');
    this.headerElement.classList.add('expanded');
    this.isHeaderExpanded = true;
  }

  // UI State Management

  /**
   * Show loading indicator
   */
  showLoading(message = 'Loading...') {
    if (this.loadingIndicator) {
      const messageElement = this.loadingIndicator.querySelector('p');
      if (messageElement) messageElement.textContent = message;
      
      this.loadingIndicator.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    if (this.loadingIndicator) {
      this.loadingIndicator.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Show error message
   */
  showError(message, error = null) {
    if (this.errorMessage) {
      const errorText = this.errorMessage.querySelector('#errorText');
      if (errorText) {
        errorText.textContent = message;
      }
      
      this.errorMessage.setAttribute('aria-hidden', 'false');
    }
    
    this.hideLoading();
    
    // Log detailed error for debugging
    if (error) {
      console.error('Detailed error:', error);
    }
  }

  /**
   * Hide error message
   */
  hideError() {
    if (this.errorMessage) {
      this.errorMessage.setAttribute('aria-hidden', 'true');
    }
  }

  // Utility Methods

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get current activity count for last 42 days
   */
  getActivityCount() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 42);
    
    let count = 0;
    this.activityData.forEach((hasActivity, dateStr) => {
      const date = new Date(dateStr);
      if (hasActivity && date >= cutoffDate) {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Export memory data (for future settings panel)
   */
  async exportData() {
    try {
      const entries = await database.getAllEntries();
      const readers = await database.getAllReaders();
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        entries: entries,
        readers: readers,
        settings: this.settings
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memory-timeline-export-${this.formatDate(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showError('Failed to export data');
    }
  }

  /**
   * Import memory data (for future settings panel)
   */
  async importData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data structure
      if (!importData.entries || !Array.isArray(importData.entries)) {
        throw new Error('Invalid import file format');
      }
      
      // Import readers first
      if (importData.readers && Array.isArray(importData.readers)) {
        for (const readerData of importData.readers) {
          if (!readerData.isDefault) { // Don't duplicate the default Family reader
            const { id, ...readerWithoutId } = readerData;
            await database.addReader(readerWithoutId);
          }
        }
      }
      
      // Import entries
      for (const entryData of importData.entries) {
        // Remove ID to let database assign new ones
        const { id, ...entryWithoutId } = entryData;
        await database.addEntry(entryWithoutId);
      }
      
      // Import settings if available
      if (importData.settings) {
        this.settings = { ...this.settings, ...importData.settings };
        this.saveSettings();
        this.updateSettingsUI();
      }
      
      // Reload data
      await this.loadActivityData();
      this.updateCalendarComponent();
      this.updateEntriesCount();
      
      console.log(`✅ Imported ${importData.entries.length} memories`);
      
    } catch (error) {
      console.error('Failed to import data:', error);
      this.showError('Failed to import data. Please check the file format.');
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new CalendarApp();
  
  // Make app globally available for debugging
  window.memoryTimelineApp = app;
  
  // Initialize the application
  await app.init();
});

export default CalendarApp;