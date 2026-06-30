/**
 * Me Command — Répondre au mini-jeu NeonGame
 * Nebula Bot by Dark Neon
 */
const eco      = require('../../utils/economy');
const np       = require('../../utils/neonparty');
const neonGame = require('../../utils/neonGame');

module.exports = {
  name: 'me',
  aliases: [],
  category: 'economy',
  description: 'Répondre au mini-jeu automatique de Nebula',
  usage: '.me <emoji_ou_mot>',

  async execute(sock, msg, args, extra) {
    try {
      if (!args.length) {
        const session = neonGame.getSession(extra.from);
        if (!session) {
          return extra.reply(
            `🎮 *NEONGAME*\n\n` +
            `Aucun défi en cours pour l'instant.\n` +
            `_Nebula lance un défi toutes les 2h !_`
          );
        }
        const left = Math.max(0, session.expiresAt - Date.now());
        return extra.reply(
          `🎮 *DÉFI EN COURS !*\n\n` +
          `Tape *.me <réponse>* pour tenter ta chance !\n` +
          `⏳ Il reste *${Math.ceil(left/1000)}s*`
        );
      }

      const answer = args.join(' ').trim();
      const result = neonGame.checkAnswer(extra.from, extra.sender, answer);

      if (!result.ok) {
        if (result.reason === 'no_session') {
          return extra.reply('❌ Aucun défi en cours ! Attends le prochain (toutes les 2h).');
        }
        if (result.reason === 'expired') {
          return extra.reply('⏰ Trop tard ! Le défi a expiré.');
        }
        if (result.reason === 'wrong') {
          // Réinitialiser le streak
          neonGame.resetStreak(extra.sender);
          return extra.reply(`❌ *Mauvaise réponse !*\n\n_Essaie encore au prochain défi !_`);
        }
        return extra.reply('❌ Erreur de validation.');
      }

      // ── BONNE RÉPONSE ─────────────────────────────────────────────────────
      const reward  = neonGame.GAME_REWARD_BASE;
      const streak  = neonGame.recordWin(extra.sender);

      eco.addCoins(extra.sender, reward);
      eco.addXP(extra.sender, 10);

      const pTag   = np.isRegistered(extra.sender) ? np.tag(extra.sender) : { wa: extra.sender.split('@')[0], gn: '' };
      const after  = eco.getUser(extra.sender);

      let text =
        `🏆 *BONNE RÉPONSE !*\n\n` +
        `🎉 @${pTag.wa}${pTag.gn ? ` 『 *${pTag.gn}* 』` : ''} a trouvé !\n\n` +
        `💰 Récompense : *+${reward} 🪙*\n` +
        `💵 Solde : *${after.coins.toLocaleString()} 🪙*\n` +
        `🔥 Streak : *${streak} victoire(s) consécutive(s)*`;

      if (streak >= 3 && streak % 3 === 0) {
        eco.addCoins(extra.sender, neonGame.STREAK_BONUS);
        const afterBonus = eco.getUser(extra.sender);
        text +=
          `\n\n🌟 *STREAK x${streak} !*\n` +
          `🎁 Bonus : *+${neonGame.STREAK_BONUS.toLocaleString()} 🪙* !\n` +
          `💰 Nouveau solde : *${afterBonus.coins.toLocaleString()} 🪙*`;
      }

      await sock.sendMessage(extra.from, { text, mentions: [extra.sender] }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
