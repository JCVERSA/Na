/**
 * Heal Command — Utiliser une potion de soin
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');

module.exports = {
  name: 'heal',
  aliases: ['soigner', 'potion', 'hp'],
  category: 'economy',
  description: 'Utiliser une potion de soin (+50 HP)',
  usage: '.heal',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      }
      if (!np.isAlive(extra.sender)) {
        return extra.reply("💀 Tu es mort(e) ! Tu peux pas utiliser une potion dans cet état go...");
      }

      const p = np.getPlayer(extra.sender);

      if (p.hp >= p.maxHp) {
        return extra.reply(`✅ Tu es déjà au max de HP ! (*${p.hp}/${p.maxHp}*)`);
      }

      if (!np.hasPower(extra.sender, 'healing')) {
        return extra.reply(
          "❌ Tu n'as pas de *💊 Potion de Soin* !\n\nAchète-en une avec *.buy healing*"
        );
      }

      np.usePower(extra.sender, 'healing');
      const newHp = np.heal(extra.sender, 50);

      await extra.reply(
        `💊 *POTION UTILISÉE !*\n\n` +
        `❤️ HP : *${p.hp}* → *${newHp}/${p.maxHp}*\n` +
        `${np.hpBar(newHp, p.maxHp)}\n\n` +
        `_+50 HP restaurés. Potion consommée._`
      );
    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
