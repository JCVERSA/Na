/**
 * Revive Command — Ressusciter soi-même ou un allié
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

module.exports = {
  name: 'revive',
  aliases: ['ressusciter', 'ranimer'],
  category: 'economy',
  description: 'Ressusciter (besoin du pouvoir Revive)',
  usage: '.revive [@joueur]',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;
      const isSelf    = targetId === extra.sender;

      const target = np.getPlayer(targetId);
      if (!target.registered) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas inscrit dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      // Vérifier si la cible est morte
      if (np.isAlive(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `✅ @${targetId.split('@')[0]} 『 ${target.username} 』 est déjà en vie ! (${target.hp} HP)`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const caster = np.getPlayer(extra.sender);

      // Vérifier si le lanceur a le pouvoir revive
      const hasRevivePower = np.hasPower(extra.sender, 'revive_power');
      if (!hasRevivePower) {
        const r = np.timeUntilRevive(targetId);
        if (isSelf) {
          return extra.reply(
            `💀 *TU ES MORT !*\n\n` +
            `Revive automatique dans : *${np.formatTime(r)}*\n\n` +
            `Pour revivre plus vite, achète le pouvoir *💫 Revive* dans *.shop*`
          );
        }
        return await sock.sendMessage(extra.from, {
          text:
            `❌ Tu n'as pas le pouvoir *💫 Revive* !\n\n` +
            `Achète-le dans *.shop* pour ressusciter tes alliés.\n` +
            `@${targetId.split('@')[0]} revivra automatiquement dans *${np.formatTime(np.timeUntilRevive(targetId))}*`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      // Utiliser le pouvoir et ressusciter
      np.usePower(extra.sender, 'revive_power');
      const newHp = np.revive(targetId, 60);
      eco.addXP(extra.sender, 20);

      const defTag = np.tag(targetId);
      const atkTag = np.tag(extra.sender);

      if (isSelf) {
        await extra.reply(
          `💫 *AUTO-RÉSURRECTION !*\n\n` +
          `@${atkTag.wa} 『 *${atkTag.gn}* 』 s'est ressuscité(e) !\n\n` +
          `❤️ HP restaurés : *${newHp}/100*\n` +
          `${np.hpBar(newHp)}\n\n` +
          `_Pouvoir Revive consommé._`
        );
      } else {
        await sock.sendMessage(extra.from, {
          text:
            `💫 *RÉSURRECTION !*\n\n` +
            `@${atkTag.wa} 『 *${atkTag.gn}* 』 a ressuscité @${defTag.wa} 『 *${defTag.gn}* 』 !\n\n` +
            `❤️ HP restaurés : *${newHp}/100*\n` +
            `${np.hpBar(newHp)}\n\n` +
            `_Pouvoir Revive consommé. Tu es bon(ne) pote !_ 🤝`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
