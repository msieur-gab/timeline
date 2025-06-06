import eventBus from '../EventBus.js';
import database from '../Database.js';

/**
 * ActivityCalendar Web Component
 * Displays memories in calendar grid or timeline view with toggle
 */
class ActivityCalendar extends HTMLElement {
  constructor() {
    super();
    
    // Component state
    this.activityData = new Map(); // date -> boolean
    this.timelineData = []; // Array of memory entries for timeline view
    this.viewMode = 'calendar'; // 'calendar' | 'timeline'
    this.settings = {
      showWeekdays: true,
      showDayNumbers: true
    };
    this.selectedDate = null;
    this.selectedElement = null;
    
    // Create shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // Bind methods
    this.handleDayClick = this.handleDayClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.toggleView = this.toggleView.bind(this);
  }

  // Called when element is added to the DOM
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.generateCalendar();
    
    // Notify that component is ready
    eventBus.emit('calendarReady');
  }

  // Called when element is removed from the DOM
  disconnectedCallback() {
    this.cleanup();
  }

  // Observed attributes for reactive updates
  static get observedAttributes() {
    return ['show-weekdays', 'show-numbers'];
  }

  // Handle attribute changes
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'show-weekdays':
          this.settings.showWeekdays = newValue !== 'false';
          break;
        case 'show-numbers':
          this.settings.showDayNumbers = newValue !== 'false';
          break;
      }
      this.updateDisplay();
    }
  }

  /**
   * Render the component template and styles
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${this.getStyles()}
      </style>
      <main class="calendar-container">
        <header class="calendar-controls">
          <div class="weekdays-header" id="weekdaysHeader">
            <span class="weekday-label">Mon</span>
            <span class="weekday-label">Tue</span>
            <span class="weekday-label">Wed</span>
            <span class="weekday-label">Thu</span>
            <span class="weekday-label">Fri</span>
            <span class="weekday-label">Sat</span>
            <span class="weekday-label">Sun</span>
          </div>
          
          <div class="view-toggle" id="viewToggle">
            <button class="toggle-btn ${this.viewMode === 'calendar' ? 'active' : ''}" 
                    data-view="calendar" 
                    title="Calendar view">📅</button>
            <button class="toggle-btn ${this.viewMode === 'timeline' ? 'active' : ''}" 
                    data-view="timeline" 
                    title="Timeline view">📖</button>
          </div>
        </header>
        
        <section class="content-area" id="contentArea">
          <!-- Calendar or Timeline content will be rendered here -->
        </section>
      </main>
    `;
  }

  /**
   * Get component styles
   */
  getStyles() {
    return `
      :host {
        display: block;
        height: 100%;
        width: 100%;
        flex: 1;
        min-height: 0; /* Important for flex scrolling */
      }

      .calendar-container {
        height: 100%;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 30px;
        background: #e8e8e8;
        scroll-behavior: smooth;
        box-sizing: border-box;
        /* Remove min-height constraints that were causing issues */
      }

      .weekdays-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 6px;
        margin-bottom: 16px;
        position: sticky;
        top: 0;
        background: #e8e8e8;
        z-index: 5;
        padding: 8px 0;
        transition: opacity 0.3s ease;
      }

      .weekdays-header.hidden {
        opacity: 0;
        height: 0;
        margin-bottom: 0;
        padding: 0;
        overflow: hidden;
      }

      .weekday-label {
        text-align: center;
        font-size: 0.75rem;
        color: #666;
        font-weight: 500;
        user-select: none;
      }

      .calendar-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 40px; /* Add bottom padding for better scroll experience */
        min-height: 100%; /* Ensure it fills the container */
      }

      .calendar-week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 6px;
        position: relative;
        min-height: 32px;
        align-items: center;
      }

      .calendar-day {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        justify-self: center;
        z-index: 2;
        border: none;
        background: #d1d5db;
        color: #333;
        font-size: 0.7rem;
        font-weight: 500;
      }

      .calendar-day:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }

      .calendar-day:focus {
        outline: 2px solid #007AFF;
        outline-offset: 2px;
      }

      .calendar-day.has-activity {
        background: #6b7280;
        color: white;
      }

      .calendar-day.today {
        background: #000;
        color: white;
        font-weight: 600;
      }

      .calendar-day.selected {
        background: #007AFF;
        color: white;
        transform: scale(1.2);
        box-shadow: 0 4px 12px rgba(0,122,255,0.4);
      }

      .calendar-day.other-month {
        opacity: 0.3;
      }

      .day-number {
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .day-number.hidden {
        opacity: 0;
      }

      .activity-pill {
        position: absolute;
        background: #6b7280;
        height: 24px;
        border-radius: 0;
        top: 50%;
        transform: translateY(-50%);
        z-index: 1;
        pointer-events: none;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .calendar-container {
          padding: 20px;
          /* Remove min-height constraint that causes white space */
        }

        .weekdays-header {
          gap: 4px;
          margin-bottom: 10px;
        }

        .calendar-week {
          gap: 4px;
          min-height: 28px;
        }

        .calendar-day {
          width: 22px;
          height: 22px;
          font-size: 0.65rem;
        }

        .weekday-label {
          font-size: 0.7rem;
        }
      }

      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        .calendar-day {
          transition: none;
        }
      }

      @media (prefers-contrast: high) {
        .calendar-day {
          border: 1px solid #000;
        }
        
        .calendar-day.has-activity {
          background: #000;
          border-color: #fff;
        }
      }
    `;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // View toggle listeners
    const viewToggle = this.shadowRoot.getElementById('viewToggle');
    viewToggle.addEventListener('click', (event) => {
      if (event.target.classList.contains('toggle-btn')) {
        const newView = event.target.dataset.view;
        if (newView !== this.viewMode) {
          this.setViewMode(newView);
        }
      }
    });

    // Content area listeners (will be set up based on current view)
    this.setupContentListeners();
    
    const container = this.shadowRoot.querySelector('.calendar-container');
    container.addEventListener('scroll', this.handleScroll);

    // Listen for external events
    eventBus.on('settingsChanged', (settings) => {
      this.updateSettings(settings);
    });

    // Legacy compatibility - listen for both event names
    eventBus.on('entryAdded', () => this.refresh());
    eventBus.on('entryUpdated', () => this.refresh());
    eventBus.on('entryDeleted', () => this.refresh());
  }

  /**
   * Set up content-specific event listeners
   */
  setupContentListeners() {
    // Remove existing listeners
    const contentArea = this.shadowRoot.getElementById('contentArea');
    contentArea.removeEventListener('click', this.handleDayClick);
    contentArea.removeEventListener('click', this.handleTimelineClick);

    if (this.viewMode === 'calendar') {
      contentArea.addEventListener('click', this.handleDayClick);
    } else {
      contentArea.addEventListener('click', this.handleTimelineClick.bind(this));
    }
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    const calendarGrid = this.shadowRoot.getElementById('calendarGrid');
    if (calendarGrid) {
      calendarGrid.removeEventListener('click', this.handleDayClick);
    }
    
    const container = this.shadowRoot.querySelector('.calendar-container');
    if (container) {
      container.removeEventListener('scroll', this.handleScroll);
    }
  }

  /**
   * Handle timeline entry clicks
   */
  handleTimelineClick(event) {
    const entryElement = event.target.closest('.timeline-entry');
    if (entryElement && entryElement.dataset.date) {
      const dateStr = entryElement.dataset.date;
      this.handleDayClick({ target: { dataset: { date: dateStr } } });
    }
  }

  /**
   * Set view mode and update display
   */
  setViewMode(mode) {
    if (mode === this.viewMode) return;
    
    this.viewMode = mode;
    
    // Update toggle buttons
    const toggleBtns = this.shadowRoot.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === mode);
    });
    
    // Re-render content
    this.renderContent();
    this.setupContentListeners();
  }

  /**
   * Toggle between calendar and timeline view
   */
  toggleView() {
    const newMode = this.viewMode === 'calendar' ? 'timeline' : 'calendar';
    this.setViewMode(newMode);
  }

  /**
   * Render the appropriate content based on view mode
   */
  async renderContent() {
    const contentArea = this.shadowRoot.getElementById('contentArea');
    
    if (this.viewMode === 'calendar') {
      this.renderCalendarView(contentArea);
    } else {
      await this.renderTimelineView(contentArea);
    }
  }

  /**
   * Render calendar grid view
   */
  renderCalendarView(container) {
    container.innerHTML = `
      <section class="calendar-grid" 
               role="grid" 
               aria-label="Calendar of memories"
               id="calendarGrid">
        <!-- Calendar weeks will be generated here -->
      </section>
    `;
    
    this.generateCalendarGrid();
  }

  /**
   * Render timeline view
   */
  async renderTimelineView(container) {
    container.innerHTML = `
      <section class="timeline-container" 
               role="feed" 
               aria-label="Timeline of memories"
               id="timelineContainer">
        <!-- Timeline entries will be generated here -->
      </section>
    `;
    
    await this.generateTimelineContent();
  }

  /**
   * Handle day click events (works for both calendar and timeline)
   */
  handleDayClick(event) {
    let dateStr, dayElement;
    
    if (this.viewMode === 'calendar') {
      dayElement = event.target.closest('.calendar-day');
      if (!dayElement || !dayElement.dataset.date) return;
      dateStr = dayElement.dataset.date;
      
      // Update selected state for calendar
      if (this.selectedElement) {
        this.selectedElement.classList.remove('selected');
      }
      dayElement.classList.add('selected');
      this.selectedElement = dayElement;
    } else {
      // Timeline mode - get date from data attribute
      dateStr = event.target.dataset?.date;
      if (!dateStr) return;
    }
    
    this.selectedDate = dateStr;

    // Emit day selected event
    eventBus.emit('daySelected', {
      date: dateStr,
      hasEvents: this.activityData.has(dateStr),
      element: dayElement
    });
  }

  /**
   * Load timeline data from database
   */
  async loadTimelineData() {
    try {
      // Only load if we don't have timeline data or it's stale
      if (this.timelineData.length === 0) {
        const entries = await database.getAllEntries();
        const readers = await database.getAllReaders();
        
        // Create reader lookup map
        const readerMap = new Map();
        readers.forEach(reader => {
          readerMap.set(reader.id, reader);
        });
        
        // Enhance entries with reader information
        this.timelineData = entries.map(entry => ({
          ...entry,
          reader: readerMap.get(entry.readerId) || { name: 'Unknown', color: '#6b7280' }
        })).sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first
      }
    } catch (error) {
      console.error('Failed to load timeline data:', error);
      this.timelineData = [];
    }
  }

  /**
   * Generate timeline content
   */
  async generateTimelineContent() {
    await this.loadTimelineData();
    
    const timelineContainer = this.shadowRoot.getElementById('timelineContainer');
    
    if (this.timelineData.length === 0) {
      timelineContainer.innerHTML = `
        <div class="empty-timeline">
          <h3>No memories yet</h3>
          <p>Start by clicking a day to add your first memory!</p>
        </div>
      `;
      return;
    }
    
    // Group entries by date
    const groupedEntries = this.groupEntriesByDate(this.timelineData);
    
    let html = '';
    for (const [date, entries] of groupedEntries) {
      html += this.renderTimelineDateGroup(date, entries);
    }
    
    timelineContainer.innerHTML = html;
  }

  /**
   * Group entries by date
   */
  groupEntriesByDate(entries) {
    const grouped = new Map();
    
    entries.forEach(entry => {
      if (!grouped.has(entry.date)) {
        grouped.set(entry.date, []);
      }
      grouped.get(entry.date).push(entry);
    });
    
    // Sort dates in descending order (most recent first)
    return new Map([...grouped.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0])));
  }

  /**
   * Render a date group for timeline
   */
  renderTimelineDateGroup(date, entries) {
    const dateObj = new Date(date);
    const isToday = this.isSameDay(dateObj, new Date());
    const dateLabel = isToday ? 'Today' : this.formatDateForTimeline(dateObj);
    
    let entriesHtml = '';
    entries.forEach(entry => {
      entriesHtml += this.renderTimelineEntry(entry);
    });
    
    return `
      <div class="timeline-date-group">
        <div class="timeline-date-header">${dateLabel}</div>
        <div class="timeline-entries">
          ${entriesHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single timeline entry
   */
  renderTimelineEntry(entry) {
    const readerColor = entry.reader?.color || '#6b7280';
    const readerName = entry.reader?.name || 'Unknown';
    const hasDescription = entry.description && entry.description.trim();
    
    return `
      <div class="timeline-entry" 
           data-date="${entry.date}"
           data-reader-color="${readerColor}"
           style="--reader-color: ${readerColor}">
        <div class="entry-header">
          <div class="entry-title">${this.escapeHtml(entry.title)}</div>
          ${entry.time ? `<div class="entry-time">${entry.time}</div>` : ''}
        </div>
        ${hasDescription ? `<div class="entry-description">${this.escapeHtml(entry.description)}</div>` : ''}
        <div class="entry-meta">
          <span class="entry-reader" 
                data-reader-color="${readerColor}"
                style="--reader-color: ${readerColor}20">
            For ${readerName}
          </span>
          <span>${this.getRelativeTime(entry.createdAt)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Handle scroll events for header collapse
   */
  handleScroll(event) {
    const scrollTop = event.target.scrollTop;
    const threshold = 50; // Increased threshold for smoother transition
    
    eventBus.emit('calendarScrolled', {
      scrollTop,
      shouldCollapse: scrollTop > threshold
    });
  }

  /**
   * Generate calendar (main entry point)
   */
  generateCalendar() {
    this.renderContent();
  }

  /**
   * Generate calendar grid (for calendar view)
   */
  generateCalendarGrid() {
    const calendarGrid = this.shadowRoot.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    calendarGrid.innerHTML = '';
    
    const today = new Date();
    const startDate = new Date(today);
    
    // Start from Monday of current week
    const dayOfWeek = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    startDate.setDate(today.getDate() - dayOfWeek);
    
    // Generate 8 weeks initially for better scrolling experience
    this.generateWeeks(calendarGrid, startDate, today, 8);
    
    // Add load more functionality for infinite scroll
    this.setupInfiniteScroll(calendarGrid, startDate, today);
  }

  /**
   * Format date for timeline display
   */
  formatDateForTimeline(date) {
    const now = new Date();
    const diffDays = Math.floor((now - date) / (24 * 60 * 60 * 1000));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Get relative time string
   */
  getRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate a specific number of weeks
   */
  generateWeeks(container, startDate, today, weekCount, append = false) {
    if (!append) {
      container.innerHTML = '';
    }
    
    for (let weekOffset = 0; weekOffset < weekCount; weekOffset++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() - (weekOffset * 7));
      
      const weekElement = this.createWeekElement(weekStart, today);
      if (append) {
        container.appendChild(weekElement);
      } else {
        container.appendChild(weekElement);
      }
    }
  }

  /**
   * Setup infinite scroll to load more weeks when needed
   */
  setupInfiniteScroll(calendarGrid, startDate, today) {
    const container = this.shadowRoot.querySelector('.calendar-container');
    let isLoading = false;
    let totalWeeksLoaded = 8;
    
    const loadMoreWeeks = () => {
      if (isLoading || this.viewMode !== 'calendar') return;
      isLoading = true;
      
      // Load 6 more weeks at a time for smoother performance
      const newStartDate = new Date(startDate);
      newStartDate.setDate(startDate.getDate() - (totalWeeksLoaded * 7));
      
      setTimeout(() => {
        if (calendarGrid.isConnected) {
          this.generateWeeks(calendarGrid, newStartDate, today, 6, true);
          totalWeeksLoaded += 6;
        }
        isLoading = false;
      }, 100);
    };
    
    const scrollHandler = () => {
      if (this.viewMode !== 'calendar') return;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Load more when scrolled to bottom 70% (trigger earlier)
      if (scrollTop + clientHeight >= scrollHeight * 0.7) {
        loadMoreWeeks();
      }
    };
    
    container.addEventListener('scroll', scrollHandler);
  }

  /**
   * Create a week row element
   */
  createWeekElement(weekStartDate, today) {
    const weekElement = document.createElement('article');
    weekElement.className = 'calendar-week';
    weekElement.setAttribute('role', 'row');
    
    const weekDays = [];
    
    // Generate 7 days for the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(weekStartDate.getDate() + dayOffset);
      
      const dayData = {
        date: dayDate,
        dateStr: this.formatDate(dayDate),
        hasActivity: this.activityData.has(this.formatDate(dayDate)),
        isToday: this.isSameDay(dayDate, today),
        dayNumber: dayDate.getDate()
      };
      
      weekDays.push(dayData);
      const dayElement = this.createDayElement(dayData);
      weekElement.appendChild(dayElement);
    }
    
    // Create activity pills for consecutive activity runs
    setTimeout(() => {
      if (weekElement.isConnected) {
        this.createActivityPills(weekElement, weekDays);
      }
    }, 0);
    
    return weekElement;
  }

  /**
   * Create a day element
   */
  createDayElement(dayData) {
    const dayElement = document.createElement('time');
    dayElement.className = 'calendar-day';
    dayElement.setAttribute('role', 'gridcell');
    dayElement.setAttribute('datetime', dayData.dateStr);
    dayElement.setAttribute('tabindex', '0');
    dayElement.dataset.date = dayData.dateStr;
    
    // Set appropriate classes
    if (dayData.isToday) {
      dayElement.classList.add('today');
    } else if (dayData.hasActivity) {
      dayElement.classList.add('has-activity');
    }
    
    // Create day number span
    const dayNumber = document.createElement('span');
    dayNumber.className = 'day-number';
    dayNumber.textContent = dayData.dayNumber;
    
    if (!this.settings.showDayNumbers) {
      dayNumber.classList.add('hidden');
    }
    
    dayElement.appendChild(dayNumber);
    
    // Add accessibility label
    const label = dayData.isToday ? 'Today' : 
                  dayData.hasActivity ? 'Has memories' : 'No memories';
    dayElement.setAttribute('aria-label', 
      `${this.formatDateForScreen(dayData.date)}, ${label}`
    );
    
    return dayElement;
  }

  /**
   * Create activity pills for consecutive activity runs
   */
  createActivityPills(weekElement, weekDays) {
    const runs = this.findConsecutiveActivityRuns(weekDays);
    
    runs.forEach(run => {
      const pill = document.createElement('div');
      pill.className = 'activity-pill';
      pill.setAttribute('aria-hidden', 'true');
      
      const weekWidth = weekElement.offsetWidth;
      if (weekWidth === 0) return;
      
      const gapPixels = 6;
      const columnWidth = (weekWidth - (6 * gapPixels)) / 7;
      
      if (columnWidth <= 0) return;
      
      const startX = (run.startIndex * columnWidth) + (run.startIndex * gapPixels) + (columnWidth / 2);
      const endX = (run.endIndex * columnWidth) + (run.endIndex * gapPixels) + (columnWidth / 2);
      
      pill.style.left = `${startX}px`;
      pill.style.width = `${endX - startX}px`;
      
      if (endX > startX) {
        weekElement.appendChild(pill);
      }
    });
  }

  /**
   * Find consecutive activity runs in a week
   */
  findConsecutiveActivityRuns(weekDays) {
    const runs = [];
    let currentRun = null;
    
    weekDays.forEach((day, index) => {
      const hasActivity = day.hasActivity !== undefined ? day.hasActivity : day.hasActivity;
      
      if (hasActivity) {
        if (currentRun && currentRun.endIndex === index - 1) {
          currentRun.endIndex = index;
        } else {
          if (currentRun) runs.push(currentRun);
          currentRun = { startIndex: index, endIndex: index };
        }
      } else {
        if (currentRun) runs.push(currentRun);
        currentRun = null;
      }
    });
    
    if (currentRun) runs.push(currentRun);
    
    // Only return runs with 2+ days
    return runs.filter(run => run.endIndex > run.startIndex);
  }

  /**
   * Update display based on settings
   */
  updateDisplay() {
    const weekdaysHeader = this.shadowRoot.getElementById('weekdaysHeader');
    const dayNumbers = this.shadowRoot.querySelectorAll('.day-number');
    
    // Toggle weekdays header
    weekdaysHeader.classList.toggle('hidden', !this.settings.showWeekdays);
    
    // Toggle day numbers
    dayNumbers.forEach(dayNumber => {
      dayNumber.classList.toggle('hidden', !this.settings.showDayNumbers);
    });
  }

  // Public API methods

  /**
   * Update activity data
   * @param {Map|Object} activityData - Activity data (date -> boolean)
   */
  updateActivityData(activityData) {
    if (activityData instanceof Map) {
      this.activityData = new Map(activityData);
    } else {
      this.activityData = new Map(Object.entries(activityData));
    }
    
    // Clear timeline data to force reload with new data
    this.timelineData = [];
    
    this.generateCalendar();
    eventBus.emit('activityDataUpdated', { count: this.activityData.size });
  }

  /**
   * Get current view mode
   * @returns {string} Current view mode ('calendar' | 'timeline')
   */
  getViewMode() {
    return this.viewMode;
  }

  /**
   * Set view mode programmatically
   * @param {string} mode - View mode ('calendar' | 'timeline')
   */
  setView(mode) {
    if (mode === 'calendar' || mode === 'timeline') {
      this.setViewMode(mode);
    }
  }

  /**
   * Incrementally update a specific date without full calendar regeneration
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @param {boolean} hasActivity - Whether the date has activity
   */
  updateDateActivity(dateStr, hasActivity) {
    // Update internal data
    if (hasActivity) {
      this.activityData.set(dateStr, true);
    } else {
      this.activityData.delete(dateStr);
    }

    // Find and update the specific day element
    const dayElement = this.shadowRoot.querySelector(`[data-date="${dateStr}"]`);
    if (dayElement) {
      // Update visual state
      dayElement.classList.remove('has-activity', 'no-activity');
      dayElement.classList.add(hasActivity ? 'has-activity' : 'no-activity');
      
      // Update accessibility label
      const currentLabel = dayElement.getAttribute('aria-label');
      const dateLabel = currentLabel.split(',')[0]; // Keep the date part
      const activityLabel = hasActivity ? 'Has memories' : 'No memories';
      dayElement.setAttribute('aria-label', `${dateLabel}, ${activityLabel}`);
      
      // Update activity pills for the week containing this day
      const weekElement = dayElement.closest('.calendar-week');
      if (weekElement) {
        this.updateWeekActivityPills(weekElement);
      }
    }

    eventBus.emit('activityDataUpdated', { count: this.activityData.size });
  }

  /**
   * Update activity pills for a specific week
   * @param {HTMLElement} weekElement - Week element to update
   */
  updateWeekActivityPills(weekElement) {
    // Remove existing pills
    const existingPills = weekElement.querySelectorAll('.activity-pill');
    existingPills.forEach(pill => pill.remove());

    // Get week data in the format expected by createActivityPills
    const dayElements = weekElement.querySelectorAll('.calendar-day');
    const weekDays = Array.from(dayElements).map((dayEl, index) => {
      const dateStr = dayEl.dataset.date;
      return {
        hasActivity: this.activityData.has(dateStr),
        dayElement: dayEl
      };
    });

    // Find consecutive activity runs and create pills
    const runs = this.findConsecutiveActivityRuns(weekDays);
    
    setTimeout(() => {
      if (weekElement.isConnected) {
        runs.forEach(run => {
          this.createActivityPill(weekElement, run);
        });
      }
    }, 0);
  }

  /**
   * Create a single activity pill for a run
   * @param {HTMLElement} weekElement - Week container element
   * @param {Object} run - Activity run with startIndex and endIndex
   */
  createActivityPill(weekElement, run) {
    const pill = document.createElement('div');
    pill.className = 'activity-pill';
    pill.setAttribute('aria-hidden', 'true');
    
    const weekWidth = weekElement.offsetWidth;
    if (weekWidth === 0) return;
    
    const gapPixels = 6;
    const columnWidth = (weekWidth - (6 * gapPixels)) / 7;
    
    if (columnWidth <= 0) return;
    
    const startX = (run.startIndex * columnWidth) + (run.startIndex * gapPixels) + (columnWidth / 2);
    const endX = (run.endIndex * columnWidth) + (run.endIndex * gapPixels) + (columnWidth / 2);
    
    pill.style.left = `${startX}px`;
    pill.style.width = `${endX - startX}px`;
    
    if (endX > startX) {
      weekElement.appendChild(pill);
    }
  }

  /**
   * Update settings
   * @param {Object} settings - Settings object
   */
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.updateDisplay();
  }

  /**
   * Get selected date
   * @returns {string|null} Selected date string
   */
  getSelectedDate() {
    return this.selectedDate;
  }

  /**
   * Navigate to specific date
   * @param {string|Date} date - Date to navigate to
   */
  navigateToDate(date) {
    const dateStr = typeof date === 'string' ? date : this.formatDate(date);
    const dayElement = this.shadowRoot.querySelector(`[data-date="${dateStr}"]`);
    
    if (dayElement) {
      dayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dayElement.focus();
    }
  }

  /**
   * Refresh the calendar
   */
  refresh() {
    this.generateCalendar();
  }

  // Utility methods

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date for screen readers
   */
  formatDateForScreen(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Check if two dates are the same day
   */
  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }
}

// Register the custom element
customElements.define('activity-calendar', ActivityCalendar);

export default ActivityCalendar;