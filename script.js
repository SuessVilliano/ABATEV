/* Ultimate Smart Panel — client-side application logic.
   No external services required: market data is simulated and
   orders/settings persist in localStorage. */
(() => {
    'use strict';

    const STORAGE_KEYS = {
        theme: 'usp_theme',
        orders: 'usp_orders',
        settings: 'usp_settings'
    };

    const BROKERS = {
        ironbeam: { name: 'IronBeam', markets: 'Futures', region: 'US', commission: '$0.80 / side' },
        oanda: { name: 'Oanda', markets: 'Forex, CFDs', region: 'Global', commission: 'Spread only' },
        alpaca: { name: 'Alpaca', markets: 'Stocks, Crypto', region: 'US', commission: 'Commission free' }
    };

    const MARKET_DATA = {
        futures: [
            { symbol: 'ES', name: 'E-mini S&P 500', price: 5450.25 },
            { symbol: 'NQ', name: 'E-mini Nasdaq 100', price: 19850.5 },
            { symbol: 'YM', name: 'E-mini Dow', price: 40120 },
            { symbol: 'CL', name: 'Crude Oil', price: 78.42 },
            { symbol: 'GC', name: 'Gold', price: 2345.6 },
            { symbol: 'SI', name: 'Silver', price: 29.85 }
        ],
        forex: [
            { symbol: 'EUR/USD', name: 'Euro / US Dollar', price: 1.0852 },
            { symbol: 'GBP/USD', name: 'Pound / US Dollar', price: 1.2731 },
            { symbol: 'USD/JPY', name: 'US Dollar / Yen', price: 157.24 },
            { symbol: 'AUD/USD', name: 'Aussie / US Dollar', price: 0.6648 },
            { symbol: 'USD/CAD', name: 'US Dollar / Loonie', price: 1.3712 }
        ],
        crypto: [
            { symbol: 'BTC/USD', name: 'Bitcoin', price: 67450 },
            { symbol: 'ETH/USD', name: 'Ethereum', price: 3520 },
            { symbol: 'SOL/USD', name: 'Solana', price: 148.6 },
            { symbol: 'XRP/USD', name: 'Ripple', price: 0.524 }
        ]
    };

    const state = {
        connected: false,
        activeMarket: 'futures',
        prices: {},
        orders: loadJSON(STORAGE_KEYS.orders, []),
        settings: Object.assign(
            { accountSize: 10000, defaultRisk: 1, confirmTrades: true },
            loadJSON(STORAGE_KEYS.settings, {})
        ),
        tickTimer: null
    };

    const els = {};
    [
        'connectionStatus', 'brokerSelect', 'connectBtn', 'toggleBrokerInfo', 'brokerInfo',
        'themeToggle', 'marketContent', 'symbol', 'symbolList', 'orderType', 'direction',
        'amount', 'entryPrice', 'takeProfit', 'stopLoss', 'riskReward', 'riskPercentage',
        'placeTrade', 'aiTradingToggle', 'aiTradingPopup', 'aiPopupClose', 'textToTrade',
        'executeAiTrade', 'orderHistoryContent', 'clearHistory', 'autoTradeCheck',
        'smartSettings', 'smartSettingsPanel', 'accountSize', 'defaultRisk', 'confirmTrades',
        'toast'
    ].forEach(id => { els[id] = document.getElementById(id); });

    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* storage unavailable (private mode/quota) — keep working in memory */
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    let toastTimer = null;
    function toast(message, kind = 'info') {
        els.toast.textContent = message;
        els.toast.className = `toast toast-${kind}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3500);
    }

    /* ---------- Theme ---------- */
    function applyTheme(theme) {
        document.body.classList.toggle('light-theme', theme === 'light');
        els.themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        saveJSON(STORAGE_KEYS.theme, theme);
    }

    /* ---------- Connection ---------- */
    function setConnected(connected) {
        state.connected = connected;
        const broker = BROKERS[els.brokerSelect.value].name;
        els.connectionStatus.textContent = connected ? `Connected · ${broker}` : 'Disconnected';
        els.connectionStatus.classList.toggle('status-connected', connected);
        els.connectionStatus.classList.toggle('status-disconnected', !connected);
        els.connectBtn.textContent = connected ? 'Disconnect' : 'Connect';
        clearInterval(state.tickTimer);
        if (connected) {
            state.tickTimer = setInterval(tickPrices, 2000);
        }
    }

    function renderBrokerInfo() {
        const b = BROKERS[els.brokerSelect.value];
        els.brokerInfo.innerHTML = `
            <strong>${b.name}</strong>
            <span>Markets: ${b.markets}</span>
            <span>Region: ${b.region}</span>
            <span>Commission: ${b.commission}</span>`;
    }

    /* ---------- Market data ---------- */
    function tickPrices() {
        for (const instruments of Object.values(MARKET_DATA)) {
            for (const inst of instruments) {
                const p = state.prices[inst.symbol];
                const drift = (Math.random() - 0.5) * 0.002 * p.price;
                p.prev = p.price;
                p.price = Math.max(0.0001, p.price + drift);
            }
        }
        renderMarket();
    }

    function decimalsFor(price) {
        if (price >= 1000) return 2;
        if (price >= 10) return 2;
        return 4;
    }

    function renderMarket() {
        const instruments = MARKET_DATA[state.activeMarket];
        els.marketContent.innerHTML = instruments.map(inst => {
            const p = state.prices[inst.symbol];
            const dir = p.price > p.prev ? 'up' : p.price < p.prev ? 'down' : '';
            return `
                <button type="button" class="market-card ${dir}" data-symbol="${inst.symbol}">
                    <span class="market-symbol">${inst.symbol}</span>
                    <span class="market-name">${inst.name}</span>
                    <span class="market-price">${p.price.toFixed(decimalsFor(inst.price))}</span>
                </button>`;
        }).join('');
    }

    function renderSymbolList() {
        els.symbolList.innerHTML = MARKET_DATA[state.activeMarket]
            .map(inst => `<option value="${inst.symbol}">${inst.name}</option>`)
            .join('');
    }

    function setActiveMarket(market) {
        state.activeMarket = market;
        document.querySelectorAll('.tab').forEach(tab =>
            tab.classList.toggle('active', tab.dataset.market === market));
        renderMarket();
        renderSymbolList();
    }

    function currentPrice(symbol) {
        const p = state.prices[symbol];
        return p ? p.price : null;
    }

    /* ---------- Trade form helpers ---------- */
    function num(el) {
        const v = parseFloat(el.value);
        return Number.isFinite(v) ? v : null;
    }

    function recalcTakeProfit() {
        const entry = num(els.entryPrice);
        const stop = num(els.stopLoss);
        const rr = num(els.riskReward);
        if (entry === null || stop === null || rr === null || rr <= 0) return;
        const risk = entry - stop;
        if (risk === 0) return;
        els.takeProfit.value = round(entry + risk * rr);
    }

    function recalcPositionSize() {
        const entry = num(els.entryPrice);
        const stop = num(els.stopLoss);
        const riskPct = num(els.riskPercentage);
        if (entry === null || stop === null || riskPct === null || riskPct <= 0) return;
        const perUnitRisk = Math.abs(entry - stop);
        if (perUnitRisk === 0) return;
        const riskDollars = state.settings.accountSize * (riskPct / 100);
        els.amount.value = Math.max(1, Math.floor(riskDollars / perUnitRisk));
    }

    function round(v) {
        return Math.round(v * 10000) / 10000;
    }

    function setRisk(pct) {
        els.riskPercentage.value = pct;
        recalcPositionSize();
        toast(`Risk set to ${pct}% of $${state.settings.accountSize.toLocaleString()}`);
    }

    /* ---------- Orders ---------- */
    function buildOrderFromForm(overrides = {}) {
        const symbol = els.symbol.value.trim().toUpperCase();
        if (!symbol) return { error: 'Symbol is required.' };

        const order = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            time: new Date().toISOString(),
            broker: BROKERS[els.brokerSelect.value].name,
            symbol,
            type: els.orderType.value,
            direction: els.direction.value,
            amount: num(els.amount),
            entry: num(els.entryPrice),
            takeProfit: num(els.takeProfit),
            stopLoss: num(els.stopLoss),
            status: 'filled',
            ...overrides
        };

        if (order.amount === null || order.amount <= 0) return { error: 'Amount must be greater than zero.' };
        if (order.type !== 'market' && order.entry === null) {
            return { error: `${order.type[0].toUpperCase() + order.type.slice(1)} orders require an entry price.` };
        }
        if (order.type === 'market' && order.entry === null) {
            order.entry = currentPrice(symbol);
        }
        if (order.stopLoss !== null && order.entry !== null) {
            const wrongSide = order.direction === 'buy'
                ? order.stopLoss >= order.entry
                : order.stopLoss <= order.entry;
            if (wrongSide) return { error: 'Stop loss is on the wrong side of the entry price.' };
        }
        if (order.type !== 'market') order.status = 'working';
        return { order };
    }

    function placeOrder(overrides = {}, { skipConfirm = false } = {}) {
        if (!state.connected) {
            toast('Connect to a broker before placing trades.', 'error');
            return null;
        }
        const { order, error } = buildOrderFromForm(overrides);
        if (error) {
            toast(error, 'error');
            return null;
        }
        if (state.settings.confirmTrades && !skipConfirm) {
            const summary = `${order.direction.toUpperCase()} ${order.amount} ${order.symbol} (${order.type})`
                + (order.entry !== null ? ` @ ${order.entry}` : '');
            if (!window.confirm(`Place trade: ${summary}?`)) return null;
        }
        state.orders.unshift(order);
        saveJSON(STORAGE_KEYS.orders, state.orders);
        renderOrders();
        toast(`Order placed: ${order.direction.toUpperCase()} ${order.amount} ${order.symbol}`, 'success');
        return order;
    }

    function renderOrders() {
        if (!state.orders.length) {
            els.orderHistoryContent.innerHTML = '<p class="empty-state">No orders yet.</p>';
            els.clearHistory.classList.add('hidden');
            return;
        }
        els.clearHistory.classList.remove('hidden');
        els.orderHistoryContent.innerHTML = `
            <table class="order-table">
                <thead><tr>
                    <th>Time</th><th>Broker</th><th>Symbol</th><th>Side</th><th>Type</th>
                    <th>Qty</th><th>Entry</th><th>SL</th><th>TP</th><th>Status</th>
                </tr></thead>
                <tbody>${state.orders.map(o => `
                    <tr>
                        <td>${new Date(o.time).toLocaleString()}</td>
                        <td>${escapeHtml(o.broker)}</td>
                        <td>${escapeHtml(o.symbol)}</td>
                        <td class="side-${o.direction}">${o.direction.toUpperCase()}</td>
                        <td>${o.type}</td>
                        <td>${o.amount}</td>
                        <td>${o.entry ?? '—'}</td>
                        <td>${o.stopLoss ?? '—'}</td>
                        <td>${o.takeProfit ?? '—'}</td>
                        <td>${o.status}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }

    /* ---------- Smart keys ---------- */
    function handleSmartKey(action) {
        switch (action) {
            case 'buy':
            case 'sell':
                els.direction.value = action;
                toast(`Direction: ${action.toUpperCase()}`);
                break;
            case 'market':
            case 'limit':
            case 'stop':
                els.orderType.value = action;
                toast(`Order type: ${action}`);
                break;
            case 'oco':
                if (num(els.takeProfit) === null || num(els.stopLoss) === null) {
                    toast('OCO needs both a take profit and a stop loss.', 'error');
                } else {
                    placeOrder({ type: 'oco', status: 'working' });
                }
                break;
            case 'risk1': setRisk(1); break;
            case 'risk2': setRisk(2); break;
            case 'risk3': setRisk(3); break;
            case 'sl': {
                const entry = num(els.entryPrice);
                if (entry === null) { toast('Set an entry price first.', 'error'); break; }
                const offset = entry * 0.005;
                els.stopLoss.value = round(els.direction.value === 'buy' ? entry - offset : entry + offset);
                recalcTakeProfit();
                toast('Stop loss set 0.5% from entry.');
                break;
            }
            case 'tp':
                if (num(els.riskReward) === null) els.riskReward.value = 2;
                recalcTakeProfit();
                if (num(els.takeProfit) === null) {
                    toast('Take profit needs entry, stop loss and risk:reward.', 'error');
                } else {
                    toast('Take profit calculated from risk:reward.');
                }
                break;
            case 'breakeven': {
                const entry = num(els.entryPrice);
                if (entry === null) { toast('Set an entry price first.', 'error'); break; }
                els.stopLoss.value = entry;
                toast('Stop loss moved to break even.');
                break;
            }
            case 'pyramid':
                placeOrder({ amount: Math.max(1, Math.floor((num(els.amount) || 1) / 2)) });
                break;
            case 'scalein': {
                const total = num(els.amount);
                if (total === null || total < 2) { toast('Scale in needs an amount of at least 2.', 'error'); break; }
                const half = Math.floor(total / 2);
                const first = placeOrder({ amount: half });
                if (first) placeOrder({ amount: total - half, status: 'working' }, { skipConfirm: true });
                break;
            }
            case 'instant':
                placeOrder({ type: 'market', entry: currentPrice(els.symbol.value.trim().toUpperCase()) },
                    { skipConfirm: true });
                break;
        }
    }

    /* ---------- AI trade parsing ---------- */
    function parseInstruction(text) {
        const lower = text.toLowerCase();
        const direction = /\bsell\b|\bshort\b/.test(lower) ? 'sell'
            : /\bbuy\b|\blong\b/.test(lower) ? 'buy' : null;
        if (!direction) return { error: 'Could not find a direction (buy/sell) in the instructions.' };

        const qtyMatch = lower.match(/(?:buy|sell|short|long)\s+(\d+(?:\.\d+)?)/);
        const symbolMatch = text.match(/\b([A-Z]{2,6}(?:\/[A-Z]{3})?)\b/);
        const entryMatch = lower.match(/(?:at|@|entry)\s*\$?(\d+(?:\.\d+)?)/);
        const slMatch = lower.match(/(?:sl|stop(?:\s*loss)?)\s*(?:at|@|of|:)?\s*\$?(\d+(?:\.\d+)?)/);
        const tpMatch = lower.match(/(?:tp|take\s*profit|target)\s*(?:at|@|of|:)?\s*\$?(\d+(?:\.\d+)?)/);

        if (!symbolMatch) return { error: 'Could not find a symbol (e.g. ES, BTC/USD) in the instructions.' };

        return {
            trade: {
                direction,
                symbol: symbolMatch[1],
                amount: qtyMatch ? parseFloat(qtyMatch[1]) : 1,
                entry: entryMatch ? parseFloat(entryMatch[1]) : null,
                stopLoss: slMatch ? parseFloat(slMatch[1]) : null,
                takeProfit: tpMatch ? parseFloat(tpMatch[1]) : null
            }
        };
    }

    function executeAiTrade() {
        const text = els.textToTrade.value.trim();
        if (!text) {
            toast('Enter trading instructions first.', 'error');
            return;
        }
        const { trade, error } = parseInstruction(text);
        if (error) {
            toast(error, 'error');
            return;
        }
        els.symbol.value = trade.symbol;
        els.direction.value = trade.direction;
        els.amount.value = trade.amount;
        els.entryPrice.value = trade.entry ?? '';
        els.stopLoss.value = trade.stopLoss ?? '';
        els.takeProfit.value = trade.takeProfit ?? '';
        els.orderType.value = trade.entry !== null ? 'limit' : 'market';
        const placed = placeOrder();
        if (placed) {
            els.textToTrade.value = '';
            els.aiTradingPopup.classList.add('hidden');
        }
    }

    /* ---------- Settings ---------- */
    function openSettings() {
        els.accountSize.value = state.settings.accountSize;
        els.defaultRisk.value = state.settings.defaultRisk;
        els.confirmTrades.checked = state.settings.confirmTrades;
        els.smartSettingsPanel.classList.toggle('hidden');
    }

    function saveSettings() {
        state.settings.accountSize = num(els.accountSize) || state.settings.accountSize;
        state.settings.defaultRisk = num(els.defaultRisk) || state.settings.defaultRisk;
        state.settings.confirmTrades = els.confirmTrades.checked;
        saveJSON(STORAGE_KEYS.settings, state.settings);
        els.smartSettingsPanel.classList.add('hidden');
        toast('Settings saved.', 'success');
    }

    /* ---------- Wiring ---------- */
    function init() {
        for (const instruments of Object.values(MARKET_DATA)) {
            for (const inst of instruments) {
                state.prices[inst.symbol] = { price: inst.price, prev: inst.price };
            }
        }

        applyTheme(loadJSON(STORAGE_KEYS.theme, 'dark'));
        els.themeToggle.addEventListener('click', () =>
            applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light'));

        els.connectBtn.addEventListener('click', () => setConnected(!state.connected));
        els.brokerSelect.addEventListener('change', () => {
            renderBrokerInfo();
            if (state.connected) setConnected(true);
        });
        els.toggleBrokerInfo.addEventListener('click', () => els.brokerInfo.classList.toggle('hidden'));

        document.querySelectorAll('.tab').forEach(tab =>
            tab.addEventListener('click', () => setActiveMarket(tab.dataset.market)));

        els.marketContent.addEventListener('click', e => {
            const card = e.target.closest('.market-card');
            if (!card) return;
            els.symbol.value = card.dataset.symbol;
            els.entryPrice.value = round(currentPrice(card.dataset.symbol));
            toast(`${card.dataset.symbol} loaded into trade ticket.`);
        });

        document.querySelectorAll('.smart-key[data-action]').forEach(btn =>
            btn.addEventListener('click', () => handleSmartKey(btn.dataset.action)));

        [els.entryPrice, els.stopLoss, els.riskReward].forEach(el =>
            el.addEventListener('input', recalcTakeProfit));
        [els.entryPrice, els.stopLoss, els.riskPercentage].forEach(el =>
            el.addEventListener('input', recalcPositionSize));

        els.placeTrade.addEventListener('click', () => placeOrder());

        els.aiTradingToggle.addEventListener('click', () => els.aiTradingPopup.classList.toggle('hidden'));
        els.aiPopupClose.addEventListener('click', () => els.aiTradingPopup.classList.add('hidden'));
        els.executeAiTrade.addEventListener('click', executeAiTrade);

        els.smartSettings.addEventListener('click', openSettings);
        document.getElementById('saveSettings').addEventListener('click', saveSettings);

        els.clearHistory.addEventListener('click', () => {
            if (!window.confirm('Clear all order history?')) return;
            state.orders = [];
            saveJSON(STORAGE_KEYS.orders, state.orders);
            renderOrders();
        });

        els.autoTradeCheck.addEventListener('change', () =>
            toast(`Hybrid AI auto trade ${els.autoTradeCheck.checked ? 'enabled' : 'disabled'} (simulated).`));

        setConnected(false);
        renderBrokerInfo();
        setActiveMarket('futures');
        renderOrders();
        els.riskPercentage.value = state.settings.defaultRisk;
    }

    document.addEventListener('DOMContentLoaded', init);
})();
