const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));  // ← 10mb → 100mb
app.use(express.text({ limit: '100mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_PATH = '/data/candles';

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
        model: 'claude-sonnet-4-5-20250929',
max_tokens: 8000,
        messages: [{
          role: 'user',
content: `Convert ${mq_version} EA to JavaScript.

CODE:
\`\`\`
${mq_code}
\`\`\`

OUTPUT (JSON only, no markdown):
{
  "js_code": "function runStrategy(candles, settings) {...}",
  "parameters": {"paramName": {"type": "number", "default": 14, "min": 2, "max": 100, "label": "Label", "category": "strategy"}}
}

# CORE RULES
1. Function: runStrategy(candles, settings) returns {trades, equity_curve, roi, mdd, win_rate, total_trades, final_balance}
2. candles: [{timestamp, open, high, low, close, volume}]
3. ❌ EXCLUDE: LotSize/Lots/Volume params (Position = initialBalance × equityPercent × leverage)
4. ✅ INCLUDE: indicator periods (RSI, MA, Stochastic), ATR multiplier, filters, TP/SL
5. masterReverse: flip buy/sell when settings.masterReverse === true
6. Track: {entry_time, entry_price, exit_time, exit_price, side, pnl, fee, size, duration, order_type, balance}
7. Fees: settings.feePercent (0.05% futures, 0.1% spot)
8. Be CONCISE: <3500 tokens

# CONVERSION RULES
"CRITICAL: You have a 4000 token limit. Be extremely concise.
- Omit comments except critical ones
- Use short variable names
- Combine similar logic
- Focus on core trading logic only"

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

Support ALL MT4/MT5 built-in indicators + custom indicators from the code.

### Standard Indicators Library

**TREND:**
- Moving Average (SMA, EMA, SMMA, LWMA)
- Adaptive Moving Average (AMA)
- Parabolic SAR
- Ichimoku Kinko Hyo
- Envelopes
- Bollinger Bands
- Standard Deviation
- Average Directional Movement Index (ADX)

**OSCILLATORS:**
- Relative Strength Index (RSI)
- Stochastic Oscillator
- MACD
- Commodity Channel Index (CCI)
- Momentum
- Williams %R
- DeMarker
- Average True Range (ATR)
- Bears Power
- Bulls Power
- Force Index
- Relative Vigor Index (RVI)

**VOLUMES:**
- Volumes
- On Balance Volume (OBV)
- Accumulation/Distribution
- Money Flow Index (MFI)

**BILL WILLIAMS:**
- Alligator
- Fractals
- Awesome Oscillator
- Accelerator Oscillator
- Market Facilitation Index
- Gator Oscillator

### Implementation Guidelines

Use inline implementations for all indicators. Here are key examples:

\`\`\`javascript
// === MOVING AVERAGES ===
function calculateSMA(prices, period) {
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// === RSI ===
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// === STOCHASTIC ===
function calculateStochastic(highs, lows, closes, kPeriod, dPeriod, slowing) {
  const highest = Math.max(...highs.slice(-kPeriod));
  const lowest = Math.min(...lows.slice(-kPeriod));
  const k = ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  // D is SMA of K values
  return { k, d: k }; // Simplified
}

// === MACD ===
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macd = fastEMA - slowEMA;
  return { macd, signal: macd, histogram: 0 }; // Simplified
}

// === BOLLINGER BANDS ===
function calculateBB(prices, period = 20, deviation = 2) {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: sma + deviation * std,
    middle: sma,
    lower: sma - deviation * std
  };
}

// === ATR ===
function calculateATR(highs, lows, closes, period = 14) {
  let tr = 0;
  for (let i = Math.max(1, highs.length - period); i < highs.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i - 1];
    tr += Math.max(h - l, Math.abs(h - c), Math.abs(l - c));
  }
  return tr / Math.min(period, highs.length - 1);
}

// === ADX ===
function calculateADX(highs, lows, closes, period = 14) {
  // Simplified: return value between 0-100
  const atr = calculateATR(highs, lows, closes, period);
  return Math.min(100, atr / closes[closes.length - 1] * 100);
}

// === CCI ===
function calculateCCI(highs, lows, closes, period = 20) {
  const tp = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
  const sma = calculateSMA(closes, period);
  const meanDev = closes.slice(-period).reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;
  return (tp - sma) / (0.015 * meanDev);
}

// === PARABOLIC SAR ===
function calculateSAR(highs, lows, acceleration = 0.02, maximum = 0.2) {
  // Simplified implementation
  const isUptrend = closes[closes.length - 1] > closes[closes.length - 2];
  return isUptrend ? Math.min(...lows.slice(-5)) : Math.max(...highs.slice(-5));
}

// === ICHIMOKU ===
function calculateIchimoku(highs, lows, tenkan = 9, kijun = 26, senkouB = 52) {
  const tenkanSen = (Math.max(...highs.slice(-tenkan)) + Math.min(...lows.slice(-tenkan))) / 2;
  const kijunSen = (Math.max(...highs.slice(-kijun)) + Math.min(...lows.slice(-kijun))) / 2;
  const senkouA = (tenkanSen + kijunSen) / 2;
  const senkouB = (Math.max(...highs.slice(-senkouB)) + Math.min(...lows.slice(-senkouB))) / 2;
  return { tenkan: tenkanSen, kijun: kijunSen, spanA: senkouA, spanB: senkouB };
}

// === WILLIAMS %R ===
function calculateWilliamsR(highs, lows, closes, period = 14) {
  const highest = Math.max(...highs.slice(-period));
  const lowest = Math.min(...lows.slice(-period));
  return ((highest - closes[closes.length - 1]) / (highest - lowest)) * -100;
}

// === OBV ===
function calculateOBV(closes, volumes) {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

// === MFI ===
function calculateMFI(highs, lows, closes, volumes, period = 14) {
  let posFlow = 0, negFlow = 0;
  for (let i = Math.max(1, closes.length - period); i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const mf = tp * volumes[i];
    if (closes[i] > closes[i - 1]) posFlow += mf;
    else negFlow += mf;
  }
  const mfr = posFlow / negFlow;
  return 100 - (100 / (1 + mfr));
}

// === AWESOME OSCILLATOR ===
function calculateAO(highs, lows) {
  const medianPrice = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const sma5 = calculateSMA(highs.map((h, i) => (h + lows[i]) / 2), 5);
  const sma34 = calculateSMA(highs.map((h, i) => (h + lows[i]) / 2), 34);
  return sma5 - sma34;
}

// === ALLIGATOR ===
function calculateAlligator(highs, lows, closes) {
  const median = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  return {
    jaw: calculateSMA([median], 13),
    teeth: calculateSMA([median], 8),
    lips: calculateSMA([median], 5)
  };
}
\`\`\`

### Custom Indicators
If the MQ code includes custom indicators (not in standard list):
- Extract their calculation logic
- Convert to JavaScript
- Add as helper functions
- Include their parameters in the parameters object

### Indicator Usage Pattern
\`\`\`javascript
// Extract price arrays
const closes = candles.map(c => c.close);
const highs = candles.map(c => c.high);
const lows = candles.map(c => c.low);
const volumes = candles.map(c => c.volume);

// Calculate indicators
const rsi = calculateRSI(closes.slice(0, i + 1), settings.rsiPeriod);
const bb = calculateBB(closes.slice(0, i + 1), settings.bbPeriod, settings.bbDeviation);
const macd = calculateMACD(closes.slice(0, i + 1), settings.macdFast, settings.macdSlow, settings.macdSignal);

// Use in signals
if (rsi < settings.rsiOversold && closes[i] < bb.lower) {
  // Buy signal
}
\`\`\`

## 5. FOREX → CRYPTO CONVERSION
- \`Lots\` → Position size in USDT (1 lot = 100 USDT minimum, scale from settings.equityPercent)
- \`Points/Pips\` → Price difference (BTC: $1, ETH: $0.01, etc)
- \`OrderSend()\` → Simulated trades with entry/exit tracking
- \`AccountBalance()\` → \`balance\` variable (start from settings.initialBalance)
- Leverage: Use \`settings.market_type === 'futures' ? settings.leverage : 1\`
- Fees: \`settings.feePercent\` (default 0.05% for futures, 0.1% for spot)

## CRITICAL - LOT SIZE EXCLUSION

❌ **EXCLUDE these forex-specific parameters:**
- LotSize, Lots, Volume (forex lot units)
- Risk, RiskPercent (if lot-based)
- PositionSize (if forex lot units)
- MoneyManagement parameters (lot-based)

**Reason:** Position sizing is handled automatically by:
\`\`\`
Position = InitialBalance × EquityPercent × Leverage
\`\`\`

✅ **ONLY include parameters that affect STRATEGY LOGIC:**
- Technical indicator settings (RSI period, MA period, Stochastic settings, etc)
- Entry/Exit filters (time filters, volume filters, price action rules)
- Risk management LOGIC (ATR-based stops, trailing stops, break-even, max trades per day)
- Market conditions (volatility filters, trend filters)

**Special handling for ATR-based parameters:**
If the EA uses ATR for stop loss or take profit:
- Extract ATR Period (e.g., atrPeriod)
- Extract ATR Multiplier (e.g., atrMultiplier, atrStopLoss, atrTakeProfit)
- These help adjust forex volatility → crypto volatility

**Example transformation:**
\`\`\`
// Forex EA:
input double LotSize = 0.1;          // ❌ EXCLUDE
input int RSI_Period = 14;           // ✅ INCLUDE (strategy logic)
input double ATR_Multiplier = 2.0;   // ✅ INCLUDE (volatility adjustment)

// Output parameters:
{
  "rsiPeriod": {
    "type": "number",
    "default": 14,
    "min": 2,
    "max": 100,
    "label": "RSI Period",
    "category": "strategy"
  },
  "atrMultiplier": {
    "type": "number",
    "default": 2.0,
    "min": 0.5,
    "max": 5.0,
    "step": 0.1,
    "label": "ATR Multiplier",
    "category": "advanced"
  }
}
\`\`\`

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

// 임시 업로드 API (CSV 파일 업로드용)
app.post('/api/upload-candle', (req, res) => {
  try {
    const { market_type, symbol, csv_text } = req.body;
    
    if (!market_type || !symbol || !csv_text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // 디렉토리 생성
    const dir = path.join(DATA_PATH, market_type);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 파일 저장
    const filePath = path.join(dir, `${symbol}.csv`);
    fs.writeFileSync(filePath, csv_text, 'utf-8');
    
    console.log(`✅ Uploaded: ${market_type}/${symbol}.csv (${csv_text.length} bytes)`);
    
    res.json({ 
      success: true, 
      message: `Uploaded ${symbol}`,
      path: filePath
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 타임프레임 변환 함수
function convertTimeframe(candles, timeframe) {
  if (timeframe === '1m') return candles;
  
  const intervals = { 
    '5m': 5, 
    '15m': 15, 
    '30m': 30, 
    '1h': 60, 
    '4h': 240, 
    '1d': 1440 
  };
  
  const targetMinutes = intervals[timeframe];
  if (!targetMinutes) return candles;
  
  const targetMs = targetMinutes * 60 * 1000;
  const result = [];
  
  let currentBucket = [];
  let bucketStart = null;
  
  for (const candle of candles) {
    const bucketTimestamp = Math.floor(candle.timestamp / targetMs) * targetMs;
    
    if (bucketStart !== bucketTimestamp) {
      if (currentBucket.length > 0) {
        result.push({
          timestamp: bucketStart,
          open: currentBucket[0].open,
          high: Math.max(...currentBucket.map(c => c.high)),
          low: Math.min(...currentBucket.map(c => c.low)),
          close: currentBucket[currentBucket.length - 1].close,
          volume: currentBucket.reduce((sum, c) => sum + c.volume, 0)
        });
      }
      
      bucketStart = bucketTimestamp;
      currentBucket = [];
    }
    
    currentBucket.push(candle);
  }
  
  if (currentBucket.length > 0) {
    result.push({
      timestamp: bucketStart,
      open: currentBucket[0].open,
      high: Math.max(...currentBucket.map(c => c.high)),
      low: Math.min(...currentBucket.map(c => c.low)),
      close: currentBucket[currentBucket.length - 1].close,
      volume: currentBucket.reduce((sum, c) => sum + c.volume, 0)
    });
  }
  
  return result;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy running on port ${PORT}`);
});

app.post('/api/backtest', async (req, res) => {
  try {
    const { strategy_id, settings } = req.body;
    
    console.log('🔵 Community backtest start');
    console.log('📊 Strategy:', strategy_id);
    console.log('📊 Symbol:', settings.symbol);
    console.log('📊 Period:', settings.startDate, '→', settings.endDate);
    
    // 1. Workers API에서 js_code 가져오기
    console.log('📡 Fetching strategy code...');
    const strategyUrl = `https://cointop10-api.cointop10-com.workers.dev/api/strategy/${strategy_id}`;
    const strategyRes = await fetch(strategyUrl);
    
    if (!strategyRes.ok) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    
    const { js_code } = await strategyRes.json();
    
    if (!js_code) {
      return res.status(404).json({ error: 'Strategy has no code' });
    }
    
    console.log('✅ Strategy code loaded');
    
    // 2. Volume에서 캔들 가져오기
    const filePath = path.join(DATA_PATH, settings.market_type, `${settings.symbol}.csv`);
    console.log('📡 Reading candles from Volume:', filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Candle file not found: ${settings.symbol}` });
    }
    
    const csvText = fs.readFileSync(filePath, 'utf-8');
    
    console.log('✅ Candles loaded from Volume');
    
    // 3. CSV 파싱
    const lines = csvText.split('\n').filter(line => line.trim());
    lines.shift();
    
    const allCandles = lines.map(line => {
      const [timestamp, open, high, low, close, volume] = line.split(',');
      return {
        timestamp: parseInt(timestamp),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseFloat(volume)
      };
    });
    
    console.log('✅ Parsed:', allCandles.length, 'candles');
    
    // 4. 날짜 필터링
    const startTs = new Date(settings.startDate).getTime();
    const endTs = new Date(settings.endDate).getTime();
    const filteredCandles = allCandles.filter(c => 
      c.timestamp >= startTs && c.timestamp <= endTs
    );
    
    console.log('✅ Filtered:', filteredCandles.length, 'candles');
    
    // 5. 타임프레임 변환
    const convertedCandles = convertTimeframe(filteredCandles, settings.timeframe);
    
    console.log('✅ Converted to', settings.timeframe, ':', convertedCandles.length, 'candles');
    
    // 6. 실행
    eval(js_code);
    const backtestResult = runStrategy(convertedCandles, settings);  // ← result 대신 backtestResult!
    
    console.log('✅ Backtest complete');
    console.log('📊 ROI:', backtestResult.roi + '%');
    console.log('📊 Trades:', backtestResult.total_trades);
    
    res.json(backtestResult);  // ← 여기도!
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});
