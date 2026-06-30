/**
 * Put Command — Mettre un item en vente sur son market
 * Nebula Bot by Dark Neon
 * Usage: .put <itemId> <prix>
 */

const eco    = require('../../utils/economy');
const np     = require('../../utils/neonparty');
const mkt    = require('../../utils/marketDB');

module.exports = {
  name: 'put',
  aliases: ['vendre', 'sell', 'mettre'],
  category: 'economy',
  description: 'Mettre un item en vente dans ton market',
  usage: '.put <itemId> <prix>  ex: .put sword 1200',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender))
        return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");

      if (!mkt.hasMarket(extra.sender))
        return extra.reply(
          `🏪 *Tu n'as pas de market !*\n\n` +
          `Pour ouvrir ton market il te faut *10 000 🪙*.\n` +
          `Tape *.market open* pour l'ouvrir.`
        );

      if (!args[0] || !args[1])
        return extra.reply(`❌ Usage : *.put <itemId> <prix>*\nEx: *.put sword 1200*`);

      const itemId = args[0].toLowerCase();
      const price  = parseInt(args[1]);

      if (isNaN(price) || price < 1)
        return extra.reply(`❌ Prix invalide. Ex: *.put sword 1200*`);

      if (price > 10_000_000)
        return extra.reply(`❌ Prix max : *10 000 000 🪙*`);

      // Vérifier que le joueur possède l'item
      if (!eco.hasItem(extra.sender, itemId)) {
        const shopItem = eco.SHOP_ITEMS[itemId];
        if (!shopItem) return extra.reply(`❌ Item *${itemId}* inconnu. Vérifie ton *.inventory*`);
        return extra.reply(`❌ Tu ne possèdes pas *${shopItem.name}* dans ton inventaire !`);
      }

      // Vérifier pas déjà en vente (même item même vendeur)
      const existing = mkt.getSellerListings(extra.sender);
      if (existing.some(l => l.itemId === itemId))
        return extra.reply(`⚠️ Tu as déjà un *${itemId}* en vente dans ton market !\nRetire-le d'abord avec *.remove <itemId>*`);

      const shopItem  = eco.SHOP_ITEMS[itemId];
      const itemName  = shopItem ? shopItem.name : itemId;
      const basePrice = shopItem ? shopItem.price : 0;

      // Retirer l'item de l'inventaire du vendeur
      eco.useItem(extra.sender, itemId);

      // Ajouter au market
      const listingId = mkt.addListing(extra.sender, itemId, itemName, price);
      const p         = np.getPlayer(extra.sender);
      const marketP   = mkt.getMarketProfile(extra.sender);
      const rank      = mkt.getMarketRank(marketP.level);

      let priceNote = '';
      if (basePrice > 0) {
        const diff = price - basePrice;
        priceNote = diff >= 0
          ? ` _(+${diff.toLocaleString()} vs shop)_`
          : ` _(-${Math.abs(diff).toLocaleString()} vs shop)_`;
      }

      await extra.reply(
        `🏪 *ITEM MIS EN VENTE !*\n` +
        `${'═'.repeat(28)}\n\n` +
        `📦 Item    : *${itemName}*\n` +
        `💵 Prix    : *${price.toLocaleString()} 🪙*${priceNote}\n` +
        `🏪 Market  : *${p.username}* ${rank.emoji} ${rank.name}\n` +
        `🆔 ID vente: \`${listingId}\`\n\n` +
        `_Les acheteurs tapent :_\n` +
        `*.market @toi see* → voir tes items\n` +
        `*.buy ${listingId}* → acheter directement\n\n` +
        `_Pour retirer : *.remove ${itemId}*_`
      );

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
