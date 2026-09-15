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

    const compareIds = Library.compareIds();
    const cards = items.map((saved) =>
        renderCard(saved.state, {
            title: saved.state.name,
            subtitle: `${Library.folderName(saved.folderId)} · zapisano ${new Date(saved.savedAt).toLocaleString('pl-PL')}`,
            actions: `
                <button data-item-action="edit" data-id="${saved.id}">Edytuj</button>
                <button data-item-action="compare" data-id="${saved.id}"${compareIds.includes(saved.id) || saved.id === editingId ? ' disabled' : ''}>
                    ${compareIds.includes(saved.id) ? 'W porównaniu' : 'Porównaj'}
                </button>
                <select data-item-action="move" data-id="${saved.id}" title="Przenieś do folderu">${folderOptions(saved.folderId)}</select>
                <button data-item-action="delete" data-id="${saved.id}">Usuń</button>`,
        }),
    );
    document.querySelector('#library-cards').innerHTML = cards.length
        ? cards.join('')
        : '<div class="library-empty">Brak zapisanych przedmiotów. Zapisz przedmiot w kreatorze przyciskiem „Zapisz jako nowy”.</div>';
}

function initLibraryView() {
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
