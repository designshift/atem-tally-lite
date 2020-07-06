'use strict'

const events = require('events').EventEmitter;
const bonjour = require('bonjour')();
const util = require('util');
const { Atem } = require('atem-connection');
const AtemExtPortType = require('atem-connection').Enums.ExternalPortType;
const { ipcRenderer } = require('electron');
util.inherits(AtemController, events);

module.exports = AtemController;

function AtemController() {
    events.EventEmitter.call(this);
    this.devices = [];
    this.manualDeviceIp = null;
    this.activeatem = new Atem({ externalLog: console.log });
    this.activeip = '';
    this.availableCameras = [];
    this.previewSourceId = -1;
    this.programSourceId = -1;
    this.searchState = 0;
    this.searchOptions = {
        type: "blackmagic",
        txt: {
            'class': "AtemSwitcher"
        }
    };

    return this.activedevice;
}

AtemController.prototype.updateDeviceList = function(callback) {
    let self = this;

    // Clear full device list
    self.devices = [];
    self.searchState = 1;
    self.emit('device_search_start');

    // Search the network for ATEM switcher devices
    let browser = bonjour.find(self.searchOptions, function(s) {
        console.log(s);
        self.devices.push(s)
        self.emit('device_list_update');
    });

    // Stop the search after 15 seconds
    setTimeout(function() {
        browser.stop();
        self.searchState = 1;
        self.emit('device_search_stop');
        callback(null, self.devices);
    }, 5000);
    return;
}

AtemController.prototype.selectDevice = function(ip) {
    var self = this;
    // self.activeatem.ip = ip;

    self.activeip = ip;
    self.activeatem.connect(ip);
    self.activeatem.on('connected', function() {

    });

    self.availableCameras = new Array();

    self.activeatem.on('stateChanged', function(state, path) {
        switch (path) {
            case 'reconnect':
                self.onAtemDisconnection();
                break;
            case 'info':
                self.onAtemConnection();

                // Repopulate camera list
                var inputs = self.activeatem.state.inputs;
                if (inputs) {
                    Object.keys(inputs).forEach(function(key) {
                        var input = inputs[key];
                        if (input.isExternal && input.internalPortType == 0) {
                            self.availableCameras["SID_" + input.inputId] = {
                                id: input.inputId,
                                name: input.longName,
                                abbreviation: input.shortName,
                                interface: AtemExtPortType[input.externalPortType]
                            }
                        }

                    });
                    if (state.video.ME[0]) {
                        self.emit('update_cameras');
                        self.onAtemPreviewChange(state.video.ME[0].previewInput);
                        self.onAtemProgramChange(state.video.ME[0].programInput);
                    }
                }
                break;
            case 'video.ME.0.transition':
                // video.ME.0.transition for AUTO transition
            case 'video.ME.0.fadeToBlack':
                // video.ME.0.fadeToBlack for FTB
            case 'video.ME.0.upstreamKeyers.0.onAir':
                // video.ME.0.upstreamKeyers.0.onAir Upstream key active for KEY 1
            default:
                // console.log(state.video.ME[0].previewInput);
                if (path.split('.')[0] == 'video' && state.video.ME[0]) {
                    self.onAtemPreviewChange(state.video.ME[0].previewInput);
                    self.onAtemProgramChange(state.video.ME[0].programInput);
                }
                if (path.split('.')[0] != 'info')
                    console.log(path);
                break;
        }
    });

    self.activeatem.on('disconnected', function() {
        self.onAtemDisconnection();
    });
}

AtemController.prototype.disconnectDevice = function() {
    var self = this;
    console.log("Clearing cameras");
    self.availableCameras = [];
    self.activeatem.disconnect();
}

AtemController.prototype.getAtemDeviceType = function(sourceId) {
    var self = this;
    self.activeatem.getSourceInfio(sourceId).type;
}

AtemController.prototype.onAtemConnection = function() {
    var self = this;
    self.emit('connect');
}

AtemController.prototype.onAtemDisconnection = function() {
    var self = this;
    self.emit('disconnect');
    self.previewSourceId = -1;
    self.programSourceId = -1;
    self.availableCameras = [];
}

AtemController.prototype.onAtemPreviewChange = function(sourceId) {
    var self = this;
    console.log("Preview changed to " + sourceId);
    self.previewSourceId = sourceId;

    self.emit('preview_change');
    self.onAtemAllChanges();
}

AtemController.prototype.onAtemProgramChange = function(sourceId) {
    var self = this;
    console.log("Program changed to " + sourceId);
    self.programSourceId = sourceId;

    // io.updateTally(
    //     self.previewSourceId,
    //     self.programSourceId,
    //     self.availableCameras
    // );

    self.emit('program_change');
    self.onAtemAllChanges();
}

AtemController.prototype.createIPCMessage = function() {
    var msg = {};
    var self = this;

    msg.previewSourceId = self.previewSourceId;
    msg.programSourceId = self.programSourceId;
    msg.availableCameras = self.availableCameras;

    return msg;
}

AtemController.prototype.onAtemAllChanges = function() {
    var self = this;
    var msg = self.createIPCMessage();

    self.emit('camera_change');
    ipcRenderer.send('update_tally', msg);
}