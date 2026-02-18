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
        model: 'claude-haiku-4-5-20251001',
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

## 5. FOREX → CRYPTO CONVERSION & POSITION SIZING

**CRITICAL - Position Sizing Formula:**
\`\`\`javascript
// Calculate position size in BASE ASSET (e.g., BTC, ETH)
const equity = settings.equityPercent || 10;  // Default 10%
const lev = settings.market_type === 'futures' ? settings.leverage : 1;
const positionUSDT = balance * (equity / 100) * lev;
const positionSize = positionUSDT / entryPrice;  // Convert USDT → Coin

// Example:
// balance = $10,000
// equity = 10%
// leverage = 10x
// entryPrice = $42,500
// → positionUSDT = 10,000 × 0.1 × 10 = $10,000
// → positionSize = 10,000 / 42,500 = 0.235 BTC
\`\`\`

**DO NOT USE:**
- ❌ \`balance * 0.95 * lev\` (uses 95% of entire balance!)
- ❌ \`LotSize\` from MQ code (forex-specific)
- ❌ Fixed position sizes

**MUST USE:**
- ✅ \`settings.equityPercent\` (% of balance per trade)
- ✅ \`settings.leverage\` (for futures)
- ✅ Dynamic calculation based on current balance

**Other conversions:**
- \`Points/Pips\` → Price difference (BTC: $1, ETH: $0.01, etc)
- \`OrderSend()\` → Simulated trades with entry/exit tracking
- \`AccountBalance()\` → \`balance\` variable (start from settings.initialBalance)
- Fees: \`settings.feePercent\` (default 0.05% for futures, 0.1% for spot)

## POSITION SIZING - MANDATORY IMPLEMENTATION

**Every strategy MUST calculate position size as:**
\`\`\`javascript
function calculatePositionSize(balance, entryPrice, settings) {
  const equity = settings.equityPercent || 10;
  const lev = settings.market_type === 'futures' ? settings.leverage : 1;
  const positionUSDT = balance * (equity / 100) * lev;
  const positionSize = positionUSDT / entryPrice;
  return positionSize;
}

// Usage in buy signal:
if (buySignal && !position) {
  entryPrice = currentPrice;
  positionSize = calculatePositionSize(balance, entryPrice, settings);
  const fee = (balance * (equity / 100) * lev) * (settings.feePercent / 100);
  balance -= fee;
  position = 'long';
}
\`\`\`

**Key points:**
1. ✅ Use \`settings.equityPercent\` (NOT hardcoded 95%)
2. ✅ Calculate USDT amount first, then divide by price
3. ✅ Position size = COIN amount (e.g., 0.235 BTC)
4. ✅ Fee calculated on USDT notional value
5. ✅ **CRITICAL:** Round USDT position to nearest $100

**Position sizing with $100 rounding:**
\`\`\`javascript
const equity = settings.equityPercent || 10;
const lev = settings.market_type === 'futures' ? settings.leverage : 1;

// Round to nearest $100
const rawUSDT = balance * (equity / 100) * lev;
const positionUSDT = Math.floor(rawUSDT / 100) * 100;
const positionSize = positionUSDT / entryPrice;

// Example:
// balance = $10,000, equity = 10%, lev = 10x
// rawUSDT = 10,000 × 0.1 × 10 = $10,000
// positionUSDT = floor(10,000 / 100) × 100 = $10,000 ✅
// positionSize = 10,000 / 42,466.9 = 0.2355 BTC
\`\`\`

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
  size: positionSize,  // COIN 개수 (USDT 아님!)
  duration: i - entryIdx,
  order_type: "BUY STOP" | "SELL STOP" | "BUY LIMIT" | "SELL LIMIT",
  balance: currentBalance
});
\`\`\`

**CRITICAL: Stop trading if balance <= 0:**
\`\`\`javascript
// Exit loop if bankrupt
if (balance <= 0) {
  console.log('Bankrupt at candle', i);
  break;
}
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
    
// JSON 파싱 (Markdown 제거 + 코드 블록 추출)
let result;
try {
  // 1차: 마크다운 제거
  let cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // JSON 파싱 시도
  result = JSON.parse(cleanText);
  
} catch (parseError) {
  console.log('⚠️ JSON parse failed, extracting code blocks...');
  
  // 2차: 코드 블록 추출
  let jsCode = responseText;
  
  // "```javascript" 블록 추출
  const jsMatch = responseText.match(/```javascript\n([\s\S]*?)\n```/);
  if (jsMatch) {
    jsCode = jsMatch[1];
  } else {
    // "```" 블록 추출 (언어 명시 없음)
    const codeMatch = responseText.match(/```\n([\s\S]*?)\n```/);
    if (codeMatch) {
      jsCode = codeMatch[1];
    } else {
      // function runStrategy로 시작하는 부분 추출
      const functionMatch = responseText.match(/(function runStrategy[\s\S]*)/);
      if (functionMatch) {
        jsCode = functionMatch[1];
      }
    }
  }
  
  // 앞뒤 설명 텍스트 제거
  jsCode = jsCode
    .replace(/^Here's.*?:\s*/i, '')
    .replace(/^The.*?:\s*/i, '')
    .replace(/^This.*?:\s*/i, '')
    .trim();
  
  result = { js_code: jsCode, parameters: {} };
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

app.get('/api/candles/list', (req, res) => {
  try {
    const result = {};
    const markets = ['futures', 'spot'];
    
    for (const market of markets) {
      const dir = path.join(DATA_PATH, market);
      if (fs.existsSync(dir)) {
        result[market] = fs.readdirSync(dir).map(file => {
          const stat = fs.statSync(path.join(dir, file));
          return {
            name: file,
            size: (stat.size / 1024 / 1024).toFixed(1) + 'MB'
          };
        });
      } else {
        result[market] = [];
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    
let { js_code } = await strategyRes.json();

if (!js_code) {
  return res.status(404).json({ error: 'Strategy has no code' });
}

// 코드 정제 (Markdown 제거)
js_code = js_code
  .replace(/^Here's.*?:\s*/i, '')
  .replace(/^The.*?:\s*/i, '')
  .replace(/^This.*?:\s*/i, '')
  .replace(/```javascript\n?/g, '')
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();

// function runStrategy로 시작하는지 확인
if (!js_code.includes('function runStrategy')) {
  return res.status(400).json({ error: 'Invalid strategy code: missing runStrategy function' });
}

console.log('✅ Strategy code loaded and cleaned');
    
// 2. Volume에서 캔들 가져오기
// 파일명: futures_BTCUSDT.csv 또는 BTCUSDT.csv 모두 시도
let filePath = path.join(DATA_PATH, settings.market_type, `${settings.symbol}.csv`);

if (!fs.existsSync(filePath)) {
  // prefix 붙인 파일명 시도
  filePath = path.join(DATA_PATH, settings.market_type, `${settings.market_type}_${settings.symbol}.csv`);
}

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
    

// 6. 표준 지표 함수 정의 (MT4/MT5 전체 + 추가 지표)
const indicators = {
  // ========== MOVING AVERAGES ==========
  calculateSMA: function(prices, period) {
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  },

  calculateEMA: function(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  },

  calculateSMMA: function(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    let smma = sum / period;
    for (let i = period; i < prices.length; i++) {
      smma = (smma * (period - 1) + prices[i]) / period;
    }
    return smma;
  },

  calculateLWMA: function(prices, period) {
    const slice = prices.slice(-period);
    const weights = Array.from({length: period}, (_, i) => i + 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const lwma = slice.reduce((sum, p, i) => sum + p * weights[i], 0) / weightSum;
    return lwma;
  },

  calculateAMA: function(prices, period = 10, fastPeriod = 2, slowPeriod = 30) {
    const er = Math.abs(prices[prices.length - 1] - prices[prices.length - 1 - period]) / 
               prices.slice(-period).reduce((sum, p, i, arr) => i > 0 ? sum + Math.abs(p - arr[i-1]) : sum, 0);
    const fastSC = 2 / (fastPeriod + 1);
    const slowSC = 2 / (slowPeriod + 1);
    const ssc = er * (fastSC - slowSC) + slowSC;
    const c = ssc * ssc;
    return prices[prices.length - 1] * c + (prices[prices.length - 2] || prices[prices.length - 1]) * (1 - c);
  },

  // ========== OSCILLATORS ==========
  calculateRSI: function(prices, period = 14) {
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
  },

  calculateStochastic: function(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const highest = Math.max(...highs.slice(-kPeriod));
    const lowest = Math.min(...lows.slice(-kPeriod));
    const k = ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
    return { k, d: k };
  },

  calculateMACD: function(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macd = fastEMA - slowEMA;
    return { macd, signal: macd, histogram: 0 };
  },

  calculateCCI: function(highs, lows, closes, period = 20) {
    const tp = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    const sma = this.calculateSMA(closes, period);
    const meanDev = closes.slice(-period).reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;
    return meanDev === 0 ? 0 : (tp - sma) / (0.015 * meanDev);
  },

  calculateMomentum: function(prices, period = 14) {
    return prices[prices.length - 1] - prices[prices.length - 1 - period];
  },

  calculateWilliamsR: function(highs, lows, closes, period = 14) {
    const highest = Math.max(...highs.slice(-period));
    const lowest = Math.min(...lows.slice(-period));
    return ((highest - closes[closes.length - 1]) / (highest - lowest)) * -100;
  },

  calculateDeMarker: function(highs, lows, period = 14) {
    let deMax = 0, deMin = 0;
    for (let i = Math.max(1, highs.length - period); i < highs.length; i++) {
      const dh = highs[i] > highs[i - 1] ? highs[i] - highs[i - 1] : 0;
      const dl = lows[i] < lows[i - 1] ? lows[i - 1] - lows[i] : 0;
      deMax += dh;
      deMin += dl;
    }
    return deMin === 0 ? 100 : (deMax / (deMax + deMin)) * 100;
  },

  calculateRVI: function(opens, closes, highs, lows, period = 10) {
    const num = closes[closes.length - 1] - opens[opens.length - 1];
    const den = highs[highs.length - 1] - lows[lows.length - 1];
    return den === 0 ? 0 : num / den;
  },

  // ========== BANDS & CHANNELS ==========
  calculateBB: function(prices, period = 20, deviation = 2) {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: sma + deviation * std,
      middle: sma,
      lower: sma - deviation * std
    };
  },

  calculateEnvelopes: function(prices, period = 14, deviation = 0.1) {
    const ma = this.calculateSMA(prices, period);
    return {
      upper: ma * (1 + deviation),
      lower: ma * (1 - deviation)
    };
  },

  calculateDonchian: function(highs, lows, period = 20) {
    return {
      upper: Math.max(...highs.slice(-period)),
      middle: (Math.max(...highs.slice(-period)) + Math.min(...lows.slice(-period))) / 2,
      lower: Math.min(...lows.slice(-period))
    };
  },

  calculateKeltner: function(highs, lows, closes, period = 20, multiplier = 2) {
    const ema = this.calculateEMA(closes, period);
    const atr = this.calculateATR(highs, lows, closes, period);
    return {
      upper: ema + multiplier * atr,
      middle: ema,
      lower: ema - multiplier * atr
    };
  },

  calculateStdDev: function(prices, period = 20) {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    return Math.sqrt(variance);
  },

  // ========== VOLATILITY ==========
  calculateATR: function(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return 0;
    let tr = 0;
    for (let i = Math.max(1, highs.length - period); i < highs.length; i++) {
      const h = highs[i];
      const l = lows[i];
      const c = closes[i - 1];
      tr += Math.max(h - l, Math.abs(h - c), Math.abs(l - c));
    }
    return tr / Math.min(period, highs.length - 1);
  },

  // ========== TREND ==========
  calculateSAR: function(highs, lows, closes, acceleration = 0.02, maximum = 0.2) {
    const isUptrend = closes[closes.length - 1] > closes[closes.length - 2];
    return isUptrend ? Math.min(...lows.slice(-5)) : Math.max(...highs.slice(-5));
  },

  calculateIchimoku: function(highs, lows, tenkan = 9, kijun = 26, senkouB = 52) {
    const tenkanSen = (Math.max(...highs.slice(-tenkan)) + Math.min(...lows.slice(-tenkan))) / 2;
    const kijunSen = (Math.max(...highs.slice(-kijun)) + Math.min(...lows.slice(-kijun))) / 2;
    const senkouA = (tenkanSen + kijunSen) / 2;
    const senkouSpanB = (Math.max(...highs.slice(-senkouB)) + Math.min(...lows.slice(-senkouB))) / 2;
    return { tenkan: tenkanSen, kijun: kijunSen, spanA: senkouA, spanB: senkouSpanB };
  },

  calculateADX: function(highs, lows, closes, period = 14) {
    const atr = this.calculateATR(highs, lows, closes, period);
    return Math.min(100, atr / closes[closes.length - 1] * 100);
  },

  calculateSuperTrend: function(highs, lows, closes, period = 10, multiplier = 3) {
    const atr = this.calculateATR(highs, lows, closes, period);
    const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    const upperBand = hl2 + multiplier * atr;
    const lowerBand = hl2 - multiplier * atr;
    const isUptrend = closes[closes.length - 1] > lowerBand;
    return {
      value: isUptrend ? lowerBand : upperBand,
      trend: isUptrend ? 1 : -1
    };
  },

  calculateAroon: function(highs, lows, period = 25) {
    const highIndex = highs.slice(-period).lastIndexOf(Math.max(...highs.slice(-period)));
    const lowIndex = lows.slice(-period).lastIndexOf(Math.min(...lows.slice(-period)));
    const aroonUp = ((period - highIndex) / period) * 100;
    const aroonDown = ((period - lowIndex) / period) * 100;
    return {
      up: aroonUp,
      down: aroonDown,
      oscillator: aroonUp - aroonDown
    };
  },

  // ========== VOLUME ==========
  calculateOBV: function(closes, volumes) {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) obv += volumes[i];
      else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    }
    return obv;
  },

  calculateAD: function(highs, lows, closes, volumes) {
    let ad = 0;
    for (let i = 0; i < closes.length; i++) {
      const clv = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / (highs[i] - lows[i]);
      ad += clv * volumes[i];
    }
    return ad;
  },

  calculateMFI: function(highs, lows, closes, volumes, period = 14) {
    let posFlow = 0, negFlow = 0;
    for (let i = Math.max(1, closes.length - period); i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      const mf = tp * volumes[i];
      if (closes[i] > closes[i - 1]) posFlow += mf;
      else negFlow += mf;
    }
    const mfr = posFlow / negFlow;
    return 100 - (100 / (1 + mfr));
  },

  calculateVWAP: function(highs, lows, closes, volumes) {
    let sumPV = 0, sumV = 0;
    for (let i = 0; i < closes.length; i++) {
      const typical = (highs[i] + lows[i] + closes[i]) / 3;
      sumPV += typical * volumes[i];
      sumV += volumes[i];
    }
    return sumV === 0 ? closes[closes.length - 1] : sumPV / sumV;
  },

  // ========== BILL WILLIAMS ==========
  calculateAO: function(highs, lows) {
    const medianPrice = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    const sma5 = this.calculateSMA(highs.map((h, i) => (h + lows[i]) / 2), 5);
    const sma34 = this.calculateSMA(highs.map((h, i) => (h + lows[i]) / 2), 34);
    return sma5 - sma34;
  },

  calculateAC: function(highs, lows) {
    const ao = this.calculateAO(highs, lows);
    const aoSma = this.calculateSMA([ao], 5);
    return ao - aoSma;
  },

  calculateAlligator: function(highs, lows, closes) {
    const median = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    return {
      jaw: this.calculateSMMA([median], 13),
      teeth: this.calculateSMMA([median], 8),
      lips: this.calculateSMMA([median], 5)
    };
  },

  calculateFractals: function(highs, lows) {
    const len = highs.length;
    if (len < 5) return { up: null, down: null };
    const upFractal = highs[len - 3] > highs[len - 5] && highs[len - 3] > highs[len - 4] && 
                      highs[len - 3] > highs[len - 2] && highs[len - 3] > highs[len - 1];
    const downFractal = lows[len - 3] < lows[len - 5] && lows[len - 3] < lows[len - 4] && 
                        lows[len - 3] < lows[len - 2] && lows[len - 3] < lows[len - 1];
    return { up: upFractal ? highs[len - 3] : null, down: downFractal ? lows[len - 3] : null };
  },

  calculateGator: function(highs, lows, closes) {
    const alligator = this.calculateAlligator(highs, lows, closes);
    return {
      upper: Math.abs(alligator.jaw - alligator.teeth),
      lower: Math.abs(alligator.teeth - alligator.lips)
    };
  },

  calculateBWMFI: function(highs, lows, closes, volumes) {
    const range = highs[highs.length - 1] - lows[lows.length - 1];
    return range === 0 ? 0 : (volumes[volumes.length - 1] / range);
  },

  calculateBearsPower: function(closes, highs, lows, period = 13) {
    const ema = this.calculateEMA(closes, period);
    return lows[lows.length - 1] - ema;
  },

  calculateBullsPower: function(closes, highs, lows, period = 13) {
    const ema = this.calculateEMA(closes, period);
    return highs[highs.length - 1] - ema;
  },

  calculateForceIndex: function(closes, volumes, period = 13) {
    const force = (closes[closes.length - 1] - closes[closes.length - 2]) * volumes[volumes.length - 1];
    return this.calculateEMA([force], period);
  },

  calculateElderRay: function(closes, highs, lows, period = 13) {
    const ema = this.calculateEMA(closes, period);
    return {
      bullPower: highs[highs.length - 1] - ema,
      bearPower: lows[lows.length - 1] - ema
    };
  },

  // ========== PIVOT POINTS ==========
  calculatePivot: function(high, low, close) {
    const pivot = (high + low + close) / 3;
    return {
      pivot: pivot,
      r1: 2 * pivot - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low),
      s1: 2 * pivot - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot)
    };
  },

  // ========== FIBONACCI ==========
  calculateFibonacci: function(high, low) {
    const diff = high - low;
    return {
      level_0: high,
      level_236: high - diff * 0.236,
      level_382: high - diff * 0.382,
      level_500: high - diff * 0.500,
      level_618: high - diff * 0.618,
      level_786: high - diff * 0.786,
      level_100: low
    };
  },

  // ========== CANDLE PATTERNS ==========
  isDoji: function(open, high, low, close) {
    const body = Math.abs(close - open);
    const range = high - low;
    return body / range < 0.1;
  },

  isHammer: function(open, high, low, close) {
    const body = Math.abs(close - open);
    const lowerShadow = Math.min(open, close) - low;
    const upperShadow = high - Math.max(open, close);
    return lowerShadow > body * 2 && upperShadow < body * 0.5;
  },

  isBullishEngulfing: function(candles, index) {
    if (index < 1) return false;
    const prev = candles[index - 1];
    const curr = candles[index];
    return prev.close < prev.open && 
           curr.close > curr.open &&
           curr.open < prev.close &&
           curr.close > prev.open;
  },

  isBearishEngulfing: function(candles, index) {
    if (index < 1) return false;
    const prev = candles[index - 1];
    const curr = candles[index];
    return prev.close > prev.open && 
           curr.close < curr.open &&
           curr.open > prev.close &&
           curr.close < prev.open;
  },

  isMorningStar: function(candles, index) {
    if (index < 2) return false;
    const c1 = candles[index - 2];
    const c2 = candles[index - 1];
    const c3 = candles[index];
    return c1.close < c1.open && 
           Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.3 &&
           c3.close > c3.open &&
           c3.close > (c1.open + c1.close) / 2;
  },

  isEveningStar: function(candles, index) {
    if (index < 2) return false;
    const c1 = candles[index - 2];
    const c2 = candles[index - 1];
    const c3 = candles[index];
    return c1.close > c1.open && 
           Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.3 &&
           c3.close < c3.open &&
           c3.close < (c1.open + c1.close) / 2;
  },

  isPinBar: function(open, high, low, close) {
    const body = Math.abs(close - open);
    const range = high - low;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    return (upperShadow > body * 3 || lowerShadow > body * 3) && body / range < 0.3;
  },

  isInsideBar: function(candles, index) {
    if (index < 1) return false;
    const prev = candles[index - 1];
    const curr = candles[index];
    return curr.high < prev.high && curr.low > prev.low;
  },

  // ========== PRICE ACTION ==========
  findSwingHigh: function(highs, period = 5) {
    if (highs.length < period * 2 + 1) return null;
    const center = highs.length - period - 1;
    const centerValue = highs[center];
    for (let i = center - period; i < center + period; i++) {
      if (i !== center && highs[i] >= centerValue) return null;
    }
    return { index: center, value: centerValue };
  },

  findSwingLow: function(lows, period = 5) {
    if (lows.length < period * 2 + 1) return null;
    const center = lows.length - period - 1;
    const centerValue = lows[center];
    for (let i = center - period; i < center + period; i++) {
      if (i !== center && lows[i] <= centerValue) return null;
    }
    return { index: center, value: centerValue };
  },

  isHigherHigh: function(highs) {
    return highs.length >= 2 && highs[highs.length - 1] > highs[highs.length - 2];
  },

  isLowerLow: function(lows) {
    return lows.length >= 2 && lows[lows.length - 1] < lows[lows.length - 2];
  },

  findSupportResistance: function(highs, lows, closes, lookback = 50, tolerance = 0.02) {
    const levels = [];
    for (let i = closes.length - lookback; i < closes.length; i++) {
      const price = closes[i];
      let found = false;
      for (const level of levels) {
        if (Math.abs(price - level.price) / level.price < tolerance) {
          level.touches++;
          found = true;
          break;
        }
      }
      if (!found) {
        levels.push({ price, touches: 1 });
      }
    }
    return levels.filter(l => l.touches >= 3).sort((a, b) => b.touches - a.touches);
  }
};

// 글로벌 스코프에 함수 추가 (커뮤니티 코드 호환성)
for (const [key, fn] of Object.entries(indicators)) {
  if (typeof fn === 'function') {
    global[key] = fn.bind(indicators);
  }
}

// 7. 커뮤니티 전략 기본 파라미터 설정
const communitySettings = {
  ...settings,
  
  // ========== POSITION SIZING ==========
  leverage: settings.leverage || 10,
  equityPercent: settings.equityPercent || 10,
  compoundEnabled: settings.compoundEnabled || false,
  maxPositionSize: settings.maxPositionSize || 10000000,
  
  // ========== RISK MANAGEMENT ==========
  stopLoss: settings.stopLoss || null,
  stopLossPercent: settings.stopLossPercent || null,
  stopLossPoints: settings.stopLossPoints || null,
  stopLossATR: settings.stopLossATR || null,
  
  takeProfit: settings.takeProfit || null,
  takeProfitPercent: settings.takeProfitPercent || null,
  takeProfitPoints: settings.takeProfitPoints || null,
  takeProfitATR: settings.takeProfitATR || null,
  
  trailingStop: settings.trailingStop || null,
  trailingStopPercent: settings.trailingStopPercent || null,
  trailingStopDistance: settings.trailingStopDistance || null,
  trailingStopTrigger: settings.trailingStopTrigger || null,
  
  breakEvenEnabled: settings.breakEvenEnabled || false,
  breakEvenTrigger: settings.breakEvenTrigger || null,
  breakEvenOffset: settings.breakEvenOffset || 0,
  
  maxDrawdown: settings.maxDrawdown || 50,
  maxDailyLoss: settings.maxDailyLoss || null,
  maxConsecutiveLosses: settings.maxConsecutiveLosses || null,
  
  // ========== PARTIAL CLOSE ==========
  partialCloseEnabled: settings.partialCloseEnabled || false,
  partialClosePercent: settings.partialClosePercent || 50,
  partialCloseTrigger: settings.partialCloseTrigger || null,
  partialClose2Enabled: settings.partialClose2Enabled || false,
  partialClose2Percent: settings.partialClose2Percent || 25,
  partialClose2Trigger: settings.partialClose2Trigger || null,
  
  // ========== SCALING ==========
  scalingInEnabled: settings.scalingInEnabled || false,
  scalingInLevels: settings.scalingInLevels || 3,
  scalingInDistance: settings.scalingInDistance || null,
  
  scalingOutEnabled: settings.scalingOutEnabled || false,
  scalingOutLevels: settings.scalingOutLevels || 3,
  scalingOutDistance: settings.scalingOutDistance || null,
  
  // ========== MARTINGALE & RECOVERY ==========
  martingaleEnabled: settings.martingaleEnabled || false,
  martingaleMultiplier: settings.martingaleMultiplier || 2.0,
  maxMartingaleLevel: settings.maxMartingaleLevel || 5,
  martingaleOnLoss: settings.martingaleOnLoss !== false,
  
  antiMartingaleEnabled: settings.antiMartingaleEnabled || false,
  antiMartingaleMultiplier: settings.antiMartingaleMultiplier || 1.5,
  
  recoveryEnabled: settings.recoveryEnabled || false,
  recoveryTarget: settings.recoveryTarget || 100,
  recoveryMethod: settings.recoveryMethod || 'grid',
  
  // ========== POSITION LIMITS ==========
  maxPositions: settings.maxPositions || 1,
  maxLongPositions: settings.maxLongPositions || null,
  maxShortPositions: settings.maxShortPositions || null,
  maxDailyTrades: settings.maxDailyTrades || null,
  maxWeeklyTrades: settings.maxWeeklyTrades || null,
  
  // ========== DIRECTION CONTROL ==========
  masterLongEnabled: settings.masterLongEnabled !== false,
  masterShortEnabled: settings.masterShortEnabled !== false,
  masterReverse: settings.masterReverse || false,
  
  // ========== TIME FILTERS ==========
  tradingHours: settings.tradingHours || null,
  sessionStart: settings.sessionStart || null,
  sessionEnd: settings.sessionEnd || null,
  avoidWeekends: settings.avoidWeekends || false,
  avoidMonday: settings.avoidMonday || false,
  avoidFriday: settings.avoidFriday || false,
  
  // ========== FILTERS ==========
  volumeFilter: settings.volumeFilter || 0,
  volatilityFilter: settings.volatilityFilter || null,
  spreadFilter: settings.spreadFilter || null,
  trendFilter: settings.trendFilter || null,
  priceFilter: settings.priceFilter || null,
  
  atrPeriod: settings.atrPeriod || 14,
  atrMultiplier: settings.atrMultiplier || 2.0,
  
  // ========== HEDGING & GRID ==========
  hedgingEnabled: settings.hedgingEnabled || false,
  hedgingDistance: settings.hedgingDistance || null,
  hedgingMultiplier: settings.hedgingMultiplier || 1.0,
  
  gridTradingEnabled: settings.gridTradingEnabled || false,
  gridLevels: settings.gridLevels || 5,
  gridDistance: settings.gridDistance || null,
  
  // ========== PYRAMIDING ==========
  pyramidingEnabled: settings.pyramidingEnabled || false,
  pyramidingLevels: settings.pyramidingLevels || 3,
  pyramidingDistance: settings.pyramidingDistance || null,
  pyramidingMultiplier: settings.pyramidingMultiplier || 1.0,
  
  // ========== FEE ==========
  feePercent: settings.feePercent || (settings.market_type === 'spot' ? 0.1 : 0.05),
  
  // ========== OTHERS ==========
  slippage: settings.slippage || 0,
  orderTimeout: settings.orderTimeout || null,
  requireConfirmation: settings.requireConfirmation || false,
  
  newsFilterEnabled: settings.newsFilterEnabled || false,
  newsAvoidMinutes: settings.newsAvoidMinutes || 30,
  
  minCandlesRequired: settings.minCandlesRequired || 50,
  warmupPeriod: settings.warmupPeriod || 100
};

// 8. communitySettings를 전역 변수로 노출
for (const [key, value] of Object.entries(communitySettings)) {
  global[key] = value;
}

// 9. 실행 (에러 핸들링)
try {
  eval(js_code);
  
  if (typeof runStrategy !== 'function') {
    throw new Error('runStrategy function not found in strategy code');
  }
  
  const backtestResult = runStrategy(convertedCandles, communitySettings);
  
  if (!backtestResult || !backtestResult.trades) {
    throw new Error('Invalid backtest result: missing trades array');
  }

  console.log('✅ Backtest complete');
  console.log('📊 ROI:', backtestResult.roi + '%');
  console.log('📊 Trades:', backtestResult.total_trades);

  // ✅ 필수 필드 기본값 추가
const normalizedResult = {
  trades: (backtestResult.trades || [])
    .filter(t => t.balance && t.balance > 0)
    .map(t => {
// 커뮤니티 전략: size는 코인 개수!
const coinSize = t.size || 0;
const usdtSize = t.entry_price && coinSize ? coinSize * t.entry_price : 0;
      
      // order_type에 side 정보 추가
      let orderType = t.order_type || 'MARKET';
      const side = t.side ? t.side.toUpperCase() : null;
      
      if (side && !orderType.includes('BUY') && !orderType.includes('SELL')) {
        const prefix = side === 'LONG' ? 'BUY' : 'SELL';
        orderType = `${prefix} ${orderType}`;
      }
      
      return {
        ...t,
        coin_size: coinSize ? parseFloat(coinSize.toFixed(8)) : 0,
        usdt_size: usdtSize ? parseFloat(usdtSize.toFixed(2)) : 0,
        order_type: orderType,
        side: side
      };
    }),
  
  equity_curve: backtestResult.equity_curve || [],
  roi: parseFloat(backtestResult.roi) || 0,
  mdd: parseFloat(backtestResult.mdd) || 0,
  win_rate: parseFloat(backtestResult.win_rate) || 0,
  total_trades: backtestResult.total_trades || 0,
  long_trades: backtestResult.long_trades || 0,
  short_trades: backtestResult.short_trades || 0,
  winning_trades: backtestResult.winning_trades || 0,
  losing_trades: backtestResult.losing_trades || 0,
  max_profit: parseFloat(backtestResult.max_profit) || 0,
  max_loss: parseFloat(backtestResult.max_loss) || 0,
  avg_profit: parseFloat(backtestResult.avg_profit) || 0,
  avg_loss: parseFloat(backtestResult.avg_loss) || 0,
  avg_duration: backtestResult.avg_duration || 0,
  max_duration: backtestResult.max_duration || 0,
  total_fee: parseFloat(backtestResult.total_fee) || 0,
  final_balance: parseFloat(backtestResult.final_balance) || settings.initialBalance || 10000,
  initial_balance: settings.initialBalance || 10000,
symbol: settings.symbol,
  timeframe: settings.timeframe
  };

  res.json(normalizedResult);

} catch (evalError) {
  console.error('❌ Strategy execution error:', evalError);
  return res.status(500).json({ 
    error: 'Strategy execution failed: ' + evalError.message,
    stack: evalError.stack,
    code_preview: js_code.substring(0, 500)
  });
}
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

