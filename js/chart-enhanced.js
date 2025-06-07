// js/chart-enhanced.js - Enhanced Chart Visualization

// Token Categories
const TOKEN_CATEGORIES = {
    eth: { symbols: ['ETH', 'WETH'], label: 'ETH', color: '#627eea' },
    sol: { symbols: ['SOL', 'wSOL'], label: 'SOL', color: '#9945ff' },
    matic: { symbols: ['MATIC', 'WMATIC'], label: 'MATIC', color: '#8247e5' },
    bnb: { symbols: ['BNB', 'WBNB'], label: 'BNB', color: '#f3ba2f' },
    usdc: { symbols: ['USDC'], label: 'USDC', color: '#2775ca' },
    usdt: { symbols: ['USDT'], label: 'USDT', color: '#26a17b' },
    dai: { symbols: ['DAI'], label: 'DAI', color: '#f5ac37' },
    other: { symbols: [], label: 'Other', color: '#6b7280' }
};

// Gradient Creation
function createGradients(ctx, colors) {
    return colors.map(color => {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, adjustBrightness(color, -30));
        return gradient;
    });
}

// Color Utilities
function adjustBrightness(hexColor, percent) {
    const num = parseInt(hexColor.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Data Processing
function categorizeWalletData() {
    const wallets = Portfolio?.getWallets() || [];
    const categories = {};
    
    Object.keys(TOKEN_CATEGORIES).forEach(key => {
        categories[key] = { value: 0, count: 0 };
    });

    wallets.forEach(wallet => {
        if (wallet.tokens) {
            wallet.tokens.forEach(token => {
                const symbol = token.symbol?.toUpperCase();
                const value = parseFloat(token.value) || 0;
                if (value <= 0) return;
                
                let category = 'other';
                for (const [key, cat] of Object.entries(TOKEN_CATEGORIES)) {
                    if (cat.symbols.includes(symbol)) {
                        category = key;
                        break;
                    }
                }
                
                categories[category].value += value;
                categories[category].count++;
            });
        }
    });
    
    return categories;
}

// Currency Display Updates
function updateCurrencyDisplay() {
    const currency = Portfolio?.currency || 'usd';
    
    // Update Total Value
    const totalEl = document.getElementById('totalValue');
    if (totalEl) {
        const totalValueUSD = Portfolio?.data?.totalValue || 0;
        const converted = Portfolio.convert(totalValueUSD, 'usd', currency);
        const formatted = Portfolio.format(converted, currency);
        totalEl.textContent = formatted;
        console.log(`💰 Total value updated to: ${formatted}`);
    }
    
    // Update Legend Values
    document.querySelectorAll('.legend-value-main').forEach(el => {
        const legendItem = el.closest('.legend-item');
        if (legendItem) {
            const tokenLabel = legendItem.querySelector('.token-label')?.textContent;
            if (tokenLabel) {
                const categories = categorizeWalletData();
                const categoryKey = Object.keys(TOKEN_CATEGORIES).find(key => 
                    TOKEN_CATEGORIES[key].label === tokenLabel
                );
                
                if (categoryKey && categories[categoryKey]) {
                    const usdValue = categories[categoryKey].value;
                    const converted = Portfolio.convert(usdValue, 'usd', currency);
                    const formatted = Portfolio.format(converted, currency);
                    el.textContent = formatted;
                }
            }
        }
    });
}

// Loading States
function showLoadingOverlay() {
    const container = document.querySelector('.chart-info') || document.getElementById('chartLegend')?.parentElement;
    if (!container) return;
    
    container.querySelector('.loading-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay enhanced-loading';
    overlay.innerHTML = `
        <div class="loading-content enhanced-content">
            <div class="spinner enhanced-spinner"></div>
            <div class="loading-text">Loading Portfolio...</div>
        </div>
    `;
    
    container.style.position = 'relative';
    container.appendChild(overlay);
}

function hideLoadingOverlay() {
    document.querySelectorAll('.loading-overlay').forEach(el => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    });
}

// Chart Creation
function createEnhancedChart() {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;
    
    document.getElementById('chartOverlay')?.classList.add('hidden');
    
    if (UI?.chart) UI.chart.destroy();
    
    const context = ctx.getContext('2d');
    
    UI.chart = new Chart(context, {
        type: 'doughnut',
        data: {
            labels: ['Loading...'],
            datasets: [{
                data: [1],
                backgroundColor: ['#627eea'],
                borderColor: '#ffffff',
                borderWidth: 3,
                borderRadius: 12,
                borderSkipped: false,
                hoverBorderWidth: 4,
                hoverBorderColor: '#ffffff',
                hoverBackgroundColor: function(context) {
                    const color = context.dataset.backgroundColor[context.dataIndex];
                    return adjustBrightness(color, 20);
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            
            // Animations
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            
            // Interactions
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 16,
                    displayColors: true,
                    boxPadding: 8,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: (context) => {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            
                            const currency = Portfolio?.currency || 'usd';
                            const formattedValue = Portfolio?.format ? Portfolio.format(value, currency) : value.toFixed(2);
                            
                            return `${formattedValue} (${percentage}%)`;
                        },
                        afterLabel: function(context) {
                            return '';
                        }
                    }
                }
            },
            
            // Hover Effects
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            
            // Layout
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 20,
                    right: 20
                }
            }
        },
        
        // Shadow Plugin
        plugins: [{
            beforeDraw: function(chart) {
                const ctx = chart.ctx;
                ctx.save();
                
                ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            },
            afterDraw: function(chart) {
                chart.ctx.restore();
            }
        }]
    });
    
    setTimeout(() => updateEnhancedChart(), 1000);
}

// Chart Updates
function updateEnhancedChart() {
    if (!UI?.chart) {
        createEnhancedChart();
        return;
    }
    
    const categories = categorizeWalletData();
    const currency = Portfolio?.currency || 'usd';
    const totalValue = Object.values(categories).reduce((sum, cat) => sum + cat.value, 0);
    
    console.log(`📊 Updating enhanced chart with currency: ${currency}, total value: ${totalValue}`);
    
    // Loading State
    const wallets = Portfolio?.getWallets() || [];
    if (wallets.length > 0 && totalValue === 0) {
        showLoadingOverlay();
    } else {
        hideLoadingOverlay();
    }
    
    // Chart Data
    const labels = [];
    const data = [];
    const colors = [];
    const hoverColors = [];
    
    Object.entries(categories).forEach(([key, category]) => {
        if (category.value > 0) {
            const convertedValue = Portfolio.convert(category.value, 'usd', currency);
            labels.push(TOKEN_CATEGORIES[key].label);
            data.push(convertedValue);
            
            const baseColor = TOKEN_CATEGORIES[key].color;
            colors.push(baseColor);
            hoverColors.push(adjustBrightness(baseColor, 15));
            
            console.log(`📊 Enhanced Category ${key}: ${category.value} USD -> ${convertedValue} ${currency}`);
        }
    });
    
    if (data.length === 0) {
        labels.push('Connect Wallets');
        data.push(1);
        colors.push('#627eea');
        hoverColors.push('#7c93f0');
    }
    
    // Update Chart
    UI.chart.data.labels = labels;
    UI.chart.data.datasets[0].data = data;
    UI.chart.data.datasets[0].backgroundColor = colors;
    UI.chart.data.datasets[0].hoverBackgroundColor = hoverColors;
    
    UI.chart.update('active');
    
    updateEnhancedLegend(categories, currency, totalValue);
    updateCurrencyDisplay();
}

// Legend Updates
function updateEnhancedLegend(categories, currency, totalValue) {
    const container = document.getElementById('chartLegend');
    if (!container) return;
    
    // Header
    const holdingsHeader = container.closest('.chart-info')?.querySelector('h4');
    if (holdingsHeader) {
        holdingsHeader.innerHTML = '📊 Portfolio Holdings';
        holdingsHeader.style.textAlign = 'center';
        holdingsHeader.style.marginBottom = '20px';
        holdingsHeader.style.fontSize = '1.1rem';
        holdingsHeader.style.fontWeight = '600';
    }
    
    let html = '';
    
    if (totalValue === 0) {
        html = `
            <li class="enhanced-legend-item empty-state">
                <div class="legend-label">
                    <div class="legend-gradient-circle" style="background: linear-gradient(135deg, #627eea, #7c93f0);"></div>
                    <span class="enhanced-label">🚀 Connect wallets to see portfolio</span>
                </div>
            </li>
        `;
    } else {
        Object.entries(categories).forEach(([key, category]) => {
            if (category.value > 0) {
                const convertedValue = Portfolio.convert(category.value, 'usd', currency);
                const formatted = Portfolio.format(convertedValue, currency);
                const percentage = ((category.value / totalValue) * 100).toFixed(1);
                const baseColor = TOKEN_CATEGORIES[key].color;
                const gradientColor = adjustBrightness(baseColor, 20);
                
                console.log(`📋 Enhanced Legend ${key}: ${category.value} USD -> ${convertedValue} ${currency} -> ${formatted}`);
                
                html += `
                    <li class="enhanced-legend-item" data-category="${key}">
                        <div class="legend-label">
                            <div class="legend-gradient-circle" style="background: linear-gradient(135deg, ${baseColor}, ${gradientColor});"></div>
                            <span class="enhanced-label">${TOKEN_CATEGORIES[key].label}</span>
                        </div>
                        <div class="enhanced-legend-values">
                            <div class="legend-value-main enhanced-value">${formatted}</div>
                            <div class="legend-value-sub enhanced-sub">${percentage}% • ${category.count} token${category.count !== 1 ? 's' : ''}</div>
                            <div class="enhanced-progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%; background: linear-gradient(90deg, ${baseColor}, ${gradientColor});"></div>
                            </div>
                        </div>
                    </li>
                `;
            }
        });
    }
    
    container.innerHTML = html;
    
    // Hover Effects
    container.querySelectorAll('.enhanced-legend-item').forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            if (UI?.chart && item.dataset.category !== undefined) {
                UI.chart.setActiveElements([{datasetIndex: 0, index: index}]);
                UI.chart.update('none');
            }
        });
        
        item.addEventListener('mouseleave', () => {
            if (UI?.chart) {
                UI.chart.setActiveElements([]);
                UI.chart.update('none');
            }
        });
    });
}

// Auto Updates
function setupAutoUpdate() {
    if (!Portfolio) return;
    
    const original = {
        save: Portfolio.saveWallet,
        remove: Portfolio.removeWallet,
        setCurrency: Portfolio.setCurrency,
        updateValue: Portfolio.updateValue
    };
    
    Portfolio.saveWallet = function(wallet) {
        const result = original.save?.call(this, wallet);
        setTimeout(updateEnhancedChart, 800);
        return result;
    };
    
    Portfolio.removeWallet = function(address, chain) {
        const result = original.remove?.call(this, address, chain);
        setTimeout(updateEnhancedChart, 800);
        return result;
    };
    
    Portfolio.setCurrency = function(currency) {
        console.log(`🔄 Enhanced Chart: Currency changing to ${currency}`);
        const result = original.setCurrency?.call(this, currency);
        setTimeout(updateEnhancedChart, 100);
        return result;
    };
    
    Portfolio.updateValue = function() {
        const result = original.updateValue?.call(this);
        setTimeout(updateEnhancedChart, 1200);
        return result;
    };
    
    if (UI) {
        UI.updateChart = updateEnhancedChart;
        UI.createChart = createEnhancedChart;
    }
}

// Initialization
function initChart() {
    if (typeof Chart === 'undefined' || !UI || !Portfolio) {
        setTimeout(initChart, 500);
        return;
    }
    
    setupAutoUpdate();
    createEnhancedChart();
}

// Enhanced Styling
if (!document.getElementById('enhanced-chart-css')) {
    const css = `
        /* Enhanced Loading */
        .enhanced-loading {
            background: radial-gradient(circle at center, rgba(0,0,0,0.9), rgba(0,0,0,0.7));
            backdrop-filter: blur(4px);
        }
        
        .enhanced-content {
            background: rgba(20, 20, 20, 0.9);
            border-radius: 16px;
            padding: 30px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        
        .enhanced-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(98, 126, 234, 0.3);
            border-top: 3px solid #627eea;
            border-radius: 50%;
            animation: enhancedSpin 1.5s linear infinite;
            margin: 0 auto 15px;
        }
        
        .loading-text {
            color: #fff;
            font-size: 0.95rem;
            font-weight: 500;
        }
        
        @keyframes enhancedSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Enhanced Legend */
        .enhanced-legend-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .enhanced-legend-item:hover {
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin: 0 -8px;
            padding: 16px 8px;
        }
        
        .enhanced-legend-item:last-child {
            border-bottom: none;
        }
        
        .enhanced-legend-item.empty-state {
            justify-content: center;
            cursor: default;
        }
        
        .legend-gradient-circle {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.2);
        }
        
        .enhanced-label {
            font-weight: 600;
            color: var(--text-1);
            margin-left: 12px;
            font-size: 0.95rem;
        }
        
        .enhanced-legend-values {
            text-align: right;
            min-width: 130px;
        }
        
        .enhanced-value {
            font-weight: 700;
            margin-bottom: 6px;
            color: var(--text-1);
            font-size: 1rem;
        }
        
        .enhanced-sub {
            font-size: 0.8rem;
            color: var(--text-3);
            margin-bottom: 8px;
            opacity: 0.8;
        }
        
        .enhanced-progress-bar {
            width: 120px;
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-left: auto;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
        }
        
        .progress-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.8s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        
        /* Chart Container */
        .chart-container {
            position: relative;
            overflow: hidden;
        }
        
        .chart-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.05) 70%);
            pointer-events: none;
            z-index: 1;
        }
        
        #myChart {
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
        }
    `;
    
    const style = document.createElement('style');
    style.id = 'enhanced-chart-css';
    style.textContent = css;
    document.head.appendChild(style);
}

// Module Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChart);
} else {
    initChart();
}

// Global Exports
window.updateEnhancedChart = updateEnhancedChart;
window.createEnhancedChart = createEnhancedChart;
window.updateCurrencyDisplay = updateCurrencyDisplay;

console.log('📊 Enhanced Chart loaded');