/**
 * Buy Command v2 — Auto-activate powers after purchase (Option D)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const { generateBuyCard } = require('../../utils/nebulaCard');

module.exports = {
  name: 'buy',
  aliases: ['acheter', 'purchase'],
  category: 'economy',
  description: 'Acheter un item de la boutique',
  usage: '.buy <id_item>',

  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) return extra.reply('❌ Indique un item!\nEx: *.buy shield*\nVoir la boutique : *.shop*\nVoir le market : *.market all*');

      const itemId = args[0].toLowerCase();

      // ── Détection achat market (ID commence par mkt_) ────────────────────
      if (itemId.startsWith('mkt_')) {
        const mkt     = require('../../utils/marketDB');
        const np      = require('../../utils/neonparty');
        const listing = mkt.getListing(itemId);

        if (!listing) return extra.reply(`❌ Annonce introuvable ou déjà vendue.\nID : \`${itemId}\``);
        if (listing.sellerId === extra.sender) return extra.reply(`😂 Tu peux pas acheter ton propre item !`);

        const buyer = eco.getUser(extra.sender);
        if ((buyer.coins || 0) < listing.price) {
          return extra.reply(
            `❌ *Fonds insuffisants !*\n\n` +
            `💵 Ton solde : *${buyer.coins.toLocaleString()} 🪙*\n` +
            `🏷️ Prix : *${listing.price.toLocaleString()} 🪙*\n` +
            `📉 Il te manque : *${(listing.price - buyer.coins).toLocaleString()} 🪙*`
          );
        }

        // Transaction
        eco.removeCoins(extra.sender, listing.price);
        eco.addCoins(listing.sellerId, listing.price);
        eco.addItem(extra.sender, listing.itemId);
        mkt.removeListing(itemId);

        // Enregistrer la vente → bonus si multiple de 3
        const saleResult = mkt.recordSale(listing.sellerId);
        const buyerAfter = eco.getUser(extra.sender);

        // Notifier le vendeur
        try {
          let notif =
            `💰 *VENTE MARKET !*\n\n` +
            `🛒 @${extra.sender.split('@')[0]} a acheté ton *${listing.itemName}*\n` +
            `💵 *+${listing.price.toLocaleString()} 🪙* reçus !`;
          if (saleResult.bonus) {
            eco.addCoins(listing.sellerId, 2000);
            notif +=
              `\n\n🎉 *BONUS 3ÈME VENTE !*\n` +
              `+*2 000 🪙* bonus !\n` +
              `📊 Nouveau niveau market : *${saleResult.newLevel}*\n` +
              `${saleResult.rank.emoji} Rang : *${saleResult.rank.name}*`;
          }
          await sock.sendMessage(extra.from, {
            text: notif,
            mentions: [extra.sender, listing.sellerId]
          });
        } catch {}

        const itemBase = eco.SHOP_ITEMS[listing.itemId] || { name: listing.itemName, price: listing.price, id: listing.itemId };
        const buffer = await generateBuyCard(itemBase, buyerAfter.coins, listing.itemId);

        return await sock.sendMessage(extra.from, {
          image: buffer,
          caption: `✅ *ACHAT MARKET RÉUSSI !*\n📦 *${listing.itemName}* acheté à @${listing.sellerId.split('@')[0]}`,
          mentions: [listing.sellerId]
        }, { quoted: msg });
      }

      const item = eco.SHOP_ITEMS[itemId];

      if (!item) {
        const ids = Object.keys(eco.SHOP_ITEMS).join(', ');
        return extra.reply(`❌ Item introuvable!\n\nItems disponibles : *${ids}*\nVoir détails : *.shop*`);
      }

      const user = eco.getUser(extra.sender);
      if (user.coins < item.price) {
        return extra.reply(
          `❌ Solde insuffisant !\n\n` +
          `💵 Ton solde : *${user.coins.toLocaleString()} 🪙*\n` +
          `🏷️ Prix : *${item.price.toLocaleString()} 🪙*\n` +
          `📉 Il te manque : *${(item.price - user.coins).toLocaleString()} 🪙*`
        );
      }

      eco.removeCoins(extra.sender, item.price);
      const after = eco.getUser(extra.sender);

      // ── Pouvoirs NeonParty → activation automatique ───────────────────────
      if (item.category === 'power' && item.powerId) {
        const np = require('../../utils/neonparty');

        // Cas spécial super_heal : soins immédiats + immunité
        if (item.powerId === 'super_heal') {
          if (np.isRegistered(extra.sender) && np.isAlive(extra.sender)) {
            const p = np.getPlayer(extra.sender);
            np.heal(extra.sender, 100);
            np.addPower(extra.sender, 'super_heal_immunity', {
              usesLeft: null,
              expiresAt: Date.now() + 600000
            });
            const buffer = await generateBuyCard(item, after.coins, itemId);
            return await sock.sendMessage(extra.from, {
              image: buffer,
              caption: `✅ *ACHAT + ACTIVATION !*\n🧬 *${item.name}* utilisée instantanément !`
            }, { quoted: msg });
          }
        }

        // Cas spécial healing : soins immédiats si en vie et HP pas max
        if (item.powerId === 'healing') {
          if (np.isRegistered(extra.sender) && np.isAlive(extra.sender)) {
            const p = np.getPlayer(extra.sender);
            if (p.hp < p.maxHp) {
              np.heal(extra.sender, 50);
              const buffer = await generateBuyCard(item, after.coins, itemId);
              return await sock.sendMessage(extra.from, {
                image: buffer,
                caption: `✅ *ACHAT + SOIN IMMÉDIAT !*\n💊 *${item.name}* utilisée !`
              }, { quoted: msg });
            }
          }
        }

        // Tous les autres pouvoirs → activation automatique dans NeonParty
        const expiresAt = item.duration ? Date.now() + item.duration : null;
        if (np.isRegistered(extra.sender)) {
          np.addPower(extra.sender, item.powerId, {
            id:       item.powerId,
            name:     item.name,
            usesLeft: item.uses || null,
            expiresAt,
          });

          const buffer = await generateBuyCard(item, after.coins, itemId);
          return await sock.sendMessage(extra.from, {
            image: buffer,
            caption: `✅ *ACHAT + ACTIVATION AUTOMATIQUE !*\n✨ *${item.name}* activé !`
          }, { quoted: msg });
        }
      }

      // ── Armes, armures, items éco → inventaire classique ─────────────────
      eco.addItem(extra.sender, itemId);
      const buffer = await generateBuyCard(item, after.coins, itemId);
      
      let caption = `✅ *ACHAT EFFECTUÉ !*\n📦 *${item.name}* ajouté à ton inventaire.`;
      if (item.category === 'weapon') caption += `\n📌 Tape *.equip ${itemId}* pour l'équiper !`;
      if (item.category === 'armor')  caption += `\n📌 Tape *.equip ${itemId}* pour la porter !`;

      await sock.sendMessage(extra.from, {
        image: buffer,
        caption: caption
      }, { quoted: msg });

    } catch (err) {
      console.error('[BUY CARD ERROR]', err);
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
