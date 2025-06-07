// js/app.js - Minimal Application Initialization
// ENHANCED: Real-time rate fetching on startup

const App = {
    // Initialize everything
    async init() {
        console.log('🚀 Starting Crypto Portfolio Tracker with Real-Time Rates...');
        
        try {
            // Initialize modules in order
            await Portfolio.init(); // NEW: Wait for Portfolio (fetches real-time rates)
            UI.init();
            Wallet.init();
            Goals.init();
            
            // Load initial data
            await this.loadData();
            
            console.log('✅ App ready with Real-Time Currency Conversion!');
            
            // NEW: Show current exchange rates in console
            const priceInfo = Portfolio.getCurrentPriceInfo();
            if (typeof priceInfo === 'object') {
                console.log('💱 Current Prices:', priceInfo);
            }
            
        } catch (error) {
            console.error('❌ App failed to start:', error);
            this.showError('Failed to initialize. Please refresh.');
        }
    },

    // Load initial data
    async loadData() {
        try {
            // Fetch rates and update ticker in parallel
            await Promise.all([
                Portfolio.fetchRealTimeRates(), // NEW: Use real-time rate fetching
                UI.updateTicker()
            ]);
            
            // Update portfolio after wallet loading is complete
            setTimeout(() => {
                Portfolio.updateValue();
                Goals.updateGoalsDisplay();
            }, 2000);
            
        } catch (error) {
            console.warn('Some data failed to load:', error);
        }
    },

    // Show error message
    showError(message) {
        const error = document.createElement('div');
        error.textContent = message;
        error.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #e74c3c; color: white; padding: 20px; border-radius: 8px;
            z-index: 10000; font-family: Arial, sans-serif;
        `;
        document.body.appendChild(error);
    }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Global error handlers
window.addEventListener('error', (e) => console.error('Global error:', e.error));
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled rejection:', e.reason));

console.log('🚀 App Core loaded with Real-Time Rate support');