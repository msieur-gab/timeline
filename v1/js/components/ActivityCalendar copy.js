import eventBus from '../EventBus.js';

/**
 * ActivityCalendar Web Component
 * Displays a calendar grid with activity tracking and day selection
 */
class ActivityCalendar extends HTMLElement {
  constructor() {
    super();
    
    // Component state
    this.activityData = new Map(); // date -> boolean
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
        <header class="weekdays-header" id="weekdaysHeader">
          <span class="weekday-label">Mon</span>
          <span class="weekday-label">Tue</span>
          <span class="weekday-label">Wed</span>
          <span class="weekday-label">Thu</span>
          <span class="weekday-label">Fri</span>
          <span class="weekday-label">Sat</span>
          <span class="weekday-label">Sun</span>
        </header>
        
        <section class="calendar-grid" 
                 role="grid" 
                 aria-label="Calendar of activities"
                 id="calendarGrid">
          <!-- Calendar weeks will be generated here -->
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
    const calendarGrid = this.shadowRoot.getElementById('calendarGrid');
    calendarGrid.addEventListener('click', this.handleDayClick);
    
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
   * Handle day click events
   */
  handleDayClick(event) {
    const dayElement = event.target.closest('.calendar-day');
    if (!dayElement || !dayElement.dataset.date) return;

    const dateStr = dayElement.dataset.date;
    
    // Update selected state
    if (this.selectedElement) {
      this.selectedElement.classList.remove('selected');
    }
    
    dayElement.classList.add('selected');
    this.selectedElement = dayElement;
    this.selectedDate = dateStr;

    // Emit day selected event
    eventBus.emit('daySelected', {
      date: dateStr,
      hasEvents: this.activityData.has(dateStr),
      element: dayElement
    });
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
   * Generate calendar grid
   */
  generateCalendar() {
    const calendarGrid = this.shadowRoot.getElementById('calendarGrid');
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
      if (isLoading) return;
      isLoading = true;
      
      // Load 6 more weeks at a time for smoother performance
      const newStartDate = new Date(startDate);
      newStartDate.setDate(startDate.getDate() - (totalWeeksLoaded * 7));
      
      setTimeout(() => {
        this.generateWeeks(calendarGrid, newStartDate, today, 6, true);
        totalWeeksLoaded += 6;
        isLoading = false;
      }, 100);
    };
    
    container.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // Load more when scrolled to bottom 70% (trigger earlier)
      if (scrollTop + clientHeight >= scrollHeight * 0.7) {
        loadMoreWeeks();
      }
    });
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
    
    this.generateCalendar();
    eventBus.emit('activityDataUpdated', { count: this.activityData.size });
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