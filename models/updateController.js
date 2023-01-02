const VersionCheck = require('github-version-checker');
const { ipcMain } = require('electron');

class UpdateController {
    version = '';
    hasUpdate = false;
    update = null;
    win = null;

    constructor(version) {
        let self = this;
        this.version = version;
        this.checkUpdates();
        ipcMain.handle('app:update', () => { return self.getUpdates(); });
    }

    checkUpdates() {
        let self = this;
        let options = {
            repo: 'atem-tally-lite', // repository name
            owner: 'designshift', // repository owner
            currentVersion: self.version, // your app's current version
            excludePrereleases: true
        };
        VersionCheck(options, function(error, update) { // callback function
            if (update) {
                self.hasUpdate = true;
                self.update = update;
            }
        });
    }

    getUpdates() {
        var self = this;
        var msg = {
            hasUpdate: self.hasUpdate,
            update: self.update
        }
        return msg;
    }

}

module.exports = UpdateController;