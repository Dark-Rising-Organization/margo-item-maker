'use strict';

// Statystyki pomijane przy liczeniu wartości przedmiotu
const VALUE_IGNORED_STATS = [
    'bonus',
    'bonus_not_selected',
    'created',
    'enhancement_upgrade_lvl',
    'loot',
    'lowreq',
    'lvlupgs',
    'motel',
    'nodesc',
    'rarity',
    'recovered',
    'timelimit_upgs',
];

class Item {
    /**
     * @param {number} cl                  typ przedmiotu (ItemClass)
     * @param {number} lvl                 poziom
     * @param {string} profs               wymagane profesje, np. "wpb"
     * @param {number} rarity              rzadkość (Rarity)
     * @param {Object} stats               bonusy wybrane w formularzu: { nazwa: liczba bonusów }
     * @param {number} extraAllowedBonuses dodatkowe bonusy do rozdania
     */
    constructor(cl, lvl, profs, rarity, stats, extraAllowedBonuses = 0) {
        this.cl = cl;
        this.lvl = lvl;
        this.profs = profs;
        this.rarity = rarity;
        this.stats = stats;
        this.extraAllowedBonuses = extraAllowedBonuses;
        this.nativeResOverride = '';
    }

    // Poziom pozorny po uwzględnieniu ulepszenia (każdy stopień to +3% poziomu)
    getRealLevel(value = 0, stat = '') {
        return (
            this.lvl +
            statSign(stat) * Math.sign(value == 0 ? 1 : value) * (this.stats.upgrade ?? 0) * roundStat(0.03 * this.lvl)
        );
    }

    // rarity_factor; extraTier - dodatkowa jakość z bonusów "Atak" / "Obrona"
    getRarityTier(extraTier = 0) {
        return RARITY_TIER[this.rarity] + (this.stats.raritymod ?? 0) + extraTier;
    }

    // rarity_power + level_power
    getPowerBase(lvl, extraTier = 0) {
        return rarityPower(lvl, this.getRarityTier(extraTier)) + levelPower(lvl);
    }

    getPower() {
        return Classes.power(this.cl);
    }

    // Ręczna zmiana typu natywnej odporności magicznej (resfire / resfrost / reslight) - wartość zostaje ta sama.
    // Odporność na truciznę (act) jest stała i się nie zmienia.
    setNativeResOverride(stat) {
        this.nativeResOverride = NATIVE_RES_TYPES.includes(stat) ? stat : '';
    }

    getNativeRes() {
        return this.nativeResOverride == '' ? nativeResType(this.lvl) : this.nativeResOverride;
    }

    // Statystyki, które przedmiot ma "z automatu" (bez rozdawania bonusów)
    exportNativeStats() {
        const result = {};
        const set = (stat, value) => {
            if (value != 0) result[stat] = value.toString();
        };

        const lvl = this.getRealLevel(0);
        const classPower = this.getPower();
        const profs = toCanonicalProfs(this.profs);
        const base = this.getPowerBase(lvl);
        // Bonusy "Obrona" i "Atak" - pancerz / obrażenia jak dla jakości wyższej o liczbę bonusów
        const armorBase = this.getPowerBase(lvl, this.stats[ARMOR_BOOST_STAT] ?? 0);
        const damageBase = this.getPowerBase(lvl, this.stats[ATTACK_BOOST_STAT] ?? 0);

        // --- Elementy pancerza ---
        if (Classes.hasNativeDefense(this.cl)) {
            set('ac', 8 * Prof.armorFactor(profs) * classPower * armorBase);

            const absorbFactor = Prof.absorbFactor(profs);
            set('absorb', 8 * absorbFactor * classPower * base);
            set('absorbm', 4 * absorbFactor * classPower * base);

            set(this.getNativeRes(), Prof.magicRes(profs, this.getRarityTier()));
            set('act', Prof.poisonRes(profs));
        }

        if (this.cl == ItemClass.ARMOR) {
            // Zbroja dla wszystkich profesji ma ujemny pancerz: -max(1, 0.25 * level_power), obcięty do całości
            // (peleryna poz. 35: 133.65 - 28 = 106, przy zaokrąglaniu wyszłoby 105)
            if (profs === '' || profs === 'wpbmth') {
                set('ac', Number(result.ac ?? 0) - Math.floor(Math.max(1, 0.25 * levelPower(lvl))));
            }

            if (this.lvl > 20) set('manabon', Prof.armorMana(profs, lvl));

            const hpbonFactor = Prof.hpbonFactor(profs);
            if (hpbonFactor > 0) {
                const hpbon = Math.max(10, 10 * roundStat(0.1 * hpbonFactor * lvl)) / 100;
                set('hpbon', Number(hpbon.toFixed(1)));
            }

            set('evade', Prof.armorEvade(profs, lvl));
            set('sa', Prof.armorSa(profs, lvl));
        }

        if (this.cl == ItemClass.SHIELD) {
            set('blok', Prof.blokFactor(profs) * lvl);
        }

        // --- Bronie ---
        const isAmmo = this.cl == ItemClass.QUIVER;
        const isMelee = [ItemClass.ONEHANDED, ItemClass.ONEANDAHALFHANDED, ItemClass.TWOHANDED].includes(this.cl);

        if (isAmmo && profs.includes('h')) {
            set('acdmg', roundStat(8e-4 * (lvl * lvl + 130 * lvl + 620)));
        }
        if ((isMelee && profs == 'p') || (isAmmo && profs == 't')) {
            set('resdmg', 1);
        }

        const physicalFactor = Classes.physicalFactor(this.cl, this.stats);
        if (physicalFactor > 0) {
            // damage = 8 * weapon_factor * (rarity_power + level_power), rozrzut ±10%
            const damage = 8 * physicalFactor * damageBase;
            if (isAmmo) {
                // Kołczany - obrażenia fizyczne tylko u łowcy
                if (this.profs.includes('h')) set('pdmg', roundStat(damage));
            } else {
                result.dmg = `${roundStat(0.9 * damage)},${roundStat(1.1 * damage)}`;
            }
        }

        return result;
    }

    getRemainingBonuses() {
        const total = Classes.bonusCount(this.cl, this.rarity) + this.extraAllowedBonuses;
        let used = 0;
        for (const stat in this.stats) {
            // Wartości tekstowe (bonus legendarny, bonus za ulepszenie) nie zajmują bonusów
            if (typeof this.stats[stat] !== 'number') continue;
            used += statCost(stat) * this.stats[stat];
        }
        return total - used;
    }

    // Wartość statystyki dla podanej liczby bonusów
    computeStat(stat, amt) {
        const lvl = this.getRealLevel(typeof amt === 'number' ? amt : 0, stat);
        const extraTier = DAMAGE_STATS.includes(stat) ? (this.stats[ATTACK_BOOST_STAT] ?? 0) : 0;
        return STAT_FORMULAS[stat](this, {
            amt,
            lvl,
            levelPower: levelPower(lvl),
            rarityPower: rarityPower(lvl, this.getRarityTier(extraTier)),
            classPower: this.getPower(),
        });
    }

    // Bonus za ulepszenie +5: "statystyka,wartość" albo null
    getEnhancementBonus() {
        const stat = this.stats[ENHANCEMENT_STAT];
        if (!stat || !STAT_FORMULAS[stat] || (this.stats.upgrade ?? 0) < ENHANCEMENT_MIN_UPGRADE) return null;
        if (!(ENHANCEMENT_POOLS[this.cl] ?? []).includes(stat)) return null;

        // Przyrost z kolejnego bonusu tej statystyki (np. 2 leczenia -> wartość 3. leczenia minus 2.)
        // Gdy przedmiot nie ma tej statystyki, kolejny bonus to pierwszy bonus - razem ze stałą ze wzoru
        // (np. spowolnienie 8 + 2 * lvl / 7), więc odejmujemy zero zamiast wartości dla 0 bonusów
        const amt = typeof this.stats[stat] === 'number' ? this.stats[stat] : 0;
        const next = this.computeStat(stat, amt + 1);
        const current = amt == 0 ? null : this.computeStat(stat, amt);

        if (typeof next === 'string') {
            // Losowe niszczenie energii/many: "szansa,wartość" - szansa rośnie, wartość zależy od poziomu
            const [nextChance, nextValue] = next.split(',').map(Number);
            const currentChance = current === null ? 0 : Number(String(current).split(',')[0]);
            return `${stat},${nextChance - currentChance},${nextValue}`;
        }

        // Statystyka niezależna od liczby bonusów (np. niszczenie absorpcji) - cała wartość
        if (current !== null && Number(next) == Number(current)) {
            return `${stat},${Math.floor(Number(next) + 1e-9)}`;
        }
        // Gra zaokrągla całą statystykę (z wartością natywną) przed i po wzmocnieniu i zapisuje różnicę:
        // leczenie 75.5 -> 143 daje +67, pancerz zbroi 349.3 -> 389.7 daje +41
        const native = Number(this.exportNativeStats()[stat] ?? 0);
        const before = roundStat(native + (current === null ? 0 : Number(current)));
        return `${stat},${roundStat(native + Number(next)) - before}`;
    }

    // Wszystkie statystyki przedmiotu (natywne + z bonusów), jako stringi
    export() {
        const result = this.exportNativeStats();

        for (const stat in this.stats) {
            if (STAT_FORMULAS[stat] === undefined) continue;
            const computed = this.computeStat(stat, this.stats[stat]);

            if (result[stat]) {
                result[stat] = (Number(result[stat]) + Number(computed)).toString();
            } else {
                result[stat] = computed.toString();
            }
            if (result[stat] === '0') delete result[stat];
        }

        // Bonus za ulepszenie +5 jest zapisywany osobno ("bonus=heal,67") i jednocześnie
        // doliczany do tej samej statystyki przedmiotu (np. 76 leczenia + 67 = heal=143)
        const enhancement = this.getEnhancementBonus();
        if (enhancement) {
            result[ENHANCEMENT_STAT] = enhancement;
            const [stat, gain, value] = enhancement.split(',');
            if (value === undefined) {
                result[stat] = (roundStat(Number(result[stat] ?? 0)) + Number(gain)).toString();
            } else {
                // Losowe niszczenie energii/many: rośnie szansa, wartość zależy od poziomu
                const chance = result[stat] ? Number(result[stat].split(',')[0]) : 0;
                result[stat] = `${chance + Number(gain)},${value}`;
            }
        }

        for (const stat in result) {
            const number = Number(result[stat]);
            if (!isNaN(number) && !UNROUNDED_STATS.includes(stat)) {
                result[stat] = roundStat(number).toString();
            }
        }

        return result;
    }

    // Wartość przedmiotu w złocie; extraStats - dodatkowe statystyki wpisane ręcznie.
    // Wzór z dokumentacji (lvl_factor * class_factor * ...) nie zgadza się z grą - ten zgadza się z przedmiotami.
    getValue(extraStats = {}) {
        const stats = this.export();
        stats.lvl = this.lvl.toString();
        if (this.profs.length) stats.reqp = this.profs.toString();
        stats.rarity = '';

        const statCount = new Set(
            Object.keys(stats)
                .concat(Object.keys(extraStats))
                .filter((stat) => !VALUE_IGNORED_STATS.includes(stat)),
        ).size;

        const multiplier = Classes.valueMultiplier(this.cl);
        const rarity = RARITY_VALUE[this.rarity];
        const amount = stats.ammo ? parseInt(stats.ammo) : stats.amount ? parseInt(stats.amount) : 1;
        const lvl = this.lvl;

        return roundStat(0.7 * multiplier * (3 + rarity) * Math.pow(1.05, statCount) * amount * (lvl * lvl + 2.5 * lvl));
    }
}
