/**
 * Donate Command — Give all your money to a random fake organisation
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

// Fake organisations that receive donations
const ORGS = [
  { name: 'Fondation des Orphelins de Neptune',       emoji: '🌊', cause: 'aide les orphelins à trouver un foyer' },
  { name: 'Association des Chats Errants',             emoji: '🐱', cause: 'nourrit les chats abandonnés de la ville' },
  { name: 'Œuvre du Plombier du Dimanche',             emoji: '🔧', cause: 'répare les fuites d\'eau des maisons pauvres' },
  { name: 'Fondation Sauvez les Pixels',               emoji: '🎮', cause: 'donne des consoles aux hôpitaux pour enfants' },
  { name: 'Comité de Soutien aux Gens Perdus',         emoji: '🗺️', cause: 'accompagne les touristes perdus dans le métro' },
  { name: 'ONG Les Pigeons Propres',                   emoji: '🐦', cause: 'lavage et relooking de pigeons urbains' },
  { name: 'Fondation Du Repos du Geek',                emoji: '💻', cause: 'offre des pauses écran obligatoires' },
  { name: 'Association Anti-Chaussettes Trouées',      emoji: '🧦', cause: 'distribue des chaussettes neuves aux nécessiteux' },
  { name: 'Comité International du Café Gratuit',      emoji: '☕', cause: 'offre du café à ceux qui en ont besoin' },
  { name: 'Fondation Sauvetage du Weekend',            emoji: '🏖️', cause: 'finance des weekends pour les travailleurs épuisés' },
  { name: 'Organisation mondiale du Câlins',           emoji: '🤗', cause: 'distribue des câlins gratuits dans le monde entier' },
  { name: 'Fondation Le Sourire du Lundi',             emoji: '😊', cause: 'rend les lundis un peu moins tristes' },
];

module.exports = {
  name: 'donate',
  aliases: ['don', 'charity', 'aumone'],
  category: 'economy',
  description: 'Donner tout ton argent à une organisation fictive',
  usage: '.donate',
  ownerOnly: false,

  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);
      const wallet = user.coins || 0;
      const bank   = user.bank   || 0;
      const total  = wallet + bank;

      if (total <= 0) {
        return extra.reply(
          `🫙 *DONATION*\n` +
          `${'─'.repeat(25)}\n\n` +
          `Tu n'as rien à donner... 😅\n\n` +
          `💵 Portefeuille : *0 🪙*\n` +
          `🏦 Banque        : *0 🪙*\n\n` +
          `_Reviens quand tu seras plus riche !_`
        );
      }

      // NeonParty checks
      if (!np.isRegistered(extra.sender)) {
        return extra.reply(
          `💀 *TU N'ES PAS INSCRIT !*\n\n` +
          `Inscris-toi d'abord avec *.game* ou *.register <pseudo>*\n` +
          `_pour participer au NeonParty !_`
        );
      }

      if (!np.isAlive(extra.sender)) {
        const remaining = np.timeUntilRevive(extra.sender);
        return extra.reply(
          `💀 *TU ES MORT !*\n\n` +
          `Tu ne peux rien faire maintenant ! ⚰️\n` +
          `⏳ Revive dans : *${np.formatTime(remaining)}*\n\n` +
          `_Demande à quelqu'un de taper .revive @toi !_`
        );
      }

      // Pick random organisation
      const org = ORGS[Math.floor(Math.random() * ORGS.length)];

      // Take all money
      eco.updateUser(extra.sender, { coins: 0, bank: 0 });

      // Bonus XP for being generous
      const xpGained = Math.min(100, Math.floor(total / 100));
      const levelUp = eco.addXP(extra.sender, xpGained);

      // Karma point (stored in NeonParty)
      const player = np.getPlayer(extra.sender);
      np.updatePlayer(extra.sender, {
        karma: (player.karma || 0) + 1,
      });

      const donorTag = extra.sender.split('@')[0];
      const karma    = (player.karma || 0) + 1;
      const karmaEmoji = karma >= 10 ? '😇' : karma >= 5 ? '🙏' : karma >= 3 ? '💛' : '💕';

      let text =
        `${org.emoji} *DONATION EFFECTUÉE*\n` +
        `${'─'.repeat(28)}\n\n` +
        `Tu as donné *${total.toLocaleString()} 🪙* à :\n` +
        `*${org.emoji} ${org.name}*\n\n` +
        `📝 Cette organisation ${org.cause}.\n\n` +
        `💵 Portefeuille vidé : *0 🪙*\n` +
        `🏦 Banque vidée     : *0 🪙*\n\n` +
        `🌟 Karma : *${karma}* ${karmaEmoji}\n` +
        `⭐ XP gagnée : *+${xpGained}*\n`;

      if (levelUp.leveledUp) {
        text += `\n🚀 *NIVEAU SUPÉRIEUR !* Tu es niveau *${levelUp.newLevel}* — ${eco.getTitle(levelUp.newLevel)} !`;
      }

      text += `\n\n_${org.emoji} Merci pour ta générosité, @${donorTag} !_`;

      await extra.reply(text);
    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
