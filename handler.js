/**
 * Message Handler - Processes incoming messages and executes commands
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { checkSpam } = require('./commands/admin/antispam');
const { addMessage, incrementBotStat } = require('./utils/groupstats');
const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { isRateLimited, getRateLimitRemaining, simulateTyping, goOffline } = require('./utils/antiban');
const formatter = require('./utils/formatter');
const { ValidationError } = require('./utils/validation');
// Store partagé — utilisé par handleAntiDelete pour retrouver les messages supprimés
const store = require('./utils/store');

// Group metadata cache to prevent rate limiting
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

// Evict stale entries every 2 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL * 2;
  for (const [key, val] of groupMetadataCache.entries()) {
    if (val.timestamp < cutoff) groupMetadataCache.delete(key);
  }
}, CACHE_TTL * 2);

// Load all commands
const commands = loadCommands();

// Unwrap WhatsApp containers (ephemeral, view once, etc.)
const getMessageContent = (msg) => {
  if (!msg || !msg.message) return null;
  
  let m = msg.message;
  
  // Common wrappers in modern WhatsApp
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  
  // You can add more wrappers if needed later
  return m;
};

// Cached group metadata getter with rate limit handling (for non-admin checks)
const getCachedGroupMetadata = async (sock, groupId) => {
  try {
    // Validate group JID before attempting to fetch
    if (!groupId || !groupId.endsWith('@g.us')) {
      return null;
    }
    
    // Check cache first
    const cached = groupMetadataCache.get(groupId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data; // Return cached data (even if null for forbidden groups)
    }
    
    // Fetch from API
    const metadata = await sock.groupMetadata(groupId);
    
    // Cache it
    groupMetadataCache.set(groupId, {
      data: metadata,
      timestamp: Date.now()
    });
    
    return metadata;
  } catch (error) {
    // Handle forbidden (403) errors - cache null to prevent retry storms
    if (error.message && (
      error.message.includes('forbidden') || 
      error.message.includes('403') ||
      error.statusCode === 403 ||
      error.output?.statusCode === 403 ||
      error.data === 403
    )) {
      // Cache null for forbidden groups to prevent repeated attempts
      groupMetadataCache.set(groupId, {
        data: null,
        timestamp: Date.now()
      });
      return null; // Silently return null for forbidden groups
    }
    
    // Handle rate limit errors
    if (error.message && error.message.includes('rate-overlimit')) {
      const cached = groupMetadataCache.get(groupId);
      if (cached) {
        return cached.data;
      }
      return null;
    }
    
    // For other errors, try cached data as fallback
    const cached = groupMetadataCache.get(groupId);
    if (cached) {
      return cached.data;
    }
    
    // Return null instead of throwing to prevent crashes
    return null;
  }
};

// Live group metadata getter (always fresh, no cache) - for admin checks
const getLiveGroupMetadata = async (sock, groupId) => {
  try {
    // Always fetch fresh metadata, bypass cache
    const metadata = await sock.groupMetadata(groupId);
    
    // Update cache for other features (antilink, welcome, etc.)
    groupMetadataCache.set(groupId, {
      data: metadata,
      timestamp: Date.now()
    });
    
    return metadata;
  } catch (error) {
    // On error, try cached data as fallback
    const cached = groupMetadataCache.get(groupId);
    if (cached) {
      return cached.data;
    }
    return null;
  }
};

// Alias for backward compatibility (non-admin features use cached)
const getGroupMetadata = getCachedGroupMetadata;

// Helper functions
const isOwner = (sender) => {
  if (!sender) return false;
  
  // Normalize sender JID to handle LID
  const normalizedSender = normalizeJidWithLid(sender);
  const senderNumber = normalizeJid(normalizedSender);
  
  // Check against owner numbers
  return config.ownerNumber.some(owner => {
    const normalizedOwner = normalizeJidWithLid(owner.includes('@') ? owner : `${owner}@s.whatsapp.net`);
    const ownerNumber = normalizeJid(normalizedOwner);
    return ownerNumber === senderNumber;
  });
};

const isMod = (sender) => {
  const number = sender.split('@')[0];
  return database.isModerator(number);
};

// LID mapping cache — FIFO borné à 2000 entrées pour éviter les fuites mémoire
const LID_CACHE_MAX = 2000;
const lidMappingCache = new Map();

function lidCacheSet(key, value) {
  if (lidMappingCache.size >= LID_CACHE_MAX) {
    // Supprimer la plus ancienne entrée (première clé insérée)
    lidMappingCache.delete(lidMappingCache.keys().next().value);
  }
  lidMappingCache.set(key, value);
}

// Helper to normalize JID to just the number part
const normalizeJid = (jid) => {
  if (!jid) return null;
  if (typeof jid !== 'string') return null;
  
  // Remove device ID if present (e.g., "1234567890:0@s.whatsapp.net" -> "1234567890")
  if (jid.includes(':')) {
    return jid.split(':')[0];
  }
  // Remove domain if present (e.g., "1234567890@s.whatsapp.net" -> "1234567890")
  if (jid.includes('@')) {
    return jid.split('@')[0];
  }
  return jid;
};

// Get LID mapping value from session files
const getLidMappingValue = (user, direction) => {
  if (!user) return null;
  
  const cacheKey = `${direction}:${user}`;
  if (lidMappingCache.has(cacheKey)) {
    return lidMappingCache.get(cacheKey);
  }
  
  const sessionPath = path.join(__dirname, config.sessionName || 'session');
  const suffix = direction === 'pnToLid' ? '.json' : '_reverse.json';
  const filePath = path.join(sessionPath, `lid-mapping-${user}${suffix}`);
  
  if (!fs.existsSync(filePath)) {
    lidCacheSet(cacheKey, null);
    return null;
  }
  
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const value = raw ? JSON.parse(raw) : null;
    lidCacheSet(cacheKey, value || null);
    return value || null;
  } catch (error) {
    lidCacheSet(cacheKey, null);
    return null;
  }
};

// Normalize JID handling LID conversion
const normalizeJidWithLid = (jid) => {
  if (!jid) return jid;
  
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return `${jid.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    }
    
    let user = decoded.user;
    let server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    
    const mapToPn = () => {
      const pnUser = getLidMappingValue(user, 'lidToPn');
      if (pnUser) {
        user = pnUser;
        server = server === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        return true;
      }
      return false;
    };
    
    if (server === 'lid' || server === 'hosted.lid') {
      mapToPn();
    } else if (server === 's.whatsapp.net' || server === 'hosted') {
      mapToPn();
    }
    
    if (server === 'hosted') {
      return jidEncode(user, 'hosted');
    }
    return jidEncode(user, 's.whatsapp.net');
  } catch (error) {
    return jid;
  }
};

// Build comparable JID variants (PN + LID) for matching
const buildComparableIds = (jid) => {
  if (!jid) return [];
  
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return [normalizeJidWithLid(jid)].filter(Boolean);
    }
    
    const variants = new Set();
    const normalizedServer = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    
    variants.add(jidEncode(decoded.user, normalizedServer));
    
    const isPnServer = normalizedServer === 's.whatsapp.net' || normalizedServer === 'hosted';
    const isLidServer = normalizedServer === 'lid' || normalizedServer === 'hosted.lid';
    
    if (isPnServer) {
      const lidUser = getLidMappingValue(decoded.user, 'pnToLid');
      if (lidUser) {
        const lidServer = normalizedServer === 'hosted' ? 'hosted.lid' : 'lid';
        variants.add(jidEncode(lidUser, lidServer));
      }
    } else if (isLidServer) {
      const pnUser = getLidMappingValue(decoded.user, 'lidToPn');
      if (pnUser) {
        const pnServer = normalizedServer === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        variants.add(jidEncode(pnUser, pnServer));
      }
    }
    
    return Array.from(variants);
  } catch (error) {
    return [jid];
  }
};

// Find participant by either PN JID or LID JID
const findParticipant = (participants = [], userIds) => {
  const targets = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .flatMap(id => buildComparableIds(id));
  
  if (!targets.length) return null;
  
  return participants.find(participant => {
    if (!participant) return false;
    
    const participantIds = [
      participant.id,
      participant.lid,
      participant.userJid
    ]
      .filter(Boolean)
      .flatMap(id => buildComparableIds(id));
    
    return participantIds.some(id => targets.includes(id));
  }) || null;
};

const isAdmin = async (sock, participant, groupId, groupMetadata = null) => {
  if (!participant) return false;
  
  // Early return for non-group JIDs (DMs) - prevents slow sock.groupMetadata() call
  if (!groupId || !groupId.endsWith('@g.us')) {
    return false;
  }
  
  // Always fetch live metadata for admin checks
  let liveMetadata = groupMetadata;
  if (!liveMetadata || !liveMetadata.participants) {
    if (groupId) {
      liveMetadata = await getLiveGroupMetadata(sock, groupId);
    } else {
      return false;
    }
  }
  
  if (!liveMetadata || !liveMetadata.participants) return false;
  
  // Use findParticipant to handle LID matching
  const foundParticipant = findParticipant(liveMetadata.participants, participant);
  if (!foundParticipant) return false;
  
  return foundParticipant.admin === 'admin' || foundParticipant.admin === 'superadmin';
};

const isBotAdmin = async (sock, groupId, groupMetadata = null) => {
  if (!sock.user || !groupId) return false;
  
  // Early return for non-group JIDs (DMs) - prevents slow sock.groupMetadata() call
  if (!groupId.endsWith('@g.us')) {
    return false;
  }
  
  try {
    // Get bot's JID - Baileys stores it in sock.user.id
    const botId = sock.user.id;
    const botLid = sock.user.lid;
    
    if (!botId) return false;
    
    // Prepare bot JIDs to check - findParticipant will normalize them via buildComparableIds
    const botJids = [botId];
    if (botLid) {
      botJids.push(botLid);
    }
    
    // ALWAYS fetch live metadata for bot admin checks (never use cached)
    const liveMetadata = await getLiveGroupMetadata(sock, groupId);
    
    if (!liveMetadata || !liveMetadata.participants) return false;
    
    const participant = findParticipant(liveMetadata.participants, botJids);
    if (!participant) return false;
    
    return participant.admin === 'admin' || participant.admin === 'superadmin';
  } catch (error) {
    return false;
  }
};

const isUrl = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return urlRegex.test(text);
};

const hasGroupLink = (text) => {
  const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
  return linkRegex.test(text);
};

// System JID filter - checks if JID is from broadcast/status/newsletter
const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || 
         jid.includes('status.broadcast') || 
         jid.includes('@newsletter') ||
         jid.includes('@newsletter.');
};

// Main message handler
const handleMessage = async (sock, msg) => {
  try {
    // Debug logging to see all messages
    // Debug log removed
    
    if (!msg.message) return;
    
    const from = msg.key.remoteJid;
    
    // System message filter - ignore broadcast/status/newsletter messages
    if (isSystemJid(from)) {
      return; // Silently ignore system messages
    }
    
    // Auto-React System
    try {
      // Clear cache to get fresh config values
      delete require.cache[require.resolve('./config')];
      const freshConfig = require('./config');

      if (freshConfig.autoReact && msg.message && !msg.key.fromMe) {
        const content = msg.message.ephemeralMessage?.message || msg.message;
        const text =
          content.conversation ||
          content.extendedTextMessage?.text ||
          '';

        const jid = msg.key.remoteJid;
        const emojis = ['❤️','🔥','👌','💀','😁','✨','👍','🤨','😎','😂','🤝','💫'];
        
        const mode = freshConfig.autoReactMode || 'bot';

        if (mode === 'bot') {
          const prefixList = ['.', '/', '#'];
          if (prefixList.includes(text?.trim()[0])) {
            await sock.sendMessage(jid, {
              react: { text: '⏳', key: msg.key }
            });
          }
        }

        if (mode === 'all') {
          const rand = emojis[Math.floor(Math.random() * emojis.length)];
          await sock.sendMessage(jid, {
            react: { text: rand, key: msg.key }
          });
        }
      }
    } catch (e) {
      console.error('[AutoReact Error]', e.message);
    }
    
    // Unwrap containers first
    const content = getMessageContent(msg);
    // Note: We don't return early if content is null because forwarded status messages might not have content
    
    // Still check for actual message content for regular processing
    let actualMessageTypes = [];
    if (content) {
      const allKeys = Object.keys(content);
      // Filter out protocol/system messages and find actual message content
      const protocolMessages = ['protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo'];
      actualMessageTypes = allKeys.filter(key => !protocolMessages.includes(key));
    }
    
    // We'll check for empty content later after we've processed group messages
    
    // Use the first actual message type (conversation, extendedTextMessage, etc.)
    const messageType = actualMessageTypes[0];
    
    // from already defined above in DM block check
    const sender = msg.key.fromMe ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : msg.key.participant || msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us'); // Should always be true now due to DM block above
    
    // Fetch group metadata immediately if it's a group
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;
    
    // Anti-group mention protection — appelé une seule fois, plus bas après le prefix check
    // (suppression du double appel qui causait des actions dupliquées)
    
    // Track group message statistics
    if (isGroup) {
      // Track message type for extended stats
      const _msgType = (messageType === 'imageMessage' || messageType === 'videoMessage' || messageType === 'audioMessage' || messageType === 'stickerMessage' || messageType === 'documentMessage') ? 'media' : 'text';
      addMessage(from, sender, _msgType);
      incrementBotStat('totalMessages');
    }

    // Anti-spam check (avant tout le reste)
    if (isGroup && !msg.key.fromMe) {
      const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
      const senderIsOwner = isOwner(sender);
      if (!senderIsAdmin && !senderIsOwner) {
        const wasSpam = await checkSpam(sock, msg, from, sender);
        if (wasSpam) return;
      }
    }
    
    // Return early for non-group messages with no recognizable content
    if (!content || actualMessageTypes.length === 0) return;
    
    // 🔹 Button response should also check unwrapped content
    const btn = content.buttonsResponseMessage || msg.message?.buttonsResponseMessage;
    if (btn) {
      const buttonId = btn.selectedButtonId;
      const displayText = btn.selectedDisplayText;
      
      // Handle button clicks by routing to commands
      if (buttonId === 'btn_menu') {
        // Execute menu command
        const menuCmd = commands.get('menu');
        if (menuCmd) {
          await menuCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      } else if (buttonId === 'btn_ping') {
        // Execute ping command
        const pingCmd = commands.get('ping');
        if (pingCmd) {
          await pingCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      } else if (buttonId === 'btn_help') {
        // Execute list command again (help)
        const listCmd = commands.get('list');
        if (listCmd) {
          await listCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      }
    }
    
    // Get message body from unwrapped content
    let body = '';
    if (content.conversation) {
      body = content.conversation;
    } else if (content.extendedTextMessage) {
      body = content.extendedTextMessage.text || '';
    } else if (content.imageMessage) {
      body = content.imageMessage.caption || '';
    } else if (content.videoMessage) {
      body = content.videoMessage.caption || '';
    }
    
    body = (body || '').trim();
    
    // Check antiall protection (owner only feature)
    if (isGroup) {
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.antiall) {
        const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
        const senderIsOwner = isOwner(sender);
        
        if (!senderIsAdmin && !senderIsOwner) {
          const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
          if (botIsAdmin) {
            await sock.sendMessage(from, { delete: msg.key });
            return;
          }
        }
      }
      
      // Anti-tag protection (check BEFORE text check, as tagall can have no text)
      if (groupSettings.antitag && !msg.key.fromMe) {
        const ctx = content.extendedTextMessage?.contextInfo;
        const mentionedJids = ctx?.mentionedJid || [];
        
        const messageText = (
          body ||
          content.imageMessage?.caption ||
          content.videoMessage?.caption ||
          ''
        );
        
        const textMentions = messageText.match(/@[\d+\s\-()~.]+/g) || [];
        const numericMentions = messageText.match(/@\d{10,}/g) || [];
        
        const uniqueNumericMentions = new Set();
        numericMentions.forEach((mention) => {
          const numMatch = mention.match(/@(\d+)/);
          if (numMatch) uniqueNumericMentions.add(numMatch[1]);
        });
        
        const mentionedJidCount = mentionedJids.length;
        const numericMentionCount = uniqueNumericMentions.size;
        const totalMentions = Math.max(mentionedJidCount, numericMentionCount);
        
        if (totalMentions >= 3) {
          try {
            const participants = groupMetadata.participants || [];
            const mentionThreshold = Math.max(3, Math.ceil(participants.length * 0.5));
            const hasManyNumericMentions = numericMentionCount >= 10 ||
              (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);
            
            if (totalMentions >= mentionThreshold || hasManyNumericMentions) {
              const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
              const senderIsOwner = isOwner(sender);
              
              if (!senderIsAdmin && !senderIsOwner) {
                const action = (groupSettings.antitagAction || 'delete').toLowerCase();
                
                if (action === 'delete') {
                  try {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.sendMessage(from, { 
                      text: '⚠️ *Tagall Detected!*',
                      mentions: [sender]
                    }, { quoted: msg });
                  } catch (e) {
                    console.error('Failed to delete tagall message:', e);
                  }
                } else if (action === 'kick') {
                  try {
                    await sock.sendMessage(from, { delete: msg.key });
                  } catch (e) {
                    console.error('Failed to delete tagall message:', e);
                  }
                  
                  const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
                  if (botIsAdmin) {
                    try {
                      await sock.groupParticipantsUpdate(from, [sender], 'remove');
                    } catch (e) {
                      console.error('Failed to kick for antitag:', e);
                    }
                    const usernames = [`@${sender.split('@')[0]}`];
                    await sock.sendMessage(from, {
                      text: `🚫 *Antitag Detected!*\n\n${usernames.join(', ')} has been kicked for tagging all members.`,
                      mentions: [sender],
                    }, { quoted: msg });
                  }
                }
                return;
              }
            }
          } catch (e) {
            console.error('Error during anti-tag enforcement:', e);
          }
        }
      }
    }
    
    // Anti-group mention protection (check BEFORE prefix check, as these are non-command messages)
    // Anti-group mention protection
    if (isGroup) {
      try {
        await handleAntigroupmention(sock, msg, groupMetadata);
      } catch (error) {
        console.error('Error in antigroupmention handler:', error);
      }
    }
    
    // Determine the prefix used (if any)
    const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
    const usedPrefix = prefixes.find(p => body.startsWith(p));

    // AutoSticker feature - convert images/videos to stickers automatically
    if (isGroup) { // Process all messages in groups (including bot's own messages)
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.autosticker) {
        const mediaMessage = content?.imageMessage || content?.videoMessage;
        
        // Only process if it's an image or video (not documents)
        if (mediaMessage) {
          // Skip if message has a command prefix (let command handle it)
          if (!usedPrefix) {
            try {
              // Import sticker command logic
              const stickerCmd = commands.get('sticker');
              if (stickerCmd) {
                // Execute sticker conversion silently
                await stickerCmd.execute(sock, msg, [], {
                  from,
                  sender,
                  isGroup,
                  groupMetadata,
                  isOwner: isOwner(sender),
                  isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                  isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
                  isMod: isMod(sender),
                  reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                  react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
                });
                return; // Don't process as command after auto-converting
              }
            } catch (error) {
              console.error('[AutoSticker Error]:', error);
              // Continue to normal processing if autosticker fails
            }
          }
        }
      }
    }
    
    // Check if message starts with prefix
    // ── Nova AI : Chatbot intelligent (Gemini) ─────────────────────────────
    if (!usedPrefix) {
      const isChatbotEnabled = isGroup ? (await database.getGroupSettings(from)).chatbot : true;
      
      // On répond si :
      // 1. C'est un chat privé (toujours activé par défaut)
      // 2. C'est un groupe et le réglage 'chatbot' est ON
      // JAMAIS si le message vient du bot lui-même
      if (isChatbotEnabled && !msg.key.fromMe) {
        const apiKey = config.apiKeys?.gemini;
        if (!apiKey) return;

        // Cooldown par utilisateur (5s) pour éviter le spam
        if (!handleMessage._novaCooldown) handleMessage._novaCooldown = new Map();
        const lastReply = handleMessage._novaCooldown.get(sender) || 0;
        if (Date.now() - lastReply < 5000) return;
        handleMessage._novaCooldown.set(sender, Date.now());

        const { novaChat, novaAnalyzeImage } = require('./utils/novaClient');

        // Réaction ⏳ pendant que Nova réfléchit
        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        try {
          let reply;
          const imgMsg = content?.imageMessage;

          if (imgMsg) {
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const stream = await downloadContentFromMessage(imgMsg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            reply = await novaAnalyzeImage(apiKey, sender, buffer.toString('base64'), imgMsg.mimetype || 'image/jpeg', body.trim() || null);
          } else if (body.trim().length > 0) {
            reply = await novaChat(apiKey, sender, body.trim());
          } else {
            return;
          }

          await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
          await sock.sendMessage(from, { text: reply }, { quoted: msg });

        } catch (err) {
          console.error('[Nova Error]:', err.message);
          await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});

          let errMsg;
          if (err.message?.includes('TIMEOUT'))      errMsg = '⏱️ Nova met trop de temps à répondre.';
          else if (err.message?.includes('401'))      errMsg = '🔑 Clé API invalide.';
          else if (err.message?.includes('429'))      errMsg = '⏳ Trop de requêtes (quota Gemini), attends un instant.';
          else if (err.message?.includes('SAFETY'))   errMsg = '⚠️ Contenu bloqué par sécurité.';
          else                                        errMsg = '❌ Une erreur est survenue.';

          await sock.sendMessage(from, { text: errMsg }, { quoted: msg }).catch(() => {});
        }
      }
      return;
    }

    // Parse command
    const args = body.slice(usedPrefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    
    // Get command
    const command = commands.get(commandName);
    if (!command) {
      return;
    }
    
    // ─── Anti-Ban: Rate Limiter Global ─────────────────────────────────────
    // Ignore les utilisateurs qui spamment les commandes (max 8 cmds / 10s)
    if (!isOwner(sender) && isRateLimited(sender)) {
      const remaining = getRateLimitRemaining(sender);
      // On n'envoie pas de message pour ne pas générer encore plus de trafic
      console.warn(`[Anti-Ban] Ignoring rate-limited user: ${sender} (${remaining}s left)`);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    // Check self mode (private mode) - only owner can use commands
    if (config.selfMode && !isOwner(sender)) {
      return;
    }
    
    // Permission checks
    if (command.ownerOnly && !isOwner(sender)) {
      return sock.sendMessage(from, { text: config.messages.ownerOnly }, { quoted: msg });
    }
    
    if (command.modOnly && !isMod(sender) && !isOwner(sender)) {
      return sock.sendMessage(from, { text: '🔒 This command is only for moderators!' }, { quoted: msg });
    }
    
    if (command.groupOnly && !isGroup) {
      return sock.sendMessage(from, { text: config.messages.groupOnly }, { quoted: msg });
    }
    
    if (command.privateOnly && isGroup) {
      return sock.sendMessage(from, { text: config.messages.privateOnly }, { quoted: msg });
    }
    
    if (command.adminOnly && !(await isAdmin(sock, sender, from, groupMetadata)) && !isOwner(sender)) {
      return sock.sendMessage(from, { text: config.messages.adminOnly }, { quoted: msg });
    }
    
    if (command.botAdminNeeded) {
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      if (!botIsAdmin) {
        return sock.sendMessage(from, { text: config.messages.botAdminNeeded }, { quoted: msg });
      }
    }
    
    // Auto-typing (présence humaine simulée — repasse hors ligne après)
    if (config.autoTyping) {
      await simulateTyping(sock, from, true); // true = repasse hors ligne après
    } else {
      // Même sans autoTyping, on s'assure que le bot reste "hors ligne"
      // pour ne pas paraître constamment connecté (réduit le risque de ban)
      goOffline(sock).catch(() => {});
    }
    
    // ── Vérification feature activée dans le groupe ─────────────
    // Si la commande a un "featureKey", vérifier dans les settings du groupe
    // EXCEPTION : les admins et le owner peuvent toujours exécuter la commande
    // (sinon ils ne pourraient pas activer une feature désactivée — boucle infernale)
    if (isGroup && command.featureKey) {
      const groupSettings = database.getGroupSettings(from);
      if (!groupSettings[command.featureKey]) {
        const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
        const senderIsOwner = isOwner(sender);
        if (!senderIsAdmin && !senderIsOwner) {
          return sock.sendMessage(from, {
            text: '⚙️ Cette fonctionnalité est désactivée dans ce groupe.\n\n' +
                  'Un admin peut l\'activer avec: `.settings ' + command.featureKey + ' on`'
          }, { quoted: msg });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────

    // ── Gate mort NeonParty ───────────────────────────────────────────────
    // Quand un joueur est mort, il ne peut faire que quelques commandes passives
    const ALLOWED_DEAD = new Set([
      'balance','solde','bal',
      'gprofile','gprofil','fiche','gameprofile','gp',
      'me','profile','profil',
      'levels','niveau','rank',
      'pvprank','pvp',
      'inventory','inventaire','inv',
      'richlist','toprichlist','rich',
      'topxp','xprank',
      'gamerank','grank',
      'shop','boutique','store','magasin',
      'bank','banque',
      'help','aide','menu',
      'market','marketview',
      'avatar',
    ]);
    {
      const np_g = require('./utils/neonparty');
      if (
        np_g.isRegistered(sender) &&
        !np_g.isAlive(sender) &&
        command.category === 'economy' &&
        !ALLOWED_DEAD.has(commandName) &&
        !(command.aliases || []).some(a => ALLOWED_DEAD.has(a))
      ) {
        const timeLeft = np_g.formatTime(np_g.timeUntilRevive(sender));
        await sock.sendMessage(from, {
          text:
            `💀 *TU ES MORT !*\n\n` +
            `Tu ne peux rien faire pendant ta mort sauf :\n` +
            `_.balance .gprofile .me .levels .pvprank .shop .bank .inventory_\n\n` +
            `⏳ Revive dans : *${timeLeft}*\n` +
            `_Demande à quelqu'un de taper .revive @toi !_`
        }, { quoted: msg });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────

    // Execute command
    console.log(`Executing command: ${commandName} from ${sender}`);
    if (isGroup) addMessage(from, sender, 'command');
    incrementBotStat('totalCommands');
    
    try {
      await command.execute(sock, msg, args, {
        from,
        sender,
        isGroup,
        groupMetadata,
        isOwner: isOwner(sender),
        isAdmin: await isAdmin(sock, sender, from, groupMetadata),
        isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
        isMod: isMod(sender),
        formatter,
        reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
        react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return sock.sendMessage(from, {
          text: `❌ ${error.message}${command.usage ? `\n\n📖 Usage: ${command.usage}` : ''}`
        }, { quoted: msg });
      }
      throw error; // Rethrow to be caught by the outer catch block
    }
    
  } catch (error) {
    console.error('Error in message handler:', error);
    
    // Don't send error messages for rate limit errors
    if (error.message && error.message.includes('rate-overlimit')) {
      console.warn('⚠️ Rate limit reached. Skipping error message.');
      return;
    }
    
    try {
      await sock.sendMessage(msg.key.remoteJid, { 
        text: `${config.messages.error}\n\n${error.message}` 
      }, { quoted: msg });
    } catch (e) {
      // Don't log rate limit errors when sending error messages
      if (!e.message || !e.message.includes('rate-overlimit')) {
        console.error('Error sending error message:', e);
      }
    }
  }
};

// Group participant update handler
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    
    // Validate group JID before processing
    if (!id || !id.endsWith('@g.us')) {
      return;
    }
    
    const groupSettings = database.getGroupSettings(id);
    
    if (!groupSettings.welcome && !groupSettings.goodbye) return;
    
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return; // Skip if metadata unavailable (forbidden or error)
    
    // Helper to extract participant JID
    const getParticipantJid = (participant) => {
      if (typeof participant === 'string') {
        return participant;
      }
      if (participant && participant.id) {
        return participant.id;
      }
      if (participant && typeof participant === 'object') {
        // Try to find JID in object
        return participant.jid || participant.participant || null;
      }
      return null;
    };
    
    for (const participant of participants) {
      const participantJid = getParticipantJid(participant);
      if (!participantJid) {
        console.warn('Could not extract participant JID:', participant);
        continue;
      }
      
      const participantNumber = participantJid.split('@')[0];
      
      if (action === 'add' && groupSettings.welcome) {
        try {
          // Get user's display name - find participant using phoneNumber or JID
          let displayName = participantNumber;
          
          // Try to find participant in group metadata
          const participantInfo = groupMetadata.participants.find(p => {
            const pId = p.id || p.jid || p.participant;
            const pPhone = p.phoneNumber;
            // Match by JID or phoneNumber
            return pId === participantJid || 
                   pId?.split('@')[0] === participantNumber ||
                   pPhone === participantJid ||
                   pPhone?.split('@')[0] === participantNumber;
          });
          
          // Get phoneNumber JID to fetch contact name
          let phoneJid = null;
          if (participantInfo && participantInfo.phoneNumber) {
            phoneJid = participantInfo.phoneNumber;
          } else {
            // Try to normalize participantJid to phoneNumber format
            // If it's a LID, try to convert to phoneNumber
            try {
              const normalized = normalizeJidWithLid(participantJid);
              if (normalized && normalized.includes('@s.whatsapp.net')) {
                phoneJid = normalized;
              }
            } catch (e) {
              // If normalization fails, try using participantJid directly if it's a valid JID
              if (participantJid.includes('@s.whatsapp.net')) {
                phoneJid = participantJid;
              }
            }
          }
          
          // Try to get contact name from phoneNumber JID
          if (phoneJid) {
            try {
              // Method 1: Try to get from contact store if available
              if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                const contact = sock.store.contacts[phoneJid];
                if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                  displayName = contact.notify.trim();
                } else if (contact.name && contact.name.trim() && !contact.name.match(/^\d+$/)) {
                  displayName = contact.name.trim();
                }
              }
              
              // Method 2: Try to fetch contact using onWhatsApp and then check store
              if (displayName === participantNumber) {
                try {
                  await sock.onWhatsApp(phoneJid);
                  
                  // After onWhatsApp, check store again (might populate after check)
                  if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                    const contact = sock.store.contacts[phoneJid];
                    if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                      displayName = contact.notify.trim();
                    }
                  }
                } catch (fetchError) {
                  // Silently handle fetch errors
                }
              }
            } catch (contactError) {
              // Silently handle contact errors
            }
          }
          
          // Final fallback: use participantInfo.notify or name if available
          if (displayName === participantNumber && participantInfo) {
            if (participantInfo.notify && participantInfo.notify.trim() && !participantInfo.notify.match(/^\d+$/)) {
              displayName = participantInfo.notify.trim();
            } else if (participantInfo.name && participantInfo.name.trim() && !participantInfo.name.match(/^\d+$/)) {
              displayName = participantInfo.name.trim();
            }
          }
          

          // Tentative supplémentaire : sock.contacts (store Baileys)
          if (displayName === participantNumber) {
            try {
              const jidsToCheck = [participantJid, phoneJid].filter(Boolean);
              for (const jid of jidsToCheck) {
                const c = sock.contacts?.[jid] || sock.store?.contacts?.[jid];
                if (c) {
                  const n = c.notify || c.name || c.verifiedName;
                  if (n && n.trim() && !/^\d+$/.test(n.trim())) {
                    displayName = n.trim();
                    break;
                  }
                }
              }
            } catch (_) {}
          }

          // Get user's profile picture URL
          let profilePicUrl = '';
          try {
            profilePicUrl = await sock.profilePictureUrl(participantJid, 'image');
          } catch (ppError) {
            // If profile picture not available, use default avatar
            profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
          }
          
          // Get group name and description
          const groupName = groupMetadata.subject || 'the group';
          const groupDesc = groupMetadata.desc || 'No description';
          
          // ── Date & heure formatées (FR) ──────────────────────────────
          const now = new Date();
          const tzOpts = { timeZone: config.timezone || 'Africa/Douala' };
          const dateString = now.toLocaleDateString('fr-FR', { ...tzOpts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const heureString = now.toLocaleTimeString('fr-FR', { ...tzOpts, hour: '2-digit', minute: '2-digit' });
          const memberCount = groupMetadata.participants.length;

          // ── Message par défaut (nouveau style Nebula) ─────────────────
          const DEFAULT_WELCOME =
            `╭━━━━━━━━━━━━━━━━━━━━━╮\n` +
            `┃   🌌 *NOUVEAU MEMBRE*   ┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `👋 *{name}* vient de rejoindre !\n\n` +
            `🏠 *Groupe :* {group}\n` +
            `👥 *Membres :* {count}\n` +
            `📅 *Le* {date} *à* {heure}\n\n` +
            `_{description}_\n\n` +
            `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.botName}*`;

          // ── Remplacement des variables ────────────────────────────────
          const applyWelcomeVars = (template) => template
            .replace(/\{name\}/g,        displayName)
            .replace(/\{numero\}/g,      participantNumber)
            .replace(/\{group\}/g,       groupName)
            .replace(/\{count\}/g,       memberCount)
            .replace(/\{date\}/g,        dateString)
            .replace(/\{heure\}/g,       heureString)
            .replace(/\{description\}/g, groupDesc || '—')
            // Rétrocompat ancien format
            .replace(/#memberCount/g,    memberCount)
            .replace(/time/g,            heureString)
            .replace(/groupDesc/g,       groupDesc || '—')
            .replace(/@user/g,           `@${participantNumber}`)
            .replace(/@group/g,          groupName);

          const rawTemplate = groupSettings.welcomeMessage || DEFAULT_WELCOME;
          const welcomeMsg  = applyWelcomeVars(rawTemplate);

          // ── Génération de la carte Welcome ────────────────────────────
          let cardBuffer = null;
          try {
            const { generateWelcomeCard } = require('./utils/welcomeCard');
            cardBuffer = await generateWelcomeCard({
              memberName:   displayName,
              memberNumber: participantNumber,
              groupName,
              memberCount,
              ppUrl:        profilePicUrl || null,
              isGoodbye:    false,
            });
          } catch (cardErr) {
            console.warn('[WelcomeCard] Génération échouée:', cardErr.message);
          }

          if (cardBuffer) {
            await sock.sendMessage(id, {
              image:    cardBuffer,
              caption:  welcomeMsg,
              mentions: [participantJid],
            });
          } else {
            // Fallback : texte seul si la carte échoue
            await sock.sendMessage(id, {
              text:     welcomeMsg,
              mentions: [participantJid],
            });
          }
        } catch (welcomeError) {
          console.error('Welcome error:', welcomeError);
          await sock.sendMessage(id, {
            text:     `👋 Bienvenue @${participantNumber} dans *${groupMetadata.subject || 'le groupe'}* ! 🎉`,
            mentions: [participantJid],
          });
        }
      } else if (action === 'remove' && groupSettings.goodbye) {
        try {
          // Get user's display name - find participant using phoneNumber or JID
          let displayName = participantNumber;
          
          // Try to find participant in group metadata (before they left)
          const participantInfo = groupMetadata.participants.find(p => {
            const pId = p.id || p.jid || p.participant;
            const pPhone = p.phoneNumber;
            // Match by JID or phoneNumber
            return pId === participantJid || 
                   pId?.split('@')[0] === participantNumber ||
                   pPhone === participantJid ||
                   pPhone?.split('@')[0] === participantNumber;
          });
          
          // Get phoneNumber JID to fetch contact name
          let phoneJid = null;
          if (participantInfo && participantInfo.phoneNumber) {
            phoneJid = participantInfo.phoneNumber;
          } else {
            // Try to normalize participantJid to phoneNumber format
            try {
              const normalized = normalizeJidWithLid(participantJid);
              if (normalized && normalized.includes('@s.whatsapp.net')) {
                phoneJid = normalized;
              }
            } catch (e) {
              if (participantJid.includes('@s.whatsapp.net')) {
                phoneJid = participantJid;
              }
            }
          }
          
          // Try to get contact name from phoneNumber JID
          if (phoneJid) {
            try {
              // Method 1: Try to get from contact store if available
              if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                const contact = sock.store.contacts[phoneJid];
                if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                  displayName = contact.notify.trim();
                } else if (contact.name && contact.name.trim() && !contact.name.match(/^\d+$/)) {
                  displayName = contact.name.trim();
                }
              }
              
              // Method 2: Try to fetch contact using onWhatsApp and then check store
              if (displayName === participantNumber) {
                try {
                  await sock.onWhatsApp(phoneJid);
                  
                  // After onWhatsApp, check store again
                  if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                    const contact = sock.store.contacts[phoneJid];
                    if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                      displayName = contact.notify.trim();
                    }
                  }
                } catch (fetchError) {
                  // Silently handle fetch errors
                }
              }
            } catch (contactError) {
              // Silently handle contact errors
            }
          }
          
          // Final fallback: use participantInfo.notify or name if available
          if (displayName === participantNumber && participantInfo) {
            if (participantInfo.notify && participantInfo.notify.trim() && !participantInfo.notify.match(/^\d+$/)) {
              displayName = participantInfo.notify.trim();
            } else if (participantInfo.name && participantInfo.name.trim() && !participantInfo.name.match(/^\d+$/)) {
              displayName = participantInfo.name.trim();
            }
          }
          

          // Tentative supplémentaire : sock.contacts (store Baileys)
          if (displayName === participantNumber) {
            try {
              const jidsToCheck = [participantJid, phoneJid].filter(Boolean);
              for (const jid of jidsToCheck) {
                const c = sock.contacts?.[jid] || sock.store?.contacts?.[jid];
                if (c) {
                  const n = c.notify || c.name || c.verifiedName;
                  if (n && n.trim() && !/^\d+$/.test(n.trim())) {
                    displayName = n.trim();
                    break;
                  }
                }
              }
            } catch (_) {}
          }

          // Get user's profile picture URL
          let profilePicUrl = '';
          try {
            profilePicUrl = await sock.profilePictureUrl(participantJid, 'image');
          } catch (ppError) {
            // If profile picture not available, use default avatar
            profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
          }
          
          // Get group name and description
          const groupName = groupMetadata.subject || 'the group';
          const groupDesc = groupMetadata.desc || 'No description';
          
          // ── Date & heure formatées (FR) ──────────────────────────────
          const now = new Date();
          const tzOpts = { timeZone: config.timezone || 'Africa/Douala' };
          const dateString = now.toLocaleDateString('fr-FR', { ...tzOpts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const heureString = now.toLocaleTimeString('fr-FR', { ...tzOpts, hour: '2-digit', minute: '2-digit' });
          const memberCount = groupMetadata.participants.length;

          // ── Message par défaut goodbye (nouveau style Nebula) ─────────
          const DEFAULT_GOODBYE =
            `╭━━━━━━━━━━━━━━━━━━━━━╮\n` +
            `┃     👋 *AU REVOIR...*     ┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `😢 *{name}* a quitté le groupe.\n\n` +
            `🏠 *Groupe :* {group}\n` +
            `👥 *Membres restants :* {count}\n` +
            `🕐 *Le* {date} *à* {heure}\n\n` +
            `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.botName}*`;

          // ── Remplacement des variables ────────────────────────────────
          const applyGoodbyeVars = (template) => template
            .replace(/\{name\}/g,        displayName)
            .replace(/\{numero\}/g,      participantNumber)
            .replace(/\{group\}/g,       groupName)
            .replace(/\{count\}/g,       memberCount)
            .replace(/\{date\}/g,        dateString)
            .replace(/\{heure\}/g,       heureString)
            .replace(/\{description\}/g, groupDesc || '—')
            .replace(/@user/g,           `@${participantNumber}`)
            .replace(/@group/g,          groupName);

          const rawGoodbyeTemplate = groupSettings.goodbyeMessage || DEFAULT_GOODBYE;
          const goodbyeMsg = applyGoodbyeVars(rawGoodbyeTemplate);

          // ── Génération de la carte Goodbye ───────────────────────────
          let cardBuffer = null;
          try {
            const { generateWelcomeCard } = require('./utils/welcomeCard');
            cardBuffer = await generateWelcomeCard({
              memberName:   displayName,
              memberNumber: participantNumber,
              groupName,
              memberCount,
              ppUrl:        profilePicUrl || null,
              isGoodbye:    true,
            });
          } catch (cardErr) {
            console.warn('[GoodbyeCard] Génération échouée:', cardErr.message);
          }

          if (cardBuffer) {
            await sock.sendMessage(id, {
              image:    cardBuffer,
              caption:  goodbyeMsg,
              mentions: [participantJid],
            });
          } else {
            await sock.sendMessage(id, {
              text:     goodbyeMsg,
              mentions: [participantJid],
            });
          }
        } catch (goodbyeError) {
          console.error('Goodbye error:', goodbyeError);
          await sock.sendMessage(id, {
            text:     `👋 *${participantNumber}* a quitté *${groupMetadata.subject || 'le groupe'}*. Au revoir ! 😢`,
            mentions: [participantJid],
          });
        }
      }
    }
  } catch (error) {
    // Silently handle forbidden errors and other group metadata errors
    if (error.message && (
      error.message.includes('forbidden') || 
      error.message.includes('403') ||
      error.statusCode === 403 ||
      error.output?.statusCode === 403 ||
      error.data === 403
    )) {
      // Silently skip forbidden groups
      return;
    }
    // Only log non-forbidden errors
    if (!error.message || !error.message.includes('forbidden')) {
      console.error('Error handling group update:', error);
    }
  }
};

// Antilink handler
const handleAntilink = async (sock, msg, groupMetadata) => {
  try {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    const groupSettings = database.getGroupSettings(from);
    if (!groupSettings.antilink) return;
    
    const body = msg.message?.conversation || 
                  msg.message?.extendedTextMessage?.text || 
                  msg.message?.imageMessage?.caption || 
                  msg.message?.videoMessage?.caption || '';
    
    // Détection de vrais liens uniquement (pas les phrases avec des points)
    // Nécessite soit : http(s)://, www., t.me/, wa.me/, ou domaine connu
    const linkPattern = /(?:https?:\/\/|www\.)[^\s]+|(?:t\.me|wa\.me|chat\.whatsapp\.com|discord\.gg|youtu\.be|bit\.ly|tinyurl\.com)\/[^\s]*/i;

    // Check for any links
    if (linkPattern.test(body)) {
              const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
      const senderIsOwner = isOwner(sender);
      
      if (senderIsAdmin || senderIsOwner) return;
      
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      const action = (groupSettings.antilinkAction || 'delete').toLowerCase();
      
      if (action === 'kick' && botIsAdmin) {
        try {
          await sock.sendMessage(from, { delete: msg.key });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          await sock.sendMessage(from, { 
            text: `🔗 Anti-link triggered. Link removed.`,
            mentions: [sender]
          }, { quoted: msg });
        } catch (e) {
          console.error('Failed to kick for antilink:', e);
        }
      } else {
        // Default: delete message
        try {
          await sock.sendMessage(from, { delete: msg.key });
          await sock.sendMessage(from, { 
            text: `🔗 Anti-link triggered. Link removed.`,
            mentions: [sender]
          }, { quoted: msg });
        } catch (e) {
          console.error('Failed to delete message for antilink:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error in antilink handler:', error);
  }
};


// Anti-group mention handler
const handleAntigroupmention = async (sock, msg, groupMetadata) => {
  try {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    const groupSettings = database.getGroupSettings(from);
    
    // Debug logging to confirm handler is being called
    if (groupSettings.antigroupmention) {
      // Debug log removed
      // Log simplified message info instead of full structure to avoid huge logs
      // Debug log removed
    }
    
    if (!groupSettings.antigroupmention) return;
    
    // Check if this is a forwarded status message that mentions the group
    // Comprehensive detection for various status mention message types
    let isForwardedStatus = false;
    
    if (msg.message) {
      // Direct checks for known status mention message types
      isForwardedStatus = isForwardedStatus || !!msg.message.groupStatusMentionMessage;
      isForwardedStatus = isForwardedStatus || 
        (msg.message.protocolMessage && msg.message.protocolMessage.type === 25); // STATUS_MENTION_MESSAGE
      
      // Check for forwarded newsletter info in various message types
      isForwardedStatus = isForwardedStatus || 
        (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && 
         msg.message.extendedTextMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.conversation && msg.message.contextInfo && 
         msg.message.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.imageMessage && msg.message.imageMessage.contextInfo && 
         msg.message.imageMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.videoMessage && msg.message.videoMessage.contextInfo && 
         msg.message.videoMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.contextInfo && msg.message.contextInfo.forwardedNewsletterMessageInfo);
      
      // Generic check for any forwarded message
      if (msg.message.contextInfo) {
        const ctx = msg.message.contextInfo;
        isForwardedStatus = isForwardedStatus || !!ctx.isForwarded;
        isForwardedStatus = isForwardedStatus || !!ctx.forwardingScore;
        // Additional check for forwarded status specifically
        isForwardedStatus = isForwardedStatus || !!ctx.quotedMessageTimestamp;
      }
      
      // Additional checks for forwarded messages
      if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
        const extCtx = msg.message.extendedTextMessage.contextInfo;
        isForwardedStatus = isForwardedStatus || !!extCtx.isForwarded;
        isForwardedStatus = isForwardedStatus || !!extCtx.forwardingScore;
      }
    }
    
    // Additional debug logging for detection
    if (groupSettings.antigroupmention) {
      // Debug log removed
    }
    
    // Additional debug logging to help identify message structure
    if (groupSettings.antigroupmention) {
      // Debug log removed
      // Debug log removed
      if (msg.message) {
        // Debug log removed
        // Log specific message types that might indicate a forwarded status
        if (msg.message.protocolMessage) {
          // Debug log removed
        }
        if (msg.message.contextInfo) {
          // Debug log removed
        }
        if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
          // Debug log removed
        }
      }
    }
    
    // Debug logging for detection
    if (groupSettings.antigroupmention) {
      // Debug log removed
    }
    
    if (isForwardedStatus) {
      if (groupSettings.antigroupmention) {
        // Process forwarded status message
      }
      
      const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
      const senderIsOwner = isOwner(sender);
      
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      
      // Don't act on admins or owners
      if (senderIsAdmin || senderIsOwner) return;
      
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      const action = (groupSettings.antigroupmentionAction || 'delete').toLowerCase();
      
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      
      if (action === 'kick' && botIsAdmin) {
        try {
          if (groupSettings.antigroupmention) {
            // Delete and kick user
          }
          await sock.sendMessage(from, { delete: msg.key });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          // Silent removal
        } catch (e) {
          console.error('Failed to kick for antigroupmention:', e);
        }
      } else {
        // Default: delete message
        try {
          if (groupSettings.antigroupmention) {
            // Delete message
          }
          await sock.sendMessage(from, { delete: msg.key });
          // Silent deletion
        } catch (e) {
          console.error('Failed to delete message for antigroupmention:', e);
        }
      }
    } else if (groupSettings.antigroupmention) {
      // Debug log removed
    }
  } catch (error) {
    console.error('Error in antigroupmention handler:', error);
  }
};


// Anti-call feature initializer
const initializeAntiCall = (sock) => {
  // Anti-call feature - reject and block incoming calls
  sock.ev.on('call', async (calls) => {
    try {
      // Reload config to get fresh settings
      delete require.cache[require.resolve('./config')];
      const freshConfig = require('./config');
      
      if (!freshConfig.defaultGroupSettings.anticall) return;

      for (const call of calls) {
        if (call.status === 'offer') {
          // Reject the call
          await sock.rejectCall(call.id, call.from);

          // Block the caller
          await sock.updateBlockStatus(call.from, 'block');

          // Notify user
          await sock.sendMessage(call.from, {
            text: '🚫 Calls are not allowed. You have been blocked.'
          });
        }
      }
    } catch (err) {
      console.error('[ANTICALL ERROR]', err);
    }
  });
};


// ── AntiDelete Handler ────────────────────────────────────────────────────────
// Appelé depuis index.js sur messages.update (type: revoke)
const handleAntiDelete = async (sock, update) => {
  try {
    for (const { key, update: msgUpdate } of (update || [])) {
      // Détecter une suppression (message revoked)
      // messageStubType === 1 = REVOKE dans Baileys
      // On skip si c'est pas une suppression OU si c'est le bot lui-même qui a supprimé
      if (msgUpdate?.messageStubType !== 1 || key?.fromMe) continue;

      const groupId = key?.remoteJid;
      if (!groupId?.endsWith('@g.us')) continue;

      const settings = database.getGroupSettings(groupId);
      if (!settings.antidelete) continue;

      // Récupérer le message original depuis le store
      const chatStore = store.messages.get(groupId);
      if (!chatStore) continue;
      const original  = chatStore.get(key.id);
      if (!original || original.key?.fromMe) continue;

      // Récupérer les admins du groupe pour leur envoyer
      const metadata = await getGroupMetadata(sock, groupId);
      if (!metadata) continue;

      const admins = metadata.participants
        .filter(p => p.admin)
        .map(p => p.id);

      if (!admins.length) continue;

      const sender   = key.participant || key.remoteJid;
      const senderNb = sender.split('@')[0];
      const groupName = metadata.subject || groupId;

      // Identifier le contenu supprimé
      const m = original.message || {};
      const text = m.conversation || m.extendedTextMessage?.text || null;
      const image = m.imageMessage || null;
      const video = m.videoMessage || null;
      const audio = m.audioMessage || null;
      const sticker = m.stickerMessage || null;
      const doc   = m.documentMessage || null;

      for (const adminJid of admins) {
        try {
          // Message d'alerte
          await sock.sendMessage(adminJid, {
            text:
              `🗑️ *Message supprimé détecté*

` +
              `👥 *Groupe:* ${groupName}
` +
              `👤 *Par:* @${senderNb}
` +
              (text ? `
💬 *Contenu:*
${text}` : `
📎 *Type:* ${image ? 'Image' : video ? 'Vidéo' : audio ? 'Audio' : sticker ? 'Sticker' : doc ? 'Document' : 'Média inconnu'}`)
          });

          // Retransmettre le média si possible
          if (image?.url || image?.jpegThumbnail) {
            await sock.sendMessage(adminJid, {
              image: image.jpegThumbnail ? Buffer.from(image.jpegThumbnail) : { url: image.url },
              caption: `🗑️ Image supprimée par @${senderNb} dans ${groupName}`
            }).catch(() => {});
          } else if (video?.url) {
            await sock.sendMessage(adminJid, {
              video: { url: video.url },
              caption: `🗑️ Vidéo supprimée par @${senderNb} dans ${groupName}`
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[AntiDelete] Erreur envoi admin:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[AntiDelete] Error:', err.message);
  }
};

// ── AntiViewOnce Handler ──────────────────────────────────────────────────────
// Appelé depuis index.js sur messages.upsert
const handleAntiViewOnce = async (sock, msg) => {
  try {
    const from = msg.key?.remoteJid;
    if (!from?.endsWith('@g.us')) return;

    const settings = database.getGroupSettings(from);
    if (!settings.antiviewonce) return;

    const content = msg.message;
    if (!content) return;

    // Détecter view-once dans les wrappers connus
    const voMsg = content.viewOnceMessage?.message
                || content.viewOnceMessageV2?.message
                || content.viewOnceMessageV2Extension?.message;
    if (!voMsg) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (msg.key.fromMe) return; // Ignorer les messages du bot lui-même

    // Récupérer les admins
    const metadata = await getGroupMetadata(sock, from);
    if (!metadata) return;
    const admins  = metadata.participants.filter(p => p.admin).map(p => p.id);
    if (!admins.length) return;

    const senderNb  = sender.split('@')[0];
    const groupName = metadata.subject || from;
    const image = voMsg.imageMessage;
    const video = voMsg.videoMessage;

    if (!image && !video) return;

    for (const adminJid of admins) {
      try {
        if (image) {
          // Télécharger et retransmettre l'image
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(
            { message: { imageMessage: image }, key: msg.key },
            'buffer',
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
          ).catch(() => null);

          if (buffer) {
            await sock.sendMessage(adminJid, {
              image: buffer,
              caption: `👁️ *AntiViewOnce*

👤 Envoyé par: @${senderNb}
👥 Groupe: ${groupName}`
            });
          }
        } else if (video) {
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(
            { message: { videoMessage: video }, key: msg.key },
            'buffer',
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
          ).catch(() => null);

          if (buffer) {
            await sock.sendMessage(adminJid, {
              video: buffer,
              caption: `👁️ *AntiViewOnce*

👤 Envoyé par: @${senderNb}
👥 Groupe: ${groupName}`
            });
          }
        }
      } catch (e) {
        console.error('[AntiViewOnce] Erreur envoi admin:', e.message);
      }
    }
  } catch (err) {
    console.error('[AntiViewOnce] Error:', err.message);
  }
};

// ── SlowMode Handler ──────────────────────────────────────────────────────────
// Tracker en mémoire: { groupId_userId: lastMessageTimestamp }
const slowModeTracker = new Map();

const handleSlowMode = async (sock, msg) => {
  try {
    const from = msg.key?.remoteJid;
    if (!from?.endsWith('@g.us')) return false;

    const settings = database.getGroupSettings(from);
    const seconds  = settings.slowmode || 0;
    if (seconds <= 0) return false;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return false;

    // Les admins et le bot sont exemptés
    const metadata = await getGroupMetadata(sock, from);
    if (!metadata) return false;

    const participant = metadata.participants.find(p => p.id === sender || p.id?.split('@')[0] === sender.split('@')[0]);
    if (participant?.admin) return false; // admins exemptés

    const key  = `${from}_${sender}`;
    const last = slowModeTracker.get(key) || 0;
    const now  = Date.now();
    const diff = now - last;

    if (diff < seconds * 1000) {
      const remaining = Math.ceil((seconds * 1000 - diff) / 1000);
      // Supprimer le message
      await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
      // Avertir en privé (pas dans le groupe pour éviter le spam)
      await sock.sendMessage(sender, {
        text: `⏱️ *SlowMode actif* dans *${metadata.subject || from}*

Attends encore *${remaining}s* avant d'envoyer un autre message.`
      }).catch(() => {});
      return true; // message bloqué
    }

    slowModeTracker.set(key, now);
    return false;
  } catch (err) {
    console.error('[SlowMode] Error:', err.message);
    return false;
  }
};

module.exports = {
  handleMessage,
  handleGroupUpdate,
  handleAntilink,
  handleAntigroupmention,
  handleAntiDelete,
  handleAntiViewOnce,
  handleSlowMode,
  initializeAntiCall,
  isOwner,
  isAdmin,
  isBotAdmin,
  isMod,
  getGroupMetadata,
  findParticipant,
  commands // Export commands
};
