/**
 * TopXP Command — Classement par niveau/XP
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

module.exports = {
  name: 'topxp',
  aliases: ['toplevel', 'topniveau', 'nivmax'],
  category: 'economy',
  description: 'Classement des joueurs par niveau',
  usage: '.topxp',

  async execute(sock, msg, args, extra) {
    try {
      const top = eco.getLeaderboard(10, 'level');

      if (!top.length) return extra.reply('📊 Aucun utilisateur encore!');

      const medals = ['🥇', '🥈', '🥉'];
      const lines  = top.map((u, i) => {
        const medal = medals[i] || `  ${i + 1}.`;
        const tag   = u.id.split('@')[0];
        const title = eco.getTitle(u.level || 1);
        const streak = u.streak || 0;
        return `${medal} @${tag}\n     ⭐ Niv.${u.level}  ${title}  🔥 Streak: ${streak}j`;
      });

      await sock.sendMessage(extra.from, {
        text:
          `⭐ *TOP 10 — NIVEAUX*\n` +
          `${'─'.repeat(30)}\n\n` +
          lines.join('\n\n') +
          `\n\n_Utilise .richlist pour le classement de coins_`,
        mentions: top.map(u => u.id)
      }, { quoted: msg });

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
