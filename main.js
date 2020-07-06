const { app, BrowserWindow, ipcMain } = require('electron');
const AtemSocketServer = require('./models/atemSocketServer');

let atemSocketServer = new AtemSocketServer();
atemSocketServer.startServer();
global.socketServer = atemSocketServer;

ipcMain.on('update_tally', (event, arg) => {
    let msg = arg;
    global.socketServer.updateTally(
        msg.previewSourceId,
        msg.programSourceId,
        msg.availableCameras
    );
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    })

    win.loadFile('index.html')
    win.setMenu(null);
    // win.webContents.openDevTools()
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