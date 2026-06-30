/**
 * CoinFlip Command — Pile ou face contre quelqu'un
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const pending = new Map();

module.exports = {
  name: 'coinflip',
  aliases: ['pileouface', 'cf'],
  category: 'economy',
  description: 'Défier quelqu\'un à pile ou face',
  usage: '.coinflip @user <mise> | .coinflip accept',
  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'accept' || sub === 'oui') {
        const cf = pending.get(extra.sender);
        if (!cf) return extra.reply('❌ Pas de défi en attente!');
        clearTimeout(cf.timeout);
        pending.delete(extra.sender);

        const defender = eco.getUser(extra.sender);
        if (defender.coins < cf.bet) return extra.reply(`❌ T\'as pas assez ! Il te faut *${cf.bet} 🪙*`);

        const heads = Math.random() < 0.5;
        const winner = heads ? cf.challenger : extra.sender;
        const loser  = heads ? extra.sender : cf.challenger;

        eco.removeCoins(loser, cf.bet);
        eco.addCoins(winner, cf.bet);
        eco.addXP(winner, 10);
        const winnerAfter = eco.getUser(winner);

        return await sock.sendMessage(cf.from, {
          text:
            `🪙 *PILE OU FACE — RÉSULTAT !*\n\n` +
            `${heads ? '🟡 PILE' : '⚫ FACE'}\n\n` +
            `🏆 @${winner.split('@')[0]} GAGNE *+${cf.bet} 🪙* !\n` +
            `💔 @${loser.split('@')[0]} perd *-${cf.bet} 🪙*\n` +
            `💰 Solde winner : ${winnerAfter.coins.toLocaleString()} 🪙`,
          mentions: [winner, loser]
        }, { quoted: msg });
      }

      if (!mentioned[0]) return extra.reply('❌ Mentionne quelqu\'un!\n*.coinflip @user 500*\nPuis ils tapent *.coinflip accept*');
      const target = mentioned[0];
      if (target === extra.sender) return extra.reply('😂 Tu veux flipper tout seul ?');

      const bet = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!bet || bet < 50) return extra.reply('❌ Mise minimum *50 🪙*');
      if (bet > 10000) return extra.reply('❌ Mise max *10,000 🪙*');

      const challenger = eco.getUser(extra.sender);
      if (challenger.coins < bet) return extra.reply(`❌ Solde insuffisant! Tu as *${challenger.coins} 🪙*`);
      if (pending.has(target)) return extra.reply('❌ Ce joueur a déjà un défi en attente!');

      const timeout = setTimeout(() => {
        pending.delete(target);
        sock.sendMessage(extra.from, { text: `⏰ @${target.split('@')[0]} n'a pas répondu... trop timide 😂`, mentions: [target] }).catch(() => {});
      }, 60000);

      pending.set(target, { challenger: extra.sender, bet, timeout, from: extra.from });

      await sock.sendMessage(extra.from, {
        text:
          `🪙 *DÉFI PILE OU FACE !*\n\n` +
          `@${extra.sender.split('@')[0]} défie @${target.split('@')[0]}\n` +
          `💰 Mise : *${bet.toLocaleString()} 🪙*\n\n` +
          `@${target.split('@')[0]} tape *.coinflip accept* pour jouer\n_⏳ 60s pour répondre_`,
        mentions: [extra.sender, target]
      }, { quoted: msg });
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
