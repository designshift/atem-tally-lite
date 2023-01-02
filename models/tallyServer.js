'use strict'

const express = require('express');
const expressApp = require('express')();
const EventEmitter = require('events');
const http = require('http').createServer(expressApp);
const path = require('path');
const io = require('socket.io')(http, { maxHttpBufferSize: 1e8, allowEIO3: true });
const TallyRouter = require('../routes/Tally');



class TallyServer extends EventEmitter {
    clients = [];
    io = null;
    http = null;
    host = '';
    previewSourceIds = []
    programSourceIds = []
    availableCameras = []
    lastMsg = null

    constructor() {
        super();
        this.io = io;
        this.http = http;
    }

    /**
     * Sends a tally updated message
     * @param {*} previewSourceIds List of source IDs that are in preview
     * @param {*} programSourceIds List of source IDs that are visible
     * @param {*} availableCameras List of all sources
     */
    sendTally(msg) {
        var self = this;
        self.lastMsg = msg;

        self.emit('update_tally', msg);
        self.io.emit('update_tally', msg);
    }

    resendTally() {
        let self = this;
        if (self.lastMsg) {
            self.emit('update_tally', self.lastMsg);
            self.io.emit('update_tally', self.lastMsg);
        }
    }

    /**
     * Sends call message
     */
    sendCallAll() {
        var self = this;
        self.emit('call');
        self.io.emit('call');
    }

    /**
     * Sets remote configuration on the client
     * @param {*} msg 
     */
    sendSetRemote(msg) {
        var self = this;
        self.emit('set_remote', msg);
        self.io.emit('set_remote', msg);
    }

    /**
     * Sends message for client to disconnect
     * @param {} msg 
     */
    sendStopTally(msg) {
        var self = this;
        self.io.emit('stop_tally', msg);
    }

    onCall() {
        var self = this;
        self.emit('call');
    }

    /**
     * Event handler for each client connection. Publishes a 'client_connected' event with the client IP address.
     * @param {*} socket 
     */
    onConnect(socket) {
        var self = this;
        self.emit('client_connected', socket.conn.remoteAddress);
        self.resendTally(); // Push last state to new clients
    }

    /**
     * Event handler for each client disconnection. Publishes a 'client_disconnected' event with the client IP address.
     * @param {*} socket 
     */
    onDisconnect(socket) {
        var self = this;
        self.emit('client_disconnected', socket.conn.remoteAddress)
    }

    /**
     * Event handler when set_remote is published. Not used currently
     */
    onSetRemote() {

    }

    onStopTally(msg) {

    }

    /**
     * Starts a local webserver to host web clients
     * @param {} callback 
     */
    startServer(callback) {
        var self = this;

        self.http.listen(3777, (errors) => {
            if (callback)
                callback(errors);
            console.log("Web server started on port 3777");
        });

        expressApp.set('views', path.join(__dirname, '..', 'views'));
        expressApp.set('view engine', 'pug');
        expressApp.use(express.static(path.join(__dirname, '..', 'static')));
        expressApp.use('/nosleep', express.static(path.join(__dirname, '..', 'node_modules', 'nosleep.js', 'dist')));
        expressApp.use('/jscookie', express.static(path.join(__dirname, '..', 'node_modules', 'js-cookie', 'dist')));
        expressApp.use('/socketio', express.static(path.join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist')));
        expressApp.use('/jquery', express.static(path.join(__dirname, '..', 'node_modules', 'jquery', 'dist')));
        expressApp.use('/bootstrap', express.static(path.join(__dirname, '..', 'node_modules', 'bootstrap', 'dist')));
        expressApp.use('/css', express.static(path.join(__dirname, '..', 'content', 'css')));

        expressApp.use('/', TallyRouter);

        self.io.on('connection', (socket) => {
            self.onConnect(socket);
            socket.on('capability', function(msg) {
                // console.log(msg);
            })

            socket.on('call', function() {
                self.onCall();
            });

            socket.on('disconnect', function() {
                self.onDisconnect(socket)
            });


            // Not used below
            socket.on('set_remote', function() {
                self.onCall();
            });

            socket.on('stop_tally', function(msg) {
                self.onStopTally(msg);
            });

        })
    }

    stopServer = (callback) => {
        var self = this;
        self.http.close((errors) => {
            callback(errors);
        });
    }

    restartServer = (callback) => {
        var self = this;
        self.stopServer();
        self.startServer();
    }
}

module.exports = TallyServer;