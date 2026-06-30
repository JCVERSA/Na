/**
 * Drop Command — Jeter des coins ou un item au sol
 * Nebula Bot by Dark Neon
 * 1 minute pour que quelqu'un ramasse, sinon perdu à jamais !
 */
const eco    = require('../../utils/economy');
const np     = require('../../utils/neonparty');
const drops  = require('../../utils/dropSystem');

module.exports = {
  name: 'drop',
  aliases: ['jeter', 'lacher', 'poser'],
  category: 'economy',
  description: 'Jeter des coins ou un item — 1 min pour ramasser !',
  usage: '.drop <montant> | .drop item <id>',

  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) {
        return extra.reply(
          `🎯 *DROP — JETER AU SOL*\n\n` +
          `*Jeter des coins :*\n` +
          `  *.drop <montant>*\n` +
          `  Ex : *.drop 500*\n\n` +
          `*Jeter un item :*\n` +
          `  *.drop item <id>*\n` +
          `  Ex : *.drop item sword*\n\n` +
          `⚠️ _Quelqu'un a 1 minute pour taper .pickup_\n` +
          `⚠️ _Sinon c'est perdu à jamais !_`
        );
      }

      const sub = (args[0] || '').toLowerCase();

      // ── Drop d'un ITEM ────────────────────────────────────────────────────
      if (sub === 'item' || sub === 'items') {
        const itemId = args[1]?.toLowerCase();
        if (!itemId) return extra.reply('❌ Précise l\'id!\nEx: *.drop item sword*');

        const item = eco.SHOP_ITEMS[itemId];
        if (!item) return extra.reply(`❌ Item inconnu : *${itemId}*`);

        const user = eco.getUser(extra.sender);
        const inv  = (user.inventory || []).find(i => {
          if (i.id !== itemId) return false;
          if (i.expiresAt && Date.now() > i.expiresAt) return false;
          if (i.uses !== null && i.uses !== undefined && i.uses <= 0) return false;
          return true;
        });

        if (!inv) return extra.reply(`❌ Tu n'as pas *${item.name}* dans ton inventaire!`);

        // Retirer l'item
        eco.useItem(extra.sender, itemId);

        const drop = drops.createDrop(extra.from, extra.sender, 'item', {
          itemId,
          itemName: item.name,
          itemDesc: item.desc,
          uses:     inv.uses,
          expiresAt: inv.expiresAt,
        });

        const tag = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };

        await sock.sendMessage(extra.from, {
          text:
            `🎯 *ITEM JETÉ AU SOL !*\n\n` +
            `👤 @${tag.wa}${tag.gn ? ` 『 *${tag.gn}* 』` : ''} a jeté :\n` +
            `${item.name}\n` +
            `📝 ${item.desc}\n\n` +
            `⚡ Tape *.pickup ${drop.id}* pour ramasser !\n` +
            `⏳ *1 minute* avant que ça disparaisse...\n\n` +
            `_ID : \`${drop.id}\`_`,
          mentions: [extra.sender]
        }, { quoted: msg });

        // Timer d'expiration — notifier si personne n'a ramassé
        setTimeout(async () => {
          const activeDrops = drops.getActiveDrops(extra.from);
          const stillThere  = activeDrops.find(d => d.id === drop.id);
          if (stillThere) {
            drops.cleanExpiredDrops();
            try {
              await sock.sendMessage(extra.from, {
                text: `💨 *${item.name}* a disparu ! Personne n'a ramassé le drop de @${tag.wa}...`,
                mentions: [extra.sender]
              });
            } catch {}
          }
        }, drops.DROP_TTL);

        return;
      }

      // ── Drop de COINS ─────────────────────────────────────────────────────
      const amount = parseInt(args[0]);
      if (!amount || amount < 1) return extra.reply('❌ Montant invalide!\nEx: *.drop 500*');
      if (amount > 100000) return extra.reply('❌ Maximum *100 000 🪙* par drop !');

      const user = eco.getUser(extra.sender);
      if (user.coins < amount) {
        return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins.toLocaleString()} 🪙*`);
      }

      eco.removeCoins(extra.sender, amount);

      const drop = drops.createDrop(extra.from, extra.sender, 'coins', { amount });
      const tag  = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };

      await sock.sendMessage(extra.from, {
        text:
          `💰 *COINS JETÉS AU SOL !*\n\n` +
          `👤 @${tag.wa}${tag.gn ? ` 『 *${tag.gn}* 』` : ''} a jeté\n` +
          `*${amount.toLocaleString()} 🪙* par terre !\n\n` +
          `⚡ Tape *.pickup ${drop.id}* pour ramasser !\n` +
          `⏳ *1 minute* avant que ça disparaisse...\n\n` +
          `_ID : \`${drop.id}\`_`,
        mentions: [extra.sender]
      }, { quoted: msg });

      // Timer d'expiration
      setTimeout(async () => {
        const activeDrops = drops.getActiveDrops(extra.from);
        const stillThere  = activeDrops.find(d => d.id === drop.id);
        if (stillThere) {
          drops.cleanExpiredDrops();
          try {
            await sock.sendMessage(extra.from, {
              text: `💨 *${amount.toLocaleString()} 🪙* ont disparu ! Personne n'a ramassé le drop de @${tag.wa}...`,
              mentions: [extra.sender]
            });
          } catch {}
        }
      }, drops.DROP_TTL);

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
