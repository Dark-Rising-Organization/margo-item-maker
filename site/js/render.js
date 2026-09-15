'use strict';

const ICON_CDN = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

// Kolejność statystyk w polu "stat" (tak jak w grze)
const STAT_ORDER = [
    'absorb', 'absorbm', 'ac', 'abdest', 'acdmg', 'act', 'adest', 'ammo', 'binds', 'blok',
    'cansplit', 'capacity', 'crit', 'critmval', 'critval', 'da', 'dmg',
    'dmgmul', 'dmgmulphysical', 'dmgmulfire', 'dmgmulfrost', 'dmgmullight', 'dmgmulpoison', 'dmgmulwound', 'dmgmulabsolute',
    'di', 'ds', 'dz', 'endest', 'energybon', 'enfatig', 'evade', 'fire', 'frost', 'heal', 'light', 'hp', 'hpbon', 'legbon',
    'lowcrit', 'lowcritallval', 'lowevade', 'lowheal2turns', 'lvl', 'manabon', 'manadest', 'manafatig', 'opis', 'pdmg',
    'permbound', 'pierce', 'poison', 'pierceb', 'rarity', 'reqp', 'resdmg', 'resfire', 'resfrost', 'reslight',
    'resmanaendest', 'sa', 'slow', 'wound',
];

const PLACEHOLDER_ICONS = {
    [ItemClass.ONEHANDED]: 'mie/placeholder.gif',
    [ItemClass.TWOHANDED]: 'mie/placeholder.gif',
    [ItemClass.ONEANDAHALFHANDED]: 'mie/placeholder.gif',
    [ItemClass.RANGED]: 'luk/placeholder.gif',
    [ItemClass.SECONDARY]: 'bro/placeholder.gif',
    [ItemClass.WAND]: 'roz/placeholder.gif',
    [ItemClass.ORB]: 'bro/placeholder.gif',
    [ItemClass.ARMOR]: 'zbr/placeholder.gif',
    [ItemClass.HELMET]: 'hel/placeholder.gif',
    [ItemClass.BOOTS]: 'but/placeholder.gif',
    [ItemClass.GLOVES]: 'rek/placeholder.gif',
    [ItemClass.RING]: 'pie/placeholder.gif',
    [ItemClass.NECKLACE]: 'nas/placeholder.gif',
    [ItemClass.SHIELD]: 'tar/placeholder.gif',
    [ItemClass.QUIVER]: 'arr/placeholder.gif',
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
const HTML_UNESCAPES = {
    '&amp;': '&', '&#38;': '&',
    '&lt;': '<', '&#60;': '<',
    '&gt;': '>', '&#62;': '>',
    '&apos;': "'", '&#39;': "'",
    '&quot;': '"', '&#34;': '"',
};

const escapeHtml = (text) => text.replace(/[&<>'"]/g, (ch) => HTML_ESCAPES[ch]);
const unescapeHtml = (text) => text.replace(/&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g, (entity) => HTML_UNESCAPES[entity]);

/**
 * Buduje obiekt przedmiotu w formacie, jaki gra przesyła do klienta.
 * @param {Object} info  dane z formularza (name, icon, cl, rarity, pr)
 * @param {Item}   item
 */
function buildGameItem(info, item) {
    const stats = [];
    const exported = item.export();
    for (const stat in exported) stats.push(`${stat}=${exported[stat]}`);

    stats.push(`rarity=${RARITY_STAT_NAME[info.rarity]}`, `lvl=${item.lvl}`);

    const profs = toCanonicalProfs(item.profs);
    if (profs.length) stats.push(`reqp=${profs}`);

    stats.sort((a, b) => STAT_ORDER.indexOf(a.split('=')[0]) - STAT_ORDER.indexOf(b.split('=')[0]));

    if (item.stats.upgrade) stats.push('enhancement_upgrade_lvl=' + item.stats.upgrade);

    return {
        id: 1,
        hid: 1,
        tpl: 1,
        name: info.name,
        own: 1,
        loc: 'g',
        icon: info.icon,
        x: 0,
        y: 0,
        cl: info.cl,
        pr: info.pr,
        prc: 'zl',
        st: 0,
        stat: stats.join(';'),
    };
}

// HTML podglądu: licznik bonusów + tooltip wygenerowany parserem z gry
function renderPreview(info, item) {
    if (info.icon.startsWith('http') || info.icon == '') {
        info.icon = ICON_CDN + PLACEHOLDER_ICONS[info.cl];
    } else {
        info.icon = ICON_CDN + info.icon;
    }

    const gameItem = buildGameItem(info, item);
    const tip = window.MargoTipsParser.getTip(gameItem).replace(
        '<div class="item-head">',
        `<div class="item-head"><div class="item"><img class="item-icon icon-rarity-${info.rarity}" src="${info.icon}"></div>`,
    );

    return `
        <div class="item-info">Nierozdane bonusy: ${item.getRemainingBonuses()}</div>
        <div data-item-type="${RARITY_STAT_NAME[info.rarity]}" data-type="t_item" class="tip-wrapper normal-tip"><div class="content">${tip}</div></div>
    `;
}
