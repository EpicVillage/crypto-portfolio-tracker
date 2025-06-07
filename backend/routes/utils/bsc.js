// backend/routes/utils/bsc.js - BSC Utility Functions

const axios = require('axios');
const { Web3 } = require('web3');

class BSCUtils {
    constructor() {
        this.web3 = new Web3(process.env.BSC_RPC_URL);
        
        // Price Cache
        this.priceCache = new Map();
        this.PRICE_CACHE_DURATION = 5 * 60 * 1000;
        
        console.log('🚀 BSCUtils initialized - Native BNB + CoinGecko tokens');
    }

    // Known BSC Tokens
    static KNOWN_BSC_TOKENS = {
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': {
            symbol: 'WBNB',
            name: 'Wrapped BNB',
            decimals: 18,
            coingeckoId: 'binancecoin',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/logo.png'
        },
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 18,
            coingeckoId: 'usd-coin',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png'
        },
        '0x55d398326f99059fF775485246999027B3197955': {
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 18,
            coingeckoId: 'tether',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png'
        },
        '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3': {
            symbol: 'DAI',
            name: 'Dai Token',
            decimals: 18,
            coingeckoId: 'dai',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3/logo.png'
        }
    };

    // Address Validation
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }

    // BNB Balance
    async getBNBBalance(address) {
        try {
            const balance = await this.web3.eth.getBalance(address);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error fetching BNB balance:', error);
            return 0;
        }
    }

    // BSC Token Balance
    async getBSCTokenBalance(address, contractAddress, decimals) {
        try {
            const bep20ABI = [
                {
                    constant: true,
                    inputs: [{ name: '_owner', type: 'address' }],
                    name: 'balanceOf',
                    outputs: [{ name: 'balance', type: 'uint256' }],
                    type: 'function'
                }
            ];

            const contract = new this.web3.eth.Contract(bep20ABI, contractAddress);
            const balance = await contract.methods.balanceOf(address).call();
            return parseFloat(balance) / Math.pow(10, decimals);
        } catch (error) {
            console.warn(`Error fetching BSC token balance for ${contractAddress}:`, error.message);
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
    async getAllBSCTokensStreamlined(address) {
        const startTime = Date.now();
        console.log(`🚀 BSC detection for: ${address}`);
        
        const tokens = [];
        let totalValue = 0;

        try {
            // BNB Balance (Always First)
            console.log('💰 Fetching BNB balance...');
            const bnbBalance = await this.getBNBBalance(address);
            const bnbPrice = await this.getCoinGeckoPrice('binancecoin');
            
            const bnbValue = bnbBalance * bnbPrice;
            totalValue += bnbValue;

            tokens.push({
                symbol: 'BNB',
                name: 'BNB',
                balance: parseFloat(bnbBalance).toFixed(9),
                decimals: 18,
                address: 'native',
                price: bnbPrice,
                mint: 'native',
                verified: true,
                value: bnbValue,
                source: 'native',
                logoURI: null
            });
            
            console.log(`✅ BNB: ${parseFloat(bnbBalance).toFixed(6)} BNB ($${bnbValue.toFixed(2)})`);

            // BSC Tokens
            console.log(`🔍 Checking ${Object.keys(BSCUtils.KNOWN_BSC_TOKENS).length} known tokens...`);
            
            let tokensChecked = 0;
            let tokensFound = 0;
            const bscTokens = [];

            for (const [contractAddress, tokenInfo] of Object.entries(BSCUtils.KNOWN_BSC_TOKENS)) {
                tokensChecked++;
                
                try {
                    const balance = await this.getBSCTokenBalance(address, contractAddress, tokenInfo.decimals);
                    
                    if (balance > 0) {
                        const price = await this.getCoinGeckoPrice(tokenInfo.coingeckoId);
                        const tokenValue = balance * price;
                        totalValue += tokenValue;
                        tokensFound++;

                        bscTokens.push({
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

            // Sort and Add BSC Tokens
            bscTokens.sort((a, b) => (b.value || 0) - (a.value || 0));
            tokens.push(...bscTokens);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`\n📊 BSC Results (${processingTime}s):`);
            console.log(`💰 Total Value: $${totalValue.toFixed(2)}`);
            console.log(`🔍 Tokens Checked: ${tokensChecked}`);
            console.log(`💎 Tokens Found: ${tokensFound + 1} (including BNB)`);
            console.log(`🎯 BNB is first token: ${tokens[0].symbol === 'BNB' ? 'YES ✅' : 'NO ❌'}`);

            return {
                tokens,
                address,
                totalValue,
                chain: 'bsc',
                statistics: {
                    tokensChecked: tokensChecked,
                    tokensFound: tokensFound + 1,
                    tokensReturned: tokens.length,
                    processingTimeSeconds: parseFloat(processingTime),
                    averageTokenValue: tokens.length > 0 ? totalValue / tokens.length : 0,
                    largestHolding: tokens.length > 0 ? tokens[0] : null,
                    strategy: 'known-tokens-only',
                    bnbFirst: true
                },
                fetchedAt: new Date().toISOString(),
                cacheInfo: {
                    priceCacheSize: this.priceCache.size,
                    cacheHitRate: 'optimized'
                },
                version: 'v0.2.2.3-bsc'
            };

        } catch (error) {
            console.error('❌ BSC detection error:', error);
            throw new Error(`Failed to fetch BSC wallet data: ${error.message}`);
        }
    }

    // Wallet Summary
    async getWalletSummary(address) {
        try {
            const bnbBalance = await this.getBNBBalance(address);
            const estimatedTokens = Object.keys(BSCUtils.KNOWN_BSC_TOKENS).length;
            
            return {
                address,
                bnbBalance: parseFloat(bnbBalance).toFixed(6),
                estimatedScanTime: '3-6 seconds',
                knownTokensToCheck: estimatedTokens,
                strategy: 'streamlined',
                fetchedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ BSC wallet summary error:', error);
            throw new Error(`Failed to fetch wallet summary: ${error.message}`);
        }
    }

    // API Test
    async testCoinGeckoAPI() {
        try {
            console.log('🧪 Testing CoinGecko API...');
            
            const testPrice = await this.getCoinGeckoPrice('binancecoin');
            
            if (testPrice > 0) {
                return {
                    status: 'success',
                    testPrice: testPrice,
                    message: `CoinGecko API working! BNB price: $${testPrice}`,
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
            knownTokensCount: Object.keys(BSCUtils.KNOWN_BSC_TOKENS).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = BSCUtils;