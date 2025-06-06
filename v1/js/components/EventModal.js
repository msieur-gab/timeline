import eventBus from '../EventBus.js';
import database from '../Database.js';

/**
 * EventModal Web Component
 * Handles event creation, editing, and display in a modal dialog
 */
class EventModal extends HTMLElement {
  constructor() {
    super();
    
    // Component state
    this.selectedDate = null;
    this.events = [];
    this.isEditMode = false;
    this.editingEventId = null;
    
    // Create shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // Bind methods
    this.handleClose = this.handleClose.bind(this);
    this.handleFormSubmit = this.handleFormSubmit.bind(this);
    this.handleQuickAdd = this.handleQuickAdd.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleBackdropClick = this.handleBackdropClick.bind(this);
  }

  // Called when element is added to the DOM
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    
    // Listen for day selection events
    eventBus.on('daySelected', this.handleDaySelected.bind(this));
  }

  // Called when element is removed from the DOM
  disconnectedCallback() {
    this.cleanup();
  }

  /**
   * Render the component template and styles
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${this.getStyles()}
      </style>
      
      <div class="modal-backdrop" id="modalBackdrop" aria-hidden="true">
        <dialog class="event-dialog" id="eventDialog" aria-labelledby="modalTitle">
          <header class="modal-header">
            <h2 class="modal-title" id="modalTitle">Manage Events</h2>
            <button class="close-btn" 
                    id="closeBtn" 
                    aria-label="Close dialog"
                    type="button">
              &times;
            </button>
          </header>
          
          <main class="modal-content">
            <section class="events-list" id="eventsList" aria-live="polite">
              <!-- Events will be populated here -->
            </section>
            
            <section class="add-event-section">
              <div class="quick-add-form">
                <h3>Quick Add Event</h3>
                <form id="quickAddForm" aria-label="Quick add event form">
                  <div class="form-row">
                    <label for="quickEventTitle" class="sr-only">Event title</label>
                    <input type="text" 
                           class="form-input" 
                           id="quickEventTitle" 
                           placeholder="Event title..."
                           required
                           autocomplete="off">
                    <button type="submit" class="btn btn-primary">Add</button>
                  </div>
                </form>
              </div>
              
              <details class="advanced-form" id="advancedForm">
                <summary>Advanced Event Details</summary>
                
                <form id="eventForm" aria-label="Detailed event form">
                  <fieldset>
                    <legend id="formLegend">Add New Event</legend>
                    
                    <div class="form-group">
                      <label for="eventTitle" class="form-label">Title *</label>
                      <input type="text" 
                             class="form-input" 
                             id="eventTitle" 
                             required
                             autocomplete="off"
                             placeholder="Enter event title">
                    </div>
                    
                    <div class="form-group">
                      <label for="eventDescription" class="form-label">Description</label>
                      <textarea class="form-input form-textarea" 
                                id="eventDescription" 
                                placeholder="Event description (optional)"
                                rows="3"></textarea>
                    </div>
                    
                    <div class="form-row">
                      <div class="form-group">
                        <label for="eventCategory" class="form-label">Category</label>
                        <select class="form-select" id="eventCategory">
                          <option value="personal">Personal</option>
                          <option value="work">Work</option>
                          <option value="health">Health</option>
                          <option value="social">Social</option>
                          <option value="travel">Travel</option>
                          <option value="education">Education</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      <div class="form-group">
                        <label for="eventTime" class="form-label">Time</label>
                        <input type="time" class="form-input" id="eventTime">
                      </div>
                    </div>
                    
                    <div class="form-actions">
                      <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                      <button type="submit" class="btn btn-primary" id="submitBtn">Add Event</button>
                    </div>
                  </fieldset>
                </form>
              </details>
            </section>
          </main>
        </dialog>
      </div>
    `;
  }

  /**
   * Get component styles
   */
  getStyles() {
    return `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: none;
      }

      :host([open]) {
        pointer-events: auto;
      }

      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        backdrop-filter: blur(4px);
      }

      .modal-backdrop[aria-hidden="false"] {
        opacity: 1;
      }

      .event-dialog {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 95%;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        border: none;
        padding: 0;
        transform: scale(0.8) translateY(20px);
        transition: transform 0.3s ease;
        display: flex;
        flex-direction: column;
      }

      .modal-backdrop[aria-hidden="false"] .event-dialog {
        transform: scale(1) translateY(0);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 24px 16px;
        border-bottom: 1px solid #eee;
        flex-shrink: 0;
      }

      .modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
        line-height: 1;
      }

      .close-btn:hover {
        background: #f5f5f5;
        color: #333;
      }

      .close-btn:focus {
        outline: 2px solid #007AFF;
        outline-offset: 2px;
      }

      .modal-content {
        padding: 0 24px 24px;
        overflow-y: auto;
        flex: 1;
      }

      .events-list {
        margin-bottom: 24px;
        min-height: 60px;
      }

      .empty-state {
        text-align: center;
        color: #666;
        font-style: italic;
        padding: 32px 16px;
        background: #f8f9fa;
        border-radius: 8px;
      }

      .event-item {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        border-left: 4px solid #6b7280;
        position: relative;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .event-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .event-item[data-category="work"] {
        border-left-color: #3b82f6;
      }

      .event-item[data-category="personal"] {
        border-left-color: #10b981;
      }

      .event-item[data-category="health"] {
        border-left-color: #ef4444;
      }

      .event-item[data-category="social"] {
        border-left-color: #8b5cf6;
      }

      .event-item[data-category="travel"] {
        border-left-color: #f59e0b;
      }

      .event-item[data-category="education"] {
        border-left-color: #06b6d4;
      }

      .event-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
        font-size: 1rem;
      }

      .event-meta {
        font-size: 0.85rem;
        color: #666;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .event-description {
        font-size: 0.9rem;
        color: #555;
        line-height: 1.4;
        margin-top: 8px;
      }

      .event-actions {
        display: flex;
        gap: 8px;
      }

      .event-action-btn {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .event-action-btn:hover {
        background: #e9ecef;
        color: #333;
      }

      .event-action-btn.delete {
        color: #dc3545;
      }

      .event-action-btn.delete:hover {
        background: #f8d7da;
        color: #721c24;
      }

      .add-event-section {
        border-top: 1px solid #eee;
        padding-top: 24px;
      }

      .quick-add-form {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 16px;
      }

      .quick-add-form h3 {
        margin: 0 0 12px 0;
        font-size: 1rem;
        font-weight: 600;
        color: #333;
      }

      .advanced-form {
        border: 1px solid #e9ecef;
        border-radius: 8px;
      }

      .advanced-form summary {
        padding: 16px;
        cursor: pointer;
        font-weight: 500;
        color: #555;
        user-select: none;
        border-radius: 8px;
        transition: background-color 0.2s;
      }

      .advanced-form summary:hover {
        background: #f8f9fa;
      }

      .advanced-form[open] summary {
        border-bottom: 1px solid #e9ecef;
        border-radius: 8px 8px 0 0;
      }

      .advanced-form[open] > form {
        padding: 20px;
      }

      fieldset {
        border: none;
        margin: 0;
        padding: 0;
      }

      legend {
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
      }

      .form-group {
        margin-bottom: 16px;
      }

      .form-row {
        display: flex;
        gap: 12px;
        align-items: flex-end;
      }

      .form-row .form-group {
        flex: 1;
        margin-bottom: 0;
      }

      .form-label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
        font-size: 0.9rem;
      }

      .form-input,
      .form-select,
      .form-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 0.9rem;
        font-family: inherit;
        transition: border-color 0.2s, box-shadow 0.2s;
        background: white;
      }

      .form-input:focus,
      .form-select:focus,
      .form-textarea:focus {
        outline: none;
        border-color: #007AFF;
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }

      .form-textarea {
        resize: vertical;
        min-height: 80px;
      }

      .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #eee;
      }

      .btn {
        background: #007AFF;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn:hover {
        background: #0056CC;
        transform: translateY(-1px);
      }

      .btn:active {
        transform: translateY(0);
      }

      .btn:focus {
        outline: 2px solid #007AFF;
        outline-offset: 2px;
      }

      .btn.btn-secondary {
        background: #6c757d;
        color: white;
      }

      .btn.btn-secondary:hover {
        background: #5a6268;
      }

      .btn.btn-primary {
        background: #007AFF;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .event-dialog {
          width: 98%;
          max-height: 90vh;
        }

        .modal-header {
          padding: 20px 16px 12px;
        }

        .modal-content {
          padding: 0 16px 16px;
        }

        .quick-add-form {
          padding: 16px;
        }

        .form-row {
          flex-direction: column;
          gap: 16px;
        }

        .form-actions {
          flex-direction: column-reverse;
        }

        .btn {
          width: 100%;
          justify-content: center;
        }
      }

      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        .modal-backdrop,
        .event-dialog,
        .event-item {
          transition: none;
        }
      }
    `;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    const closeBtn = this.shadowRoot.getElementById('closeBtn');
    const modalBackdrop = this.shadowRoot.getElementById('modalBackdrop');
    const quickAddForm = this.shadowRoot.getElementById('quickAddForm');
    const eventForm = this.shadowRoot.getElementById('eventForm');
    const cancelBtn = this.shadowRoot.getElementById('cancelBtn');

    closeBtn.addEventListener('click', this.handleClose);
    modalBackdrop.addEventListener('click', this.handleBackdropClick);
    quickAddForm.addEventListener('submit', this.handleQuickAdd);
    eventForm.addEventListener('submit', this.handleFormSubmit);
    cancelBtn.addEventListener('click', this.resetForm.bind(this));
    
    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Handle day selected event
   */
  async handleDaySelected(data) {
    this.selectedDate = data.date;
    await this.loadEventsForDate(data.date);
    this.show(data.date);
  }

  /**
   * Handle modal close
   */
  handleClose() {
    this.hide();
  }

  /**
   * Handle backdrop click to close modal
   */
  handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      this.hide();
    }
  }

  /**
   * Handle keyboard events (ESC to close)
   */
  handleKeyDown(event) {
    if (event.key === 'Escape' && this.isOpen()) {
      this.hide();
    }
  }

  /**
   * Handle quick add form submission
   */
  async handleQuickAdd(event) {
    event.preventDefault();
    
    const titleInput = this.shadowRoot.getElementById('quickEventTitle');
    const title = titleInput.value.trim();
    
    if (!title) return;
    
    try {
      await this.addEvent({
        title,
        category: 'personal',
        description: '',
        time: ''
      });
      
      titleInput.value = '';
      
      // Auto-close modal after successful save
      setTimeout(() => {
        this.hide();
      }, 300); // Small delay to show success state
      
    } catch (error) {
      console.error('Failed to add quick event:', error);
      this.showError('Failed to add event. Please try again.');
    }
  }

  /**
   * Handle detailed form submission
   */
  async handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = this.getFormData();
    
    if (!formData.title.trim()) {
      this.showError('Please enter an event title');
      return;
    }
    
    try {
      if (this.isEditMode) {
        await this.updateEvent(this.editingEventId, formData);
      } else {
        await this.addEvent(formData);
      }
      
      this.resetForm();
      
      // Auto-close modal after successful save
      setTimeout(() => {
        this.hide();
      }, 300); // Small delay to show success state
      
    } catch (error) {
      console.error('Failed to save event:', error);
      this.showError('Failed to save event. Please try again.');
    }
  }

  /**
   * Get form data
   */
  getFormData() {
    return {
      title: this.shadowRoot.getElementById('eventTitle').value.trim(),
      description: this.shadowRoot.getElementById('eventDescription').value.trim(),
      category: this.shadowRoot.getElementById('eventCategory').value,
      time: this.shadowRoot.getElementById('eventTime').value
    };
  }

  /**
   * Load events for a specific date
   */
  async loadEventsForDate(dateStr) {
    try {
      this.events = await database.getEventsForDate(dateStr);
      this.renderEventsList();
    } catch (error) {
      console.error('Failed to load events:', error);
      this.showError('Failed to load events');
    }
  }

  /**
   * Add a new event
   */
  async addEvent(eventData) {
    const fullEventData = {
      date: this.selectedDate,
      title: eventData.title,
      description: eventData.description || '',
      category: eventData.category || 'personal',
      time: eventData.time || '',
      createdAt: new Date().toISOString()
    };

    const eventId = await database.addEvent(fullEventData);
    
    // Emit event for other components to update
    eventBus.emit('eventAdded', {
      event: { ...fullEventData, id: eventId },
      date: this.selectedDate
    });
    
    // Reload events for this date
    await this.loadEventsForDate(this.selectedDate);
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId, eventData) {
    const fullEventData = {
      date: this.selectedDate,
      title: eventData.title,
      description: eventData.description || '',
      category: eventData.category || 'personal',
      time: eventData.time || '',
      updatedAt: new Date().toISOString()
    };

    await database.updateEvent(eventId, fullEventData);
    
    // Emit event for other components to update
    eventBus.emit('eventUpdated', {
      event: { ...fullEventData, id: eventId },
      date: this.selectedDate
    });
    
    // Reload events for this date
    await this.loadEventsForDate(this.selectedDate);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await database.deleteEvent(eventId);
      
      // Emit event for other components to update
      eventBus.emit('eventDeleted', {
        eventId,
        date: this.selectedDate
      });
      
      // Reload events for this date
      await this.loadEventsForDate(this.selectedDate);
    } catch (error) {
      console.error('Failed to delete event:', error);
      this.showError('Failed to delete event. Please try again.');
    }
  }

  /**
   * Render the events list
   */
  renderEventsList() {
    const eventsList = this.shadowRoot.getElementById('eventsList');

    if (this.events.length === 0) {
      eventsList.innerHTML = '<div class="empty-state">No events for this date</div>';
      return;
    }
    
    const eventsHTML = this.events.map(event => `
      <article class="event-item" data-category="${event.category}">
        <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
        <div class="event-meta">
          <span>
            <strong>${event.category}</strong>
            ${event.time ? ` • ${event.time}` : ''}
          </span>
          <div class="event-actions">
            <button class="event-action-btn edit" 
                    onclick="this.getRootNode().host.editEvent(${event.id})"
                    aria-label="Edit ${this.escapeHtml(event.title)}">
              Edit
            </button>
            <button class="event-action-btn delete" 
                    onclick="this.getRootNode().host.deleteEvent(${event.id})"
                    aria-label="Delete ${this.escapeHtml(event.title)}">
              Delete
            </button>
          </div>
        </div>
        ${event.description ? `<div class="event-description">${this.escapeHtml(event.description)}</div>` : ''}
      </article>
    `).join('');

    eventsList.innerHTML = eventsHTML;
  }

  /**
   * Edit an event
   */
  editEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    // Populate form with event data
    this.shadowRoot.getElementById('eventTitle').value = event.title;
    this.shadowRoot.getElementById('eventDescription').value = event.description || '';
    this.shadowRoot.getElementById('eventCategory').value = event.category || 'personal';
    this.shadowRoot.getElementById('eventTime').value = event.time || '';

    // Switch to edit mode
    this.isEditMode = true;
    this.editingEventId = eventId;
    
    // Update form UI
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    const formLegend = this.shadowRoot.getElementById('formLegend');
    submitBtn.textContent = 'Update Event';
    formLegend.textContent = 'Edit Event';
    
    // Open advanced form
    const advancedForm = this.shadowRoot.getElementById('advancedForm');
    advancedForm.open = true;
  }

  /**
   * Reset form to initial state
   */
  resetForm() {
    // Clear form inputs
    this.shadowRoot.getElementById('eventTitle').value = '';
    this.shadowRoot.getElementById('eventDescription').value = '';
    this.shadowRoot.getElementById('eventCategory').value = 'personal';
    this.shadowRoot.getElementById('eventTime').value = '';

    // Reset edit mode
    this.isEditMode = false;
    this.editingEventId = null;
    
    // Update form UI
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    const formLegend = this.shadowRoot.getElementById('formLegend');
    submitBtn.textContent = 'Add Event';
    formLegend.textContent = 'Add New Event';
    
    // Close advanced form
    const advancedForm = this.shadowRoot.getElementById('advancedForm');
    advancedForm.open = false;
  }

  // Public API methods

  /**
   * Show the modal
   * @param {string} dateStr - Date string for the modal title
   */
  show(dateStr = null) {
    if (dateStr) {
      this.selectedDate = dateStr;
      const modalTitle = this.shadowRoot.getElementById('modalTitle');
      modalTitle.textContent = this.formatDateForDisplay(dateStr);
    }

    const modalBackdrop = this.shadowRoot.getElementById('modalBackdrop');
    const dialog = this.shadowRoot.getElementById('eventDialog');
    
    this.setAttribute('open', '');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    
    // Focus management
    setTimeout(() => {
      const firstInput = this.shadowRoot.getElementById('quickEventTitle');
      if (firstInput) firstInput.focus();
    }, 100);
    
    // Reset form when showing
    this.resetForm();
  }

  /**
   * Hide the modal
   */
  hide() {
    const modalBackdrop = this.shadowRoot.getElementById('modalBackdrop');
    
    modalBackdrop.setAttribute('aria-hidden', 'true');
    this.removeAttribute('open');
    
    // Emit close event
    eventBus.emit('modalClosed');
    
    // Clear state
    this.selectedDate = null;
    this.events = [];
    this.resetForm();
  }

  /**
   * Check if modal is open
   */
  isOpen() {
    return this.hasAttribute('open');
  }

  /**
   * Show error message
   */
  showError(message) {
    // Simple error display - could be enhanced with toast notifications
    alert(message);
  }

  // Utility methods

  /**
   * Format date for display
   */
  formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register the custom element
customElements.define('event-modal', EventModal);

export default EventModal;