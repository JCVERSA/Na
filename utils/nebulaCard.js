/**
 * nebulaCard.js — Generateur de cartes SVG/sharp Nebula Bot v2.1
 * ZERO emoji dans le SVG — tout remplace par des icones SVG pures
 * Bugs fixes: item.id undefined, stats gprofile vides, icons shop
 * Nebula Bot by Dark Neon
 */

'use strict';

const sharp = require('sharp');
const axios = require('axios');
const { getItemArtSVG } = require('./itemArt');

const W = 900;

const C = {
  bg1:    '#08081a', bg2: '#0d0d2b', panel: '#12122e',
  border: '#252548', violet: '#7c3aed', cyan: '#06b6d4',
  gold:   '#f59e0b', green: '#10b981', danger: '#ef4444',
  orange: '#f97316', white: '#ffffff', purple: '#a78bfa',
  gray:   '#6b7280', gray2: '#4b5563',
};

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function trunc(s, max) { s = String(s||''); return s.length > max ? s.slice(0,max-1)+'\u2026' : s; }
function fmt(n) { if (n===undefined||n===null) return '0'; return Number(n).toLocaleString('fr-FR'); }
function getRarityColor(p) { if(p>=10000)return C.gold; if(p>=4000)return C.cyan; if(p>=1000)return C.violet; return C.green; }
function divider(x1,y,x2,col=C.border,op=0.6){ return '<line x1="'+x1+'" y1="'+y+'" x2="'+x2+'" y2="'+y+'" stroke="'+col+'" stroke-width="1" opacity="'+op+'"/>'; }
function panel(x,y,w,h,bc=C.violet,op=0.8){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="14" fill="'+C.panel+'" stroke="'+bc+'" stroke-width="1.2" opacity="'+op+'"/>'; }

// Icones SVG pures — remplacent tous les emojis
const I = {
  coin:(x,y,s=18)=>`<circle cx="${x+s/2}" cy="${y+s/2}" r="${s/2}" fill="${C.gold}"/><circle cx="${x+s/2}" cy="${y+s/2}" r="${s/2-2}" fill="none" stroke="#92400e" stroke-width="1.5"/><text x="${x+s/2}" y="${y+s/2+s*0.22}" font-family="Arial" font-size="${s*0.55}" font-weight="bold" fill="#78350f" text-anchor="middle">N</text>`,
  heart:(x,y,s=16,col=C.green)=>`<path d="M ${x+s/2} ${y+s*0.82} Q ${x} ${y+s*0.5} ${x} ${y+s*0.32} A ${s*0.26} ${s*0.26} 0 0 1 ${x+s/2} ${y+s*0.42} A ${s*0.26} ${s*0.26} 0 0 1 ${x+s} ${y+s*0.32} Q ${x+s} ${y+s*0.5} ${x+s/2} ${y+s*0.82} Z" fill="${col}"/>`,
  sword:(x,y,s=16)=>`<rect x="${x+s/2-1.5}" y="${y}" width="3" height="${s*0.68}" rx="1" fill="${C.gray}"/><rect x="${x+s*0.18}" y="${y+s*0.6}" width="${s*0.64}" height="2.5" rx="1" fill="#6b7280"/><rect x="${x+s/2-2}" y="${y+s*0.69}" width="4" height="${s*0.31}" rx="1" fill="#78350f"/>`,
  shield:(x,y,s=16)=>`<path d="M ${x+s/2} ${y+s} Q ${x} ${y+s*0.7} ${x} ${y+s*0.2} L ${x+s} ${y+s*0.2} Q ${x+s} ${y+s*0.7} ${x+s/2} ${y+s} Z" fill="${C.cyan}" opacity="0.85"/><path d="M ${x+s/2} ${y+s*0.45} L ${x+s*0.35} ${y+s*0.65} L ${x+s*0.65} ${y+s*0.65} Z" fill="white" opacity="0.7"/>`,
  check:(x,y,s=18)=>`<circle cx="${x+s/2}" cy="${y+s/2}" r="${s/2}" fill="${C.green}"/><path d="M ${x+s*0.25} ${y+s*0.5} L ${x+s*0.45} ${y+s*0.7} L ${x+s*0.75} ${y+s*0.28}" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  skull:(x,y,s=16)=>`<ellipse cx="${x+s/2}" cy="${y+s*0.42}" rx="${s*0.4}" ry="${s*0.38}" fill="${C.danger}"/><rect x="${x+s*0.2}" y="${y+s*0.72}" width="${s*0.6}" height="${s*0.22}" rx="2" fill="${C.danger}"/><circle cx="${x+s*0.35}" cy="${y+s*0.42}" r="${s*0.1}" fill="${C.bg1}"/><circle cx="${x+s*0.65}" cy="${y+s*0.42}" r="${s*0.1}" fill="${C.bg1}"/>`,
  chest:(x,y,s=18)=>`<rect x="${x+2}" y="${y+s*0.35}" width="${s-4}" height="${s*0.6}" rx="3" fill="${C.gold}" opacity="0.9"/><rect x="${x+2}" y="${y+s*0.15}" width="${s-4}" height="${s*0.22}" rx="3" fill="${C.gold}"/><polygon points="${x+s/2},${y+s*0.05} ${x+2},${y+s*0.32} ${x+s-2},${y+s*0.32}" fill="${C.gold}"/><rect x="${x+2}" y="${y+s*0.35}" width="${s-4}" height="3" fill="#92400e"/><rect x="${x+s*0.35}" y="${y+s*0.48}" width="${s*0.3}" height="${s*0.22}" rx="2" fill="#78350f"/>`,
  fire:(x,y,s=16)=>`<path d="M ${x+s/2} ${y+s} Q ${x+s*0.1} ${y+s*0.68} ${x+s*0.22} ${y+s*0.4} Q ${x+s*0.32} ${y+s*0.58} ${x+s*0.4} ${y+s*0.48} Q ${x+s*0.3} ${y+s*0.2} ${x+s/2} ${y} Q ${x+s*0.62} ${y+s*0.3} ${x+s*0.65} ${y+s*0.5} Q ${x+s*0.75} ${y+s*0.4} ${x+s*0.8} ${y+s*0.62} Q ${x+s*0.9} ${y+s*0.7} ${x+s/2} ${y+s} Z" fill="${C.orange}"/><path d="M ${x+s/2} ${y+s*0.88} Q ${x+s*0.35} ${y+s*0.72} ${x+s*0.42} ${y+s*0.6} Q ${x+s/2} ${y+s*0.7} ${x+s*0.58} ${y+s*0.6} Q ${x+s*0.65} ${y+s*0.72} ${x+s/2} ${y+s*0.88} Z" fill="${C.gold}" opacity="0.8"/>`,
  bank:(x,y,s=18)=>`<rect x="${x+2}" y="${y+s*0.5}" width="${s-4}" height="${s*0.42}" rx="1" fill="${C.cyan}" opacity="0.7"/><rect x="${x+s*0.1}" y="${y+s*0.28}" width="${s*0.8}" height="${s*0.24}" rx="1" fill="${C.cyan}"/><polygon points="${x+s/2},${y+s*0.05} ${x+2},${y+s*0.3} ${x+s-2},${y+s*0.3}" fill="${C.cyan}"/><rect x="${x+s*0.28}" y="${y+s*0.54}" width="${s*0.16}" height="${s*0.33}" rx="1" fill="${C.bg1}" opacity="0.7"/><rect x="${x+s*0.56}" y="${y+s*0.54}" width="${s*0.16}" height="${s*0.33}" rx="1" fill="${C.bg1}" opacity="0.7"/>`,
  trophy:(x,y,s=16)=>`<path d="M ${x+s*0.2} ${y+s*0.1} L ${x+s*0.8} ${y+s*0.1} L ${x+s*0.8} ${y+s*0.5} Q ${x+s*0.8} ${y+s*0.8} ${x+s/2} ${y+s*0.8} Q ${x+s*0.2} ${y+s*0.8} ${x+s*0.2} ${y+s*0.5} Z" fill="${C.gold}"/><path d="M ${x+s*0.2} ${y+s*0.15} Q ${x} ${y+s*0.15} ${x} ${y+s*0.4} Q ${x} ${y+s*0.6} ${x+s*0.25} ${y+s*0.5}" fill="none" stroke="${C.gold}" stroke-width="3"/><path d="M ${x+s*0.8} ${y+s*0.15} Q ${x+s} ${y+s*0.15} ${x+s} ${y+s*0.4} Q ${x+s} ${y+s*0.6} ${x+s*0.75} ${y+s*0.5}" fill="none" stroke="${C.gold}" stroke-width="3"/><rect x="${x+s*0.38}" y="${y+s*0.8}" width="${s*0.24}" height="${s*0.12}" rx="1" fill="${C.gold}"/><rect x="${x+s*0.22}" y="${y+s*0.9}" width="${s*0.56}" height="${s*0.1}" rx="2" fill="${C.gold}"/>`,
  star:(x,y,s=16,col=C.gold)=>{ const cx=x+s/2,cy=y+s/2,r1=s*0.46,r2=s*0.19; const pts=Array.from({length:10},(_,i)=>{ const a=(i*Math.PI/5)-Math.PI/2; const r=i%2===0?r1:r2; return (cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1); }).join(' '); return '<polygon points="'+pts+'" fill="'+col+'"/>'; },
  diamond:(x,y,s=16)=>`<polygon points="${x+s/2},${y} ${x+s},${y+s*0.4} ${x+s/2},${y+s} ${x},${y+s*0.4}" fill="${C.purple}"/><polygon points="${x+s/2},${y} ${x+s},${y+s*0.4} ${x+s/2},${y+s*0.45}" fill="white" opacity="0.2"/>`,
  xp:(x,y,s=16)=>`<circle cx="${x+s/2}" cy="${y+s/2}" r="${s/2}" fill="none" stroke="${C.violet}" stroke-width="2.5"/><text x="${x+s/2}" y="${y+s/2+s*0.22}" font-family="Arial" font-size="${s*0.5}" font-weight="bold" fill="${C.purple}" text-anchor="middle">XP</text>`,
  arrowUp:(x,y,s=14,col=C.green)=>`<polygon points="${x+s/2},${y} ${x+s},${y+s*0.55} ${x+s*0.65},${y+s*0.55} ${x+s*0.65},${y+s} ${x+s*0.35},${y+s} ${x+s*0.35},${y+s*0.55} ${x},${y+s*0.55}" fill="${col}"/>`,
  armor:(x,y,s=36)=>`<path d="M ${x+s/2} ${y+s} Q ${x} ${y+s*0.72} ${x} ${y+s*0.22} L ${x+s} ${y+s*0.22} Q ${x+s} ${y+s*0.72} ${x+s/2} ${y+s} Z" fill="${C.cyan}" opacity="0.75"/><path d="M ${x+s/2} ${y+s*0.75} L ${x+s*0.35} ${y+s*0.55} L ${x+s*0.65} ${y+s*0.55} Z" fill="white" opacity="0.6"/>`,
  shop:(x,y,s=20)=>`<rect x="${x+s*0.1}" y="${y+s*0.32}" width="${s*0.8}" height="${s*0.58}" rx="3" fill="${C.violet}" opacity="0.85"/><path d="M ${x+s*0.1} ${y+s*0.32} L ${x+s*0.25} ${y+s*0.1} L ${x+s*0.75} ${y+s*0.1} L ${x+s*0.9} ${y+s*0.32}" fill="none" stroke="${C.violet}" stroke-width="2.5"/><circle cx="${x+s*0.35}" cy="${y+s*0.95}" r="${s*0.08}" fill="white"/><circle cx="${x+s*0.65}" cy="${y+s*0.95}" r="${s*0.08}" fill="white"/>`,
};

function baseSVG(w,h) {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${C.bg1}"/>
      <stop offset="100%" stop-color="${C.bg2}"/>
    </linearGradient>
    <linearGradient id="xpGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.violet}"/>
      <stop offset="100%" stop-color="${C.purple}"/>
    </linearGradient>
    <linearGradient id="hpGreen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.green}"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
    <linearGradient id="hpOrange" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.orange}"/>
      <stop offset="100%" stop-color="${C.gold}"/>
    </linearGradient>
    <linearGradient id="hpRed" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.danger}"/>
      <stop offset="100%" stop-color="#f87171"/>
    </linearGradient>
    <clipPath id="card"><rect width="${w}" height="${h}" rx="20" ry="20"/></clipPath>
    <filter id="glowGold">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feFlood flood-color="${C.gold}" flood-opacity="0.4" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" clip-path="url(#card)"/>
  <rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="19.5" fill="none" stroke="${C.border}" stroke-width="1.5" opacity="0.8"/>`;
}

function getPlaceholderSVG(seed, size=200) {
  const s = Math.abs(parseInt(seed)||0)%5;
  const col = [C.violet,C.cyan,C.purple,C.green,C.orange][s];
  const shapes = [
    `<circle cx="${size/2}" cy="${size/2}" r="${size*0.35}" fill="none" stroke="${col}" stroke-width="${size*0.06}"/><circle cx="${size/2}" cy="${size/2}" r="${size*0.15}" fill="${col}"/>`,
    `<rect x="${size*0.15}" y="${size*0.15}" width="${size*0.7}" height="${size*0.7}" transform="rotate(45 ${size/2} ${size/2})" fill="none" stroke="${col}" stroke-width="${size*0.06}"/>`,
    `<polygon points="${size/2},${size*0.12} ${size*0.88},${size*0.75} ${size*0.12},${size*0.75}" fill="none" stroke="${col}" stroke-width="${size*0.06}"/><circle cx="${size/2}" cy="${size*0.55}" r="${size*0.1}" fill="${col}"/>`,
    `<polygon points="${size/2},${size*0.1} ${size*0.9},${size*0.4} ${size*0.9},${size*0.7} ${size/2},${size*0.95} ${size*0.1},${size*0.7} ${size*0.1},${size*0.4}" fill="none" stroke="${col}" stroke-width="${size*0.05}"/>`,
    `<rect x="${size*0.1}" y="${size*0.1}" width="${size*0.8}" height="${size*0.8}" rx="${size*0.1}" fill="none" stroke="${col}" stroke-width="${size*0.05}"/>`,
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${C.bg1}"/>${shapes[s]}</svg>`;
}

async function fetchAvatar(sock, userId) {
  try {
    const url = await sock.profilePictureUrl(userId, 'image');
    const res = await axios.get(url, { responseType:'arraybuffer', timeout:8000 });
    return Buffer.from(res.data);
  } catch { return null; }
}

async function processAvatar(buf, size, seed=0, circle=true) {
  const input = buf || Buffer.from(getPlaceholderSVG(seed, size));
  const rx = circle ? size/2 : Math.round(size*0.15);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="white"/></svg>`);
  return sharp(input).resize(size,size,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
}

// ── 1. BALANCE ─────────────────────────────────────────────────────────────────
async function generateBalanceCard(sock, user, targetId, extraData) {
  const { name, title, rank, xpReq, streakEmoji } = extraData;
  const H = 480;
  const av = await processAvatar(await fetchAvatar(sock, targetId), 110, parseInt(targetId)||0, true);
  const xpPct = Math.min(100, Math.max(0, (user.xp/xpReq)*100));
  const total = (user.coins||0)+(user.bank||0);
  const inv = (user.inventory||[]).filter(i=>(!i.expiresAt||Date.now()<i.expiresAt)&&(i.uses===null||i.uses>0));
  const streak = user.streak||0;
  const sc = streak>=30?C.gold:streak>=7?C.orange:streak>=3?C.green:C.gray;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    <rect x="0" y="0" width="5" height="${H}" fill="${C.violet}" clip-path="url(#card)"/>
    <text x="200" y="70" font-family="Arial" font-size="34" font-weight="bold" fill="${C.white}">${esc(trunc(name,20))}</text>
    <text x="200" y="102" font-family="Arial" font-size="20" fill="${C.purple}">${esc(title)}</text>
    ${divider(55,135,845,C.border,0.5)}
    ${panel(55,155,245,110,C.violet)}
    <text x="75" y="188" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">PORTEFEUILLE</text>
    ${I.coin(75,196,22)}<text x="103" y="218" font-family="Arial" font-size="26" font-weight="bold" fill="${C.white}">${fmt(user.coins)}</text>
    ${panel(315,155,245,110,C.cyan)}
    <text x="335" y="188" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">BANQUE</text>
    ${I.bank(335,196,22)}<text x="363" y="218" font-family="Arial" font-size="26" font-weight="bold" fill="${C.white}">${fmt(user.bank)}</text>
    ${panel(575,155,270,110,C.purple)}
    <text x="595" y="188" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">FORTUNE TOTALE</text>
    ${I.diamond(595,196,20)}<text x="621" y="218" font-family="Arial" font-size="26" font-weight="bold" fill="${C.purple}">${fmt(total)}</text>
    <text x="55" y="302" font-family="Arial" font-size="14" fill="${C.gray}" letter-spacing="2">NIVEAU ${user.level}</text>
    <text x="845" y="302" text-anchor="end" font-family="Arial" font-size="14" fill="${C.gray}">RANG ${rank}</text>
    <rect x="55" y="312" width="790" height="16" rx="8" fill="${C.panel}" stroke="${C.border}" stroke-width="1"/>
    <rect x="55" y="312" width="${(790*xpPct)/100}" height="16" rx="8" fill="url(#xpGrad)"/>
    ${xpPct>2?`<circle cx="${55+(790*xpPct)/100}" cy="320" r="8" fill="${C.purple}" opacity="0.4"/>`:''}
    <text x="55" y="348" font-family="Arial" font-size="14" fill="${C.gray}">XP: ${fmt(user.xp)} / ${fmt(xpReq)}</text>
    <text x="845" y="348" text-anchor="end" font-family="Arial" font-size="14" fill="${C.purple}">${Math.round(xpPct)}%</text>
    ${divider(55,372,845,C.border,0.4)}
    ${I.fire(55,390,20)}<text x="82" y="408" font-family="Arial" font-size="16" fill="${sc}" font-weight="bold">Streak: ${streak} j</text>
    ${I.arrowUp(290,393,15)}<text x="312" y="408" font-family="Arial" font-size="15" fill="${C.gray}">Total: ${fmt(user.totalEarned)}</text>
    ${I.coin(520,393,16)}
    ${I.chest(680,390,20)}<text x="706" y="408" font-family="Arial" font-size="15" fill="${C.purple}" font-weight="bold">${inv.length} Items Actifs</text>
    ${divider(55,430,845,C.border,0.2)}
    <text x="845" y="462" text-anchor="end" font-family="Arial" font-size="12" fill="${C.gray2}">Nebula Bot — Dark Neon</text>
  </svg>`;
  return sharp(Buffer.from(svg)).composite([{input:av,top:30,left:60}]).png().toBuffer();
}

// ── 2. GPROFILE ────────────────────────────────────────────────────────────────
async function generateGProfileCard(sock, player, ecoUser, targetId, extraData) {
  const { name, alive, rankName, kdr, weapon, armor, powers } = extraData;
  const H = 500;
  const av = await processAvatar(await fetchAvatar(sock, targetId), 155, parseInt(targetId)||0, false);
  const hpPct = Math.min(100,Math.max(0,(player.hp/player.maxHp)*100));
  const hpGrad = hpPct>50?'url(#hpGreen)':hpPct>20?'url(#hpOrange)':'url(#hpRed)';
  const sc = alive?C.green:C.danger;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    <rect x="0" y="0" width="5" height="${H}" fill="${sc}" clip-path="url(#card)"/>
    <text x="55" y="68" font-family="Arial" font-size="36" font-weight="bold" fill="${C.white}">${esc(trunc(player.username||name,16))}</text>
    ${I.sword(55,75,16)}<text x="78" y="93" font-family="Arial" font-size="19" fill="${C.cyan}">${esc(rankName)}</text>
    ${divider(55,115,845,C.border,0.4)}
    ${alive?I.heart(55,133,22,C.green):I.skull(55,133,22)}
    <text x="85" y="152" font-family="Arial" font-size="22" font-weight="bold" fill="${sc}">${alive?'EN VIE':'MORT'}</text>
    <text x="510" y="152" text-anchor="end" font-family="Arial" font-size="18" fill="${C.white}">${player.hp} / ${player.maxHp} HP</text>
    <rect x="55" y="162" width="480" height="18" rx="9" fill="${C.panel}" stroke="${C.border}" stroke-width="1"/>
    <rect x="55" y="162" width="${(480*hpPct)/100}" height="18" rx="9" fill="${hpGrad}"/>
    ${panel(55,200,215,90,C.violet,0.7)}
    <text x="75" y="225" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">KILLS</text>
    <text x="75" y="278" font-family="Arial" font-size="30" font-weight="bold" fill="${C.white}">${fmt(player.killCount)}</text>
    ${panel(285,200,215,90,C.danger,0.7)}
    <text x="305" y="225" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">DEATHS</text>
    <text x="305" y="278" font-family="Arial" font-size="30" font-weight="bold" fill="${C.white}">${fmt(player.deathCount)}</text>
    ${panel(55,305,215,90,C.cyan,0.7)}
    <text x="75" y="330" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">K/D RATIO</text>
    <text x="75" y="383" font-family="Arial" font-size="30" font-weight="bold" fill="${C.cyan}">${kdr}</text>
    ${panel(285,305,215,90,C.orange,0.7)}
    <text x="305" y="330" font-family="Arial" font-size="12" fill="${C.gray}" letter-spacing="1">DMG INFLIGES</text>
    <text x="305" y="383" font-family="Arial" font-size="30" font-weight="bold" fill="${C.orange}">${fmt(player.totalDmgDealt||0)}</text>
    <line x1="555" y1="130" x2="555" y2="430" stroke="${C.border}" stroke-width="1" opacity="0.4"/>
    <text x="575" y="160" font-family="Arial" font-size="17" font-weight="bold" fill="${C.purple}">EQUIPEMENT</text>
    ${I.sword(575,168,15)}<text x="596" y="183" font-family="Arial" font-size="14" fill="${C.gray}">Arme</text>
    <text x="575" y="208" font-family="Arial" font-size="16" fill="${C.white}">${esc(weapon||'Mains nues')}</text>
    ${I.shield(575,218,15)}<text x="596" y="233" font-family="Arial" font-size="14" fill="${C.gray}">Armure</text>
    <text x="575" y="258" font-family="Arial" font-size="16" fill="${C.white}">${esc(armor||'Aucune')}</text>
    ${divider(575,275,845,C.border,0.4)}
    <text x="575" y="300" font-family="Arial" font-size="17" font-weight="bold" fill="${C.cyan}">POUVOIRS</text>
    <text x="575" y="325" font-family="Arial" font-size="14" fill="${C.gray}">${esc(trunc(powers||'Aucun',42))}</text>
    <rect x="675" y="33" width="170" height="170" rx="20" fill="none" stroke="${C.cyan}" stroke-width="3"/>
    ${divider(55,430,845,C.border,0.4)}
    ${player.marriedTo?I.heart(55,442,16,C.purple):''}
    <text x="${player.marriedTo?78:55}" y="456" font-family="Arial" font-size="15" fill="${C.gray}">${player.marriedTo?esc('Marie: '+(player.spouseName||'?')):'Celibataire'}</text>
    ${I.coin(730,442,18)}<text x="845" y="456" text-anchor="end" font-family="Arial" font-size="15" fill="${C.gray}">Solde: ${fmt(ecoUser.coins)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).composite([{input:av,top:38,left:678}]).png().toBuffer();
}

// ── 3. GAIN CARD ──────────────────────────────────────────────────────────────
async function generateGainCard(extraData) {
  const { title, subtitle, color=C.green, amount, xp, balance } = extraData;
  const H = 420;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    <rect x="0" y="0" width="${W}" height="6" fill="${color}" clip-path="url(#card)"/>
    <text x="${W/2}" y="76" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="${C.white}" letter-spacing="3">${esc(title)}</text>
    <text x="${W/2}" y="110" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.gray}">${esc(subtitle)}</text>
    <line x1="100" y1="130" x2="800" y2="130" stroke="${color}" stroke-width="1" opacity="0.3"/>
    <text x="${W/2}" y="248" text-anchor="middle" font-family="Arial" font-size="78" font-weight="bold" fill="${color}">+${fmt(amount)}</text>
    ${I.coin(W/2+fmt(amount).length*25,195,28)}
    <rect x="${W/2-85}" y="268" width="170" height="36" rx="18" fill="${C.panel}" stroke="${C.violet}" stroke-width="1.5"/>
    ${I.xp(W/2-68,276,22)}<text x="${W/2+12}" y="292" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="${C.purple}">+${fmt(xp)} XP</text>
    <line x1="100" y1="330" x2="800" y2="330" stroke="${C.border}" stroke-width="1" opacity="0.3"/>
    <text x="${W/2}" y="368" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.gray}">Nouveau solde :</text>
    ${I.coin(W/2-15,377,22)}<text x="${W/2+14}" y="395" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold" fill="${C.white}">${fmt(balance)}</text>
    <text x="${W-25}" y="${H-12}" text-anchor="end" font-family="Arial" font-size="11" fill="${C.gray2}">Nebula Bot — Dark Neon</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── 4. SHOP MENU PRINCIPAL ─────────────────────────────────────────────────────
async function generateShopMainMenu(categories, userBalance) {
  const H = 375;
  const catIconFn = {
    eco:     (x,y)=>I.coin(x,y,36),
    defense: (x,y)=>I.shield(x,y,36),
    weapon:  (x,y)=>I.sword(x,y,36),
    armor:   (x,y)=>I.armor(x,y,36),
    power:   (x,y)=>I.star(x,y,36,C.gold),
  };
  const entries = Object.entries(categories);
  const cW = 148, gap = 12;
  const total = entries.length*cW+(entries.length-1)*gap;
  const sx = (W-total)/2;
  let cards = '';
  entries.forEach(([key,cat],i)=>{
    const x=sx+i*(cW+gap), y=125;
    const iconFn = catIconFn[key] || ((x2,y2)=>I.star(x2,y2,36));
    cards+=`<rect x="${x}" y="${y}" width="${cW}" height="188" rx="14" fill="${C.panel}" stroke="${C.violet}" stroke-width="1.2" opacity="0.9"/>
    <g transform="translate(${x+cW/2-18},${y+22})">${iconFn(0,0)}</g>
    <text x="${x+cW/2}" y="${y+90}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="${C.white}" letter-spacing="1">${esc(cat.label.split(' ')[0])}</text>
    <text x="${x+cW/2}" y="${y+112}" text-anchor="middle" font-family="Arial" font-size="12" fill="${C.gray}">${cat.count} items</text>
    <rect x="${x+24}" y="${y+138}" width="${cW-48}" height="28" rx="8" fill="${C.violet}"/>
    <text x="${x+cW/2}" y="${y+157}" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="white">VOIR</text>`;
  });
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    ${I.shop(50,25,44)}<text x="108" y="68" font-family="Arial" font-size="40" font-weight="bold" fill="${C.white}" letter-spacing="2">NEBULA SHOP</text>
    ${I.coin(710,44,22)}<text x="845" y="65" text-anchor="end" font-family="Arial" font-size="20" fill="${C.cyan}">Solde: ${fmt(userBalance)}</text>
    ${divider(50,100,850,C.border,0.5)}
    ${cards}
    <text x="${W/2}" y="${H-18}" text-anchor="middle" font-family="Arial" font-size="13" fill="${C.gray}">Utilise .shop &lt;categorie&gt; pour parcourir le catalogue</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── 5. SHOP CATEGORIE ──────────────────────────────────────────────────────────
async function generateShopCategoryCard(catName, items, userBalance) {
  const iW=162, iH=215, cols=5;
  const rows=Math.ceil(items.length/cols);
  const H=Math.max(660,160+rows*(iH+14)+50);
  let iSvg=''; const comps=[];
  for(let i=0;i<items.length;i++){
    const item=items[i];
    const r=Math.floor(i/cols), c=i%cols;
    const x=30+c*(iW+13), y=155+r*(iH+14);
    const rc=getRarityColor(item.price);
    const isL=item.price>=10000;
    let sv='', sc=C.gray;
    if(item.category==='weapon'){try{const np=require('./neonparty');sv=`+${np.WEAPON_STATS?.[item.weaponId]?.atk||0} ATK`;sc=C.danger;}catch{sv='ATK';sc=C.danger;}}
    else if(item.category==='armor'){try{const np=require('./neonparty');sv=`-${np.ARMOR_STATS?.[item.armorId]?.def||0} DMG`;sc=C.cyan;}catch{sv='DEF';sc=C.cyan;}}
    else if(item.duration){try{sv=require('./economy').formatTime(item.duration);}catch{sv='';}sc=C.purple;}
    else if(item.uses){sv=`${item.uses} chg`;sc=C.green;}
    iSvg+=`<g transform="translate(${x},${y})">
      <rect width="${iW}" height="${iH}" rx="13" fill="#13132f" stroke="${rc}" stroke-width="${isL?2:1.2}" ${isL?'filter="url(#glowGold)"':''}/>
      ${sv?`<text x="${iW-8}" y="20" text-anchor="end" font-family="Arial" font-size="12" font-weight="bold" fill="${sc}">${esc(sv)}</text>`:''}
      <text x="${iW/2}" y="${iH-46}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="${C.white}">${esc(trunc(item.name||item.id,16))}</text>
      <g transform="translate(${iW/2-38},${iH-35})">${I.coin(0,0,16)}<text x="21" y="13" font-family="Arial" font-size="14" font-weight="bold" fill="${C.cyan}">${fmt(item.price)}</text></g>
      <text x="${iW/2}" y="${iH-8}" text-anchor="middle" font-family="Arial" font-size="10" fill="${C.gray2}">.buy ${item.id}</text>
    </g>`;
    const ak=item.weaponId||item.armorId||item.powerId||item.id;
    const as=`<svg width="142" height="130" viewBox="0 0 150 130" xmlns="http://www.w3.org/2000/svg">${getItemArtSVG(ak,150,130)}</svg>`;
    comps.push({input:await sharp(Buffer.from(as)).png().toBuffer(),top:y+10,left:x+10});
  }
  const svg=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    <rect x="0" y="0" width="5" height="${H}" fill="${C.violet}" clip-path="url(#card)"/>
    <text x="55" y="66" font-family="Arial" font-size="38" font-weight="bold" fill="${C.white}" letter-spacing="2">${esc(catName.toUpperCase())}</text>
    ${I.coin(55,80,20)}<text x="81" y="97" font-family="Arial" font-size="17" fill="${C.cyan}">Ton solde : ${fmt(userBalance)}</text>
    ${divider(55,128,845,C.border,0.5)}
    ${iSvg}
    ${divider(30,H-38,870,C.border,0.3)}
    <text x="${W/2}" y="${H-14}" text-anchor="middle" font-family="Arial" font-size="13" fill="${C.gray}">Tape .buy &lt;nom&gt; pour acheter un item</text>
  </svg>`;
  return sharp(Buffer.from(svg)).composite(comps).png().toBuffer();
}

// ── 6. BUY CARD ───────────────────────────────────────────────────────────────
async function generateBuyCard(item, userBalance, itemId) {
  // FIX: itemId passe en parametre obligatoire
  const id = itemId || item.id || '';
  const size=420;
  const rc=getRarityColor(item.price||0);
  const isL=(item.price||0)>=10000;
  let sl='';
  if(item.category==='weapon'){try{const np=require('./neonparty');sl=`+${np.WEAPON_STATS?.[item.weaponId]?.atk||0} ATK`;}catch{sl='ATK';}}
  else if(item.category==='armor'){try{const np=require('./neonparty');sl=`-${np.ARMOR_STATS?.[item.armorId]?.def||0} DMG`;}catch{sl='DEF';}}
  if(item.uses) sl+=(sl?'  •  ':'')+`${item.uses} charges`;
  const auto=item.category==='power'||item.category==='eco';
  const tip=auto?'Active automatiquement !':(id?`Tape .equip ${id}`:'Equipe dans ton inventaire');
  const svg=`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(size,size)}
    <rect x="0.5" y="0.5" width="${size-1}" height="${size-1}" rx="19.5" fill="none" stroke="${rc}" stroke-width="${isL?3:2}" ${isL?'filter="url(#glowGold)"':''}/>
    ${I.check(28,20,24)}<text x="62" y="42" font-family="Arial" font-size="21" font-weight="bold" fill="${C.green}" letter-spacing="1">ACHAT CONFIRME</text>
    <line x1="28" y1="57" x2="${size-28}" y2="57" stroke="${C.border}" stroke-width="1" opacity="0.5"/>
    <line x1="28" y1="283" x2="${size-28}" y2="283" stroke="${C.border}" stroke-width="1" opacity="0.4"/>
    <text x="${size/2}" y="313" text-anchor="middle" font-family="Arial" font-size="23" font-weight="bold" fill="${C.white}">${esc(item.name||id)}</text>
    <text x="${size/2}" y="340" text-anchor="middle" font-family="Arial" font-size="15" fill="${C.purple}">${esc(sl)}</text>
    ${I.coin(28,352,16)}<text x="50" y="368" font-family="Arial" font-size="14" fill="${C.danger}">-${fmt(item.price)}</text>
    ${I.coin(200,352,16)}<text x="222" y="368" font-family="Arial" font-size="14" fill="${C.gray}">Solde: ${fmt(userBalance)}</text>
    <rect x="28" y="${size-50}" width="${size-56}" height="28" rx="8" fill="${C.panel}" stroke="${C.border}" stroke-width="1"/>
    <text x="${size/2}" y="${size-31}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="${C.cyan}">${esc(tip)}</text>
  </svg>`;
  const ak=item.weaponId||item.armorId||item.powerId||id;
  const as=`<svg width="200" height="200" viewBox="0 0 150 160" xmlns="http://www.w3.org/2000/svg">${getItemArtSVG(ak,150,160)}</svg>`;
  return sharp(Buffer.from(svg)).composite([{input:await sharp(Buffer.from(as)).png().toBuffer(),top:68,left:110}]).png().toBuffer();
}

// ── 7. INVENTAIRE ─────────────────────────────────────────────────────────────
async function generateInventoryCard(sock, user, targetId, extraData) {
  const { name, rank, level } = extraData;
  const av=await processAvatar(await fetchAvatar(sock,targetId),80,parseInt(targetId)||0,true);
  const now=Date.now();
  const inv=(user.inventory||[]).filter(i=>(!i.expiresAt||now<i.expiresAt)&&(i.uses===null||i.uses>0));
  const iW=158,iH=195,cols=4;
  const rows=Math.ceil(inv.length/cols)||1;
  const H=Math.max(475,175+rows*(iH+14)+50);
  let iSvg=''; const comps=[{input:av,top:38,left:55}];
  if(inv.length===0){
    iSvg=`<text x="${W/2}" y="290" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.gray}">Ton coffre est vide...</text>
    <text x="${W/2}" y="330" text-anchor="middle" font-family="Arial" font-size="17" fill="${C.violet}">Fais un tour au .shop !</text>`;
  } else {
    for(let i=0;i<inv.length;i++){
      const item=inv[i];
      const eco=require('./economy');
      const si=eco.SHOP_ITEMS?.[item.id]||{};
      const r=Math.floor(i/cols),c=i%cols;
      const x=30+c*(iW+18),y=175+r*(iH+14);
      const rc=getRarityColor(si.price||0);
      let st='permanent',stc=C.violet;
      if(item.uses!==null&&item.uses!==undefined){st=`${item.uses} chg`;stc=C.cyan;}
      else if(item.expiresAt){const l=item.expiresAt-now;try{st=eco.formatTime(l);}catch{st='...';}stc=l<3600000?C.orange:C.green;}
      const isPerm=item.id==='vault'||si.permanent;
      iSvg+=`<g transform="translate(${x},${y})">
        <rect width="${iW}" height="${iH}" rx="13" fill="#13132f" stroke="${rc}" stroke-width="1.5" opacity="0.95"/>
        <text x="${iW/2}" y="${iH-32}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="${C.white}">${esc(trunc(item.name||item.id,15))}</text>
        <text x="${iW/2}" y="${iH-11}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="${stc}">${isPerm?'permanent':st}</text>
      </g>`;
      const ak=si.weaponId||si.armorId||si.powerId||item.id;
      const as=`<svg width="120" height="120" viewBox="0 0 150 160" xmlns="http://www.w3.org/2000/svg">${getItemArtSVG(ak,150,160)}</svg>`;
      comps.push({input:await sharp(Buffer.from(as)).png().toBuffer(),top:y+10,left:x+19});
    }
  }
  const svg=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${baseSVG(W,H)}
    <rect x="0" y="0" width="5" height="${H}" fill="${C.gold}" clip-path="url(#card)"/>
    <text x="152" y="66" font-family="Arial" font-size="28" font-weight="bold" fill="${C.white}">${esc(trunc(name,22))}</text>
    <text x="152" y="96" font-family="Arial" font-size="16" fill="${C.purple}">Niveau ${level}  •  Rang ${rank}</text>
    ${I.chest(735,36,32)}<text x="845" y="75" text-anchor="end" font-family="Arial" font-size="30" font-weight="bold" fill="${C.white}">COFFRE</text>
    ${divider(55,128,845,C.border,0.5)}
    ${iSvg}
    ${divider(30,H-42,870,C.border,0.3)}
    <text x="55" y="${H-16}" font-family="Arial" font-size="13" fill="${C.gray2}">${inv.length} item(s) actif(s)  •  Nebula Bot by Dark Neon</text>
  </svg>`;
  return sharp(Buffer.from(svg)).composite(comps).png().toBuffer();
}

module.exports={fetchAvatar,generateBalanceCard,generateGProfileCard,generateGainCard,generateShopMainMenu,generateShopCategoryCard,generateBuyCard,generateInventoryCard};
