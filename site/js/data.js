'use strict';

// =====================================================================
//  Rzadkość
// =====================================================================

const Rarity = {
    COMMON: 0,
    UNIQUE: 1,
    UPGRADED: 2,
    HEROIC: 3,
    LEGENDARY: 4,
    ARTIFACT: 5,
};

// rarity_factor ze wzoru na moc rzadkości (ulepszone liczą się jak heroiczne)
const RARITY_TIER = {
    [Rarity.COMMON]: 0,
    [Rarity.UNIQUE]: 1,
    [Rarity.HEROIC]: 2,
    [Rarity.UPGRADED]: 2,
    [Rarity.LEGENDARY]: 3,
    [Rarity.ARTIFACT]: 4,
};

// Ranga we wzorze na wartość przedmiotu (od 26.03.2026): współczynnik_rangi = 1 + ranga
// (ulepszone liczą się jak heroiczne; artefaktów ogłoszenie nie wymienia - przyjęto jak legendę)
const RARITY_VALUE = {
    [Rarity.COMMON]: 0,
    [Rarity.UNIQUE]: 1,
    [Rarity.UPGRADED]: 3,
    [Rarity.HEROIC]: 3,
    [Rarity.LEGENDARY]: 7,
    [Rarity.ARTIFACT]: 7,
};

// Nazwa rzadkości w statystykach przedmiotu (rarity=...)
const RARITY_STAT_NAME = {
    [Rarity.COMMON]: 'common',
    [Rarity.UNIQUE]: 'unique',
    [Rarity.HEROIC]: 'heroic',
    [Rarity.UPGRADED]: 'upgraded',
    [Rarity.LEGENDARY]: 'legendary',
    [Rarity.ARTIFACT]: 'artefact',
};

// =====================================================================
//  Profesje
//  w - wojownik, p - paladyn, b - tancerz ostrzy, m - mag, t - tropiciel, h - łowca
//  Klucze tabel to profesje w kanonicznej kolejności (np. "wpb").
// =====================================================================

const PROF_ORDER = ['w', 'p', 'b', 'm', 't', 'h'];

function toCanonicalProfs(profs) {
    const letters = typeof profs === 'string' ? [...new Set(profs.trim().split(''))] : profs;
    return letters.sort((a, b) => PROF_ORDER.indexOf(a) - PROF_ORDER.indexOf(b)).join('');
}

// Współczynnik pancerza (armor_factor); "reszta połączeń" = 0.125
const PROF_ARMOR_FACTOR = {
    w: 0.135, p: 0.125, b: 0.1125, m: 0.0625, t: 0.0875, h: 0.1,
    wb: 0.12375, pb: 0.11875, bt: 0.1, bh: 0.10625, wp: 0.13, pm: 0.09375, pt: 0.115, mt: 0.075, th: 0.09375,
    wpb: 0.12, wbh: 0.11625, bth: 0.1, pmt: 0.09375,
    wpbh: 0.12,
    wpbmth: 0.1125,
    '': 0.1125, // brak wymagań = wszystkie profesje
};

// Współczynnik absorpcji (absorb_factor)
const PROF_ABSORB_FACTOR = {
    m: 0.375, t: 0.25, pm: 0.1875, pt: 0.075, mt: 0.3125, pmt: 0.21,
};

// Natywna odporność na magię (%) - bez dodatku za jakość
const PROF_MAGIC_RES = {
    b: 2, p: 6, m: 10, t: 8, h: 4,
    wb: 1, pb: 4, bt: 5, bh: 3, wp: 3, pm: 8, pt: 7, mt: 9, th: 6,
    wpb: 2, wbh: 2, bth: 5, pmt: 8,
    wpbh: 3,
};

// "Magiczny rozkład profesji" - +2% odporności magicznej za każdy poziom jakości (w pozostałych +1%)
const MAGIC_PROFS = ['m', 't', 'pm', 'mt', 'pmt'];

// Natywna odporność na truciznę (%)
const PROF_POISON_RES = {
    b: 8, w: 1, t: 12, h: 16,
    wb: 5, pb: 4, bt: 10, bh: 12, wp: 1, pt: 6, mt: 6, th: 14,
    wpb: 3, wbh: 8, bth: 12, pmt: 4,
    wpbh: 6,
};

// Bonusy natywne w zbroi - wartość = lvl / dzielnik
const PROF_ARMOR_MANA_DIVISOR = { m: 3, t: 6, mt: 6, pmt: 6 }; // od poziomu 21
const PROF_ARMOR_SA_DIVISOR = { t: 400, h: 200, bt: 550, bh: 400, th: 300, bth: 400 };
const PROF_ARMOR_EVADE_DIVISOR = { b: 3, bt: 6, bh: 6, bth: 7 };

// Życie za 1 pkt siły (hpbon) - współczynnik starego wzoru max(0.1, round(f * lvl / 10) / 10)
const PROF_HPBON_FACTOR = {
    w: 1, p: 1, wp: 1, wb: 0.5, pb: 0.5, wpb: 50 / 83,
};

const Prof = {
    armorFactor: (profs) => PROF_ARMOR_FACTOR[toCanonicalProfs(profs)] ?? 0.125,
    absorbFactor: (profs) => PROF_ABSORB_FACTOR[toCanonicalProfs(profs)] ?? 0,
    magicRes: (profs, rarityTier) => {
        const canonical = toCanonicalProfs(profs);
        const base = PROF_MAGIC_RES[canonical] ?? 0;
        if (base == 0) return 0;
        return base + rarityTier * (MAGIC_PROFS.includes(canonical) ? 2 : 1);
    },
    poisonRes: (profs) => PROF_POISON_RES[toCanonicalProfs(profs)] ?? 0,
    armorMana: (profs, lvl) => {
        const divisor = PROF_ARMOR_MANA_DIVISOR[toCanonicalProfs(profs)];
        return divisor ? lvl / divisor : 0;
    },
    // SA w setnych częściach (tak zapisuje ją gra)
    armorSa: (profs, lvl) => {
        const divisor = PROF_ARMOR_SA_DIVISOR[toCanonicalProfs(profs)];
        return divisor ? (100 * lvl) / divisor : 0;
    },
    armorEvade: (profs, lvl) => {
        const divisor = PROF_ARMOR_EVADE_DIVISOR[toCanonicalProfs(profs)];
        return divisor ? lvl / divisor : 0;
    },
    hpbonFactor: (profs) => PROF_HPBON_FACTOR[toCanonicalProfs(profs)] ?? 0,
    blokFactor: (profs) => {
        const canonical = toCanonicalProfs(profs);
        return canonical === 'p' ? 1.2 : canonical === 'wp' ? 1.1 : 1;
    },
};

// =====================================================================
//  Typy przedmiotów (cl)
// =====================================================================

const ItemClass = {
    NONE: 0,
    ONEHANDED: 1,
    TWOHANDED: 2,
    ONEANDAHALFHANDED: 3,
    RANGED: 4,
    SECONDARY: 5,
    WAND: 6,
    ORB: 7,
    ARMOR: 8,
    HELMET: 9,
    BOOTS: 10,
    GLOVES: 11,
    RING: 12,
    NECKLACE: 13,
    SHIELD: 14,
    NEUTRAL: 15,
    CONSUMABLE: 16,
    GOLD: 17,
    KEY: 18,
    QUEST: 19,
    RENEWABLE: 20,
    ARROW: 21, // strzały - typ wycofany z gry, niedostępny w formularzu (stare linki wczytują się jako kołczan)
    CHARM: 22,
    BOOK: 23,
    BAG: 24,
    BLESSING: 25,
    ENHANCEMENT: 26,
    RECIPE: 27,
    QUIVER: 29,
};

function byRarity(common, unique, upgraded, heroic, legendary, artifact) {
    return {
        [Rarity.COMMON]: common,
        [Rarity.UNIQUE]: unique,
        [Rarity.UPGRADED]: upgraded,
        [Rarity.HEROIC]: heroic,
        [Rarity.LEGENDARY]: legendary,
        [Rarity.ARTIFACT]: artifact,
    };
}

// Liczba bonusów do rozdania
const CLASS_BONUS_COUNT = (() => {
    const C = ItemClass;
    const weapon = byRarity(1, 3, 7, 6, 9, 12);
    const small = byRarity(1, 4, 8, 8, 12, 12);
    return {
        [C.ONEHANDED]: weapon,
        [C.ONEANDAHALFHANDED]: weapon,
        [C.TWOHANDED]: weapon,
        [C.RANGED]: weapon,
        [C.SECONDARY]: weapon,
        [C.WAND]: weapon,
        [C.ORB]: weapon,
        [C.ARMOR]: weapon,
        [C.SHIELD]: weapon,
        [C.QUIVER]: weapon,
        [C.HELMET]: small,
        [C.GLOVES]: small,
        [C.BOOTS]: small,
        [C.RING]: byRarity(5, 9, 13, 13, 17, 17),
        [C.NECKLACE]: byRarity(6, 10, 14, 14, 18, 18),
        [C.BLESSING]: byRarity(2, 3, 4, 4, 4, 4),
    };
})();

// Zbroja składana (tworzona) - dodatkowe bonusy za utworzenie, zamiast zwykłego +1 za craft:
// poziomy 40-271: +3, poziom 300: +5
const foldedArmorExtraBonuses = (lvl) => (lvl >= 300 ? 5 : 3);

// Typy z natywnym pancerzem / absorpcją / odpornościami
const CLASSES_WITH_NATIVE_DEFENSE = [ItemClass.ARMOR, ItemClass.SHIELD, ItemClass.HELMET, ItemClass.GLOVES, ItemClass.BOOTS];

// Bronie (m.in. mocniejsze niszczenie pancerza)
const WEAPON_CLASSES = [
    ItemClass.ONEHANDED, ItemClass.TWOHANDED, ItemClass.ONEANDAHALFHANDED, ItemClass.RANGED,
    ItemClass.SECONDARY, ItemClass.WAND, ItemClass.ORB, ItemClass.QUIVER,
];

const CLASS_POWER = {
    [ItemClass.SHIELD]: 0.75,
    [ItemClass.HELMET]: 0.33,
    [ItemClass.BOOTS]: 0.3,
    [ItemClass.GLOVES]: 0.25,
};

// Współczynnik typu we wzorze na wartość (od 26.03.2026): bronie 1.5, neutralne 0.4, reszta (w tym zbroje i tarcze) 1
const CLASS_VALUE_MULTIPLIER = {
    [ItemClass.ONEHANDED]: 1.5,
    [ItemClass.ONEANDAHALFHANDED]: 1.5,
    [ItemClass.TWOHANDED]: 1.5,
    [ItemClass.RANGED]: 1.5,
    [ItemClass.SECONDARY]: 1.5,
    [ItemClass.QUIVER]: 1.5,
    [ItemClass.WAND]: 1.5,
    [ItemClass.ORB]: 1.5,
    [ItemClass.NEUTRAL]: 0.4,
};

// Niszczenie absorpcji: val = współczynnik * (rarity_power + level_power)
const CLASS_ABDEST_FACTOR = {
    [ItemClass.ONEANDAHALFHANDED]: 0.33,
    [ItemClass.TWOHANDED]: 0.36,
    [ItemClass.SECONDARY]: 0.24,
    [ItemClass.ORB]: 0.21,
    [ItemClass.QUIVER]: 0.12, // w tabeli dokumentacji wiersz "strzały"
};

// =====================================================================
//  Obrażenia broni: damage = 8 * weapon_factor * (rarity_power + level_power)
//
//  normal - broń bez dodatkowego typu obrażeń: [fizyczne]
//  wound/poison/fire/frost/light - broń z takim typem: [fizyczne, obrażenia typu]
//  Rozrzut fizycznych ±10%, ognia i błyskawic ±20%.
//
//  Wartości zgodne z tabelą w dokumentacji po zaokrągleniu do 4 miejsc wzięto dokładne
//  ze starej strony (wyprowadzone z przedmiotów); pozostałe są wprost z dokumentacji.
// =====================================================================

const DAMAGE_TYPES = ['wound', 'poison', 'fire', 'frost', 'light'];

const WEAPON_DAMAGE = (() => {
    const C = ItemClass;
    // Dokładne współczynniki starej strony: weapon_factor = K * mnożnik (dla ognia/zimna/błyskawic i ataku),
    // K / 10 * mnożnik (dla trucizny i głębokiej rany)
    const K = 0.31875;
    const quiver = {
        normal: [0.03028125],
        poison: [0, (K / 10) * 0.85],
        fire: [0, K * 0.15],
        frost: [0, K * 0.135],
        light: [0, K * 0.15],
    };
    return {
        [C.ONEHANDED]: {
            normal: [K * 1.06],
            wound: [K * 0.83, (K / 10) * 2.75],
            poison: [K * 0.83, (K / 10) * 2.5],
            fire: [K * 0.9, K * 0.5],
            frost: [K * 0.9, K * 0.45],
            light: [K * 0.9, K * 0.5],
        },
        [C.TWOHANDED]: {
            normal: [K * 1.75],
            wound: [0.4606, 0.153],
            poison: [0.4606, (K / 10) * 2.5],
            fire: [K * 1.53, K * 0.75],
            frost: [K * 1.53, K * 0.675],
            light: [K * 1.53, K * 0.75],
        },
        [C.ONEANDAHALFHANDED]: {
            normal: [K * 1.25],
            wound: [K * 1.025, 0.1084],
            poison: [K * 1.025, (K / 10) * 2.5],
            fire: [0.4016, K * 0.65],
            frost: [0.4016, 0.1865],
            light: [0.4016, K * 0.65],
        },
        [C.RANGED]: {
            normal: [K * 1.35],
            wound: [K * 0.91, (K / 10) * 3.25],
            poison: [K * 0.91, (K / 10) * 3.5],
            fire: [K * 0.7, K * 0.71],
            frost: [K * 0.7, K * 0.64],
            light: [K * 0.7, 0.2258],
        },
        [C.SECONDARY]: {
            normal: [K * 0.755],
            wound: [K * 0.595, (K / 10) * 1.15],
            poison: [K * 0.595, (K / 10) * 1.05],
        },
        [C.WAND]: {
            fire: [0, K],
            frost: [0, K * 0.85],
            light: [0, 0.3653], // dokumentacja: 0.3652 - za mało dla przedmiotu z gry (458-687 na poz. 48 heroik)
        },
        [C.ORB]: {
            fire: [0, K * 0.475],
            frost: [0, K * 0.425],
            light: [0, 0.1528],
        },
        [C.QUIVER]: quiver,
    };
})();

// Spowolnienie w broniach od zimna i trucizny: slow = slow_factor * lvl (w SA, gra zapisuje setne części)
const WEAPON_SLOW_FACTOR = (() => {
    const C = ItemClass;
    return {
        [C.ONEHANDED]: { frost: 0.009566, poison: 0.008925 },
        [C.TWOHANDED]: { frost: 0.01, poison: 0.008925 },
        [C.ONEANDAHALFHANDED]: { frost: 0.01, poison: 0.008925 },
        [C.RANGED]: { frost: 0.0073529, poison: 0.0044625 },
        [C.SECONDARY]: { poison: 0.006375 },
        [C.WAND]: { frost: 0.01 },
        [C.ORB]: { frost: 0.0073529 },
        [C.QUIVER]: { frost: 0.0073529, poison: 0.0044625 },
    };
})();

const Classes = {
    power: (cl) => CLASS_POWER[cl] ?? 1,
    valueMultiplier: (cl) => CLASS_VALUE_MULTIPLIER[cl] ?? 1,
    hasNativeDefense: (cl) => CLASSES_WITH_NATIVE_DEFENSE.includes(cl),
    isWeapon: (cl) => WEAPON_CLASSES.includes(cl),
    abdestFactor: (item) =>
        toCanonicalProfs(item.profs) === 'b' && item.cl === ItemClass.ONEHANDED ? 0.33 : (CLASS_ABDEST_FACTOR[item.cl] ?? 0.3),
    // Typ obrażeń broni (pierwszy zaznaczony) albo "normal"
    damageType: (stats) => DAMAGE_TYPES.find((type) => stats[type]) ?? 'normal',
    // weapon_factor obrażeń fizycznych
    physicalFactor: (cl, stats) => WEAPON_DAMAGE[cl]?.[Classes.damageType(stats)]?.[0] ?? 0,
    // weapon_factor obrażeń danego typu (ogień, zimno, ...)
    typeFactor: (cl, type) => WEAPON_DAMAGE[cl]?.[type]?.[1] ?? 0,
    slowFactor: (cl, type) => WEAPON_SLOW_FACTOR[cl]?.[type] ?? 0,
    bonusCount: (cl, rarity) => {
        if (!CLASS_BONUS_COUNT[cl]) {
            console.warn('Invalid class in bonus count: ', cl);
            return 0;
        }
        return CLASS_BONUS_COUNT[cl][rarity];
    },
};
