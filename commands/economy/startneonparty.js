/**
 * StartNeonParty — Inscription au jeu RPG NeonParty
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

module.exports = {
  name: 'startneonparty',
  aliases: ['joindre', 'register', 'rejoindre', 'snp'],
  category: 'economy',
  description: 'Rejoindre NeonParty — le jeu RPG du bot',
  usage: '.startneonparty <pseudo>',

  async execute(sock, msg, args, extra) {
    try {
      if (np.isRegistered(extra.sender)) {
        const p = np.getPlayer(extra.sender);
        return extra.reply(
          `✅ T\'es déjà inscrit(e) go !\n\n` +
          `🎮 Pseudo : *${p.username}*\n` +
          `❤️ HP : *${p.hp}/${p.maxHp}*\n\n` +
          `_Tape .gprofile pour voir ta fiche_`
        );
      }

      if (!args[0]) {
        return extra.reply(
          `🎮 *BIENVENUE SUR NEONPARTY !*\n\n` +
          `Le jeu RPG de Nebula Bot — combat, mariage, famille et plus !\n\n` +
          `Pour rejoindre, choisis un pseudo unique :\n` +
          `*.startneonparty <pseudo>*\n\n` +
          `Règles du pseudo :\n` +
          `• 2 à 16 caractères\n` +
          `• Lettres, chiffres, - et _ seulement\n` +
          `• Unique dans tout le jeu\n\n` +
          `Ex : *.startneonparty DarkKnight*`
        );
      }

      const username = args[0];
      const result   = np.register(extra.sender, username);

      if (!result.ok) {
        if (result.reason === 'name_taken')
          return extra.reply(`❌ Le pseudo *"${username}"* est déjà pris ! Choisis-en un autre.`);
        if (result.reason === 'invalid_length')
          return extra.reply('❌ Pseudo trop court ou trop long (2-16 caractères) !');
        if (result.reason === 'invalid_chars')
          return extra.reply('❌ Caractères invalides ! Utilise seulement lettres, chiffres, - et _');
        return extra.reply('❌ Inscription impossible. Réessaie.');
      }

      // Bonus de bienvenue
      eco.addCoins(extra.sender, 500);
      eco.addXP(extra.sender, 50);

      await extra.reply(
        `🎉 *BIENVENUE DANS NEONPARTY, ${username.toUpperCase()} !*\n` +
        `${'═'.repeat(30)}\n\n` +
        `❤️ HP : *100/100*\n` +
        `💰 Bonus bienvenue : *+500 🪙*\n\n` +
        `*Commandes disponibles :*\n` +
        `⚔️ .kill @joueur — Attaquer\n` +
        `💫 .revive [@joueur] — Ressusciter\n` +
        `💊 .heal — Utiliser une potion\n` +
        `💍 .marry @joueur — Demande en mariage\n` +
        `👶 .adopt @joueur — Adopter\n` +
        `🌳 .family — Voir ta famille\n` +
        `📋 .gprofile — Ta fiche de jeu\n` +
        `🏆 .pvprank — Classement PVP\n\n` +
        `🛒 Achète des armes et armures : *.shop*\n\n` +
        `_Bonne chance go ! 🔥_`
      );

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
