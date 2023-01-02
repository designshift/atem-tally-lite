import { EventEmitter } from "./eventEmitter.js";

class DeviceController extends EventEmitter {
    devicesSaved = [];

    constructor() {
        super()
    }

    saveDeviceByIp(ip) {
        window.clients.saveByIp(ip)
    }

    async getSavedDeviceList() {
        let saved = await window.clients.getSavedDevices()
        return saved
    }

    async getAvailableDeviceList() {
        let availables = await window.clients.getAvailableDevices()
        return availables
    }

    async sendCommand(command, device = null) {
        switch (command) {
            case 'ident':
            case 'call':
                break;
            default:
        }
    }

    async init() {
        let self = this

        self.bindUI()
        self.onUpdate()
        self.connectEnabledClients()

        window.clients.onUpdate((event, devicesSaved) => {
            self.onUpdate()
        })
        window.atem.onConnect((event, state) => {

        })
        window.atem.onUpdate((event, state) => {
            self.onUpdate()
        })
    }

    async connectEnabledClients() {
        let self = this;
        let devices = await self.getSavedDeviceList()

        // Reconnect all enabled devices
        Object.keys(devices).forEach((k) => {
            let d = devices[k]
            if (d.enabled) {
                window.clients.enable(d.txt.id)
            }
        });
    }
    async onUpdate() {
        let self = this;
        let devices = await self.getSavedDeviceList()
        let atem = await window.atem.state()
        let inputs = atem.availableCameras

        let ui = $('#deviceList').html('').append($('<ul>', { class: 'list-group device-list' }))
        ui = $('.device-list')

        if (!devices || devices.length <= 0) {
            ui.append($('<li>', { class: 'list-group-item' }).text('No devices configured'))
        } else {


            Object.keys(devices).forEach((k) => {
                let d = devices[k]
                ui.append($('<li>', { class: 'list-group-item position-relative' }).append(
                    $('<div>', { class: 'form-check form-switch' }).append(
                        $('<input>', {
                            type: 'checkbox',
                            class: 'form-check-input',
                            id: 'inputDevice-Enable-' + d.txt.id,
                            checked: (d.enabled)
                        }).on('change', () => {
                            if ($('#inputDevice-Enable-' + d.txt.id).prop('checked')) {
                                window.clients.enable(d.txt.id)
                            } else {
                                window.clients.disable(d.txt.id)
                            }
                        }),
                        $('<label>', { class: 'form-check-label' }).text(d.name + " (" + d.addresses[0] + ")"),
                    ),
                    $('<span>', { id: 'labelDevice-State-' + d.txt.id, class: 'badge bg-danger rounded-pill' }).text('Disconnected'),
                    $('<i>', { id: 'btnDevice-Delete-' + d.txt.id, class: 'p-1 px-2 bi-x-circle position-absolute top-0 end-0 text-danger fs-5' }).on('click', () => {
                        window.clients.remove(d.txt.id)
                    }),
                    $('<div>', { class: 'mb-3 row' }).append(
                        $('<label>', { class: 'col-sm-2 col-form-label', for: 'inputDevice-Input-' + d.txt.id, }).text('Camera Input'),
                        $('<select>', { class: 'col-sm-4 form-select inputDevice-Input', id: 'inputDevice-Input-' + d.txt.id, }).on('change', () => {
                            let cam = $('#inputDevice-Input-' + d.txt.id).val()
                            window.clients.setDeviceCamera(d.txt.id, cam)
                        }),
                    ),
                ))

                if (d.connected) {
                    $('#labelDevice-State-' + d.txt.id).removeClass('bg-danger')
                    $('#labelDevice-State-' + d.txt.id).addClass('bg-success')
                    $('#labelDevice-State-' + d.txt.id).text('Connected')
                }

                if (!inputs || inputs.length <= 0) {
                    $('#inputDevice-Input-' + d.txt.id).append(
                        $('<option>', {
                            value: '',
                            text: 'ATEM not connected'
                        })
                    )
                }
                Object.keys(inputs).forEach((k) => {
                    let i = inputs[k];
                    $('#inputDevice-Input-' + d.txt.id).append(
                        $('<option>', {
                            value: i.id,
                            text: i.id + ": " + i.name + " (" + i.shortName + " - " + i.interface + ")",
                            selected: (d.txt.camera == i.id.toString()) ? true : false
                        })
                    )
                })
            })
        }
    }

    async bindUI() {
        var self = this;

        $('#btnAddDeviceModal').on('click',
            async() => {
                // List available devices minus saved devices
                let availables = await self.getAvailableDeviceList()
                $('#modalAddDeviceDiscovered').html('')


                $('#modalAddDeviceDiscovered').append($('<div/>', { class: 'input-group mb-3' }).append(
                    $('<b/>').text('Network Discovered')
                ));
                if (availables.length <= 0) {
                    $('#modalAddDeviceDiscovered').append($('<div/>', { class: 'input-group mb-3' }).text('No devices found'))
                }
                Object.keys(availables).forEach((key) => {
                    let d = availables[key];
                    $('#modalAddDeviceDiscovered').append($('<div/>', { class: 'input-group mb-3' }).append(
                        $('<div/>', { class: "input-group-text" }).append(
                            $('<input/>', {
                                class: "form-check-input modal-discovered-device-input",
                                type: "checkbox",
                                value: d.addresses[0],
                                name: "modal-discovered-device-input",
                                id: "modal-discovered-device-" + d.host,
                                'data-host': (d.host) ? d.host : '',
                                'data-devid': (d.txt.id) ? d.txt.id : '',
                                'data-hardware': (d.txt.hardware) ? d.txt.hardware : '',
                                'data-camera': (d.txt.camera) ? d.txt.camera : ''
                            }),
                        ),
                        $('<input/>', {
                            type: 'text',
                            class: "form-control",
                            readonly: true,
                            value: ((d.host) ? d.host : 'Unknown host') + " (" + d.addresses[0] + ")"
                        }).on('click', (event) => {
                            event.preventDefault();
                            $("#modal-discovered-device-" + d.host).prop(
                                'checked', !($("#modal-discovered-device-" + d.host).prop('checked'))
                            )
                        }),
                    ));

                })

                $('#modalAddDeviceDiscovered').append($('<div/>', { class: 'input-group mb-3' }).append(
                    $('<b/>').text('Manually Configured')
                ));
                $('#modalAddDeviceDiscovered').append($('<div/>', { class: 'input-group mb-3' }).append(
                    $('<div/>', { class: "input-group-text", }).append(
                        $('<input/>', {
                            class: "form-check-input mt-0",
                            type: "checkbox",
                            value: "manual",
                            id: 'inputCheckAddDeviceManualIP'
                        }),
                    ),
                    $('<input/>', {
                        type: 'text',
                        class: 'form-control',
                        id: 'inputTextAddDeviceManualIP',
                        placeholder: 'Enter an IP address: 1.1.1.1',
                    }).on('click', () => { $('#inputCheckAddDeviceManualIP').prop('checked', true) }),
                    $('<div/>', {
                        id: "inputCheckAddDeviceManualFeedback",
                    })
                ));

            });

        $('#modalAddDeviceSubmit').on('click', (e) => {
            let d = [] // Device IPs
            let regex = new RegExp('^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$')

            if ($('#inputCheckAddDeviceManualIP').prop('checked')) {
                if (regex.test($('#inputTextAddDeviceManualIP').val())) {
                    self.saveDeviceByIp($('#inputTextAddDeviceManualIP').val())
                } else {
                    $('#inputCheckAddDeviceManualFeedback').text('Enter a valid IPv4 address')
                    $('#inputCheckAddDeviceManualFeedback').addClass('invalid-feedback')
                    $('#inputCheckAddDeviceManualFeedback').css('display', 'block')
                    return;
                }
            }

            $("input[name='modal-discovered-device-input']:checked").each(
                (k) => {
                    d.push($("input[name='modal-discovered-device-input']:checked")[k].value)
                })

            Object.keys(d).forEach((key) => {
                self.saveDeviceByIp(d[key])
            })

            bootstrap.Modal.getInstance('#modalAddDevice').hide()
        })
    }
}

export { DeviceController }