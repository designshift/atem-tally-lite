const AtemController = require('./models/atemController');
const PiController = require('./models/piController');
const Telemetry = require('./models/telemetryClient.js');
const Store = require('electron-store');
const os = require('os');
const ifaces = os.networkInterfaces();
const config = require('./config');
const { get } = require('jquery');
const pjson = require('./package.json');
const QRCode = require('qrcode');
const shell = require('electron').shell;
const versionCheck = require('github-version-checker');

let atemController = new AtemController();
let piController = new PiController();

let store = new Store();

let programColor = "#FF0000";
let previewColor = "#00FF00";
let networkInterface = "";

// const appInsights = require("@microsoft/applicationinsights-web").ApplicationInsights;

// appInsights.setup(config.appInsightKey)
//     .setAutoDependencyCorrelation(false)
//     .setAutoCollectRequests(false)
//     .setAutoCollectPerformance(false, false)
//     .setAutoCollectExceptions(true)
//     .setAutoCollectDependencies(false)
//     .setAutoCollectConsole(false, false)
//     .setUseDiskRetryCaching(false)
//     .setSendLiveMetrics(true)
//     .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
// .start();

let telemetry = new Telemetry((config.appInsightKey) ? config.appInsightKey : null);
telemetry.trackPageView("Tally");

if (typeof(store.get('telemetryEnabled')) != "undefined") {
    console.log(store.get('telemetryEnabled'));
    if (store.get('telemetryEnabled')) {
        telemetry.enableTracking();
        $('#optionTelemetrySwitch').prop('checked', true);
    } else {
        telemetry.disableTracking();
    }
} else {
    $('#optionTelemetrySwitch').prop('checked', true);
    telemetry.enableTracking();
}
if (typeof(store.get('telemetryAdvancedEnabled')) != "undefined") {
    if (store.get('telemetryAdvancedEnabled')) {
        $('#optionAdvancedTelemetrySwitch').prop('checked', true);
        telemetry.enableAdvancedTracking()
    } else {
        telemetry.disableAdvancedTracking();
    }
}
$('#telemetryIdentifier').html(telemetry.getUuid());

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
        telemetry.trackEvent("click", { label: "tally_camera", sid: sid })
    });
    $('.tally-single').click(function(cam) {
        $('#cameraSelection').val("ALL");
        $('#cameraSelection').change();
        telemetry.trackEvent("click", { label: "tally_camera", sid: "ALL" })
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
            telemetry.trackEvent("update_tally", { type: 'all_cameras', camera_count: Object.keys(cameras).length });
            telemetry.trackAdvancedEvent("update_tally_detail", { cameras: cameras });
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
            telemetry.trackEvent("update_tally", { type: 'single_camera' });
            telemetry.trackAdvancedEvent("update_tally_detail", { cameras: cameras });
        }
        updateTallyColor();
        bindCameraButtons();
    }
}

function setConnectedState() {
    $('#btnConnectDevice').prop("disabled", true);
    $('#btnDisconnectDevice').prop("disabled", false);
    $('#connectionStatusLabel').text("Connected to " + atemController.activeip);
    telemetry.trackEvent("connected_to_atem", {});
}

function setDisconnectedState() {
    $('#btnConnectDevice').prop("disabled", false);
    $('#btnDisconnectDevice').prop("disabled", true);
    $('#connectionStatusLabel').text("Disconnected");
    telemetry.trackEvent("disconnected_from_atem", {});
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

    // Default to first network interface
    if (getNetworkInteraces().length > 0)
        networkInterface = getNetworkInteraces()[0].address;

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
        telemetry.trackAdvancedEvent("atem_network_discovered", { deviceCount: atemController.devices.length, devices: atemController.devices });

        $('#inputDeviceSelection').append($('<option/>', {
            value: "-1",
            text: "Manual IP selection"
        }));

        if (atemController.devices.length == 1) {
            console.log("Auto connection only device on network" + atemController.devices[0].addresses[0]);
            atemController.selectDevice(atemController.devices[0].addresses[0]);
            telemetry.trackEvent("atem_autoconnect");
        }
    });
}

function updatePiDevices() {
    $('#piDeviceList').html('');
    $('#btnRescanNetworkPi').html('Searching...');
    piController.refreshDeviceList(function() {
        var d = piController.getAvailableDevices();
        $('#btnRescanNetworkPi').html('Refresh Devices');
        Object.keys(d).forEach(function(k) {
            var out = "";
            out += "<div class=\"form-check\">";
            out += "<input type=\"checkbox\" class=\"pi-device form-check-input\" id=\"pi-" + d[k].addresses[0] + "\" value=\"" + d[k].addresses[0] + "\">";
            out += "<label class=\"form-check-label\" for=\"pi-" + d[k].addresses[0] + "\">" + d[k].host + " (" + d[k].addresses[0] + ")</label>";
            out += "<a class=\"pi-device-identify-link\" data-ip-address=\"" + d[k].addresses[0] + "\" data-devid=\"" + d[k].txt.id + "\">Identify</a>";
            out += "</div>";

            $('#piDeviceList').append(
                $('<p/>', {
                    text: 'Select the checkbox next to each device to enable'
                }),
                $('<div/>', {
                    class: 'form-check pi-device-row'
                }).append(
                    $('<input/>', {
                        type: 'checkbox',
                        class: 'pi-device form-check-input',
                        id: 'pi-' + d[k].txt.id,
                        value: d[k].txt.id,
                        'data-dev-id': d[k].txt.id
                    }),
                    $('<label>', {
                        class: 'form-check-label',
                        text: d[k].host + ' (' + d[k].addresses[0] + ')',
                        for: 'pi' + d[k].txt.id
                    }),
                    $('<a>', {
                        class: 'pi-device-identify-link',
                        text: 'Identify',
                        'data-ip-address': d[k].addresses[0],
                        'data-dev-id': d[k].txt.id
                    }),
                    $('<select/>', {
                        class: 'pi-device-camera-selection',
                        'data-dev-id': d[k].txt.id
                    })
                )
            );
        });

        $('.pi-device-identify-link').click(function() {
            if (!$('#pi-' + $(this).attr('data-dev-id')).prop('checked')) {
                $('#pi-' + $(this).attr('data-dev-id')).prop('checked', true);
                piController.enableDevice($('#pi-' + $(this).attr('data-dev-id')).val());
            }
            piController.identifyCamera($(this).attr('data-dev-id'));
        });

        $('.pi-device-camera-selection').change(function() {
            console.log($(this).attr('data-dev-id'));
            piController.setCamera($(this).attr('data-dev-id'), parseInt($(this).val().split("_")[1]));
        });

        $('.pi-device').change(function(e) {
            if (e.target.checked) {
                piController.enableDevice(e.target.value);
            } else {
                piController.disableDevice(e.target.value);
            }
        });

        updatePiDeviceSelection();
    });
}

function updatePiDeviceSelection() {
    if (Object.keys(atemController.availableCameras).length > 0) {
        $('.pi-device-camera-selection').prop("disabled", false);
        $('.pi-device-camera-selection').append($('<option/>'));
        $.each(Object.values(atemController.availableCameras), function(key, value) {
            $('.pi-device-camera-selection').append($('<option/>', {
                value: Object.keys(atemController.availableCameras)[key],
                text: value.name + " (" + value.abbreviation + " - " + value.interface + ")"
            }));
        });

        $('.pi-device-camera-selection').each(function() {
            var devId = $(this).attr("data-dev-id");
            var cam = piController.getDeviceConfigCamera(devId);
            var enable = piController.getDeviceConfigEnabled(devId);

            if (enable) {
                $('#pi-' + devId).attr('checked', true);
                piController.disableDevice(devId, function() {
                    piController.enableDevice(devId, function() {
                        if (cam) {
                            $('.pi-device-camera-selection[data-dev-id="' + devId + '"]').val("SID_" + cam);
                            piController.setCamera(devId, cam);
                        }
                    })
                })
            } else {
                if (cam) {
                    $('.pi-device-camera-selection[data-dev-id="' + devId + '"]').val("SID_" + cam);
                    piController.setCamera(devId, cam);
                }
            }
        });
    } else {
        $('.pi-device-camera-selection').attr("disabled", true);
        $('.pi-device-camera-selection').append($('<option/>', {
            value: "",
            text: "No ATEM connected"
        }));
    }
}

function runVersionCheck() {
    const options = {
        repo: 'atem-tally-lite', // repository name
        owner: 'designshift', // repository owner
        currentVersion: pjson.version, // your app's current version
    };
    versionCheck(options, function(error, update) { // callback function
        console.log(error);
        if (update) { // print some update info if an update is available
            console.log('An update is available! ' + update.name);
            $('.update-banner').remove();
            $('.viewport-frame').append(
                $('<div/>', {
                    class: 'update-banner alert alert-warning'
                }).append(
                    $('<span/>', {
                        text: "A new version is available to download"
                    }),
                    $('<a/>', {
                        text: "Get Update",
                        href: "https://designshift.ca/apps/atem-tally?utm_campaign=update_banner&utm_medium=desktop_app&utm_source=tally-lite-" + pjson.version
                    }),
                    $('<button/>', {
                        type: 'button',
                        class: 'close',
                        'aria-label': 'close',
                        id: 'update-banner-close'
                    }).append(
                        $('<span/>', {
                            'aria-hidden': true,
                            text: "×"
                        })
                    )
                )
            );
            $('#update-banner-close').click(function() {
                $('.update-banner').remove();
            })
        } else {
            console.log("App is current");
        }
    });
}


(window).onload = () => {
    setInitialStates();
    updateDevices();
    updateQRCode();
    updateNetworkInterfaceSelection();
    runVersionCheck();
    $('#appVersion').html("Version " + pjson.version);
}

$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

function updateNetworkInterfaceSelection() {
    var ifaces = getNetworkInteraces();
    for (var i = 0; i < ifaces.length; i++) {
        $('#portSelection').append($('<option/>', {
            value: ifaces[i].address,
            text: ifaces[i].name + " (" + ifaces[i].address + ")",
            selected: (ifaces.address == networkInterface)
        }));
    }
}

function getNetworkInteraces() {
    var results = [];
    Object.keys(ifaces).forEach(function(ifname) {
        var alias = 0;
        ifaces[ifname].forEach(function(iface) {
            if ('IPv4' !== iface.family || iface.internal !== false || ifname.indexOf('*') > 0) {
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                results.push({
                    name: ifname + ":" + alias,
                    address: iface.address
                })
            } else {
                // this interface has only one ipv4 adress
                results.push({
                    name: ifname,
                    address: iface.address
                })
            }
            ++alias;
        });
    });
    return results;
}

function updateQRCode() {
    $('#qrcodeRegion').html($('<canvas/>', {
        id: 'qrcode-canvas'
    }));

    var canvas = document.getElementById('qrcode-canvas');
    QRCode.toCanvas(canvas, 'http://' + networkInterface + ':3777/tally', { scale: 8 }, function(error) {
        if (error) console.error(error)
        console.log('success!');
    });

    $('#qrcodeRegion').append($('<div/>').append($('<a/>', { href: 'http://' + networkInterface + ':3777/tally', text: 'http://' + networkInterface + ':3777/tally' })));

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
        telemetry.trackEvent("click", { label: "connect", type: "manual" });
    } else {
        console.log("Connecting device " + selectionIp);
        atemController.selectDevice(selectionIp);
        telemetry.trackEvent("click", { label: "connect", type: "auto" });
    }
});

$('#btnDisconnectDevice').click(function() {
    // Only disconnect if currently connected
    atemController.disconnectDevice();
    telemetry.trackEvent("click", { label: "disconnect" });
});

$('#btnRescanNetwork').click(function() {
    updateDevices();
    telemetry.trackEvent("click", { label: "rescan_atem" });
});

$('#cameraSelection').change(function() {
    updateTally();
    telemetry.trackEvent("click", { label: "change_camera" });
})

$('#btnProgramColor').change(function() {
    programColor = $('#btnProgramColor').val();
    store.set("programColor", programColor);
    updateTallyColor();
    telemetry.trackEvent("click", { label: "set_program_color", color: programColor });
})

$('#btnPreviewColor').change(function() {
    previewColor = $('#btnPreviewColor').val();
    store.set("previewColor", previewColor);
    updateTallyColor();
    telemetry.trackEvent("click", { label: "set_preview_color", color: previewColor });
})

$('#navTally,#btnGoToTally').click(function() {
    showView(Views.Tally);
    telemetry.trackEvent("nav", { label: "tally" });
    telemetry.trackPageView("Tally");
});

$('#navSettings').click(function() {
    showView(Views.Settings);
    telemetry.trackEvent("nav", { label: "settings" });
    telemetry.trackPageView("Settings");
});

$('#navWeb').click(function() {
    updateQRCode();
    showView(Views.Web);
    telemetry.trackEvent("nav", { label: "web" });
    telemetry.trackPageView("Web");
});

$('#navPi').click(function() {
    showView(Views.Pi);
    telemetry.trackEvent("nav", { label: "pi" });
    telemetry.trackPageView("Pi");
});

$('#navAbout').click(function() {
    showView(Views.About);
    telemetry.trackEvent("nav", { label: "about" });
    telemetry.trackPageView("About");
});

$('.viewport-frame').click(function() {
    hideMenu();
})

$('#btnRescanNetworkPi').click(function() {
    updatePiDevices();
    telemetry.trackEvent("click", { label: "rescan_pi" });
})

$('#inputDeviceSelection').change(function() {
    if ($('#inputDeviceSelection').val() == '-1') {
        $('#inputManualIpaddress').show();
        $('#inputManualIpaddress').focus();
    } else {
        $('#inputManualIpaddress').hide();
    }
    telemetry.trackEvent("click", { label: "change_device_selection", type: ($('#inputDeviceSelection').val() == '-1') ? "manual" : "auto" });
});



$('#portSelection').change(function() {
    networkInterface = $('#portSelection').val();
    updateQRCode();
    telemetry.trackEvent("click", { label: "change_network_interface" });
})

$('#optionTelemetrySwitch').click(function() {
    if ($('#optionTelemetrySwitch').is(":checked")) {
        telemetry.enableTracking();
        telemetry.trackEvent("click", { label: "enabled_telemetry" });
    } else {
        telemetry.trackEvent("click", { label: "disabled_telemetry" });
        telemetry.disableTracking();
    }
});
$('#optionAdvancedTelemetrySwitch').click(function() {
    if ($('#optionAdvancedTelemetrySwitch').is(":checked")) {
        telemetry.enableAdvancedTracking();
        telemetry.trackEvent("click", { label: "enabled_advanced_telemetry" });
    } else {
        telemetry.trackEvent("click", { label: "disabled_advanced_telemetry" });
        telemetry.disableAdvancedTracking();
    }
});

telemetry.on('enabled_telemetry', function() {
    $('#optionTelemetrySwitch').prop('checked', true);
});
telemetry.on('disabled_telemetry', function() {
    $('#optionTelemetrySwitch').prop('checked', false);
});
telemetry.on('enabled_adv_telemetry', function() {
    $('#optionAdvancedTelemetrySwitch').prop('checked', true);
});
telemetry.on('disabled_adv_telemetry', function() {
    $('#optionAdvancedTelemetrySwitch').prop('checked', false);
});