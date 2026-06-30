/**
 * Duel Command — Défi 1v1 entre deux joueurs
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const pending = new Map(); // targetId -> { challenger, bet, timeout, from }

module.exports = {
  name: 'duel',
  aliases: ['defi', 'challenge', 'vs'],
  category: 'economy',
  description: 'Défier quelqu\'un en duel pour des coins',
  usage: '.duel @user <mise>',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // ── Accepter un duel en attente ────────────────────────────────────
      if (args[0]?.toLowerCase() === 'accept' || args[0]?.toLowerCase() === 'oui') {
        const duel = pending.get(extra.sender);
        if (!duel) return extra.reply('❌ T\'as pas de duel en attente go 😭');

        clearTimeout(duel.timeout);
        pending.delete(extra.sender);

        const challenger = eco.getUser(duel.challenger);
        const defender   = eco.getUser(extra.sender);

        if (challenger.coins < duel.bet) {
          return extra.reply(`❌ @${duel.challenger.split('@')[0]} n'a plus assez de coins pour le duel!`);
        }
        if (defender.coins < duel.bet) {
          return extra.reply(`❌ T'as pas assez de coins ! Il te faut *${duel.bet} 🪙*`);
        }

        // Combat : 3 rounds, HP aléatoires
        const hpA = 100, hpB = 100;
        let healthA = hpA, healthB = hpB;
        const rounds = [];
        for (let i = 0; i < 5; i++) {
          const dmgA = Math.floor(Math.random() * 35) + 10;
          const dmgB = Math.floor(Math.random() * 35) + 10;
          healthB -= dmgA;
          healthA -= dmgB;
          rounds.push(`Round ${i+1}: 🔴 -${dmgA}hp | 🔵 -${dmgB}hp`);
          if (healthA <= 0 || healthB <= 0) break;
        }

        const winner = healthA > healthB ? duel.challenger : extra.sender;
        const loser  = winner === duel.challenger ? extra.sender : duel.challenger;

        eco.removeCoins(loser, duel.bet);
        eco.addCoins(winner, duel.bet);
        eco.addXP(winner, 25);
        const winnerAfter = eco.getUser(winner);

        return await sock.sendMessage(duel.from, {
          text:
            `⚔️ *DUEL — RÉSULTAT*\n` +
            `${'─'.repeat(28)}\n` +
            `🔴 @${duel.challenger.split('@')[0]} vs 🔵 @${extra.sender.split('@')[0]}\n\n` +
            rounds.join('\n') + '\n\n' +
            `🏆 *WINNER : @${winner.split('@')[0]}* (+${duel.bet} 🪙)\n` +
            `💔 Loser : @${loser.split('@')[0]} (-${duel.bet} 🪙)\n` +
            `💰 Solde winner : ${winnerAfter.coins.toLocaleString()} 🪙`,
          mentions: [duel.challenger, extra.sender]
        }, { quoted: msg });
      }

      // ── Refuser ────────────────────────────────────────────────────────
      if (args[0]?.toLowerCase() === 'refuse' || args[0]?.toLowerCase() === 'non') {
        const duel = pending.get(extra.sender);
        if (!duel) return extra.reply('❌ T\'as pas de duel en attente');
        clearTimeout(duel.timeout);
        pending.delete(extra.sender);
        return await sock.sendMessage(duel.from, {
          text: `💨 @${extra.sender.split('@')[0]} a refusé le duel de @${duel.challenger.split('@')[0]}... lâcheur 😂`,
          mentions: [extra.sender, duel.challenger]
        }, { quoted: msg });
      }

      // ── Lancer un duel ─────────────────────────────────────────────────
      if (!mentioned[0]) return extra.reply('❌ Mentionne quelqu\'un!\nEx: *.duel @user 500*');
      const target = mentioned[0];
      if (target === extra.sender) return extra.reply('😂 Tu veux te battre toi-même go ?');

      const bet = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!bet || bet < 50) return extra.reply('❌ Mise minimum : *50 🪙*');
      if (bet > 10000) return extra.reply('❌ Mise maximum : *10,000 🪙*');

      const challenger = eco.getUser(extra.sender);
      if (challenger.coins < bet) return extra.reply(`❌ Solde insuffisant! Tu as *${challenger.coins} 🪙*`);

      if (pending.has(target)) return extra.reply('❌ Ce joueur a déjà un duel en attente!');

      const timeout = setTimeout(() => {
        pending.delete(target);
        sock.sendMessage(extra.from, {
          text: `⏰ @${target.split('@')[0]} n'a pas accepté le duel. Trop peureux ? 😭`,
          mentions: [target]
        }).catch(() => {});
      }, 60000);

      pending.set(target, { challenger: extra.sender, bet, timeout, from: extra.from });

      await sock.sendMessage(extra.from, {
        text:
          `⚔️ *DÉFI DE DUEL !*\n\n` +
          `🔴 @${extra.sender.split('@')[0]} défie @${target.split('@')[0]}\n` +
          `💰 Mise : *${bet.toLocaleString()} 🪙*\n\n` +
          `@${target.split('@')[0]} tape *.duel accept* pour accepter\n` +
          `ou *.duel refuse* pour refuser\n\n_⏳ 60 secondes pour répondre_`,
        mentions: [extra.sender, target]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
