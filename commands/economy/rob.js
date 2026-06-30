/**
 * Rob Command — Voler des coins à un autre utilisateur
 * Nebula Bot by Dark Neon
 * Risqué : si ça échoue, tu perds des coins
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

module.exports = {
  name: 'rob',
  aliases: ['voler', 'steal', 'cambrioler'],
  category: 'economy',
  description: 'Tenter de voler des coins (risqué!)',
  usage: '.rob @user',

  async execute(sock, msg, args, extra) {
    try {
      if (np.isRegistered(extra.sender) && !np.isAlive(extra.sender)) {
        return extra.reply("💀 *Tu es mort !* Impossible de voler quelqu'un. Tu peux uniquement utiliser `.work`, `.kill`, `.dice` et `.invest`.");
      }
      if (!eco.isAvailable(extra.sender, 'rob')) {
        const remaining = eco.timeUntil(extra.sender, 'rob');
        return extra.reply(`🚔 *Tu te caches encore !*\n\nAttends encore : *${eco.formatTime(remaining)}*`);
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply('❌ Mentionne quelqu\'un!\nEx: *.rob @user*');

      const target = mentioned[0];
      if (target === extra.sender) return extra.reply('❌ Tu ne peux pas te voler toi-même 😂');

      const robber = eco.getUser(extra.sender);
      const victim = eco.getUser(target);

      if (robber.coins < 100) return extra.reply('❌ Tu as besoin d\'au moins *100 🪙* pour tenter un rob.');
      if ((victim.coins || 0) < 50) return extra.reply(`❌ @${target.split('@')[0]} est trop pauvre pour être volé! (${victim.coins || 0} 🪙)`);

      // Bouclier actif ?
      if (eco.hasItem(target, 'shield')) {
        eco.useItem(target, 'shield');
        eco.updateUser(extra.sender, { lastRob: Date.now() });
        return await sock.sendMessage(extra.from, {
          text: `🛡️ *ROB BLOQUÉ !*\n\n@${target.split('@')[0]} avait un *Bouclier actif* !\nLe bouclier a été consommé.\n\n_Reessaie dans ${eco.formatTime(eco.COOLDOWNS.rob)}_`,
          mentions: [target, extra.sender]
        }, { quoted: msg });
      }

      // Pistolet = +20% de chances
      const hasGun    = eco.hasItem(extra.sender, 'robbery');
      const baseChance = 45; // 45% de succès de base
      const chance    = hasGun ? Math.min(baseChance + 20, 90) : baseChance;
      const success   = Math.random() * 100 < chance;

      if (hasGun) eco.useItem(extra.sender, 'robbery');
      eco.updateUser(extra.sender, { lastRob: Date.now() });

      if (success) {
        // Voler entre 10% et 35% des coins en poche de la victime
        const pct    = Math.floor(Math.random() * 25) + 10;
        const stolen = Math.max(50, Math.floor((victim.coins * pct) / 100));
        const actual = Math.min(stolen, victim.coins);

        eco.removeCoins(target, actual);
        eco.addCoins(extra.sender, actual);
        eco.addXP(extra.sender, 8);
        // Enregistrer le crime pour plainte
        np.recordCrime(extra.sender, target, 'rob');

        const robberAfter = eco.getUser(extra.sender);

        await sock.sendMessage(extra.from, {
          text:
            `💰 *ROB RÉUSSI !* 🎉\n\n` +
            `🔫 @${extra.sender.split('@')[0]} a volé @${target.split('@')[0]} !\n\n` +
            `💸 Butin : *+${actual.toLocaleString()} 🪙* (${pct}%)\n` +
            `💰 Ton solde : *${robberAfter.coins.toLocaleString()} 🪙*\n\n` +
            `😢 @${target.split('@')[0]} : -${actual.toLocaleString()} 🪙\n` +
            `💡 _Conseil victime : utilise .bank pour te protéger !_`,
          mentions: [extra.sender, target]
        }, { quoted: msg });

      } else {
        // Échec : perdre entre 50 et 200 coins (amende)
        const fine    = Math.floor(Math.random() * 150) + 50;
        const actual  = Math.min(fine, robber.coins);
        eco.removeCoins(extra.sender, actual);

        await sock.sendMessage(extra.from, {
          text:
            `🚔 *ROB RATÉ !*\n\n` +
            `👮 @${extra.sender.split('@')[0]} s'est fait attraper !\n\n` +
            `💸 Amende : *-${actual.toLocaleString()} 🪙*\n` +
            `💰 Ton solde : *${(robber.coins - actual).toLocaleString()} 🪙*\n\n` +
            `_La prochaine fois, achète un .shop 🔫 !_`,
          mentions: [extra.sender, target]
        }, { quoted: msg });
      }

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
