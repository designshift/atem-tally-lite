// const Store = require('electron-store');
const bonjour = require('bonjour')();
const PiSocket = require('socket.io-client');
const os = require('os');
const ifaces = os.networkInterfaces();
const util = require('util');
const events = require('events').EventEmitter;
const { ipcRenderer } = require('electron');
const { telemetryTypeToBaseType } = require('applicationinsights/out/Declarations/Contracts');
util.inherits(PiController, events);

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

PiController.prototype.enableDevice = function(deviceId, callback) {
    var self = this;
    var d = self.getDeviceById(deviceId);
    var deviceIp = d.addresses[0];
    var socket = new PiSocket("http://" + deviceIp + ":3778");
    console.log("Turning on pi " + deviceIp + "; this device " + self.getHostIp());
    socket.on('connect', function() {
        socket.emit('pi_host_connect', self.getHostIp());
        socket.disconnect();
        if (callback)
            callback(null);
    });
    self.setDeviceConfigEnabled(deviceId, true);
}

PiController.prototype.getDeviceById = function(deviceId) {
    var d = this.devicesAvailable;
    var res;
    Object.keys(d).forEach(function(k) {
        if (d[k].txt.id == deviceId)
            res = d[k];
    });
    return res;
}

PiController.prototype.getDeviceByIp = function(deviceIp) {
    var d = this.devicesAvailable;
    var res;
    Object.keys(d).forEach(function(k) {
        if (d[k].addresses[0] == deviceIp)
            res = d[k];
    });
    return res;
}

PiController.prototype.disableDevice = function(deviceId, callback) {
    var self = this;
    var deviceIp = self.getDeviceById(deviceId).addresses[0];
    console.log("Stopping " + deviceIp);
    ipcRenderer.send('stop_tally', deviceIp);
    self.setDeviceConfigEnabled(deviceId, false);
    if (callback)
        callback(null);
}

PiController.prototype.getDeviceConfigEnabled = function(deviceId) {
    var d = this.getDeviceConfigStorage(deviceId);
    return (d && d.settings && d.settings.enabled) ? true : false;
}

PiController.prototype.setDeviceConfigEnabled = function(deviceId, enabled) {
    var d = this.getDeviceConfigStorage(deviceId);
    if (!d) {
        d = { id: deviceId, settings: {} }
    }
    if (!d.settings) {
        d.settings = {};
    }
    d.settings.enabled = enabled;
    this.setDeviceConfigStorage(deviceId, d.settings);
}

PiController.prototype.getDeviceConfigCamera = function(deviceId) {
    var d = this.getDeviceConfigStorage(deviceId);
    return (d && d.settings && d.settings.camera) ? d.settings.camera : -1;
}

PiController.prototype.setDeviceConfigCamera = function(deviceId, camera) {
    var d = this.getDeviceConfigStorage(deviceId);
    if (!d) {
        d = { id: deviceId, settings: {} }
    }
    if (!d.settings) {
        d.settings = {};
    }
    d.settings.camera = camera;
    this.setDeviceConfigStorage(deviceId, d.settings);
}

PiController.prototype.getDeviceConfigStorage = function(deviceId) {
    var res = null;
    if (store.get("devicesConfigured")) {
        var d = store.get("devicesConfigured");
        Object.keys(d).forEach(function(k) {
            if (d[k].id == deviceId)
                res = d[k];
        });
    }
    return res;
}

PiController.prototype.setDeviceConfigStorage = function(deviceId, settings) {
    var td = { id: deviceId, settings: settings }
    if (store.get("devicesConfigured")) {
        var d = store.get("devicesConfigured");
        var f = false;
        Object.keys(d).forEach(function(k) {
            if (d[k].id == deviceId) {
                d[k] = td;
                f = true;
            }
        });
        if (!f) {
            d.push(td);
        }

    } else {
        var d = [];
        d.push(td)
    }
    store.set("devicesConfigured", d);
}

PiController.prototype.getHostIp = function() {
    var res = null;

    res = "http://" + networkInterface + ":3777";

    return res;
}

PiController.prototype.getAvailableDevices = function() {
    return this.devicesAvailable;
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
        store.set("devicesAvailable", self.devicesAvailable);
        telemetry.trackAdvancedEvent("pi_device_list", { devices: self.devicesAvailable });
        if (callback)
            callback(null);
    }, 5000);
    return;
}

PiController.prototype.callAll = function() {
    var self = this;
    var msg = null;

    ipcRenderer.send('call', msg);
}

PiController.prototype.setCamera = function(deviceId, camera) {
    var msg = {
        devId: deviceId,
        camera: camera
    }
    this.setDeviceConfigCamera(deviceId, camera);
    ipcRenderer.send('set_remote', msg);
}

PiController.prototype.identifyCamera = function(deviceId) {
    var msg = {
        devId: deviceId,
        identify: 1
    }
    ipcRenderer.send('set_remote', msg);
}