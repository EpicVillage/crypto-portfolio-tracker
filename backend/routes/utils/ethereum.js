// backend/routes/utils/ethereum.js - Ethereum Utility Functions

const axios = require('axios');
const { Web3 } = require('web3');

class EthereumUtils {
    constructor() {
        this.web3 = new Web3(process.env.ETHEREUM_RPC_URL);
        
        // Price Cache
        this.priceCache = new Map();
        this.PRICE_CACHE_DURATION = 5 * 60 * 1000;
        
        console.log('🚀 EthereumUtils initialized - Native ETH + CoinGecko tokens');
    }

    // Known ERC-20 Tokens
    static KNOWN_ERC20_TOKENS = {
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
            symbol: 'WETH',
            name: 'Wrapped Ether',
            decimals: 18,
            coingeckoId: 'ethereum',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png'
        },
        '0xA0b86a33E6E4e8F6C9fAE7E5Ca4404b7f5d61A9e': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            coingeckoId: 'usd-coin',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6E4e8F6C9fAE7E5Ca4404b7f5d61A9e/logo.png'
        },
        '0xdAC17F958D2ee523a2206206994597C13D831ec7': {
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            coingeckoId: 'tether',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png'
        },
        '0x6B175474E89094C44Da98b954EedeAC495271d0F': {
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            decimals: 18,
            coingeckoId: 'dai',
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png'
        }
    };

    // Address Validation
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }

    // ETH Balance
    async getETHBalance(address) {
        try {
            const balance = await this.web3.eth.getBalance(address);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error fetching ETH balance:', error);
            return 0;
        }
    }

    // ERC-20 Token Balance
    async getERC20TokenBalance(address, contractAddress, decimals) {
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
            console.warn(`Error fetching ERC-20 token balance for ${contractAddress}:`, error.message);
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
    async getAllERC20TokensStreamlined(address) {
        const startTime = Date.now();
        console.log(`🚀 Ethereum detection for: ${address}`);
        
        const tokens = [];
        let totalValue = 0;

        try {
            // ETH Balance (Always First)
            console.log('💰 Fetching ETH balance...');
            const ethBalance = await this.getETHBalance(address);
            const ethPrice = await this.getCoinGeckoPrice('ethereum');
            
            const ethValue = ethBalance * ethPrice;
            totalValue += ethValue;

            tokens.push({
                symbol: 'ETH',
                name: 'Ethereum',
                balance: parseFloat(ethBalance).toFixed(9),
                decimals: 18,
                address: 'native',
                price: ethPrice,
                mint: 'native',
                verified: true,
                value: ethValue,
                source: 'native',
                logoURI: null
            });
            
            console.log(`✅ ETH: ${parseFloat(ethBalance).toFixed(6)} ETH ($${ethValue.toFixed(2)})`);

            // ERC-20 Tokens
            console.log(`🔍 Checking ${Object.keys(EthereumUtils.KNOWN_ERC20_TOKENS).length} known tokens...`);
            
            let tokensChecked = 0;
            let tokensFound = 0;
            const erc20Tokens = [];

            for (const [contractAddress, tokenInfo] of Object.entries(EthereumUtils.KNOWN_ERC20_TOKENS)) {
                tokensChecked++;
                
                try {
                    const balance = await this.getERC20TokenBalance(address, contractAddress, tokenInfo.decimals);
                    
                    if (balance > 0) {
                        const price = await this.getCoinGeckoPrice(tokenInfo.coingeckoId);
                        const tokenValue = balance * price;
                        totalValue += tokenValue;
                        tokensFound++;

                        erc20Tokens.push({
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

            // Sort and Add ERC-20 Tokens
            erc20Tokens.sort((a, b) => (b.value || 0) - (a.value || 0));
            tokens.push(...erc20Tokens);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(`\n📊 Ethereum Results (${processingTime}s):`);
            console.log(`💰 Total Value: $${totalValue.toFixed(2)}`);
            console.log(`🔍 Tokens Checked: ${tokensChecked}`);
            console.log(`💎 Tokens Found: ${tokensFound + 1} (including ETH)`);
            console.log(`🎯 ETH is first token: ${tokens[0].symbol === 'ETH' ? 'YES ✅' : 'NO ❌'}`);

            return {
                tokens,
                address,
                totalValue,
                chain: 'ethereum',
                statistics: {
                    tokensChecked: tokensChecked,
                    tokensFound: tokensFound + 1,
                    tokensReturned: tokens.length,
                    processingTimeSeconds: parseFloat(processingTime),
                    averageTokenValue: tokens.length > 0 ? totalValue / tokens.length : 0,
                    largestHolding: tokens.length > 0 ? tokens[0] : null,
                    strategy: 'known-tokens-only',
                    ethFirst: true
                },
                fetchedAt: new Date().toISOString(),
                cacheInfo: {
                    priceCacheSize: this.priceCache.size,
                    cacheHitRate: 'optimized'
                },
                version: 'v0.2.2.3-ethereum'
            };

        } catch (error) {
            console.error('❌ Ethereum detection error:', error);
            throw new Error(`Failed to fetch Ethereum wallet data: ${error.message}`);
        }
    }

    // Wallet Summary
    async getWalletSummary(address) {
        try {
            const ethBalance = await this.getETHBalance(address);
            const estimatedTokens = Object.keys(EthereumUtils.KNOWN_ERC20_TOKENS).length;
            
            return {
                address,
                ethBalance: parseFloat(ethBalance).toFixed(6),
                estimatedScanTime: '3-6 seconds',
                knownTokensToCheck: estimatedTokens,
                strategy: 'streamlined',
                fetchedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Ethereum wallet summary error:', error);
            throw new Error(`Failed to fetch wallet summary: ${error.message}`);
        }
    }

    // API Test
    async testCoinGeckoAPI() {
        try {
            console.log('🧪 Testing CoinGecko API...');
            
            const testPrice = await this.getCoinGeckoPrice('ethereum');
            
            if (testPrice > 0) {
                return {
                    status: 'success',
                    testPrice: testPrice,
                    message: `CoinGecko API working! ETH price: $${testPrice}`,
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
            knownTokensCount: Object.keys(EthereumUtils.KNOWN_ERC20_TOKENS).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = EthereumUtils;