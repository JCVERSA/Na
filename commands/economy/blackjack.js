/**
 * Blackjack Command — Jeu de 21 contre le bot
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const CARDS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS  = ['♠','♥','♦','♣'];

function drawCard() {
  return { v: CARDS[Math.floor(Math.random() * CARDS.length)], s: SUITS[Math.floor(Math.random() * SUITS.length)] };
}
function cardValue(card) {
  if (['J','Q','K'].includes(card.v)) return 10;
  if (card.v === 'A') return 11;
  return parseInt(card.v);
}
function handValue(hand) {
  let total = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces  = hand.filter(c => c.v === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function displayHand(hand) { return hand.map(c => `${c.v}${c.s}`).join(' '); }

// Sessions actives : Map<sender, { playerHand, dealerHand, bet, from }>
const sessions = new Map();

module.exports = {
  name: 'blackjack',
  aliases: ['bj', '21', 'vingtun'],
  category: 'economy',
  description: 'Jouer au blackjack contre le bot',
  usage: '.blackjack <mise> | .bj hit | .bj stand',
  async execute(sock, msg, args, extra) {
    try {
      const sub = (args[0] || '').toLowerCase();

      // ── Actions en cours ───────────────────────────────────────────────
      if (sessions.has(extra.sender)) {
        const s = sessions.get(extra.sender);

        if (sub === 'hit' || sub === 'tirer' || sub === 'carte') {
          s.playerHand.push(drawCard());
          const total = handValue(s.playerHand);

          if (total > 21) {
            sessions.delete(extra.sender);
            eco.removeCoins(extra.sender, s.bet);
            const after = eco.getUser(extra.sender);
            return await sock.sendMessage(s.from, {
              text: `🃏 *BLACKJACK — BUST !*\n\n👤 Ta main : ${displayHand(s.playerHand)} = *${total}*\n\n💥 Dépassé 21 ! Tu perds *-${s.bet} 🪙*\n💰 Solde : ${after.coins.toLocaleString()} 🪙`,
            }, { quoted: msg });
          }

          if (total === 21) {
            // Auto-stand à 21
            args[0] = 'stand';
          } else {
            return await sock.sendMessage(s.from, {
              text: `🃏 Ta main : ${displayHand(s.playerHand)} = *${total}*\n\n*hit* — encore une carte\n*stand* — rester`,
            }, { quoted: msg });
          }
        }

        if (sub === 'stand' || sub === 'rester' || sub === 'stop' || handValue(s.playerHand) === 21) {
          // Tour du dealer
          while (handValue(s.dealerHand) < 17) s.dealerHand.push(drawCard());

          const playerTotal = handValue(s.playerHand);
          const dealerTotal = handValue(s.dealerHand);
          sessions.delete(extra.sender);

          let result, coins;
          if (dealerTotal > 21 || playerTotal > dealerTotal) {
            result = '🏆 *TU GAGNES !*'; coins = s.bet;
            eco.addCoins(extra.sender, s.bet); eco.addXP(extra.sender, 15);
          } else if (playerTotal === dealerTotal) {
            result = '🤝 *ÉGALITÉ*'; coins = 0;
          } else {
            result = '💀 *DEALER GAGNE*'; coins = -s.bet;
            eco.removeCoins(extra.sender, s.bet);
          }

          const after = eco.getUser(extra.sender);
          return await sock.sendMessage(s.from, {
            text:
              `🃏 *BLACKJACK — RÉSULTAT*\n\n` +
              `👤 Toi  : ${displayHand(s.playerHand)} = *${playerTotal}*\n` +
              `🤖 Bot  : ${displayHand(s.dealerHand)} = *${dealerTotal}*\n\n` +
              `${result}\n` +
              `${coins >= 0 ? `✅ +${coins}` : `❌ ${coins}`} 🪙\n` +
              `💰 Solde : *${after.coins.toLocaleString()} 🪙*`,
          }, { quoted: msg });
        }

        return extra.reply('Tape *.bj hit* pour tirer une carte ou *.bj stand* pour rester.');
      }

      // ── Nouvelle partie ────────────────────────────────────────────────
      const bet = parseInt(args[0]);
      if (!bet || bet < 10) return extra.reply('❌ Mise minimum *10 🪙*\nEx: *.blackjack 200*');
      if (bet > 5000) return extra.reply('❌ Mise max *5,000 🪙*');

      const user = eco.getUser(extra.sender);
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins} 🪙*`);

      const playerHand = [drawCard(), drawCard()];
      const dealerHand = [drawCard(), drawCard()];
      const playerTotal = handValue(playerHand);

      // Blackjack naturel
      if (playerTotal === 21) {
        eco.addCoins(extra.sender, Math.floor(bet * 1.5));
        eco.addXP(extra.sender, 20);
        const after = eco.getUser(extra.sender);
        return extra.reply(
          `🃏 *BLACKJACK NATUREL !* 🎉\n\n` +
          `👤 Toi : ${displayHand(playerHand)} = *21*\n\n` +
          `✅ Gain x1.5 : *+${Math.floor(bet * 1.5)} 🪙*\n` +
          `💰 Solde : *${after.coins.toLocaleString()} 🪙*`
        );
      }

      sessions.set(extra.sender, { playerHand, dealerHand, bet, from: extra.from });

      await sock.sendMessage(extra.from, {
        text:
          `🃏 *BLACKJACK — NOUVELLE PARTIE*\n\n` +
          `🤖 Dealer : ${dealerHand[0].v}${dealerHand[0].s} 🂠\n` +
          `👤 Toi    : ${displayHand(playerHand)} = *${playerTotal}*\n\n` +
          `💰 Mise : *${bet} 🪙*\n\n` +
          `*.bj hit* — tirer une carte\n*.bj stand* — rester`,
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
