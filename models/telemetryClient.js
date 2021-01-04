const { ApplicationInsights } = require('@microsoft/applicationinsights-web');
const { ipcRenderer } = require('electron');
const { v4: uuidv4 } = require('uuid');
const events = require('events').EventEmitter;
const util = require('util');

util.inherits(TelemetryClient, events);

module.exports = TelemetryClient;

function TelemetryClient(key) {
    this.appInsights = null;
    this.telemetryClient = null;
    this.telemetryEnabled = true;
    this.telemetryAdvancedEnabled = false;
    this.session_id = uuidv4(); // This is unique to each application launch

    if (key) {
        this.appInsights = new ApplicationInsights({
            // See https://github.com/Microsoft/ApplicationInsights-js#configuration
            config: {
                instrumentationKey: key
            }
        });
        this.appInsights.loadAppInsights();
    }
}

// For supported tracking types, see https://github.com/Microsoft/ApplicationInsights-js#sending-telemetry-to-the-azure-portal
TelemetryClient.prototype.trackPageView = function(pg_name) {
    if (this.appInsights)
        this.appInsights.trackPageView({ name: pg_name });
}

TelemetryClient.prototype.trackException = function(ex) {
    if (this.appInsights)
        this.appInsights.trackException({ exception: ex });
}

TelemetryClient.prototype.trackEvent = function(evt_name, evt_properties) {
    if (this.appInsights && this.telemetryEnabled)
        this.appInsights.trackEvent({ name: evt_name, properties: evt_properties });
}

TelemetryClient.prototype.trackAdvancedEvent = function(evt_name, evt_properties) {
    if (this.telemetryAdvancedEnabled)
        this.trackEvent(evt_name, evt_properties);
}

TelemetryClient.prototype.getUuid = function() {
    return this.session_id;
}

TelemetryClient.prototype.enableTracking = function() {
    this.telemetryEnabled = true;
    store.set('telemetryEnabled', true);
    this.emit('enabled_telemetry');
}

TelemetryClient.prototype.disableTracking = function() {
    this.telemetryEnabled = false;
    this.telemetryAdvancedEnabled = false;
    this.disableAdvancedTracking();
    store.set('telemetryEnabled', false);
    this.emit('disabled_telemetry');
}

TelemetryClient.prototype.enableAdvancedTracking = function() {
    this.telemetryEnabled = true;
    this.telemetryAdvancedEnabled = true;
    this.enableTracking();
    this.trackEvent("session_id", { session_id: this.session_id });
    ipcRenderer.send('enable_advanced_telemetry');
    store.set('telemetryAdvancedEnabled', true);
    this.emit('enabled_adv_telemetry');
}

TelemetryClient.prototype.disableAdvancedTracking = function() {
    this.telemetryAdvancedEnabled = false;
    ipcRenderer.send('disable_advanced_telemetry');
    store.set('telemetryAdvancedEnabled', false);
    this.emit('disabled_adv_telemetry');
}