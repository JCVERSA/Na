/**
 * Hire Command — Recruter / virer des employés
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const ent = require('../../utils/enterprise');

module.exports = {
  name: 'hire',
  aliases: ['recruter', 'embaucher', 'employe'],
  category: 'economy',
  description: 'Recruter un joueur dans ton entreprise',
  usage: '.hire @joueur | .fire @joueur | .employees',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      const co  = ent.getCompany(extra.sender);
      const sub = (args[0] || '').toLowerCase();
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // ── Liste des employés ─────────────────────────────────────────────────
      if (sub === 'list' || sub === 'employees' || sub === 'employes' || sub === 'liste') {
        if (!co) return extra.reply("❌ T'as pas d'entreprise. Tape *.company open <nom>*");
        const emps = co.employees || [];
        if (!emps.length) return extra.reply(`🏢 *${co.name}* — Aucun employé pour l'instant`);
        const rank = ent.getCompanyRank(co.xp || 0);
        const pending = co.pendingPay || {};
        const streaks = co.missedStreak || {};
        const lines = emps.map(e => {
          const hasPending = pending[e.id];
          const missed     = streaks[e.id] || 0;
          return `👷 @${e.id.split('@')[0]} 『 ${e.username || '?'} 』${hasPending ? ' ⚠️ paiement dû!' : ''}${missed > 0 ? ` (${missed}/5 manqués)` : ''}`;
        });
        return await sock.sendMessage(extra.from, {
          text:
            `🏢 *Employés de ${co.name}* (${emps.length})\n` +
            `${'─'.repeat(28)}\n\n` +
            lines.join('\n') +
            `\n\n⚡ Bonus de rang : *+${rank.workBonus} 🪙/travail*\n` +
            `🤖 Bot-workers : *${co.botWorkers || 0}*`,
          mentions: emps.map(e => e.id)
        }, { quoted: msg });
      }

      if (!co) return extra.reply("❌ T'as pas d'entreprise. Tape *.company open <nom>*");
      if (!co.open) return extra.reply("❌ Ton entreprise est fermée!");

      // ── Virer ─────────────────────────────────────────────────────────────
      if (sub === 'fire' || sub === 'virer' || sub === 'licencier') {
        if (!mentioned[0]) return extra.reply("❌ Mentionne l'employé à virer!\n*.fire @joueur*");
        const target = mentioned[0];
        if (!co.employees.some(e => e.id === target)) {
          return await sock.sendMessage(extra.from, {
            text: `❌ @${target.split('@')[0]} ne travaille pas chez toi!`,
            mentions: [target]
          }, { quoted: msg });
        }
        ent.fireEmployee(extra.sender, target);
        return await sock.sendMessage(extra.from, {
          text: `👋 @${target.split('@')[0]} a été licencié(e) de *${co.name}*!`,
          mentions: [target]
        }, { quoted: msg });
      }

      // ── Recruter ──────────────────────────────────────────────────────────
      if (!mentioned[0]) return extra.reply(
        `❌ Mentionne quelqu'un!\n*.hire @joueur* — recruter\n*.fire @joueur* — licencier\n*.hire list* — voir les employés`
      );

      const target = mentioned[0];
      if (target === extra.sender) return extra.reply("😂 Tu veux t'embaucher toi-même ?");
      if (!np.isRegistered(target)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${target.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [target]
        }, { quoted: msg });
      }

      // Vérifier si déjà employé ailleurs
      const existingEmployer = ent.getEmployerOf(target);
      if (existingEmployer) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${target.split('@')[0]} travaille déjà pour *${existingEmployer.name}*!`,
          mentions: [target]
        }, { quoted: msg });
      }

      const tPlayer  = np.getPlayer(target);
      const result   = ent.hireEmployee(extra.sender, target, tPlayer.username);
      if (result === 'already') return extra.reply("❌ Ce joueur est déjà dans ton équipe!");

      await sock.sendMessage(extra.from, {
        text:
          `🤝 *NOUVEAU RECRUTEMENT !*\n\n` +
          `🏢 Entreprise : *${co.name}*\n` +
          `👷 Nouvel employé : @${target.split('@')[0]} 『 *${tPlayer.username || '?'}* 』\n\n` +
          `_@${target.split('@')[0]} : quand tu tapes *.work*, l'argent va à ton patron !_\n` +
          `_Ton patron doit te payer *200+ 🪙* dans les 2 minutes._`,
        mentions: [extra.sender, target]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
