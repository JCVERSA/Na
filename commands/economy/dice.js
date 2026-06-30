/**
 * Dice Command — Pari sur lancer de dés
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'dice',
  aliases: ['des', 'dés', 'roll'],
  category: 'economy',
  description: 'Parier sur un lancer de dé 🎲',
  usage: '.dice <high|low|exact:N> <mise>',
  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) return extra.reply(
        `🎲 *LANCER DE DÉS*\n\n` +
        `Usage :\n` +
        `*.dice high <mise>* — parier que le dé > 3 (x1.8)\n` +
        `*.dice low <mise>* — parier que le dé ≤ 3 (x1.8)\n` +
        `*.dice exact:4 <mise>* — deviner le nombre exact (x5)\n\n` +
        `Ex : *.dice high 100*`
      );

      const choice = args[0].toLowerCase();
      const bet    = parseInt(args[1]);
      if (!bet || bet < 10) return extra.reply('❌ Mise minimum *10 🪙*');
      if (bet > 10000) return extra.reply('❌ Mise max *10,000 🪙*');

      const user = eco.getUser(extra.sender);
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins} 🪙*`);

      if (!eco.isAvailable(extra.sender, 'dice')) {
        return extra.reply(`🎲 Cooldown ! Attends : *${eco.formatTime(eco.timeUntil(extra.sender, 'dice'))}*`);
      }
      eco.updateUser(extra.sender, { lastDice: Date.now() });

      const roll = Math.floor(Math.random() * 6) + 1;
      const dice = ['⚀','⚁','⚂','⚃','⚄','⚅'];
      const face = dice[roll - 1];

      let win = false, mult = 1;
      if (choice === 'high') { win = roll > 3; mult = 1.8; }
      else if (choice === 'low') { win = roll <= 3; mult = 1.8; }
      else if (choice.startsWith('exact:')) {
        const n = parseInt(choice.split(':')[1]);
        if (n < 1 || n > 6) return extra.reply('❌ Nombre entre 1 et 6!');
        win = roll === n; mult = 5;
      } else {
        return extra.reply('❌ Choix invalide! Utilise: *high*, *low* ou *exact:N*');
      }

      if (win) {
        const gain = Math.floor(bet * mult);
        eco.addCoins(extra.sender, gain);
        eco.addXP(extra.sender, 8);
        const after = eco.getUser(extra.sender);
        await extra.reply(`🎲 *${face} — ${roll}*\n\n✅ *GAGNÉ !* (x${mult})\n💰 +*${gain} 🪙*\n💵 Solde : *${after.coins.toLocaleString()} 🪙*`);
      } else {
        eco.removeCoins(extra.sender, bet);
        const after = eco.getUser(extra.sender);
        await extra.reply(`🎲 *${face} — ${roll}*\n\n❌ *PERDU !*\n💸 -*${bet} 🪙*\n💵 Solde : *${after.coins.toLocaleString()} 🪙*`);
      }
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
