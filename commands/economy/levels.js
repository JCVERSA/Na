/**
 * Levels Command — Voir tous les titres et ta progression
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const ALL_TITLES = [
  { min: 1,  max: 2,  title: '🌱 Débutant' },
  { min: 3,  max: 4,  title: '🔥 Apprenti' },
  { min: 5,  max: 9,  title: '🌟 Confirmé' },
  { min: 10, max: 14, title: '⚡ Avancé' },
  { min: 15, max: 19, title: '🥇 Expert' },
  { min: 20, max: 29, title: '🏆 Champion' },
  { min: 30, max: 49, title: '💎 Diamant' },
  { min: 50, max: 999,title: '👑 Légende' },
];

module.exports = {
  name: 'levels',
  aliases: ['niveaux', 'titres', 'progression'],
  category: 'economy',
  description: 'Voir tous les titres et ta progression',
  usage: '.levels',
  async execute(sock, msg, args, extra) {
    try {
      const user  = eco.getUser(extra.sender);
      const lvl   = user.level || 1;
      const xpReq = lvl * 100;

      const lines = ALL_TITLES.map(t => {
        const current = lvl >= t.min && lvl <= t.max;
        const done    = lvl > t.max;
        const prefix  = current ? '▶️' : done ? '✅' : '🔒';
        return `${prefix} *Niv.${t.min}${t.max < 999 ? `-${t.max}` : '+'}* — ${t.title}`;
      });

      await extra.reply(
        `⭐ *TITRES & NIVEAUX*\n` +
        `${'─'.repeat(28)}\n\n` +
        lines.join('\n') +
        `\n\n${'─'.repeat(28)}\n` +
        `👤 Ton niveau : *${lvl}* — ${eco.getTitle(lvl)}\n` +
        `🔥 XP : *${user.xp}/${xpReq}*\n\n` +
        `_Gagne de l'XP avec .daily, .work, .fish, .mine, .hunt..._`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
