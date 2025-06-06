/**
 * Simple IndexedDB wrapper for memory entries and readers
 * Provides async/await interface for database operations
 */
class Database {
  constructor() {
    this.dbName = 'MemoryTimelineDB';
    this.dbVersion = 2; // Increased version for schema change
    this.entriesStoreName = 'entries';
    this.readersStoreName = 'readers';
    this.db = null;
  }

  /**
   * Initialize the database
   * @returns {Promise<Database>} This instance for chaining
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create entries store (memory entries)
        if (!db.objectStoreNames.contains(this.entriesStoreName)) {
          const entriesStore = db.createObjectStore(this.entriesStoreName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Create indexes for efficient queries
          entriesStore.createIndex('dateIndex', 'date', { unique: false });
          entriesStore.createIndex('readerIndex', 'readerId', { unique: false });
          entriesStore.createIndex('createdAtIndex', 'createdAt', { unique: false });
        }

        // Create readers store (people who will receive memories)
        if (!db.objectStoreNames.contains(this.readersStoreName)) {
          const readersStore = db.createObjectStore(this.readersStoreName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          readersStore.createIndex('nameIndex', 'name', { unique: false });
        }

        // Add default readers on first setup
        const transaction = event.target.transaction;
        if (transaction.objectStore(this.readersStoreName)) {
          const readersStore = transaction.objectStore(this.readersStoreName);
          
          // Add "Family" as default reader for shared memories
          readersStore.add({
            name: 'Family',
            description: 'Memories for the whole family',
            color: '#10b981', // Green
            isDefault: true,
            createdAt: new Date().toISOString()
          });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ Memory Timeline database initialized successfully');
        resolve(this);
      };

      request.onerror = (event) => {
        console.error('❌ Database initialization failed:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // ENTRIES METHODS (formerly events)

  /**
   * Add a new memory entry to the database
   * @param {Object} entryData - Entry data to store
   * @returns {Promise<number>} The generated entry ID
   */
  async addEntry(entryData) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readwrite');
      const store = transaction.objectStore(this.entriesStoreName);
      
      const entry = {
        ...entryData,
        createdAt: entryData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const request = store.add(entry);

      request.onsuccess = () => {
        console.log('✅ Memory entry added:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ Failed to add memory entry:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all entries for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of entries
   */
  async getEntriesForDate(date) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readonly');
      const store = transaction.objectStore(this.entriesStoreName);
      const index = store.index('dateIndex');
      const request = index.getAll(date);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get entries for date:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all entries in the database
   * @returns {Promise<Array>} Array of all entries
   */
  async getAllEntries() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readonly');
      const store = transaction.objectStore(this.entriesStoreName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all entries:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update an existing entry
   * @param {number} entryId - ID of the entry to update
   * @param {Object} entryData - Updated entry data
   * @returns {Promise<void>}
   */
  async updateEntry(entryId, entryData) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readwrite');
      const store = transaction.objectStore(this.entriesStoreName);
      
      const updatedEntry = {
        ...entryData,
        id: entryId,
        updatedAt: new Date().toISOString()
      };
      
      const request = store.put(updatedEntry);

      request.onsuccess = () => {
        console.log('✅ Memory entry updated:', entryId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to update entry:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete an entry from the database
   * @param {number} entryId - ID of the entry to delete
   * @returns {Promise<void>}
   */
  async deleteEntry(entryId) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readwrite');
      const store = transaction.objectStore(this.entriesStoreName);
      const request = store.delete(entryId);

      request.onsuccess = () => {
        console.log('✅ Memory entry deleted:', entryId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to delete entry:', request.error);
        reject(request.error);
      };
    });
  }

  // READERS METHODS

  /**
   * Add a new reader
   * @param {Object} readerData - Reader data to store
   * @returns {Promise<number>} The generated reader ID
   */
  async addReader(readerData) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.readersStoreName, 'readwrite');
      const store = transaction.objectStore(this.readersStoreName);
      
      const reader = {
        ...readerData,
        createdAt: readerData.createdAt || new Date().toISOString()
      };
      
      const request = store.add(reader);

      request.onsuccess = () => {
        console.log('✅ Reader added:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ Failed to add reader:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all readers
   * @returns {Promise<Array>} Array of all readers
   */
  async getAllReaders() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.readersStoreName, 'readonly');
      const store = transaction.objectStore(this.readersStoreName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all readers:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update an existing reader
   * @param {number} readerId - ID of the reader to update
   * @param {Object} readerData - Updated reader data
   * @returns {Promise<void>}
   */
  async updateReader(readerId, readerData) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.readersStoreName, 'readwrite');
      const store = transaction.objectStore(this.readersStoreName);
      
      const updatedReader = {
        ...readerData,
        id: readerId
      };
      
      const request = store.put(updatedReader);

      request.onsuccess = () => {
        console.log('✅ Reader updated:', readerId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to update reader:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a reader from the database
   * @param {number} readerId - ID of the reader to delete
   * @returns {Promise<void>}
   */
  async deleteReader(readerId) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.readersStoreName, 'readwrite');
      const store = transaction.objectStore(this.readersStoreName);
      const request = store.delete(readerId);

      request.onsuccess = () => {
        console.log('✅ Reader deleted:', readerId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to delete reader:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get entries by reader
   * @param {number} readerId - Reader ID
   * @returns {Promise<Array>} Array of entries for reader
   */
  async getEntriesByReader(readerId) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readonly');
      const store = transaction.objectStore(this.entriesStoreName);
      const index = store.index('readerIndex');
      const request = index.getAll(readerId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get entries by reader:', request.error);
        reject(request.error);
      };
    });
  }

  // LEGACY COMPATIBILITY METHODS (for existing code)
  async addEvent(eventData) { return this.addEntry(eventData); }
  async getEventsForDate(date) { return this.getEntriesForDate(date); }
  async getAllEvents() { return this.getAllEntries(); }
  async updateEvent(eventId, eventData) { return this.updateEntry(eventId, eventData); }
  async deleteEvent(eventId) { return this.deleteEntry(eventId); }
  async getEventsByCategory(category) { return this.getEntriesByReader(category); }

  /**
   * Clear all entries from the database
   * @returns {Promise<void>}
   */
  async clearAllEntries() {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.entriesStoreName, 'readwrite');
      const store = transaction.objectStore(this.entriesStoreName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ All entries cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear entries:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 Database connection closed');
    }
  }
}

// Create and export singleton instance
const database = new Database();

export default database;