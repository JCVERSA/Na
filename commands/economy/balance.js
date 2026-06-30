/**
 * Balance Command v2 — Profil complet avec carte image
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');
const { generateBalanceCard } = require('../../utils/nebulaCard');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'coins', 'wallet', 'profil'],
  category: 'economy',
  description: 'Voir le profil économique complet',
  usage: '.balance [@user]',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;
      const user      = eco.getUser(targetId);
      
      // Récupérer le nom (pushName si disponible, sinon tag)
      let name = extra.pushName || targetId.split('@')[0];
      if (mentioned[0]) {
        try {
          const contact = sock.contacts[targetId] || sock.store?.contacts?.[targetId];
          name = contact?.notify || contact?.name || targetId.split('@')[0];
        } catch (e) {
          name = targetId.split('@')[0];
        }
      }

      // Rang dans le classement
      const top = eco.getLeaderboard(9999);
      const rank = top.findIndex(u => u.id === targetId) + 1;

      // Streak emoji
      const s = user.streak || 0;
      const streakEmoji = s >= 30 ? '🌟' : s >= 14 ? '💎' : s >= 7 ? '🔥' : s >= 3 ? '⚡' : '✨';

      const title = eco.getTitle(user.level);
      const xpReq = user.level * 100;

      // Générer la carte
      const buffer = await generateBalanceCard(sock, user, targetId, {
        name,
        title,
        rank: rank > 0 ? `#${rank}` : 'N/A',
        xpReq,
        streakEmoji
      });

      await sock.sendMessage(extra.from, { 
        image: buffer, 
        caption: `🌌 *Wallet Profile* — @${targetId.split('@')[0]}`,
        mentions: [targetId] 
      }, { quoted: msg });

    } catch (err) {
      console.error('[BALANCE CARD ERROR]', err);
      await extra.reply(`❌ Erreur lors de la génération de la carte: ${err.message}`);
    }
  }
};
