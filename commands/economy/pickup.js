/**
 * Pickup Command — Ramasser un drop au sol
 * Nebula Bot by Dark Neon
 */
const eco   = require('../../utils/economy');
const np    = require('../../utils/neonparty');
const drops = require('../../utils/dropSystem');

module.exports = {
  name: 'pickup',
  aliases: ['ramasser', 'prendre', 'grab'],
  category: 'economy',
  description: 'Ramasser un item ou des coins jetés au sol',
  usage: '.pickup <id_drop> | .pickup (ramasse le dernier drop)',

  async execute(sock, msg, args, extra) {
    try {
      // Sans argument → voir les drops actifs dans ce groupe
      if (!args[0]) {
        const activeDrops = drops.getActiveDrops(extra.from);
        if (!activeDrops.length) {
          return extra.reply('🌫️ Aucun drop disponible dans ce groupe pour l\'instant !');
        }

        const now   = Date.now();
        const lines = activeDrops.map(d => {
          const left    = Math.max(0, d.expiresAt - now);
          const content = d.type === 'coins'
            ? `💰 *${d.data.amount.toLocaleString()} 🪙*`
            : `${d.data.itemName}`;
          return `• ${content} — ⏳ ${Math.ceil(left/1000)}s\n  *.pickup ${d.id}*`;
        });

        return extra.reply(
          `🎯 *DROPS DISPONIBLES*\n\n` +
          lines.join('\n\n') +
          `\n\n_Tape .pickup <id> pour ramasser !_`
        );
      }

      const dropId = args[0];

      // Si juste "last" ou "dernier" → prendre le dernier drop du groupe
      let actualId = dropId;
      if (dropId === 'last' || dropId === 'dernier') {
        const active = drops.getActiveDrops(extra.from);
        if (!active.length) return extra.reply('🌫️ Aucun drop disponible !');
        actualId = active[active.length - 1].id;
      }

      const result = drops.pickupDrop(actualId, extra.sender);

      if (!result.ok) {
        if (result.reason === 'expired')       return extra.reply('⏰ *Trop tard !* Ce drop a déjà expiré et disparu...');
        if (result.reason === 'already_taken') return extra.reply('❌ Ce drop a déjà été ramassé par quelqu\'un d\'autre !');
        if (result.reason === 'not_found')     return extra.reply('❌ Drop introuvable ! Vérifie l\'ID ou tape *.pickup* pour voir les drops actifs.');
        return extra.reply('❌ Impossible de ramasser ce drop.');
      }

      const drop    = result.drop;
      const pickerTag = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };
      const ownerTag  = np.isRegistered(drop.ownerId)  ? np.tag(drop.ownerId)  : { wa: drop.ownerId.split('@')[0],  gn: '' };

      // Donner l'item/coins au ramasseur
      if (drop.type === 'coins') {
        eco.addCoins(extra.sender, drop.data.amount);
        const after = eco.getUser(extra.sender);

        await sock.sendMessage(extra.from, {
          text:
            `✅ *DROP RAMASSÉ !*\n\n` +
            `👤 @${pickerTag.wa}${pickerTag.gn ? ` 『 *${pickerTag.gn}* 』` : ''}\n` +
            `a ramassé les *${drop.data.amount.toLocaleString()} 🪙* de @${ownerTag.wa} !\n\n` +
            `💰 Son solde : *${after.coins.toLocaleString()} 🪙*`,
          mentions: [extra.sender, drop.ownerId]
        }, { quoted: msg });

      } else {
        // Item → inventaire (ou activation auto si pouvoir NeonParty)
        const item = eco.SHOP_ITEMS[drop.data.itemId];
        if (item?.category === 'power' && item?.powerId && np.isRegistered(extra.sender)) {
          np.addPower(extra.sender, item.powerId, {
            id:       item.powerId,
            name:     item.name,
            usesLeft: drop.data.uses,
            expiresAt: drop.data.expiresAt,
          });
        } else {
          eco.addItem(extra.sender, drop.data.itemId);
        }

        await sock.sendMessage(extra.from, {
          text:
            `✅ *DROP RAMASSÉ !*\n\n` +
            `👤 @${pickerTag.wa}${pickerTag.gn ? ` 『 *${pickerTag.gn}* 』` : ''}\n` +
            `a ramassé *${drop.data.itemName}* de @${ownerTag.wa} !`,
          mentions: [extra.sender, drop.ownerId]
        }, { quoted: msg });
      }

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
