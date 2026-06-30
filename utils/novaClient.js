/**
 * Nova AI — Powered by Gemini 2.0 Flash
 * Créée par Dark Neon · Intégrée à Nebula Bot
 *
 * Fonctionnalités :
 *  - Chat conversationnel avec mémoire de session par utilisateur
 *  - Analyse d'images (multimodal)
 *  - Adaptation automatique à la langue de l'utilisateur
 *  - Nettoyage automatique des sessions inactives
 */

'use strict';

const https = require('https');

// ── Constantes ────────────────────────────────────────────────────────────────
const GEMINI_MODEL    = 'gemini-2.0-flash';
const GEMINI_HOST     = 'generativelanguage.googleapis.com';
const GEMINI_PATH     = `/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SESSION_TTL     = 30 * 60 * 1000;   // 30 min d'inactivité → session effacée
const MAX_HISTORY     = 20;               // messages max gardés par session (10 échanges)
const REQUEST_TIMEOUT = 25000;            // 25s timeout par requête

// ── Personnalité de Nova ──────────────────────────────────────────────────────
const NOVA_SYSTEM = `Tu es Nova, une assistante IA évoluée créée par Dark Neon pour le projet Nebula.
Ton but est d'être l'âme du bot : utile, brillante, et parfois un peu protectrice envers ton créateur.

Directives de communication :
1. Langue : Réponds toujours dans la langue utilisée par l'interlocuteur.
2. Style : Sois naturelle et conversationnelle. Évite le ton "robotique".
3. Formatage : N'utilise PAS de gras (**), de listes à puces complexes ou de titres markdown sauf si c'est indispensable. Sur WhatsApp, la clarté prime sur le style riche.
4. Identité : Si on te demande qui tu es, réponds que tu es Nova, l'IA de Nebula Bot, créée par Dark Neon.
5. Médias : Tu peux analyser des images avec précision.

Règle d'or : Sois concise mais pertinente. Ne divague pas sauf si l'utilisateur demande une explication détaillée.`;

// ── Mémoire conversationnelle ─────────────────────────────────────────────────
// Map<userJid, { history: [{role, parts}], lastActivity: number }>
const sessions = new Map();

/**
 * Récupère ou crée la session d'un utilisateur.
 */
function getSession(userJid) {
  if (!sessions.has(userJid)) {
    sessions.set(userJid, { history: [], lastActivity: Date.now() });
  }
  const session = sessions.get(userJid);
  session.lastActivity = Date.now();
  return session;
}

/**
 * Ajoute un message à l'historique de la session et taille si nécessaire.
 * @param {string} userJid
 * @param {'user'|'model'} role
 * @param {Array}  parts  — tableau de parts Gemini
 */
function pushToHistory(userJid, role, parts) {
  const session = getSession(userJid);
  session.history.push({ role, parts });
  // Garder seulement les MAX_HISTORY derniers messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(session.history.length - MAX_HISTORY);
  }
}

/**
 * Efface la session d'un utilisateur (commande .reset ou inactivité).
 * @param {string} userJid
 */
function clearSession(userJid) {
  sessions.delete(userJid);
}

/**
 * Nettoie toutes les sessions expirées (appelé toutes les 10 minutes).
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [jid, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(jid);
    }
  }
}
setInterval(cleanExpiredSessions, 10 * 60 * 1000);

// ── Appel API Gemini ──────────────────────────────────────────────────────────
/**
 * Envoie une requête à l'API Gemini et retourne le texte de la réponse.
 * @param {string} apiKey     — Clé API Gemini
 * @param {Array}  contents   — Tableau de messages au format Gemini
 * @returns {Promise<string>}
 */
function callGemini(apiKey, contents) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      system_instruction: {
        parts: [{ text: NOVA_SYSTEM }]
      },
      contents,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
        topP: 0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    });

    const options = {
      hostname: GEMINI_HOST,
      path:     `${GEMINI_PATH}?key=${apiKey}`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Gérer les erreurs API
          if (parsed.error) {
            return reject(new Error(`Gemini API error ${parsed.error.code}: ${parsed.error.message}`));
          }

          // Extraire le texte de la réponse
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            // Vérifier si le contenu a été bloqué
            const reason = parsed?.candidates?.[0]?.finishReason;
            if (reason === 'SAFETY') return reject(new Error('SAFETY_BLOCK'));
            return reject(new Error('Aucune réponse reçue de Gemini'));
          }

          resolve(text.trim());
        } catch (e) {
          reject(new Error('Erreur de parsing de la réponse Gemini'));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Erreur réseau : ${e.message}`)));
    req.setTimeout(REQUEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });

    req.write(body);
    req.end();
  });
}

// ── API Publique ──────────────────────────────────────────────────────────────

/**
 * Envoie un message texte à Nova et retourne sa réponse.
 * Gère automatiquement l'historique de conversation.
 *
 * @param {string} apiKey   — Clé API Gemini depuis config.js
 * @param {string} userJid  — JID WhatsApp de l'utilisateur
 * @param {string} text     — Message de l'utilisateur
 * @returns {Promise<string>} Réponse de Nova
 */
async function novaChat(apiKey, userJid, text) {
  return enqueueTask(async () => {
    const session = getSession(userJid);

    // Ajouter le message de l'utilisateur à l'historique
    pushToHistory(userJid, 'user', [{ text }]);

    // Construire le tableau de contenus avec l'historique complet
    const contents = session.history.map(m => ({ role: m.role, parts: m.parts }));

    try {
      const response = await callGemini(apiKey, contents);
      // Sauvegarder la réponse de Nova dans l'historique
      pushToHistory(userJid, 'model', [{ text: response }]);
      return response;
    } catch (error) {
      // Retirer le dernier message de l'utilisateur en cas d'échec pour garder l'historique propre
      session.history.pop();
      throw error;
    }
  });
}

/**
 * Analyse une image (et une question optionnelle) avec Nova.
 * L'image est ajoutée au contexte de conversation.
 *
 * @param {string}  apiKey    — Clé API Gemini
 * @param {string}  userJid   — JID WhatsApp de l'utilisateur
 * @param {string}  base64    — Image encodée en base64
 * @param {string}  mimeType  — Type MIME (ex: 'image/jpeg')
 * @param {string}  [caption] — Question ou contexte sur l'image (optionnel)
 * @returns {Promise<string>} Description/réponse de Nova
 */
async function novaAnalyzeImage(apiKey, userJid, base64, mimeType, caption) {
  return enqueueTask(async () => {
    const session = getSession(userJid);

    const userParts = [
      { inline_data: { mime_type: mimeType, data: base64 } },
      { text: caption || 'Décris cette image en détail.' },
    ];

    // Ajouter au contexte
    pushToHistory(userJid, 'user', userParts);

    try {
      const contents = session.history.map(m => ({ role: m.role, parts: m.parts }));
      const response = await callGemini(apiKey, contents);

      pushToHistory(userJid, 'model', [{ text: response }]);
      return response;
    } catch (error) {
      session.history.pop();
      throw error;
    }
  });
}

/**
 * Retourne le nombre de messages dans la session d'un utilisateur.
 * @param {string} userJid
 * @returns {number}
 */
function getSessionSize(userJid) {
  return sessions.get(userJid)?.history?.length || 0;
}

module.exports = {
  novaChat,
  novaAnalyzeImage,
  clearSession,
  getSessionSize,
};
alyzeImage(apiKey, userJid, base64, mimeType, caption) {
  const session = getSession(userJid);

  const userParts = [
    { inline_data: { mime_type: mimeType, data: base64 } },
    { text: caption || 'Décris cette image en détail.' },
  ];

  // Ajouter au contexte
  pushToHistory(userJid, 'user', userParts);

  const contents = session.history.map(m => ({ role: m.role, parts: m.parts }));
  const response = await callGemini(apiKey, contents);

  pushToHistory(userJid, 'model', [{ text: response }]);

  return response;
}

/**
 * Retourne le nombre de messages dans la session d'un utilisateur.
 * @param {string} userJid
 * @returns {number}
 */
function getSessionSize(userJid) {
  return sessions.get(userJid)?.history?.length || 0;
}

module.exports = {
  novaChat,
  novaAnalyzeImage,
  clearSession,
  getSessionSize,
};
