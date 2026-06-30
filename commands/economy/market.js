/**
 * Market Command — Système de vente entre joueurs
 * Nebula Bot by Dark Neon
 *
 * .market open              → ouvrir son market (10 000 🪙)
 * .market @joueur see       → voir les items en vente d'un joueur
 * .market all               → voir tous les listings actifs
 * .market info              → voir son profil market
 * .buy <listingId>          → acheter un item (dans buy.js, géré ici aussi)
 * .remove <itemId>          → retirer un item de la vente
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');
const mkt = require('../../utils/marketDB');

const MARKET_OPEN_COST = 10_000;

module.exports = {
  name: 'market',
  aliases: ['marche', 'marketplace', 'bazar'],
  category: 'economy',
  description: 'Market joueur — acheter/vendre des items entre joueurs',
  usage: '.market open | .market @joueur see | .market all | .market info',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender))
        return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");

      const sub      = (args[0] || '').toLowerCase();
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // ── .market open ──────────────────────────────────────────────────────
      if (sub === 'open' || sub === 'ouvrir') {
        if (mkt.hasMarket(extra.sender))
          return extra.reply(`✅ Ton market est déjà ouvert !\nTape *.put <itemId> <prix>* pour mettre un item en vente.`);

        const user = eco.getUser(extra.sender);
        if ((user.coins || 0) < MARKET_OPEN_COST)
          return extra.reply(
            `❌ *Fonds insuffisants !*\n\n` +
            `Ouvrir un market coûte *${MARKET_OPEN_COST.toLocaleString()} 🪙*\n` +
            `Tu as : *${(user.coins || 0).toLocaleString()} 🪙*\n\n` +
            `_Continue à travailler et économiser !_`
          );

        eco.removeCoins(extra.sender, MARKET_OPEN_COST);
        mkt.openMarket(extra.sender);
        const p    = np.getPlayer(extra.sender);
        const rank = mkt.getMarketRank(1);

        return extra.reply(
          `🏪 *MARKET OUVERT !*\n` +
          `${'═'.repeat(28)}\n\n` +
          `🎉 Bienvenue dans le commerce, *${p.username}* !\n\n` +
          `${rank.emoji} Rang : *${rank.name}* (Niveau 1)\n` +
          `💸 Coût d'ouverture : *-${MARKET_OPEN_COST.toLocaleString()} 🪙*\n\n` +
          `📌 *Comment ça marche :*\n` +
          `• *.put <itemId> <prix>* → mettre un item en vente\n` +
          `• *.market @toi see* → les autres voient tes items\n` +
          `• Chaque *3 ventes* → +2 000 🪙 bonus + montée de niveau !\n\n` +
          `_Commence à vendre : *.put sword 1200*_`
        );
      }

      // ── .market info ──────────────────────────────────────────────────────
      if (sub === 'info' || sub === 'stats') {
        const profile = mkt.getMarketProfile(extra.sender);
        if (!profile.open)
          return extra.reply(`❌ Tu n'as pas encore de market.\nTape *.market open* pour en ouvrir un (10 000 🪙).`);

        const rank     = mkt.getMarketRank(profile.level);
        const nextRank = profile.sales % 3;
        const listings = mkt.getSellerListings(extra.sender);
        const p        = np.getPlayer(extra.sender);

        return extra.reply(
          `🏪 *TON MARKET — ${p.username}*\n` +
          `${'═'.repeat(28)}\n\n` +
          `${rank.emoji} Rang    : *${rank.name}*\n` +
          `📊 Niveau  : *${profile.level}*\n` +
          `🛒 Ventes  : *${profile.totalSales}* total\n` +
          `⚡ Progrès : *${nextRank}/3* (bonus à chaque 3ème vente)\n` +
          `📦 En vente : *${listings.length}* item(s)\n\n` +
          `_Tape *.market @toi see* pour voir tes annonces_`
        );
      }

      // ── .market all ───────────────────────────────────────────────────────
      if (sub === 'all' || sub === 'tous') {
        const all = mkt.getAllListings();
        if (!all.length)
          return extra.reply(`🏪 *MARKET GLOBAL*\n\nAucun item en vente pour l'instant.\n_Ouvre ton market avec *.market open* !_`);

        let text = `🏪 *MARKET GLOBAL — ${all.length} annonce(s)*\n${'═'.repeat(28)}\n\n`;
        let shown = 0;
        for (const l of all.slice(0, 20)) {
          const sellerNp = np.getPlayer(l.sellerId);
          const sellerMk = mkt.getMarketProfile(l.sellerId);
          const rank     = mkt.getMarketRank(sellerMk.level);
          const item     = eco.SHOP_ITEMS[l.itemId];
          const emoji    = item ? (item.weaponId || item.powerId ? '⚔️' : '📦') : '📦';
          text += `${emoji} *${l.itemName}*\n`;
          text += `   💵 *${l.price.toLocaleString()} 🪙*\n`;
          text += `   🏪 ${rank.emoji} ${sellerNp.username || l.sellerId.split('@')[0]}\n`;
          text += `   🆔 \`${l.id}\`\n\n`;
          shown++;
        }
        if (all.length > 20) text += `_...et ${all.length - 20} autres annonces._\n\n`;
        text += `📌 Pour acheter : *.buy <ID>*\n`;
        text += `📌 Pour filtrer un vendeur : *.market @joueur see*`;
        return extra.reply(text);
      }

      // ── .market @joueur see ───────────────────────────────────────────────
      if (mentioned[0] || sub === 'see') {
        const targetId = mentioned[0] || extra.sender;

        if (!np.isRegistered(targetId)) {
          return await sock.sendMessage(extra.from, {
            text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
            mentions: [targetId]
          }, { quoted: msg });
        }
        if (!mkt.hasMarket(targetId)) {
          return await sock.sendMessage(extra.from, {
            text: `🏪 @${targetId.split('@')[0]} n'a pas encore de market !`,
            mentions: [targetId]
          }, { quoted: msg });
        }

        const listings = mkt.getSellerListings(targetId);
        const sellerNp = np.getPlayer(targetId);
        const sellerMk = mkt.getMarketProfile(targetId);
        const rank     = mkt.getMarketRank(sellerMk.level);
        const t        = np.tag(targetId);

        if (!listings.length) {
          return await sock.sendMessage(extra.from, {
            text:
              `🏪 *MARKET DE @${t.wa}* ${rank.emoji}\n\n` +
              `Aucun item en vente pour l'instant.\n` +
              `_Reviens plus tard !_`,
            mentions: [targetId]
          }, { quoted: msg });
        }

        let text = `🏪 *MARKET DE @${t.wa} — ${sellerNp.username}* ${rank.emoji} *${rank.name}* (Niv. ${sellerMk.level})\n`;
        text += `${'═'.repeat(28)}\n\n`;
        for (const l of listings) {
          const shopItem = eco.SHOP_ITEMS[l.itemId];
          const base     = shopItem ? shopItem.price : null;
          const diff     = base ? l.price - base : null;
          const diffStr  = diff !== null ? (diff >= 0 ? ` _(+${diff})_` : ` _(-${Math.abs(diff)})_`) : '';
          text += `📦 *${l.itemName}*\n`;
          text += `   💵 *${l.price.toLocaleString()} 🪙*${diffStr}\n`;
          text += `   🆔 \`${l.id}\`\n\n`;
        }
        text += `📌 Pour acheter : *.buy <ID>*`;

        return await sock.sendMessage(extra.from, {
          text,
          mentions: [targetId]
        }, { quoted: msg });
      }

      // ── Aide ─────────────────────────────────────────────────────────────
      return extra.reply(
        `🏪 *MARKET — AIDE*\n` +
        `${'═'.repeat(28)}\n\n` +
        `*.market open*         → Ouvrir son market (10 000 🪙)\n` +
        `*.market info*         → Voir ton profil market\n` +
        `*.market @joueur see*  → Voir les items en vente\n` +
        `*.market all*          → Tous les items en vente\n` +
        `*.put <itemId> <prix>* → Mettre un item en vente\n` +
        `*.remove <itemId>*     → Retirer un item de la vente\n` +
        `*.buy <ID>*            → Acheter un item\n\n` +
        `💡 Chaque *3 ventes* → *+2 000 🪙* bonus + niveau !`
      );

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
