/**
 * Avatar Command — Définir son avatar NeonParty
 * Nebula Bot by Dark Neon
 * .avatar 🔥       → emoji comme avatar
 * .avatar (image)  → image uploadée comme avatar
 */

const np   = require('../../utils/neonparty');
const path = require('path');
const fs   = require('fs');

const DB_PATH        = path.join(__dirname, '../../database');
const AVATARS_DIR    = path.join(DB_PATH, 'avatars');

if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

module.exports = {
  name: 'avatar',
  aliases: ['setavatar', 'pfp', 'photo'],
  category: 'economy',
  description: 'Définir ton avatar NeonParty (emoji ou image)',
  usage: '.avatar 🔥  ou  .avatar (envoyer une image)',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender))
        return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");

      const p = np.getPlayer(extra.sender);

      // ── Cas 1 : voir l'avatar actuel ────────────────────────────────────
      if (!args[0] && !msg.message?.imageMessage) {
        const current = p.avatar || null;
        if (!current) return extra.reply(`❌ Tu n'as pas encore d'avatar !\n\nTape *.avatar 🔥* (emoji) ou envoie une image avec *.avatar* en légende.`);
        const isEmoji = !current.startsWith('avatars/');
        if (isEmoji) {
          return extra.reply(`🖼️ *Ton avatar actuel :* ${current}\n\nPour changer : *.avatar <emoji>* ou envoie une image avec *.avatar* en légende.`);
        }
        // Essayer d'envoyer l'image
        const imgPath = path.join(DB_PATH, current);
        if (fs.existsSync(imgPath)) {
          const imgBuf = fs.readFileSync(imgPath);
          return await sock.sendMessage(extra.from, {
            image: imgBuf,
            caption: `🖼️ *Ton avatar NeonParty — ${p.username}*\n\nPour changer, envoie une nouvelle image avec *.avatar* en légende.`
          }, { quoted: msg });
        }
        return extra.reply(`⚠️ Avatar introuvable sur le serveur. Réinitialise avec *.avatar <emoji>*`);
      }

      // ── Cas 2 : emoji passé en argument ──────────────────────────────────
      if (args[0] && !msg.message?.imageMessage) {
        const input = args.join(' ').trim();
        // Vérifier que c'est bien un/des emoji(s) — simple heuristique
        if (input.length > 12) return extra.reply(`❌ L'emoji est trop long. Utilise 1-3 emojis max. Ex: *.avatar 🔥💀*`);
        np.updatePlayer(extra.sender, { avatar: input });
        return extra.reply(`✅ *Avatar mis à jour !*\n\n${input} — *${p.username}*\n\n_Les autres joueurs verront ton avatar sur ton .gprofile !_`);
      }

      // ── Cas 3 : image en pièce jointe ────────────────────────────────────
      const imgMsg = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      if (imgMsg) {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (!buffer || buffer.length < 100) return extra.reply(`❌ Impossible de télécharger l'image. Réessaie.`);
        if (buffer.length > 3 * 1024 * 1024) return extra.reply(`❌ Image trop lourde (max 3 Mo). Compresse-la et réessaie.`);

        const ext      = imgMsg.mimetype?.includes('png') ? 'png' : 'jpg';
        const filename = `${extra.sender.split('@')[0]}_${Date.now()}.${ext}`;
        const filepath = path.join(AVATARS_DIR, filename);
        fs.writeFileSync(filepath, buffer);

        np.updatePlayer(extra.sender, { avatar: `avatars/${filename}` });

        return await sock.sendMessage(extra.from, {
          image: buffer,
          caption:
            `✅ *Avatar enregistré !*\n\n` +
            `👤 *${p.username}*\n` +
            `_Les autres joueurs verront ton avatar sur ton .gprofile !_`
        }, { quoted: msg });
      }

      return extra.reply(`❌ Envoie une image ou un emoji.\nEx: *.avatar 🔥* ou envoie une image avec *.avatar* en légende.`);

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
