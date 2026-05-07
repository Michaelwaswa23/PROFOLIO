// ================================================
// Michael Waswa Portfolio — Contact Form Server
// Run locally: node server.js
// No Express needed — uses built-in http module
// ================================================

const http     = require('http');
const mongoose = require('mongoose');

// ---- CONFIG — edit these ----
const MONGO_URI = 'mongodb://localhost:27017/portfolio';
const PORT      = 5000;
const ADMIN_KEY = 'my-secret-key'; // used to view messages: GET /api/messages?key=my-secret-key
// -----------------------------

// ---- MongoDB Schema ----
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

const Contact = mongoose.model('Contact', new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true },
  subject:   { type: String, default: 'No subject' },
  message:   { type: String, required: true },
  createdAt: { type: Date,   default: Date.now }
}));

// ---- Helpers ----
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',              // allow your HTML file to call this
    'Access-Control-Allow-Headers':'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end',  () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ---- Server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // POST /api/contact — save a message
  if (req.method === 'POST' && url.pathname === '/api/contact') {
    try {
      const { name, email, subject, message } = await readBody(req);

      if (!name || !email || !message) {
        return send(res, 400, { success: false, error: 'Name, email, and message are required.' });
      }

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        return send(res, 400, { success: false, error: 'Invalid email address.' });
      }

      await new Contact({ name, email, subject, message }).save();
      console.log(`📨 New message from ${name} <${email}>`);
      return send(res, 201, { success: true, message: "Message received! I'll be in touch soon." });

    } catch (err) {
      console.error('Save error:', err.message);
      return send(res, 500, { success: false, error: 'Server error. Please try again.' });
    }
  }

  // GET /api/messages?key=ADMIN_KEY — view all saved messages
  if (req.method === 'GET' && url.pathname === '/api/messages') {
    if (url.searchParams.get('key') !== ADMIN_KEY) {
      return send(res, 401, { error: 'Unauthorised' });
    }
    try {
      const messages = await Contact.find().sort({ createdAt: -1 });
      return send(res, 200, { count: messages.length, messages });
    } catch (err) {
      return send(res, 500, { error: 'Could not fetch messages.' });
    }
  }

  // Health check
  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, { status: 'Portfolio contact server is running ✅' });
  }

  send(res, 404, { error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 View messages: http://localhost:${PORT}/api/messages?key=${ADMIN_KEY}`);
});