const { exec } = require('child_process');
const pjson = require('../package.json');

console.log(pjson.version);

exec("electron-packager . \"ATEM Tally Lite\" \
    --app-copyright=\"Copyright © Design Shift Consulting, All Rights Reserved.\" \
    --executable-name=\"ATEM Tally Lite\" \
    --platform=win32 \
    --arch=x64 \
    --out=../build/" + pjson.name + "/" + pjson.version + " \
    --overwrite \
    --asar \
    --icon=./resources/icon.ico", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
});
exec("electron-packager .  \"ATEM Tally Lite\" \
    --app-copyright=\"Copyright © Design Shift Consulting, All Rights Reserved.\" \
    --executable-name=\"ATEM Tally Lite\" \
    --platform=darwin \
    --arch=x64 \
    --out=../build/" + pjson.name + "/" + pjson.version + " \
    --overwrite \
    --asar \
    --icon=./resources/icon.icns", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
});