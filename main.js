const { app, BrowserWindow, ipcMain } = require('electron');
const AtemSocketServer = require('./models/atemSocketServer');
const os = require('os');
const config = require('./config');
const windowStateKeeper = require('electron-window-state');
const pjson = require('./package.json');

const appInsights = require("applicationinsights");
const { telemetryTypeToBaseType } = require('applicationinsights/out/Declarations/Contracts');

if (config && config.appInsightKey)
    appInsights.setup(config.appInsightKey)
    .setAutoDependencyCorrelation(false)
    .setAutoCollectRequests(false)
    .setAutoCollectPerformance(false, false)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(false)
    .setAutoCollectConsole(false, false)
    .setUseDiskRetryCaching(false)
    .setSendLiveMetrics(false)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
    .start();

let client = appInsights.defaultClient;
client.trackEvent({ name: "app_launch", properties: { type: os.type(), release: os.release(), platform: os.platform(), version: pjson.version } });

let atemSocketServer = new AtemSocketServer();
atemSocketServer.startServer();
global.socketServer = atemSocketServer;

ipcMain.on('update_tally', (event, arg) => {
    let msg = arg;
    global.socketServer.updateTally(
        msg.previewSourceIds,
        msg.programSourceIds,
        msg.availableCameras
    );
});

ipcMain.on('stop_tally', (event, arg) => {
    let msg = arg;
    console.log(msg);
    global.socketServer.stopTally(msg);
});

ipcMain.on('call', (event, arg) => {
    global.socketServer.callAll();
});
ipcMain.on('set_remote', (event, arg) => {
    let msg = arg;
    global.socketServer.setRemote(msg);
});

ipcMain.on('enable_advanced_telemetry', (event, arg) => {
    appInsights.setAutoCollectConsole(true, true);
    appInsights.setAutoCollectRequests(true);
});

ipcMain.on('disable_advanced_telemetry', (event, arg) => {
    appInsights.setAutoCollectConsole(false, false);
    appInsights.setAutoCollectRequests(false);
});

function createWindow() {

    let mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    });

    let win = new BrowserWindow({
        'x': mainWindowState.x,
        'y': mainWindowState.y,
        'width': mainWindowState.width,
        'height': mainWindowState.height,
        webPreferences: {
            nodeIntegration: true
        }
    })

    win.loadFile('index.html')
    win.setMenu(null);
    // win.webContents.openDevTools();

    mainWindowState.manage(win);
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})