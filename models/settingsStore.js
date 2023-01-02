const { ipcMain } = require('electron');
const Store = require('electron-store');

class SettingsStore {
    constructor() {
        this.store = new Store();
        this.registerHandlers();
    }

    get(key) {
        var res = this.store.get(key);
        return res;
    }

    set(key, value) {
        this.store.set(key, value);
    }

    registerHandlers() {
        var self = this;
        ipcMain.handle('app:store-get', (event, key) => { return self.get(key); })
        ipcMain.handle('app:store-set', (evet, key, value) => { self.set(key, value) })
    }
}

module.exports = SettingsStore;