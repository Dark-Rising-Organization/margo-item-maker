'use strict';

// =====================================================================
//  Zakładki i widok biblioteki (zapisane przedmioty obok siebie, bez edycji)
// =====================================================================

// Folder wybrany w bibliotece: 'all' - wszystkie, '' - bez folderu, albo id folderu
let libraryFolder = 'all';

function showView(view) {
    document.querySelector('#creator-view').hidden = view !== 'creator';
    document.querySelector('#library-view').hidden = view !== 'library';
    for (const tab of document.querySelectorAll('.tab')) {
        tab.classList.toggle('active', tab.dataset.view === view);
    }
    if (view === 'library') renderLibrary();
}

function renderLibrary() {
    if (libraryFolder !== 'all' && libraryFolder !== '' && !Library.folder(libraryFolder)) libraryFolder = 'all';

    // --- Foldery ---
    const folderEntry = (id, name, count, editable) => `
        <li class="folder${libraryFolder === id ? ' active' : ''}" data-folder="${id}">
            <span class="folder-name">${escapeHtml(name)}</span>
            <span class="folder-count">${count}</span>
            ${editable ? `<button data-folder-action="rename" data-id="${id}" title="Zmień nazwę">✎</button><button data-folder-action="delete" data-id="${id}" title="Usuń folder">✕</button>` : ''}
        </li>`;
    let folders = folderEntry('all', 'Wszystkie', Library.items().length, false);
    folders += folderEntry('', 'Bez folderu', Library.items('').length, false);
    for (const folder of Library.folders()) {
        folders += folderEntry(folder.id, folder.name, Library.items(folder.id).length, true);
    }
    document.querySelector('#folder-list').innerHTML = folders;

    // --- Przedmioty ---
    const items = Library.items(libraryFolder === 'all' ? null : libraryFolder);
    const title = libraryFolder === 'all' ? 'Wszystkie przedmioty' : Library.folderName(libraryFolder);
    document.querySelector('#library-title').textContent = `${title} (${items.length})`;
    document.querySelector('#library-export').textContent = libraryFolder === 'all' ? 'Kopiuj całą bibliotekę' : 'Kopiuj folder';

    const compareIds = Library.compareIds();
    const cards = items.map((saved) =>
        renderCard(saved.state, {
            title: saved.state.name,
            subtitle: `${Library.folderName(saved.folderId)} · zapisano ${new Date(saved.savedAt).toLocaleString('pl-PL')}`,
            actions: `
                <div class="card-actions-row">
                    <button data-item-action="edit" data-id="${saved.id}">Edytuj</button>
                    <button data-item-action="compare" data-id="${saved.id}"${compareIds.includes(saved.id) || saved.id === editingId ? ' disabled' : ''}>
                        ${compareIds.includes(saved.id) ? 'W porównaniu' : 'Porównaj'}
                    </button>
                    <button data-item-action="delete" data-id="${saved.id}">Usuń</button>
                </div>
                <div class="card-actions-row">
                    <button data-item-action="copy-stats" data-id="${saved.id}" title="Skopiuj listę statystyk">Kopiuj statystyki</button>
                    <select data-item-action="move" data-id="${saved.id}" title="Przenieś do folderu">${folderOptions(saved.folderId)}</select>
                </div>`,
        }),
    );
    document.querySelector('#library-cards').innerHTML = cards.length
        ? cards.join('')
        : '<div class="library-empty">Brak zapisanych przedmiotów. Zapisz przedmiot w kreatorze przyciskiem „Zapisz jako nowy”.</div>';
}

// =====================================================================
//  Import / eksport biblioteki jako tekst (kopia zapasowa przez schowek)
//
//  [Nazwa folderu]
//  Nazwa przedmiotu | legring40allprof: cleanse, 5crit, 1da, 3hp
//
//  Folder "Bez folderu" ma nagłówek [Bez folderu]. Linie przed pierwszym nagłówkiem trafiają do
//  folderu otwartego w bibliotece (albo do "Bez folderu"). Grafika przedmiotu nie jest częścią listy.
// =====================================================================

const NO_FOLDER_NAME = 'Bez folderu';

function exportLibraryText(selection = libraryFolder) {
    const lines = [];
    const block = (name, items) => {
        if (lines.length) lines.push('');
        lines.push(`[${name}]`);
        for (const saved of items) lines.push(`${saved.state.name} | ${buildStatsList(saved.state)}`);
    };

    if (selection === 'all') {
        const unfiled = Library.items('');
        if (unfiled.length) block(NO_FOLDER_NAME, unfiled);
        // Puste foldery też - żeby odtworzyć całą strukturę
        for (const folder of Library.folders()) block(folder.name, Library.items(folder.id));
    } else {
        block(Library.folderName(selection), Library.items(selection));
    }
    return lines.join('\n');
}

/**
 * Wczytuje przedmioty z tekstu w formacie exportLibraryText. Foldery są dopasowywane po nazwie
 * (brakujące są tworzone), a przedmioty, które już są w folderze (ta sama nazwa i lista), pomijane.
 */
function importLibraryText(text) {
    const result = { added: 0, duplicates: 0, folders: 0, errors: [], warnings: [] };
    let folderId = Library.folder(libraryFolder) ? libraryFolder : '';

    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) return;

        const header = /^\[(.*)\]$/.exec(line);
        if (header) {
            const name = header[1].trim();
            if (name === '' || name === NO_FOLDER_NAME) {
                folderId = '';
            } else {
                let folder = Library.folders().find((f) => f.name === name);
                if (!folder) {
                    folder = Library.addFolder(name);
                    result.folders++;
                }
                folderId = folder.id;
            }
            return;
        }

        // Nazwa przed ostatnim "|" (lista statystyk nie zawiera tego znaku)
        const separator = line.lastIndexOf('|');
        const name = separator == -1 ? '' : line.slice(0, separator).trim();
        const list = line.slice(separator + 1).trim();
        try {
            const base = { ...hashToState(DEFAULT_HASH), name, icon: '' };
            const { state, warnings } = parseStatsList(list, base);
            if (!name) state.name = list.slice(0, list.indexOf(':')).trim();
            if (warnings.length) result.warnings.push(`linia ${index + 1}: pominięto ${warnings.join(', ')}`);

            const listText = buildStatsList(state);
            const exists = Library.items(folderId).some(
                (saved) => saved.state.name === state.name && buildStatsList(saved.state) === listText,
            );
            if (exists) {
                result.duplicates++;
            } else {
                Library.addItem(state, folderId);
                result.added++;
            }
        } catch (error) {
            result.errors.push(`linia ${index + 1}: ${error.message}`);
        }
    });
    return result;
}

function showLibraryMessage(text, isError = false) {
    const message = document.querySelector('#library-message');
    message.textContent = text;
    message.classList.toggle('error', isError);
    message.hidden = false;
}

function initLibraryView() {
    document.querySelector('#library-export').addEventListener('click', () => {
        const count = Library.items(libraryFolder === 'all' ? null : libraryFolder).length;
        copyToClipboard(exportLibraryText()).then(() =>
            showLibraryMessage(`Skopiowano listę (${count} przedmiotów). Wklej ją w „Wklej listę (import)”, żeby odtworzyć.`),
        );
    });

    const importBox = document.querySelector('#library-import');
    const importText = document.querySelector('#library-import-text');
    document.querySelector('#library-import-toggle').addEventListener('click', () => {
        importBox.hidden = !importBox.hidden;
        if (!importBox.hidden) importText.focus();
    });
    document.querySelector('#library-import-cancel').addEventListener('click', () => {
        importBox.hidden = true;
    });
    document.querySelector('#library-import-run').addEventListener('click', () => {
        if (importText.value.trim() === '') return;
        const result = importLibraryText(importText.value);
        const summary =
            `Zaimportowano przedmiotów: ${result.added}` +
            (result.folders ? `, nowe foldery: ${result.folders}` : '') +
            (result.duplicates ? `, pominięto duplikaty: ${result.duplicates}` : '') +
            '.';
        const problems = [...result.errors, ...result.warnings];
        showLibraryMessage([summary, ...problems].join('\n'), problems.length > 0);
        if (result.errors.length == 0) {
            importText.value = '';
            importBox.hidden = true;
        }
        renderLibrary();
        update();
    });

    for (const tab of document.querySelectorAll('.tab')) {
        tab.addEventListener('click', () => showView(tab.dataset.view));
    }

    document.querySelector('#add-folder').addEventListener('click', () => {
        const name = prompt('Nazwa nowego folderu:')?.trim();
        if (!name) return;
        libraryFolder = Library.addFolder(name).id;
        renderLibrary();
        refreshSaveBox();
    });

    document.querySelector('#folder-list').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-folder-action]');
        if (button) {
            const folder = Library.folder(button.dataset.id);
            if (button.dataset.folderAction === 'rename') {
                const name = prompt('Nowa nazwa folderu:', folder.name)?.trim();
                if (name) Library.renameFolder(folder.id, name);
            } else if (confirm(`Usunąć folder „${folder.name}”? Przedmioty z niego trafią do „Bez folderu”.`)) {
                Library.deleteFolder(folder.id);
            }
            renderLibrary();
            update();
            return;
        }
        const entry = event.target.closest('[data-folder]');
        if (entry) {
            libraryFolder = entry.dataset.folder;
            renderLibrary();
        }
    });

    const cards = document.querySelector('#library-cards');
    cards.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-item-action]');
        if (!button) return;
        const saved = Library.item(button.dataset.id);
        switch (button.dataset.itemAction) {
            case 'edit':
                editSavedItem(saved.id);
                break;
            case 'compare':
                Library.addCompare(saved.id);
                showView('creator');
                update();
                break;
            case 'copy-stats':
                copyToClipboard(buildStatsList(saved.state)).then(() => {
                    button.textContent = 'Skopiowano';
                    setTimeout(() => (button.textContent = 'Kopiuj statystyki'), 1500);
                });
                break;
            case 'delete':
                if (confirm(`Usunąć zapisany przedmiot „${saved.state.name}”?`)) {
                    Library.deleteItem(saved.id);
                    if (editingId === saved.id) setEditing(null);
                    renderLibrary();
                    update();
                }
                break;
        }
    });
    cards.addEventListener('change', (event) => {
        const select = event.target.closest('select[data-item-action="move"]');
        if (!select) return;
        Library.updateItem(select.dataset.id, { folderId: select.value });
        renderLibrary();
        update();
    });
}
