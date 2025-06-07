// js/api.js - API Manager

class ApiManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.timeout = 30000;
        this.retries = 3;
        
        // Cache Configuration
        this.cache = new Map();
        this.cacheDurations = {
            wallet: 30 * 1000,
            prices: 2 * 60 * 1000,
            rates: 5 * 60 * 1000
        };
        
        console.log('🔧 API Manager initialized');
    }

    // HTTP Request Handler
    async request(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        
        for (let attempt = 1; attempt <= this.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                
                const response = await fetch(fullUrl, {
                    ...options,
                    headers: { 'Content-Type': 'application/json', ...options.headers },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                return await response.json();
                
            } catch (error) {
                if (attempt === this.retries) throw error;
                await this.delay(1000 * attempt);
            }
        }
    }

    // Cache Management
    cached(key, type, fetcher) {
        const cached = this.cache.get(key);
        const maxAge = this.cacheDurations[type] || this.cacheDurations.prices;
        
        if (cached && (Date.now() - cached.timestamp) < maxAge) {
            return Promise.resolve(cached.data);
        }
        
        return fetcher().then(data => {
            this.cache.set(key, { data, timestamp: Date.now() });
            return data;
        });
    }

    // API Endpoints
    async getRealTimePrices(coins = 'bitcoin,ethereum,solana', currencies = 'usd') {
        const key = `prices_${coins}_${currencies}`;
        return this.cached(key, 'prices', () => 
            this.request(`/api/prices/realtime?coins=${coins}&currencies=${currencies}`)
        );
    }

    async getCurrencyRates() {
        return this.cached('rates', 'rates', () => 
            this.request('/api/prices/rates')
        );
    }

    async calculatePortfolio(wallets) {
        return this.request('/api/prices/portfolio/calculate', {
            method: 'POST',
            body: JSON.stringify({ wallets })
        });
    }

    async getTickerData() {
        return this.cached('ticker', 'prices', () => 
            this.request('/api/prices/ticker/data')
        );
    }

    async getWalletData(chain, address) {
        const key = `wallet_${chain}_${address}`;
        return this.cached(key, 'wallet', () => 
            this.request(`/api/wallets/${chain}/${address}`)
        );
    }

    async addWallet(chain, address, name = null) {
        return this.request('/api/wallets/add', {
            method: 'POST',
            body: JSON.stringify({ chain, address, name })
        });
    }

    async getPrices(symbols) {
        const symbolsParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
        const key = `symbols_${symbolsParam}`;
        return this.cached(key, 'prices', () => 
            this.request(`/api/prices/${symbolsParam}`)
        );
    }

    async testConnectivity() {
        return this.request('/api/prices/test/connectivity');
    }

    // Cache Utilities
    clearCache(type = null) {
        if (!type) {
            const count = this.cache.size;
            this.cache.clear();
            return count;
        }
        
        let cleared = 0;
        for (const [key] of this.cache) {
            if (key.startsWith(type)) {
                this.cache.delete(key);
                cleared++;
            }
        }
        return cleared;
    }

    getCacheStats() {
        const now = Date.now();
        const stats = { total: this.cache.size, fresh: 0, stale: 0 };
        
        for (const [key, entry] of this.cache) {
            const type = key.split('_')[0];
            const maxAge = this.cacheDurations[type] || this.cacheDurations.prices;
            const age = now - entry.timestamp;
            
            if (age < maxAge) stats.fresh++;
            else stats.stale++;
        }
        
        return stats;
    }

    // Utilities
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatError(error) {
        if (error.name === 'AbortError') return 'Request timed out';
        if (error.message.includes('Failed to fetch')) return 'Network error';
        if (error.message.includes('HTTP 429')) return 'Rate limit exceeded';
        if (error.message.includes('HTTP 500')) return 'Server error';
        return error.message || 'Unknown error';
    }

    // Auto Cleanup
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [key, entry] of this.cache) {
                const type = key.split('_')[0];
                const maxAge = this.cacheDurations[type] || this.cacheDurations.prices;
                
                if (now - entry.timestamp > maxAge * 2) {
                    this.cache.delete(key);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Auto-cleaned ${cleaned} stale cache entries`);
            }
        }, 5 * 60 * 1000);
    }
}

// Global Instance
const apiManager = new ApiManager();
apiManager.startCleanup();

// Module Export
if (typeof window !== 'undefined') window.apiManager = apiManager;
if (typeof module !== 'undefined' && module.exports) module.exports = apiManager;

console.log('🚀 API Manager loaded');