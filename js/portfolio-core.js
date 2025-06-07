// js/portfolio-core.js - Portfolio Management with Real-time Currency Conversion

const Portfolio = {
    data: { totalValue: 0, wallets: [], lastUpdated: null },
    currency: 'usd',
    rates: { 
        usd: { eth: 0.0004, sol: 0.04, btc: 0.00002, usdc: 1.0, usdt: 1.0 }, 
        eth: { usd: 2500, sol: 100, btc: 0.05, usdc: 2500, usdt: 2500 }, 
        sol: { usd: 25, eth: 0.01, btc: 0.0005, usdc: 25, usdt: 25 }, 
        btc: { usd: 50000, eth: 20, sol: 2000, usdc: 50000, usdt: 50000 },
        usdc: { usd: 1.0, eth: 0.0004, sol: 0.04, btc: 0.00002, usdt: 1.0 },
        usdt: { usd: 1.0, eth: 0.0004, sol: 0.04, btc: 0.00002, usdc: 1.0 }
    },
    realTimePrices: {
        eth: 0,
        sol: 0,
        btc: 0,
        lastUpdated: null
    },
    storageKey: 'crypto_portfolio_wallets',

    async init() {
        this.currency = localStorage.getItem('portfolio_currency') || 'usd';
        await this.fetchRealTimeRates();
        console.log('Portfolio initialized with real-time rates');
    },

    async fetchRealTimeRates() {
        try {
            console.log('Fetching real-time cryptocurrency prices...');
            
            let response = await fetch('/api/prices/rates');
            let data = await response.json();
            
            if (data.success && data.rates) {
                this.rates = data.rates;
                console.log('Updated exchange rates from API:', this.rates);
                return true;
            }
            
            response = await fetch('/api/prices/ethereum,bitcoin,solana');
            data = await response.json();
            
            if (data.success && data.prices) {
                const ethPrice = data.prices.ethereum?.usd || 0;
                const btcPrice = data.prices.bitcoin?.usd || 0;
                const solPrice = data.prices.solana?.usd || 0;
                
                if (ethPrice > 0 && btcPrice > 0 && solPrice > 0) {
                    this.realTimePrices = {
                        eth: ethPrice,
                        sol: solPrice,
                        btc: btcPrice,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    this.rates = this.calculateRealTimeRates(ethPrice, solPrice, btcPrice);
                    console.log('Updated with real-time prices:', {
                        ETH: `$${ethPrice}`,
                        SOL: `$${solPrice}`,
                        BTC: `$${btcPrice}`
                    });
                    
                    return true;
                }
            }
            
            console.warn('Could not fetch real-time rates, using fallback values');
            return false;
            
        } catch (error) {
            console.error('Failed to fetch real-time rates:', error);
            return false;
        }
    },

    calculateRealTimeRates(ethPrice, solPrice, btcPrice) {
        return {
            usd: { 
                eth: 1 / ethPrice, 
                sol: 1 / solPrice, 
                btc: 1 / btcPrice, 
                usdc: 1.0, 
                usdt: 1.0 
            },
            eth: { 
                usd: ethPrice, 
                sol: ethPrice / solPrice, 
                btc: ethPrice / btcPrice, 
                usdc: ethPrice, 
                usdt: ethPrice 
            },
            sol: { 
                usd: solPrice, 
                eth: solPrice / ethPrice, 
                btc: solPrice / btcPrice, 
                usdc: solPrice, 
                usdt: solPrice 
            },
            btc: { 
                usd: btcPrice, 
                eth: btcPrice / ethPrice, 
                sol: btcPrice / solPrice, 
                usdc: btcPrice, 
                usdt: btcPrice 
            },
            usdc: { 
                usd: 1.0, 
                eth: 1 / ethPrice, 
                sol: 1 / solPrice, 
                btc: 1 / btcPrice, 
                usdt: 1.0 
            },
            usdt: { 
                usd: 1.0, 
                eth: 1 / ethPrice, 
                sol: 1 / solPrice, 
                btc: 1 / btcPrice, 
                usdc: 1.0 
            }
        };
    },

    convert(value, from, to) {
        if (!value || value === 0) return 0;
        if (from === to) return value;
        
        if (!this.rates[from] || !this.rates[from][to]) {
            console.warn(`Missing conversion rate from ${from} to ${to}`);
            return value;
        }
        
        const rate = this.rates[from][to];
        const result = value * rate;
        
        const priceInfo = this.realTimePrices.lastUpdated ? 
            `(ETH: $${this.realTimePrices.eth}, SOL: $${this.realTimePrices.sol}, BTC: $${this.realTimePrices.btc})` : 
            '(using fallback rates)';
        
        console.log(`Converting ${value} ${from} to ${to}: ${value} * ${rate} = ${result} ${priceInfo}`);
        
        return result;
    },

    format(value, currency = this.currency) {
        if (!value) value = 0;
        const decimals = currency === 'usd' ? 2 : 
                        currency === 'btc' ? 6 : 
                        (currency === 'usdc' || currency === 'usdt') ? 2 : 4;
        
        const numberFormatted = Number(value).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
        
        switch(currency) {
            case 'usd': return `$${numberFormatted}`;
            case 'eth': return `${numberFormatted} ETH`;
            case 'sol': return `${numberFormatted} SOL`;
            case 'btc': return `${numberFormatted} BTC`;
            case 'usdc': return `$${numberFormatted}`;
            case 'usdt': return `$${numberFormatted}`;
            default: return numberFormatted;
        }
    },

    async setCurrency(currency) {
        console.log(`Setting currency to: ${currency}`);
        this.currency = currency;
        localStorage.setItem('portfolio_currency', currency);
        
        if (currency !== 'usd') {
            await this.fetchRealTimeRates();
        }
        
        this.updateUI();
        
        if (window.updateEnhancedChart) {
            setTimeout(() => window.updateEnhancedChart(), 100);
        }
    },

    async fetchRates() {
        return await this.fetchRealTimeRates();
    },

    async updateValue() {
        const wallets = this.getWallets();
        if (!wallets.length) return;

        try {
            await this.fetchRealTimeRates();
            
            const response = await fetch('/api/prices/portfolio/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallets })
            });
            
            const data = await response.json();
            if (data.success) {
                this.data = data.portfolio;
                
                if (data.portfolio.crossRates) {
                    this.rates = data.portfolio.crossRates;
                    console.log('Updated rates from portfolio API:', this.rates);
                }
                
                this.updateUI();
            }
        } catch (error) {
            console.error('Portfolio update failed:', error);
        }
    },

    updateUI() {
        console.log(`Updating UI with currency: ${this.currency}`);
        
        if (this.realTimePrices.lastUpdated) {
            console.log(`Current rates - ETH: $${this.realTimePrices.eth}, SOL: $${this.realTimePrices.sol}, BTC: $${this.realTimePrices.btc}`);
        }
        
        const totalEl = document.getElementById('totalValue');
        if (totalEl) {
            const converted = this.convert(this.data.totalValue, 'usd', this.currency);
            const formatted = this.format(converted, this.currency);
            totalEl.textContent = formatted;
            console.log(`Total value updated: ${formatted}`);
        }

        const countEl = document.getElementById('totalWallets');
        if (countEl) countEl.textContent = this.data.walletCount || '0';

        document.querySelectorAll('.currency-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.currency === this.currency);
        });

        document.querySelectorAll('.wallet-card').forEach(card => {
            const chain = card.dataset.chain;
            const address = card.dataset.address;
            const walletData = this.data.wallets?.find(w => 
                w.chain === chain && w.address?.toLowerCase() === address?.toLowerCase()
            );
            
            if (walletData) {
                this.updateWalletCard(card, walletData);
            }
        });

        if (window.UI && window.UI.chart) {
            window.UI.updateChart(this.data, this.currency);
        }
        
        if (window.updateEnhancedChart) {
            setTimeout(() => window.updateEnhancedChart(), 100);
        }
    },

    updateWalletCard(card, walletData) {
        const valueEl = card.querySelector('.summary-item:last-child .value');
        if (valueEl) {
            const converted = this.convert(walletData.totalValue, 'usd', this.currency);
            const formatted = this.format(converted, this.currency);
            valueEl.textContent = formatted;
        }

        card.querySelectorAll('.token-card, .solana-token-card').forEach(tokenCard => {
            const symbol = tokenCard.dataset.token;
            const valueEl = tokenCard.querySelector('.token-value');
            
            if (valueEl) {
                const storedUsdValue = valueEl.getAttribute('data-usd-value');
                
                if (storedUsdValue) {
                    const usdValue = parseFloat(storedUsdValue);
                    const converted = this.convert(usdValue, 'usd', this.currency);
                    const formatted = this.format(converted, this.currency);
                    valueEl.textContent = formatted;
                } else {
                    const token = walletData.tokens?.find(t => t.symbol === symbol || 
                        (symbol === 'wSOL' && t.symbol === 'SOL' && t.address === 'native'));
                    
                    if (token) {
                        const converted = this.convert(token.value || 0, 'usd', this.currency);
                        const formatted = this.format(converted, this.currency);
                        valueEl.textContent = formatted;
                    }
                }
            }
        });
    },

    getCurrentPriceInfo() {
        if (!this.realTimePrices.lastUpdated) {
            return 'Using fallback exchange rates';
        }
        
        const updatedTime = new Date(this.realTimePrices.lastUpdated).toLocaleTimeString();
        return {
            eth: `$${this.realTimePrices.eth.toLocaleString()}`,
            sol: `$${this.realTimePrices.sol.toLocaleString()}`,
            btc: `$${this.realTimePrices.btc.toLocaleString()}`,
            lastUpdated: updatedTime
        };
    },

    saveWallet(wallet) {
        const wallets = this.getWallets();
        const index = wallets.findIndex(w => w.address.toLowerCase() === wallet.address.toLowerCase() && w.chain === wallet.chain);
        
        if (index >= 0) {
            wallets[index] = { ...wallets[index], ...wallet };
        } else {
            wallets.push(wallet);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(wallets));
    },

    getWallets() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        } catch { return []; }
    },

    removeWallet(address, chain) {
        const wallets = this.getWallets().filter(w => 
            !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
        );
        localStorage.setItem(this.storageKey, JSON.stringify(wallets));
    }
};

console.log('Portfolio Core loaded with real-time exchange rates');