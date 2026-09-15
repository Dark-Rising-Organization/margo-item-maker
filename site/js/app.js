'use strict';

const CLASS_OPTIONS = [
    [ItemClass.ONEHANDED, 'Jednoręczne'],
    [ItemClass.TWOHANDED, 'Dwuręczne'],
    [ItemClass.ONEANDAHALFHANDED, 'Półtoraręczne'],
    [ItemClass.RANGED, 'Dystansowe'],
    [ItemClass.SECONDARY, 'Pomocnicze'],
    [ItemClass.WAND, 'Różdżki'],
    [ItemClass.ORB, 'Orby'],
    [ItemClass.ARMOR, 'Zbroje'],
    [ItemClass.HELMET, 'Hełmy'],
    [ItemClass.BOOTS, 'Buty'],
    [ItemClass.GLOVES, 'Rękawice'],
    [ItemClass.RING, 'Pierścienie'],
    [ItemClass.NECKLACE, 'Naszyjniki'],
    [ItemClass.SHIELD, 'Tarcze'],
    [ItemClass.QUIVER, 'Kołczany'],
];

const RARITY_OPTIONS = [
    [Rarity.COMMON, 'Pospolite'],
    [Rarity.UNIQUE, 'Unikatowe'],
    [Rarity.UPGRADED, 'Ulepszone'],
    [Rarity.HEROIC, 'Heroiczne'],
    [Rarity.LEGENDARY, 'Legendarne'],
];

const DEFAULT_HASH = '#1|0|0|100||0||Testowy przedmiot|||0';

const CHANGELOG = `
v1.6.0
- wzory sprawdzone na przedmiotach z gry: pancerz z bonusu (tylko moc poziomu), mana z bonusu (+5), błyskawice różdżek i orbów
- wartość wzmocnienia za +5 liczona jak w grze (różnica zaokrąglonej statystyki razem z wartością natywną)
- ujemny pancerz w zbrojach dla wszystkich profesji
- opcja "Zbroja składana" (+3 bonusy za utworzenie, na poziomie 300: +5)
- ręczna zmiana typu natywnej odporności magicznej (ogień / zimno / błyskawice)
- usunięto strzały (typ wycofany z gry; stare linki wczytują się jako kołczan)
- przycisk "Skopiuj listę statystyk"

v1.5.0
- bonus za ulepszenie +5 (Wzmocniono) z pulą zależną od typu przedmiotu, gwiazdki ulepszenia w tooltipie
- bonus za craft/tytana/quest/licytację (+1 bonus do rozdania)
- biblioteka: zapis przedmiotów w folderach, porównywanie z edytowanym przedmiotem, podgląd folderu
- statystyki pogrupowane tematycznie, podświetlanie ustawionych pól
- ukryto bonusy przeklęte

v1.4.0 (odtworzona wersja)
- wzory zaktualizowane wg dokumentacji Margonem (moc poziomu/rzadkości, obrażenia broni, pancerz, odporności)
- nowe bonusy: mnożniki obrażeń (dmgmul*), losowe niszczenie energii i many, bonusy przeklęte, dodatkowy atak/obrona
- usunięto niszczenie energii/many (zastąpione losowym niszczeniem) oraz podział na klasy pochodzenia (tier)
- bonusy legendarne: dodano Fasadę opieki, Krwawą udrękę i Przeszywającą skuteczność, usunięto wycofane
- zakresy liczby bonusów w formularzu

v1.3.0
- zaktualizowano wzory do aktualnie obowiazujących
- poprawiono liczne niepoprawne zaokrąglenia

v1.2.0
- dodano automatyczne obliczanie wartości przedmiotu
- dodano kołczany

v1.1.0
- dodano wprowadzanie nazwy, grafiki, wartości, dodatkowych statystyk
- poprawiono wyświetlanie przedmiotu
- dodano przycisk do skopiowania kodu, który wyświetli przedmiot w grze

v1.0.3:
- zaktualizowano link do dokumentacji Hybercube

v1.0.2:
- naprawiono brak zaokrąglania natywnego bonusu acdmg w strzałach na samego łowcę
- naprawiono błędne liczenie wartości bonusu adest (obniżenie leczenia) w ulepszonych przedmiotach
- dodano przycisk "Resetuj"

v1.0.1:
- naprawiono brak zapisywania wymaganych profesji w linku
`;

const ui = {
    name: document.querySelector('#name-input'),
    icon: document.querySelector('#icon-input'),
    cl: document.querySelector('#class-select'),
    rarity: document.querySelector('#rarity-select'),
    lvl: document.querySelector('#lvl-input'),
    profs: document.querySelector('#prof-input'),
    extraBonus: document.querySelector('#extra-bonus-input'),
    rewardBonus: document.querySelector('#reward-bonus-input'),
    foldedArmor: document.querySelector('#folded-armor-input'),
    nativeRes: document.querySelector('#native-res-select'),
    extraStat: document.querySelector('#extra-stat-input'),
    pr: document.querySelector('#pr-input'),
    stats: document.querySelector('.stat-inputs'),
    copySlot: document.querySelector('#copy-slot'),
    preview: document.querySelector('.item-preview'),
};

const statFields = () => ui.stats.querySelectorAll('input, select');

/**
 * Stan przedmiotu - surowe wartości formularza. Tak jest zapisywany w bibliotece i w linku.
 * { cl, rarity, lvl, profs, extraBonus, reward, folded, nativeRes, stats: { stat: liczba|tekst }, name, icon, extraStat, pr }
 * folded - zbroja składana, nativeRes - ręczny typ natywnej odporności magicznej ('' = wg poziomu)
 */
function formState() {
    const stats = {};
    for (const field of statFields()) {
        const number = Number(field.value);
        if (isNaN(number)) {
            stats[field.dataset.stat] = field.value;
        } else if (number != 0) {
            stats[field.dataset.stat] = number;
        }
    }
    return {
        cl: Number(ui.cl.value),
        rarity: Number(ui.rarity.value),
        lvl: Number(ui.lvl.value),
        profs: ui.profs.value,
        extraBonus: Number(ui.extraBonus.value),
        reward: ui.rewardBonus.checked,
        folded: ui.foldedArmor.checked,
        nativeRes: ui.nativeRes.value,
        stats,
        name: ui.name.value,
        icon: ui.icon.value,
        extraStat: ui.extraStat.value,
        pr: Number(ui.pr.value),
    };
}

// Strzały zostały wycofane z gry - zapisane dawniej przedmioty tego typu traktujemy jak kołczany
const stateClass = (state) => (Number(state.cl) == ItemClass.ARROW ? ItemClass.QUIVER : Number(state.cl));

// Stan -> [info, Item]
function buildItem(state) {
    state = { ...state, cl: stateClass(state) };
    const name = escapeHtml(state.name);
    const icon = escapeHtml(state.icon);
    const profs = escapeHtml(state.profs);
    const extraStat = escapeHtml(state.extraStat);
    // Bonus za nagrodę (przedmiot z craftu, tytana, questa lub licytacji) - jeden bonus więcej do rozdania.
    // Zbroja składana - bonusy za utworzenie zastępują ten +1 (opcja działa tylko dla zbroi)
    const folded = state.folded && state.cl == ItemClass.ARMOR;
    const creationBonus = folded ? foldedArmorExtraBonuses(state.lvl) : state.reward ? 1 : 0;
    const extraBonus = Number(state.extraBonus) + creationBonus;

    const item = new Item(state.cl, state.lvl, profs, state.rarity, { ...state.stats }, extraBonus);
    item.setNativeResOverride(state.nativeRes ?? '');

    const extraStats = {};
    if (extraStat.length) {
        for (const entry of extraStat.split(';')) {
            const [key, value] = entry.split('=');
            extraStats[key] = value ?? '_true';
        }
    }

    const info = {
        name,
        icon,
        extraStat,
        cl: state.cl,
        rarity: state.rarity,
        pr: state.pr == 0 ? item.getValue(extraStats) : state.pr,
        rawPr: state.pr,
    };
    return [info, item];
}

// Czyta formularz -> [info, Item]
const readForm = () => buildItem(formState());

// Stan formularza jest trzymany w adresie strony (#...), żeby dało się podlinkować przedmiot
function stateToHash(state) {
    const statsText = Object.entries(state.stats)
        .map(([stat, value]) => `${stat}=${value}`)
        .join(';');
    return [
        state.cl,
        state.rarity,
        0, // dawniej tier (klasa pochodzenia) - zostawione dla zgodności starych linków
        state.lvl,
        state.profs,
        state.extraBonus,
        statsText,
        state.name,
        state.icon,
        state.extraStat,
        state.pr,
        state.reward ? 1 : 0,
        state.folded ? 1 : 0,
        state.nativeRes ?? '',
    ].join('|');
}

// Pola statystyk istniejące w formularzu (statystyki spoza tej listy są pomijane przy wczytywaniu)
const FORM_STATS = [...STAT_GROUPS.flatMap((group) => group.stats.map(([stat]) => stat)), 'legbon', ENHANCEMENT_STAT];

function hashToState(hash) {
    let text = hash.replace(/^#/, '');
    try {
        text = decodeURIComponent(text);
    } catch {
        // tekst z pojedynczym "%" (np. w nazwie) - zostawiamy jak jest
    }
    const parts = text.split('|');
    if (parts.length < 7) return null;

    const stats = {};
    for (const entry of parts[6].split(';')) {
        if (entry.trim() == '') continue;
        const [stat, value = ''] = entry.split('=');
        if (!FORM_STATS.includes(stat)) {
            console.warn(`Statystyka z linku nie istnieje w formularzu: ${stat}`);
            continue;
        }
        const number = Number(value);
        if (isNaN(number)) stats[stat] = value;
        else if (number != 0) stats[stat] = number;
    }

    return {
        cl: stateClass({ cl: parts[0] }),
        rarity: Number(parts[1]),
        lvl: Number(parts[3]),
        profs: parts[4],
        extraBonus: Number(parts[5]),
        reward: parts[11] === '1',
        folded: parts[12] === '1',
        nativeRes: NATIVE_RES_TYPES.includes(parts[13]) ? parts[13] : '',
        stats,
        name: parts[7] ?? ui.name.value,
        icon: parts[8] ?? ui.icon.value,
        extraStat: parts[9] ?? ui.extraStat.value,
        pr: Number(parts[10] ?? ui.pr.value),
    };
}

// Wpisuje stan do formularza
function applyState(state) {
    ui.cl.value = stateClass(state);
    ui.rarity.value = state.rarity;
    ui.lvl.value = state.lvl;
    ui.profs.value = state.profs;
    ui.extraBonus.value = state.extraBonus;
    ui.rewardBonus.checked = state.reward;
    ui.foldedArmor.checked = state.folded ?? false;
    ui.nativeRes.value = NATIVE_RES_TYPES.includes(state.nativeRes) ? state.nativeRes : '';
    ui.name.value = state.name;
    ui.icon.value = state.icon;
    ui.extraStat.value = state.extraStat;
    ui.pr.value = state.pr;

    for (const field of statFields()) {
        field.value = field instanceof HTMLInputElement ? '0' : '';
    }
    // Lista bonusów za +5 zależy od typu i ulepszenia - odświeżana przed ustawieniem wyboru
    const upgradeField = ui.stats.querySelector('[data-stat=upgrade]');
    upgradeField.value = state.stats.upgrade ?? 0;
    refreshEnhancementOptions();
    for (const [stat, value] of Object.entries(state.stats)) {
        const field = ui.stats.querySelector(`[data-stat=${stat}]`);
        if (field) field.value = value;
    }
}

function loadFromHash(hash) {
    const state = hashToState(hash);
    if (state) applyState(state);
}

// Karta z dymkiem przedmiotu (podgląd, porównanie, biblioteka)
function renderCard(state, { title = '', subtitle = '', actions = '', cssClass = '' } = {}) {
    const [info, item] = buildItem(state);
    const header = title
        ? `<div class="card-header"><div class="card-title">${escapeHtml(title)}</div><div class="card-subtitle">${escapeHtml(subtitle)}</div></div>`
        : '';
    return `
        <div class="item-card ${cssClass}">
            ${header}
            ${renderPreview(info, item)}
            ${actions ? `<div class="card-actions">${actions}</div>` : ''}
        </div>`;
}

// =====================================================================
//  Zapis i porównanie
// =====================================================================

// Id przedmiotu z biblioteki, który jest aktualnie edytowany (albo null)
let editingId = sessionStorage.getItem('margoItemMaker.editingId') || null;

function setEditing(id) {
    editingId = id;
    if (id) sessionStorage.setItem('margoItemMaker.editingId', id);
    else sessionStorage.removeItem('margoItemMaker.editingId');
}

function folderOptions(selected) {
    return (
        `<option value="">Bez folderu</option>` +
        Library.folders()
            .map((folder) => `<option value="${folder.id}"${folder.id === selected ? ' selected' : ''}>${escapeHtml(folder.name)}</option>`)
            .join('')
    );
}

function refreshSaveBox() {
    const editing = editingId ? Library.item(editingId) : null;
    if (editingId && !editing) setEditing(null);

    const folderSelect = document.querySelector('#save-folder');
    const selectedFolder = Library.folder(folderSelect.value) ? folderSelect.value : '';
    folderSelect.innerHTML = folderOptions(selectedFolder);

    const label = document.querySelector('#editing-label');
    const saveChangesButton = document.querySelector('#save-changes');
    if (editing) {
        const changed = stateToHash(editing.state) !== stateToHash(formState()) || editing.folderId !== selectedFolder;
        label.innerHTML =
            `Edytujesz: <b>${escapeHtml(editing.state.name)}</b> (${escapeHtml(Library.folderName(editing.folderId))})` +
            (changed ? ' <span class="unsaved">- niezapisane zmiany</span>' : '');
        saveChangesButton.hidden = false;
    } else {
        label.textContent = 'Nowy przedmiot (niezapisany)';
        saveChangesButton.hidden = true;
    }

    // Lista do porównania, pogrupowana po folderach
    const compareIds = Library.compareIds();
    const optionsFor = (items) =>
        items
            .filter((item) => item.id !== editingId && !compareIds.includes(item.id))
            .map((item) => `<option value="${item.id}">${escapeHtml(item.state.name)} (lvl ${item.state.lvl})</option>`)
            .join('');
    let compareOptions = '<option value="">- dodaj zapisany przedmiot -</option>';
    const unfiled = optionsFor(Library.items(''));
    if (unfiled) compareOptions += `<optgroup label="Bez folderu">${unfiled}</optgroup>`;
    for (const folder of Library.folders()) {
        const options = optionsFor(Library.items(folder.id));
        if (options) compareOptions += `<optgroup label="${escapeHtml(folder.name)}">${options}</optgroup>`;
    }
    document.querySelector('#compare-select').innerHTML = compareOptions;
    document.querySelector('#compare-clear').hidden = compareIds.length == 0;

    document.querySelector('#library-count').textContent = `(${Library.items().length})`;
}

function saveAsNew() {
    const item = Library.addItem(formState(), document.querySelector('#save-folder').value);
    setEditing(item.id);
    update();
}

function saveChanges() {
    if (!editingId) return;
    Library.updateItem(editingId, { state: formState(), folderId: document.querySelector('#save-folder').value });
    update();
}

// Wczytuje zapisany przedmiot do edycji
function editSavedItem(id) {
    const saved = Library.item(id);
    if (!saved) return;
    applyState(saved.state);
    setEditing(id);
    Library.removeCompare(id);
    document.querySelector('#save-folder').innerHTML = folderOptions(saved.folderId);
    showView('creator');
    update();
}

function renderCreatorPreview() {
    const editing = editingId ? Library.item(editingId) : null;
    let html = renderCard(formState(), {
        title: 'Edytowany',
        subtitle: editing ? Library.folderName(editing.folderId) : 'niezapisany',
        cssClass: 'card-current',
    });
    for (const id of Library.compareIds()) {
        const saved = Library.item(id);
        html += renderCard(saved.state, {
            title: saved.state.name,
            subtitle: Library.folderName(saved.folderId),
            actions:
                `<button data-action="edit" data-id="${id}">Edytuj</button>` +
                `<button data-action="uncompare" data-id="${id}">Usuń z porównania</button>`,
        });
    }
    ui.preview.innerHTML = `<div class="cards">${html}</div>`;
}

// Podświetla pola statystyk z ustawioną wartością (różną od 0 / wybraną opcją)
function refreshActiveStats() {
    for (const field of statFields()) {
        const active = field instanceof HTMLInputElement ? Number(field.value) != 0 : field.value != '';
        field.closest('.stat-input').classList.toggle('stat-active', active);
    }
}

// Opcje zależne od typu przedmiotu: zbroja składana (tylko zbroje), typ odporności (elementy pancerza)
const NATIVE_RES_LABELS = { resfire: 'ogień', resfrost: 'zimno', reslight: 'błyskawice' };

function refreshClassOptions() {
    const cl = Number(ui.cl.value);
    document.querySelector('#folded-armor-row').hidden = cl != ItemClass.ARMOR;
    document.querySelector('#native-res-row').hidden = !Classes.hasNativeDefense(cl);

    // Opcja domyślna pokazuje, jaki typ wynika z poziomu
    const levelType = NATIVE_RES_LABELS[nativeResType(Number(ui.lvl.value) || 0)] ?? '-';
    ui.nativeRes.options[0].textContent = `Wg poziomu (${levelType})`;
    // Przy zbroi składanej bonus za craft jest już wliczony
    ui.rewardBonus.disabled = !document.querySelector('#folded-armor-row').hidden && ui.foldedArmor.checked;
}

function update() {
    refreshClassOptions();
    refreshEnhancementOptions();
    refreshActiveStats();
    const state = formState();
    document.title = `${state.name} - MargoItemMaker`;
    location.hash = stateToHash(state);
    renderCreatorPreview();
    refreshSaveBox();
}

// Kod do wklejenia w konsoli gry - podmienia przedmiot w wybranym slocie torby
function buildInGameCode() {
    const [info, item] = readForm();
    const gameItem = buildGameItem(info, item);

    if (gameItem.icon.startsWith('http')) {
        alert(
            'Uwaga: ikonka skopiowanego przedmiotu nie będzie działać:\n' +
                'musi być linkiem do do cdn z usuniętym początkiem ' + ICON_CDN,
        );
    }
    if (gameItem.icon.startsWith('http') || gameItem.icon == '') {
        gameItem.icon = PLACEHOLDER_ICONS[gameItem.cl];
    }

    const slot = Number(ui.copySlot.value);
    gameItem.loc = 'g';
    gameItem.id = slot;
    gameItem.x = slot % 7;
    gameItem.y = Math.floor(slot / 7);
    gameItem.st = 0;
    gameItem.own = '__OWN__';

    const itemJson = JSON.stringify(gameItem).replace('"__OWN__"', 'NI ? Engine.hero.d.id : hero.id');
    return `!function(){
           const NI = typeof window.Engine != "undefined";
           (NI ? Engine.communication.parseJSON : parseInput)({
               item: {
                   "${slot}": {"del":1}
               }
           });
           (NI ? Engine.communication.parseJSON : parseInput)({
               item: {
                   "${slot}": ${itemJson}
               }
           });
        }();`;
}

const STATS_LIST_PROF_ORDER = 'bwpmth';

// Krótkie nazwy typów przedmiotów na początku listy statystyk (np. "helmet300mt: ...")
const CLASS_SHORT_NAMES = {
    [ItemClass.ONEHANDED]: '1h',
    [ItemClass.TWOHANDED]: '2h',
    [ItemClass.ONEANDAHALFHANDED]: '1.5h',
    [ItemClass.RANGED]: 'bow',
    [ItemClass.SECONDARY]: 'secondary',
    [ItemClass.WAND]: 'wand',
    [ItemClass.ORB]: 'orb',
    [ItemClass.ARMOR]: 'armor',
    [ItemClass.HELMET]: 'helmet',
    [ItemClass.BOOTS]: 'boots',
    [ItemClass.GLOVES]: 'gloves',
    [ItemClass.RING]: 'ring',
    [ItemClass.NECKLACE]: 'necklace',
    [ItemClass.SHIELD]: 'shield',
    [ItemClass.QUIVER]: 'quiver',
};

/**
 * Lista rozdanych bonusów w nazwach silnikowych, np. "ring40allprof: cleanse, 5crit, 1da, 3hp".
 * Na początku typ, poziom i profesje (brak wymagań lub wszystkie profesje = "allprof").
 * Na początku bonus legendarny (jeśli jest). Pomijane są pola, które nie zajmują bonusów
 * (stopień ulepszenia, typ obrażeń broni) oraz wzmocnienie za +5.
 * Na końcu ręczna zmiana typu natywnej odporności magicznej, np. "resfire->reslight".
 */
function buildStatsList(state = formState()) {
    state = { ...state, cl: stateClass(state) };
    const bonuses = Object.entries(state.stats)
        .filter(([stat, amt]) => typeof amt === 'number' && statCost(stat) != 0)
        .map(([stat, amt]) => `${amt}${ENGINE_NAME_OVERRIDES[stat] ?? stat}`)
        .join(', ');

    let resChange = '';
    const levelRes = nativeResType(state.lvl);
    if (Classes.hasNativeDefense(state.cl) && NATIVE_RES_TYPES.includes(state.nativeRes) && state.nativeRes !== levelRes) {
        resChange = `${levelRes}->${state.nativeRes}`;
    }
    const profs = toCanonicalProfs(state.profs);
    // W liście profesje w kolejności bwpmth (inna niż kanoniczna kolejność kluczy tabel)
    const listProfs = [...profs].sort((a, b) => STATS_LIST_PROF_ORDER.indexOf(a) - STATS_LIST_PROF_ORDER.indexOf(b)).join('');
    const header = `${CLASS_SHORT_NAMES[state.cl] ?? state.cl}${state.lvl}${profs === '' || profs === 'wpbmth' ? 'allprof' : listProfs}`;
    return `${header}: ${[state.stats.legbon, bonuses, resChange].filter(Boolean).join(', ')}`.trimEnd();
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        window.prompt('Skopiuj do schowka: Ctrl+C, Enter', text);
    }
}

function fillSelect(select, options) {
    for (const [value, label] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.innerText = label;
        select.appendChild(option);
    }
}

// Przełącznik: nazwy silnikowe (da, adest, ...) zamiast polskich etykiet
const ENGINE_NAMES_KEY = 'margoItemMaker.engineNames';
const engineNamesToggle = document.querySelector('#engine-names-toggle');
const useEngineNames = () => engineNamesToggle.checked;

// Statystyki bez nazwy silnikowej w grze (wewnętrzne pola strony) - nazwa pokazywana w trybie silnikowym
const ENGINE_NAME_OVERRIDES = { [ATTACK_BOOST_STAT]: 'atak', [ARMOR_BOOST_STAT]: 'obrona' };

// Etykieta statystyki zależna od przełącznika
const statLabel = (stat, label = STAT_LABEL[stat]) =>
    useEngineNames() ? (ENGINE_NAME_OVERRIDES[stat] ?? stat) : (label ?? stat);

function applyStatNames() {
    for (const name of ui.stats.querySelectorAll('.stat-name[data-stat-name]')) {
        name.textContent = statLabel(name.dataset.statName, name.dataset.label);
    }
    const legbon = ui.stats.querySelector('[data-stat=legbon]');
    for (const option of legbon.options) {
        if (option.value) option.textContent = useEngineNames() ? option.value : LEGENDARY_BONUSES[option.value];
    }
    refreshEnhancementOptions();
}

function buildStatInputs() {
    let html = '';
    for (const group of STAT_GROUPS) {
        html += `<div class="stat-group-title">${group.title}</div>`;
        for (const [stat, label, min, max] of group.stats) {
            const range = min === undefined ? '' : ` min="${min}" max="${max}" title="Zakres: ${min} do ${max}"`;
            html += `
        <div class="stat-input">
            <div class="stat-name" data-stat-name="${stat}" data-label="${label}">${label}</div>
            <div class="stat-input-wrapper">
                <input type="number" data-stat="${stat}" value="0"${range}>
            </div>
        </div>`;
        }
    }

    let legbonOptions = '<option selected value="">Brak</option>';
    for (const bonus in LEGENDARY_BONUSES) {
        legbonOptions += `<option value="${bonus}">${LEGENDARY_BONUSES[bonus]}</option>`;
    }
    html += `
        <div class="stat-input">
            <div class="stat-name" data-stat-name="legbon" data-label="Bonus legendarny">Bonus legendarny</div>
            <div class="stat-input-wrapper">
                <select data-stat="legbon">${legbonOptions}</select>
            </div>
        </div>`;

    html += `
        <div class="stat-input">
            <div class="stat-name" data-stat-name="${ENHANCEMENT_STAT}" data-label="Bonus za ulepszenie +5">Bonus za ulepszenie +5</div>
            <div class="stat-input-wrapper">
                <select data-stat="${ENHANCEMENT_STAT}"></select>
            </div>
        </div>`;

    ui.stats.innerHTML = html;
    applyStatNames();
}

// Lista bonusów za ulepszenie zależy od typu przedmiotu; wybór jest aktywny od ulepszenia +5
function refreshEnhancementOptions() {
    const select = ui.stats.querySelector(`[data-stat=${ENHANCEMENT_STAT}]`);
    const current = select.value;
    const pool = ENHANCEMENT_POOLS[Number(ui.cl.value)] ?? [];

    let options = '<option value="">Brak</option>';
    for (const stat of pool) {
        options += `<option value="${stat}">${statLabel(stat)}</option>`;
    }
    select.innerHTML = options;
    select.value = pool.includes(current) ? current : '';

    const upgrade = Number(ui.stats.querySelector('[data-stat=upgrade]').value);
    select.disabled = upgrade < ENHANCEMENT_MIN_UPGRADE;
    select.title = select.disabled ? 'Wymaga ulepszenia przedmiotu na +5' : '';
}

function init() {
    fillSelect(ui.cl, CLASS_OPTIONS);
    fillSelect(ui.rarity, RARITY_OPTIONS);
    fillSelect(ui.nativeRes, [['', 'Wg poziomu'], ...NATIVE_RES_TYPES.map((stat) => [stat, NATIVE_RES_LABELS[stat]])]);
    try {
        engineNamesToggle.checked = localStorage.getItem(ENGINE_NAMES_KEY) === '1';
    } catch {
        // brak dostępu do localStorage - zostaje domyślnie wyłączony
    }
    engineNamesToggle.addEventListener('change', () => {
        try {
            localStorage.setItem(ENGINE_NAMES_KEY, engineNamesToggle.checked ? '1' : '0');
        } catch {
            // ignorujemy - przełącznik działa do przeładowania strony
        }
        applyStatNames();
    });
    buildStatInputs();

    loadFromHash(location.hash);
    if (editingId && Library.item(editingId)) document.querySelector('#save-folder').value = Library.item(editingId).folderId;

    const inputs = [
        ui.name, ui.icon, ui.cl, ui.rarity, ui.lvl, ui.profs, ui.extraBonus, ui.rewardBonus, ui.foldedArmor, ui.nativeRes,
        ui.extraStat, ui.pr,
    ];
    for (const input of [...inputs, ...statFields()]) {
        input.addEventListener('change', update);
    }
    // Podświetlenie od razu przy wpisywaniu, bez czekania na zatwierdzenie pola
    ui.stats.addEventListener('input', refreshActiveStats);

    document.querySelector('#reset-button').addEventListener('click', () => {
        loadFromHash(DEFAULT_HASH);
        setEditing(null);
        update();
    });

    document.querySelector('#save-new').addEventListener('click', saveAsNew);
    document.querySelector('#save-changes').addEventListener('click', saveChanges);
    document.querySelector('#save-folder').addEventListener('change', refreshSaveBox);
    document.querySelector('#compare-select').addEventListener('change', (event) => {
        if (!event.target.value) return;
        Library.addCompare(event.target.value);
        update();
    });
    document.querySelector('#compare-clear').addEventListener('click', () => {
        Library.clearCompare();
        update();
    });
    ui.preview.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        if (button.dataset.action === 'edit') editSavedItem(button.dataset.id);
        if (button.dataset.action === 'uncompare') {
            Library.removeCompare(button.dataset.id);
            update();
        }
    });

    initLibraryView();

    document.querySelector('#copy-stats-button').addEventListener('click', () => {
        copyToClipboard(buildStatsList());
    });

    document.querySelector('#copy-button').addEventListener('click', () => {
        copyToClipboard(buildInGameCode());
    });

    document.querySelector('#changelog').addEventListener('click', () => alert(CHANGELOG));

    update();
}
