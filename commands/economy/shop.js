/**
 * Shop Command v2 — Boutique avec cartes images par catégorie
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');
const { generateShopMainMenu, generateShopCategoryCard } = require('../../utils/nebulaCard');

module.exports = {
  name: 'shop',
  aliases: ['boutique', 'store', 'magasin'],
  category: 'economy',
  description: 'Boutique complete avec armes, armures et pouvoirs',
  usage: '.shop [categorie] | .buy <id>',

  async execute(sock, msg, args, extra) {
    try {
      const user = eco.getUser(extra.sender);
      const filter = (args[0] || '').toLowerCase();

      const categories = {
        eco:     { emoji: '💰', label: 'ÉCONOMIE' },
        defense: { emoji: '🛡️', label: 'PROTECTION' },
        weapon:  { emoji: '⚔️', label: 'ARMES' },
        armor:   { emoji: '🔰', label: 'ARMURES' },
        power:   { emoji: '✨', label: 'POUVOIRS' },
      };

      const items = eco.SHOP_ITEMS;
      const grouped = {};
      for (const [id, item] of Object.entries(items)) {
        const cat = item.category || 'eco';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ id, ...item });
      }

      if (filter && categories[filter]) {
        const catItems = grouped[filter] || [];
        const catInfo = categories[filter];
        const buffer = await generateShopCategoryCard(catInfo.label, catItems, user.coins);
        
        return await sock.sendMessage(extra.from, {
          image: buffer,
          caption: `🛒 *NEBULA SHOP* — Catégorie : *${catInfo.label}*\n\n📌 *.buy <id>* pour acheter un item`
        }, { quoted: msg });
      }

      // Menu principal
      // On compte les items par catégorie pour la carte
      const catCounts = {};
      for (const key of Object.keys(categories)) {
        catCounts[key] = {
          ...categories[key],
          count: grouped[key]?.length || 0
        };
      }

      const buffer = await generateShopMainMenu(catCounts, user.coins);

      let caption = `🛒 *BOUTIQUE NEBULA*\n${"═".repeat(20)}\n\n`;
      caption += `📌 *.shop <categorie>* pour parcourir :\n`;
      caption += Object.entries(categories).map(([k, v]) => `  • *.shop ${k}* — ${v.emoji} ${v.label}`).join("\n");
      caption += `\n\n📌 *.buy <id>* pour acheter directement`;

      await sock.sendMessage(extra.from, {
        image: buffer,
        caption: caption
      }, { quoted: msg });

    } catch(e) { 
      console.error('[SHOP CARD ERROR]', e);
      await extra.reply(`❌ Erreur: ${e.message}`); 
    }
  }
};
