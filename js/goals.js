// js/goals.js - Goals Management System

const Goals = {
    // State Management
    goals: {
        eth: 0,
        sol: 0,
        bnb: 0,
        usdc: 0,
        usdt: 0,
        dai: 0
    },
    storageKey: 'crypto_portfolio_goals',

    // Currency Colors
    colors: {
        eth: '#627eea',
        sol: '#9945ff',
        bnb: '#f3ba2f',
        usdc: '#2775ca',
        usdt: '#26a17b',
        dai: '#f5ac37'
    },

    // Initialization
    init() {
        this.loadGoals();
        this.setupEvents();
        this.updateGoalsDisplay();
        console.log('🎯 Goals system initialized');
    },

    // Storage Management
    loadGoals() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.goals = { ...this.goals, ...JSON.parse(saved) };
                delete this.goals.usd;
            }
        } catch (error) {
            console.warn('Failed to load goals:', error);
        }
    },

    saveGoals() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.goals));
        } catch (error) {
            console.warn('Failed to save goals:', error);
        }
    },

    // Event Setup
    setupEvents() {
        const editBtn = document.getElementById('editGoalsBtn');
        if (editBtn) {
            editBtn.replaceWith(editBtn.cloneNode(true));
            const newEditBtn = document.getElementById('editGoalsBtn');
            
            newEditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showGoalsModal();
            });
        }
    },

    // Holdings Calculation
    getCurrentHoldings() {
        const wallets = Portfolio?.getWallets() || [];
        const holdings = {
            eth: 0,
            sol: 0,
            bnb: 0,
            usdc: 0,
            usdt: 0,
            dai: 0
        };

        wallets.forEach(wallet => {
            if (wallet.tokens) {
                wallet.tokens.forEach(token => {
                    const symbol = token.symbol?.toLowerCase();
                    const balance = parseFloat(token.balance) || 0;

                    switch (symbol) {
                        case 'eth':
                        case 'weth':
                            holdings.eth += balance;
                            break;
                        case 'sol':
                        case 'wsol':
                            holdings.sol += balance;
                            break;
                        case 'bnb':
                        case 'wbnb':
                            holdings.bnb += balance;
                            break;
                        case 'usdc':
                            holdings.usdc += balance;
                            break;
                        case 'usdt':
                            holdings.usdt += balance;
                            break;
                        case 'dai':
                            holdings.dai += balance;
                            break;
                    }
                });
            }
        });

        return holdings;
    },

    // Progress Calculation
    calculateProgress(current, goal) {
        if (!goal || goal <= 0) return 0;
        return Math.min((current / goal) * 100, 100);
    },

    // Value Formatting
    formatValue(value, currency) {
        if (!value) return '0';
        
        const decimals = currency === 'bnb' ? 4 : 2;
        
        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    },

    // Display Updates
    updateGoalsDisplay() {
        const container = document.getElementById('goalsList');
        if (!container) return;

        const holdings = this.getCurrentHoldings();
        let html = '';

        const goalOrder = ['eth', 'sol', 'bnb', 'usdc', 'usdt', 'dai'];

        goalOrder.forEach(currency => {
            const goal = this.goals[currency];
            if (goal > 0) {
                const current = holdings[currency] || 0;
                const progress = this.calculateProgress(current, goal);
                const color = this.colors[currency];

                html += `
                    <li class="goal-item">
                        <div class="goal-label">
                            <div class="goal-color" style="background: ${color};"></div>
                            <span class="goal-symbol">${currency.toUpperCase()}</span>
                        </div>
                        <div class="goal-progress">
                            <div class="goal-percentage">${progress.toFixed(0)}%</div>
                            <div class="goal-values">${this.formatValue(current, currency)} / ${this.formatValue(goal, currency)}</div>
                            <div class="goal-progress-bar">
                                <div class="goal-progress-fill" style="width: ${progress}%; background: ${color};"></div>
                            </div>
                        </div>
                    </li>
                `;
            }
        });

        if (html === '') {
            html = `
                <li class="goal-item">
                    <div class="goal-label">
                        <span style="color: var(--text-3); font-style: italic;">No goals set</span>
                    </div>
                    <div class="goal-progress">
                        <div class="goal-values" style="color: var(--text-3);">Click Edit to add goals</div>
                    </div>
                </li>
            `;
        }

        container.innerHTML = html;
    },

    // Modal Management
    showGoalsModal() {
        const existingModal = document.querySelector('.goals-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'goals-modal';
        modal.innerHTML = `
            <div class="goals-modal-content">
                <h3>🎯 Set Your Goals</h3>
                <div class="goals-form">
                    ${Object.entries(this.goals).map(([currency, value]) => `
                        <div class="goal-input-group">
                            <label class="goal-input-label">${currency.toUpperCase()}:</label>
                            <input 
                                type="number" 
                                class="goal-input" 
                                data-currency="${currency}"
                                value="${value || ''}"
                                placeholder="Enter goal amount"
                                min="0"
                                step="any"
                            >
                        </div>
                    `).join('')}
                </div>
                <div class="goals-modal-buttons">
                    <button class="goals-cancel-btn">Cancel</button>
                    <button class="goals-save-btn">Save Goals</button>
                </div>
            </div>
        `;

        // Event Handlers
        const cancelBtn = modal.querySelector('.goals-cancel-btn');
        const saveBtn = modal.querySelector('.goals-save-btn');
        
        const closeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        };

        const saveGoals = () => {
            this.saveGoalsFromModal(modal);
            closeModal();
        };

        cancelBtn.addEventListener('click', closeModal, { once: true });
        saveBtn.addEventListener('click', saveGoals, { once: true });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        }, { once: true });

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEscape);

        document.body.appendChild(modal);

        setTimeout(() => {
            const firstInput = modal.querySelector('.goal-input');
            if (firstInput) firstInput.focus();
        }, 100);
    },

    saveGoalsFromModal(modal) {
        const inputs = modal.querySelectorAll('.goal-input');
        const newGoals = {};

        inputs.forEach(input => {
            const currency = input.dataset.currency;
            if (['eth', 'sol', 'bnb', 'usdc', 'usdt', 'dai'].includes(currency)) {
                const value = parseFloat(input.value) || 0;
                newGoals[currency] = value;
            }
        });

        this.goals = newGoals;
        this.saveGoals();
        this.updateGoalsDisplay();

        if (window.UI && UI.message) {
            UI.message('✅ Goals updated successfully!');
        }

        console.log('🎯 Goals saved:', this.goals);
    },

    // Status Methods
    getGoalStatus(currency) {
        const holdings = this.getCurrentHoldings();
        const current = holdings[currency?.toLowerCase()] || 0;
        const goal = this.goals[currency?.toLowerCase()] || 0;
        const progress = this.calculateProgress(current, goal);

        return {
            current,
            goal,
            progress,
            achieved: progress >= 100,
            remaining: Math.max(goal - current, 0)
        };
    },

    getGoalsSummary() {
        const summary = {
            totalGoals: 0,
            activeGoals: 0,
            achievedGoals: 0,
            averageProgress: 0
        };

        let totalProgress = 0;
        
        Object.entries(this.goals).forEach(([currency, goal]) => {
            if (goal > 0) {
                summary.totalGoals++;
                summary.activeGoals++;
                
                const status = this.getGoalStatus(currency);
                if (status.achieved) {
                    summary.achievedGoals++;
                }
                totalProgress += status.progress;
            }
        });

        if (summary.activeGoals > 0) {
            summary.averageProgress = totalProgress / summary.activeGoals;
        }

        return summary;
    },

    // Portfolio Integration
    onPortfolioUpdate() {
        this.updateGoalsDisplay();
    }
};

// Module Integration
if (typeof window !== 'undefined') {
    window.Goals = Goals;
    
    document.addEventListener('DOMContentLoaded', () => {
        Goals.init();
        
        if (window.Portfolio) {
            const originalUpdateUI = Portfolio.updateUI;
            Portfolio.updateUI = function() {
                originalUpdateUI.call(this);
                Goals.updateGoalsDisplay();
            };
        }
    });
}

console.log('🎯 Goals system loaded');