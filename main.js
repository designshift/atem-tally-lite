const { app, BrowserWindow, ipcMain, shell } = require('electron');
const TallyServer = require('./models/tallyServer');
const AtemController = require('./models/atemController');
const Network = require('./models/network');
const Updates = require('./models/updateController');
const DeviceController = require('./models/deviceController');
const Telemetry = require('./models/telemetryMain.js');
const SettingsStore = require('./models/settingsStore.js');

const os = require('os')
const path = require('path')
const config = require('./config')
const windowStateKeeper = require('electron-window-state')
const pjson = require('./package.json')

const { MAX_BYTES_ON_DISK } = require('applicationinsights/out/Library/Sender')

let telemetry = new Telemetry((config && config.appInsightKey) ? config.appInsightKey : null);
telemetry.registerHandlers();
global.telemetry = telemetry;

telemetry.trackEvent({ name: "app_launch", properties: { type: os.type(), release: os.release(), platform: os.platform(), version: pjson.version } });

let tallyServer = new TallyServer();
tallyServer.startServer();

let atemController = new AtemController();
atemController.init(tallyServer);

let deviceController = new DeviceController();
deviceController.init(tallyServer);

// IPC network manager
let network = new Network();

// IPC settings store
let settings = new SettingsStore();

// IPC version checker
let updates = new Updates(pjson.version);

async function createWindow() {

    let mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    });

    let prepath = path.join(`${__dirname}`, 'preload.js');

    win = new BrowserWindow({
        'x': mainWindowState.x,
        'y': mainWindowState.y,
        'width': mainWindowState.width,
        'height': mainWindowState.height,

        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: true,
            preload: prepath
        }
    })

    atemController.registerHandlers(win);
    deviceController.registerHandlers(win);

    await win.loadFile('index.html')
    win.setMenu(null);
    // win.webContents.openDevTools({ "mode": "detach" });

    mainWindowState.manage(win);

}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

ipcMain.handle('app:version', () => {
    return pjson.version
})

ipcMain.handle('app:open-url', (event, url) => {
    telemetry.trackEvent('nav_ext', { url: url })
    require('electron').shell.openExternal(url);
})