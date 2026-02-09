const DB_NAME = 'GeminiInspectorDB';
const DB_VERSION = 2;
const STORE_NAME = 'files';
let db;

export function initDB(onLoadCallback) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
            e.target.result.createObjectStore(STORE_NAME, {
                keyPath: 'id'
            });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        if (onLoadCallback) onLoadCallback();
    };
    request.onerror = (e) => console.error("DB Error", e);
}

export function saveFileToHistory(fileObj, callback) {
    if (!db) return;

    const doSave = async (finalName) => {
        // Try to find existing record to preserve metadata
        let existingRecord = null;
        if (fileObj.id) {
            existingRecord = await getFileById(fileObj.id);
        } else if (fileObj.driveId) {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const all = await new Promise(resolve => {
                store.getAll().onsuccess = (e) => resolve(e.target.result);
            });
            existingRecord = all.find(f => f.driveId === fileObj.driveId);
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record = {
            id: fileObj.id || (existingRecord ? existingRecord.id : Date.now()),
            name: finalName,
            data: fileObj.data,
            raw: fileObj.raw,
            driveId: fileObj.driveId || (existingRecord ? existingRecord.driveId : null),
            timestamp: Date.now(),
            pinned: fileObj.pinned || (existingRecord ? existingRecord.pinned : false),
            customPromptNames: existingRecord ? existingRecord.customPromptNames : {}
        };
        store.put(record);
        transaction.oncomplete = () => {
            cleanupHistory();
            if (callback) callback(record.id, finalName);
        };
    };

    if (!fileObj.id) {
        getUniqueName(fileObj.name, (uniqueName) => {
            doSave(uniqueName);
        });
    } else {
        doSave(fileObj.name);
    }
}

export function getUniqueName(name, callback) {
    if (!db) return callback ? callback(name) : Promise.resolve(name);

    const promise = new Promise((resolve) => {
        const store = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
        store.getAll().onsuccess = (e) => {
            const files = e.target.result;
            let baseName = name;
            let counter = 1;
            let currentName = name;

            const exists = (n) => files.some(f => f.name === n);

            while (exists(currentName)) {
                counter++;
                currentName = `${baseName} (${counter})`;
            }
            resolve(currentName);
        };
    });

    if (callback) {
        promise.then(callback);
    } else {
        return promise;
    }
}

export function fetchHistory(callback) {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    store.getAll().onsuccess = (e) => {
        const files = e.target.result;
        const pinned = files.filter(f => f.pinned).sort((a, b) => b.timestamp - a.timestamp);
        let unpinned = files.filter(f => !f.pinned).sort((a, b) => b.timestamp - a.timestamp);

        callback(unpinned.slice(0, 10), pinned);
    };
}

export function loadLastFileFromDB(callback) {
    if (!db) return;
    const req = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => {
        const files = e.target.result;
        if (files.length > 0) {
            files.sort((a, b) => b.timestamp - a.timestamp);
            callback(files[0]);
        }
    };
}

export function togglePinInDB(file, callback) {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    file.pinned = !file.pinned;
    tx.objectStore(STORE_NAME).put(file);
    tx.oncomplete = callback;
}

export function updateFileNameInDB(id, newName, callback) {
    if (!db) return callback ? callback() : Promise.resolve();

    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const data = getReq.result;
            if (data) {
                data.name = newName;
                store.put(data);
            }
        };
        tx.oncomplete = () => {
            resolve();
        };
    });

    if (callback) {
        promise.then(callback);
    } else {
        return promise;
    }
}

export function getFileById(id, callback) {
    if (!db) return callback ? callback(null) : Promise.resolve(null);

    const promise = new Promise((resolve) => {
        const req = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id);
        req.onsuccess = (e) => {
            resolve(e.target.result);
        };
    });

    if (callback) {
        promise.then(callback);
    } else {
        return promise;
    }
}

export function findFileByName(name, callback) {
    if (!db) return callback ? callback(null) : Promise.resolve(null);

    const promise = new Promise((resolve) => {
        const req = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = (e) => {
            const files = e.target.result;
            const match = files.filter(f => f.name === name).sort((a, b) => b.timestamp - a.timestamp)[0];
            resolve(match);
        };
    });

    if (callback) {
        promise.then(callback);
    } else {
        return promise;
    }
}

export function clearRecentsInDB(callback) {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.getAll().onsuccess = (e) => {
        e.target.result.forEach(f => {
            if (!f.pinned) store.delete(f.id);
        });
        if (callback) callback();
    };
}

export function deleteFileFromDB(id, callback) {
    if (!db) return callback ? callback() : Promise.resolve();
    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
    if (callback) promise.then(callback);
    else return promise;
}

export function updatePromptNameInDB(id, promptIndex, newName, callback) {
    if (!db) return callback ? callback() : Promise.resolve();
    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
            const record = req.result;
            if (record) {
                if (!record.customPromptNames) record.customPromptNames = {};
                record.customPromptNames[promptIndex] = newName;
                store.put(record);
            }
        };
        tx.oncomplete = () => resolve();
    });
    if (callback) promise.then(callback);
    else return promise;
}

export function revertPromptNameInDB(id, promptIndex, callback) {
    if (!db) return callback ? callback() : Promise.resolve();
    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
            const record = req.result;
            if (record && record.customPromptNames) {
                delete record.customPromptNames[promptIndex];
                store.put(record);
            }
        };
        tx.oncomplete = () => resolve();
    });
    if (callback) promise.then(callback);
    else return promise;
}

export function bulkDeleteFromDB(ids, callback) {
    if (!db) return callback ? callback() : Promise.resolve();
    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
    });
    if (callback) promise.then(callback);
    else return promise;
}

export function bulkPinInDB(ids, pinnedStatus, callback) {
    if (!db) return callback ? callback() : Promise.resolve();
    const promise = new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => {
            const req = store.get(id);
            req.onsuccess = () => {
                const data = req.result;
                if (data) {
                    data.pinned = pinnedStatus;
                    store.put(data);
                }
            };
        });
        tx.oncomplete = () => resolve();
    });
    if (callback) promise.then(callback);
    else return promise;
}

function cleanupHistory() {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.getAll().onsuccess = (e) => {
        const files = e.target.result;
        let unpinned = files.filter(f => !f.pinned).sort((a, b) => b.timestamp - a.timestamp);

        if (unpinned.length > 50) {
            unpinned.slice(50).forEach(f => store.delete(f.id));
        }
    };
}