/**
 * Beg Command — Mendier des coins (cooldown 5min, résultats humiliants)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const BEGS = [
  { msg: 'Tu t\'es mis à genoux devant tout le monde... les gens t\'ont donné quelques pièces par pitié 😭', min: 5, max: 30 },
  { msg: 'Tu as crié "j\'ai faim" dans la rue. Une vieille mémé t\'a donné une pièce et un morceau de pain 🍞', min: 1, max: 15 },
  { msg: 'T\'as fait le pitre au carrefour, les automobilistes t\'ont lancé des pièces depuis leur voiture 🚗', min: 10, max: 50 },
  { msg: 'Tu as chanté faux à l\'arrêt de bus... les gens ont payé pour que tu arrêtes 😂', min: 20, max: 80 },
  { msg: 'Tu as pleuré en public, quelqu\'un a eu pitié de toi', min: 5, max: 25 },
  { msg: 'Tu t\'es allongé par terre et tu as fait le mort. Personne n\'a rien donné 💀', min: 0, max: 0 },
  { msg: 'Un passant t\'a donné un billet en croyant que c\'était pour une association 🎉', min: 50, max: 200 },
];

module.exports = {
  name: 'beg',
  aliases: ['mendier', 'quémander', 'implorer'],
  category: 'economy',
  description: 'Mendier des coins (humiliant mais efficace... parfois)',
  usage: '.beg',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'beg')) {
        const r = eco.timeUntil(extra.sender, 'beg');
        return extra.reply(`🙏 *T\'as déjà mendié récemment, honte sur toi !*\n\nAttends : *${eco.formatTime(r)}*`);
      }

      eco.updateUser(extra.sender, { lastBeg: Date.now() });
      const event  = BEGS[Math.floor(Math.random() * BEGS.length)];
      const earned = event.min === 0 ? 0 : Math.floor(Math.random() * (event.max - event.min + 1)) + event.min;

      if (earned > 0) eco.addCoins(extra.sender, earned);
      eco.addXP(extra.sender, 1);
      const user = eco.getUser(extra.sender);

      await extra.reply(
        `🙏 *MENDICITÉ*\n\n` +
        `_${event.msg}_\n\n` +
        (earned > 0 ? `💵 Reçu : *+${earned} 🪙*\n💰 Solde : *${user.coins.toLocaleString()} 🪙*` : `💀 Tu n'as rien eu... quelle honte`) +
        `\n\n⏳ Réessaie dans : *5 min*`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
