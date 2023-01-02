import { EventEmitter } from "./eventEmitter.js";

export class Network extends EventEmitter {
    ifaces = []
    lastExtNetwork = null;
    constructor() {
        super()
    }
    async init() {
        this.lastExtNetwork = await window.app.getStore('app-last-network');
        this.updateUI();
        this.emit('ready');
    }

    /**
     * Returns last external network interface used
     * @returns 
     */
    getLastExt() {
        return this.lastExtNetwork;
    }

    /**
     * Sets external network used
     * @param {*} iface 
     */
    async setLastExt(iface) {
        this.lastExtNetwork = iface
        await this.updateUI();
        window.app.setStore('app-last-network', iface)
        this.emit('change')
    }

    /**
     * Updates settings UI selection
     */
    async updateUI() {
        var self = this;
        $('#portSelection').html('')
        self.ifaces = await window.network.list();
        for (var i = 0; i < self.ifaces.length; i++) {
            $('#portSelection').append($('<option/>', {
                value: self.ifaces[i].address,
                text: self.ifaces[i].name + " (" + self.ifaces[i].address + ")",
                selected: (self.lastExtNetwork && self.ifaces[i].address == self.lastExtNetwork)
            }));
        }

        $('#qrcodeRegion').html($('<canvas/>', {
            id: 'qrcode-canvas'
        }));

        var canvas = document.getElementById('qrcode-canvas');
        QRCode.toCanvas(canvas, 'http://' + self.lastExtNetwork + ':3777/tally', { scale: 8 }, function(error) {
            if (error) console.error(error)
        });

        $('#qrcodeRegion').append($('<div/>').append($('<a/>', { href: 'http://' + self.lastExtNetwork + ':3777/tally', text: 'http://' + self.lastExtNetwork + ':3777/tally' })));

    }
}