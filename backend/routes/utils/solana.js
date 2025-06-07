// backend/routes/utils/solana.js - Solana Utility Functions

const axios = require('axios');

class SolanaUtils {
    constructor() {
        this.rpcUrl = process.env.SOLANA_RPC_URL;
        
        // Price Cache
        this.priceCache = new Map();
        this.PRICE_CACHE_DURATION = 5 * 60 * 1000;
        
        console.log('🚀 SolanaUtils initialized - Native SOL + CoinGecko tokens');
    }

    // Known SPL Tokens
    static KNOWN_SPL_TOKENS = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            coingeckoId: 'usd-coin',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
        },
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            coingeckoId: 'tether',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
        },
        'So11111111111111111111111111111111111111112': {
            symbol: 'SOL',
            name: 'Wrapped SOL',
            decimals: 9,
            coingeckoId: 'solana',
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
        }
    };

    // Address Validation
    isValidAddress(address) {
        return address && address.length >= 32 && address.length <= 44;
    }

    // SOL Balance
    async getSOLBalance(address) {
        try {
            const response = await axios.post(this.rpcUrl, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [address]
            }, { timeout: 10000 });

            if (response.data.result) {
                return response.data.result.value / 1000000000;
            }
            return 0;
        } catch (error) {
            console.error('Error fetching SOL balance:', error);
            return 0;
        }
    }

    // SPL Token Balance
    async getSPLTokenBalance(address, mintAddress) {
        try {
            const response = await axios.post(this.rpcUrl, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenAccountsByOwner',
                params: [
                    address,
                    { mint: mintAddress },
                    { encoding: 'jsonParsed' }
                ]
            }, { timeout: 10000 });

            if (response.data.result?.value?.length > 0) {
                const tokenAccount = response.data.result.value[0];
                const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
                return parseFloat(tokenAmount.uiAmount) || 0;
            }
            return 0;
        } catch (error) {
            console.warn(`Error fetching SPL token balance for ${mintAddress}:`, error.message);
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
    async getAllSPLTokensStreamlined(address) {
        const startTime = Date.now();
        console.log(`🚀 Solana detection for: ${address}`);
        
        const tokens = [];
        let totalValue = 0;

        try {
            // SOL Balance (Always First)
            console.log('💰 Fetching SOL balance...');
            const solBalance = await this.getSOLBalance(address);
            const solPrice = await this.getCoinGeckoPrice('solana');
            
            const solValue = solBalance * solPrice;
            totalValue += solValue;

            tokens.push({
                symbol: 'SOL',
                name: 'Solana',
                balance: solBalance.toFixed(9),
                decimals: 9,
                address: 'native',
                price: solPrice,
                mint: 'native',
                verified: true,
                value: solValue,
                source: 'native',
                logoURI: null
            });
            
            console.log(`✅ SOL: ${solBalance.toFixed(6)} SOL ($${solValue.toFixed(2)})`);

            // SPL Tokens
            console.log(`🔍 Checking ${Object.keys(SolanaUtils.KNOWN_SPL_TOKENS).length} known tokens...`);
            
            let tokensChecked = 0;
            let tokensFound = 0;
            const splTokens = [];

            for (const [mintAddress, tokenInfo] of Object.entries(SolanaUtils.KNOWN_SPL_TOKENS)) {
                tokensChecked++;
                
                try {
                    const balance = await this.getSPLTokenBalance(address, mintAddress);
                    
                    if (balance > 0) {
                        const price = await this.getCoinGeckoPrice(tokenInfo.coingeckoId);
                        const tokenValue = balance * price;
                        totalValue += tokenValue;
                        tokensFound++;

                        splTokens.push({
                            symbol: tokenInfo.symbol,
                            name: tokenInfo.name,
                            balance: balance.toFixed(tokenInfo.decimals),
                            decimals: tokenInfo.decimals,
                            address: mintAddress,
                            price: price,
                            mint: mintAddress,
                            verified: true,
                            value: tokenValue,
                            source: 'coingecko-listed',
                            logoURI: tokenInfo.logoURI,
                            coingeckoId: tokenInfo.coingeckoId
                        });

                        console.log(`✅ ${tokenInfo.symbol}: ${balance.toFixed(4)} ($${tokenValue.toFixed(2)})`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));

                } catch (error) {
                    console.warn(`⚠️ Error checking ${tokenInfo.symbol}:`, error.message);
                }
            }

            // Sort and Add SPL Tokens
            splTokens.sort((a, b) => (b.value || 0) - (a.value || 0));
            tokens.push(...splTokens);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`\n📊 Solana Results (${processingTime}s):`);
            console.log(`💰 Total Value: $${totalValue.toFixed(2)}`);
            console.log(`🔍 Tokens Checked: ${tokensChecked}`);
            console.log(`💎 Tokens Found: ${tokensFound + 1} (including SOL)`);
            console.log(`🎯 SOL is first token: ${tokens[0].symbol === 'SOL' ? 'YES ✅' : 'NO ❌'}`);

            return {
                tokens,
                address,
                totalValue,
                chain: 'solana',
                statistics: {
                    tokensChecked: tokensChecked,
                    tokensFound: tokensFound + 1,
                    tokensReturned: tokens.length,
                    processingTimeSeconds: parseFloat(processingTime),
                    averageTokenValue: tokens.length > 0 ? totalValue / tokens.length : 0,
                    largestHolding: tokens.length > 0 ? tokens[0] : null,
                    strategy: 'known-tokens-only',
                    solFirst: true
                },
                fetchedAt: new Date().toISOString(),
                cacheInfo: {
                    priceCacheSize: this.priceCache.size,
                    cacheHitRate: 'optimized'
                },
                version: 'v0.2.2.3'
            };

        } catch (error) {
            console.error('❌ Solana detection error:', error);
            throw new Error(`Failed to fetch Solana wallet data: ${error.message}`);
        }
    }

    // Wallet Summary
    async getWalletSummary(address) {
        try {
            const solBalance = await this.getSOLBalance(address);
            const estimatedTokens = Object.keys(SolanaUtils.KNOWN_SPL_TOKENS).length;
            
            return {
                address,
                solBalance: solBalance.toFixed(6),
                estimatedScanTime: '5-8 seconds',
                knownTokensToCheck: estimatedTokens,
                strategy: 'streamlined',
                fetchedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Wallet summary error:', error);
            throw new Error(`Failed to fetch wallet summary: ${error.message}`);
        }
    }

    // API Test
    async testCoinGeckoAPI() {
        try {
            console.log('🧪 Testing CoinGecko API...');
            
            const testPrice = await this.getCoinGeckoPrice('solana');
            
            if (testPrice > 0) {
                return {
                    status: 'success',
                    testPrice: testPrice,
                    message: `CoinGecko API working! SOL price: $${testPrice}`,
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
            knownTokensCount: Object.keys(SolanaUtils.KNOWN_SPL_TOKENS).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = SolanaUtils;