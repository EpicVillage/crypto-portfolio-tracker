// js/blockchain.js - Blockchain Integration

class BlockchainManager {
    constructor() {
        this.web3 = null;
        this.solanaConnection = null;
        this.connectedWallets = new Map();
        this.chains = {
            ethereum: { chainId: '0x1', name: 'Ethereum', symbol: 'ETH' },
            polygon: { chainId: '0x89', name: 'Polygon', symbol: 'MATIC' },
            bsc: { chainId: '0x38', name: 'BSC', symbol: 'BNB' },
            solana: { name: 'Solana', symbol: 'SOL' }
        };
        console.log('🔗 BlockchainManager initialized');
    }

    // Initialization
    async initialize() {
        try {
            // Web3 for EVM chains
            if (window.ethereum) {
                this.web3 = new (window.Web3 || (await import('https://cdn.skypack.dev/web3@1.8.0')).Web3)(window.ethereum);
                console.log('✅ Web3 initialized');
            }

            // Solana Connection
            if (window.solana?.isPhantom) {
                const { Connection, clusterApiUrl } = await import('https://cdn.skypack.dev/@solana/web3.js@1.73.0');
                this.solanaConnection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
                console.log('✅ Solana initialized');
            }

            return true;
        } catch (error) {
            console.error('❌ Blockchain init error:', error);
            return false;
        }
    }

    // EVM Chain Connection
    async connectEVM(chain) {
        try {
            if (!window.ethereum) throw new Error('MetaMask not installed');
            
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts.length) throw new Error('No accounts found');

            const address = accounts[0];
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });

            this.connectedWallets.set(chain, {
                address, chainId, type: 'metamask', connectedAt: new Date().toISOString()
            });

            this.setupEVMListeners();
            console.log(`✅ ${chain} connected: ${address}`);
            return { success: true, address, chainId };

        } catch (error) {
            console.error(`❌ ${chain} connection error:`, error);
            return { success: false, error: error.message };
        }
    }

    // Solana Connection
    async connectSolana() {
        try {
            if (!window.solana?.isPhantom) throw new Error('Phantom not installed');

            const response = await window.solana.connect();
            const address = response.publicKey.toString();

            this.connectedWallets.set('solana', {
                address, type: 'phantom', publicKey: response.publicKey, connectedAt: new Date().toISOString()
            });

            this.setupSolanaListeners();
            console.log(`✅ Solana connected: ${address}`);
            return { success: true, address };

        } catch (error) {
            console.error('❌ Solana connection error:', error);
            return { success: false, error: error.message };
        }
    }

    // Event Listeners
    setupEVMListeners() {
        if (!window.ethereum) return;

        window.ethereum.on('accountsChanged', (accounts) => {
            if (!accounts.length) {
                this.disconnectWallet('ethereum');
            } else {
                this.updateWallet('ethereum', accounts[0]);
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            const wallet = this.connectedWallets.get('ethereum');
            if (wallet) {
                wallet.chainId = chainId;
                this.notifyWalletChange('ethereum', wallet.address);
            }
        });

        window.ethereum.on('disconnect', () => this.disconnectWallet('ethereum'));
    }

    setupSolanaListeners() {
        if (!window.solana) return;

        window.solana.on('accountChanged', (publicKey) => {
            if (publicKey) {
                this.updateWallet('solana', publicKey.toString());
            } else {
                this.disconnectWallet('solana');
            }
        });

        window.solana.on('disconnect', () => this.disconnectWallet('solana'));
    }

    // Wallet Management
    updateWallet(chain, address) {
        const wallet = this.connectedWallets.get(chain);
        if (wallet) {
            wallet.address = address;
            this.notifyWalletChange(chain, address);
        }
    }

    notifyWalletChange(chain, address) {
        if (window.showMessage) {
            window.showMessage(`🔄 ${chain.toUpperCase()} updated: ${address.slice(0, 6)}...${address.slice(-4)}`);
        }
        if (window.updatePortfolioValue) {
            window.updatePortfolioValue();
        }
    }

    // Token Retrieval
    async getEthereumTokens(address) {
        try {
            // API Data
            if (window.apiManager) {
                const data = await window.apiManager.getWalletData('ethereum', address);
                if (data?.tokens) return data.tokens;
            }

            // Fallback: ETH Balance
            if (!this.web3) throw new Error('Web3 not initialized');

            const ethBalance = await this.web3.eth.getBalance(address);
            const ethInEther = this.web3.utils.fromWei(ethBalance, 'ether');
            
            let ethPrice = 0;
            try {
                const priceData = await window.apiManager?.getPrices('ethereum');
                ethPrice = priceData?.prices?.ethereum?.usd || 0;
            } catch {}

            return [{
                symbol: 'ETH', name: 'Ethereum', balance: parseFloat(ethInEther).toFixed(6),
                decimals: 18, address: 'native', price: ethPrice, value: parseFloat(ethInEther) * ethPrice
            }];

        } catch (error) {
            console.error('❌ Ethereum tokens error:', error);
            return [];
        }
    }

    async getSolanaTokens(address) {
        try {
            // API Data
            if (window.apiManager) {
                const data = await window.apiManager.getWalletData('solana', address);
                if (data?.tokens) return data.tokens;
            }

            // Fallback: SOL Balance
            if (!this.solanaConnection) throw new Error('Solana not initialized');

            const { PublicKey } = await import('https://cdn.skypack.dev/@solana/web3.js@1.73.0');
            const publicKey = new PublicKey(address);
            const solBalance = await this.solanaConnection.getBalance(publicKey);
            const solInSol = solBalance / 1000000000;

            let solPrice = 0;
            try {
                const priceData = await window.apiManager?.getPrices('solana');
                solPrice = priceData?.prices?.solana?.usd || 0;
            } catch {}

            return [{
                symbol: 'SOL', name: 'Solana', balance: solInSol.toFixed(6),
                decimals: 9, address: 'native', price: solPrice, value: solInSol * solPrice
            }];

        } catch (error) {
            console.error('❌ Solana tokens error:', error);
            return [];
        }
    }

    // Disconnect Wallet
    async disconnectWallet(chain) {
        try {
            const wallet = this.connectedWallets.get(chain);
            if (!wallet) return;

            this.connectedWallets.delete(chain);
            
            document.querySelector(`[data-chain="${chain}"][data-address="${wallet.address}"]`)?.remove();
            
            if (window.updatePortfolioValue) await window.updatePortfolioValue();
            if (window.showMessage) window.showMessage(`🔌 ${chain} disconnected`);

        } catch (error) {
            console.error(`❌ Disconnect ${chain} error:`, error);
        }
    }

    // Network Switching
    async switchNetwork(chainId) {
        try {
            if (!window.ethereum) throw new Error('MetaMask not available');
            
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }]
            });
            
            return true;
        } catch (error) {
            console.error('❌ Network switch error:', error);
            if (window.showMessage) window.showMessage(`❌ Network switch failed: ${error.message}`);
            return false;
        }
    }

    // Status Methods
    getConnectedWallets() {
        return Array.from(this.connectedWallets.entries()).map(([chain, wallet]) => ({
            chain, ...wallet, chainInfo: this.chains[chain]
        }));
    }

    isWalletConnected(chain) {
        return this.connectedWallets.has(chain);
    }

    getWalletAddress(chain) {
        return this.connectedWallets.get(chain)?.address || null;
    }

    getConnectionStatus() {
        const connected = this.connectedWallets.size;
        const total = Object.keys(this.chains).length;
        return {
            connectedWallets: connected,
            connectedChains: Array.from(this.connectedWallets.keys()),
            totalSupportedChains: total,
            connectionRate: `${(connected / total * 100).toFixed(1)}%`,
            isAnyConnected: connected > 0
        };
    }

    // Cleanup
    cleanup() {
        try {
            // EVM Listeners
            if (window.ethereum?.removeAllListeners) {
                ['accountsChanged', 'chainChanged', 'disconnect'].forEach(event => 
                    window.ethereum.removeAllListeners(event)
                );
            }

            // Solana Listeners
            if (window.solana?.removeAllListeners) {
                ['accountChanged', 'disconnect'].forEach(event => 
                    window.solana.removeAllListeners(event)
                );
            }

            this.connectedWallets.clear();
            console.log('✅ Blockchain cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }
}

// Price Manager
class PriceManager {
    constructor() {
        this.prices = new Map();
        console.log('💰 PriceManager initialized');
    }

    async getPrice(symbol) {
        try {
            if (window.apiManager) {
                const data = await window.apiManager.getPrices(symbol);
                const price = data.prices?.[symbol.toLowerCase()]?.usd || 0;
                this.prices.set(symbol.toLowerCase(), { price, lastUpdate: Date.now() });
                return { price, change24h: 0 };
            }
            return this.prices.get(symbol.toLowerCase()) || { price: 0, change24h: 0 };
        } catch (error) {
            console.error(`❌ Price error for ${symbol}:`, error);
            return { price: 0, change24h: 0 };
        }
    }

    startPriceUpdates() {
        console.log('🔄 Price updates delegated to main system');
    }

    stopPriceUpdates() {
        console.log('⏹️ Price updates stopped');
    }

    getAllPrices() {
        const prices = {};
        for (const [symbol, data] of this.prices) {
            prices[symbol] = data.price;
        }
        return prices;
    }
}

// Module Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BlockchainManager, PriceManager };
} else {
    window.BlockchainManager = BlockchainManager;
    window.PriceManager = PriceManager;
}

console.log('🚀 Blockchain Module loaded');