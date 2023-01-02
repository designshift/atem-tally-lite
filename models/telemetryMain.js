const ApplicationInsights = require('applicationinsights');
const { ipcMain } = require('electron');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events').EventEmitter;



class Telemetry extends EventEmitter {
    appInsights = ApplicationInsights;
    telemetryClient = null;
    telemetryEnabled = true;
    telemetryAdvancedEnabled = false;
    store = new Store();
    session_id = uuidv4(); // This is unique to each application launch

    constructor(key) {
        super()
        if (key) {
            this.appInsights.setup(key)
                .setAutoDependencyCorrelation(false)
                .setAutoCollectRequests(false)
                .setAutoCollectPerformance(false, false)
                .setAutoCollectExceptions(true)
                .setAutoCollectDependencies(false)
                .setAutoCollectConsole(false, false)
                .setUseDiskRetryCaching(false)
                .setSendLiveMetrics(false)
                .setDistributedTracingMode(this.appInsights.DistributedTracingModes.AI)
                .start();
        } else {
            this.appInsights = null;
        }

        if (typeof(this.store.get('telemetryEnabled')) != "undefined") {
            if (this.store.get('telemetryEnabled')) {
                this.enableTracking();
            } else {
                this.disableTracking();
            }
        } else {
            this.enableTracking();
        }
        if (typeof(this.store.get('telemetryAdvancedEnabled')) != "undefined") {
            if (this.store.get('telemetryAdvancedEnabled')) {
                this.enableAdvancedTracking()
            } else {
                this.disableAdvancedTracking();
            }
        }
    }

    // For supported tracking types, see https://github.com/Microsoft/ApplicationInsights-js#sending-telemetry-to-the-azure-portal
    trackPageView(pg_name) {
        this.trackEvent({ name: 'view_' + pg_name });
    }

    trackException(ex) {
        if (this.appInsights && this.telemetryEnabled)
            this.appInsights.defaultClient.trackException({ exception: ex });
    }

    trackEvent(evt_name, evt_properties) {
        if (this.appInsights && this.telemetryEnabled)
            this.appInsights.defaultClient.trackEvent({ name: evt_name, properties: evt_properties });
    }

    trackAdvancedEvent(evt_name, evt_properties) {
        if (this.telemetryAdvancedEnabled)
            this.trackEvent(evt_name, evt_properties);
    }

    async getUuid() {
        return (global.telemetry.session_id) ? global.telemetry.session_id : null;
    }

    async getTrackingState() {
        if (!global.telemetry)
            return null;

        return {
            telemetry: global.telemetry.telemetryEnabled,
            advancedTelemetry: global.telemetry.telemetryAdvancedEnabled
        }
    }

    enableTracking() {
        let self = this;
        self.telemetryEnabled = true;
        self.store.set('telemetryEnabled', true);
        self.emit('enabled_telemetry');
    }

    disableTracking() {
        let self = this;
        self.telemetryEnabled = false;
        self.telemetryAdvancedEnabled = false;
        self.disableAdvancedTracking();
        self.store.set('telemetryEnabled', false);
        self.emit('disabled_telemetry');
    }

    enableAdvancedTracking() {
        let self = this;
        self.telemetryEnabled = true;
        self.telemetryAdvancedEnabled = true;
        self.enableTracking();
        self.trackEvent("session_id", { session_id: self.session_id });
        self.store.set('telemetryAdvancedEnabled', true);
        self.emit('enabled_adv_telemetry');
    }

    disableAdvancedTracking() {
        let self = this;
        self.telemetryAdvancedEnabled = false;
        self.store.set('telemetryAdvancedEnabled', false);
        self.emit('disabled_adv_telemetry');
    }

    registerHandlers() {
        var self = this;
        ipcMain.on('telemetry:enable-tracking', () => { self.enableTracking() });
        ipcMain.on('telemetry:disable-tracking', () => { self.disableTracking() });
        ipcMain.on('telemetry:enable-advanced-tracking', () => { self.enableAdvancedTracking() });
        ipcMain.on('telemetry:disable-advanced-tracking', () => { self.disableAdvancedTracking() });
        ipcMain.on('telemetry:track-page-view', (event, pageName) => { self.trackPageView(pageName) });
        ipcMain.on('telemetry:track-exception', (event, ex) => { self.trackException(ex) });
        ipcMain.on('telemetry:track-event', (event, name, props) => { self.trackEvent(name, props) });
        ipcMain.on('telemetry:track-advanced-event', (event, name, props) => { self.trackAdvancedEvent(name, props) });
        ipcMain.handle('telemetry:state', self.getTrackingState);
        ipcMain.handle('telemetry:uuid', self.getUuid);
    }
}


module.exports = Telemetry