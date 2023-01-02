'use strict'

const events = require('events').EventEmitter;
const bonjour = require('bonjour')();
const util = require('util');
const { Atem } = require('atem-connection');
const ExternalPortType = require('atem-connection').Enums.ExternalPortType;
const InternalPortType = require('atem-connection').Enums.InternalPortType;

const { ipcMain } = require('electron');
const { ajaxTransport } = require('jquery');

util.inherits(AtemController, events);

module.exports = AtemController;

function AtemController() {
    events.EventEmitter.call(this);
    this.win = null;
    this.tallyServer = null;
    this.devices = new Array()
    this.manualDeviceIp = null
    this.device = new Atem()
    this.activeip = ''
    this.availableCameras = new Array()
    this.previewInputs = new Array()
    this.programInputs = new Array()
    this.searchState = 0
    this.connected = false;
    this.searchOptions = {
        type: "blackmagic",
        txt: {
            'class': "AtemSwitcher"
        }
    };

    return this
}

AtemController.prototype.init = function(tallyServer) {
    this.tallyServer = tallyServer;
}

/**
 * Search the network for ATEM devices
 * @returns An array of ATEM devices. Null when search is running.
 */
AtemController.prototype.searchNetwork = async function() {
    let self = this;
    let results = [];

    if (self.searchState === 1) {
        return null;
    } else {
        self.searchState = 1;
        self.emit('device_search_start');

        let browser = bonjour.find(self.searchOptions, function(s) {
            results.push(s)
            self.emit('device_list_update');
        });

        // Stop the search after 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        browser.stop();
        self.searchState = 0;
        self.devices = results;
        self.emit('device_search_stop');

        global.telemetry.trackAdvancedEvent("atem_network_discovered", { deviceCount: results.length, devices: results });
        return self.devices;
    }
}

AtemController.prototype.connect = function(ip) {
    var self = this;
    // self.device.ip = ip;

    self.activeip = ip;
    self.availableCameras = new Array()

    self.device.connect(ip);
    self.device.on('connected', () => { self.onConnect() });
    self.device.on('disconnected', () => { self.onDisconnect() });
    self.device.on('stateChanged', (state, path) => { self.onChange(state, path) });
}

AtemController.prototype.disconnect = function() {
    var self = this;
    self.device.disconnect();
}

AtemController.prototype.getAtemDeviceType = function(sourceId) {
    var self = this;
    self.device.getSourceInfio(sourceId).type;
}

AtemController.prototype.getStreamState = function() {
    var self = this;
    // Connecting: 2
    // Idle: 1
    // Stopping: 32
    // Streaming: 4
    return (self.device.state && self.device.state.streaming && self.device.state.streaming.status.state != 1);
}

AtemController.prototype.calcInputState = function() {

    var self = this;
    self.previewInputs = [];
    self.programInputs = [];
    Object.keys(self.device.state.video.mixEffects).forEach(function(m) {
        var ME = self.device.state.video.mixEffects[m];

        if (ME.transitionPosition.inTransition) {
            self.programInputs.push(...self.device.listVisibleInputs("preview", ME.index));
            self.programInputs.push(...self.device.listVisibleInputs("program", ME.index));
        } else {
            self.previewInputs.push(...self.device.listVisibleInputs("preview", ME.index));
            self.programInputs.push(...self.device.listVisibleInputs("program", ME.index));
        }
    })

    self.previewInputs = self.previewInputs.filter(function(el) {
        return !self.programInputs.includes(el);
    });

    self.previewInputs = [...new Set(self.previewInputs)];
    self.programInputs = [...new Set(self.programInputs)];
}

/**
 * Refresh camera labels
 * @param {*} self 
 */
AtemController.prototype.refreshCameraLabels = function(self) {
    self.availableCameras = [];
    if (self.device.state.inputs) {
        Object.keys(self.device.state.inputs).forEach(function(key) {
            var input = self.device.state.inputs[key];
            if (input.internalPortType == InternalPortType.External) {
                self.availableCameras.push({
                    id: input.inputId,
                    name: input.longName,
                    shortName: input.shortName,
                    interface: ExternalPortType[input.externalPortType]
                });
            }
        });
        self.emit('update_cameras');
    }
}

AtemController.prototype.onConnect = function() {
    this.emit('connect');
    this.refreshCameraLabels(this);
    this.calcInputState();
    this.connected = true;

    if (this.win) {
        this.win.webContents.send('atem:onconnect', this.createIPCMessage());
        this.win.webContents.send('atem:onupdate', this.createIPCMessage());
    }

    if (this.tallyServer)
        this.tallyServer.sendTally(this.createIPCMessage())

    try { global.telemetry.trackAdvancedEvent("atem_device_info", { device: this.device.state }); } catch (e) {}

}

AtemController.prototype.onDisconnect = function(state) {
    var self = this;
    self.emit('disconnect');
    self.previewInputs = [];
    self.programInputs = [];
    self.availableCameras = new Array();
    self.connected = false;

    if (this.win) {
        self.win.webContents.send('atem:ondisconnect', {});
    }

    try { global.telemetry.trackAdvancedEvent("atem_device_disconnection", {}) } catch (e) {}
}

/**
 * Process the state change and trigger message to renderer
 * @param {*} state 
 * @param {*} paths 
 */
AtemController.prototype.onChange = function(state, paths) {
    var self = this;
    self.emit('changed');

    Object.keys(paths).forEach(function(key) {
        var path = paths[key];
        switch (path.split('.')[0]) {
            case 'inputs':
                // Camera inputs changed
                self.refreshCameraLabels(self);
                self.emit('changed_input');
                break;
            case 'video':
                // All ME changes
                self.calcInputState();
                self.emit('changed_video');
                break;
            case 'streaming':
                // Streaming State Changes
                self.emit('changed_stream');
                break;
        }
    })

    if (self.win)
        self.win.webContents.send('atem:onupdate', self.createIPCMessage());

    if (self.tallyServer)
        self.tallyServer.sendTally(self.createIPCMessage())
}

AtemController.prototype.createIPCMessage = function() {
    var msg = {};
    var self = this;

    msg.previewSourceIds = self.previewInputs;
    msg.programSourceIds = self.programInputs;
    msg.availableCameras = self.availableCameras;
    msg.streamState = self.getStreamState();
    msg.connected = self.connected;
    return msg;
}

// AtemController.prototype.onAtemAllChanges = function() {
//     var self = this;

//     // var msg = self.createIPCMessage();

//     // self.emit('camera_change');
//     // ipcRenderer.send('update_tally', msg);
// }

AtemController.prototype.registerHandlers = function(win) {
    var self = this;

    ipcMain.handle('atem:connect', (event, ip) => { self.connect(ip); })
    ipcMain.handle('atem:disconnect', (event) => { self.disconnect(); })
    ipcMain.handle('atem:search', () => { return self.searchNetwork(); });
    ipcMain.handle('atem:state', () => { return self.createIPCMessage(); });
    // ipcMain.handle('atem:instance', (event) => { return readonly self; })

    if (win) {
        self.win = win
        self.win.webContents.send('atem:onupdate', self.createIPCMessage());
    } else {
        console.error("No window registered");
    }

}