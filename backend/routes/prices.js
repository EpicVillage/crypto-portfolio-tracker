// backend/routes/prices.js - Price Data API

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Cache Configuration
const cache = new Map();
const CACHE_DURATION = 2 * 60 * 1000;
const RATES_CACHE_DURATION = 5 * 60 * 1000;

// CoinGecko ID Mapping
const COIN_MAP = {
    'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'matic': 'matic-network',
    'bnb': 'binancecoin', 'usdc': 'usd-coin', 'usdt': 'tether', 'dai': 'dai',
    'uni': 'uniswap', 'link': 'chainlink', 'shib': 'shiba-inu'
};

// Cache Helper
function cached(key, duration, fetcher) {
    const entry = cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < duration) {
        return Promise.resolve(entry.data);
    }
    return fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() });
        return data;
    });
}

// Price Fetcher
async function fetchPrices(coinIds, currencies = ['usd']) {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: coinIds.join(','),
                vs_currencies: currencies.join(','),
                include_24hr_change: true,
                include_market_cap: true,
                include_last_updated_at: true
            },
            headers: { 'X-CG-Demo-API-Key': process.env.COINGECKO_API_KEY },
            timeout: 10000
        });

        console.log(`💰 Fetched prices for: ${coinIds.join(', ')}`);
        return response.data;
    } catch (error) {
        console.error('❌ CoinGecko API error:', error.message);
        throw error;
    }
}

// Cross-Currency Rates
function calculateRates(prices) {
    const btc = prices.bitcoin?.usd || 0;
    const eth = prices.ethereum?.usd || 0;
    const sol = prices.solana?.usd || 0;

    if (!btc || !eth || !sol) return {};

    return {
        usd: { eth: 1/eth, sol: 1/sol, btc: 1/btc },
        eth: { usd: eth, sol: eth/sol, btc: eth/btc },
        sol: { usd: sol, eth: sol/eth, btc: sol/btc },
        btc: { usd: btc, eth: btc/eth, sol: btc/sol }
    };
}

// Top 10 Coins Fetcher
async function fetchTop10Coins() {
    try {
        console.log('🔍 Fetching CoinGecko top 10 coins...');
        
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 10,
                page: 1,
                sparkline: false,
                price_change_percentage: '24h'
            },
            headers: process.env.COINGECKO_API_KEY ? { 'X-CG-Demo-API-Key': process.env.COINGECKO_API_KEY } : {},
            timeout: 15000
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('Invalid response format from CoinGecko');
        }

        console.log(`✅ Successfully fetched ${response.data.length} top coins`);
        return response.data;
        
    } catch (error) {
        console.error('❌ Top 10 fetch error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

// Top 10 Coins Endpoint
router.get('/top10', async (req, res) => {
    try {
        const top10Data = await cached('top10_coins', CACHE_DURATION, fetchTop10Coins);
        
        const tickerData = top10Data.map(coin => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price || 0,
            change: coin.price_change_percentage_24h || 0,
            changeText: `${(coin.price_change_percentage_24h || 0) > 0 ? '+' : ''}${(coin.price_change_percentage_24h || 0).toFixed(1)}%`,
            positive: (coin.price_change_percentage_24h || 0) >= 0,
            market_cap: coin.market_cap || 0,
            rank: coin.market_cap_rank || 0,
            image: coin.image || ''
        }));

        res.json({
            success: true,
            top10: tickerData,
            count: tickerData.length,
            fetchedAt: new Date().toISOString(),
            source: 'CoinGecko Markets API',
            cached: cache.has('top10_coins')
        });

    } catch (error) {
        console.error('❌ Top 10 endpoint error:', error.message);
        
        const fallbackCoins = [
            { symbol: 'BTC', name: 'Bitcoin', price: 43500, change: 2.4 },
            { symbol: 'ETH', name: 'Ethereum', price: 2300, change: -1.2 },
            { symbol: 'USDT', name: 'Tether', price: 1.00, change: 0.1 },
            { symbol: 'BNB', name: 'BNB', price: 300, change: 3.1 },
            { symbol: 'SOL', name: 'Solana', price: 90, change: 5.2 },
            { symbol: 'USDC', name: 'USD Coin', price: 1.00, change: 0.0 },
            { symbol: 'XRP', name: 'XRP', price: 0.60, change: 1.8 },
            { symbol: 'ADA', name: 'Cardano', price: 0.45, change: -0.5 },
            { symbol: 'AVAX', name: 'Avalanche', price: 35, change: 2.1 },
            { symbol: 'DOGE', name: 'Dogecoin', price: 0.08, change: 4.2 }
        ].map((coin, index) => ({
            id: coin.symbol.toLowerCase(),
            symbol: coin.symbol,
            name: coin.name,
            price: coin.price,
            change: coin.change,
            changeText: `${coin.change > 0 ? '+' : ''}${coin.change.toFixed(1)}%`,
            positive: coin.change >= 0,
            market_cap: 0,
            rank: index + 1,
            image: ''
        }));

        res.json({
            success: true,
            top10: fallbackCoins,
            count: fallbackCoins.length,
            fetchedAt: new Date().toISOString(),
            source: 'fallback_data',
            error: error.message,
            note: 'Using fallback data due to API error'
        });
    }
});

// Real-time Prices
router.get('/realtime', async (req, res) => {
    try {
        const { coins = 'bitcoin,ethereum,solana', currencies = 'usd' } = req.query;
        const coinsList = coins.split(',').map(coin => COIN_MAP[coin.toLowerCase()] || coin.toLowerCase());
        const currenciesList = currencies.split(',');

        const prices = await cached(`realtime_${coinsList.join(',')}_${currenciesList.join(',')}`, CACHE_DURATION, 
            () => fetchPrices(coinsList, currenciesList)
        );

        const crossRates = calculateRates(prices);
        cache.set('rates', { data: crossRates, timestamp: Date.now() });

        res.json({
            success: true,
            prices,
            crossRates,
            fetchedAt: new Date().toISOString(),
            source: 'CoinGecko API'
        });
    } catch (error) {
        console.error('❌ Real-time prices error:', error);
        res.status(500).json({ error: 'Failed to fetch real-time prices', details: error.message });
    }
});

// Currency Rates
router.get('/rates', async (req, res) => {
    try {
        const rates = await cached('rates', RATES_CACHE_DURATION, async () => {
            const prices = await fetchPrices(['bitcoin', 'ethereum', 'solana']);
            return calculateRates(prices);
        });

        res.json({
            success: true,
            rates,
            source: cache.get('rates')?.timestamp > Date.now() - CACHE_DURATION ? 'cache' : 'CoinGecko API',
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Currency rates error:', error);
        res.status(500).json({ error: 'Failed to fetch currency rates', details: error.message });
    }
});

// Specific Symbol Prices
router.get('/:symbols', async (req, res) => {
    try {
        const symbols = req.params.symbols.toLowerCase().split(',');
        const coinIds = symbols.map(symbol => COIN_MAP[symbol] || symbol);

        const prices = await cached(`symbols_${symbols.join(',')}`, CACHE_DURATION, 
            () => fetchPrices(coinIds)
        );

        const mappedPrices = {};
        symbols.forEach((symbol, index) => {
            const coinId = coinIds[index];
            if (prices[coinId]) {
                mappedPrices[symbol] = prices[coinId];
            }
        });

        res.json({
            success: true,
            prices: mappedPrices,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Price fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch prices', details: error.message });
    }
});

// Portfolio Value Calculator
router.post('/portfolio/calculate', async (req, res) => {
    try {
        const { wallets } = req.body;
        if (!Array.isArray(wallets)) {
            return res.status(400).json({ error: 'Wallets array required' });
        }

        const allCoins = new Set();
        wallets.forEach(wallet => {
            wallet.tokens?.forEach(token => {
                const coinId = COIN_MAP[token.symbol?.toLowerCase()] || token.coingeckoId;
                if (coinId) allCoins.add(coinId);
            });
        });

        const prices = await fetchPrices(Array.from(allCoins));
        const crossRates = calculateRates(prices);

        const calculatedWallets = wallets.map(wallet => {
            let totalValue = 0;
            const updatedTokens = wallet.tokens?.map(token => {
                const coinId = COIN_MAP[token.symbol?.toLowerCase()] || token.coingeckoId;
                const priceData = prices[coinId];
                const currentPrice = priceData?.usd || 0;
                const balance = parseFloat(token.balance) || 0;
                const tokenValue = balance * currentPrice;
                totalValue += tokenValue;

                return {
                    ...token,
                    price: currentPrice,
                    value: tokenValue,
                    change24h: priceData?.usd_24h_change || 0
                };
            }) || [];

            return { ...wallet, tokens: updatedTokens, totalValue, lastUpdated: new Date().toISOString() };
        });

        const totalPortfolioValue = calculatedWallets.reduce((sum, wallet) => sum + wallet.totalValue, 0);

        res.json({
            success: true,
            portfolio: {
                wallets: calculatedWallets,
                totalValue: totalPortfolioValue,
                walletCount: calculatedWallets.length,
                crossRates,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Portfolio calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate portfolio value', details: error.message });
    }
});

// Ticker Data
router.get('/ticker/data', async (req, res) => {
    try {
        console.log('🎯 Ticker data requested');
        
        try {
            const response = await fetch(`${req.protocol}://${req.get('host')}/api/prices/top10`);
            const top10Response = await response.json();
            
            if (top10Response.success && top10Response.top10) {
                console.log('✅ Using top 10 data for ticker');
                return res.json({
                    success: true,
                    ticker: top10Response.top10,
                    fetchedAt: new Date().toISOString(),
                    source: 'top10_live'
                });
            }
        } catch (error) {
            console.warn('⚠️ Top 10 internal call failed:', error.message);
        }
        
        console.log('🔄 Using fallback ticker method');
        const tickerCoins = ['bitcoin', 'ethereum', 'solana', 'matic-network', 'uniswap', 'chainlink'];
        const prices = await cached('ticker_fallback', CACHE_DURATION, () => fetchPrices(tickerCoins));

        const symbolMap = {
            'bitcoin': 'BTC', 'ethereum': 'ETH', 'solana': 'SOL',
            'matic-network': 'MATIC', 'uniswap': 'UNI', 'chainlink': 'LINK'
        };

        const tickerData = Object.entries(prices).map(([coinId, data]) => ({
            symbol: symbolMap[coinId] || coinId.toUpperCase(),
            price: data.usd || 0,
            change: data.usd_24h_change || 0,
            changeText: `${(data.usd_24h_change || 0) > 0 ? '+' : ''}${(data.usd_24h_change || 0).toFixed(1)}%`,
            positive: (data.usd_24h_change || 0) >= 0,
            rank: null
        }));

        res.json({ 
            success: true, 
            ticker: tickerData, 
            fetchedAt: new Date().toISOString(),
            source: 'fallback_coins'
        });
        
    } catch (error) {
        console.error('❌ Ticker data error:', error);
        
        const ultimateFallback = [
            { symbol: 'BTC', price: 43500, change: 2.4, changeText: '+2.4%', positive: true },
            { symbol: 'ETH', price: 2300, change: -1.2, changeText: '-1.2%', positive: false },
            { symbol: 'SOL', price: 90, change: 5.2, changeText: '+5.2%', positive: true },
            { symbol: 'MATIC', price: 0.80, change: 1.8, changeText: '+1.8%', positive: true },
            { symbol: 'UNI', price: 12, change: -0.5, changeText: '-0.5%', positive: false },
            { symbol: 'LINK', price: 15, change: 3.1, changeText: '+3.1%', positive: true }
        ];
        
        res.json({ 
            success: true, 
            ticker: ultimateFallback, 
            fetchedAt: new Date().toISOString(),
            source: 'ultimate_fallback',
            error: error.message
        });
    }
});

// Cache Management
router.delete('/cache', (req, res) => {
    const size = cache.size;
    cache.clear();
    res.json({
        success: true,
        message: 'Cache cleared',
        cleared: size,
        timestamp: new Date().toISOString()
    });
});

// API Connectivity Test
router.get('/test/connectivity', async (req, res) => {
    try {
        const testCoins = ['bitcoin', 'ethereum', 'solana'];
        const prices = await fetchPrices(testCoins);

        const results = {};
        testCoins.forEach(coin => {
            const data = prices[coin];
            results[coin] = data ? {
                status: '✅ Working',
                price: data.usd,
                change24h: data.usd_24h_change
            } : {
                status: '❌ No data'
            };
        });

        let top10Status;
        try {
            await fetchTop10Coins();
            top10Status = '✅ Working';
        } catch (error) {
            top10Status = `❌ Failed: ${error.message}`;
        }

        res.json({
            success: true,
            coingecko_api: 'Connected',
            top10_endpoint: top10Status,
            api_key: process.env.COINGECKO_API_KEY ? 'Configured' : 'Missing',
            test_results: results,
            cache_size: cache.size,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Connectivity test error:', error);
        res.status(500).json({ success: false, error: 'Connectivity test failed', details: error.message });
    }
});

module.exports = router;