/**
 * Nebula Bot — Main Entry Point
 * Created by Dark Neon
 */
// Load .env variables before anything else
require('dotenv').config();

process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer_cache_disabled';

const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');
initializeTempSystem();
startCleanup();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const forbiddenPatternsConsole = [
  'closing session',
  'closing open session',
  'sessionentry',
  'prekey bundle',
  'pendingprekey',
  '_chains',
  'registrationid',
  'currentratchet',
  'chainkey',
  'ratchet',
  'signal protocol',
  'ephemeralkeypair',
  'indexinfo',
  'basekey'
];

console.log = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleLog.apply(console, args);
  }
};

console.error = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) {
    originalConsoleWarn.apply(console, args);
  }
};

// Now safe to load libraries
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const handler = require('./handler');
const { handleAntiDelete, handleAntiViewOnce, handleSlowMode, commands } = handler;
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');

const createDashboardRouter = require('./dashboard-server');
const store = require('./utils/store');

const app = express();
app.use(bodyParser.json());

// ── Dashboard Server ──────────────────────────────────────────────────────────
// Dashboard with API key authentication
app.use('/dashboard', (req, res, next) => {
  // Allow public endpoints without auth
  if (req.path === '/health' || req.path === '/info') {
    return next();
  }

  // Require API key for protected endpoints
  const authHeader = req.headers['authorization'];
  const apiKey = authHeader?.replace('Bearer ', '') || req.query.key || req.headers['x-api-key'];
  const expectedKey = process.env.DASHBOARD_API_KEY;

  if (!expectedKey) {
    console.warn('⚠️ DASHBOARD_API_KEY not set — dashboard authentication disabled');
    return res.status(503).json({ error: 'Dashboard not configured' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}, createDashboardRouter);
app.get('/', (req, res) => {
  res.send('Nebula Bot is running! Dashboard: /dashboard');
});

const PORT = config.dashboardPort || 8000;
app.listen(PORT, () => {
  console.log(`📊 Dashboard server started on port ${PORT}`);
});
// ───────────────────────────────────────────────────────────────────────────────

// ─── Anti-Ban Reconnection State ─────────────────────────────────────────────
// Exponential backoff: 5s → 10s → 20s → 40s → 60s (max)
let reconnectDelay = 5000;
const MAX_RECONNECT_DELAY = 60000; // 60 secondes max
const RECONNECT_MULTIPLIER = 2;

function getNextReconnectDelay() {
  const current = reconnectDelay;
  // Add ±20% random jitter to avoid multiple instances reconnecting at the same time
  const jitter = current * 0.2 * (Math.random() * 2 - 1);
  reconnectDelay = Math.min(reconnectDelay * RECONNECT_MULTIPLIER, MAX_RECONNECT_DELAY);
  return Math.floor(current + jitter);
}

function resetReconnectDelay() {
  reconnectDelay = 5000;
}
// ─────────────────────────────────────────────────────────────────────────────

// Remove Puppeteer cache (if some dependency downloaded Chromium into ~/.cache/puppeteer)
function cleanupPuppeteerCache() {
  try {
    const home = os.homedir();
    const cacheDir = path.join(home, '.cache', 'puppeteer');

    if (fs.existsSync(cacheDir)) {
      console.log('🧹 Removing Puppeteer cache at:', cacheDir);
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ Puppeteer cache removed');
    }
  } catch (err) {
    console.error('⚠️ Failed to cleanup Puppeteer cache:', err.message || err);
  }
}

// Check for ffmpeg at startup
function checkFFmpeg() {
  try {
    const { execSync } = require('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    console.log('✅ ffmpeg is installed and available');
  } catch (err) {
    console.warn('⚠️  WARNING: ffmpeg is NOT installed or not found in PATH.');
    console.warn('   Audio conversion for .song command will fail (fallback to raw MP3).');
  }
}

/**
 * Validate critical configuration
 */
function validateConfig() {
  const criticalVars = ['SESSION_ID', 'OWNER_NUMBER'];
  const missing = criticalVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ CRITICAL ERROR: Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these in your .env file or environment variables.');
    process.exit(1);
  }
}

// Message deduplication — sliding window (Map id→timestamp, evict entries older than 5min)
const processedMessages = new Map();

setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, ts] of processedMessages.entries()) {
    if (ts < cutoff) processedMessages.delete(id);
  }
}, 60 * 1000);

// Custom Pino logger with suppression for Baileys noise
const createSuppressedLogger = (level = 'silent') => {
  const forbiddenPatterns = [
    'closing session', 'closing open session', 'sessionentry',
    'prekey bundle', 'pendingprekey', '_chains', 'registrationid',
    'currentratchet', 'chainkey', 'ratchet', 'signal protocol',
    'ephemeralkeypair', 'indexinfo', 'basekey', 'ratchetkey'
  ];

  let logger;
  try {
    logger = pino({
      level,
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname' }
      },
      customLevels: { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 },
      redact: ['registrationId', 'ephemeralKeyPair', 'rootKey', 'chainKey', 'baseKey']
    });
  } catch (err) {
    logger = pino({ level });
  }

  const originalInfo = logger.info.bind(logger);
  logger.info = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();
    if (!forbiddenPatterns.some(pattern => msg.includes(pattern))) {
      originalInfo(...args);
    }
  };
  logger.debug = () => {};
  logger.trace = () => {};
  return logger;
};

// Main connection function
async function startBot() {
  const sessionFolder = `./${config.sessionName}`;
  const sessionFile = path.join(sessionFolder, 'creds.json');

  // Support both NebulaBot! and KnightBot! session formats for backward compatibility
  const sessionID = config.sessionID || '';
  const sessionPrefix = sessionID.startsWith('NebulaBot!') ? 'NebulaBot'
                      : sessionID.startsWith('KnightBot!') ? 'KnightBot'
                      : null;

  if (sessionPrefix && sessionID.includes('!')) {
    try {
      const b64data = sessionID.split('!')[1];

      if (!b64data) {
        throw new Error(`❌ Invalid session format. Expected '${sessionPrefix}!.....'`);
      }

      const cleanB64 = b64data.replace('...', '');
      const compressedData = Buffer.from(cleanB64, 'base64');
      const decompressedData = zlib.gunzipSync(compressedData);

      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
      }

      fs.writeFileSync(sessionFile, decompressedData, 'utf8');
      console.log('📡 Session : 🔑 Retrieved from Nebula Bot Session');

    } catch (e) {
      console.error('📡 Session : ❌ Error processing session:', e.message);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();
  const suppressedLogger = createSuppressedLogger('silent');

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    printQRInTerminal: false,
    browser: ['Chrome', 'Windows', '10.0'],
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });

  store.bind(sock.ev);

  // Watchdog for inactive socket
  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  sock.ev.on('messages.upsert', () => {
    lastActivity = Date.now();
  });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && sock.ws.readyState === 1) {
      console.log('⚠️ No activity detected. Forcing reconnect...');
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      const delay = getNextReconnectDelay();
      console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s...`);
      setTimeout(() => startBot(), delay);
    }
  }, 5 * 60 * 1000);

  // ── Single unified connection.update handler (merged to prevent double-reconnect) ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      clearInterval(watchdogInterval); // stop watchdog on any close
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (statusCode === 515 || statusCode === 503 || statusCode === 408) {
        console.log(`⚠️ Connection closed (${statusCode}). Reconnecting...`);
      } else {
        console.log('Connection closed due to:', errorMessage, '\nReconnecting:', !isLoggedOut);
      }

      if (!isLoggedOut) {
        // ✅ Exponential backoff anti-ban reconnection
        const delay = getNextReconnectDelay();
        console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (anti-ban delay)...`);
        setTimeout(() => startBot(), delay);
      } else {
        console.log('❌ Logged out. Please restart and scan QR again.');
      }

    } else if (connection === 'open') {
      lastActivity = Date.now(); // reset watchdog timer on successful connect
      // Exposer le sock pour le dashboard
      global.botSock = sock;
      // Reset reconnect delay on successful connection
      resetReconnectDelay();

      console.log('\n✅ Bot connected successfully!');
      console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
      console.log(`🤖 Bot Name: ${config.botName}`);
      console.log(`⚡ Prefix(es): ${Array.isArray(config.prefix) ? config.prefix.join(', ') : config.prefix}`);      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(',') : config.ownerName;
      console.log(`👑 Owner: ${ownerNames}\n`);
      console.log('Bot is ready to receive messages!\n');

      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Active 24/7`);
      }

      handler.initializeAntiCall(sock);

      // ─── Anti-Ban: passer hors ligne au démarrage ──────────────────────
      // Le bot ne se montre jamais "en ligne" en permanence
      // Cela réduit la détection par WhatsApp
      try {
        const { goOffline } = require('./utils/antiban');
        await goOffline(sock);
        console.log('🛡️  Anti-ban: Bot presence set to offline');
      } catch (e) { /* silencieux */ }
      // ───────────────────────────────────────────────────────────────────

      // ─── Cron Scheduler : tâches automatiques ─────────────────────────
      try {
        const { initScheduler } = require('./utils/scheduler');
        initScheduler(sock);
        console.log('⏰  Scheduler: Auto tasks initialized');
      } catch (e) {
        console.error('⚠️  Scheduler error:', e.message);
      }
      // ───────────────────────────────────────────────────────────────────

      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => m.messageTimestamp * 1000 || 0);
        if (timestamps.length > 0 && now - Math.max(...timestamps) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
      console.log(`🧹 Store cleaned. Active chats: ${store.messages.size}`);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Restaurer les tempbans au démarrage ──
  try {
    const tempbanCmd = require('./commands/admin/tempban');
    tempbanCmd.restoreTimers(sock);
    console.log('✅ TempBan timers restaurés.');
  } catch (e) {
    console.warn('⚠️ TempBan restore error:', e.message);
  }

  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') ||
      jid.includes('status.broadcast') ||
      jid.includes('@newsletter') ||
      jid.includes('@newsletter.');
  };

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;
      if (isSystemJid(from)) continue;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;

      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      if (msg.messageTimestamp) {
        const messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) continue;
      }

      processedMessages.set(msgId, Date.now());

      // ── SlowMode check (avant de traiter le message) ──
      const blockedBySlowMode = await handleSlowMode(sock, msg).catch(() => false);
      if (blockedBySlowMode) continue;

      // ── AntiViewOnce check ──
      handleAntiViewOnce(sock, msg).catch(() => {});

      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit') &&
          !err.message?.includes('not-authorized')) {
          console.error('Error handling message:', err.message);
        }
      });

      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try { await sock.readMessages([msg.key]); } catch (e) {}
        }
        if (from.endsWith('@g.us')) {
          try {
            const groupMetadata = await handler.getGroupMetadata(sock, msg.key.remoteJid);
            if (groupMetadata) {
              await handler.handleAntilink(sock, msg, groupMetadata);
            }
          } catch (error) {}
        }
      });
    }
  });

  sock.ev.on('message-receipt.update', () => {});
  sock.ev.on('messages.update', (update) => {
    // AntiDelete: détecter les suppressions de messages
    handleAntiDelete(sock, update).catch(() => {});
  });

  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    console.error('Socket error:', error.message || error);
  });

  return sock;
}

// Start the bot
console.log('🚀 Starting Nebula Bot...\n');
console.log(`📦 Bot Name: ${config.botName}`);
console.log(`⚡ Prefix(es): ${Array.isArray(config.prefix) ? config.prefix.join(', ') : config.prefix}`);const ownerNames = Array.isArray(config.ownerName) ? config.ownerName.join(',') : config.ownerName;
console.log(`👑 Owner: ${ownerNames}\n`);

cleanupPuppeteerCache();
checkFFmpeg();
validateConfig();

startBot().catch(err => {
  console.error('Error starting bot:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.error('⚠️ ENOSPC Error: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    console.warn('⚠️ Cleanup completed. Bot will continue but may experience issues until space is freed.');
    return;
  }
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  if (err.code === 'ENOSPC' || err.errno === -28 || err.message?.includes('no space left on device')) {
    console.warn('⚠️ ENOSPC Error in promise: No space left on device. Attempting cleanup...');
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    console.warn('⚠️ Cleanup completed. Bot will continue but may experience issues until space is freed.');
    return;
  }
  if (err.message && err.message.includes('rate-overlimit')) {
    console.warn('⚠️ Rate limit reached. Please slow down your requests.');
    return;
  }
  console.error('Unhandled Rejection:', err);
});

// Export store for use in commands
module.exports = { store };
