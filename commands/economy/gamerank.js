/**
 * GameRank Command — Voir son rang de combat NeonParty
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');

module.exports = {
  name: 'gamerank',
  aliases: ['rang', 'rank', 'monrang', 'grank'],
  category: 'economy',
  description: 'Voir son rang de combat et les 20 niveaux',
  usage: '.gamerank [@joueur]',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;

      if (!np.isRegistered(targetId)) {
        if (targetId === extra.sender) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const p       = np.getPlayer(targetId);
      const gameXp  = p.gameXp || 0;
      const rank    = np.getPlayerRank(gameXp);
      const nextR   = np.getNextPlayerRank(gameXp);
      const tTag    = np.tag(targetId);

      // Barre de progression
      const xpInLevel  = nextR ? gameXp - rank.xpRequired : gameXp;
      const xpNeeded   = nextR ? nextR.xpRequired - rank.xpRequired : 1;
      const pct        = nextR ? Math.round((xpInLevel / xpNeeded) * 10) : 10;
      const bar        = '█'.repeat(pct) + '░'.repeat(10 - pct);

      // Afficher tous les rangs
      const rankList = np.PLAYER_RANKS.map(r => {
        const current = rank.level === r.level;
        const done    = rank.level > r.level;
        const icon    = current ? '▶️' : done ? '✅' : '🔒';
        return `${icon} *Niv.${r.level}* ${r.name} — x${r.dmgMult} DMG`;
      });

      await sock.sendMessage(extra.from, {
        text:
          `⚔️ *RANG DE COMBAT*\n` +
          `${'═'.repeat(30)}\n\n` +
          `👤 @${tTag.wa} 『 *${tTag.gn}* 』\n\n` +
          `🏆 Rang actuel : *${rank.name}*\n` +
          `💥 Multiplicateur : *x${rank.dmgMult}*\n` +
          `⭐ XP combat : *${gameXp.toLocaleString()}*\n` +
          `[${bar}]\n` +
          (nextR
            ? `➡️ Prochain : *${nextR.name}* — encore *${(nextR.xpRequired - gameXp).toLocaleString()} XP*\n`
            : `🌌 *RANG MAXIMUM ATTEINT !*\n`) +
          `\n${'─'.repeat(28)}\n` +
          `*Tous les rangs :*\n\n` +
          rankList.join('\n'),
        mentions: [targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
