import { AtemClient } from "./atemClient.js";
import { DeviceController } from "./deviceController.js";
import { Network } from "./network.js";
import { Views } from "./enum/views.js";

class App {
    programColor = "#FF0000"
    previewColor = "#00FF00"
    showStreamState = true
    lastAtemDevice = ''
    lastManualIP = ''

    constructor() {
        this.atemClient = new AtemClient();
        this.deviceController = new DeviceController();
        this.network = new Network();
    }

    async init() {
        let self = this;
        self.initTelemetry();

        self.showStreamState = await window.app.getStore('settings-show-stream-status')
        self.showStreamState = (self.showStreamState === false) ? false : true;

        self.lastAtemDevice = await window.app.getStore('settings-atem-device')
        self.lastAtemDevice = (self.lastAtemDevice || self.lastAtemDevice == '-1') ? self.lastAtemDevice : ''

        self.lastManualIP = await window.app.getStore('settings-manual-ip')
        self.lastManualIP = (self.lastManualIP) ? self.lastManualIP : ''

        self.atemClient.init();
        self.deviceController.init();
        self.network.init();

        self.showView(Views.Tally);
        self.bindNavUI();
        self.bindSettingsUI();


        $("#inputManualIpaddress").hide();

        // Check for tally color setting from store
        if (window.app.getStore('programColor')) {
            self.programColor = await window.app.getStore('programColor');
            $('#btnProgramColor').val(self.programColor);
        }

        if (window.app.getStore('previewColor')) {
            self.previewColor = await window.app.getStore('previewColor');
            $('#btnPreviewColor').val(self.previewColor);
        }

        // Default to first network interface
        // if (getNetworkInteraces().length > 0)
        //     networkInterface = getNetworkInteraces()[0].address;

        self.updateTally()
            // setDisconnectedState();

        self.atemClient.on('connect', () => {
            self.updateCameras();
        })
        self.atemClient.on('update', () => {
            self.updateTally();
        });

        self.atemClient.on('disconnect', () => {
            self.updateTally();
        });

        await self.updateDevices();
        await self.getUpdates();
    }

    setProgramColor(hex) {
        this.programColor = hex;
        window.app.setStore('programColor', hex);
        self.updateTallyColor();
    }

    setPreviewColor(hex) {
        this.previewColor = hex;
        window.app.setStore('previewColor', hex);
        self.updateTallyColor();
    }

    /**
     * Checks to see if the current app is the latest version
     */
    async checkVersion() {
        const options = {
            repo: 'atem-tally-lite', // repository name
            owner: 'designshift', // repository owner
            currentVersion: await this.getVersion(), // your app's current version
        };
    }

    /**
     * Gets the current installed app version
     * @returns String containing version number. "2.0.0"
     */
    async getVersion() {
        const version = await window.app.getVersion();
        return version;
    }

    hideMenu() {
        $('#navbarMainToggler').addClass('collapsed');
        $('#navbarMainToggler').prop('aria-expanded', 'false');
        $('#navbarMain').removeClass('show');
    }

    showView(viewname) {
        this.hideMenu();
        $('.view').css('display', 'none');
        if (viewname) {
            $('#' + viewname).css('display', 'block');
        } else {
            $('#' + Views.Tally).css('display', 'block');
        }
        window.telemetry.trackPageView(viewname);
    }

    updateCameras() {
        let cameras = this.atemClient.state.availableCameras;
        let prevSelection = $('#inputCameraSelection').val();

        $('#inputCameraSelection').html("");
        if (Object.keys(cameras).length > 0) {
            $('#inputCameraSelection').prop("disabled", false);
            $('#inputCameraSelection').append($('<option/>', {
                value: "ALL",
                text: "All Cameras",
                selected: (!prevSelection || prevSelection === "ALL")
            }));

            if (this.showStreamState) {
                $('#inputCameraSelection').append($('<option/>', {
                    value: "stream",
                    text: "Streaming status",
                    selected: (!prevSelection || prevSelection === "stream")
                }));
            }

            $.each(Object.values(cameras), function(key, value) {
                $('#inputCameraSelection').append($('<option/>', {
                    value: value.id,
                    text: value.name + " (" + value.shortName + " - " + value.interface + ")",
                    selected: (parseInt(prevSelection) == value.id)
                }));
            })
        } else {
            $('#inputCameraSelection').prop("disabled", true);
            $('#inputCameraSelection').append($('<option/>', {
                value: "",
                text: "No cameras detected"
            }));
        }
    }

    /**
     * Updates tally screen color based on user settings
     */
    updateTallyColor() {
        $('.tally').css('background', '#333333'); // Reset all to black first
        $(".tally[data-tally-state='preview']").css('background', this.previewColor);
        $(".tally[data-tally-state='program']").css('background', this.programColor);
    }

    /**
     * Updates main tally screen with current state and rebinds click handlers
     */
    updateTally() {
        let self = this;
        let renderer = $('#viewTallyRenderer');
        let errorRenderer = $('#viewTallyError');
        renderer.show();
        errorRenderer.hide();
        renderer.removeClass('viewSingleTally viewMultiTally');

        if ($('#inputCameraSelection').prop('disabled') || !self.atemClient.state.availableCameras || self.atemClient.state.availableCameras === []) {
            errorRenderer.show();
            renderer.hide();
            errorRenderer.html('<div class="errMsg">Not connected</div>');
        } else {
            let cameras = self.atemClient.state.availableCameras;
            let sid = '';
            let output = '';
            renderer.html('');

            if ($('#inputCameraSelection').val() === "ALL") {
                if (Object.keys(cameras).length > 0) {
                    renderer.addClass('viewMultiTally');

                    $.each(Object.values(cameras), function(key, cam) {
                        let state = 'inactive';

                        output = '';

                        if (self.atemClient.state.previewSourceIds.includes(cam.id)) {
                            state = 'preview';
                        }

                        // Program overrides preview
                        if (self.atemClient.state.programSourceIds.includes(cam.id)) {
                            state = 'program';
                        }

                        renderer.append($('<div/>', {
                            class: "tally tally-multi",
                            'data-sid': cam.id,
                            'data-cid': cam.id,
                            'data-tally-state': state,
                            'data-abbreviation': cam.shortName,
                            'data-name': cam.name
                        }))
                    });

                    $('.tally-multi').each(function(i, obj) {
                        $(obj).append('<span class="tallyCameraId">' + $(obj).attr('data-cid') + '</span>');
                        $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-abbreviation') + '</span>');
                    });
                }

                if (self.showStreamState) {
                    renderer.append($('<div/>', {
                        class: "tally tally-multi tally-stream",
                        'data-sid': 'stream',
                        'data-cid': 'stream',
                        'data-tally-state': (self.atemClient.state.streamState) ? 'program' : 'inactive',
                        'data-abbreviation': 'ON AIR',
                        'data-name': 'Stream'
                    }))
                    $('.tally-stream').each(function(i, obj) {
                        $(obj).append('<span class="tallyCameraId small">' + $(obj).attr('data-abbreviation') + '</span>');
                        $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-name') + '</span>');
                    });
                }

                window.telemetry.trackEvent("update_tally", { type: 'all_cameras', camera_count: Object.keys(cameras).length });
                window.telemetry.trackAdvancedEvent("update_tally_detail", { cameras: cameras });
            } else if ($('#inputCameraSelection').val() === 'stream') {
                renderer.addClass('viewSingleTally');
                renderer.append($('<div/>', {
                    class: "tally tally-single tally-stream",
                    'data-sid': 'stream',
                    'data-cid': 'stream',
                    'data-tally-state': (self.atemClient.state.streamState) ? 'program' : 'inactive',
                    'data-abbreviation': 'ON AIR',
                    'data-name': 'Stream'
                }))
                $('.tally-stream').each(function(i, obj) {
                    $(obj).append('<span class="tallyCameraId small">' + $(obj).attr('data-abbreviation') + '</span>');
                    $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-name') + '</span>');
                });
                window.telemetry.trackEvent("update_tally", { type: 'single_stream', camera_count: Object.keys(cameras).length });
                window.telemetry.trackAdvancedEvent("update_tally_detail", { cameras: cameras });
            } else {
                renderer.addClass('viewSingleTally');
                let sid = parseInt($('#inputCameraSelection').val());
                let cam = self.atemClient.getCamera(sid);
                let state = 'inactive';

                if (self.atemClient.state.previewSourceIds.includes(sid)) {
                    state = 'preview';
                }

                // Program overrides preview
                if (self.atemClient.state.programSourceIds.includes(sid)) {
                    state = 'program';
                }

                renderer.append($('<div/>', {
                    class: "tally tally-single",
                    'data-sid': cam.id,
                    'data-cid': cam.id,
                    'data-tally-state': state,
                    'data-abbreviation': cam.shortName,
                    'data-name': cam.name
                }))

                $('.tally-single').each(function(i, obj) {
                    $(obj).append('<span class="tallyCameraId">' + $(obj).attr('data-cid') + '</span>');
                    $(obj).append('<span class="tallyCameraLabel">' + $(obj).attr('data-abbreviation') + '</span>');
                });

                window.telemetry.trackEvent("update_tally", { type: 'single_camera' });
                window.telemetry.trackAdvancedEvent("update_tally_detail", { cameras: cameras });
            }
            self.updateTallyColor();
            self.bindCameraButtons();
        }
    }


    /**
     * Update UI with list of ATEM devices on the network
     */
    async updateDevices() {
        let reconnect = null;
        let self = this;

        $('#inputDeviceSelection').html("");
        $('#inputDeviceSelection').append($('<option/>', {
            value: "",
            text: "Searching network for devices...",
            disabled: true,
            selected: true
        }));

        let results = await this.atemClient.search();

        if (results && results.length > 0) {
            $('#inputDeviceSelection').html("");
            $('#inputDeviceSelection').append($('<option/>', {
                value: "",
                text: "Select device from list"
            }));

            $.each(results, function(index, value) {
                $('#inputDeviceSelection').append($('<option/>', {
                    value: value.addresses[0],
                    text: value.name + " (" + value.addresses[0] + ")",
                    selected: (self.lastAtemDevice == value.addresses[0])
                }));

                if (self.lastAtemDevice == value.addresses[0])
                    reconnect = value.addresses[0];
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
            text: "Manual IP selection",
            selected: (self.lastAtemDevice == '-1')
        }));

        if (self.lastAtemDevice == '-1') {
            reconnect = self.lastManualIP
        }

        if (reconnect) {
            // Connect to last connected
            $('#inputDeviceSelection').val(reconnect)
            await self.atemClient.connect(reconnect);
            await self.saveConnection();
            window.telemetry.trackEvent("atem_autoconnect_previous");
        } else if (results.length == 1) {
            // Auto connect to only device on network
            $('#inputDeviceSelection').val(results[0].addresses[0])
            await self.atemClient.connect(results[0].addresses[0]);
            await self.saveConnection();
            window.telemetry.trackEvent("atem_autoconnect");
        }
    }

    async saveConnection() {
        var self = this

        await window.app.setStore('settings-atem-device', $('#inputDeviceSelection').val())
        self.lastAtemDevice = $('#inputDeviceSelection').val()

        await window.app.setStore('settings-manual-ip', $('#inputManualIpaddress').val())
        self.lastManualIP = $('#inputManualIpaddress').val()
    }

    /**
     * Binds event handlers for each camera on the tally screen
     */
    bindCameraButtons() {
        $('.tally-multi').on('click', function(cam) {
            var sid = $(this).data('sid');
            $('#inputCameraSelection').val(sid);
            $('#inputCameraSelection').trigger('change');
            window.telemetry.trackEvent("click", { label: "tally_camera", sid: sid })
        });
        $('.tally-single').on('click', function(cam) {
            $('#inputCameraSelection').val("ALL");
            $('#inputCameraSelection').trigger('change');
            window.telemetry.trackEvent("click", { label: "tally_camera", sid: "ALL" })
        });
    }

    /**
     * Bind click handlers for main app navigation
     */
    bindNavUI() {
        var self = this;
        $('#navTally,#btnGoToTally').on('click', function() {
            self.showView(Views.Tally);
            window.telemetry.trackEvent("nav", { label: Views.Tally });
        });

        $('#navSettings').on('click', function() {
            self.showView(Views.Settings);
            window.telemetry.trackEvent("nav", { label: Views.Settings });
        });

        $('#navWeb').on('click', function() {
            // updateQRCode();
            self.showView(Views.Web);
            window.telemetry.trackEvent("nav", { label: Views.Web });
        });

        $('#navDevices').on('click', function() {
            self.showView(Views.Devices);
            window.telemetry.trackEvent("nav", { label: Views.Devices });
        });

        $('#navAbout').on('click', function() {
            self.showView(Views.About);
            window.telemetry.trackEvent("nav", { label: Views.About });
        });
    }

    /**
     * Bind click handlers for settings screen
     */
    async bindSettingsUI() {
        var self = this;

        // ATEM DEVICE
        $('#inputDeviceSelection').on('change', () => {
            if ($('#inputDeviceSelection').val() == '-1') {
                $('#inputManualIpaddress').show();
                $('#inputManualIpaddress').trigger('focus');
            } else {
                $('#inputManualIpaddress').hide();
            }

            self.lastAtemDevice = $('#inputDeviceSelection').val()

            window.telemetry.trackEvent("click", { label: "change_device_selection", type: ($('#inputDeviceSelection').val() == '-1') ? "manual" : "auto" });
        });

        $('#inputManualIpaddress').val(self.lastManualIP)
        $('#inputManualIpaddress').on('change', () => {
            self.lastManualIP = $('#inputManualIpaddress').val()
            window.app.setStore('settings-manual-ip', $('#inputManualIpaddress').val())
        })

        $('#btnConnectDevice').on('click', function() {
            var selectionIp = $('#inputDeviceSelection').val();
            if (selectionIp == "") {
                // TODO Add warnings
            } else if (selectionIp == "-1") {
                self.atemClient.connect($('#inputManualIpaddress').val());
                window.telemetry.trackEvent("click", { label: "connect_atem", type: "manual" });
            } else {
                self.atemClient.connect(selectionIp);
                window.telemetry.trackEvent("click", { label: "connect_atem", type: "auto" });
            }
            self.saveConnection();
        });

        $('#btnDisconnectDevice').on('click', function() {
            // Only disconnect if currently connected
            self.atemClient.disconnect();
            window.telemetry.trackEvent("click", { label: "disconnect_atem" });
        });

        $('#btnRescanNetwork').on('click', function() {
            self.updateDevices();
            window.telemetry.trackEvent("click", { label: "rescan_atem" });
        });


        $('#optionShowStreamStatus').prop('checked', self.showStreamState);
        $('#optionShowStreamStatus').on('change', function() {
            self.showStreamState = $('#optionShowStreamStatus').is(":checked")

            if (!self.showStreamState)
                $('#inputCameraSelection').val('ALL')

            self.updateCameras()
            self.updateTally()
            window.app.setStore('settings-show-stream-status', $('#optionShowStreamStatus').is(":checked"))
            window.telemetry.trackEvent("click", { label: "change_toggle_stream", value: $('#optionShowStreamStatus').is(":checked") })
        });

        // TALLY
        $('#inputCameraSelection').on('change', function() {
            self.updateTally();
            window.telemetry.trackEvent("click", { label: "change_camera" });
        })

        // UI COLORS
        $('#btnProgramColor').on('change', function() {
            self.setProgramColor($('#btnProgramColor').val());
            window.telemetry.trackEvent("click", { label: "set_program_color", color: programColor });
        })

        $('#btnPreviewColor').on('change', function() {
            self.setPreviewColor($('#btnPreviewColor').val());
            window.telemetry.trackEvent("click", { label: "set_preview_color", color: previewColor });
        })

        // WEB INTERFACE
        self.network.on('ready', () => {
            $('#portSelection').val(self.network.getLastExt())
        })
        $('#portSelection').on('change', function() {
            self.network.setLastExt($('#portSelection').val());
            window.telemetry.trackEvent("click", { label: "change_network_interface" });
        })

        // TELEMETRY
        $('#optionTelemetrySwitch').on('click', function() {
            if ($('#optionTelemetrySwitch').is(":checked")) {
                window.telemetry.enableTracking();
                window.telemetry.trackEvent("click", { label: "enabled_telemetry" });
            } else {
                window.telemetry.trackEvent("click", { label: "disabled_telemetry" });
                window.telemetry.disableTracking();
            }
        });

        $('#optionAdvancedTelemetrySwitch').on('click', function() {
            if ($('#optionAdvancedTelemetrySwitch').is(":checked")) {
                window.telemetry.enableAdvancedTracking();
                window.telemetry.trackEvent("click", { label: "enabled_advanced_telemetry" });
            } else {
                window.telemetry.trackEvent("click", { label: "disabled_advanced_telemetry" });
                window.telemetry.disableAdvancedTracking();
            }
        });
    }

    /**
     * Initializes telemetry states
     */
    async initTelemetry() {
        let telemetryState = await window.telemetry.getTrackingState();
        let uuid = await window.telemetry.getUuid();
        $('#optionTelemetrySwitch').prop('checked', telemetryState.telemetry);
        $('#optionAdvancedTelemetrySwitch').prop('checked', telemetryState.advancedTelemetry);
        $('#telemetryIdentifier').html(uuid);
    }

    async getUpdates() {
        let self = this;
        let res = await window.app.getUpdate();
        let version = await self.getVersion();

        $('#appVersion').html("Version " + version);

        if (res.hasUpdate) {
            // Update is available
            $('.update-banner').remove();
            $('.viewport-frame').append(

                $('<div>', {
                    class: 'update-banner toast align-items-center text-bg-warning',
                    role: 'alert',
                    id: 'updateToast',
                    'aria-live': 'assertive',
                    'aria-atomic': 'true',
                    'data-bs-delay': 30000
                }).append(
                    $('<div>', {
                        class: 'd-flex'
                    }).append(
                        $('<div>', {
                            class: 'toast-body'
                        }).append(
                            $('<span/>', {
                                text: "A new version is available to download"
                            }),
                            $('<a/>', {
                                text: "Get Update",
                                href: "https://designshift.ca/apps/atem-tally?utm_campaign=update_banner&utm_medium=desktop_app&utm_source=tally-lite-" + version
                            })

                        ),
                        $('<button>', {
                            type: 'button',
                            class: 'btn-close me-2 m-auto',
                            'data-bs-dimiss': 'toast',
                            'aria-lavel': 'Close'
                        })

                    )
                )
            )

            let toastUpdate = new bootstrap.Toast('#updateToast')
            toastUpdate.show()
        }
    }
}

export { App }