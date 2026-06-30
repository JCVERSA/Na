/**
 * Kill Command — Attaquer un joueur
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

module.exports = {
  name: 'kill',
  aliases: ['attaquer', 'attack', 'frapper'],
  category: 'economy',
  description: 'Attaquer un autre joueur NeonParty',
  usage: '.kill @joueur',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Tu es pas inscrit dans NeonParty !\nTape *.startneonparty <pseudo>* pour rejoindre.");
      }
      // ── Vérifier prison (mort ok, on peut still kill) ────────────────────
      if (np.isInPrison(extra.sender)) {
        return extra.reply(
          `🔒 *TU ES EN PRISON !*\n\nTu peux pas attaquer depuis la prison...\n` +
          `⏳ Libéré dans : *${np.formatTime(np.timeUntilRelease(extra.sender))}*\n\n` +
          `_Tape .justify pour tenter une libération anticipée_`
        );
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply("❌ Mentionne quelqu'un!\nEx: *.kill @joueur*");

      const targetId = mentioned[0];
      if (targetId === extra.sender) return extra.reply("😭 Tu veux te suicider go ?! Tape .beg plutôt lol");
      if (!np.isRegistered(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas inscrit dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      if (!np.isAlive(targetId)) {
        const r = np.timeUntilRevive(targetId);
        const def = np.getPlayer(targetId);
        return await sock.sendMessage(extra.from, {
          text: `💀 @${targetId.split('@')[0]} 『 ${def.username} 』 est déjà mort(e) !\n⏳ Revive dans : *${np.formatTime(r)}*`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const atk = np.getPlayer(extra.sender);
      const def = np.getPlayer(targetId);
      const atkTag = np.tag(extra.sender);
      const defTag = np.tag(targetId);

      const result = np.calculateDamage(extra.sender, targetId);

      if (result.dodged) {
        const reason = result.invisible
          ? '👻 *INVISIBILITÉ* — Attaque ignorée totalement !'
          : '👁️ *SHARINGAN* — Attaque esquivée !';
        return await sock.sendMessage(extra.from, {
          text:
            `⚔️ *ATTAQUE RATÉE !*\n\n` +
            `🔴 @${atkTag.wa} 『 ${atkTag.gn} 』 attaque @${defTag.wa} 『 ${defTag.gn} 』\n\n` +
            `${reason}\n\n` +
            `❤️ HP de ${def.username} : *${def.hp}/${def.maxHp}*\n` +
            `${np.hpBar(def.hp, def.maxHp)}`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

      let bonusDmg = 0;
      if (np.hasPower(extra.sender, 'poison')) {
        bonusDmg = 20;
        np.usePower(extra.sender, 'poison');
      }
      const totalDmg = result.dmg + bonusDmg;

      const dmgResult = np.applyDamage(targetId, totalDmg);
      np.updatePlayer(extra.sender, { totalDmgDealt: (atk.totalDmgDealt || 0) + totalDmg });

      const weapon = atk.weapon && np.WEAPON_STATS[atk.weapon];
      const armor  = def.armor  && np.ARMOR_STATS[def.armor];

      let combatLog = `🔴 Attaque : *${atk.username || atkTag.wa}* `;
      if (weapon) combatLog += `avec ${weapon.emoji} *${weapon.name}*\n`;
      else combatLog += `(à mains nues)\n`;
      combatLog += `🔵 Cible : *${def.username || defTag.wa}*\n`;
      if (armor)    combatLog += `🛡️ Armure : ${armor.emoji} ${armor.name} (-${result.reduction} dégâts)\n`;
      if (bonusDmg) combatLog += `☠️ Poison : +${bonusDmg} dégâts\n`;

      if (dmgResult.died) {
        np.applyKill(extra.sender);
        const loot = Math.floor(Math.random() * 200) + 100;
        eco.addCoins(extra.sender, loot);
        eco.addXP(extra.sender, 30);
        // GameXP de combat
        np.addGameXp(extra.sender, 40);
        np.addGameXp(targetId, 10); // la victime gagne aussi un peu d'XP
        // Enregistrer le crime (pour plainte dans les 30s)
        np.recordCrime(extra.sender, targetId, 'kill');
        const duration = np.formatTime(dmgResult.deadUntil - Date.now());

        // ── Message spécial si arme caca ──────────────────────────────────
        const cacaInsults = [
          `😂 MORT PAR UN CACA ! Quelle honte totale, pauvre nul...`,
          `💩 T'as été éliminé par du CACA ! Rentre chez toi stp 😭`,
          `🤣 Sérieusement... mort par un caca ? T'es une blague vivante !`,
          `😤 Même un tas de caca est plus fort que toi, pathétique !`,
          `💩 LOL mort par du caca ! Va prendre une douche et réessaie 😂`,
          `🤢 Caca > toi. C'est dit. C'est validé. T'es une légende du bas.`,
        ];
        const killedByCaca = atk.weapon === 'caca';
        const cacaMsg = killedByCaca
          ? `\n\n💩 *LE BOT INTERVIENT :*\n@${defTag.wa} : _«${cacaInsults[Math.floor(Math.random() * cacaInsults.length)]}»_`
          : '';

        await sock.sendMessage(extra.from, {
          text:
            `💀 *KILL CONFIRMÉ !*\n` +
            `${'═'.repeat(28)}\n\n` +
            `${combatLog}\n` +
            `💥 Dégâts infligés : *${totalDmg}*\n\n` +
            `@${atkTag.wa} 『 *${atkTag.gn}* 』 a tué @${defTag.wa} 『 *${defTag.gn}* 』 !\n\n` +
            `💀 ${def.username} est mort(e) pendant *${duration}*\n` +
            `💰 Butin : *+${loot} 🪙* pour ${atk.username}` +
            cacaMsg +
            `\n\n_@${defTag.wa} : tape .revive si tu as le pouvoir, ou demande à quelqu'un !_\n` +
            `_Pendant ta mort tu peux uniquement : .balance .gprofile .gprofil .me .levels .pvprank_`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      } else {
        // GameXP même sans kill
        np.addGameXp(extra.sender, 15);
        np.addGameXp(targetId, 5);
        np.recordCrime(extra.sender, targetId, 'attack');

        await sock.sendMessage(extra.from, {
          text:
            `⚔️ *ATTAQUE !*\n` +
            `${'═'.repeat(28)}\n\n` +
            `${combatLog}\n` +
            `💥 Dégâts : *${totalDmg}*\n\n` +
            `❤️ HP de *${def.username}* : *${dmgResult.newHp}/${def.maxHp}*\n` +
            `${np.hpBar(dmgResult.newHp, def.maxHp)}\n\n` +
            `_${def.username} survit... pour l'instant !_`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
