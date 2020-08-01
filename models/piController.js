// const Store = require('electron-store');
const bonjour = require('bonjour')();
const PiSocket = require('socket.io-client');
const os = require('os');
const ifaces = os.networkInterfaces();
const { ipcRenderer } = require('electron');

module.exports = PiController;

function PiController() {
    this.devicesAvailable = []; // List of available devices found on network
    this.devicesEnabled = []; // List of devices to connect to
    // this.devicesActive = [];
    // this.store = new Store();
    this.browser = {};

    // if (store.get('pi-enabled'))
    //     this.devicesEnabled = store.get('pi-enabled');
}

PiController.prototype.enableDevice = function(deviceIp, callback) {
    var self = this;
    var socket = new PiSocket("http://" + deviceIp + ":3778");
    self.devicesEnabled.push(deviceIp);
    console.log("Turning on pi " + deviceIp);
    socket.on('connect', function() {
        socket.emit('pi_host_connect', self.getDeviceIp());
        socket.disconnect();
    });
}

PiController.prototype.disableDevice = function(deviceIp, callback) {
    console.log("Stopping " + deviceIp);
    ipcRenderer.send('stop_tally', deviceIp);
    if (callback)
        callback(null);
}

PiController.prototype.getDeviceIp = function() {
    var res = null;
    Object.keys(ifaces).forEach(function(ifname) {
        var alias = 0;
        ifaces[ifname].forEach(function(iface) {
            if ('IPv4' !== iface.family || iface.internal !== false || ifname.indexOf('*') > 0) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias === 0)
                res = "http://" + iface.address + ":3777";
            alias++;
        });
    });
    return res;
}

PiController.prototype.getAvailableDevices = function() {
    return this.devicesAvailable;
}

PiController.prototype.getEnabledDevices = function() {
    return this.devicesEnabled;
}

PiController.prototype.isEnabled = function(deviceIp) {
    return (this.devicesEnabled.includes(deviceIp));
}

PiController.prototype.refreshDeviceList = function(callback) {
    var self = this;
    console.log("Searching for Pis");
    self.devicesAvailable = [];

    browser = bonjour.find({ type: 'dsft-tally-pi' }, function(s) {
        console.log(s);
        self.devicesAvailable.push(s)
    });

    // Stop the search after 5 seconds
    setTimeout(function() {
        browser.stop();
        if (callback)
            callback(null);
    }, 5000);
    return;
}