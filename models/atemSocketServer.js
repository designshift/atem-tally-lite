'use strict'

const events = require('events').EventEmitter;
const util = require('util');
const express = require('express');
const expressApp = require('express')();
const http = require('http').createServer(expressApp);
const path = require('path');
const io = require('socket.io')(http);
const TallyRouter = require('../routes/Tally');
const remote = require('electron').remote;
util.inherits(AtemSocketServer, events);

module.exports = AtemSocketServer;

function AtemSocketServer() {
    events.EventEmitter.call(this);
    this.io = io;
    this.http = http;
    this.host = '';
    this.previewSourceIds = [];
    this.programSourceIds = [];
    this.availableCameras = {};

    return this;
}

AtemSocketServer.prototype.createTallyStateMessage = () => {
    var self = this;
    var msg = {};

    msg.previewSourceIds = self.previewSourceIds;
    msg.programSourceIds = self.programSourceIds;
    msg.availableCameras = self.availableCameras;

    return msg;
}

AtemSocketServer.prototype.newClient = () => {
    var self = global.socketServer;

    var msg = {};

    msg.previewSourceIds = self.previewSourceIds;
    msg.programSourceIds = self.programSourceIds;
    msg.availableCameras = [];

    Object.keys(self.availableCameras).forEach(function(key) {
            msg.availableCameras.push({
                sourceID: key,
                name: self.availableCameras[key].name,
                abbreviation: self.availableCameras[key].abbreviation,
                interface: self.availableCameras[key].interface,
            });
        })
        // console.log("New client message sent");
        // console.log(msg);
    self.io.emit('update_tally', msg);
}

AtemSocketServer.prototype.updateTally = (previewSourceIds, programSourceIds, availableCameras) => {
    var self = global.socketServer;
    // console.log("Updating tally");

    self.previewSourceIds = previewSourceIds;
    self.programSourceIds = programSourceIds;
    self.availableCameras = availableCameras;

    var msg = {};

    msg.previewSourceIds = self.previewSourceIds;
    msg.programSourceIds = self.programSourceIds;
    msg.availableCameras = [];

    Object.keys(self.availableCameras).forEach(function(key) {
        msg.availableCameras.push({
            sourceID: key,
            name: self.availableCameras[key].name,
            abbreviation: self.availableCameras[key].abbreviation,
            interface: self.availableCameras[key].interface,
        });
    })

    self.emit('update_tally');
    self.io.emit('update_tally', msg);
}

AtemSocketServer.prototype.stopTally = (msg) => {
    var self = global.socketServer;
    self.io.emit('stop_tally', msg);
}

AtemSocketServer.prototype.startServer = (callback) => {
    var self = this;

    http.listen(3777, (errors) => {
        if (callback)
            callback(errors);
        console.log("Web server started on port 3777");
    });

    expressApp.set('views', path.join(__dirname, '..', 'views'));
    expressApp.set('view engine', 'pug');
    expressApp.use(express.static(path.join(__dirname, '..', 'static')));

    expressApp.use('/', TallyRouter);

    io.on('connection', (socket) => {
        console.log('user connected');
        // Broadcast client
        global.socketServer.newClient();

        // Data from client socket


        // CALL from clients?!
        // socket.on('page_station', function(msg) {
        //     // io.emit('page_all', msg)
        // });

        // socket.on('page_all', function(msg) {
        //     io.emit('page_all', msg)
        // });

        socket.on('update_tally', function(msg) {
            console.log("update tally msg received");
            io.emit('update_tally', msg);
        });
        socket.on('disconnect', function() {
            console.log('user disconnected');
        });
    })
}

AtemSocketServer.prototype.stopServer = (callback) => {
    var self = this;
    http.close((errors) => {
        callback(errors);
    });
}

AtemSocketServer.prototype.restartServer = (callback) => {
    var self = this;
    self.stopServer();
    self.startServer();
}