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
    this.previewSourceIds = [];
    this.programSourceIds = [];
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
        var previewEnabled = [];
        var programEnabled = [];
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
                    self.emit('update_cameras');
                    // if (state.video.ME[0]) {
                    //     previewEnabled.push(state.video.ME[0].previewInput);
                    //     programEnabled.push(state.video.ME[0].programInput);
                    //     self.onAtemPreviewChange(previewEnabled);
                    //     self.onAtemProgramChange(programEnabled);
                    // }
                }
            case 'video.ME.0.fadeToBlack':


                // video.ME.0.fadeToBlack for FTB

            default:
                // console.log(state.video.ME[0].previewInput);
                if (path.split('.')[0] != 'info') {
                    console.log(state);
                    console.log(path);
                }

                if ((path.split('.')[0] == 'video' || (path == 'info' && self.activeatem.state.inputs)) && state.video.ME[0]) {
                    if (state.video.ME[0].inTransition) {
                        programEnabled.push(state.video.ME[0].programInput);
                        programEnabled.push(state.video.ME[0].previewInput);

                        if (state.video.ME[0].upstreamKeyers[0] && (state.video.ME[0].transitionProperties.selection & (1 << 1) || state.video.ME[0].upstreamKeyers[0].onAir)) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[0].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[1] && (state.video.ME[0].transitionProperties.selection & (1 << 2) || state.video.ME[0].upstreamKeyers[1].onAir)) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[1].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[2] && (state.video.ME[0].transitionProperties.selection & (1 << 3) || state.video.ME[0].upstreamKeyers[2].onAir)) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[2].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[3] && (state.video.ME[0].transitionProperties.selection & (1 << 4) || state.video.ME[0].upstreamKeyers[3].onAir)) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[3].fillSource);
                        }
                    } else {
                        previewEnabled.push(state.video.ME[0].previewInput);
                        programEnabled.push(state.video.ME[0].programInput);
                        if (state.video.ME[0].upstreamKeyers[0] && state.video.ME[0].upstreamKeyers[0].onAir) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[0].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[1] && state.video.ME[0].upstreamKeyers[1].onAir) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[1].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[2] && state.video.ME[0].upstreamKeyers[2].onAir) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[2].fillSource);
                        }
                        if (state.video.ME[0].upstreamKeyers[3] && state.video.ME[0].upstreamKeyers[3].onAir) {
                            programEnabled.push(state.video.ME[0].upstreamKeyers[3].fillSource);
                        }
                    }

                    if (state.video.ME[0].transitionProperties.selection & (1 << 1)) {
                        if (state.video.ME[0].upstreamKeyers[0])
                            previewEnabled.push(state.video.ME[0].upstreamKeyers[0].fillSource);
                    }
                    if (state.video.ME[0].transitionProperties.selection & (1 << 2)) {
                        if (state.video.ME[0].upstreamKeyers[1])
                            previewEnabled.push(state.video.ME[0].upstreamKeyers[1].fillSource);
                    }
                    if (state.video.ME[0].transitionProperties.selection & (1 << 3)) {
                        if (state.video.ME[0].upstreamKeyers[2])
                            previewEnabled.push(state.video.ME[0].upstreamKeyers[2].fillSource);
                    }
                    if (state.video.ME[0].transitionProperties.selection & (1 << 4)) {
                        if (state.video.ME[0].upstreamKeyers[3])
                            previewEnabled.push(state.video.ME[0].upstreamKeyers[3].fillSource);
                    }

                    if (state.video.downstreamKeyers[0] && (state.video.downstreamKeyers[0].onAir || state.video.downstreamKeyers[0].inTransition))
                        programEnabled.push(state.video.downstreamKeyers[0].sources.fillSource);
                    if (state.video.downstreamKeyers[1] && (state.video.downstreamKeyers[1].onAir || state.video.downstreamKeyers[1].inTransition))
                        programEnabled.push(state.video.downstreamKeyers[1].sources.fillSource);
                    if (state.video.downstreamKeyers[2] && (state.video.downstreamKeyers[2].onAir || state.video.downstreamKeyers[2].inTransition))
                        programEnabled.push(state.video.downstreamKeyers[2].sources.fillSource);
                    if (state.video.downstreamKeyers[3] && (state.video.downstreamKeyers[3].onAir || state.video.downstreamKeyers[3].inTransition))
                        programEnabled.push(state.video.downstreamKeyers[3].sources.fillSource);

                    previewEnabled.push(state.video.ME[0].previewInput);
                    programEnabled.push(state.video.ME[0].programInput);

                    self.onAtemPreviewChange(previewEnabled);
                    self.onAtemProgramChange(programEnabled);
                }

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
    self.previewSourceIds = [];
    self.programSourceIds = [];
    self.availableCameras = [];
}

AtemController.prototype.onAtemPreviewChange = function(sourceIds) {
    var self = this;
    console.log("Preview changed to ");
    console.log(sourceIds);
    self.previewSourceIds = sourceIds;

    self.emit('preview_change');
    self.onAtemAllChanges();
}

AtemController.prototype.onAtemProgramChange = function(sourceIds) {
    var self = this;
    console.log("Program changed to ");
    console.log(sourceIds);
    self.programSourceIds = sourceIds;

    self.emit('program_change');
    self.onAtemAllChanges();
}

AtemController.prototype.createIPCMessage = function() {
    var msg = {};
    var self = this;

    msg.previewSourceIds = self.previewSourceIds;
    msg.programSourceIds = self.programSourceIds;
    msg.availableCameras = self.availableCameras;

    return msg;
}

AtemController.prototype.onAtemAllChanges = function() {
    var self = this;
    var msg = self.createIPCMessage();

    self.emit('camera_change');
    ipcRenderer.send('update_tally', msg);
}