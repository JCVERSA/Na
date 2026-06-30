/**
 * Richlist + TopXP Command v2
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

module.exports = {
  name: 'richlist',
  aliases: ['richlist', 'classement', 'rich', 'topcoins'],
  category: 'economy',
  description: 'Classement des plus riches',
  usage: '.richlist | .topxp',

  async execute(sock, msg, args, extra) {
    try {
      const by  = 'coins';
      const top = eco.getLeaderboard(10, by);

      if (!top.length) return extra.reply('📊 Aucun utilisateur encore!\nUtilise *.daily* pour commencer.');

      const medals = ['🥇', '🥈', '🥉'];
      const lines  = top.map((u, i) => {
        const medal = medals[i] || `  ${i + 1}.`;
        const tag   = u.id.split('@')[0];
        const title = eco.getTitle(u.level || 1);
        return `${medal} @${tag}\n     💵 ${(u.coins || 0).toLocaleString()} 🪙  •  ${title}`;
      });

      await sock.sendMessage(extra.from, {
        text:
          `🏆 *TOP 10 — PLUS RICHES*\n` +
          `${'─'.repeat(30)}\n\n` +
          lines.join('\n\n') +
          `\n\n_Utilise .topxp pour le classement de niveaux_`,
        mentions: top.map(u => u.id)
      }, { quoted: msg });

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
