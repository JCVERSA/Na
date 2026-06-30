/**
 * Daily Command v2 — Streak + Bonus progressif
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

module.exports = {
  name: 'daily',
  aliases: ['journalier', 'claim'],
  category: 'economy',
  description: 'Récompense journalière avec streak',
  usage: '.daily',

  async execute(sock, msg, args, extra) {
    try {
      const np  = require('../../utils/neonparty');
      if (np.isRegistered(extra.sender) && !np.isAlive(extra.sender)) {
        return extra.reply('💀 *Tu es mort !* Impossible de réclamer ton daily. Tu peux uniquement utiliser `.work`, `.kill`, `.dice` et `.invest`.');
      }
      if (!eco.isDailyAvailable(extra.sender)) {
        const remaining = eco.timeUntilDaily(extra.sender);
        const user      = eco.getUser(extra.sender);
        return extra.reply(
          `⏳ *Daily déjà réclamé !*\n\n` +
          `🔥 Streak actuel : *${user.streak || 0} jour(s)*\n` +
          `⏰ Reviens dans : *${eco.formatTime(remaining)}*\n\n` +
          `_Ne casse pas ton streak !_ 💪`
        );
      }

      const streak      = eco.updateStreak(extra.sender);
      const base        = Math.floor(Math.random() * 400) + 100; // 100–500
      const streakBonus = eco.getStreakBonus(streak);
      const total       = base + streakBonus;

      const user = eco.addCoins(extra.sender, total);
      const { leveledUp, newLevel } = eco.addXP(extra.sender, 20);

      // Barre de streak
      const streakEmoji = streak >= 30 ? '🌟' : streak >= 14 ? '💎' : streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '✨';

      // Générer la carte de gain
      const { generateGainCard } = require('../../utils/nebulaCard');
      const buffer = await generateGainCard({
        title: 'DAILY REWARD',
        subtitle: `Streak de ${streak} jours`,
        emoji: streakEmoji,
        color: '#7c3aed', // violet
        amount: total,
        xp: 20,
        balance: user.coins
      });

      let caption = `${streakEmoji} *DAILY* — Gains : *+${total} 🪙*`;
      if (leveledUp) caption += `\n🚀 *NIVEAU ${newLevel} !*`;

      await sock.sendMessage(extra.from, { 
        image: buffer, 
        caption: caption + `\n🔥 Ne casse pas ton streak !`
      }, { quoted: msg });
    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
