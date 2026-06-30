/**
 * Hunt Command — Chasse aux animaux (cooldown 20min)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const ANIMALS = [
  { name: 'lièvre',        emoji: '🐇', min: 20,  max: 60,  chance: 30, xp: 5  },
  { name: 'antilope',      emoji: '🦌', min: 60,  max: 150, chance: 25, xp: 10 },
  { name: 'sanglier',      emoji: '🐗', min: 100, max: 250, chance: 20, xp: 12 },
  { name: 'lion',          emoji: '🦁', min: 200, max: 500, chance: 12, xp: 20 },
  { name: 'éléphant',      emoji: '🐘', min: 400, max: 800, chance: 8,  xp: 30 },
  { name: 'gorille',       emoji: '🦍', min: 300, max: 700, chance: 4,  xp: 25 },
  { name: 'dragon légendaire', emoji:'🐉', min: 1000, max: 2500, chance: 1, xp: 60 },
];

const MISS = ['Tu as raté ton tir... l\'animal s\'est enfui 🏃', 'Arme enrayée au mauvais moment 😭', 'L\'animal t\'a vu partir 👀'];

module.exports = {
  name: 'hunt',
  aliases: ['chasse', 'chasser', 'hunting'],
  category: 'economy',
  description: 'Partir à la chasse (cooldown 20min)',
  usage: '.hunt',
  async execute(sock, msg, args, extra) {
    try {
      if (!eco.isAvailable(extra.sender, 'hunt')) {
        const r = eco.timeUntil(extra.sender, 'hunt');
        return extra.reply(`🏹 *Tu recharges ton arme !*\n\nAttends : *${eco.formatTime(r)}*`);
      }

      eco.updateUser(extra.sender, { lastHunt: Date.now() });

      if (Math.random() < 0.15) {
        return extra.reply(`🏹 *Chasse terminée*\n\n❌ _${MISS[Math.floor(Math.random() * MISS.length)]}_\n\n⏳ Réessaie dans : *20 min*`);
      }

      const roll = Math.random() * 100;
      let cumul  = 0, animal = null;
      for (const a of ANIMALS) {
        cumul += a.chance;
        if (roll <= cumul) { animal = a; break; }
      }
      if (!animal) animal = ANIMALS[0];

      const earned = Math.floor(Math.random() * (animal.max - animal.min + 1)) + animal.min;
      eco.addCoins(extra.sender, earned);
      const { leveledUp, newLevel } = eco.addXP(extra.sender, animal.xp);
      const user = eco.getUser(extra.sender);

      // Générer la carte de gain
      const { generateGainCard } = require('../../utils/nebulaCard');
      const buffer = await generateGainCard({
        title: 'CHASSE RÉUSSIE !',
        subtitle: `Tu as attrapé un ${animal.name}`,
        emoji: animal.emoji,
        color: '#f59e0b', // warning/orange
        amount: earned,
        xp: animal.xp,
        balance: user.coins
      });

      let caption = `${animal.emoji} *CHASSE* — Gains : *+${earned} 🪙*`;
      if (leveledUp) caption += `\n🚀 *NIVEAU ${newLevel} !*`;

      await sock.sendMessage(extra.from, { 
        image: buffer, 
        caption: caption + `\n⏳ Prochaine chasse dans : *20 min*`
      }, { quoted: msg });
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
