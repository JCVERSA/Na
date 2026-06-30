/**
 * Equip Command v2 — Armes/Armures avec expiration
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

module.exports = {
  name: 'equip',
  aliases: ['equipper', 'porter', 'wear'],
  category: 'economy',
  description: 'Equiper une arme ou armure',
  usage: '.equip <id_item>',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      }

      if (!args[0]) {
        const p = np.getPlayer(extra.sender);
        const w = p.weapon && np.WEAPON_STATS[p.weapon];
        const a = p.armor  && np.ARMOR_STATS[p.armor];
        const now = Date.now();

        const wExp = p.weaponExpiry ? (p.weaponExpiry > now ? `⏳ expire ${eco.formatTimeDate(p.weaponExpiry)}` : '❌ Expirée') : (w?.permanent ? '♾️ Permanent' : '');
        const aExp = p.armorExpiry  ? (p.armorExpiry  > now ? `⏳ expire ${eco.formatTimeDate(p.armorExpiry)}`  : '❌ Expirée') : (a?.permanent ? '♾️ Permanent' : '');

        return extra.reply(
          `🎒 *TON ÉQUIPEMENT*\n\n` +
          `⚔️ Arme   : ${w ? `${w.emoji} *${w.name}*${p.weaponUses != null ? ` (${p.weaponUses} charges)` : ''} ${wExp}` : 'Aucune (mains nues)'}\n` +
          `🛡️ Armure : ${a ? `${a.emoji} *${a.name}* ${aExp}` : 'Aucune'}\n\n` +
          `Pour équiper : *.equip <id>*\nPour déséquiper : *.equip unequip <weapon|armor>*`
        );
      }

      if (args[0].toLowerCase() === 'unequip') {
        const slot = (args[1] || '').toLowerCase();
        if (slot === 'weapon' || slot === 'arme') {
          np.updatePlayer(extra.sender, { weapon: null, weaponExpiry: null, weaponUses: null });
          return extra.reply('✅ Arme déséquipée !');
        }
        if (slot === 'armor' || slot === 'armure') {
          np.updatePlayer(extra.sender, { armor: null, armorExpiry: null });
          return extra.reply('✅ Armure déséquipée !');
        }
        return extra.reply('❌ Précise : *.equip unequip weapon* ou *.equip unequip armor*');
      }

      const itemId = args[0].toLowerCase();
      const item   = eco.SHOP_ITEMS[itemId];
      if (!item) return extra.reply(`❌ Item inconnu : *${itemId}*\nVoir les items : *.shop*`);

      const user = eco.getUser(extra.sender);
      const inv  = (user.inventory || []).find(i => {
        if (i.id !== itemId) return false;
        if (i.expiresAt && Date.now() > i.expiresAt) return false;
        if (i.uses !== null && i.uses !== undefined && i.uses <= 0) return false;
        return true;
      });

      if (!inv) return extra.reply(`❌ Tu n'as pas *${item.name}* !\nAchète-le avec *.buy ${itemId}*`);

      if (item.category === 'weapon' && item.weaponId) {
        const ws      = np.WEAPON_STATS[item.weaponId];
        const expiry  = item.duration ? Date.now() + item.duration : null;
        np.updatePlayer(extra.sender, {
          weapon:      item.weaponId,
          weaponExpiry: expiry,
          weaponUses:  inv.uses !== null ? inv.uses : null,
        });
        const tag = expiry ? `⏳ Expire dans ${np.formatTime(item.duration)}` : '♾️ Permanent (charges restantes)';
        return extra.reply(
          `⚔️ *ARME ÉQUIPÉE !*\n\n` +
          `${ws.emoji} *${ws.name}*\n` +
          `💥 Bonus ATK : *+${ws.atk}*\n` +
          `${tag}` +
          (inv.uses ? `\n🔄 Charges : *${inv.uses}*` : '')
        );
      }

      if (item.category === 'armor' && item.armorId) {
        const as     = np.ARMOR_STATS[item.armorId];
        const expiry = item.duration ? Date.now() + item.duration : null;
        np.updatePlayer(extra.sender, { armor: item.armorId, armorExpiry: expiry });
        const tag = item.permanent ? '♾️ Permanent' : `⏳ Expire dans ${np.formatTime(item.duration)}`;
        return extra.reply(
          `🛡️ *ARMURE ÉQUIPÉE !*\n\n` +
          `${as.emoji} *${as.name}*\n` +
          `🛡️ Réduction dégâts : *-${as.def}*\n` +
          `${tag}`
        );
      }

      if (item.category === 'power' && item.powerId) {
        const expiresAt = item.duration ? Date.now() + item.duration : null;
        // Cas spécial super_heal : heal immédiat + immunité temporaire
        if (item.powerId === 'super_heal') {
          if (!np.isAlive(extra.sender)) return extra.reply("💀 Tu es mort(e)! Impossible d'utiliser ça.");
          const newHp = np.heal(extra.sender, 100);
          eco.useItem(extra.sender, itemId);
          // Ajouter immunité temporaire
          np.addPower(extra.sender, 'super_heal_immunity', { usesLeft: null, expiresAt: Date.now() + 600000 });
          return extra.reply(
            `🧬 *POTION SUPRÊME !*\n\n` +
            `❤️ HP restaurés : *+100* → *${newHp}*\n` +
            `🛡️ Immunité aux dégâts pendant *10 min* !`
          );
        }

        np.addPower(extra.sender, item.powerId, {
          id: item.powerId, name: item.name,
          usesLeft: item.uses || null,
          expiresAt
        });
        eco.useItem(extra.sender, itemId);

        const durTxt = item.uses ? `🔄 ${item.uses} charge(s)` : `⏳ ${np.formatTime(item.duration)}`;
        return extra.reply(
          `✨ *POUVOIR ACTIVÉ !*\n\n` +
          `${item.name}\n` +
          `📝 ${item.desc}\n` +
          `${durTxt}`
        );
      }

      return extra.reply(`❌ Cet item ne peut pas être équipé directement.`);

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
