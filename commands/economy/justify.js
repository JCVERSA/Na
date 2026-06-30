/**
 * Justify Command — Se justifier en prison (20-25% de chances)
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

const JUSTIFY_COOLDOWN = new Map();
const COOLDOWN_MS = 30 * 60 * 1000; // 30min entre chaque tentative

const JUSTIFICATIONS = [
  "Je dormais à ce moment-là, c'est impossible que c'était moi 😇",
  "J'ai des témoins ! Mon clan peut confirmer que j'étais ailleurs",
  "C'est mon jumeau maléfique ! Je suis innocent(e) 😭",
  "L'IA m'a piégé(e), regardez les logs !",
  "Je connais mes droits, cet acte était en légitime défense !",
  "Je suis un joueur modèle depuis le début, c'est injuste !",
  "On m'a volé mon compte, c'était un hacker !",
  "La plainte a été déposée hors délai légal !",
  "Je demande un nouveau procès avec jury populaire !",
  "Ma situation personnelle difficile mérite la clémence...",
];

module.exports = {
  name: 'justify',
  aliases: ['justifier', 'plaidoyer', 'innocent', 'defendre'],
  category: 'economy',
  description: 'Se justifier en prison (20-25% de chances)',
  usage: '.justify',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      if (!np.isInPrison(extra.sender)) {
        return extra.reply("✅ T'es pas en prison go! Tu es déjà libre 🕊️");
      }

      // Cooldown 30min entre tentatives
      const last = JUSTIFY_COOLDOWN.get(extra.sender) || 0;
      if (Date.now() - last < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - (Date.now() - last);
        return extra.reply(
          `⏳ T'as déjà plaidé récemment !\n\nProchaine tentative dans : *${np.formatTime(remaining)}*`
        );
      }

      JUSTIFY_COOLDOWN.set(extra.sender, Date.now());

      const justif   = JUSTIFICATIONS[Math.floor(Math.random() * JUSTIFICATIONS.length)];
      const chance   = 0.20 + Math.random() * 0.05; // 20-25%
      const freed    = Math.random() < chance;
      const p        = np.getPlayer(extra.sender);
      const remaining = np.timeUntilRelease(extra.sender);

      if (freed) {
        np.releaseFromPrison(extra.sender);
        return extra.reply(
          `⚖️ *PLAIDOYER ACCEPTÉ !* 🎉\n\n` +
          `"${justif}"\n\n` +
          `✅ Le juge t'a cru ! Tu es *LIBÉRÉ(E)* !\n\n` +
          `_Chance : ${Math.round(chance * 100)}% — T'as eu de la veine go !_`
        );
      } else {
        return extra.reply(
          `⚖️ *PLAIDOYER REJETÉ !*\n\n` +
          `"${justif}"\n\n` +
          `❌ Le juge n'y croit pas...\n\n` +
          `⏳ Temps restant : *${np.formatTime(remaining)}*\n` +
          `_Retente dans 30min, ou demande à quelqu'un de payer ta caution (.caution)_`
        );
      }

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
