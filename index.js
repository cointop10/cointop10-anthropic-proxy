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
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Convert this ${mq_version} EA to JavaScript.

Requirements:
- Function: function runStrategy(candles, settings) { ... }
- Return: {trades, roi, mdd, win_rate, ...}
- Convert forex to crypto (lot → 100 USDT)
- Include masterReverse support

MQ Code:
${mq_code}

Return ONLY JavaScript function.`
        }]
      })
    });
    
    console.log('🔵 Status:', response.status);
    
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    const jsCode = data.content?.[0]?.text || '';
    console.log('✅ Success, length:', jsCode.length);
    
    res.json({ success: true, js_code: jsCode });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy running on port ${PORT}`);
});
