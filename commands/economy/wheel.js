/**
 * Wheel Command — Roue de la fortune (cooldown 10min)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const SEGMENTS = [
  { label: '💀 FAILLITE',     mult: 0,    chance: 5,  color: 'rouge' },
  { label: '×0.5',            mult: 0.5,  chance: 15, color: 'orange' },
  { label: '×1 (remboursé)', mult: 1,    chance: 25, color: 'jaune' },
  { label: '×1.5',            mult: 1.5,  chance: 20, color: 'vert' },
  { label: '×2',              mult: 2,    chance: 18, color: 'bleu' },
  { label: '×3',              mult: 3,    chance: 10, color: 'violet' },
  { label: '×5',              mult: 5,    chance: 5,  color: 'or' },
  { label: '🌟 JACKPOT ×10', mult: 10,   chance: 2,  color: 'arc-en-ciel' },
];

module.exports = {
  name: 'wheel',
  aliases: ['roue', 'fortune', 'spin'],
  category: 'economy',
  description: 'Faire tourner la roue de la fortune (10min)',
  usage: '.wheel <mise>',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'wheel')) {
        return extra.reply(`🎡 *La roue tourne encore !*\n\nAttends : *${eco.formatTime(eco.timeUntil(extra.sender, 'wheel'))}*`);
      }

      const user = eco.getUser(extra.sender);
      const bet  = args[0] === 'all' ? user.coins : parseInt(args[0]);
      if (!bet || bet < 10) return extra.reply('❌ Mise minimum *10 🪙*\nEx: *.wheel 500*');
      if (bet > 20000) return extra.reply('❌ Mise max *20,000 🪙*');
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant ! Tu as *${user.coins} 🪙*`);

      eco.updateUser(extra.sender, { lastWheel: Date.now() });

      // Tirage pondéré
      const total = SEGMENTS.reduce((s, sg) => s + sg.chance, 0);
      let roll    = Math.random() * total;
      let seg     = SEGMENTS[0];
      for (const s of SEGMENTS) { roll -= s.chance; if (roll <= 0) { seg = s; break; } }

      const hasLucky = eco.hasItem(extra.sender, 'lucky');
      if (hasLucky && seg.mult < 1) {
        // Trèfle chanceux évite les résultats négatifs
        seg = SEGMENTS.find(s => s.mult === 1) || seg;
        eco.useItem(extra.sender, 'lucky');
      }

      const gain = Math.floor(bet * seg.mult);
      const diff = gain - bet;

      eco.removeCoins(extra.sender, bet);
      if (gain > 0) eco.addCoins(extra.sender, gain);
      if (diff > 0) eco.addXP(extra.sender, Math.floor(diff / 10));

      const after = eco.getUser(extra.sender);
      const display = SEGMENTS.map(s => s.label === seg.label ? `➤ *${s.label}*` : s.label).join('\n');

      await extra.reply(
        `🎡 *ROUE DE LA FORTUNE*\n\n` +
        `${display}\n\n` +
        `${'─'.repeat(26)}\n` +
        `📍 Résultat : *${seg.label}*\n` +
        `💰 Mise : ${bet.toLocaleString()} 🪙\n` +
        (diff >= 0 ? `✅ Gain : *+${diff.toLocaleString()} 🪙*` : `❌ Perte : *${diff.toLocaleString()} 🪙*`) + '\n' +
        `💵 Solde : *${after.coins.toLocaleString()} 🪙*` +
        (hasLucky ? '\n\n🍀 _Trèfle chanceux activé !_' : '')
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
