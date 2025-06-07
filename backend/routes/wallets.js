// backend/routes/wallets.js - Multi-Chain Wallet API

const express = require('express');
const axios = require('axios');

const SolanaUtils = require('./utils/solana');
const EthereumUtils = require('./utils/ethereum');
const PolygonUtils = require('./utils/polygon');
const BSCUtils = require('./utils/bsc');

const router = express.Router();

// Chain Utilities
const chainUtils = {
    ethereum: new EthereumUtils(),
    polygon: new PolygonUtils(),
    bsc: new BSCUtils(),
    solana: new SolanaUtils()
};

// Chain Configuration
const chainConfig = {
    ethereum: { name: 'Ethereum', method: 'getAllERC20TokensStreamlined', tokenClass: 'EthereumUtils' },
    polygon: { name: 'Polygon', method: 'getAllPolygonTokensStreamlined', tokenClass: 'PolygonUtils' },
    bsc: { name: 'BSC', method: 'getAllBSCTokensStreamlined', tokenClass: 'BSCUtils' },
    solana: { name: 'Solana', method: 'getAllSPLTokensStreamlined', tokenClass: 'SolanaUtils' }
};

// Unified Wallet Handler
async function handleWalletRequest(req, res, chain) {
    try {
        const address = req.params.address;
        const utils = chainUtils[chain];
        const config = chainConfig[chain];

        if (!utils.isValidAddress(address)) {
            return res.status(400).json({ error: `Invalid ${config.name} address` });
        }

        console.log(`🚀 ${config.name} detection: ${address}`);
        
        const result = await utils[config.method](address);
        
        if (result?.tokens) {
            res.json(result);
        } else {
            throw new Error(`Invalid response from ${config.name} utilities`);
        }

    } catch (error) {
        console.error(`❌ ${chainConfig[chain].name} wallet error:`, error);
        res.status(500).json({ 
            error: `Failed to fetch ${chainConfig[chain].name} wallet data`,
            details: error.message,
            address: req.params.address,
            timestamp: new Date().toISOString()
        });
    }
}

// Dynamic Route Creation
Object.keys(chainConfig).forEach(chain => {
    router.get(`/${chain}/:address`, (req, res) => handleWalletRequest(req, res, chain));
    
    router.get(`/${chain}/:address/summary`, async (req, res) => {
        try {
            const address = req.params.address;
            const utils = chainUtils[chain];
            
            if (!utils.isValidAddress(address)) {
                return res.status(400).json({ error: `Invalid ${chainConfig[chain].name} address` });
            }
            
            const summary = await utils.getWalletSummary(address);
            res.json(summary);
        } catch (error) {
            console.error(`❌ ${chainConfig[chain].name} summary error:`, error);
            res.status(500).json({ error: 'Failed to fetch wallet summary', details: error.message });
        }
    });
    
    router.get(`/${chain}/tokens/list`, (req, res) => {
        try {
            const tokenClass = chainConfig[chain].tokenClass;
            const knownTokens = eval(`${tokenClass}.KNOWN_${chain.toUpperCase()}_TOKENS`) || 
                               eval(`${tokenClass}.KNOWN_ERC20_TOKENS`) ||
                               eval(`${tokenClass}.KNOWN_SPL_TOKENS`);
            
            const tokensList = Object.entries(knownTokens).map(([key, tokenInfo]) => ({
                [chain === 'solana' ? 'mintAddress' : 'address']: key,
                ...tokenInfo
            }));

            res.json({
                message: `Known ${chainConfig[chain].name} tokens`,
                totalTokens: tokensList.length,
                tokens: tokensList,
                strategy: 'CoinGecko-listed tokens only',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ ${chainConfig[chain].name} token list error:`, error);
            res.status(500).json({ error: 'Failed to get token list' });
        }
    });
    
    router.get(`/${chain}/test/coingecko`, async (req, res) => {
        try {
            const testResult = await chainUtils[chain].testCoinGeckoAPI();
            res.json({ message: `${chainConfig[chain].name} CoinGecko API test completed`, ...testResult });
        } catch (error) {
            console.error(`❌ ${chainConfig[chain].name} CoinGecko test error:`, error);
            res.status(500).json({ error: 'Failed to test CoinGecko API', details: error.message });
        }
    });
    
    router.get(`/${chain}/status`, async (req, res) => {
        try {
            const utils = chainUtils[chain];
            const coinGeckoTest = await utils.testCoinGeckoAPI();
            const cacheStats = utils.getCacheStats();
            
            const tokenClass = chainConfig[chain].tokenClass;
            const knownTokens = eval(`${tokenClass}.KNOWN_${chain.toUpperCase()}_TOKENS`) || 
                               eval(`${tokenClass}.KNOWN_ERC20_TOKENS`) ||
                               eval(`${tokenClass}.KNOWN_SPL_TOKENS`);
            
            res.json({
                message: `${chainConfig[chain].name} system status`,
                version: 'v0.4.0-streamlined',
                strategy: `Native ${chainConfig[chain].name.toUpperCase()} + CoinGecko-listed tokens only`,
                performance: {
                    expectedSpeed: chain === 'solana' ? '3-8 seconds' : '3-6 seconds',
                    tokensChecked: Object.keys(knownTokens).length,
                    priceSource: 'CoinGecko only',
                    reliability: '99%+'
                },
                apiStatus: { coinGecko: coinGeckoTest.status },
                cache: cacheStats,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ ${chainConfig[chain].name} status error:`, error);
            res.status(500).json({ error: 'Failed to get system status' });
        }
    });
});

// Wallet Addition
router.post('/add', async (req, res) => {
    try {
        const { address, chain, name } = req.body;

        if (!address || !chain) {
            return res.status(400).json({ error: 'Address and chain are required' });
        }

        const utils = chainUtils[chain];
        if (!utils || !utils.isValidAddress(address)) {
            return res.status(400).json({ error: 'Invalid wallet address for specified chain' });
        }

        const testResult = await axios.get(`${req.protocol}://${req.get('host')}/api/wallets/${chain}/${address}`);
        
        if (!testResult?.data) {
            return res.status(400).json({ error: 'Failed to connect to wallet' });
        }

        res.json({
            success: true,
            wallet: {
                address,
                chain,
                name: name || `${chainConfig[chain].name} Wallet`,
                tokens: testResult.data.tokens
            }
        });

    } catch (error) {
        console.error('Add wallet error:', error);
        res.status(500).json({ error: 'Failed to add wallet' });
    }
});

// Cache Management
router.delete('/cache/clear', (req, res) => {
    try {
        const results = {};
        Object.keys(chainConfig).forEach(chain => {
            results[chain] = chainUtils[chain].clearCaches();
        });
        
        res.json({
            message: 'All caches cleared',
            ...results
        });
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

router.get('/cache/stats', (req, res) => {
    try {
        const stats = {};
        Object.keys(chainConfig).forEach(chain => {
            stats[chain] = chainUtils[chain].getCacheStats();
        });
        
        res.json({
            message: 'Cache statistics for all chains',
            ...stats
        });
    } catch (error) {
        console.error('❌ Cache stats error:', error);
        res.status(500).json({ error: 'Failed to get cache stats' });
    }
});

// Global System Status
router.get('/status/all', async (req, res) => {
    try {
        const allChains = Object.keys(chainConfig);
        const status = {
            message: 'Multi-chain wallet system status',
            version: 'v0.4.0-streamlined-multichain',
            totalChains: allChains.length,
            chains: {}
        };

        for (const chain of allChains) {
            try {
                const utils = chainUtils[chain];
                const apiTest = await utils.testCoinGeckoAPI();
                const cacheStats = utils.getCacheStats();

                const tokenClass = chainConfig[chain].tokenClass;
                const knownTokens = eval(`${tokenClass}.KNOWN_${chain.toUpperCase()}_TOKENS`) || 
                                   eval(`${tokenClass}.KNOWN_ERC20_TOKENS`) ||
                                   eval(`${tokenClass}.KNOWN_SPL_TOKENS`);

                status.chains[chain] = {
                    apiStatus: apiTest.status,
                    tokensSupported: Object.keys(knownTokens).length,
                    cacheSize: cacheStats.prices?.size || 0,
                    strategy: 'streamlined-coingecko-only'
                };
            } catch (error) {
                status.chains[chain] = {
                    apiStatus: 'error',
                    error: error.message
                };
            }
        }

        res.json(status);
    } catch (error) {
        console.error('❌ Global status error:', error);
        res.status(500).json({ error: 'Failed to get global system status' });
    }
});

module.exports = router;