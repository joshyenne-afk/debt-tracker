// ================================
// Debt Tracker App with Firebase Sync
// Multi-tracker support with device-local bookmarks
// ================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCkxdSgMVFgP7LMbobpWTZoZihWQHQFZAk",
    authDomain: "debt-tracker-5c156.firebaseapp.com",
    databaseURL: "https://debt-tracker-5c156-default-rtdb.firebaseio.com",
    projectId: "debt-tracker-5c156",
    storageBucket: "debt-tracker-5c156.firebasestorage.app",
    messagingSenderId: "336941479238",
    appId: "1:336941479238:web:b7ff32e78948d60947e147"
};

class DebtTracker {
    constructor() {
        this.trackerId = null;
        this.db = null;
        this.trackerRef = null;
        this.data = this.getDefaultData();
        this.isFirebaseReady = false;
        this.bookmarks = this.loadBookmarks();

        this.init();
    }

    // Load bookmarks from localStorage (device-specific)
    loadBookmarks() {
        try {
            const saved = localStorage.getItem('debtTrackerBookmarks');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading bookmarks:', e);
            return [];
        }
    }

    // Save bookmarks to localStorage
    saveBookmarks() {
        try {
            localStorage.setItem('debtTrackerBookmarks', JSON.stringify(this.bookmarks));
        } catch (e) {
            console.error('Error saving bookmarks:', e);
        }
    }

    // Add a tracker to bookmarks
    addBookmark(trackerId, person1, person2) {
        // Check if already bookmarked
        const existing = this.bookmarks.find(b => b.trackerId === trackerId);
        if (existing) {
            // Update the existing bookmark with latest names
            existing.person1 = person1;
            existing.person2 = person2;
            existing.lastAccessed = Date.now();
        } else {
            this.bookmarks.unshift({
                trackerId: trackerId,
                person1: person1,
                person2: person2,
                createdAt: Date.now(),
                lastAccessed: Date.now()
            });
        }

        // Keep only last 50 bookmarks
        this.bookmarks = this.bookmarks.slice(0, 50);
        this.saveBookmarks();
        this.renderBookmarks();
        this.updateBookmarkButton();
    }

    // Remove a tracker from bookmarks
    removeBookmark(trackerId) {
        this.bookmarks = this.bookmarks.filter(b => b.trackerId !== trackerId);
        this.saveBookmarks();
        this.renderBookmarks();
        this.updateBookmarkButton();
    }

    // Check if current tracker is bookmarked
    isBookmarked(trackerId) {
        return this.bookmarks.some(b => b.trackerId === trackerId);
    }

    // Toggle bookmark for current tracker
    toggleBookmark() {
        if (!this.trackerId || !this.data.person1) return;

        if (this.isBookmarked(this.trackerId)) {
            this.removeBookmark(this.trackerId);
            this.showToast('Bookmark removed');
        } else {
            this.addBookmark(this.trackerId, this.data.person1, this.data.person2);
            this.showToast('Tracker bookmarked!');
        }
    }

    // Update the bookmark button appearance
    updateBookmarkButton() {
        const btn = document.getElementById('bookmark-btn');
        const icon = document.getElementById('bookmark-icon');
        if (!btn || !icon) return;

        if (this.isBookmarked(this.trackerId)) {
            btn.classList.add('bookmarked');
            icon.textContent = '★';
        } else {
            btn.classList.remove('bookmarked');
            icon.textContent = '☆';
        }
    }

    // Show a toast notification
    showToast(message) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Default data structure
    getDefaultData() {
        return {
            person1: '',
            person2: '',
            entries: {
                person1: [],
                person2: []
            }
        };
    }

    // Generate a random tracker ID
    generateTrackerId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Initialize the app
    async init() {
        // Initialize Firebase
        try {
            if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.database();
                this.isFirebaseReady = true;
                console.log('Firebase initialized');
            } else {
                console.warn('Firebase not configured - using localStorage fallback');
                this.isFirebaseReady = false;
            }
        } catch (error) {
            console.error('Firebase init error:', error);
            this.isFirebaseReady = false;
        }

        this.bindEvents();
        this.renderBookmarks();

        // Check if there's a tracker ID in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlTrackerId = urlParams.get('t');

        if (urlTrackerId) {
            // Join from URL
            this.joinTracker(urlTrackerId.toUpperCase());
        } else {
            // Show homepage
            this.showScreen('welcome-screen');
        }
    }

    // Render bookmarks on homepage
    renderBookmarks() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        if (this.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-bookmarks">
                    <span class="empty-icon">📋</span>
                    <p>No bookmarked trackers yet</p>
                    <p class="empty-hint">Create a new tracker or import one below</p>
                </div>
            `;
            return;
        }

        // Sort by last accessed
        const sortedBookmarks = [...this.bookmarks].sort((a, b) =>
            (b.lastAccessed || 0) - (a.lastAccessed || 0)
        );

        container.innerHTML = sortedBookmarks.map(b => `
            <div class="bookmark-item" data-tracker-id="${b.trackerId}">
                <div class="bookmark-info" onclick="tracker.openBookmark('${b.trackerId}')">
                    <div class="bookmark-names">${this.escapeHtml(b.person1)} ↔ ${this.escapeHtml(b.person2)}</div>
                    <div class="bookmark-code">${b.trackerId}</div>
                </div>
                <button class="bookmark-delete" onclick="event.stopPropagation(); tracker.removeBookmark('${b.trackerId}')" title="Remove bookmark">×</button>
            </div>
        `).join('');
    }

    // Open a bookmarked tracker
    openBookmark(trackerId) {
        // Update last accessed
        const bookmark = this.bookmarks.find(b => b.trackerId === trackerId);
        if (bookmark) {
            bookmark.lastAccessed = Date.now();
            this.saveBookmarks();
        }
        this.joinTracker(trackerId);
    }

    // Bind all event listeners
    bindEvents() {
        // Homepage - New tracker button
        document.getElementById('new-tracker-btn').addEventListener('click', () => {
            this.showScreen('setup-screen');
        });

        // Homepage - Join tracker button (shows form)
        document.getElementById('join-tracker-btn').addEventListener('click', () => {
            const joinForm = document.getElementById('join-form');
            const quickActions = document.querySelector('.quick-actions');
            joinForm.style.display = 'block';
            quickActions.style.display = 'none';
            document.getElementById('join-code').focus();
        });

        // Join form - Cancel button
        document.getElementById('join-cancel-btn').addEventListener('click', () => {
            document.getElementById('join-form').style.display = 'none';
            document.querySelector('.quick-actions').style.display = 'grid';
            document.getElementById('join-code').value = '';
        });

        // Join form - Submit button
        document.getElementById('join-btn').addEventListener('click', () => {
            const code = document.getElementById('join-code').value.trim().toUpperCase();
            if (code) {
                this.joinTracker(code);
                document.getElementById('join-form').style.display = 'none';
                document.querySelector('.quick-actions').style.display = 'grid';
                document.getElementById('join-code').value = '';
            } else {
                this.shake(document.getElementById('join-code'));
            }
        });

        document.getElementById('join-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('join-btn').click();
            }
        });

        // Import tracker button
        document.getElementById('import-tracker-btn').addEventListener('click', () => {
            document.getElementById('import-form').style.display = 'block';
            document.getElementById('import-code').focus();
        });

        // Import form - Cancel button
        document.getElementById('import-cancel-btn').addEventListener('click', () => {
            document.getElementById('import-form').style.display = 'none';
            document.getElementById('import-code').value = '';
        });

        // Import form - Submit button
        document.getElementById('import-submit-btn').addEventListener('click', () => {
            this.handleImport();
        });

        document.getElementById('import-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleImport();
            }
        });

        // Setup screen
        document.getElementById('start-btn').addEventListener('click', () => this.handleStart());
        document.getElementById('back-to-welcome-btn').addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });

        // Tracker screen - Home button
        document.getElementById('home-btn').addEventListener('click', () => {
            // Detach current listener
            if (this.trackerRef) {
                this.trackerRef.off();
            }
            this.trackerId = null;
            // Clear URL parameter
            window.history.replaceState({}, '', window.location.pathname);
            this.showScreen('welcome-screen');
            this.renderBookmarks();
        });

        // Bookmark button
        document.getElementById('bookmark-btn').addEventListener('click', () => this.toggleBookmark());

        // Share button
        document.getElementById('share-btn').addEventListener('click', () => this.showShareModal());
        document.getElementById('share-modal-close').addEventListener('click', () => this.hideShareModal());
        document.querySelector('#share-modal .modal-backdrop').addEventListener('click', () => this.hideShareModal());

        document.getElementById('copy-code-btn').addEventListener('click', () => this.copyToClipboard('code'));
        document.getElementById('copy-link-btn').addEventListener('click', () => this.copyToClipboard('link'));

        // Add entry buttons
        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', () => this.addEntry(btn.dataset.person));
        });

        // Arrow buttons for $5 increments
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const person = btn.dataset.person;
                const dir = btn.dataset.dir;
                const input = document.getElementById(`person${person}-amount`);
                let value = parseInt(input.value) || 0;

                if (dir === 'up') {
                    value += 5;
                } else {
                    value = Math.max(0, value - 5);
                }

                input.value = value;
            });
        });

        // Enter key to add entry
        document.querySelectorAll('.amount-input, .description-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const person = input.id.includes('person1') ? '1' : '2';
                    this.addEntry(person);
                }
            });
        });
    }

    // Handle import submission
    async handleImport() {
        const code = document.getElementById('import-code').value.trim().toUpperCase();
        if (!code || code.length !== 6) {
            this.shake(document.getElementById('import-code'));
            return;
        }

        // Check if tracker exists in Firebase
        if (this.isFirebaseReady) {
            const trackerRef = this.db.ref('trackers/' + code);
            const snapshot = await trackerRef.once('value');

            if (snapshot.exists()) {
                const data = snapshot.val();
                this.addBookmark(code, data.person1 || 'Person 1', data.person2 || 'Person 2');
                this.showToast('Tracker imported!');
                document.getElementById('import-form').style.display = 'none';
                document.getElementById('import-code').value = '';
            } else {
                this.shake(document.getElementById('import-code'));
                this.showToast('Tracker not found');
            }
        } else {
            // Without Firebase, just add to bookmarks with placeholder names
            this.addBookmark(code, 'Unknown', 'Unknown');
            this.showToast('Tracker imported (offline)');
            document.getElementById('import-form').style.display = 'none';
            document.getElementById('import-code').value = '';
        }
    }

    // Show a specific screen
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    // Handle creating a new tracker
    async handleStart() {
        const person1 = document.getElementById('person1').value.trim();
        const person2 = document.getElementById('person2').value.trim();

        if (!person1 || !person2) {
            this.shake(document.querySelector('#setup-screen .setup-card'));
            return;
        }

        // Generate new tracker ID
        this.trackerId = this.generateTrackerId();

        this.data = {
            person1: person1,
            person2: person2,
            entries: { person1: [], person2: [] },
            createdAt: Date.now()
        };

        // Save to Firebase
        if (this.isFirebaseReady) {
            this.trackerRef = this.db.ref('trackers/' + this.trackerId);
            await this.trackerRef.set(this.data);
            this.setupRealtimeListener();
        }

        // Auto-bookmark new trackers
        this.addBookmark(this.trackerId, person1, person2);

        this.showTrackerScreen();
    }

    // Join an existing tracker
    joinTracker(trackerId) {
        this.trackerId = trackerId;
        this.showSyncStatus('Connecting...');

        if (this.isFirebaseReady) {
            this.trackerRef = this.db.ref('trackers/' + trackerId);

            // Check if tracker exists
            this.trackerRef.once('value', async (snapshot) => {
                if (snapshot.exists()) {
                    this.data = snapshot.val();
                    // Ensure entries object exists
                    if (!this.data.entries) {
                        this.data.entries = { person1: [], person2: [] };
                    }
                    if (!this.data.entries.person1) this.data.entries.person1 = [];
                    if (!this.data.entries.person2) this.data.entries.person2 = [];

                    // Update bookmark if it exists
                    if (this.isBookmarked(trackerId)) {
                        this.addBookmark(trackerId, this.data.person1, this.data.person2);
                    }

                    this.setupRealtimeListener();
                    this.showTrackerScreen();
                    this.hideSyncStatus();
                } else {
                    this.showToast('Tracker not found');
                    this.showScreen('welcome-screen');
                    this.hideSyncStatus();
                }
            });
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem('debtTrackerData_' + trackerId);
            if (saved) {
                this.data = JSON.parse(saved);
                this.showTrackerScreen();
            } else {
                this.showToast('Tracker not found');
                this.showScreen('welcome-screen');
            }
            this.hideSyncStatus();
        }
    }

    // Setup real-time listener for Firebase
    setupRealtimeListener() {
        if (!this.isFirebaseReady || !this.trackerRef) return;

        this.trackerRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const newData = snapshot.val();
                // Ensure entries object exists
                if (!newData.entries) {
                    newData.entries = { person1: [], person2: [] };
                }
                if (!newData.entries.person1) newData.entries.person1 = [];
                if (!newData.entries.person2) newData.entries.person2 = [];

                // Detect remote changes (alert if new entries added)
                const oldTotal = (this.data.entries.person1?.length || 0) + (this.data.entries.person2?.length || 0);
                const newTotal = (newData.entries.person1?.length || 0) + (newData.entries.person2?.length || 0);
                
                // Only toast if we already had data (not first load) and count increased
                // Note: local writes update this.data immediately, so they won't trigger this (newTotal == oldTotal)
                if (newTotal > oldTotal) {
                    this.showToast('New entry added!');
                    // Optional sound effect?
                    // new Audio('/sounds/notification.mp3').play().catch(() => {}); 
                }

                this.data = newData;
                this.renderEntries();
                this.updateBalance();
                this.showSyncSuccess();
            }
        });
    }

    // Show tracker screen
    showTrackerScreen() {
        document.getElementById('person1-name').textContent = this.data.person1;
        document.getElementById('person2-name').textContent = this.data.person2;

        this.renderEntries();
        this.updateBalance();
        this.updateBookmarkButton();
        this.showScreen('tracker-screen');

        // Update URL with tracker ID
        if (this.trackerId) {
            const newUrl = window.location.pathname + '?t=' + this.trackerId;
            window.history.replaceState({}, '', newUrl);
        }
    }

    // Show share modal
    showShareModal() {
        document.getElementById('share-code-text').textContent = this.trackerId;
        document.getElementById('share-link-input').value = window.location.origin + window.location.pathname + '?t=' + this.trackerId;
        document.getElementById('share-modal').classList.add('active');
    }

    hideShareModal() {
        document.getElementById('share-modal').classList.remove('active');
    }

    // Copy to clipboard
    async copyToClipboard(type) {
        const text = type === 'code'
            ? this.trackerId
            : document.getElementById('share-link-input').value;

        try {
            await navigator.clipboard.writeText(text);
            const successEl = document.getElementById('copy-success');
            successEl.classList.add('show');
            setTimeout(() => successEl.classList.remove('show'), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    // Sync status UI
    showSyncStatus(text = 'Syncing...') {
        const el = document.getElementById('sync-status');
        el.querySelector('.sync-text').textContent = text;
        el.classList.add('show');
    }

    showSyncSuccess() {
        const el = document.getElementById('sync-status');
        el.querySelector('.sync-icon').textContent = '✓';
        el.querySelector('.sync-text').textContent = 'Synced';
        el.classList.add('show', 'success');
        setTimeout(() => {
            el.classList.remove('show', 'success');
            el.querySelector('.sync-icon').textContent = '🔄';
        }, 1500);
    }

    hideSyncStatus() {
        document.getElementById('sync-status').classList.remove('show');
    }

    // Add a new entry
    addEntry(person) {
        const amountInput = document.getElementById(`person${person}-amount`);
        const descInput = document.getElementById(`person${person}-desc`);

        const amount = Math.round(parseFloat(amountInput.value) || 0);
        const description = descInput.value.trim();

        if (amount <= 0) {
            this.shake(amountInput.closest('.quick-add'));
            return;
        }

        const entry = {
            id: Date.now(),
            amount: amount,
            description: description || null,
            date: new Date().toISOString()
        };

        const personKey = person === '1' ? 'person1' : 'person2';

        // Ensure entries array exists
        if (!this.data.entries[personKey]) {
            this.data.entries[personKey] = [];
        }

        this.data.entries[personKey].unshift(entry);

        // Save to Firebase or localStorage
        this.saveData();

        // Clear inputs
        amountInput.value = '';
        descInput.value = '';

        // Update UI (will also be triggered by Firebase listener)
        if (!this.isFirebaseReady) {
            this.renderEntries();
            this.updateBalance();
        }
    }

    // Delete an entry
    deleteEntry(personKey, entryId) {
        this.data.entries[personKey] = this.data.entries[personKey].filter(e => e.id !== entryId);
        this.saveData();

        if (!this.isFirebaseReady) {
            this.renderEntries();
            this.updateBalance();
        }
    }

    // Save data to Firebase or localStorage
    saveData() {
        if (this.isFirebaseReady && this.trackerRef) {
            this.showSyncStatus();
            this.trackerRef.set(this.data);
        } else {
            localStorage.setItem('debtTrackerData_' + this.trackerId, JSON.stringify(this.data));
        }
    }

    // Render entries for both columns
    renderEntries() {
        this.renderPersonEntries('person1', 'person1-entries');
        this.renderPersonEntries('person2', 'person2-entries');
    }

    // Render entries for a single person
    renderPersonEntries(personKey, containerId) {
        const container = document.getElementById(containerId);
        const entries = this.data.entries[personKey] || [];

        if (entries.length === 0) {
            container.innerHTML = `<div class="empty-state">No entries yet</div>`;
        } else {
            container.innerHTML = entries.map(entry => `
                <div class="entry-item" data-id="${entry.id}">
                    <div class="entry-info">
                        <div class="entry-description">${entry.description ? this.escapeHtml(entry.description) : 'Entry'}</div>
                        <div class="entry-date">${this.formatDate(entry.date)}</div>
                    </div>
                    <div class="entry-amount">$${entry.amount}</div>
                    <button class="entry-delete" onclick="tracker.deleteEntry('${personKey}', ${entry.id})" title="Delete">×</button>
                </div>
            `).join('');
        }
    }

    // Update the balance display and column colors
    updateBalance() {
        const entries1 = this.data.entries.person1 || [];
        const entries2 = this.data.entries.person2 || [];
        const total1 = entries1.reduce((sum, e) => sum + e.amount, 0);
        const total2 = entries2.reduce((sum, e) => sum + e.amount, 0);
        const diff = total1 - total2;

        const balanceText = document.getElementById('balance-text');
        const column1 = document.getElementById('person1-column');
        const column2 = document.getElementById('person2-column');

        // Reset classes
        balanceText.className = 'balance-text';
        column1.className = 'person-column';
        column2.className = 'person-column';
        column1.dataset.person = '1';
        column2.dataset.person = '2';

        if (Math.abs(diff) < 1) {
            balanceText.textContent = 'All squared up! ✨';
            balanceText.classList.add('even');
            column1.classList.add('even');
            column2.classList.add('even');
        } else if (diff > 0) {
            // person1 spent more, so person2 owes person1
            balanceText.textContent = `${this.data.person2} owes $${Math.abs(diff)}`;
            balanceText.classList.add('owes-2');
            column1.classList.add('owed');
            column2.classList.add('owes');
        } else {
            // person2 spent more, so person1 owes person2
            balanceText.textContent = `${this.data.person1} owes $${Math.abs(diff)}`;
            balanceText.classList.add('owes-1');
            column1.classList.add('owes');
            column2.classList.add('owed');
        }
    }

    // Format date
    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Shake animation for validation
    shake(element) {
        element.style.animation = 'none';
        element.offsetHeight;
        element.style.animation = 'shake 0.5s ease';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
}

// Add shake animation and toast styles
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-10px); }
        80% { transform: translateX(10px); }
    }
    
    .toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        padding: var(--spacing-sm) var(--spacing-lg);
        font-size: 0.9rem;
        color: var(--text-primary);
        box-shadow: var(--shadow-md);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 600;
    }
    
    .toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
`;
document.head.appendChild(style);

// Initialize the app
const tracker = new DebtTracker();
