import eventBus from '../EventBus.js';
import database from '../Database.js';

/**
 * EntryModal Web Component
 * Handles memory entry creation, editing, and display in a modal dialog
 */
class EntryModal extends HTMLElement {
  constructor() {
    super();
    
    // Component state
    this.selectedDate = null;
    this.entries = [];
    this.readers = [];
    this.isEditMode = false;
    this.editingEntryId = null;
    
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
    
    // Don't load readers immediately - wait for database to be ready
    eventBus.on('databaseReady', this.loadReaders.bind(this));
    
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
        <dialog class="entry-dialog" id="entryDialog" aria-labelledby="modalTitle">
          <header class="modal-header">
            <h2 class="modal-title" id="modalTitle">Manage Memories</h2>
            <button class="close-btn" 
                    id="closeBtn" 
                    aria-label="Close dialog"
                    type="button">
              &times;
            </button>
          </header>
          
          <main class="modal-content">
            <section class="entries-list" id="entriesList" aria-live="polite">
              <!-- Entries will be populated here -->
            </section>
            
            <section class="add-entry-section">
              <div class="quick-add-form">
                <h3>Quick Add Memory</h3>
                <form id="quickAddForm" aria-label="Quick add memory form">
                  <div class="form-row">
                    <label for="quickEntryTitle" class="sr-only">Memory description</label>
                    <input type="text" 
                           class="form-input" 
                           id="quickEntryTitle" 
                           placeholder="What happened today..."
                           required
                           autocomplete="off">
                    <button type="submit" class="btn btn-primary">Add</button>
                  </div>
                </form>
              </div>
              
              <details class="advanced-form" id="advancedForm">
                <summary>Detailed Memory Entry</summary>
                
                <form id="entryForm" aria-label="Detailed memory form">
                  <fieldset>
                    <legend id="formLegend">Add New Memory</legend>
                    
                    <div class="form-group">
                      <label for="entryTitle" class="form-label">What happened? *</label>
                      <input type="text" 
                             class="form-input" 
                             id="entryTitle" 
                             required
                             autocomplete="off"
                             placeholder="Describe this memory...">
                    </div>
                    
                    <div class="form-group">
                      <label for="entryDescription" class="form-label">More details</label>
                      <textarea class="form-input form-textarea" 
                                id="entryDescription" 
                                placeholder="Add more context, feelings, or details about this memory..."
                                rows="3"></textarea>
                    </div>
                    
                    <div class="form-row">
                      <div class="form-group">
                        <label for="entryReader" class="form-label">For whom?</label>
                        <select class="form-select" id="entryReader">
                          <!-- Readers will be populated here -->
                        </select>
                        <button type="button" class="btn-link" id="addReaderBtn">+ Add new person</button>
                      </div>
                      
                      <div class="form-group">
                        <label for="entryTime" class="form-label">Time</label>
                        <input type="time" class="form-input" id="entryTime">
                      </div>
                    </div>
                    
                    <div class="form-actions">
                      <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                      <button type="submit" class="btn btn-primary" id="submitBtn">Save Memory</button>
                    </div>
                  </fieldset>
                </form>
              </details>
            </section>
          </main>
        </dialog>
      </div>

      <!-- Add Reader Mini-Modal -->
      <div class="mini-modal-backdrop" id="readerModalBackdrop" aria-hidden="true">
        <div class="mini-modal">
          <h3>Add New Person</h3>
          <form id="addReaderForm">
            <div class="form-group">
              <label for="readerName">Name</label>
              <input type="text" id="readerName" class="form-input" placeholder="e.g., Sarah, Mom, etc." required>
            </div>
            <div class="form-group">
              <label for="readerDescription">Relationship (optional)</label>
              <input type="text" id="readerDescription" class="form-input" placeholder="e.g., daughter, best friend, etc.">
            </div>
            <div class="form-group">
              <label for="readerColor">Color</label>
              <div class="color-picker">
                <input type="color" id="readerColor" value="#3b82f6">
                <span class="color-preview"></span>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="cancelReaderBtn">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Person</button>
            </div>
          </form>
        </div>
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

      .entry-dialog {
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

      .modal-backdrop[aria-hidden="false"] .entry-dialog {
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

      .entries-list {
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

      .entry-item {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        border-left: 4px solid #6b7280;
        position: relative;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .entry-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .entry-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
        font-size: 1rem;
      }

      .entry-meta {
        font-size: 0.85rem;
        color: #666;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .entry-description {
        font-size: 0.9rem;
        color: #555;
        line-height: 1.4;
        margin-top: 8px;
      }

      .entry-actions {
        display: flex;
        gap: 8px;
      }

      .entry-action-btn {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .entry-action-btn:hover {
        background: #e9ecef;
        color: #333;
      }

      .entry-action-btn.delete {
        color: #dc3545;
      }

      .entry-action-btn.delete:hover {
        background: #f8d7da;
        color: #721c24;
      }

      .add-entry-section {
        border-top: 1px solid #eee;
        padding-top: 24px;
      }

      .quick-add-form {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
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

      .btn-link {
        background: none;
        border: none;
        color: #007AFF;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 4px 0;
        text-decoration: underline;
        margin-top: 4px;
      }

      .btn-link:hover {
        color: #0056CC;
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

      /* Mini Modal for Adding Readers */
      .mini-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 1100;
      }

      .mini-modal-backdrop[aria-hidden="false"] {
        opacity: 1;
        visibility: visible;
      }

      .mini-modal {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        transform: scale(0.8);
        transition: transform 0.3s ease;
      }

      .mini-modal-backdrop[aria-hidden="false"] .mini-modal {
        transform: scale(1);
      }

      .mini-modal h3 {
        margin: 0 0 20px 0;
        color: #333;
        font-size: 1.1rem;
      }

      .color-picker {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .color-picker input[type="color"] {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }

      .color-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid #ddd;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .entry-dialog {
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
        .entry-dialog,
        .entry-item {
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
    const entryForm = this.shadowRoot.getElementById('entryForm');
    const cancelBtn = this.shadowRoot.getElementById('cancelBtn');
    const addReaderBtn = this.shadowRoot.getElementById('addReaderBtn');
    const addReaderForm = this.shadowRoot.getElementById('addReaderForm');
    const cancelReaderBtn = this.shadowRoot.getElementById('cancelReaderBtn');
    const readerModalBackdrop = this.shadowRoot.getElementById('readerModalBackdrop');

    closeBtn.addEventListener('click', this.handleClose);
    modalBackdrop.addEventListener('click', this.handleBackdropClick);
    quickAddForm.addEventListener('submit', this.handleQuickAdd);
    entryForm.addEventListener('submit', this.handleFormSubmit);
    cancelBtn.addEventListener('click', this.resetForm.bind(this));
    addReaderBtn.addEventListener('click', this.showAddReaderModal.bind(this));
    addReaderForm.addEventListener('submit', this.handleAddReader.bind(this));
    cancelReaderBtn.addEventListener('click', this.hideAddReaderModal.bind(this));
    readerModalBackdrop.addEventListener('click', (e) => {
      if (e.target === readerModalBackdrop) this.hideAddReaderModal();
    });
    
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
   * Load readers from database and populate dropdown
   */
  async loadReaders() {
    try {
      // Check if database is ready
      if (!database.db) {
        console.log('Database not ready yet, will retry when ready');
        return;
      }
      
      this.readers = await database.getAllReaders();
      this.populateReaderDropdown();
      console.log(`✅ Loaded ${this.readers.length} readers`);
    } catch (error) {
      console.error('Failed to load readers:', error);
      // Fallback: create a default reader locally
      this.readers = [
        {
          id: 1,
          name: 'Family',
          description: 'Memories for the whole family',
          color: '#10b981',
          isDefault: true
        }
      ];
      this.populateReaderDropdown();
    }
  }

  /**
   * Populate the reader dropdown
   */
  populateReaderDropdown() {
    const readerSelect = this.shadowRoot.getElementById('entryReader');
    if (!readerSelect) {
      console.log('Reader select not ready yet, will populate later');
      return;
    }

    readerSelect.innerHTML = '';
    
    if (this.readers.length === 0) {
      // Add a placeholder option if no readers loaded
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Loading readers...';
      readerSelect.appendChild(option);
      return;
    }
    
    this.readers.forEach(reader => {
      const option = document.createElement('option');
      option.value = reader.id;
      option.textContent = reader.name;
      readerSelect.appendChild(option);
    });
    
    console.log(`✅ Populated dropdown with ${this.readers.length} readers`);
  }

  /**
   * Show add reader mini-modal
   */
  showAddReaderModal() {
    const readerModalBackdrop = this.shadowRoot.getElementById('readerModalBackdrop');
    readerModalBackdrop.setAttribute('aria-hidden', 'false');
    
    // Focus on name input
    setTimeout(() => {
      const nameInput = this.shadowRoot.getElementById('readerName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  /**
   * Hide add reader mini-modal
   */
  hideAddReaderModal() {
    const readerModalBackdrop = this.shadowRoot.getElementById('readerModalBackdrop');
    readerModalBackdrop.setAttribute('aria-hidden', 'true');
    
    // Clear form
    const form = this.shadowRoot.getElementById('addReaderForm');
    if (form) form.reset();
  }

  /**
   * Handle adding a new reader
   */
  async handleAddReader(event) {
    event.preventDefault();
    
    const name = this.shadowRoot.getElementById('readerName').value.trim();
    const description = this.shadowRoot.getElementById('readerDescription').value.trim();
    const color = this.shadowRoot.getElementById('readerColor').value;
    
    if (!name) return;
    
    try {
      const readerId = await database.addReader({
        name,
        description,
        color,
        isDefault: false
      });
      
      // Add to local readers array
      this.readers.push({
        id: readerId,
        name,
        description,
        color,
        isDefault: false
      });
      
      // Update dropdown
      this.populateReaderDropdown();
      
      // Select the new reader
      const readerSelect = this.shadowRoot.getElementById('entryReader');
      if (readerSelect) readerSelect.value = readerId;
      
      // Hide modal
      this.hideAddReaderModal();
      
    } catch (error) {
      console.error('Failed to add reader:', error);
      this.showError('Failed to add person. Please try again.');
    }
  }

  // Continue with rest of the modal methods...
  // (The rest of the methods would be similar to EventModal but adapted for entries)

  /**
   * Handle day selected event
   */
  async handleDaySelected(data) {
    this.selectedDate = data.date;
    await this.loadEntriesForDate(data.date);
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
    
    const titleInput = this.shadowRoot.getElementById('quickEntryTitle');
    const title = titleInput.value.trim();
    
    if (!title) return;
    
    try {
      // Use first reader (Family) as default for quick add
      const defaultReader = this.readers.find(r => r.isDefault) || this.readers[0];
      
      if (!defaultReader) {
        // If no readers available, create a temporary one
        await this.addEntry({
          title,
          readerId: 1, // Default to ID 1 (Family)
          description: '',
          time: ''
        });
      } else {
        await this.addEntry({
          title,
          readerId: defaultReader.id,
          description: '',
          time: ''
        });
      }
      
      titleInput.value = '';
      
      // Auto-close modal after successful save
      setTimeout(() => {
        this.hide();
      }, 300);
      
    } catch (error) {
      console.error('Failed to add quick entry:', error);
      this.showError('Failed to add memory. Please try again.');
    }
  }

  /**
   * Handle detailed form submission
   */
  async handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = this.getFormData();
    
    if (!formData.title.trim()) {
      this.showError('Please describe what happened');
      return;
    }
    
    try {
      if (this.isEditMode) {
        await this.updateEntry(this.editingEntryId, formData);
      } else {
        await this.addEntry(formData);
      }
      
      this.resetForm();
      
      // Auto-close modal after successful save
      setTimeout(() => {
        this.hide();
      }, 300);
      
    } catch (error) {
      console.error('Failed to save entry:', error);
      this.showError('Failed to save memory. Please try again.');
    }
  }

  /**
   * Get form data
   */
  getFormData() {
    return {
      title: this.shadowRoot.getElementById('entryTitle').value.trim(),
      description: this.shadowRoot.getElementById('entryDescription').value.trim(),
      readerId: parseInt(this.shadowRoot.getElementById('entryReader').value),
      time: this.shadowRoot.getElementById('entryTime').value
    };
  }

  /**
   * Load entries for a specific date
   */
  async loadEntriesForDate(dateStr) {
    try {
      this.entries = await database.getEntriesForDate(dateStr);
      this.renderEntriesList();
    } catch (error) {
      console.error('Failed to load entries:', error);
      this.showError('Failed to load memories');
    }
  }

  /**
   * Add a new entry
   */
  async addEntry(entryData) {
    const fullEntryData = {
      date: this.selectedDate,
      title: entryData.title,
      description: entryData.description || '',
      readerId: entryData.readerId,
      time: entryData.time || '',
      createdAt: new Date().toISOString()
    };

    const entryId = await database.addEntry(fullEntryData);
    
    // Emit event for other components to update
    eventBus.emit('entryAdded', {
      entry: { ...fullEntryData, id: entryId },
      date: this.selectedDate
    });
    
    // Reload entries for this date
    await this.loadEntriesForDate(this.selectedDate);
  }

  /**
   * Update an existing entry
   */
  async updateEntry(entryId, entryData) {
    const fullEntryData = {
      date: this.selectedDate,
      title: entryData.title,
      description: entryData.description || '',
      readerId: entryData.readerId,
      time: entryData.time || '',
      updatedAt: new Date().toISOString()
    };

    await database.updateEntry(entryId, fullEntryData);
    
    // Emit event for other components to update
    eventBus.emit('entryUpdated', {
      entry: { ...fullEntryData, id: entryId },
      date: this.selectedDate
    });
    
    // Reload entries for this date
    await this.loadEntriesForDate(this.selectedDate);
  }

  /**
   * Delete an entry
   */
  async deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    try {
      await database.deleteEntry(entryId);
      
      // Emit event for other components to update
      eventBus.emit('entryDeleted', {
        entryId,
        date: this.selectedDate
      });
      
      // Reload entries for this date
      await this.loadEntriesForDate(this.selectedDate);
    } catch (error) {
      console.error('Failed to delete entry:', error);
      this.showError('Failed to delete memory. Please try again.');
    }
  }

  /**
   * Render the entries list
   */
  renderEntriesList() {
    const entriesList = this.shadowRoot.getElementById('entriesList');

    if (this.entries.length === 0) {
      entriesList.innerHTML = '<div class="empty-state">No memories recorded for this date</div>';
      return;
    }
    
    const entriesHTML = this.entries.map(entry => {
      const reader = this.readers.find(r => r.id === entry.readerId);
      const readerName = reader ? reader.name : 'Unknown';
      const readerColor = reader ? reader.color : '#6b7280';
      
      return `
        <article class="entry-item" style="border-left-color: ${readerColor}">
          <h3 class="entry-title">${this.escapeHtml(entry.title)}</h3>
          <div class="entry-meta">
            <span>
              <strong>For ${readerName}</strong>
              ${entry.time ? ` • ${entry.time}` : ''}
            </span>
            <div class="entry-actions">
              <button class="entry-action-btn edit" 
                      onclick="this.getRootNode().host.editEntry(${entry.id})"
                      aria-label="Edit ${this.escapeHtml(entry.title)}">
                Edit
              </button>
              <button class="entry-action-btn delete" 
                      onclick="this.getRootNode().host.deleteEntry(${entry.id})"
                      aria-label="Delete ${this.escapeHtml(entry.title)}">
                Delete
              </button>
            </div>
          </div>
          ${entry.description ? `<div class="entry-description">${this.escapeHtml(entry.description)}</div>` : ''}
        </article>
      `;
    }).join('');

    entriesList.innerHTML = entriesHTML;
  }

  /**
   * Edit an entry
   */
  editEntry(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) return;

    // Populate form with entry data
    this.shadowRoot.getElementById('entryTitle').value = entry.title;
    this.shadowRoot.getElementById('entryDescription').value = entry.description || '';
    this.shadowRoot.getElementById('entryReader').value = entry.readerId || '';
    this.shadowRoot.getElementById('entryTime').value = entry.time || '';

    // Switch to edit mode
    this.isEditMode = true;
    this.editingEntryId = entryId;
    
    // Update form UI
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    const formLegend = this.shadowRoot.getElementById('formLegend');
    submitBtn.textContent = 'Update Memory';
    formLegend.textContent = 'Edit Memory';
    
    // Open advanced form
    const advancedForm = this.shadowRoot.getElementById('advancedForm');
    advancedForm.open = true;
  }

  /**
   * Reset form to initial state
   */
  resetForm() {
    // Clear form inputs
    this.shadowRoot.getElementById('entryTitle').value = '';
    this.shadowRoot.getElementById('entryDescription').value = '';
    this.shadowRoot.getElementById('entryTime').value = '';
    
    // Set reader to first available (with fallback)
    const readerSelect = this.shadowRoot.getElementById('entryReader');
    if (readerSelect && this.readers.length > 0) {
      readerSelect.value = this.readers[0].id;
    }

    // Reset edit mode
    this.isEditMode = false;
    this.editingEntryId = null;
    
    // Update form UI
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    const formLegend = this.shadowRoot.getElementById('formLegend');
    if (submitBtn) submitBtn.textContent = 'Save Memory';
    if (formLegend) formLegend.textContent = 'Add New Memory';
    
    // Close advanced form
    const advancedForm = this.shadowRoot.getElementById('advancedForm');
    if (advancedForm) advancedForm.open = false;
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
    
    this.setAttribute('open', '');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    
    // Ensure readers are loaded before showing modal
    if (this.readers.length === 0) {
      this.loadReaders();
    }
    
    // Focus management
    setTimeout(() => {
      const firstInput = this.shadowRoot.getElementById('quickEntryTitle');
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
    this.entries = [];
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
customElements.define('entry-modal', EntryModal);

export default EntryModal;