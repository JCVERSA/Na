/**
 * Remove Command — Retirer un item de son market
 * Nebula Bot by Dark Neon
 * Usage: .remove <itemId>
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');
const mkt = require('../../utils/marketDB');

module.exports = {
  name: 'remove',
  aliases: ['retirer', 'delist', 'annuler'],
  category: 'economy',
  description: 'Retirer un item de ton market (remis dans l\'inventaire)',
  usage: '.remove <itemId>',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender))
        return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");

      if (!mkt.hasMarket(extra.sender))
        return extra.reply(`❌ Tu n'as pas de market ouvert.`);

      if (!args[0])
        return extra.reply(`❌ Usage : *.remove <itemId>*\nEx: *.remove sword*`);

      const itemId   = args[0].toLowerCase();
      const listings = mkt.getSellerListings(extra.sender);
      const listing  = listings.find(l => l.itemId === itemId);

      if (!listing)
        return extra.reply(
          `❌ Aucun item *${itemId}* trouvé dans ton market.\n` +
          `Vérifie avec *.market @toi see*`
        );

      // Remettre l'item dans l'inventaire
      eco.addItem(extra.sender, itemId);
      mkt.removeListing(listing.id);

      return extra.reply(
        `✅ *Item retiré du market !*\n\n` +
        `📦 *${listing.itemName}* remis dans ton inventaire.\n` +
        `_Vérifie avec *.inventory*_`
      );

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
