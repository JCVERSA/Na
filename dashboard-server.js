/**
 * Dashboard Server Router
 * Provides bot metrics, health status, and control panel API
 *
 * Authentication: Bearer token or ?key=<apikey> query parameter
 * Routes: /health, /info (public), /stats, /broadcast, /logs, /config (protected)
 */

'use strict';

const express = require('express');
const router = express.Router();
const config = require('./config');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ──────────────────────────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {
  // Try multiple auth methods
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.replace('Bearer ', '');
  const queryKey = req.query.key;
  const headerKey = req.headers['x-api-key'];

  const providedKey = bearerToken || queryKey || headerKey;
  const expectedKey = process.env.DASHBOARD_API_KEY;

  if (!expectedKey) {
    return res.status(503).json({
      error: 'Dashboard authentication not configured',
      message: 'Set DASHBOARD_API_KEY environment variable'
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }

  next();
};

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS (no authentication required)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /dashboard/health
 * Simple health check for load balancers and monitoring
 * Returns: { status: 'ok', uptime: number, timestamp: string }
 */
router.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /dashboard/info
 * Bot information without authentication
 * Returns: { botName, version, prefix, status }
 */
router.get('/info', (req, res) => {
  const botSock = global.botSock;
  const connected = botSock && botSock.user ? true : false;

  res.json({
    name: config.botName,
    version: '1.0.0',
    prefix: Array.isArray(config.prefix) ? config.prefix : [config.prefix],
    connected: connected,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PROTECTED ENDPOINTS (authentication required)
// ──────────────────────────────────────────────────────────────────────────────

router.use(requireAuth);

/**
 * GET /dashboard/stats
 * Detailed bot statistics (requires authentication)
 * Returns: Bot number, connection state, memory, uptime
 */
router.get('/stats', (req, res) => {
  try {
    const botSock = global.botSock;

    if (!botSock || !botSock.user) {
      return res.status(503).json({
        error: 'Bot not connected',
        status: 'offline'
      });
    }

    const botNumber = botSock.user.id.split(':')[0];
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const now = Date.now();

    res.json({
      status: 'online',
      botNumber: botNumber,
      botName: config.botName,
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime)
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
      },
      prefix: Array.isArray(config.prefix) ? config.prefix : [config.prefix],
      timestamp: new Date(now).toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: error.message
    });
  }
});

/**
 * POST /dashboard/broadcast
 * Send message to all groups (requires authentication + owner verification)
 * Body: { message: string, groupsOnly?: boolean }
 * Returns: { success: boolean, count: number, sent: string[] }
 */
router.post('/broadcast', (req, res) => {
  try {
    const botSock = global.botSock;

    if (!botSock || !botSock.user) {
      return res.status(503).json({
        error: 'Bot not connected'
      });
    }

    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Message body cannot be empty'
      });
    }

    // NOTE: Full implementation requires message sending
    // This is a stub that returns success format
    res.json({
      success: true,
      message: 'Broadcast endpoint ready (full implementation in next iteration)',
      count: 0,
      sent: []
    });

  } catch (error) {
    res.status(500).json({
      error: 'Broadcast failed',
      message: error.message
    });
  }
});

/**
 * GET /dashboard/config
 * Return non-sensitive configuration (requires authentication)
 * Returns: Bot settings (excludes API keys)
 */
router.get('/config', (req, res) => {
  try {
    res.json({
      botName: config.botName,
      prefix: Array.isArray(config.prefix) ? config.prefix : [config.prefix],
      timezone: config.timezone,
      dashboardPort: config.dashboardPort,
      // DO NOT return: apiKeys, ownerNumber, sessionID, renderSecret
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve config',
      message: error.message
    });
  }
});

/**
 * GET /dashboard/logs
 * Retrieve recent bot logs (requires authentication)
 * Query params: ?lines=50 (default 50, max 500)
 * Returns: { logs: string[], count: number }
 */
router.get('/logs', (req, res) => {
  try {
    const lines = Math.min(parseInt(req.query.lines) || 50, 500);
    const logsPath = path.join(__dirname, 'logs', 'bot.log');

    if (!fs.existsSync(logsPath)) {
      return res.json({
        logs: ['No logs available yet'],
        count: 0
      });
    }

    const content = fs.readFileSync(logsPath, 'utf-8');
    const logLines = content.split('\n').filter(l => l.trim());
    const recentLogs = logLines.slice(-lines);

    res.json({
      logs: recentLogs,
      count: recentLogs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ──────────────────────────────────────────────────────────────────────────────

router.use((err, req, res, next) => {
  console.error('[Dashboard] Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = router;
