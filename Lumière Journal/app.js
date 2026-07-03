// App Logic for Lumière Journal

let db;
let currentView = 'home';
let notes = JSON.parse(localStorage.getItem('lumiere_notes')) || [];
let lists = JSON.parse(localStorage.getItem('lumiere_lists')) || [];
let recordings = []; // metadata + blobs loaded from IndexedDB
let settings = JSON.parse(localStorage.getItem('lumiere_settings')) || { darkMode: false, defaultFont: "'Poppins', sans-serif" };
let activeNoteId = null;
let activeListId = null;
let currentSearchQuery = '';

const saveNotes = () => localStorage.setItem('lumiere_notes', JSON.stringify(notes));
const saveLists = () => localStorage.setItem('lumiere_lists', JSON.stringify(lists));
const saveSettings = () => {
    localStorage.setItem('lumiere_settings', JSON.stringify(settings));
    applySettings();
};

const applySettings = () => {
    if (settings.darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    document.documentElement.style.setProperty('--font-body', settings.defaultFont);
};

const getFormattedDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Initialize IndexedDB for Recordings
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LumiereDB', 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            const transaction = db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
                recordings = getAll.result || [];
                resolve();
            };
        };
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveRecordingToDB = (recording) => {
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    store.put(recording);
    recordings.unshift(recording);
};

const deleteRecordingFromDB = (id) => {
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    store.delete(id);
    recordings = recordings.filter(r => r.id !== id);
};

document.addEventListener('DOMContentLoaded', async () => {
    applySettings();
    await initDB();
    feather.replace();

    const navLinks = document.querySelectorAll('.sidebar .nav-links li');
    const mainContent = document.getElementById('main-content');

    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.toLowerCase().trim();
                if (query !== '') {
                    currentSearchQuery = query;
                    currentView = 'search';
                    renderView('search');
                    navLinks.forEach(l => l.classList.remove('active'));
                }
            }
        });
    }

    const renderView = (viewName) => {
        const template = document.getElementById(`view-${viewName}`);
        mainContent.style.opacity = 0; 
        setTimeout(() => {
            mainContent.innerHTML = ''; 
            if (template) {
                const clone = template.content.cloneNode(true);
                mainContent.appendChild(clone);
                feather.replace();

                if (viewName === 'home') initHomeView();
                else if (viewName === 'notes') initNotesView();
                else if (viewName === 'note-editor') initNoteEditorView();
                else if (viewName === 'lists') initListsView();
                else if (viewName === 'list-editor') initListEditorView();
                else if (viewName === 'calendar') initCalendarView();
                else if (viewName === 'recordings') initRecordingsView();
                else if (viewName === 'search') initSearchView();
                else if (viewName === 'settings') initSettingsView();
            }
            mainContent.style.opacity = 1;
        }, 200);
    };

    const initHomeView = () => {
        const dateDisplay = document.getElementById('today-date');
        if (dateDisplay) dateDisplay.textContent = getFormattedDate();

        const recentNotesContainer = document.getElementById('home-recent-notes');
        if (recentNotesContainer) {
            if (notes.length > 0) {
                recentNotesContainer.innerHTML = notes.slice(0, 3).map(n => `
                    <div class="recent-note-item" data-id="${n.id}" style="padding: 10px; border-bottom: 1px solid var(--clr-beige); cursor: pointer;">
                        <strong>${n.title || 'Untitled'}</strong><br>
                        <small style="color: #888;">${new Date(n.updatedAt).toLocaleDateString()}</small>
                    </div>
                `).join('');
                document.querySelectorAll('.recent-note-item').forEach(el => el.addEventListener('click', () => {
                    activeNoteId = el.getAttribute('data-id');
                    renderView('note-editor');
                }));
            } else recentNotesContainer.innerHTML = 'No recent notes';
        }

        const recentListsContainer = document.getElementById('home-recent-lists');
        if (recentListsContainer) {
            if (lists.length > 0) {
                recentListsContainer.innerHTML = lists.slice(0, 3).map(l => `
                    <div class="recent-list-item" data-id="${l.id}" style="padding: 10px; border-bottom: 1px solid var(--clr-beige); cursor: pointer;">
                        <strong>${l.title || 'Untitled List'}</strong><br>
                        <small style="color: #888;">${l.items.filter(i=>i.completed).length}/${l.items.length} tasks</small>
                    </div>
                `).join('');
                document.querySelectorAll('.recent-list-item').forEach(el => el.addEventListener('click', () => {
                    activeListId = el.getAttribute('data-id');
                    renderView('list-editor');
                }));
            } else recentListsContainer.innerHTML = 'No recent lists';
        }

        const recentRecordingsContainer = document.getElementById('home-recent-recordings');
        if (recentRecordingsContainer) {
            if (recordings.length > 0) {
                recentRecordingsContainer.innerHTML = recordings.slice(0, 3).map(r => `
                    <div style="padding: 10px; border-bottom: 1px solid var(--clr-beige);">
                        <strong>${r.title || 'Voice Note'}</strong><br>
                        <small style="color: #888;">${new Date(r.createdAt).toLocaleDateString()}</small>
                    </div>
                `).join('');
            } else recentRecordingsContainer.innerHTML = 'No recent recordings';
        }
    };

    const initNotesView = () => {
        document.getElementById('btn-new-note').addEventListener('click', () => {
            activeNoteId = null;
            renderView('note-editor');
        });
        const notesGrid = document.getElementById('notes-grid');
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = `note-card bg-${note.background || 'default'}`;
            if(note.background === 'custom' && note.customBg) {
                card.style.backgroundImage = `url(${note.customBg})`;
                card.style.backgroundSize = 'cover';
            }
            card.innerHTML = `
                <h4 style="font-family:${note.font || 'inherit'}">${note.title || 'Untitled'}</h4>
                <p style="font-family:${note.font || 'inherit'}">${note.content.replace(/<[^>]+>/g, ' ').substring(0, 150)}</p>
            `;
            card.addEventListener('click', () => {
                activeNoteId = note.id;
                renderView('note-editor');
            });
            notesGrid.appendChild(card);
        });
    };

    const initNoteEditorView = () => {
        const titleInput = document.getElementById('note-title-input');
        const contentInput = document.getElementById('note-content-input');
        const bgSelector = document.getElementById('note-bg-selector');
        const fontSelector = document.getElementById('note-font-selector');
        const bgOpacity = document.getElementById('note-bg-opacity');
        const bgInput = document.getElementById('note-bg-input');
        const stickerPanel = document.getElementById('sticker-panel');
        const stickerUpload = document.getElementById('sticker-upload-input');
        const imageInput = document.getElementById('note-image-input');
        const editorContainer = document.querySelector('.editor-container');
        const imageToolbar = document.getElementById('image-manipulation-toolbar');

        let currentBg = 'default';
        let customBgData = null;
        let currentOpacity = 1;
        let currentStickers = [];

        let selectedImage = null;
        let selectedStickerObj = null;

        if (activeNoteId) {
            const existingNote = notes.find(n => n.id === activeNoteId);
            if (existingNote) {
                titleInput.value = existingNote.title;
                contentInput.innerHTML = existingNote.content;
                currentBg = existingNote.background || 'default';
                customBgData = existingNote.customBg || null;
                currentOpacity = existingNote.bgOpacity || 1;
                currentStickers = existingNote.stickers ? JSON.parse(JSON.stringify(existingNote.stickers)) : [];
                if(existingNote.font) {
                    fontSelector.value = existingNote.font;
                    contentInput.style.fontFamily = existingNote.font;
                    titleInput.style.fontFamily = existingNote.font;
                }
            }
        }

        const applyBackground = () => {
            editorContainer.className = 'editor-container';
            if (currentBg !== 'custom') {
                editorContainer.classList.add(`bg-${currentBg}`);
                editorContainer.style.setProperty('--bg-image', 'none');
            } else if (customBgData) {
                editorContainer.style.setProperty('--bg-image', `url(${customBgData})`);
            }
            editorContainer.style.setProperty('--bg-opacity', currentOpacity);
            bgSelector.value = currentBg;
            bgOpacity.value = currentOpacity;
        };
        applyBackground();

        bgSelector.addEventListener('change', (e) => {
            if (e.target.value === 'custom') bgInput.click();
            else { currentBg = e.target.value; applyBackground(); }
        });
        bgOpacity.addEventListener('input', (e) => {
            currentOpacity = e.target.value;
            applyBackground();
        });
        bgInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                customBgData = await fileToBase64(e.target.files[0]);
                currentBg = 'custom';
                applyBackground();
            }
        });

        fontSelector.addEventListener('change', (e) => {
            const f = e.target.value;
            contentInput.style.fontFamily = f === 'default' ? 'inherit' : f;
            titleInput.style.fontFamily = f === 'default' ? 'inherit' : f;
        });

        document.getElementById('btn-toggle-stickers').addEventListener('click', () => {
            stickerPanel.style.display = stickerPanel.style.display === 'none' ? 'flex' : 'none';
        });

        const setupStickerDrags = () => {
            stickerPanel.querySelectorAll('.sticker-emoji').forEach(s => {
                s.ondragstart = e => {
                    e.dataTransfer.setData('sticker-src', s.src || s.textContent);
                    e.dataTransfer.setData('sticker-type', s.src ? 'img' : 'text');
                };
            });
        };
        setupStickerDrags();

        document.getElementById('btn-upload-sticker').addEventListener('click', () => stickerUpload.click());
        stickerUpload.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const b64 = await fileToBase64(e.target.files[0]);
                const img = document.createElement('img');
                img.src = b64;
                img.className = 'sticker-emoji custom-sticker';
                img.draggable = true;
                img.style.width = '60px';
                stickerPanel.insertBefore(img, document.getElementById('btn-upload-sticker'));
                setupStickerDrags();
            }
        });

        const renderStickers = () => {
            editorContainer.querySelectorAll('.absolute-sticker').forEach(el => el.remove());
            currentStickers.forEach(stk => {
                const el = document.createElement(stk.type === 'img' ? 'img' : 'div');
                el.id = stk.id;
                if(stk.type === 'img') el.src = stk.src;
                else el.textContent = stk.src;
                
                el.className = 'absolute-sticker';
                el.style.position = 'absolute';
                el.style.left = stk.x + 'px';
                el.style.top = stk.y + 'px';
                if(stk.type === 'img') el.style.width = stk.width + 'px';
                else {
                    el.style.fontSize = (stk.width/1.5) + 'px';
                    el.style.lineHeight = 1;
                }
                el.style.transform = `rotate(${stk.rotation}deg)`;
                el.style.cursor = 'pointer';
                el.style.zIndex = '50';
                el.style.userSelect = 'none';
        
                el.onclick = (e) => {
                    e.stopPropagation();
                    showImageToolbar(el, stk);
                };
                editorContainer.appendChild(el);
            });
        };

        editorContainer.ondragover = e => {
            if(e.dataTransfer.types.includes('sticker-src')) e.preventDefault();
        };
        editorContainer.ondrop = e => {
            const src = e.dataTransfer.getData('sticker-src');
            const type = e.dataTransfer.getData('sticker-type');
            if(!src) return;
            e.preventDefault();
            const rect = editorContainer.getBoundingClientRect();
            currentStickers.push({
                id: 'stk_' + Date.now(),
                type, src, 
                x: e.clientX - rect.left - 30, // offset for center
                y: e.clientY - rect.top - 30,
                width: 60, rotation: 0
            });
            renderStickers();
        };
        renderStickers();

        document.getElementById('btn-insert-image').addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const b64 = await fileToBase64(e.target.files[0]);
                document.execCommand('insertImage', false, b64);
                setTimeout(() => attachImageListeners(), 100);
            }
        });

        const showImageToolbar = (el, stkObj = null) => {
            selectedImage = el;
            selectedStickerObj = stkObj;
            imageToolbar.style.display = 'flex';
            const rect = el.getBoundingClientRect();
            const edRect = editorContainer.getBoundingClientRect();
            imageToolbar.style.top = (rect.top - edRect.top - 45) + 'px';
            imageToolbar.style.left = (rect.left - edRect.left) + 'px';
        };

        const attachImageListeners = () => {
            contentInput.querySelectorAll('img').forEach(img => {
                img.onclick = (e) => {
                    e.stopPropagation();
                    showImageToolbar(img, null);
                };
            });
        };
        attachImageListeners();

        contentInput.addEventListener('click', () => {
            imageToolbar.style.display = 'none';
            selectedImage = null;
            selectedStickerObj = null;
        });

        document.getElementById('img-tool-bigger').onclick = (e) => {
            e.stopPropagation();
            if(selectedImage) {
                if(selectedStickerObj) {
                    selectedStickerObj.width += 15;
                    renderStickers();
                    showImageToolbar(document.getElementById(selectedStickerObj.id), selectedStickerObj);
                } else {
                    selectedImage.style.width = (selectedImage.clientWidth + 20) + 'px';
                    showImageToolbar(selectedImage, null);
                }
            }
        };
        document.getElementById('img-tool-smaller').onclick = (e) => {
            e.stopPropagation();
            if(selectedImage) {
                if(selectedStickerObj) {
                    selectedStickerObj.width = Math.max(15, selectedStickerObj.width - 15);
                    renderStickers();
                    showImageToolbar(document.getElementById(selectedStickerObj.id), selectedStickerObj);
                } else {
                    selectedImage.style.width = Math.max(20, selectedImage.clientWidth - 20) + 'px';
                    showImageToolbar(selectedImage, null);
                }
            }
        };
        document.getElementById('img-tool-rotate-left').onclick = (e) => {
            e.stopPropagation();
            if(selectedImage) {
                if(selectedStickerObj) {
                    selectedStickerObj.rotation -= 15;
                    renderStickers();
                } else {
                    let rot = parseInt(selectedImage.dataset.rotation || 0) - 15;
                    selectedImage.dataset.rotation = rot;
                    selectedImage.style.transform = `rotate(${rot}deg)`;
                }
            }
        };
        document.getElementById('img-tool-rotate-right').onclick = (e) => {
            e.stopPropagation();
            if(selectedImage) {
                if(selectedStickerObj) {
                    selectedStickerObj.rotation += 15;
                    renderStickers();
                } else {
                    let rot = parseInt(selectedImage.dataset.rotation || 0) + 15;
                    selectedImage.dataset.rotation = rot;
                    selectedImage.style.transform = `rotate(${rot}deg)`;
                }
            }
        };
        document.getElementById('img-tool-delete').onclick = (e) => {
            e.stopPropagation();
            if(selectedImage) {
                if(selectedStickerObj) {
                    currentStickers = currentStickers.filter(s => s.id !== selectedStickerObj.id);
                    renderStickers();
                } else {
                    selectedImage.remove();
                }
                imageToolbar.style.display = 'none';
            }
        };

        ['bold', 'italic', 'underline'].forEach(cmd => {
            document.querySelector(`.editor-toolbar button[title="${cmd.charAt(0).toUpperCase()+cmd.slice(1)}"]`)
                .addEventListener('click', () => {
                    document.execCommand(cmd, false, null);
                    contentInput.focus();
                });
        });

        document.getElementById('btn-back-notes').addEventListener('click', () => renderView('notes'));
        document.getElementById('btn-save-note').addEventListener('click', () => {
            const title = titleInput.value;
            const content = contentInput.innerHTML;
            const now = new Date().toISOString();
            if (activeNoteId) {
                const idx = notes.findIndex(n => n.id === activeNoteId);
                notes[idx] = { ...notes[idx], title, content, stickers: currentStickers, background: currentBg, customBg: customBgData, bgOpacity: currentOpacity, font: fontSelector.value, updatedAt: now };
            } else {
                const newNote = { id: 'note_'+Date.now(), title, content, stickers: currentStickers, background: currentBg, customBg: customBgData, bgOpacity: currentOpacity, font: fontSelector.value, createdAt: now, updatedAt: now };
                notes.unshift(newNote); 
                activeNoteId = newNote.id;
            }
            saveNotes();
            const btn = document.getElementById('btn-save-note');
            btn.innerHTML = `<i data-feather="check"></i> Saved`; feather.replace();
            setTimeout(() => { btn.innerHTML = `<i data-feather="save"></i> Save`; feather.replace(); }, 2000);
        });

        document.getElementById('btn-delete-note').addEventListener('click', () => {
            if(confirm("Delete this luxurious note?")) {
                if(activeNoteId) {
                    notes = notes.filter(n => n.id !== activeNoteId);
                    saveNotes();
                }
                renderView('notes');
            }
        });
    };

    const initListsView = () => {
        document.getElementById('btn-new-list').addEventListener('click', () => { activeListId = null; renderView('list-editor'); });
        const listsGrid = document.getElementById('lists-grid');
        listsGrid.innerHTML = '';
        lists.forEach(list => {
            const card = document.createElement('div');
            card.className = 'note-card'; 
            const completedCount = list.items.filter(i => i.completed).length;
            const totalCount = list.items.length;
            const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
            let previewHTML = list.items.slice(0, 3).map(item => `
                <div style="font-size:0.9rem; margin-bottom:4px; color:#666; ${item.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">
                    <i data-feather="${item.completed ? 'check-square' : 'square'}" style="width:12px; height:12px;"></i> ${item.text}
                </div>`).join('');
            card.innerHTML = `<h4>${list.title || 'Untitled List'}</h4><div style="margin-top:1rem;">${previewHTML}</div>
                <div class="list-progress"><div class="list-progress-bar" style="width: ${progress}%"></div></div>
                <small style="position:absolute; bottom:1.5rem; color:#aaa;">${completedCount}/${totalCount} tasks</small>`;
            card.addEventListener('click', () => { activeListId = list.id; renderView('list-editor'); });
            listsGrid.appendChild(card);
        });
    };

    const initListEditorView = () => {
        const titleInput = document.getElementById('list-title-input');
        const itemsContainer = document.getElementById('list-items-container');
        let currentListItems = activeListId ? JSON.parse(JSON.stringify(lists.find(l => l.id === activeListId).items)) : [];
        if (activeListId) titleInput.value = lists.find(l => l.id === activeListId).title;

        const renderItems = () => {
            itemsContainer.innerHTML = '';
            currentListItems.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'list-item-row';
                row.setAttribute('draggable', 'true');
                row.innerHTML = `
                    <div class="drag-handle"><i data-feather="grid"></i></div>
                    <input type="checkbox" class="list-item-checkbox" ${item.completed ? 'checked' : ''}>
                    <input type="text" class="list-item-text ${item.completed ? 'completed' : ''}" value="${item.text.replace(/"/g, '&quot;')}">
                    <button class="btn-delete-item"><i data-feather="x"></i></button>
                `;
                row.querySelector('.list-item-checkbox').onchange = e => {
                    item.completed = e.target.checked; renderItems();
                };
                row.querySelector('.list-item-text').oninput = e => item.text = e.target.value;
                row.querySelector('.btn-delete-item').onclick = () => { currentListItems.splice(index, 1); renderItems(); };
                
                row.ondragstart = e => { e.dataTransfer.setData('text/plain', index); row.classList.add('dragging'); };
                row.ondragend = () => row.classList.remove('dragging');
                row.ondragover = e => e.preventDefault();
                row.ondrop = e => {
                    e.preventDefault();
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (fromIndex !== index && !isNaN(fromIndex)) {
                        const draggedItem = currentListItems.splice(fromIndex, 1)[0];
                        currentListItems.splice(index, 0, draggedItem);
                        renderItems();
                    }
                };
                itemsContainer.appendChild(row);
            });
            feather.replace();
        };
        renderItems();

        document.getElementById('btn-add-list-item').onclick = () => { currentListItems.push({ text: '', completed: false }); renderItems(); };
        document.getElementById('btn-back-lists').onclick = () => renderView('lists');
        document.getElementById('btn-save-list').onclick = () => {
            const title = titleInput.value;
            const now = new Date().toISOString();
            if (activeListId) {
                const idx = lists.findIndex(l => l.id === activeListId);
                lists[idx] = { ...lists[idx], title, items: currentListItems, updatedAt: now };
            } else {
                const newList = { id: 'list_'+Date.now(), title, items: currentListItems, createdAt: now, updatedAt: now };
                lists.unshift(newList); activeListId = newList.id;
            }
            saveLists();
            const btn = document.getElementById('btn-save-list');
            btn.innerHTML = `<i data-feather="check"></i> Saved`; feather.replace();
            setTimeout(() => { btn.innerHTML = `<i data-feather="save"></i> Save`; feather.replace(); }, 2000);
        };
        document.getElementById('btn-delete-list').onclick = () => {
            if(confirm("Delete this elegant list?")) {
                if(activeListId) { lists = lists.filter(l => l.id !== activeListId); saveLists(); }
                renderView('lists');
            }
        };
    };

    const initCalendarView = () => {
        let currentDate = new Date();
        const monthYearDisplay = document.getElementById('calendar-month-year');
        const calendarGrid = document.getElementById('calendar-grid');

        const renderCalendar = (date) => {
            calendarGrid.innerHTML = '';
            const year = date.getFullYear();
            const month = date.getMonth();
            monthYearDisplay.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            for (let i=0; i<firstDay; i++) {
                const slot = document.createElement('div'); slot.className = 'calendar-day empty'; calendarGrid.appendChild(slot);
            }
            for (let i=1; i<=daysInMonth; i++) {
                const slot = document.createElement('div'); slot.className = 'calendar-day';
                const dateStr = new Date(year, month, i).toDateString();
                const notesDay = notes.filter(n => new Date(n.updatedAt).toDateString() === dateStr);
                const listsDay = lists.filter(l => new Date(l.updatedAt).toDateString() === dateStr);
                const recsDay = recordings.filter(r => new Date(r.createdAt).toDateString() === dateStr);
                
                let indHTML = '';
                if(notesDay.length) notesDay.forEach(n => indHTML += `<span class="cal-nav" data-type="note" data-id="${n.id}" style="cursor:pointer;" title="Note: ${n.title}"><i data-feather="file-text" class="indicator-icon"></i></span>`);
                if(listsDay.length) listsDay.forEach(l => indHTML += `<span class="cal-nav" data-type="list" data-id="${l.id}" style="cursor:pointer;" title="List: ${l.title}"><i data-feather="check-square" class="indicator-icon" style="color:var(--clr-black);"></i></span>`);
                if(recsDay.length) recsDay.forEach(r => indHTML += `<span class="cal-nav" data-type="rec" style="cursor:pointer;" title="Recording"><i data-feather="mic" class="indicator-icon" style="color:#555;"></i></span>`);
                
                slot.innerHTML = `<div class="day-number">${i}</div><div class="day-indicators" style="position:relative; z-index:2;">${indHTML}</div>`;
                calendarGrid.appendChild(slot);
            }
            feather.replace();

            document.querySelectorAll('.cal-nav').forEach(el => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    const type = el.getAttribute('data-type');
                    if(type === 'note') { activeNoteId = el.getAttribute('data-id'); renderView('note-editor'); }
                    if(type === 'list') { activeListId = el.getAttribute('data-id'); renderView('list-editor'); }
                    if(type === 'rec') renderView('recordings');
                };
            });
        };
        renderCalendar(currentDate);
        document.getElementById('btn-prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(currentDate); };
        document.getElementById('btn-next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(currentDate); };
    };

    const initRecordingsView = () => {
        const btnRecord = document.getElementById('btn-record');
        const btnStop = document.getElementById('btn-stop-recording');
        const statusDiv = document.getElementById('recording-status');
        const recordingsGrid = document.getElementById('recordings-grid');
        let mediaRecorder; let audioChunks = [];

        const renderRecordings = () => {
            recordingsGrid.innerHTML = '';
            recordings.forEach(rec => {
                const card = document.createElement('div'); card.className = 'recording-card';
                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;">
                        <h4>${rec.title || 'Voice Note'}</h4>
                        <button class="btn-delete-rec" data-id="${rec.id}" style="background:transparent;border:none;color:#ff6b6b;cursor:pointer;"><i data-feather="trash-2"></i></button>
                    </div>
                    <audio controls src="${URL.createObjectURL(rec.blob)}"></audio>
                    <small style="color:#aaa;">${new Date(rec.createdAt).toLocaleString()}</small>
                `;
                card.querySelector('.btn-delete-rec').onclick = () => {
                    if(confirm("Delete this recording?")) { deleteRecordingFromDB(rec.id); renderRecordings(); }
                };
                recordingsGrid.appendChild(card);
            });
            feather.replace();
        };
        renderRecordings();

        if (btnRecord && btnStop) {
            btnRecord.onclick = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    mediaRecorder.ondataavailable = e => { if(e.data.size>0) audioChunks.push(e.data); };
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        saveRecordingToDB({ id: 'rec_'+Date.now(), title: 'Recording '+(recordings.length+1), blob: audioBlob, createdAt: new Date().toISOString() });
                        renderRecordings();
                    };
                    mediaRecorder.start();
                    statusDiv.style.display = 'flex'; btnRecord.style.display = 'none';
                } catch (err) { alert('Microphone access denied.'); }
            };
            btnStop.onclick = () => {
                if(mediaRecorder && mediaRecorder.state==='recording') {
                    mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t=>t.stop());
                    statusDiv.style.display = 'none'; btnRecord.style.display = 'flex';
                }
            };
        }
    };

    const initSearchView = () => {
        const container = document.getElementById('search-results-container');
        if (!container) return;
        const q = currentSearchQuery.toLowerCase();
        const matchedNotes = notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q));
        const matchedLists = lists.filter(l => (l.title||'').toLowerCase().includes(q) || l.items.some(i => i.text.toLowerCase().includes(q)));
        
        let html = '';
        if (matchedNotes.length===0 && matchedLists.length===0) { container.innerHTML = `<div style="text-align:center; padding:3rem; color:#888;">No results</div>`; return; }
        if (matchedNotes.length>0) {
            html += `<h3>Notes</h3>`;
            matchedNotes.forEach(n => html += `<div class="search-result-item" data-type="note" data-id="${n.id}"><strong><i data-feather="file-text"></i> ${n.title}</strong></div>`);
        }
        if (matchedLists.length>0) {
            html += `<h3 style="margin-top:1.5rem;">Lists</h3>`;
            matchedLists.forEach(l => html += `<div class="search-result-item" data-type="list" data-id="${l.id}"><strong><i data-feather="check-square"></i> ${l.title}</strong></div>`);
        }
        container.innerHTML = html; feather.replace();
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.onclick = () => {
                const id = item.getAttribute('data-id');
                if (item.getAttribute('data-type') === 'note') { activeNoteId = id; renderView('note-editor'); } 
                else { activeListId = id; renderView('list-editor'); }
            };
        });
    };

    const initSettingsView = () => {
        const darkModeToggle = document.getElementById('setting-dark-mode');
        const fontSelector = document.getElementById('setting-default-font');
        
        darkModeToggle.checked = settings.darkMode;
        fontSelector.value = settings.defaultFont;

        darkModeToggle.addEventListener('change', (e) => {
            settings.darkMode = e.target.checked;
            saveSettings();
        });

        fontSelector.addEventListener('change', (e) => {
            settings.defaultFont = e.target.value;
            saveSettings();
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const view = e.currentTarget.getAttribute('data-view');
            if(view !== currentView) {
                currentView = view;
                renderView(view);
            }
        });
    });

    renderView('home');
});
