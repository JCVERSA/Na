/**
 * Inventory Command — Voir son inventaire (Carte visuelle)
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');
const { generateInventoryCard } = require('../../utils/nebulaCard');

module.exports = {
  name: 'inventory',
  aliases: ['inv', 'sac', 'items', 'inventaire'],
  category: 'economy',
  description: 'Voir ton inventaire',
  usage: '.inventory [@user]',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;
      const user      = eco.getUser(targetId);
      
      // Récupérer le nom
      let name = targetId.split('@')[0];
      try {
        const contact = sock.contacts[targetId] || sock.store?.contacts?.[targetId];
        name = contact?.notify || contact?.name || name;
      } catch (e) {}

      // Calculer le rang
      const top = eco.getLeaderboard(9999);
      const rankIdx = top.findIndex(u => u.id === targetId) + 1;
      const rank = rankIdx > 0 ? `#${rankIdx}` : 'N/A';

      const buffer = await generateInventoryCard(sock, user, targetId, {
        name,
        rank,
        level: user.level || 1
      });

      await sock.sendMessage(extra.from, {
        image: buffer,
        caption: `🎒 *COFFRE DE @${targetId.split('@')[0]}*\n\n📌 Utilise *.equip <id>* pour activer un item.`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch (err) {
      console.error('[INVENTORY CARD ERROR]', err);
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
