// js/wallet-core.js - Wallet Connections and Blockchain Interactions

const Wallet = {
    blockchains: null,

    init() {
        this.setupBlockchains();
        this.showSavedWalletsInstantly();
        console.log('Wallet initialized with instant display');
    },

    setupBlockchains() {
        this.blockchains = {
            ethereum: () => this.connectEVM('ethereum'),
            polygon: () => this.connectEVM('polygon'), 
            bsc: () => this.connectEVM('bsc'),
            solana: () => this.connectSolana()
        };
    },

    showSavedWalletsInstantly() {
        const wallets = Portfolio.getWallets();
        if (!wallets.length) {
            UI.updateEmpty();
            return;
        }

        console.log(`Showing ${wallets.length} saved wallets instantly...`);

        wallets.forEach(wallet => {
            this.displayWalletWithLoading(wallet.chain, wallet.address, wallet);
        });

        this.loadRealDataInBackground(wallets);
    },

    displayWalletWithLoading(chain, address, savedWallet) {
        const chainConfig = UI.chains[chain];
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;
        const walletName = savedWallet.name || `${chainConfig.name} Wallet`;
        
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.dataset.chain = chain;
        card.dataset.address = address;
        card.dataset.value = Math.floor(savedWallet.totalValue || 0);
        
        const cachedTokens = savedWallet.tokens || [];
        const nativeToken = cachedTokens.find(t => t.symbol === chainConfig.symbol);
        const totalValue = savedWallet.totalValue || 0;
        
        card.innerHTML = `
            <div class="wallet-header ${chain}">
                <div class="wallet-header-content">
                    <div class="wallet-name-row">
                        <button onclick="Wallet.remove('${address}','${chain}')" class="remove-wallet-btn" title="Remove wallet">×</button>
                        <div class="wallet-name-center">
                            <div class="wallet-name" data-name="${walletName}">${walletName}</div>
                            <button onclick="UI.showEditNameModal('${address}','${chain}','${walletName}')" class="edit-name-btn" title="Edit wallet name">✏️</button>
                        </div>
                        <div class="spacer"></div>
                    </div>
                    <div class="wallet-address-row">
                        <div class="wallet-address">${shortAddress}</div>
                        <button onclick="Wallet.copyAddress('${address}')" class="copy-address-btn" title="Copy address">📋</button>
                    </div>
                </div>
            </div>
            <div class="wallet-content">
                <div class="wallet-summary">
                    <div class="summary-item">
                        <div class="label">${chainConfig.symbol} Balance</div>
                        <div class="value">${nativeToken?.balance || '0'} ${chainConfig.symbol}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Total Value</div>
                        <div class="value success">${Portfolio.format(Portfolio.convert(totalValue, 'usd', Portfolio.currency))}</div>
                    </div>
                </div>
                ${this.createTokenDisplay(cachedTokens, chain)}
            </div>
            
            <div class="wallet-loading-overlay" data-wallet="${address}">
                <div class="wallet-loading-content">
                    <div class="wallet-loading-spinner"></div>
                    <div class="wallet-loading-text">Updating...</div>
                </div>
            </div>
        `;
        
        let container = document.getElementById('walletsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'walletsContainer';
            container.className = 'wallets-grid';
            document.querySelector('.wallets-section').appendChild(container);
        }
        
        container.appendChild(card);
        UI.updateEmpty();
    },

    async loadRealDataInBackground(wallets) {
        console.log(`Loading real data for ${wallets.length} wallets in background...`);
        
        const loadPromises = wallets.map(wallet => 
            this.loadSingleWalletData(wallet.chain, wallet.address, wallet.name)
        );
        
        const results = await Promise.allSettled(loadPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`Background loading complete: ${successful} successful, ${failed} failed`);
        
        if (successful > 0) {
            setTimeout(() => {
                Portfolio.updateValue();
            }, 500);
        }
    },

    async loadSingleWalletData(chain, address, customName) {
        try {
            const response = await fetch(`/api/wallets/${chain}/${address}`);
            const data = await response.json();
            
            if (response.ok && data.tokens) {
                this.updateExistingWalletCard(chain, address, data, customName);
                this.removeWalletLoadingOverlay(address);
                console.log(`Updated ${UI.chains[chain].name} wallet: ${address.slice(0, 8)}...`);
            } else {
                throw new Error('Failed to fetch wallet data');
            }
        } catch (error) {
            console.warn(`Failed to load wallet ${address}:`, error);
            this.showWalletErrorState(address, error.message);
            this.removeWalletLoadingOverlay(address);
        }
    },

    updateExistingWalletCard(chain, address, data, customName) {
        const card = document.querySelector(`[data-chain="${chain}"][data-address="${address}"]`);
        if (!card) return;
        
        const tokens = Array.isArray(data) ? data : data.tokens || [];
        const totalValue = data.totalValue || tokens.reduce((sum, token) => 
            sum + (parseFloat(token.balance) || 0) * (parseFloat(token.price) || 0), 0
        );
        
        const chainConfig = UI.chains[chain];
        const nativeToken = tokens.find(t => t.symbol === chainConfig.symbol);
        
        const balanceValue = card.querySelector('.summary-item:first-child .value');
        if (balanceValue) {
            balanceValue.textContent = `${nativeToken?.balance || '0'} ${chainConfig.symbol}`;
        }
        
        const totalValueEl = card.querySelector('.summary-item:last-child .value');
        if (totalValueEl) {
            totalValueEl.textContent = Portfolio.format(Portfolio.convert(totalValue, 'usd', Portfolio.currency));
        }
        
        const walletContent = card.querySelector('.wallet-content');
        const tokenContainer = walletContent.querySelector('.solana-tokens-row');
        if (tokenContainer) {
            tokenContainer.outerHTML = this.createTokenDisplay(tokens, chain);
        }
        
        card.dataset.value = Math.floor(totalValue);
        
        Portfolio.saveWallet({
            chain, address, tokens, totalValue,
            name: customName || `${chainConfig.name} Wallet`,
            addedAt: new Date().toISOString()
        });
    },

    removeWalletLoadingOverlay(address) {
        const overlay = document.querySelector(`[data-wallet="${address}"]`);
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    },

    showWalletErrorState(address, errorMessage) {
        const card = document.querySelector(`[data-address="${address}"]`);
        if (!card) return;
        
        const walletContent = card.querySelector('.wallet-content');
        if (walletContent) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'wallet-error-state';
            errorDiv.innerHTML = `
                <div style="text-align: center; padding: 15px; color: #e74c3c; font-size: 0.9rem;">
                    ⚠️ Failed to update: ${errorMessage}
                </div>
            `;
            walletContent.appendChild(errorDiv);
        }
    },

    async connectEVM(chain) {
        if (!window.ethereum) throw new Error('MetaMask not installed');
        
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { address: accounts[0], chain };
    },

    async connectSolana() {
        if (!window.solana?.isPhantom) throw new Error('Phantom not installed');
        
        const response = await window.solana.connect();
        return { address: response.publicKey.toString(), chain: 'solana' };
    },

    async connect(chain) {
        try {
            const result = await this.blockchains[chain]();
            UI.message(`${UI.chains[chain].name} connected`);
            
            document.querySelector('[style*="position:fixed"]')?.remove();
            
            await this.fetchAndDisplay(result.chain, result.address);
            
        } catch (error) {
            UI.message(`${error.message}`, 'error');
        }
    },

    async addManually(chain, address, customName = null) {
        try {
            UI.message(`Adding ${UI.chains[chain].name} wallet manually...`);
            
            if (!this.validateAddress(address, chain)) {
                throw new Error('Invalid address format');
            }
            
            const existingWallets = Portfolio.getWallets();
            const exists = existingWallets.find(w => 
                w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
            );
            
            if (exists) {
                throw new Error('Wallet already added');
            }
            
            await this.fetchAndDisplay(chain, address, customName);
            
            UI.message(`${UI.chains[chain].name} wallet added manually!`);
            
        } catch (error) {
            console.error('Manual wallet addition error:', error);
            UI.message(`${error.message}`, 'error');
            throw error;
        }
    },

    validateAddress(address, chain) {
        if (chain === 'solana') {
            return address.length >= 32 && address.length <= 44 && /^[A-Za-z0-9]+$/.test(address);
        } else {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
    },

    async fetchAndDisplay(chain, address, customName = null) {
        try {
            UI.message(`Fetching ${UI.chains[chain].name} wallet data...`);
            
            const response = await fetch(`/api/wallets/${chain}/${address}`);
            const data = await response.json();
            
            if (response.ok && data.tokens) {
                this.display(chain, address, data, customName);
                UI.message(`Found ${data.tokens.length} tokens!`);
            } else {
                UI.message('Could not fetch wallet data', 'error');
            }
        } catch (error) {
            UI.message('Failed to fetch wallet data', 'error');
        }
    },

    display(chain, address, data, customName = null) {
        const tokens = Array.isArray(data) ? data : data.tokens || [];
        const totalValue = data.totalValue || tokens.reduce((sum, token) => 
            sum + (parseFloat(token.balance) || 0) * (parseFloat(token.price) || 0), 0
        );
        
        const chainConfig = UI.chains[chain];
        const nativeToken = tokens.find(t => t.symbol === chainConfig.symbol);
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;
        const walletName = customName || `${chainConfig.name} Wallet`;
        
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.dataset.chain = chain;
        card.dataset.address = address;
        card.dataset.value = Math.floor(totalValue);
        
        card.innerHTML = `
            <div class="wallet-header ${chain}">
                <div class="wallet-header-content">
                    <div class="wallet-name-row">
                        <button onclick="Wallet.remove('${address}','${chain}')" class="remove-wallet-btn" title="Remove wallet">×</button>
                        <div class="wallet-name-center">
                            <div class="wallet-name" data-name="${walletName}">${walletName}</div>
                            <button onclick="UI.showEditNameModal('${address}','${chain}','${walletName}')" class="edit-name-btn" title="Edit wallet name">✏️</button>
                        </div>
                        <div class="spacer"></div>
                    </div>
                    <div class="wallet-address-row">
                        <div class="wallet-address">${shortAddress}</div>
                        <button onclick="Wallet.copyAddress('${address}')" class="copy-address-btn" title="Copy address">📋</button>
                    </div>
                </div>
            </div>
            <div class="wallet-content">
                <div class="wallet-summary">
                    <div class="summary-item">
                        <div class="label">${chainConfig.symbol} Balance</div>
                        <div class="value">${nativeToken?.balance || '0'} ${chainConfig.symbol}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Total Value</div>
                        <div class="value success">${Portfolio.format(Portfolio.convert(totalValue, 'usd', Portfolio.currency))}</div>
                    </div>
                </div>
                ${this.createTokenDisplay(tokens, chain)}
            </div>
        `;
        
        let container = document.getElementById('walletsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'walletsContainer';
            container.className = 'wallets-grid';
            document.querySelector('.wallets-section').appendChild(container);
        }
        
        container.appendChild(card);
        
        Portfolio.saveWallet({
            chain, address, tokens, totalValue,
            name: walletName,
            addedAt: new Date().toISOString()
        });
        
        setTimeout(() => {
            Portfolio.updateValue();
            UI.updateEmpty();
        }, 1000);
    },

    updateName(address, chain, newName) {
        const card = document.querySelector(`[data-chain="${chain}"][data-address="${address}"]`);
        if (card) {
            const nameElement = card.querySelector('.wallet-name');
            if (nameElement) {
                nameElement.textContent = newName;
                nameElement.setAttribute('data-name', newName);
            }
            
            const editBtn = card.querySelector('.edit-name-btn');
            if (editBtn) {
                editBtn.setAttribute('onclick', `UI.showEditNameModal('${address}','${chain}','${newName}')`);
            }
        }
        
        const wallets = Portfolio.getWallets();
        const walletIndex = wallets.findIndex(w => 
            w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
        );
        
        if (walletIndex >= 0) {
            wallets[walletIndex].name = newName;
            localStorage.setItem(Portfolio.storageKey, JSON.stringify(wallets));
        }
        
        UI.message(`Wallet renamed to "${newName}"`);
    },

    createTokenDisplay(tokens, chain) {
        if (!tokens.length) return '<div style="text-align:center;padding:15px;color:var(--text-muted);">No tokens found</div>';
        
        if (chain === 'solana') {
            return this.createSolanaTokens(tokens);
        } else {
            return this.createEVMTokensRow(tokens, chain);
        }
    },

    createSolanaTokens(tokens) {
        const tracked = [
            { symbol: 'wSOL', name: 'Wrapped SOL', logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
            { symbol: 'USDC', name: 'USD Coin', logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
            { symbol: 'USDT', name: 'Tether USD', logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' }
        ];
        
        let html = '<div class="solana-tokens-row">';
        
        tracked.forEach(tracked => {
            let token = null;
            if (tracked.symbol === 'wSOL') {
                token = tokens.find(t => t.symbol === 'wSOL' || (t.symbol === 'SOL' && t.address === 'native'));
            } else {
                token = tokens.find(t => t.symbol === tracked.symbol);
            }
            
            const balance = token ? parseFloat(token.balance) || 0 : 0;
            
            let usdValue = 0;
            if (token) {
                if (tracked.symbol === 'USDC' || tracked.symbol === 'USDT') {
                    usdValue = balance;
                } else {
                    usdValue = token.value || 0;
                }
            }
            
            const initialValue = Portfolio.convert(usdValue, 'usd', Portfolio.currency);
            
            html += `
                <div class="solana-token-card" data-token="${tracked.symbol}">
                    <div class="token-logo">
                        <img src="${tracked.logo}" alt="${tracked.symbol}" style="width:32px;height:32px;border-radius:50%;" onerror="this.style.display='none'">
                    </div>
                    <div class="token-info">
                        <div class="token-symbol">${tracked.symbol}</div>
                        <div class="token-name">${tracked.name}</div>
                    </div>
                    <div class="token-balance">${balance.toFixed(4)}</div>
                    <div class="token-value" data-usd-value="${usdValue}">${Portfolio.format(initialValue)}</div>
                </div>
            `;
        });
        
        return html + '</div>';
    },

    createEVMTokensRow(tokens, chain) {
        const trackedTokens = {
            ethereum: [
                { symbol: 'WETH', name: 'Wrapped ETH', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png' },
                { symbol: 'USDC', name: 'USD Coin', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/logo.png' },
                { symbol: 'USDT', name: 'Tether USD', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png' }
            ],
            polygon: [
                { symbol: 'WMATIC', name: 'Wrapped MATIC', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png' },
                { symbol: 'USDC', name: 'USD Coin', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/logo.png' },
                { symbol: 'USDT', name: 'Tether USD', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png' }
            ],
            bsc: [
                { symbol: 'WBNB', name: 'Wrapped BNB', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/logo.png' },
                { symbol: 'USDC', name: 'USD Coin', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png' },
                { symbol: 'USDT', name: 'Tether USD', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png' }
            ]
        };
        
        const tracked = trackedTokens[chain] || [];
        let html = '<div class="solana-tokens-row">';
        
        tracked.forEach(trackedToken => {
            const token = tokens.find(t => t.symbol === trackedToken.symbol);
            const balance = token ? parseFloat(token.balance) || 0 : 0;
            
            let usdValue = 0;
            if (token) {
                if (trackedToken.symbol === 'USDC' || trackedToken.symbol === 'USDT') {
                    usdValue = balance;
                } else {
                    usdValue = token.value || 0;
                }
            }
            
            const initialValue = Portfolio.convert(usdValue, 'usd', Portfolio.currency);
            
            html += `
                <div class="solana-token-card" data-token="${trackedToken.symbol}">
                    <div class="token-logo" data-symbol="${trackedToken.symbol.charAt(0)}">
                        <img src="${trackedToken.logo}" alt="${trackedToken.symbol}" style="width:32px;height:32px;border-radius:50%;" 
                             onerror="this.style.display='none'; this.parentElement.classList.add('logo-failed');">
                    </div>
                    <div class="token-info">
                        <div class="token-symbol">${trackedToken.symbol}</div>
                        <div class="token-name">${trackedToken.name}</div>
                    </div>
                    <div class="token-balance">${balance.toFixed(4)}</div>
                    <div class="token-value" data-usd-value="${usdValue}">${Portfolio.format(initialValue)}</div>
                </div>
            `;
        });
        
        return html + '</div>';
    },

    async loadSaved() {
        console.log('loadSaved() deprecated - using instant display instead');
    },

    remove(address, chain) {
        document.querySelector(`[data-chain="${chain}"][data-address="${address}"]`)?.remove();
        Portfolio.removeWallet(address, chain);
        
        setTimeout(() => {
            Portfolio.updateValue();
            UI.updateEmpty();
        }, 500);
        
        UI.message(`${UI.chains[chain].name} wallet removed`);
    },

    copyAddress(address) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(address).then(() => {
                UI.message('Address copied!');
            }).catch(() => this.fallbackCopy(address));
        } else {
            this.fallbackCopy(address);
        }
    },

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            UI.message('Address copied!');
        } catch {
            UI.message('Copy failed', 'error');
        }
        
        document.body.removeChild(textarea);
    }
};

window.Wallet = Wallet;

console.log('Wallet Core loaded with instant display and loading overlays');