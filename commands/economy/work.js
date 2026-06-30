/**
 * Work Command v2 — Messages variés + effet Pioche
 * Nebula Bot by Dark Neon
 */

const eco = require('../../utils/economy');
const ent = require('../../utils/enterprise');
const np  = require('../../utils/neonparty');

const JOBS = [
  { name: 'développeur', emoji: '💻', min: 50, max: 150,
    msgs: ['Tu as corrigé 12 bugs... en créant 6 nouveaux', 'Stack Overflow t\'a sauvé la mise', 'Le client veut encore changer le bouton en rouge'] },
  { name: 'livreur', emoji: '🛵', min: 30, max: 100,
    msgs: ['Le client était absent, tu reviens demain', 'Tu as évité 3 feux rouges', '10 commandes livrées sous la pluie'] },
  { name: 'médecin', emoji: '🏥', min: 80, max: 200,
    msgs: ['Consultation express de 30 patients', 'Tu as trouvé le diagnostic en 2 secondes', 'Urgences à minuit, mais bien payé'] },
  { name: 'cuisinier', emoji: '👨‍🍳', min: 40, max: 120,
    msgs: ['Le chef était ravi du plat du jour', 'Tu as flambé la sauce... et presque la cuisine', '50 couverts, zéro plainte'] },
  { name: 'DJ', emoji: '🎧', min: 60, max: 180,
    msgs: ['La foule a dansé jusqu\'à 4h du mat', 'Tu as mixé 3h non-stop', 'Un client t\'a demandé du Mapouka, tu as géré'] },
  { name: 'streamer', emoji: '🎮', min: 20, max: 250,
    msgs: ['100 viewers ce soir, record battu!', 'Tu t\'es fait kill en live... classique', 'Les dons ont plu pendant le stream'] },
  { name: 'trader', emoji: '📈', min: 10, max: 300,
    msgs: ['Le trade a payé, cette fois', 'HODL fonctionne encore... ou pas', 'Tu as vendu juste avant la pump, mais c\'est bon'] },
  { name: 'professeur', emoji: '📚', min: 50, max: 130,
    msgs: ['Les élèves ont tout compris aujourd\'hui', 'Interro corrigée en un temps record', '3h de cours sans que personne s\'endorme'] },
  { name: 'footballeur', emoji: '⚽', min: 70, max: 400,
    msgs: ['Un doublé ce soir !', 'Match nul mais prime de présence', 'Le coach a dit que c\'était pas mal...'] },
  { name: 'influenceur', emoji: '📸', min: 30, max: 350,
    msgs: ['10K vues sur le dernier post', 'Un sponsor t\'a contacté', 'Le reel a buzzé toute la nuit'] },
  { name: 'mécanicien', emoji: '🔧', min: 45, max: 140,
    msgs: ['5 révisions de voitures dans la journée', 'Le client était tellement content il t\'a donné un pourboire', 'Pneu changé en 8 minutes'] },
  { name: 'pêcheur', emoji: '🎣', min: 20, max: 180,
    msgs: ['Bonne prise aujourd\'hui sur le lac', 'Tu as vendu tout le poisson au marché', 'La mer était calme, la pêche fructueuse'] },
];

module.exports = {
  name: 'work',
  aliases: ['travailler', 'boulot', 'job'],
  category: 'economy',
  description: 'Travailler pour gagner des coins (cooldown 30min)',
  usage: '.work',

  async execute(sock, msg, args, extra) {
    try {
      // ── Vérifications NeonParty ──────────────────────────────────────────
      if (np.isRegistered(extra.sender) && np.isInPrison(extra.sender)) {
        return extra.reply(
          `🔒 *Tu es en prison !*\n\nTu peux pas travailler depuis la prison...\n` +
          `⏳ Libéré dans : *${np.formatTime(np.timeUntilRelease(extra.sender))}*`
        );
      }

      if (!eco.isWorkAvailable(extra.sender)) {
        const remaining = eco.timeUntilWork(extra.sender);
        return extra.reply(
          `😴 *Tu es fatigué !*\n\n` +
          `Repose-toi encore : *${eco.formatTime(remaining)}*\n` +
          `_Le travail c'est la santé !_ 💪`
        );
      }

      const job      = JOBS[Math.floor(Math.random() * JOBS.length)];
      const hasPick  = eco.hasItem(extra.sender, 'pickaxe');
      let   earned   = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

      if (hasPick) {
        earned *= 2;
        eco.useItem(extra.sender, 'pickaxe');
      }

      eco.updateUser(extra.sender, { lastWork: Date.now() });

      const hasBoost = eco.hasItem(extra.sender, 'boost');
      const xpGained = hasBoost ? 20 : 10;
      const { leveledUp, newLevel } = eco.addXP(extra.sender, xpGained);
      const randomMsg = job.msgs[Math.floor(Math.random() * job.msgs.length)];

      // ── Vérifier si employé dans une entreprise ───────────────────────────
      const employer = ent.getEmployerOf(extra.sender);
      if (employer) {
        // L'argent va à l'employeur, pas au worker
        const payInfo = ent.registerWorkByEmployee(employer.ownerId, extra.sender, earned);
        eco.addCoins(employer.ownerId, earned); // employeur reçoit immédiatement

        // Notifier l'employeur
        try {
          await sock.sendMessage(extra.from, {
            text:
              `🏢 *[${employer.name}]*\n` +
              `👷 @${extra.sender.split('@')[0]} a travaillé !\n` +
              `💰 Gains : *+${payInfo.totalOwed} 🪙* (bonus rang inclus)\n\n` +
              `⚠️ @${employer.ownerId.split('@')[0]} : paye *200+ 🪙* dans les *2 minutes* !\n` +
              `Tape *.payworker @${extra.sender.split('@')[0]} <montant>*`,
            mentions: [extra.sender, employer.ownerId]
          });
        } catch {}

        const user2 = eco.getUser(extra.sender);
        return await extra.reply(
          `${job.emoji} *${job.name}* pour *${employer.name}*\n` +
          `💬 _${randomMsg}_\n\n` +
          `💵 Salaire transmis à l\'employeur : *${earned} 🪙*\n` +
          `🏢 Ton patron a *2 minutes* pour te payer *200+ 🪙*\n\n` +
          `⏳ Prochain travail dans : *30 min*`
        );
      }

      // Pas d'employeur — gains directs
      // ── Vérifier la dette de braquage banque ────────────────────────────
      const debtDue = eco.getBankDebt(extra.sender);
      if (debtDue > 0) {
        const deducted = eco.repayBankDebt(extra.sender, earned);
        const net      = earned - deducted;
        if (net > 0) eco.addCoins(extra.sender, net);
        const user = eco.getUser(extra.sender);
        const remainDebt = eco.getBankDebt(extra.sender);
        let text =
          `${job.emoji} *Métier : ${job.name}*\n` +
          `💬 _${randomMsg}_\n\n` +
          `💵 Salaire brut : *${earned} 🪙*${hasPick ? ' _(x2 Pioche)_' : ''}\n` +
          `⚠️ *DETTE BRAQUAGE* : *-${deducted} 🪙* prélevés automatiquement\n` +
          `💰 Reçu net : *+${net} 🪙*\n` +
          `🔴 Reste dû : *${remainDebt.toLocaleString()} 🪙*\n\n` +
          `💰 Solde : *${user.coins.toLocaleString()} 🪙*\n` +
          `⏳ Prochain travail dans : *30 min*`;
        if (remainDebt <= 0) text += `\n\n✅ *DETTE REMBOURSÉE INTÉGRALEMENT !* Tu es libre.`;
        return await extra.reply(text);
      }

      eco.addCoins(extra.sender, earned);
      const user = eco.getUser(extra.sender);

      // Générer la carte de gain
      const { generateGainCard } = require('../../utils/nebulaCard');
      const buffer = await generateGainCard({
        title: 'TRAVAIL RÉUSSI !',
        subtitle: randomMsg,
        emoji: job.emoji,
        color: '#10b981', // success
        amount: earned,
        xp: xpGained,
        balance: user.coins
      });

      let caption = `${job.emoji} *${job.name}* — Gains : *+${earned} 🪙*`;
      if (leveledUp) caption += `\n🚀 *NIVEAU ${newLevel} !*`;

      await sock.sendMessage(extra.from, { 
        image: buffer, 
        caption: caption + `\n⏳ Prochain travail dans : *30 min*`
      }, { quoted: msg });
    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
