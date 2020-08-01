const AtemController = require('./models/atemController');
const PiController = require('./models/piController');
const Store = require('electron-store');
const os = require('os');
const ifaces = os.networkInterfaces();
let atemController = new AtemController();
let piController = new PiController();

let store = new Store();

var programColor = "#FF0000";
var previewColor = "#00FF00";

Views = {
    Tally: 'viewTally',
    Settings: 'viewSettings',
    Web: 'viewWeb',
    Pi: 'viewPi',
    About: 'viewAbout'
}

function updateTallyColor() {
    $('.tally').css('background', '#333333'); // Reset all to black first
    $(".tally[data-tally-state='preview']").css('background', previewColor);
    $(".tally[data-tally-state='program']").css('background', programColor);
}

function bindCameraButtons() {
    $('.tally-multi').click(function(cam) {
        var sid = $(this).data('sid');
        $('#cameraSelection').val(sid);
        $('#cameraSelection').change();
    });
    $('.tally-single').click(function(cam) {
        $('#cameraSelection').val("ALL");
        $('#cameraSelection').change();
    });
}

function updateTally() {
    let renderer = $('#viewTallyRenderer');
    let errorRenderer = $('#viewTallyError');
    renderer.show();
    errorRenderer.hide();

    renderer.removeClass('viewSingleTally viewMultiTally');

    if ($('#cameraSelection').prop('disabled') || !atemController.availableCameras || atemController.availableCameras === []) {
        errorRenderer.show();
        renderer.hide();
        errorRenderer.html('<div class="errMsg">Not connected</div>');
    } else {
        let cameras = atemController.availableCameras;
        let sid = '';
        let output = '';
        renderer.html('');

        // console.log(cameras);
        if ($('#cameraSelection').val() === "ALL") {
            if (Object.keys(cameras).length > 0) {
                renderer.addClass('viewMultiTally');
                $.each(Object.values(cameras), function(key, value) {
                    let state = 'inactive';

                    output = '';
                    sid = Object.keys(cameras)[key].split('_')[1];

                    if (atemController.previewSourceIds.includes(parseInt(sid))) {
                        state = 'preview';
                    }

                    // Program overrides preview
                    if (atemController.programSourceIds.includes(parseInt(sid))) {
                        state = 'program';
                    }

                    renderer.append($('<div/>', {
                        class: "tally tally-multi",
                        'data-sid': Object.keys(cameras)[key],
                        'data-cid': sid,
                        'data-tally-state': state,
                        'data-abbreviation': value.abbreviation,
                        'data-name': value.name
                    }))
                });
                $('.tally-multi').each(function(i, obj) {
                    $(obj).append('<span class="tallyCameraId">' + $(obj).attr('data-cid') + '</span>');
                    $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-abbreviation') + '</span>');
                });
            }
        } else {
            renderer.addClass('viewSingleTally');
            fullsid = $('#cameraSelection').val();
            sid = fullsid.split('_')[1];

            let state = 'inactive';

            if (atemController.previewSourceIds.includes(parseInt(sid))) {
                state = 'preview';
            }

            // Program overrides preview
            if (atemController.programSourceIds.includes(parseInt(sid))) {
                state = 'program';
            }

            renderer.append($('<div/>', {
                class: "tally tally-single",
                'data-sid': fullsid,
                'data-cid': sid,
                'data-tally-state': state,
                'data-abbreviation': atemController.availableCameras[fullsid].abbreviation,
                'data-name': atemController.availableCameras[fullsid].name
            }))

            $('.tally-single').each(function(i, obj) {
                $(obj).append('<span class="tallyCameraId">' + $(obj).attr('data-cid') + '</span>');
                $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-abbreviation') + '</span>');
            });

        }
        updateTallyColor();
        bindCameraButtons();
    }
}

function setConnectedState() {
    $('#btnConnectDevice').prop("disabled", true);
    $('#btnDisconnectDevice').prop("disabled", false);
    $('#connectionStatusLabel').text("Connected to " + atemController.activeip);
}

function setDisconnectedState() {
    $('#btnConnectDevice').prop("disabled", false);
    $('#btnDisconnectDevice').prop("disabled", true);
    $('#connectionStatusLabel').text("Disconnected");
}

function setInitialStates() {
    showView(Views.Tally);
    $("#inputManualIpaddress").hide();

    // Check for tally color setting from store
    if (store.get('programColor')) {
        programColor = store.get('programColor');
        $('#btnProgramColor').val(programColor);
    }

    if (store.get('previewColor')) {
        previewColor = store.get('previewColor');
        $('#btnPreviewColor').val(previewColor);
    }

    updateTally()
    setDisconnectedState();
}

function hideMenu() {
    $('#navbarMainToggler').addClass('collapsed');
    $('#navbarMainToggler').prop('aria-expanded', 'false');
    $('#navbarMain').removeClass('show');
}



function showView(viewname) {
    hideMenu();
    $('.view').css('display', 'none');
    if (viewname) {
        $('#' + viewname).css('display', 'block');
    } else {
        ('#' + Views.Tally).css('display', 'block');
    }
}

function updateCameras() {
    let cameras = atemController.availableCameras;

    $('#cameraSelection').html("");
    if (Object.keys(cameras).length > 0) {
        $('#cameraSelection').prop("disabled", false);
        $('#cameraSelection').append($('<option/>', {
            value: "ALL",
            text: "All Cameras",
            selected: true
        }));
        console.log(cameras);
        $.each(Object.values(cameras), function(key, value) {
            $('#cameraSelection').append($('<option/>', {
                value: Object.keys(cameras)[key],
                text: value.name + " (" + value.abbreviation + " - " + value.interface + ")"
            }));
        })
    } else {
        $('#cameraSelection').prop("disabled", true);
        $('#cameraSelection').append($('<option/>', {
            value: "",
            text: "No cameras detected"
        }));
    }
}

function updateDevices() {
    console.log("Scanning for devices");
    $('#inputDeviceSelection').html("");
    $('#inputDeviceSelection').append($('<option/>', {
        value: "",
        text: "Searching network for devices...",
        disabled: true,
        selected: true
    }));

    atemController.updateDeviceList(function(err, devices) {
        if (atemController.devices && atemController.devices.length > 0) {
            console.log("Found " + atemController.devices.length + " devices...");

            $('#inputDeviceSelection').html("");
            $('#inputDeviceSelection').append($('<option/>', {
                value: "",
                text: "Select device from list"
            }));

            $.each(atemController.devices, function(index, value) {
                $('#inputDeviceSelection').append($('<option/>', {
                    value: value.addresses[0],
                    text: value.name + " (" + value.addresses[0] + ")"
                }));
            });


        } else {
            $('#inputDeviceSelection').html("");
            $('#inputDeviceSelection').append($('<option/>', {
                value: "",
                text: "No devices detected on network"
            }));
        }

        $('#inputDeviceSelection').append($('<option/>', {
            value: "-1",
            text: "Manual IP selection"
        }));

        if (atemController.devices.length == 1) {
            console.log("Auto connection only device on network" + atemController.devices[0].addresses[0]);
            atemController.selectDevice(atemController.devices[0].addresses[0]);
        }
    });
}

function updatePiDevices() {
    $('#piDeviceList').html('');
    piController.refreshDeviceList(function() {
        var d = piController.getAvailableDevices();
        Object.keys(d).forEach(function(k) {
            var out = "";
            out += "<div class=\"form-check\">";
            out += "<input type=\"checkbox\" class=\"pi-device form-check-input\" id=\"pi-" + d[k].addresses[0] + "\" value=\"" + d[k].addresses[0] + "\">";
            out += "<label class=\"form-check-label\" for=\"pi-" + d[k].addresses[0] + "\">" + d[k].host + " (" + d[k].addresses[0] + ")</label>";
            out += "</div>";
            $('#piDeviceList').append(out);
        });

        $('.pi-device').change(function(e) {
            if (e.target.checked) {
                piController.enableDevice(e.target.value);
            } else {
                piController.disableDevice(e.target.value);
            }
        });

    });
}


(window).onload = () => {
    setInitialStates();
    updateDevices();
    updatePiDevices();
    updateQRCode();
}

function createQrCodeUrl(uri) {
    return ("https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(uri));
}

function updateQRCode() {
    Object.keys(ifaces).forEach(function(ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function(iface) {
            if ('IPv4' !== iface.family || iface.internal !== false || ifname.indexOf('*') > 0) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(ifname + ':' + alias, iface.address);

                $('#qrcodeRegion').append($('<img/>', {
                    src: createQrCodeUrl('http://' + iface.address + ':3777/tally')
                }));
                $('#qrcodeRegion').append($('<p>' + 'http://' + iface.address + ':3777/tally' + '</p>'));
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                $('#qrcodeRegion').append($('<img/>', {
                    src: createQrCodeUrl('http://' + iface.address + ':3777/tally')
                }));
                $('#qrcodeRegion').append($('<p>' + 'http://' + iface.address + ':3777/tally' + '</p>'));
            }
            ++alias;
        });
    });

}

atemController.on('connect', function() {
    setConnectedState();
    updateTally();
});
atemController.on('disconnect', function() {
    setDisconnectedState();
    updateTally();
});

atemController.on('update_cameras', function() {
    updateCameras();
});

atemController.on('preview_change', function() {
    updateTally();
});
atemController.on('program_change', function() {
    updateTally();
});


$('#btnConnectDevice').click(function() {

    var selectionIp = $('#inputDeviceSelection').val();
    if (selectionIp == "") {
        // TODO Add warnings
    } else if (selectionIp == "-1") {
        atemController.selectDevice($('#inputManualIpaddress').val());
    } else {
        console.log("Connecting device " + selectionIp);
        atemController.selectDevice(selectionIp);
    }
});

$('#btnDisconnectDevice').click(function() {
    // Only disconnect if currently connected
    atemController.disconnectDevice();
});

$('#btnRescanNetwork').click(function() {
    updateDevices();
});

$('#cameraSelection').change(function() {
    updateTally();
})

$('#btnProgramColor').change(function() {
    programColor = $('#btnProgramColor').val();
    store.set("programColor", programColor);
    updateTallyColor();
})

$('#btnPreviewColor').change(function() {
    previewColor = $('#btnPreviewColor').val();
    store.set("previewColor", previewColor);
    updateTallyColor();
})

$('#navTally,#btnGoToTally').click(function() {
    showView(Views.Tally);
});

$('#navSettings').click(function() {
    showView(Views.Settings);
});

$('#navWeb').click(function() {
    showView(Views.Web);
});

$('#navPi').click(function() {
    showView(Views.Pi);
});

$('#navAbout').click(function() {
    showView(Views.About);
});

$('.viewport-frame').click(function() {
    hideMenu();
})

$('#btnRescanNetworkPi').click(function() {
    updatePiDevices();
})

$('#inputDeviceSelection').change(function() {
    if ($('#inputDeviceSelection').val() == '-1') {
        $('#inputManualIpaddress').show();
        $('#inputManualIpaddress').focus();
    } else {
        $('#inputManualIpaddress').hide();
    }
});