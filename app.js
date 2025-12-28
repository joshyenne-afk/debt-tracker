// ================================
// Debt Tracker App with Firebase Sync
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

        this.init();
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
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Initialize the app
    init() {
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

        // Check if there's a tracker ID in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlTrackerId = urlParams.get('t');

        // Check localStorage for last used tracker
        const savedTrackerId = localStorage.getItem('lastTrackerId');

        if (urlTrackerId) {
            // Join from URL
            this.joinTracker(urlTrackerId.toUpperCase());
        } else if (savedTrackerId && this.isFirebaseReady) {
            // Resume last tracker
            this.joinTracker(savedTrackerId);
        } else {
            // Show welcome screen
            this.showScreen('welcome-screen');
        }
    }

    // Bind all event listeners
    bindEvents() {
        // Welcome screen buttons
        document.getElementById('new-tracker-btn').addEventListener('click', () => {
            this.showScreen('setup-screen');
        });

        document.getElementById('join-btn').addEventListener('click', () => {
            const code = document.getElementById('join-code').value.trim().toUpperCase();
            if (code) {
                this.joinTracker(code);
            } else {
                this.shake(document.getElementById('join-code'));
            }
        });

        document.getElementById('join-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('join-btn').click();
            }
        });

        // Setup screen
        document.getElementById('start-btn').addEventListener('click', () => this.handleStart());
        document.getElementById('back-to-welcome-btn').addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });

        // Tracker screen
        document.getElementById('back-btn').addEventListener('click', () => this.showScreen('setup-screen'));

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

    // Show a specific screen
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    // Handle creating a new tracker
    handleStart() {
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

        // Save to Firebase or localStorage
        if (this.isFirebaseReady) {
            this.trackerRef = this.db.ref('trackers/' + this.trackerId);
            this.trackerRef.set(this.data);
            this.setupRealtimeListener();
        }

        localStorage.setItem('lastTrackerId', this.trackerId);
        this.showTrackerScreen();
    }

    // Join an existing tracker
    joinTracker(trackerId) {
        this.trackerId = trackerId;
        this.showSyncStatus('Connecting...');

        if (this.isFirebaseReady) {
            this.trackerRef = this.db.ref('trackers/' + trackerId);

            // Check if tracker exists
            this.trackerRef.once('value', (snapshot) => {
                if (snapshot.exists()) {
                    this.data = snapshot.val();
                    // Ensure entries object exists
                    if (!this.data.entries) {
                        this.data.entries = { person1: [], person2: [] };
                    }
                    if (!this.data.entries.person1) this.data.entries.person1 = [];
                    if (!this.data.entries.person2) this.data.entries.person2 = [];

                    localStorage.setItem('lastTrackerId', trackerId);
                    this.setupRealtimeListener();
                    this.showTrackerScreen();
                    this.hideSyncStatus();
                } else {
                    alert('Tracker not found. Check the code and try again.');
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
                alert('Tracker not found.');
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
            balanceText.textContent = `${this.data.person1} owes $${Math.abs(diff)}`;
            balanceText.classList.add('owes-1');
            column1.classList.add('owes');
            column2.classList.add('owed');
        } else {
            balanceText.textContent = `${this.data.person2} owes $${Math.abs(diff)}`;
            balanceText.classList.add('owes-2');
            column1.classList.add('owed');
            column2.classList.add('owes');
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

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-10px); }
        80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// Initialize the app
const tracker = new DebtTracker();
