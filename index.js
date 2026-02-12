const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.post('/api/convert-mq', async (req, res) => {
  try {
    const { mq_code, mq_version } = req.body;
    
    console.log('🔵 Conversion request');
    console.log('MQ version:', mq_version);
    console.log('Code length:', mq_code?.length);
    
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are an expert MQL to JavaScript converter for cryptocurrency trading strategies.

# TASK
Convert this ${mq_version} Expert Advisor to a clean JavaScript trading strategy.

# INPUT CODE
\`\`\`
${mq_code}
\`\`\`

# OUTPUT FORMAT
Return ONLY a JSON object with this exact structure (no markdown, no explanations):

{
  "js_code": "function runStrategy(candles, settings) { ... }",
  "parameters": {
    "paramName": {
      "type": "number" | "boolean" | "select",
      "default": value,
      "min": number,
      "max": number,
      "step": number,
      "label": "Display Name",
      "category": "strategy" | "advanced",
      "options": ["opt1", "opt2"]  // only for select type
    }
  }
}

# CONVERSION RULES

## 1. CORE FUNCTION
- Function signature: \`function runStrategy(candles, settings) { return {...} }\`
- Input \`candles\`: Array of {timestamp, open, high, low, close, volume}
- Input \`settings\`: Object containing all parameters + base settings (symbol, timeframe, market_type, initialBalance, leverage, etc)
- Output: {trades: [], equity_curve: [], roi, mdd, win_rate, total_trades, final_balance, ...}

## 2. WHAT TO INCLUDE
✅ Core entry/exit logic (MASTER strategy only, ignore SLAVE/hedging)
✅ Trailing stops, break-even stops
✅ All user-adjustable parameters (lot size → position size, TP, SL, indicator periods, etc)
✅ Technical indicators: RSI, Stochastic, Bollinger Bands, MACD, ATR, MA, EMA
✅ Time filters, volume filters
✅ Risk management (max position, max trades, daily limits)
✅ Money management settings

## 3. WHAT TO EXCLUDE
❌ Multiple EA coordination (slaves, masters)
❌ News filters (calendar APIs)
❌ Email/notification systems
❌ Broker-specific code (magic numbers for order routing)
❌ Visual drawing (trendlines, arrows on chart)
❌ File I/O operations

## 4. TECHNICAL INDICATORS
Use simple inline implementations or reference standard formulas:

\`\`\`javascript
// RSI
function calculateRSI(prices, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i < period + 1; i++) {
    const change = prices[i] - prices[i-1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Simple MA
function calculateMA(prices, period) {
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// EMA
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Bollinger Bands
function calculateBB(prices, period, deviation) {
  const ma = calculateMA(prices, period);
  const variance = prices.slice(-period).reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: ma + deviation * std, middle: ma, lower: ma - deviation * std };
}
\`\`\`

## 5. FOREX → CRYPTO CONVERSION
- \`Lots\` → Position size in USDT (1 lot = 100 USDT minimum, scale from settings.equityPercent)
- \`Points/Pips\` → Price difference (BTC: $1, ETH: $0.01, etc)
- \`OrderSend()\` → Simulated trades with entry/exit tracking
- \`AccountBalance()\` → \`balance\` variable (start from settings.initialBalance)
- Leverage: Use \`settings.market_type === 'futures' ? settings.leverage : 1\`
- Fees: \`settings.feePercent\` (default 0.05% for futures, 0.1% for spot)

## 6. PARAMETERS EXTRACTION
For every \`input\` or \`extern\` variable in MQ code:
- Extract name, type, default value
- Infer min/max from context (e.g., period: min=2, max=200)
- Set category: "strategy" for core logic, "advanced" for filters/risk
- Use clear labels: "RSI Period", "Take Profit %", "Max Position Size (USDT)"

Example:
\`\`\`
input int RSI_Period = 14;  // RSI calculation period
→
"rsiPeriod": {
  "type": "number",
  "default": 14,
  "min": 2,
  "max": 100,
  "step": 1,
  "label": "RSI Period",
  "category": "strategy"
}
\`\`\`

## 7. MASTERREVERSE SUPPORT
Add logic to flip signals when \`settings.masterReverse === true\`:
\`\`\`javascript
if (buySignal) {
  position = settings.masterReverse ? "short" : "long";
}
if (sellSignal) {
  position = settings.masterReverse ? "long" : "short";
}
\`\`\`

## 8. TRADE TRACKING
Track every trade with:
\`\`\`javascript
trades.push({
  entry_time: candles[entryIdx].timestamp,
  entry_price: entryPrice,
  exit_time: candles[i].timestamp,
  exit_price: exitPrice,
  side: position.toUpperCase(),
  pnl: profitLoss,
  fee: totalFee,
  size: positionSize,
  duration: i - entryIdx,
  order_type: "BUY STOP" | "SELL STOP" | "BUY LIMIT" | "SELL LIMIT",
  balance: currentBalance
});
\`\`\`

## 9. EQUITY CURVE
Track balance and equity (including unrealized P&L) at every candle:
\`\`\`javascript
equityCurve.push({
  timestamp: candles[i].timestamp,
  balance: balance,
  equity: balance + unrealizedPnL,
  drawdown: (peak - equity) / peak * 100
});
\`\`\`

## 10. RETURN OBJECT
\`\`\`javascript
return {
  trades: trades,
  equity_curve: equityCurve,
  roi: ((finalBalance - initialBalance) / initialBalance * 100).toFixed(2),
  mdd: maxDrawdown.toFixed(2),
  win_rate: (winTrades / totalTrades * 100).toFixed(2),
  total_trades: totalTrades,
  final_balance: finalBalance.toFixed(2),
  initial_balance: initialBalance,
  symbol: settings.symbol,
  // ... other stats
};
\`\`\`

# IMPORTANT
- Return ONLY valid JSON (no \`\`\`json wrapper)
- js_code must be a complete, runnable function
- Test your conversion logic mentally - does it make trading sense?
- Be conservative: if unsure about a feature, omit it with a comment

Begin conversion now.`
        }]
      })
    });
    
    console.log('🔵 Status:', response.status);
    
    const data = await response.json();
    
    if (data.error) {
      console.log('❌ API Error:', data.error);
      return res.status(400).json({ error: data.error.message });
    }
    
    const responseText = data.content?.[0]?.text || '';
    console.log('🔵 Response length:', responseText.length);
    
    // JSON 파싱 (```json 제거)
    let result;
    try {
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanText);
    } catch (parseError) {
      console.log('⚠️ JSON parse failed, returning as js_code only');
      result = { js_code: responseText, parameters: {} };
    }
    
    console.log('✅ Success');
    console.log('- Code length:', result.js_code?.length);
    console.log('- Parameters:', Object.keys(result.parameters || {}).length);
    
    res.json({ 
      success: true, 
      js_code: result.js_code,
      parameters: result.parameters || {}
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'anthropic-proxy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy running on port ${PORT}`);
});
