/**
 * Crime Command — Action criminelle risquée (cooldown 1h)
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

const CRIMES = [
  { name: 'cambriolé une bijouterie',  emoji: '💍', minWin: 300, maxWin: 800,  minLoss: 100, maxLoss: 400, chance: 45 },
  { name: 'piraté un site web',        emoji: '💻', minWin: 200, maxWin: 600,  minLoss: 50,  maxLoss: 250, chance: 50 },
  { name: 'vendu des faux billets',    emoji: '💵', minWin: 150, maxWin: 500,  minLoss: 75,  maxLoss: 300, chance: 40 },
  { name: 'trafiqué des carburants',   emoji: '⛽', minWin: 250, maxWin: 700,  minLoss: 100, maxLoss: 350, chance: 55 },
  { name: 'arnaqué à la loterie',      emoji: '🎰', minWin: 100, maxWin: 1000, minLoss: 200, maxLoss: 500, chance: 35 },
  { name: 'pris en otage un banquier', emoji: '🏦', minWin: 500, maxWin: 1500, minLoss: 300, maxLoss: 600, chance: 30 },
  { name: 'volé un camion de livraison', emoji: '🚛', minWin: 200, maxWin: 550, minLoss: 80, maxLoss: 300, chance: 50 },
  { name: 'falsifié des documents',    emoji: '📄', minWin: 100, maxWin: 400,  minLoss: 50,  maxLoss: 200, chance: 60 },
];

const FAIL_MSGS = [
  'Tu as glissé sur une peau de banane en fuyant 🍌',
  'Le voisin t\'a reconnu et a appelé la police 📞',
  'Ta complice t\'a trahi pour une réduction de peine 😤',
  'Les caméras étaient partout... mauvaise journée 📷',
  'Tu as oublié tes empreintes digitales sur place 🤦',
  'Le chien de garde t\'a bloqué 🐕',
];

const WIN_MSGS = [
  'Tu t\'es enfui sans laisser de traces 🏃',
  'Plan parfaitement exécuté, bravo !',
  'Personne n\'a rien vu, tu es libre 🕵️',
  'Coup de maître, la police est dans le noir 🌑',
];

module.exports = {
  name: 'crime',
  aliases: ['criminel', 'larcin', 'arnaquer'],
  category: 'economy',
  description: 'Commettre un crime pour gagner des coins (risqué!)',
  usage: '.crime',

  async execute(sock, msg, args, extra) {
    try {
      if (np.isRegistered(extra.sender) && !np.isAlive(extra.sender)) {
        return extra.reply('💀 *Tu es mort !* Impossible de commettre un crime. Tu peux uniquement utiliser `.work`, `.kill`, `.dice` et `.invest`.');
      }
      if (!eco.isAvailable(extra.sender, 'crime')) {
        const remaining = eco.timeUntil(extra.sender, 'crime');
        return extra.reply(`🚔 *Trop risqué pour l\'instant !*\n\nLa police surveille encore, attends : *${eco.formatTime(remaining)}*`);
      }

      const user  = eco.getUser(extra.sender);
      const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
      const success = Math.random() * 100 < crime.chance;

      eco.updateUser(extra.sender, { lastCrime: Date.now() });

      if (success) {
        const gained = Math.floor(Math.random() * (crime.maxWin - crime.minWin + 1)) + crime.minWin;
        eco.addCoins(extra.sender, gained);
        eco.addXP(extra.sender, 15);
        // Enregistrer pour plainte (la victime = le sender car crime contre la société)
        np.recordCrime(extra.sender, extra.sender, 'crime');
        const after = eco.getUser(extra.sender);
        const winMsg = WIN_MSGS[Math.floor(Math.random() * WIN_MSGS.length)];

        await extra.reply(
          `${crime.emoji} *CRIME RÉUSSI !*\n\n` +
          `🦹 Tu as *${crime.name}*\n` +
          `✅ _${winMsg}_\n\n` +
          `💰 Butin : *+${gained.toLocaleString()} 🪙*\n` +
          `💵 Solde : *${after.coins.toLocaleString()} 🪙*\n\n` +
          `⏳ Prochain crime dans : *1h*`
        );
      } else {
        const lost   = Math.floor(Math.random() * (crime.maxLoss - crime.minLoss + 1)) + crime.minLoss;
        const actual = Math.min(lost, user.coins);
        eco.removeCoins(extra.sender, actual);
        const after   = eco.getUser(extra.sender);
        const failMsg = FAIL_MSGS[Math.floor(Math.random() * FAIL_MSGS.length)];

        await extra.reply(
          `${crime.emoji} *CRIME RATÉ !* 🚔\n\n` +
          `🦹 Tu as tenté de *${crime.name}*\n` +
          `❌ _${failMsg}_\n\n` +
          `💸 Amende : *-${actual.toLocaleString()} 🪙*\n` +
          `💵 Solde : *${after.coins.toLocaleString()} 🪙*\n\n` +
          `⏳ Réessaie dans : *1h*`
        );
      }

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
