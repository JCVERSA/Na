/**
 * PvpRank Command — Classement des meilleurs tueurs
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

module.exports = {
  name: 'pvprank',
  aliases: ['killrank', 'topkill', 'pvp'],
  category: 'economy',
  description: 'Classement PVP — top tueurs',
  usage: '.pvprank',

  async execute(sock, msg, args, extra) {
    try {
      const top     = np.getPvpLeaderboard(10);
      if (!top.length) return extra.reply("📊 Personne n'a encore combattu!\nTape .kill @joueur pour commencer.");

      const medals = ['🥇', '🥈', '🥉'];
      const lines  = top.map((p, i) => {
        const medal = medals[i] || `  ${i + 1}.`;
        const kdr   = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills;
        return `${medal} *${p.username || p.id.split('@')[0]}*\n     🔪 ${p.kills} kills  💀 ${p.deaths} morts  📊 KDR: ${kdr}`;
      });

      await extra.reply(
        `🏆 *CLASSEMENT PVP — TOP TUEURS*\n` +
        `${'═'.repeat(30)}\n\n` +
        lines.join('\n\n') +
        `\n\n_Inscris-toi avec .startneonparty pour combattre !_`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
