const os = require('os');
const ifaces = os.networkInterfaces();
const { ipcMain } = require('electron');

class Network {
    interfaces = [];
    constructor() {
        var self = this;
        ipcMain.handle('network:list', () => { return self.list(); })
    }

    list() {
        var results = [];

        Object.keys(ifaces).forEach(function(ifname) {
            var alias = 0;
            ifaces[ifname].forEach(function(iface) {
                if ('IPv4' !== iface.family || iface.internal !== false || ifname.indexOf('*') > 0) {
                    return;
                }

                if (alias >= 1) {
                    // this single interface has multiple ipv4 addresses
                    results.push({
                        name: ifname + ":" + alias,
                        address: iface.address
                    })
                } else {
                    // this interface has only one ipv4 adress
                    results.push({
                        name: ifname,
                        address: iface.address
                    })
                }
                ++alias;
            });
        });

        this.interfaces = results;
        return results;
    }
}

module.exports = Network;