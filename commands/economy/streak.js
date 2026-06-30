/**
 * Streak Command — Voir les détails de son streak journalier
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'streak',
  aliases: ['combo', 'serie', 'série'],
  category: 'economy',
  description: 'Voir ton streak journalier et les bonus',
  usage: '.streak [@user]',
  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;
      const user      = eco.getUser(targetId);
      const s         = user.streak || 0;

      const milestones = [
        { days: 2,  bonus: 30,  done: s >= 2 },
        { days: 3,  bonus: 75,  done: s >= 3 },
        { days: 7,  bonus: 150, done: s >= 7 },
        { days: 14, bonus: 300, done: s >= 14 },
        { days: 30, bonus: 500, done: s >= 30 },
      ];

      const next = milestones.find(m => !m.done);
      const emoji = s >= 30 ? '🌟' : s >= 14 ? '💎' : s >= 7 ? '🔥' : s >= 3 ? '⚡' : '✨';

      const lines = milestones.map(m => {
        const icon = m.done ? '✅' : s >= m.days - 1 ? '🔜' : '🔒';
        return `${icon} ${m.days} jours — *+${m.bonus} 🪙* bonus`;
      });

      const nextDaily = user.lastDaily ? eco.timeUntilDaily(targetId) : 0;

      await sock.sendMessage(extra.from, {
        text:
          `${emoji} *STREAK DE @${targetId.split('@')[0]}*\n` +
          `${'─'.repeat(28)}\n\n` +
          `🔥 Streak actuel : *${s} jour(s) consécutif(s)*\n` +
          `💵 Bonus actuel  : *+${eco.getStreakBonus(s)} 🪙/jour*\n` +
          (nextDaily > 0 ? `⏳ Prochain .daily : *${eco.formatTime(nextDaily)}*\n` : `✅ *.daily* disponible maintenant !\n`) +
          `\n*Paliers bonus :*\n` +
          lines.join('\n') +
          (next ? `\n\n_Encore ${next.days - s} jour(s) pour le prochain palier !_` : '\n\n_Tu as atteint tous les paliers ! 👑_'),
        mentions: [targetId]
      }, { quoted: msg });
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
