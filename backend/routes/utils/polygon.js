// backend/routes/utils/polygon.js - Polygon Utility Functions

const axios = require('axios');
const { Web3 } = require('web3');

class PolygonUtils {
    constructor() {
        this.web3 = new Web3(process.env.POLYGON_RPC_URL);
        
        // Price Cache
        this.priceCache = new Map();
        this.PRICE_CACHE_DURATION = 5 * 60 * 1000;
        
        console.log('🚀 PolygonUtils initialized - Native MATIC + CoinGecko tokens');
    }

    // Known Polygon Tokens
    static KNOWN_POLYGON_TOKENS = {
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': {
            symbol: 'WMATIC',
            name: 'Wrapped Matic',
            decimals: 18,
            coingeckoId: 'matic-network',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png'
        },
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': {
            symbol: 'USDC',
            name: 'USD Coin (PoS)',
            decimals: 6,
            coingeckoId: 'usd-coin',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/logo.png'
        },
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': {
            symbol: 'USDT',
            name: 'Tether USD (PoS)',
            decimals: 6,
            coingeckoId: 'tether',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png'
        },
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063': {
            symbol: 'DAI',
            name: 'Dai Stablecoin (PoS)',
            decimals: 18,
            coingeckoId: 'dai',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063/logo.png'
        }
    };

    // Address Validation
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }

    // MATIC Balance
    async getMATICBalance(address) {
        try {
            const balance = await this.web3.eth.getBalance(address);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error fetching MATIC balance:', error);
            return 0;
        }
    }

    // Polygon Token Balance
    async getPolygonTokenBalance(address, contractAddress, decimals) {
        try {
            const erc20ABI = [
                {
                    constant: true,
                    inputs: [{ name: '_owner', type: 'address' }],
                    name: 'balanceOf',
                    outputs: [{ name: 'balance', type: 'uint256' }],
                    type: 'function'
                }
            ];

            const contract = new this.web3.eth.Contract(erc20ABI, contractAddress);
            const balance = await contract.methods.balanceOf(address).call();
            return parseFloat(balance) / Math.pow(10, decimals);
        } catch (error) {
            console.warn(`Error fetching Polygon token balance for ${contractAddress}:`, error.message);
            return 0;
        }
    }

    // CoinGecko Price Fetcher
    async getCoinGeckoPrice(coingeckoId) {
        const cached = this.priceCache.get(coingeckoId);
        if (cached && (Date.now() - cached.timestamp) < this.PRICE_CACHE_DURATION) {
            return cached.price;
        }

        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: coingeckoId,
                    vs_currencies: 'usd'
                },
                headers: {
                    'X-CG-Demo-API-Key': process.env.COINGECKO_API_KEY
                },
                timeout: 10000
            });

            const price = response.data[coingeckoId]?.usd || 0;
            this.priceCache.set(coingeckoId, {
                price,
                timestamp: Date.now()
            });

            return price;
        } catch (error) {
            console.warn(`CoinGecko price fetch failed for ${coingeckoId}:`, error.message);
            return 0;
        }
    }

    // Main Token Detection
    async getAllPolygonTokensStreamlined(address) {
        const startTime = Date.now();
        console.log(`🚀 Polygon detection for: ${address}`);
        
        const tokens = [];
        let totalValue = 0;

        try {
            // MATIC Balance (Always First)
            console.log('💰 Fetching MATIC balance...');
            const maticBalance = await this.getMATICBalance(address);
            const maticPrice = await this.getCoinGeckoPrice('matic-network');
            
            const maticValue = maticBalance * maticPrice;
            totalValue += maticValue;

            tokens.push({
                symbol: 'MATIC',
                name: 'Polygon',
                balance: parseFloat(maticBalance).toFixed(9),
                decimals: 18,
                address: 'native',
                price: maticPrice,
                mint: 'native',
                verified: true,
                value: maticValue,
                source: 'native',
                logoURI: null
            });
            
            console.log(`✅ MATIC: ${parseFloat(maticBalance).toFixed(6)} MATIC ($${maticValue.toFixed(2)})`);

            // Polygon Tokens
            console.log(`🔍 Checking ${Object.keys(PolygonUtils.KNOWN_POLYGON_TOKENS).length} known tokens...`);
            
            let tokensChecked = 0;
            let tokensFound = 0;
            const polygonTokens = [];

            for (const [contractAddress, tokenInfo] of Object.entries(PolygonUtils.KNOWN_POLYGON_TOKENS)) {
                tokensChecked++;
                
                try {
                    const balance = await this.getPolygonTokenBalance(address, contractAddress, tokenInfo.decimals);
                    
                    if (balance > 0) {
                        const price = await this.getCoinGeckoPrice(tokenInfo.coingeckoId);
                        const tokenValue = balance * price;
                        totalValue += tokenValue;
                        tokensFound++;

                        polygonTokens.push({
                            symbol: tokenInfo.symbol,
                            name: tokenInfo.name,
                            balance: balance.toFixed(tokenInfo.decimals),
                            decimals: tokenInfo.decimals,
                            address: contractAddress,
                            price: price,
                            mint: contractAddress,
                            verified: true,
                            value: tokenValue,
                            source: 'coingecko-listed',
                            logoURI: tokenInfo.logoURI,
                            coingeckoId: tokenInfo.coingeckoId
                        });

                        console.log(`✅ ${tokenInfo.symbol}: ${balance.toFixed(4)} ($${tokenValue.toFixed(2)})`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.warn(`⚠️ Error checking ${tokenInfo.symbol}:`, error.message);
                }
            }

            // Sort and Add Polygon Tokens
            polygonTokens.sort((a, b) => (b.value || 0) - (a.value || 0));
            tokens.push(...polygonTokens);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`\n📊 Polygon Results (${processingTime}s):`);
            console.log(`💰 Total Value: $${totalValue.toFixed(2)}`);
            console.log(`🔍 Tokens Checked: ${tokensChecked}`);
            console.log(`💎 Tokens Found: ${tokensFound + 1} (including MATIC)`);
            console.log(`🎯 MATIC is first token: ${tokens[0].symbol === 'MATIC' ? 'YES ✅' : 'NO ❌'}`);

            return {
                tokens,
                address,
                totalValue,
                chain: 'polygon',
                statistics: {
                    tokensChecked: tokensChecked,
                    tokensFound: tokensFound + 1,
                    tokensReturned: tokens.length,
                    processingTimeSeconds: parseFloat(processingTime),
                    averageTokenValue: tokens.length > 0 ? totalValue / tokens.length : 0,
                    largestHolding: tokens.length > 0 ? tokens[0] : null,
                    strategy: 'known-tokens-only',
                    maticFirst: true
                },
                fetchedAt: new Date().toISOString(),
                cacheInfo: {
                    priceCacheSize: this.priceCache.size,
                    cacheHitRate: 'optimized'
                },
                version: 'v0.2.2.3-polygon'
            };

        } catch (error) {
            console.error('❌ Polygon detection error:', error);
            throw new Error(`Failed to fetch Polygon wallet data: ${error.message}`);
        }
    }

    // Wallet Summary
    async getWalletSummary(address) {
        try {
            const maticBalance = await this.getMATICBalance(address);
            const estimatedTokens = Object.keys(PolygonUtils.KNOWN_POLYGON_TOKENS).length;
            
            return {
                address,
                maticBalance: parseFloat(maticBalance).toFixed(6),
                estimatedScanTime: '3-6 seconds',
                knownTokensToCheck: estimatedTokens,
                strategy: 'streamlined',
                fetchedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Polygon wallet summary error:', error);
            throw new Error(`Failed to fetch wallet summary: ${error.message}`);
        }
    }

    // API Test
    async testCoinGeckoAPI() {
        try {
            console.log('🧪 Testing CoinGecko API...');
            
            const testPrice = await this.getCoinGeckoPrice('matic-network');
            
            if (testPrice > 0) {
                return {
                    status: 'success',
                    testPrice: testPrice,
                    message: `CoinGecko API working! MATIC price: $${testPrice}`,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error('No price data returned');
            }
        } catch (error) {
            return {
                status: 'failed',
                error: error.message,
                message: 'CoinGecko API test failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    // Cache Management
    clearCaches() {
        const priceSize = this.priceCache.size;
        this.priceCache.clear();
        
        return {
            priceEntriesCleared: priceSize,
            message: 'Cache cleared',
            timestamp: new Date().toISOString()
        };
    }

    getCacheStats() {
        return {
            prices: {
                size: this.priceCache.size,
                cacheDuration: this.PRICE_CACHE_DURATION
            },
            strategy: 'simple-cache',
            knownTokensCount: Object.keys(PolygonUtils.KNOWN_POLYGON_TOKENS).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = PolygonUtils;