/**
 * SetGameName Command — Changer son pseudo de jeu
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

module.exports = {
  name: 'setgamename',
  aliases: ['changenom', 'renommer', 'sgn'],
  category: 'economy',
  description: 'Changer son pseudo NeonParty',
  usage: '.setgamename <nouveau_pseudo>',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      if (!args[0]) return extra.reply("❌ Donne un nouveau pseudo!\nEx: *.setgamename MonNouveauPseudo*");

      const newName = args[0];
      const p       = np.getPlayer(extra.sender);

      if (newName.length < 2 || newName.length > 16) return extra.reply('❌ 2 à 16 caractères!');
      if (!/^[\w\-\.]+$/.test(newName)) return extra.reply('❌ Lettres, chiffres, - et _ seulement!');

      const db = require('../../utils/neonparty');
      const existing = np.findByUsername(newName);
      if (existing && existing[0] !== extra.sender) return extra.reply(`❌ Le pseudo *"${newName}"* est déjà pris!`);

      const oldName = p.username;
      np.updatePlayer(extra.sender, { username: newName });

      await extra.reply(
        `✅ *PSEUDO CHANGÉ !*\n\n` +
        `Ancien : *${oldName}*\n` +
        `Nouveau : *${newName}*\n\n` +
        `_Ton nouveau nom de guerre !_ ⚔️`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
