const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('atem', {
    connect: (ip) => ipcRenderer.invoke('atem:connect', ip),
    disconnect: () => ipcRenderer.invoke('atem:disconnect'),
    state: () => ipcRenderer.invoke('atem:state'),
    search: () => ipcRenderer.invoke('atem:search'),

    onUpdate: (callback) => ipcRenderer.on('atem:onupdate', callback),
    onConnect: (callback) => ipcRenderer.on('atem:onconnect', callback),
    onDisconnect: (callback) => ipcRenderer.on('atem:ondisconnect', callback),

})

contextBridge.exposeInMainWorld('app', {
    getStore: (key) => ipcRenderer.invoke('app:store-get', key),
    getUpdate: () => ipcRenderer.invoke('app:update'),
    getVersion: () => ipcRenderer.invoke('app:version'),
    openUrl: (url) => ipcRenderer.invoke('app:open-url', url),
    setStore: (key, value) => ipcRenderer.invoke('app:store-set', key, value),

})

contextBridge.exposeInMainWorld('telemetry', {
    enableTracking: () => ipcRenderer.send('telemetry:enable-tracking'),
    disableTracking: () => ipcRenderer.send('telemetry:disable-tracking'),
    enableAdvancedTracking: () => ipcRenderer.send('telemetry:enable-advanced-tracking'),
    disableAdvancedTracking: () => ipcRenderer.send('telemetry:disable-advanced-tracking'),
    trackPageView: (name) => ipcRenderer.send('telemetry:enable-tracking', name),
    trackException: (ex) => ipcRenderer.send('telemetry:disable-tracking', ex),
    trackEvent: (name, props) => ipcRenderer.send('telemetry:enable-advanced-tracking', name, props),
    trackAdvancedEvent: (name, props) => ipcRenderer.send('telemetry:disable-advanced-tracking', name, props),
    getTrackingState: () => ipcRenderer.invoke('telemetry:state'),
    getUuid: () => ipcRenderer.invoke('telemetry:uuid')
})

contextBridge.exposeInMainWorld('clients', {
    // onconnect: (ip) => ipcRenderer.invoke('client:connect', ip),
    // ondisconnect: () => ipcRenderer.invoke('client:disconnect'),
    getAvailableDevices: () => ipcRenderer.invoke('client:available'),
    getSavedDevices: () => ipcRenderer.invoke('client:saved'),
    save: (devId) => ipcRenderer.invoke('client:save', devId),
    saveByIp: (ip) => ipcRenderer.invoke('client:save-by-ip', ip),
    remove: (devId) => ipcRenderer.invoke('client:remove', devId),
    enable: (devId) => ipcRenderer.invoke('client:enable', devId),
    disable: (devId) => ipcRenderer.invoke('client:disable', devId),
    setDeviceCamera: (devId, camera) => ipcRenderer.invoke('client:set-camera', devId, camera),
    identify: (devId) => ipcRenderer.invoke('client:identify', devId),

    onUpdate: (callback) => ipcRenderer.on('client:onupdate', callback),

})

contextBridge.exposeInMainWorld('network', {
    list: () => ipcRenderer.invoke('network:list')
})