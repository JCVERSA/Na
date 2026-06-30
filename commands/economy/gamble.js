/**
 * Gamble Command — Pari 50/50 avec gestion du risque
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');

const WIN_MSGS  = ['Tu as de la chance aujourd\'hui 🍀', 'Beau coup !', 'Les dieux du hasard sont avec toi ⚡', 'Instinct parfait !'];
const LOSE_MSGS = ['Malchance... 😢', 'Retente ta chance !', 'La prochaine fois sera la bonne 💪', 'Le destin en a décidé autrement'];

module.exports = {
  name: 'gamble',
  aliases: ['bet', 'pari', 'flip', 'parier'],
  category: 'economy',
  description: 'Pari 50/50 — double ou rien!',
  usage: '.gamble <mise|all|half>',

  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);

      if (!args[0]) {
        return extra.reply(
          `🎲 *GAMBLE — 50/50*\n\n` +
          `Usage : *.gamble <mise>*\n` +
          `  *.gamble all* — mise tout\n` +
          `  *.gamble half* — mise la moitié\n\n` +
          `💰 Ton solde : *${user.coins.toLocaleString()} 🪙*`
        );
      }

      let bet;
      if (args[0] === 'all')  bet = user.coins;
      else if (args[0] === 'half') bet = Math.floor(user.coins / 2);
      else bet = parseInt(args[0]);

      if (!bet || bet <= 0) return extra.reply('❌ Mise invalide!');
      if (bet > 50000) return extra.reply('❌ Mise maximale : *50,000 🪙*');
      if (bet < 10)    return extra.reply('❌ Mise minimale : *10 🪙*');
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins.toLocaleString()} 🪙*`);

      const win     = Math.random() < 0.50;
      const randMsg = win
        ? WIN_MSGS[Math.floor(Math.random() * WIN_MSGS.length)]
        : LOSE_MSGS[Math.floor(Math.random() * LOSE_MSGS.length)];

      if (win) {
        eco.addCoins(extra.sender, bet);
        eco.addXP(extra.sender, 5);
        const after = eco.getUser(extra.sender);
        await extra.reply(
          `🎲 *GAGNÉ !* ✅\n\n` +
          `_${randMsg}_\n\n` +
          `💰 Mise : ${bet.toLocaleString()} 🪙\n` +
          `✅ Gain : *+${bet.toLocaleString()} 🪙*\n` +
          `💵 Solde : *${after.coins.toLocaleString()} 🪙*`
        );
      } else {
        eco.removeCoins(extra.sender, bet);
        const after = eco.getUser(extra.sender);
        await extra.reply(
          `🎲 *PERDU !* ❌\n\n` +
          `_${randMsg}_\n\n` +
          `💰 Mise : ${bet.toLocaleString()} 🪙\n` +
          `❌ Perte : *-${bet.toLocaleString()} 🪙*\n` +
          `💵 Solde : *${after.coins.toLocaleString()} 🪙*`
        );
      }

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
