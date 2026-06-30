/**
 * Bounty Command — Mettre une prime sur quelqu'un
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'bounty',
  aliases: ['prime', 'reward', 'wanted'],
  category: 'economy',
  description: 'Mettre une prime sur quelqu\'un / réclamer une prime',
  usage: '.bounty @user <montant> | .bounty claim @user | .bounty list',
  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'claim' || sub === 'réclamer') {
        if (!mentioned[0]) return extra.reply('❌ Mentionne la cible!\n*.bounty claim @user*');
        const target = mentioned[0];
        if (target === extra.sender) return extra.reply('❌ Tu peux pas réclamer ta propre prime 😭');
        const prize = eco.claimBounty(extra.sender, target);
        if (!prize) return extra.reply(`❌ @${target.split('@')[0]} n'a pas de prime active!`);
        const after = eco.getUser(extra.sender);
        return await sock.sendMessage(extra.from, {
          text:
            `🔫 *PRIME RÉCLAMÉE !*\n\n` +
            `💀 @${target.split('@')[0]} a été éliminé(e) par @${extra.sender.split('@')[0]}\n` +
            `💰 Prime touchée : *+${prize.toLocaleString()} 🪙*\n` +
            `💵 Solde : *${after.coins.toLocaleString()} 🪙*`,
          mentions: [target, extra.sender]
        }, { quoted: msg });
      }

      if (sub === 'list' || sub === 'liste') {
        const { readBounties } = require('../../utils/economy');
        const b = eco.getBounty ? null : null; // just use manually
        const fs   = require('fs');
        const path = require('path');
        const bf   = path.join(__dirname, '../../database/bounties.json');
        const all  = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {};
        const entries = Object.entries(all).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
        if (!entries.length) return extra.reply('🔫 Aucune prime active en ce moment!');
        const lines = entries.map(([id, amt], i) => `${i+1}. @${id.split('@')[0]} — *${amt.toLocaleString()} 🪙*`);
        return await sock.sendMessage(extra.from, {
          text: `🔫 *PRIMES ACTIVES*\n\n${lines.join('\n')}\n\n_Utilise .bounty claim @user pour réclamer_`,
          mentions: entries.map(([id]) => id)
        }, { quoted: msg });
      }

      // Mettre une prime
      if (!mentioned[0]) return extra.reply('❌ Usage:\n*.bounty @user <montant>* — mettre une prime\n*.bounty claim @user* — réclamer\n*.bounty list* — voir les primes');
      const target = mentioned[0];
      if (target === extra.sender) return extra.reply('❌ Tu peux pas mettre une prime sur toi-même!');

      const amount = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount < 100) return extra.reply('❌ Minimum *100 🪙*');

      const total = eco.addBounty(extra.sender, target, amount);
      if (!total) return extra.reply(`❌ Solde insuffisant!`);
      const after = eco.getUser(extra.sender);

      await sock.sendMessage(extra.from, {
        text:
          `🔫 *PRIME MISE !*\n\n` +
          `🎯 Cible : @${target.split('@')[0]}\n` +
          `💰 Prime totale : *${total.toLocaleString()} 🪙*\n` +
          `💵 Ton solde : *${after.coins.toLocaleString()} 🪙*\n\n` +
          `_Qui va réclamer la prime ? 👀_`,
        mentions: [target, extra.sender]
      }, { quoted: msg });
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
