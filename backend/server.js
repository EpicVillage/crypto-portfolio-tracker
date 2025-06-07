// backend/server.js - Express Server

const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static File Serving
app.use(express.static(path.join(__dirname, '..')));
app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));

// Main Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Route Imports
const walletRoutes = require('./routes/wallets');
const priceRoutes = require('./routes/prices');

// API Routes
app.use('/api/wallets', walletRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/wallet', walletRoutes);

// Basic API Test
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        routes: {
            wallets_new: '/api/wallets',
            wallets_old: '/api/wallet (deprecated)',
            prices: '/api/prices'
        },
        server_structure: 'Using modular routes'
    });
});

// External API Testing
app.get('/api/test-apis', async (req, res) => {
    const results = {
        infura: 'Not tested',
        coingecko: 'Not tested',
        solana: 'Not tested'
    };
    
    try {
        const priceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
            headers: {
                'X-CG-Demo-API-Key': process.env.COINGECKO_API_KEY
            }
        });
        if (priceResponse.data.ethereum) {
            results.coingecko = `✅ Working - ETH price: $${priceResponse.data.ethereum.usd}`;
        }
    } catch (error) {
        results.coingecko = `❌ Error: ${error.message}`;
    }
    
    try {
        const ethResponse = await axios.post(process.env.ETHEREUM_RPC_URL, {
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
        });
        if (ethResponse.data.result) {
            results.infura = `✅ Working - Latest block: ${parseInt(ethResponse.data.result, 16)}`;
        }
    } catch (error) {
        results.infura = `❌ Error: ${error.message}`;
    }
    
    try {
        const solResponse = await axios.post(process.env.SOLANA_RPC_URL, {
            jsonrpc: '2.0',
            method: 'getHealth',
            id: 1
        });
        if (solResponse.data.result === 'ok') {
            results.solana = '✅ Working - Solana RPC healthy';
        }
    } catch (error) {
        results.solana = `❌ Error: ${error.message}`;
    }
    
    res.json(results);
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: require('../package.json').version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Documentation
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'Crypto Portfolio Tracker API',
        version: '1.0.0',
        endpoints: {
            wallet_routes: {
                'GET /api/wallets/ethereum/:address': 'Get Ethereum wallet tokens',
                'GET /api/wallets/solana/:address': 'Get Solana wallet tokens',
                'POST /api/wallets/add': 'Add wallet manually'
            },
            price_routes: {
                'GET /api/prices/:symbols': 'Get token prices (comma-separated)',
                'GET /api/prices/test/connectivity': 'Test price API connectivity',
                'GET /api/prices/trending/coins': 'Get trending coins',
                'GET /api/prices/market-data/:symbol': 'Get detailed market data',
                'DELETE /api/prices/cache': 'Clear price cache'
            },
            system_routes: {
                'GET /api/test': 'Basic API test',
                'GET /api/test-apis': 'Test all external APIs',
                'GET /api/health': 'Health check',
                'GET /api/docs': 'This documentation'
            }
        },
        examples: {
            wallet: '/api/wallets/ethereum/0x742d35Cc6CbC4532379a8a3c4E68D50F3c84B2f7',
            prices: '/api/prices/ethereum,bitcoin,solana',
            trending: '/api/prices/trending/coins'
        }
    });
});

// Error Handling
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        path: req.path,
        method: req.method,
        suggestion: 'Check /api/docs for available endpoints'
    });
});

// Server Start
app.listen(PORT, () => {
    console.log(`🚀 Crypto Portfolio Tracker Server running on http://localhost:${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`🔧 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`💰 Wallet API: http://localhost:${PORT}/api/wallets`);
    console.log(`💱 Price API: http://localhost:${PORT}/api/prices`);
    console.log(`🧪 API Tests: http://localhost:${PORT}/api/test-apis`);
    console.log(`✨ Using modular route structure!`);
});

module.exports = app;