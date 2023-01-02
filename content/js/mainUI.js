import { App } from "./app.js";

let appUi = new App();

(window).onload = async() => {
    await appUi.init();
}

$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    window.app.openUrl(this.href);
});