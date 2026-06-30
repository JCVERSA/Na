/**
 * Share Command — Partager des coins ou des items
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

module.exports = {
  name: 'share',
  aliases: ['partager', 'offrir', 'envoyer'],
  category: 'economy',
  description: 'Partager des coins ou un item avec quelqu\'un',
  usage: '.share @joueur <montant> | .share @joueur item <id>',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!mentioned[0] || !args[1]) {
        return extra.reply(
          `🎁 *SHARE — PARTAGER*\n\n` +
          `*Partager des coins :*\n` +
          `  *.share @joueur <montant>*\n` +
          `  Ex : *.share @ami 500*\n\n` +
          `*Partager un item :*\n` +
          `  *.share @joueur item <id>*\n` +
          `  Ex : *.share @ami item sword*\n\n` +
          `_Tu peux donner des coins ou des items de ton inventaire !_`
        );
      }

      const targetId = mentioned[0];
      if (targetId === extra.sender) return extra.reply('😂 Tu te partages quelque chose à toi-même ?');

      const sub = args.find(a => a.toLowerCase() === 'item' || a.toLowerCase() === 'items');

      // ── Partager un ITEM ───────────────────────────────────────────────────
      if (sub) {
        const itemId = args[args.indexOf(sub) + 1]?.toLowerCase();
        if (!itemId) return extra.reply('❌ Précise l\'id de l\'item!\nEx: *.share @ami item sword*');

        const item = eco.SHOP_ITEMS[itemId];
        if (!item) return extra.reply(`❌ Item inconnu : *${itemId}*\nVoir les items : *.shop*`);

        const user = eco.getUser(extra.sender);
        const inv  = (user.inventory || []).find(i => {
          if (i.id !== itemId) return false;
          if (i.expiresAt && Date.now() > i.expiresAt) return false;
          if (i.uses !== null && i.uses !== undefined && i.uses <= 0) return false;
          return true;
        });

        if (!inv) {
          return extra.reply(
            `❌ Tu n'as pas *${item.name}* dans ton inventaire !\n` +
            `Achète-en un avec *.buy ${itemId}*`
          );
        }

        // Retirer de l'inventaire du donneur
        eco.useItem(extra.sender, itemId);

        // Si c'est un pouvoir et que la cible est inscrite dans NeonParty → activer auto
        if (item.category === 'power' && item.powerId && np.isRegistered(targetId)) {
          const expiresAt = inv.expiresAt || (item.duration ? Date.now() + item.duration : null);
          np.addPower(targetId, item.powerId, {
            id:       item.powerId,
            name:     item.name,
            usesLeft: inv.uses,
            expiresAt,
          });
        } else {
          // Sinon → inventaire eco de la cible
          eco.addItem(targetId, itemId);
        }

        const senderTag = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };
        const targetTag = np.isRegistered(targetId)     ? np.tag(targetId)     : { wa: targetId.split('@')[0],    gn: '' };

        return await sock.sendMessage(extra.from, {
          text:
            `🎁 *ITEM PARTAGÉ !*\n\n` +
            `📤 De : @${senderTag.wa}${senderTag.gn ? ` 『 *${senderTag.gn}* 』` : ''}\n` +
            `📥 À  : @${targetTag.wa}${targetTag.gn ? ` 『 *${targetTag.gn}* 』` : ''}\n\n` +
            `${item.name}\n` +
            `📝 ${item.desc}\n\n` +
            `_C'est beau le partage !_ 🤝`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

      // ── Partager des COINS ────────────────────────────────────────────────
      const amount = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount <= 0) {
        return extra.reply('❌ Indique un montant valide!\nEx: *.share @ami 500*');
      }
      if (amount > 1000000) return extra.reply('❌ Maximum *1 000 000 🪙* par partage !');
      if (amount < 1)       return extra.reply('❌ Minimum *1 🪙* !');

      const sender = eco.getUser(extra.sender);
      if (sender.coins < amount) {
        return extra.reply(
          `❌ Solde insuffisant !\n\n` +
          `💰 Ton solde : *${sender.coins.toLocaleString()} 🪙*\n` +
          `💸 Demandé   : *${amount.toLocaleString()} 🪙*`
        );
      }

      eco.removeCoins(extra.sender, amount);
      eco.addCoins(targetId, amount);

      const afterSender = eco.getUser(extra.sender);
      const afterTarget = eco.getUser(targetId);
      const senderTag   = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };
      const targetTag   = np.isRegistered(targetId)     ? np.tag(targetId)     : { wa: targetId.split('@')[0],    gn: '' };

      await sock.sendMessage(extra.from, {
        text:
          `💸 *PARTAGE DE COINS !*\n\n` +
          `📤 De : @${senderTag.wa}${senderTag.gn ? ` 『 *${senderTag.gn}* 』` : ''}\n` +
          `📥 À  : @${targetTag.wa}${targetTag.gn ? ` 『 *${targetTag.gn}* 』` : ''}\n\n` +
          `💰 Montant : *${amount.toLocaleString()} 🪙*\n\n` +
          `📊 Nouveaux soldes :\n` +
          `  • @${senderTag.wa} : *${afterSender.coins.toLocaleString()} 🪙*\n` +
          `  • @${targetTag.wa} : *${afterTarget.coins.toLocaleString()} 🪙*`,
        mentions: [extra.sender, targetId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
