// js/ui-core.js - Dark Mode Interface with Wallet Management and View Toggle

const UI = {
    chart: null,
    currentView: 'grid',
    chains: {
        ethereum: { symbol: 'ETH', color: '#627eea', name: 'Ethereum' },
        solana: { symbol: 'SOL', color: '#9945ff', name: 'Solana' },
        polygon: { symbol: 'MATIC', color: '#8247e5', name: 'Polygon' },
        bsc: { symbol: 'BNB', color: '#f3ba2f', name: 'BSC' }
    },

    init() {
        this.setupEvents();
        this.createChart();
        
        const savedView = localStorage.getItem('wallet_view_preference') || 'grid';
        this.toggleView(savedView);
        
        setTimeout(() => this.hideLoading(), 1000);
        console.log('UI initialized - Dark Mode with View Toggle');
    },

    setupEvents() {
        document.querySelectorAll('.currency-btn').forEach(btn => {
            btn.addEventListener('click', (e) => Portfolio.setCurrency(e.target.dataset.currency));
        });
        
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());
        document.getElementById('addWalletBtn')?.addEventListener('click', () => this.showWalletModal());
        document.getElementById('chainFilter')?.addEventListener('change', () => this.filterWallets());
        document.getElementById('valueFilter')?.addEventListener('change', () => this.filterWallets());
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.toggleView(view);
            });
        });
    },

    toggleView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        const container = document.getElementById('walletsContainer');
        if (container) {
            if (view === 'list') {
                container.classList.add('list-view');
            } else {
                container.classList.remove('list-view');
            }
        }
        
        localStorage.setItem('wallet_view_preference', view);
        this.message(`Switched to ${view} view`);
        console.log(`View switched to: ${view}`);
    },

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
        
        const status = document.getElementById('portfolioStatus');
        if (status) {
            status.querySelector('.status-indicator')?.classList.remove('loading');
            status.querySelector('.status-text').textContent = 'Real-time data active';
        }
    },

    message(text, type = 'success') {
        const area = document.getElementById('messageArea');
        if (!area) return console.log(text);
        
        const msg = document.createElement('div');
        msg.className = `status-message ${type}`;
        msg.textContent = text;
        area.appendChild(msg);
        
        setTimeout(() => area.removeChild(msg), 3000);
    },

    async refresh() {
        const btn = document.getElementById('refreshBtn');
        btn?.classList.add('loading');
        
        try {
            await Promise.all([
                Portfolio.fetchRates(),
                Portfolio.updateValue()
            ]);
            
            const wallets = Portfolio.getWallets();
            if (wallets.length > 0) {
                console.log(`Refreshing ${wallets.length} wallet balances...`);
                
                wallets.forEach(wallet => {
                    const card = document.querySelector(`[data-chain="${wallet.chain}"][data-address="${wallet.address}"]`);
                    if (card && !card.querySelector('.wallet-loading-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'wallet-loading-overlay';
                        overlay.setAttribute('data-wallet', wallet.address);
                        overlay.innerHTML = `
                            <div class="wallet-loading-content">
                                <div class="wallet-loading-spinner"></div>
                                <div class="wallet-loading-text">Updating...</div>
                            </div>
                        `;
                        card.appendChild(overlay);
                    }
                });
                
                await Wallet.loadRealDataInBackground(wallets);
            }
            
            if (window.UI && window.UI.updateTicker) {
                UI.updateTicker();
            }
            
            this.message('All data refreshed successfully!');
            
        } catch (error) {
            console.error('Refresh failed:', error);
            this.message('Failed to refresh data', 'error');
        } finally {
            btn?.classList.remove('loading');
        }
    },

    createChart() {
        const ctx = document.getElementById('myChart');
        if (!ctx) return;
        
        document.getElementById('chartOverlay')?.classList.add('hidden');
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Loading...'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#FF6B35'],
                    borderColor: '#1a1a1a',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '60%'
            }
        });
    },

    updateChart(portfolioData, currency) {
        if (!this.chart || !portfolioData.wallets) return;
        
        const values = [];
        const labels = [];
        const colors = ['#FF6B35', '#9945FF', '#27AE60', '#3498DB', '#E74C3C'];
        
        portfolioData.wallets.forEach((wallet, i) => {
            const value = Portfolio.convert(wallet.totalValue || 0, 'usd', currency);
            const chain = this.chains[wallet.chain];
            labels.push(wallet.name || `${chain?.name || wallet.chain} Wallet`);
            values.push(value);
        });
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.data.datasets[0].backgroundColor = colors.slice(0, values.length);
        this.chart.update();
    },

    filterWallets() {
        const chainFilter = document.getElementById('chainFilter').value;
        const valueFilter = document.getElementById('valueFilter').value;
        
        document.querySelectorAll('.wallet-card').forEach(card => {
            let show = true;
            if (chainFilter && card.dataset.chain !== chainFilter) show = false;
            if (valueFilter && parseInt(card.dataset.value) < parseInt(valueFilter)) show = false;
            card.style.display = show ? 'block' : 'none';
        });
    },

    showWalletModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;';
        
        modal.innerHTML = `
            <div style="background:#1a1a1a;border-radius:15px;padding:30px;max-width:500px;width:90%;color:#fff;border:2px solid #444;">
                <h3 style="margin-bottom:20px;text-align:center;color:#fff;">Connect Wallet</h3>
                
                <div style="display:flex;flex-direction:column;gap:15px;margin-bottom:25px;">
                    <button class="wallet-connect-btn" data-chain="ethereum" style="background:linear-gradient(135deg,#627eea,#4e6cd8);color:white;border:none;padding:15px 20px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:600;">
                        🦊 Connect Ethereum (MetaMask)
                    </button>
                    <button class="wallet-connect-btn" data-chain="polygon" style="background:linear-gradient(135deg,#8247e5,#6f28d1);color:white;border:none;padding:15px 20px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:600;">
                        🔷 Connect Polygon (MetaMask)
                    </button>
                    <button class="wallet-connect-btn" data-chain="bsc" style="background:linear-gradient(135deg,#f3ba2f,#e8a317);color:white;border:none;padding:15px 20px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:600;">
                        ⚡ Connect BSC (MetaMask)
                    </button>
                    <button class="wallet-connect-btn" data-chain="solana" style="background:linear-gradient(135deg,#9945ff,#7d39e6);color:white;border:none;padding:15px 20px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:600;">
                        👻 Connect Solana (Phantom)
                    </button>
                </div>
                
                <div style="text-align:center;margin:20px 0;color:#666;font-size:14px;">- OR -</div>
                
                <button class="manual-wallet-btn" style="background:linear-gradient(135deg,#3498db,#2980b9);color:white;border:none;padding:15px 20px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:600;width:100%;margin-bottom:15px;">
                    ⌨️ Add Wallet Manually
                </button>
                
                <button class="modal-close-btn" style="background:none;color:#888;border:none;padding:10px;width:100%;margin-top:10px;cursor:pointer;font-size:14px;">
                    Cancel
                </button>
            </div>
        `;
        
        modal.querySelectorAll('.wallet-connect-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chain = btn.getAttribute('data-chain');
                Wallet.connect(chain);
                modal.remove();
            });
        });
        
        modal.querySelector('.manual-wallet-btn').addEventListener('click', () => {
            modal.remove();
            this.showManualWalletModal();
        });
        
        modal.querySelector('.modal-close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
    },

    showManualWalletModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;';
        
        modal.innerHTML = `
            <div style="background:#1a1a1a;border-radius:15px;padding:30px;max-width:500px;width:90%;color:#fff;border:2px solid #444;">
                <h3 style="margin-bottom:20px;text-align:center;color:#fff;">Add Wallet Manually</h3>
                
                <form class="manual-wallet-form" style="display:flex;flex-direction:column;gap:20px;">
                    <div>
                        <label style="display:block;margin-bottom:8px;color:#ccc;font-weight:600;">Blockchain:</label>
                        <select class="chain-select" style="width:100%;padding:12px;border:2px solid #444;border-radius:8px;background:#2a2a2a;color:#fff;font-size:14px;">
                            <option value="">Select blockchain...</option>
                            <option value="ethereum">Ethereum</option>
                            <option value="polygon">Polygon</option>
                            <option value="bsc">BSC</option>
                            <option value="solana">Solana</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display:block;margin-bottom:8px;color:#ccc;font-weight:600;">Wallet Address:</label>
                        <input type="text" class="address-input" placeholder="0x... or SOL address" style="width:100%;padding:12px;border:2px solid #444;border-radius:8px;background:#2a2a2a;color:#fff;font-size:14px;font-family:monospace;">
                        <div class="address-validation" style="margin-top:5px;font-size:12px;color:#888;"></div>
                    </div>
                    
                    <div>
                        <label style="display:block;margin-bottom:8px;color:#ccc;font-weight:600;">Wallet Name (optional):</label>
                        <input type="text" class="name-input" placeholder="e.g., Main Wallet, Trading Wallet..." style="width:100%;padding:12px;border:2px solid #444;border-radius:8px;background:#2a2a2a;color:#fff;font-size:14px;">
                    </div>
                    
                    <div style="display:flex;gap:15px;margin-top:10px;">
                        <button type="button" class="manual-cancel-btn" style="flex:1;background:#444;color:#ccc;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;">
                            Cancel
                        </button>
                        <button type="submit" class="manual-add-btn" style="flex:1;background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;" disabled>
                            Add Wallet
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        const chainSelect = modal.querySelector('.chain-select');
        const addressInput = modal.querySelector('.address-input');
        const nameInput = modal.querySelector('.name-input');
        const validationDiv = modal.querySelector('.address-validation');
        const addBtn = modal.querySelector('.manual-add-btn');
        const form = modal.querySelector('.manual-wallet-form');
        
        function validateAddress() {
            const chain = chainSelect.value;
            const address = addressInput.value.trim();
            
            if (!chain || !address) {
                validationDiv.textContent = '';
                addBtn.disabled = true;
                return;
            }
            
            let isValid = false;
            
            if (chain === 'solana') {
                isValid = address.length >= 32 && address.length <= 44 && /^[A-Za-z0-9]+$/.test(address);
                validationDiv.textContent = isValid ? '✅ Valid Solana address' : '❌ Invalid Solana address (32-44 characters)';
            } else {
                isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
                validationDiv.textContent = isValid ? '✅ Valid EVM address' : '❌ Invalid address (must start with 0x and be 42 characters)';
            }
            
            validationDiv.style.color = isValid ? '#27ae60' : '#e74c3c';
            addBtn.disabled = !isValid;
        }
        
        chainSelect.addEventListener('change', validateAddress);
        addressInput.addEventListener('input', validateAddress);
        
        modal.querySelector('.manual-cancel-btn').addEventListener('click', () => modal.remove());
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const chain = chainSelect.value;
            const address = addressInput.value.trim();
            const name = nameInput.value.trim();
            
            addBtn.textContent = 'Adding...';
            addBtn.disabled = true;
            
            try {
                await Wallet.addManually(chain, address, name);
                modal.remove();
            } catch (error) {
                addBtn.textContent = 'Add Wallet';
                addBtn.disabled = false;
                validationDiv.textContent = `❌ ${error.message}`;
                validationDiv.style.color = '#e74c3c';
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
        
        setTimeout(() => chainSelect.focus(), 100);
    },

    showEditNameModal(address, chain, currentName) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;';
        
        modal.innerHTML = `
            <div style="background:#1a1a1a;border-radius:15px;padding:30px;max-width:400px;width:90%;color:#fff;border:2px solid #444;">
                <h3 style="margin-bottom:20px;text-align:center;color:#fff;">Edit Wallet Name</h3>
                
                <form class="edit-name-form" style="display:flex;flex-direction:column;gap:20px;">
                    <div>
                        <label style="display:block;margin-bottom:8px;color:#ccc;font-weight:600;">Wallet Name:</label>
                        <input type="text" class="name-input" value="${currentName}" style="width:100%;padding:12px;border:2px solid #444;border-radius:8px;background:#2a2a2a;color:#fff;font-size:14px;">
                    </div>
                    
                    <div style="display:flex;gap:15px;">
                        <button type="button" class="edit-cancel-btn" style="flex:1;background:#444;color:#ccc;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;">
                            Cancel
                        </button>
                        <button type="submit" class="edit-save-btn" style="flex:1;background:linear-gradient(135deg,#3498db,#2980b9);color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
                            Save Name
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        const nameInput = modal.querySelector('.name-input');
        const form = modal.querySelector('.edit-name-form');
        
        modal.querySelector('.edit-cancel-btn').addEventListener('click', () => modal.remove());
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = nameInput.value.trim() || `${this.chains[chain].name} Wallet`;
            
            Wallet.updateName(address, chain, newName);
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
    },

    updateEmpty() {
        const empty = document.getElementById('emptyState');
        const container = document.getElementById('walletsContainer');
        if (empty) {
            empty.style.display = container?.querySelectorAll('.wallet-card').length ? 'none' : 'block';
        }
    }
};

console.log('Dark Mode UI Core loaded with wallet management and view toggle');