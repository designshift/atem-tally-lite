import { EventEmitter } from "./eventEmitter.js";

class AtemClient extends EventEmitter {
    ip = ''
    controller = null;
    state = {
        previewSourceIds: null,
        programSourceIds: null,
        availableCameras: null,
        streamState: null,
        connected: false
    }
    constructor() {
        super()
    }

    /**
     * Initializes ATEM client
     */
    init() {
        var self = this;
        window.atem.onUpdate((event, state) => self.onUpdate(event, state));
        window.atem.onConnect((event, state) => self.onConnect(event, state));
        window.atem.onDisconnect((event, state) => self.onDisconnect(event, state));
    }

    /**
     * Search the network for ATEM devices
     * @returns Array of objects containing ATEM devices found on the network
     */
    async search() {
        let results = await window.atem.search();
        return results;
    }

    /**
     * Connects to an ATEM device
     * @param {*} ip IP address
     * @param {*} callback Callback when the connection is completed
     */
    async connect(ip, callback) {
        this.ip = ip;
        await window.atem.connect(ip);
        if (callback)
            callback(null);
    }

    /**
     * Disconnects the ATEM device
     * @param {*} callback 
     */
    async disconnect(callback) {
        await window.atem.disconnect();
        this.state = {
            previewSourceIds: null,
            programSourceIds: null,
            availableCameras: null,
            streamState: null,
            connected: false
        }
        if (callback)
            callback(null);
    }

    /**
     * Return the current ATEM state
     * @returns 
     */
    async getState() {
        return await window.atem.state();
    }

    /**
     * Return information for a camera input.
     * Returns null if camera is not found.
     * @param {*} id Camera input ID. Generally 1 to 40
     * @returns 
     */
    getCamera(id) {
        var self = this;
        var res = null;
        if (!self.state.availableCameras)
            return

        Object.keys(self.state.availableCameras).forEach(function(key) {
            var cam = self.state.availableCameras[key];
            if (cam.id == id)
                res = cam;
        })
        return res;
    }

    /**
     * Event handler for each ATEM state update
     * @param {*} event 
     * @param {*} state 
     */
    onUpdate(event, state) {
        this.state = state;
        this.emit('update', null)
    }

    /**
     * Event handler when an ATEM device is connected
     * @param {*} event 
     * @param {*} state 
     */
    onConnect(event, state) {
        this.state = state;
        $('#btnConnectDevice').prop("disabled", true);
        $('#btnDisconnectDevice').prop("disabled", false);
        $('#connectionStatusLabel').text("Connected to " + this.ip);
        this.emit('connect', null)
    }

    /**
     * Event handler when ATEM device is disconnected
     * @param {*} event 
     * @param {*} state 
     */
    onDisconnect(event, state) {
        this.state = state;
        $('#btnConnectDevice').prop("disabled", false);
        $('#btnDisconnectDevice').prop("disabled", true);
        $('#connectionStatusLabel').text("Disconnected");
        this.emit('disconnect', null)
    }
}

export { AtemClient }