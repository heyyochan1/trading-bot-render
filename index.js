const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');
const app = express();

// Telegram Bot Token
const TOKEN = '7792899740:AAFhz9a8wOp1dngZOO3dARde_xf7tZ3kSjQ'; // 你的 Bot Token
const CHAT_ID = '222684328'; // 你的 Telegram 聊天 ID

// Middleware to parse JSON and text bodies
app.use(bodyParser.json()); // 解析 JSON
app.use(bodyParser.text({ type: 'text/plain' })); // 解析 text/plain

// 臨時 GET 路由（用於測試）
app.get('/', (req, res) => {
  res.send('Node.js Server is running!');
});

app.get('/webhook', (req, res) => {
  res.send('This is the /webhook endpoint. Please send a POST request.');
});

// Webhook 端點
app.post('/webhook', (req, res) => {
  console.log('Received webhook request - Headers:', req.headers);
  console.log('Received webhook request - Raw Body:', req.body);

  let data;
  try {
    // 如果 req.body 是字符串（text/plain），清理換行符並解析為 JSON
    if (typeof req.body === 'string') {
      const cleanedBody = req.body.replace(/\n/g, '\\n');
      data = JSON.parse(cleanedBody);
    } else {
      data = req.body; // 已經是 JSON 對象
    }
  } catch (err) {
    console.error('Error parsing body:', err);
    return res.status(400).send('Invalid request format');
  }

  if (!data || Object.keys(data).length === 0) {
    console.log('Invalid request: Empty or undefined body');
    return res.status(400).send('Invalid request: Empty body');
  }

  const { type, side, text } = data;

  if (type === 'entry') {
    const defaultReplyMarkup = {
      inline_keyboard: [
        [
          { text: '✅入場', callback_data: 'activate_' + side },
          { text: '❌不入場', callback_data: 'ignore' }
        ]
      ]
    };

    bot.sendMessage(CHAT_ID, text, {
      reply_markup: defaultReplyMarkup,
      parse_mode: 'Markdown'
    }).then((msg) => {
      tradeState.messageId = msg.message_id;
      console.log('Message sent to Telegram:', text);
      res.sendStatus(200);
    }).catch((err) => {
      console.error('Error sending Telegram message:', err);
      res.sendStatus(500);
    });
  } else if (type === 'risk') {
    bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' })
      .then(() => {
        console.log('Risk message sent to Telegram:', text);
        res.sendStatus(200);
      })
      .catch((err) => {
        console.error('Error sending risk alert:', err);
        res.sendStatus(500);
      });
  } else {
    console.log('Invalid type:', type);
    res.sendStatus(400);
  }
});

// Telegram Bot 初始化
const bot = new TelegramBot(TOKEN, { polling: true });
let tradeState = {
  active: false,
  side: null,
  startTime: null,
  messageId: null
};

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const callbackData = callbackQuery.data;

  if (callbackData.startsWith('activate_')) {
    const side = callbackData.split('_')[1]; // 提取 side（long 或 short）
    tradeState.active = true;
    tradeState.side = side;
    tradeState.startTime = Date.now();

    bot.answerCallbackQuery(callbackQuery.id)
      .then(() => bot.sendMessage(chatId, '✅ 交易已啟動！開始 5 分鐘風險監控...', {}))
      .catch((err) => console.error('Error answering callback:', err));

    setTimeout(() => checkRisk(), 300000); // 5 分鐘
  } else if (callbackData === 'ignore') {
    bot.answerCallbackQuery(callbackQuery.id)
      .then(() => bot.sendMessage(chatId, '❌ 交易已忽略。', {}))
      .catch((err) => console.error('Error answering callback:', err));

    tradeState.active = false;
    tradeState.side = null;
    tradeState.startTime = null;
  }
});

function checkRisk() {
  if (tradeState.active && tradeState.side) {
    const riskText = `⚠️ ETH 快速風險變化提示 📡\n📅 時框：5分鐘 | ⏰ 檢查時間：${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}\n⭐ 風險級別：${getStars(3)} (${Math.round(50)}%)\n\n📉 異常因子升幅：🌡️\n📊 成交量壓力 (高於 MA10) ✅\n📉 成交量/價格 (高於 MA10) ✅\n📈 EMA5 / EMA10 下降 ✅\n📉 MACD 死叉 ✅\n⚠️ 優先級依據：優先級低於原單\n\n💡 建議動作：平倉觀察 🛑\n💰 最佳平倉價：3000.00`;
    bot.sendMessage(CHAT_ID, riskText, { parse_mode: 'Markdown' })
      .catch((err) => console.error('Error sending risk alert:', err));

    tradeState.active = false;
    tradeState.side = null;
    tradeState.startTime = null;
  }
}

// 計算星星分數
function getStars(score) {
  const maxScore = 8;
  const starCount = Math.min(Math.floor((score / maxScore) * 8), 8);
  const percentage = Math.round((score / maxScore) * 100);
  return '⭐'.repeat(starCount) + ` (${percentage}%)`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
