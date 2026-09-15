'use strict';

// Zaokrąglanie symetryczne względem zera (-2.5 -> -3, tak jak 2.5 -> 3)
function roundStat(x) {
    return x < 0 ? -Math.round(-x) : Math.round(x);
}

// Ile bonusów zajmuje jeden punkt statystyki (domyślnie 1)
const STAT_COST = {
    upgrade: 0,
    wound: 0,
    poison: 0,
    fire: 0,
    frost: 0,
    light: 0,
    legbon: 0,
    raritymod: 1,
    adest: -1,
};

const statCost = (stat) => STAT_COST[stat] ?? 1;

// Statystyki "ujemne" - ulepszenie przedmiotu obniża ich poziom zamiast podnosić
const statSign = (stat) => (stat === 'adest' ? -1 : 1);

// Natywna odporność na elementach zbroi zależy od poziomu przedmiotu
const nativeResType = (lvl) => ['resfire', 'resfrost', 'reslight'][lvl % 3];

// Statystyki, których wartość nie jest zaokrąglana do liczby całkowitej
const UNROUNDED_STATS = ['hpbon'];

// Bonus "Atak" podnosi jakość tych statystyk, bonus "Obrona" - natywnego pancerza
const ATTACK_BOOST_STAT = 'attackup';
const ARMOR_BOOST_STAT = 'armorup';
const DAMAGE_STATS = ['dmg', 'pdmg', 'fire', 'frost', 'light', 'wound', 'poison'];

// level_power = 0.02 * lvl^2 + 2.6 * lvl
const levelPower = (lvl) => 0.02 * lvl * lvl + 2.6 * lvl;

// rarity_power = 0.02 * lvl * ceil(10 * rarity_factor / 3) + sign(rarity_factor) * (7.8 * rarity_factor + 2.6)
const rarityPower = (lvl, rarityTier) =>
    0.02 * lvl * Math.ceil((10 * rarityTier) / 3) + Math.sign(rarityTier) * (7.8 * rarityTier + 2.6);

// Obrażenia danego typu: damage = 8 * weapon_factor * (rarity_power + level_power)
const typeDamage = (item, c, type) => 8 * Classes.typeFactor(item.cl, type) * (c.rarityPower + c.levelPower);

// Spowolnienie broni od zimna/trucizny w setnych częściach SA
const weaponSlow = (item, c, type) => roundStat(100 * Classes.slowFactor(item.cl, type) * c.lvl);

/**
 * Wzory na wartość statystyki (wg tabeli "Wartości atrybutów rozdawanych w przedmiotach").
 * Wartość zwracana jest w jednostkach, w jakich gra zapisuje statystykę
 * (np. SA i obniżanie SA w setnych częściach).
 *
 * c.amt          - liczba bonusów danego typu
 * c.lvl          - poziom przedmiotu (z uwzględnieniem ulepszenia)
 * c.levelPower   - level_power
 * c.rarityPower  - rarity_power
 * c.classPower   - class_power (Classes.power)
 */
const STAT_FORMULAS = {
    // --- Atrybuty dostępne we wszystkich przedmiotach ---
    da: (item, c) => 0.25 * c.lvl * c.amt + 8,
    ds: (item, c) => (5 * c.lvl * c.amt) / 9 + 4,
    dz: (item, c) => (5 * c.lvl * c.amt) / 9 + 4,
    di: (item, c) => (5 * c.lvl * c.amt) / 9 + 4,
    sa: (item, c) => roundStat(8 + c.amt * 0.25 * c.lvl),
    // Wzór z dokumentacji (amt * 3.08 * round(8 + lvl + ...)) nie zgadza się z grą - ten zgadza się z przedmiotami
    hp: (item, c) => 3.08 * (8 + c.amt * (c.lvl + 0.2 * c.levelPower * c.classPower)),
    heal: (item, c) => 8 + c.amt * (0.8 * c.lvl + 0.2 * c.levelPower * c.classPower),
    ac: (item, c) => c.amt * 0.15 * c.levelPower * c.classPower,
    act: (item, c) => 5 * c.amt,
    blok: (item, c) => (c.amt * c.lvl * 3) / 20,
    evade: (item, c) => (c.amt * c.lvl) / 10,
    acdmg: (item, c) =>
        Classes.isWeapon(item.cl) ? 1 + (c.amt * c.levelPower) / 50 : 1 + (c.amt * 0.75 * c.levelPower) / 50,
    resdmg: (item, c) => c.amt,
    adest: (item, c) => 4 + c.amt * (0.5 * c.lvl + 0.1 * c.levelPower * c.classPower),
    absorb: (item, c) => c.amt * 0.6 * c.levelPower * c.classPower,
    absorbm: (item, c) => c.amt * 0.6 * c.levelPower * c.classPower,
    manabon: (item, c) => 5 + (c.amt * c.lvl) / 4,
    energybon: (item, c) => c.amt * (10 + c.lvl / 15),
    slow: (item, c) => roundStat(8 + (c.amt * 2 * c.lvl) / 7),
    crit: (item, c) => c.amt,
    critval: (item, c) => c.amt * 6,
    critmval: (item, c) => c.amt * 6,
    lowcrit: (item, c) => c.amt * 2,
    enfatig: (item, c) => `${Math.min(100, 40 * c.amt)},${roundStat(2 + 0.04 * c.lvl)}`,
    manafatig: (item, c) => `${Math.min(100, 40 * c.amt)},${roundStat(6 + 0.08 * c.lvl)}`,
    endest: (item, c) => c.amt * (2 + 0.02 * c.lvl),
    manadest: (item, c) => c.amt * (5 + 0.04 * c.lvl),
    lowevade: (item, c) => (c.amt * c.lvl) / 10,
    dmgmul: (item, c) => c.amt * 3,
    dmgmulphysical: (item, c) => c.amt * 3,
    dmgmulpoison: (item, c) => c.amt * 5,
    dmgmulwound: (item, c) => c.amt * 5,
    dmgmulfire: (item, c) => c.amt * 4,
    dmgmulfrost: (item, c) => c.amt * 4,
    dmgmullight: (item, c) => c.amt * 4,
    dmgmulabsolute: (item, c) => c.amt * 4,

    // --- Bonusy przeklęte ---
    // Gra zapisuje tylko wartość many; energię wylicza sama (max(1, round(0.444 * mana)))
    resmanaendest: (item, c) => c.amt * 0.75 * (5 + 0.04 * c.lvl),
    lowcritallval: (item, c) => c.amt * 0.75 * (5 + Math.ceil(0.02 * c.lvl)),
    lowheal2turns: (item, c) => 0.75 * (8 + c.amt * (0.8 * c.lvl + 0.2 * c.levelPower * c.classPower)),

    // --- Elementy pancerza ---
    resfire: (item, c) => c.amt * 3,
    resfrost: (item, c) => c.amt * 3,
    reslight: (item, c) => c.amt * 3,

    // --- Bronie ---
    abdest: (item, c) => Classes.abdestFactor(item) * (c.rarityPower + c.levelPower),
    // Bonusy ustalane manualnie - bez podziału na klasy pochodzenia przedmiotu
    contra: (item, c) => (c.amt >= 2 ? 60 : 50),
    pierce: (item, c) => (c.amt >= 2 ? 25 : 20),
    pierceb: (item, c) => (c.amt >= 2 ? 60 : 50),

    // Typ obrażeń broni - wartość nie zależy od liczby bonusów
    fire: (item, c) => roundStat(typeDamage(item, c, 'fire')),
    frost: (item, c) => {
        const damage = roundStat(typeDamage(item, c, 'frost'));
        return damage == 0 ? 0 : `${weaponSlow(item, c, 'frost')},${damage}`;
    },
    light: (item, c) => {
        const damage = typeDamage(item, c, 'light');
        return damage == 0 ? 0 : `${roundStat(0.8 * damage)},${roundStat(1.2 * damage)}`;
    },
    wound: (item, c) => {
        const damage = roundStat(typeDamage(item, c, 'wound'));
        return damage == 0 ? 0 : `25,${damage}`;
    },
    poison: (item, c) => {
        const damage = roundStat(typeDamage(item, c, 'poison'));
        return damage == 0 ? 0 : `${weaponSlow(item, c, 'poison')},${damage}`;
    },

    // Gra zapisuje bonus legendarny razem z poziomem pozornym przedmiotu (od niego zależy słabnięcie)
    legbon: (item, c) => `${c.amt},${c.lvl}`,
};

/**
 * Pola statystyk w formularzu, pogrupowane tematycznie.
 * [nazwa silnikowa, etykieta, min, max] - min/max to dozwolony zakres liczby bonusów
 * (wartość spoza zakresu podświetla się na czerwono).
 * Bonusy przeklęte (resmanaendest, lowcritallval, lowheal2turns) są ukryte - nie używa się ich już,
 * ale wzory zostały, więc da się je dodać z powrotem wpisując wiersz do odpowiedniej grupy.
 */
const STAT_GROUPS = [
    {
        title: 'Cechy',
        stats: [
            ['da', 'Wszystkie cechy', 0, 6],
            ['ds', 'Siła', -2, 6],
            ['dz', 'Zręczność', -2, 6],
            ['di', 'Intelekt', -2, 6],
        ],
    },
    {
        title: 'Życie i leczenie',
        stats: [
            ['hp', 'Życie', -2, 6],
            ['heal', 'Leczenie', 0, 5],
            ['adest', 'Ranienie posiadacza', 0, 5],
        ],
    },
    {
        title: 'Cios krytyczny',
        stats: [
            ['crit', 'Cios krytyczny', 0, 5],
            ['critval', 'Siła krytyka fizycznego', -2, 5],
            ['critmval', 'Siła krytyka magicznego', -2, 5],
            ['lowcrit', 'Obniżanie szansy na krytyk przeciwnika', 0, 5],
        ],
    },
    {
        title: 'Mnożniki obrażeń',
        stats: [
            ['dmgmul', 'Wszystkie obrażenia', 0, 5],
            ['dmgmulphysical', 'Obrażenia fizyczne', 0, 5],
            ['dmgmulfire', 'Obrażenia od ognia', 0, 5],
            ['dmgmulfrost', 'Obrażenia od zimna', 0, 5],
            ['dmgmullight', 'Obrażenia od błyskawic', 0, 5],
            ['dmgmulpoison', 'Obrażenia od trucizny', 0, 5],
            ['dmgmulwound', 'Obrażenia od głębokiej rany', 0, 5],
            ['dmgmulabsolute', 'Obrażenia nieuchronne', 0, 5],
        ],
    },
    {
        title: 'Szybkość ataku',
        stats: [
            ['sa', 'Szybkość ataku', -2, 5],
            ['slow', 'Obniżanie szybkości przeciwnika', 0, 5],
        ],
    },
    {
        title: 'Obrona',
        stats: [
            ['evade', 'Unik', -2, 5],
            ['blok', 'Blok', -1, 5],
            ['ac', 'Pancerz', -2, 5],
            ['absorb', 'Absorpcja', 0, 5],
            ['absorbm', 'Absorpcja magiczna', 0, 5],
            ['pierceb', 'Blok przebicia', 0, 2],
            [ARMOR_BOOST_STAT, 'Dodatkowa obrona', 0, 2],
        ],
    },
    {
        title: 'Odporności',
        stats: [
            ['act', 'Odporność na truciznę', -2, 5],
            ['resfire', 'Odporność na ogień', -3, 10],
            ['resfrost', 'Odporność na zimno', -3, 10],
            ['reslight', 'Odporność na błyskawice', -3, 10],
        ],
    },
    {
        title: 'Energia i mana',
        stats: [
            ['energybon', 'Energia', -2, 5],
            ['manabon', 'Mana', -2, 5],
            ['enfatig', 'Niszczenie energii', 0, 3],
            ['manafatig', 'Niszczenie many', 0, 3],
        ],
    },
    {
        title: 'Osłabianie obrony przeciwnika',
        stats: [
            ['acdmg', 'Niszczenie pancerza', 0, 5],
            ['resdmg', 'Niszczenie odporności', 0, 5],
            ['abdest', 'Niszczenie absorpcji', 0, 1],
            ['lowevade', 'Obniżanie uniku', 0, 5],
            ['pierce', 'Przebicie pancerza', 0, 2],
        ],
    },
    {
        title: 'Broń',
        stats: [
            [ATTACK_BOOST_STAT, 'Dodatkowy atak', 0, 2],
            ['contra', 'Kontra', 0, 2],
            ['fire', 'Typ: obrażenia od ognia', 0, 1],
            ['frost', 'Typ: obrażenia od zimna', 0, 1],
            ['light', 'Typ: obrażenia od błyskawic', 0, 1],
            ['poison', 'Typ: trucizna', 0, 1],
            ['wound', 'Typ: głęboka rana', 0, 1],
        ],
    },
    {
        title: 'Inne',
        stats: [
            ['raritymod', 'Modyfikator rzadkości'],
            ['upgrade', 'Stopień ulepszenia przedmiotu'],
        ],
    },
];

/**
 * Bonus za ulepszenie przedmiotu na +5 (statystyka "bonus=nazwa,wartość", w grze "Wzmocniono: ...").
 * Pula zależy od zestawu, do którego należy typ przedmiotu. Bonus nie zajmuje miejsca w puli bonusów.
 * Wartość = przyrost z kolejnego bonusu tej statystyki na poziomie pozornym, zaokrąglony w dół.
 */
const ENHANCEMENT_STAT = 'bonus';
const ENHANCEMENT_MIN_UPGRADE = 5;
const ENHANCEMENT_POOLS = (() => {
    const C = ItemClass;
    const attributes = ['da', 'di', 'ds', 'dz'];
    const weapons = [...attributes, 'sa', 'crit', 'acdmg', 'resdmg', 'enfatig', 'manafatig', 'abdest'];
    const armors = [...attributes, 'ac', 'resfire', 'resfrost', 'reslight', 'act', 'hp', 'blok', 'absorb', 'absorbm', 'evade'];
    const jewelry = [...attributes, 'energybon', 'manabon', 'critval', 'critmval', 'lowcrit', 'heal', 'slow', 'lowevade'];
    return {
        [C.ONEHANDED]: weapons,
        [C.TWOHANDED]: weapons,
        [C.ONEANDAHALFHANDED]: weapons,
        [C.SECONDARY]: weapons,
        [C.RANGED]: weapons,
        [C.WAND]: weapons,
        [C.ORB]: weapons,
        [C.QUIVER]: weapons,
        [C.ARMOR]: armors,
        [C.HELMET]: armors,
        [C.GLOVES]: armors,
        [C.BOOTS]: armors,
        [C.SHIELD]: armors,
        [C.RING]: jewelry,
        [C.NECKLACE]: jewelry,
    };
})();

const STAT_LABEL = Object.fromEntries(STAT_GROUPS.flatMap((group) => group.stats.map(([stat, label]) => [stat, label])));

const LEGENDARY_BONUSES = {
    verycrit: 'Cios bardzo krytyczny',
    holytouch: 'Dotyk anioła',
    curse: 'Klątwa',
    glare: 'Oślepienie',
    lastheal: 'Ostatni ratunek',
    critred: 'Krytyczna osłona',
    facade: 'Fasada opieki',
    cleanse: 'Płomienne oczyszczenie',
    anguish: 'Krwawa udręka',
    puncture: 'Przeszywająca skuteczność',
};
