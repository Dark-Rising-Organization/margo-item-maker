'use strict';

/**
 * Biblioteka zapisanych przedmiotów i folderów - zapis lokalny w przeglądarce (localStorage).
 *
 * Przedmiot:  { id, folderId, state, savedAt }  - state to stan formularza (patrz formState() w app.js)
 * Folder:     { id, name }
 * folderId == '' oznacza "Bez folderu".
 */
const LIBRARY_STORAGE_KEY = 'margoItemMaker.library.v1';

const Library = (() => {
    let data = { folders: [], items: [], compare: [] };

    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY));
            if (saved && Array.isArray(saved.items) && Array.isArray(saved.folders)) {
                data = { folders: saved.folders, items: saved.items, compare: saved.compare ?? [] };
            }
        } catch (error) {
            console.error('Nie udało się wczytać biblioteki', error);
        }
    }

    function persist() {
        try {
            localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            alert('Nie udało się zapisać biblioteki w przeglądarce: ' + error.message);
        }
    }

    load();

    return {
        folders: () => [...data.folders].sort((a, b) => a.name.localeCompare(b.name, 'pl')),
        folder: (id) => data.folders.find((folder) => folder.id === id),
        folderName: (id) => (id ? (data.folders.find((folder) => folder.id === id)?.name ?? 'Bez folderu') : 'Bez folderu'),

        addFolder(name) {
            const folder = { id: newId(), name };
            data.folders.push(folder);
            persist();
            return folder;
        },
        renameFolder(id, name) {
            const folder = data.folders.find((f) => f.id === id);
            if (folder) folder.name = name;
            persist();
        },
        // Przedmioty z usuwanego folderu trafiają do "Bez folderu"
        deleteFolder(id) {
            data.folders = data.folders.filter((folder) => folder.id !== id);
            for (const item of data.items) {
                if (item.folderId === id) item.folderId = '';
            }
            persist();
        },

        items: (folderId = null) =>
            data.items
                .filter((item) => folderId === null || item.folderId === folderId)
                .sort((a, b) => a.state.name.localeCompare(b.state.name, 'pl')),
        item: (id) => data.items.find((item) => item.id === id),

        addItem(state, folderId) {
            const item = { id: newId(), folderId, state, savedAt: Date.now() };
            data.items.push(item);
            persist();
            return item;
        },
        updateItem(id, changes) {
            const item = data.items.find((i) => i.id === id);
            if (item) Object.assign(item, changes, { savedAt: Date.now() });
            persist();
        },
        deleteItem(id) {
            data.items = data.items.filter((item) => item.id !== id);
            data.compare = data.compare.filter((compareId) => compareId !== id);
            persist();
        },

        // Przedmioty wybrane do porównania z edytowanym
        compareIds: () => data.compare.filter((id) => data.items.some((item) => item.id === id)),
        addCompare(id) {
            if (!data.compare.includes(id)) data.compare.push(id);
            persist();
        },
        removeCompare(id) {
            data.compare = data.compare.filter((compareId) => compareId !== id);
            persist();
        },
        clearCompare() {
            data.compare = [];
            persist();
        },
    };
})();
