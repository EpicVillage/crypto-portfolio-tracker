// config/config.js - Application Configuration

const CONFIG = {
    // Application Settings
    APP: {
        NAME: 'Crypto Portfolio Tracker',
        VERSION: '2.1-streamlined',
        THEME: 'dark',
        CURRENCY: 'usd'
    },

    // API Configuration
    API: {
        BASE_URL: window.location.origin,
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        
        ENDPOINTS: {
            WALLETS: '/api/wallets',
            PRICES: '/api/prices',
            RATES: '/api/prices/rates',
            TICKER: '/api/prices/ticker/data'
        },

        UPDATE_INTERVALS: {
            RATES: 5 * 60 * 1000,
            PORTFOLIO: 2 * 60 * 1000,
            TICKER: 30 * 1000
        }
    },

    // Blockchain Networks
    CHAINS: {
        ethereum: { symbol: 'ETH', name: 'Ethereum', chainId: '0x1', color: '#627eea', wallet: 'metamask', coingeckoId: 'ethereum' },
        solana: { symbol: 'SOL', name: 'Solana', color: '#9945ff', wallet: 'phantom', coingeckoId: 'solana' },
        polygon: { symbol: 'MATIC', name: 'Polygon', chainId: '0x89', color: '#8247e5', wallet: 'metamask', coingeckoId: 'matic-network' },
        bsc: { symbol: 'BNB', name: 'BSC', chainId: '0x38', color: '#f3ba2f', wallet: 'metamask', coingeckoId: 'binancecoin' }
    },

    // Token Definitions
    TOKENS: {
        ethereum: [
            { address: '0xA0b86a33E6E4e8F6C9fAE7E5Ca4404b7f5d61A9e', symbol: 'USDC', decimals: 6, coingeckoId: 'usd-coin' },
            { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, coingeckoId: 'tether' },
            { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, coingeckoId: 'dai' }
        ],
        solana: [
            { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6, coingeckoId: 'usd-coin' },
            { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', decimals: 6, coingeckoId: 'tether' }
        ]
    },

    // Cache Settings
    CACHE: {
        PRICE_DATA: 2 * 60 * 1000,
        WALLET_DATA: 30 * 1000,
        CURRENCY_RATES: 5 * 60 * 1000
    },

    // Storage Keys
    STORAGE: {
        WALLETS: 'crypto_portfolio_wallets_v5',
        THEME: 'crypto_portfolio_theme',
        CURRENCY: 'crypto_portfolio_currency'
    },

    // UI Configuration
    UI: {
        THEMES: ['dark', 'light'],
        CURRENCIES: ['usd', 'eth', 'sol', 'btc'],
        CHART_COLORS: ['#FF6B35', '#9945FF', '#27AE60', '#3498DB', '#E74C3C', '#F39C12'],
        TICKER_SPEED: 30000,
        MESSAGE_DURATION: 3000
    },

    // Price Mapping
    PRICE_MAP: {
        'eth': 'ethereum', 'btc': 'bitcoin', 'sol': 'solana', 'matic': 'matic-network',
        'bnb': 'binancecoin', 'usdc': 'usd-coin', 'usdt': 'tether', 'dai': 'dai'
    },

    // Validation Patterns
    VALIDATION: {
        ETH_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
        SOL_ADDRESS_MIN: 32,
        SOL_ADDRESS_MAX: 44
    },

    // Feature Flags
    FEATURES: {
        REALTIME_PRICING: true,
        CURRENCY_CONVERSION: true,
        PORTFOLIO_TRACKING: true,
        AUTO_REFRESH: true
    },

    // Environment Settings
    ENV: {
        DEBUG: true,
        VERBOSE_LOGGING: true
    }
};

// Utility Functions
CONFIG.UTILS = {
    chain: (name) => CONFIG.CHAINS[name?.toLowerCase()],
    tokens: (chain) => CONFIG.TOKENS[chain?.toLowerCase()] || [],
    endpoint: (path) => CONFIG.API.BASE_URL + CONFIG.API.ENDPOINTS[path?.toUpperCase()],
    coinId: (symbol) => CONFIG.PRICE_MAP[symbol?.toLowerCase()] || symbol?.toLowerCase(),
    validEthAddress: (addr) => CONFIG.VALIDATION.ETH_ADDRESS.test(addr),
    validSolAddress: (addr) => addr?.length >= CONFIG.VALIDATION.SOL_ADDRESS_MIN && addr?.length <= CONFIG.VALIDATION.SOL_ADDRESS_MAX,
    
    formatCurrency: (value, currency = 'usd') => {
        if (!value) return currency === 'usd' ? '$0.00' : '0';
        const decimals = currency === 'usd' ? 2 : currency === 'btc' ? 6 : 4;
        const formatted = Number(value).toFixed(decimals);
        return currency === 'usd' ? `$${formatted}` : `${formatted} ${currency.toUpperCase()}`;
    },
    
    feature: (name) => CONFIG.FEATURES[`${name.toUpperCase()}`] || false,
    interval: (type) => CONFIG.API.UPDATE_INTERVALS[type?.toUpperCase()] || CONFIG.API.UPDATE_INTERVALS.PORTFOLIO
};

// Module Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}

// Development Logging
if (CONFIG.ENV.DEBUG) {
    console.log('⚡ Configuration loaded');
    console.log(`🎯 Supported chains: ${Object.keys(CONFIG.CHAINS).join(', ')}`);
    console.log(`💰 Available currencies: ${CONFIG.UI.CURRENCIES.join(', ')}`);
    console.log(`🔄 Update intervals: ${JSON.stringify(CONFIG.API.UPDATE_INTERVALS)}`);
}