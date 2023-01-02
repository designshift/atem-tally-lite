'use strict'

const bonjour = require('bonjour')({ ttl: 255 });
const { ipcMain } = require('electron');
const os = require('os');
const ifaces = os.networkInterfaces();

const Store = require('electron-store');
const { EventEmitter } = require('events').EventEmitter;
const PiSocket = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');


class DeviceController extends EventEmitter {
    devicesAvailable = []; // List of available devices found on network
    devicesSaved = []; // List of devices saved
    store = null;
    browser = {};
    autoRefresh = null;
    tallyServer = null;
    win = null;

    constructor() {
        super()
        this.store = new Store();
        this.startAutoRefresh();
    }

    init(tallyServer) {
        let self = this;
        this.tallyServer = tallyServer;
        this.tallyServer.on('client_connected', (msg) => { self.onDeviceConnect(msg) }) // returns ipv4
        this.tallyServer.on('client_disconnected', (msg) => { self.onDeviceDisconnect(msg) }) // returns ipv4
        this.tallyServer.on('update_tally', (msg) => {}) // not used
        this.tallyServer.on('stop_tally', (msg) => {}) // not used
        this.tallyServer.on('set_remote', (msg) => {}) // not used
        this.tallyServer.on('call', () => {}) // not used

        let saved = self.store.get('deviceConfiguration')
        if (saved)
            self.devicesSaved = saved
    }

    registerHandlers(win) {
        let self = this;
        self.win = win;
        // ipcMain.handle('client:connect', (event, device) => { return self.onDeviceConnect(device); })
        // ipcMain.handle('client:disconnect', (event) => { return self.onDeviceDisconnect(); })
        ipcMain.handle('client:available', (event) => { return self.devicesAvailable; })
        ipcMain.handle('client:saved', (event) => { return self.devicesSaved; })
        ipcMain.handle('client:save', (event, device) => { return self.saveDevice(device); });
        ipcMain.handle('client:save-by-ip', (event, ip) => { return self.saveDeviceByIp(ip); });
        ipcMain.handle('client:remove', (event, id) => { return self.removeDeviceById(id); });
        ipcMain.handle('client:enable', (event, id) => { return self.enableDevice(id); });
        ipcMain.handle('client:disable', (event, id) => { return self.disableDevice(id); });
        ipcMain.handle('client:set-camera', (event, id, camera) => { return self.setCamera(id, camera); });
        ipcMain.handle('client:identify', (event, id) => { return self.identifyDevice(id); });

        ipcMain.handle('client:tally', (event, msg) => { self.onTally(msg) });
        ipcMain.handle('client:set-remote', (event, msg) => { self.onSetRemote(msg) });
        ipcMain.handle('client:call', (event, msg) => { self.onCall(msg) });

        self.on('update', () => {
            self.win.webContents.send('client:onupdate', self.devicesSaved)
        })
    }

    /**
     * Performs one cycle of device discovery on the network. Times out after 5 seconds.
     */
    async startRefresh() {
        let self = this;
        let res = [];

        self.browser = bonjour.find({ type: 'dsft-tally-pi' }, function(s) {
            res.push(s);
        });

        // Example of device
        // {
        //     addresses: [ '10.0.0.119' ],
        //     name: 'atem-tally-81189f6d',
        //     fqdn: 'atem-tally-81189f6d._dsft-tally-pi._tcp.local',
        //     host: 'atem-tally-81189f6d',
        //     referer: { address: '10.0.0.119', family: 'IPv4', port: 5353, size: 352 },
        //     port: 3778,
        //     type: 'dsft-tally-pi',
        //     protocol: 'tcp',
        //     subtypes: [],
        //     rawTxt: <Buffer 27 69 64 3d 38 31 31 38 39 66 36 64 2d 39 32 38 38 2d 34 31 35 61 2d 38 33 31 31 2d 30 34 33 61 65 64 32 39 31 65 39 63 0d 76 65 72 73 69 6f 6e 3d 31 ... 30 more bytes>,
        //     txt: {
        //       id: '81189f6d-9288-415a-8311-043aed291e9c',
        //       version: '1.1.0',
        //       hardware: 'BCM2835',
        //       camera: '1'
        //     }
        //   }

        // Stop the search after 15 seconds
        setTimeout(function() {
            self.store.set("devicesAvailable", res);
            self.devicesAvailable = res;
            self.emit('available_device_change', res);
            return res;
        }, 5000);
    }

    /**
     * Stop all device discovery. Alias for stopAutoRefresh()
     */
    stopRefresh() {
        this.stopAutoRefresh();
    }

    /**
     * Repeat device discovery every 2 minutes
     */
    startAutoRefresh() {
        let self = this;
        self.startRefresh();
        // Repeat search every 2 minutes
        self.autoRefresh = setInterval(function() {
            self.startRefresh();
        }, 120000)
    }

    /**
     * Stop all device discovery
     */
    stopAutoRefresh() {
        let self = this;
        self.browser.stop();
        cleanInterval(self.autoRefresh);
    }

    getAvailDeviceByIp(deviceIp) {
        let d = this.devicesAvailable;
        let res;

        deviceIp = deviceIp.toString().replace("::ffff:", "") // Support IPv4 only

        Object.keys(d).forEach(function(k) {
            if (d[k].addresses[0] == deviceIp)
                res = d[k];
        });
        return res;
    }

    /**
     * Saves a device to saved list
     * @param {*} device 
     */
    saveDevice(device) {
        let self = this;
        self.devicesSaved.push(device)
        self.enableDevice(device.txt.id)
        self.updateDeviceConfigStore()
        self.emit('update')
    }

    /**
     * Saves a device to saved list
     * @param {*} device 
     */
    saveDeviceByIp(ip) {
        let self = this;
        let device = null;

        if (!ip)
            return;

        ip = ip.toString().replace("::ffff:", "")

        device = self.getAvailDeviceByIp(ip)

        if (!device) {
            // Create a manual entry with required properties
            let uuid = uuidv4()
            let uuidShort = uuid.substring(0, 7)

            device = {
                addresses: [ip],
                name: 'custom-' + uuidShort,
                fqdn: 'custom-' + uuidShort,
                host: 'custom-' + uuidShort,
                referer: { address: ip, family: 'IPv4', port: 5353, size: 352 },
                port: 3778,
                type: 'dsft-tally-custom',
                protocol: 'tcp',
                subtypes: [],
                txt: {
                    id: uuid,
                    hardware: 'CUSTOM',
                    camera: '1'
                },
            }
        }

        self.saveDevice(device);
    }

    /**
     * Removes a device from saved list and force it to disconnect
     * @param {*} device 
     */
    removeDevice(device) {
        let self = this;
        let d = self.disableDevice(device.txt.id)

        if (d) {
            self.devicesSaved = self.devicesSaved.filter((ele) => {
                return (ele.txt.id != d.txt.id)
            })
            self.updateDeviceConfigStore()
            self.emit('update')
        }
    }

    removeDeviceById(id) {
        let self = this;
        let d = self.getSavedDeviceById(id)

        if (d) {
            self.removeDevice(d)
            return d
        } else {
            return null
        }
    }

    /**
     * Set state of a saved device as enabled and starts connection
     * @param {*} device 
     * @returns The device id to be enabled. Null otherwise.
     */
    enableDevice(deviceId) {
        let self = this;
        let d = self.getSavedDeviceById(deviceId);

        if (d) {
            d.enabled = true;
            self.connect(d);
            self.updateDeviceConfigStore();
            return d;
        } else {
            return null;
        }
    }

    /**
     * Set state of a saved device as disabled and disconnects the device
     * @param {*} deviceId 
     * @returns The device id to be deleted
     */
    disableDevice(deviceId) {
        let self = this;
        let d = self.getSavedDeviceById(deviceId);

        if (d) {
            d.enabled = false;
            self.disconnect(d);
            self.updateDeviceConfigStore();
            return d;
        } else {
            return null;
        }
    }

    updateDeviceConfigStore(device) {
        let self = this;
        self.store.set('deviceConfiguration', self.devicesSaved)
    }

    /**
     * Returns device if it is saved. Null otherwise.
     * @param {*} device 
     * @returns device
     */
    getSavedDevice(device) {
        let self = this;
        let res = null;
        Object.keys(self.devicesSaved).forEach((d) => {
            if (device.txt.id == self.devicesSaved[k].txt.id)
                res = self.devicesSaved[k];
        });
        return res;
    }

    getSavedDeviceById(deviceId) {
        let d = this.devicesSaved;
        let res;
        Object.keys(d).forEach(function(k) {
            if (d[k].txt.id == deviceId)
                res = d[k];
        });
        return res;
    }

    getSavedDeviceByIp(deviceIp) {
        let d = this.devicesSaved;
        let res;

        deviceIp = deviceIp.replace("::ffff:", "") // Support IPv4 only

        Object.keys(d).forEach(function(k) {
            if (d[k].addresses[0] == deviceIp)
                res = d[k];
        });
        return res;
    }

    /**
     * Returns device if it is enabled. Null otherwise.
     * @param {*} device 
     * @returns device
     */
    getEnabledDevice(device) {
        let self = this;
        let d = self.getSavedDevice(device);
        if (d) {
            return (d.enabled) ? d : null;
        } else {
            return null;
        }
    }

    getDeviceList() {
        let self = this;
        return {
            devicesAvailable: self.devicesAvailable,
            devicesSaved: self.devicesSaved
        }
    }

    /// DEVICE ACTIONS
    /**
     * Connect to a client device and publish a message to connect to this host
     * @param {*} device 
     */
    connect(device) {
        let self = this;
        let clientip = device.addresses[0]
        let hostUri = "http://" + this.store.get('app-last-network') + ":3777";

        let socket = new PiSocket("http://" + clientip + ":3778");

        socket.on('connect', function() {
            socket.emit('pi_host_connect', hostUri);
            socket.disconnect();
        });
        socket.on('connect_error', function(err) {
            socket.disconnect();
        })
    }

    /**
     * Disconnects a client device
     * @param {*} device 
     */
    disconnect(device) {
        let self = this;
        let deviceIp = device.addresses[0];
        self.tallyServer.sendStopTally(deviceIp)
    }

    callAll() {
        let self = this;
        let msg = null;

        self.tallyServer.sendCallAll()
    }

    setCamera(deviceId, camera) {
        let self = this;
        let msg = {
            devId: deviceId,
            camera: parseInt(camera)
        }
        let d = self.getSavedDeviceById(deviceId)

        if (d) {
            d.txt.camera = parseInt(camera)
            self.tallyServer.sendSetRemote(msg)
            self.updateDeviceConfigStore()
        }
        self.emit('update')
    }

    identifyDevice(deviceId) {
        let msg = {
            devId: deviceId,
            identify: 1
        }
        ipcRenderer.send('set_remote', msg);
    }

    /// MESSAGE HANDLERS
    /**
     * Event handler for client connections detected
     * @param {*} deviceIp 
     */
    onDeviceConnect(deviceIp) {
        let self = this;
        let d = self.getSavedDeviceByIp(deviceIp);
        if (d)
            d.connected = true;

        self.emit('update')

    }

    /**
     * Event handler for client disconnections detected
     * @param {*} deviceIp 
     */
    onDeviceDisconnect(deviceIp) {
        let self = this;
        let d = self.getSavedDeviceByIp(deviceIp);
        if (d)
            d.connected = false;

        self.emit('update')
    }

    onTally(msg) {}
    onSetRemote(msg) {}
    onCall() {}

}

module.exports = DeviceController;