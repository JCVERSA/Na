/**
 * Gift Command — Offrir un item de ton inventaire
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'gift',
  aliases: ['cadeau'],
  category: 'economy',
  description: 'Offrir un item de ton inventaire à quelqu\'un',
  usage: '.gift @user <id_item>',
  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply('❌ Mentionne quelqu\'un!\nEx: *.gift @user shield*');

      const target = mentioned[0];
      if (target === extra.sender) return extra.reply('😂 Tu t\'offres un cadeau à toi-même ?');

      const itemId = args.find(a => !a.startsWith('@') && eco.SHOP_ITEMS[a.toLowerCase()]);
      if (!itemId) {
        const ids = Object.keys(eco.SHOP_ITEMS).join(', ');
        return extra.reply(`❌ Indique un item valide!\nItems: *${ids}*\nEx: *.gift @user shield*`);
      }

      const user = eco.getUser(extra.sender);
      const inv  = (user.inventory || []).find(i => {
        if (i.id !== itemId) return false;
        if (i.expiresAt && Date.now() > i.expiresAt) return false;
        if (i.uses !== null && i.uses <= 0) return false;
        return true;
      });

      if (!inv) return extra.reply(`❌ Tu n\'as pas de *${eco.SHOP_ITEMS[itemId].name}* dans ton inventaire!\nAchète-en un avec *.buy ${itemId}*`);

      // Retirer de l'inventaire du sender
      eco.useItem(extra.sender, itemId);
      // Ajouter à l'inventaire du target
      eco.addItem(target, itemId);

      await sock.sendMessage(extra.from, {
        text:
          `🎁 *CADEAU OFFERT !*\n\n` +
          `De : @${extra.sender.split('@')[0]}\n` +
          `À : @${target.split('@')[0]}\n` +
          `Cadeau : *${eco.SHOP_ITEMS[itemId].name}*\n\n` +
          `_C'est beau l'amitié 🥹_`,
        mentions: [extra.sender, target]
      }, { quoted: msg });
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
