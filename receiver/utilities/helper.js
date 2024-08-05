let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let enableElement = (element, status) => element.setAttribute("class", `${element.getAttribute("class").replaceAll("hidden", "")}${status == true ? "" : " hidden"}`)

let setProgress = (message) => {
    enableElement(document.querySelector("#printServiceOverlay"), message != undefined)
    enableElement(document.querySelector("#overlayContainer"), message != undefined)

    enableElement(document.querySelector("#printServiceOverlay > .dialog > .buttonRow"), false)
    enableElement(document.querySelector("#passwordOverlay"), false)

    document.querySelector("#printServiceOverlay > .dialog > .row > span").innerHTML = message
}

let changeProgress = (progress) => {
    progress = Math.round(progress)
    document.querySelector("#printServiceOverlay").querySelector("progress").value = progress
    document.querySelector("#printServiceOverlay").querySelector(".relative-progress").innerHTML = `${progress}%`
}

let getError = () => {

    if (document.querySelector(".page-container")) {
        return "not in a document"
    }

    let pass = document.querySelector("#passwordOverlay")
    if (pass && !pass.getAttribute("class").includes("hidden")) {
        return "document locked"
    }

    let unsupported = document.querySelector(".rf-block")
    if (unsupported && !unsupported.hidden) { return "document couldn't be loaded" }

    let excel = document.querySelector(".spread-sheet-content") // god damn excel documentsss!
    if (excel && !excel.hidden) { return "excel documents not supported" }
}


function urlContentToDataUri(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise(callback => {
            let reader = new FileReader();
            reader.onload = function () { callback(this.result) };
            reader.readAsDataURL(blob);
        }));
}

let addButton = (name, cFn) => {

    let button = document.createElement("button")
    button.innerHTML = name
    button.addEventListener("click", () => cFn())
    button.style.cssText = "background-color: #f0f0f0; color: #000; border: 1px solid #ccc; padding: 2px 6px; font-size: 14px; cursor: pointer; margin: 3px 5px; border-radius: 3px;"

    let container = document.querySelector(".dgf-toolbarViewerRight") // subject to breakage due to page updates
    container.prepend(button)
}

let sendMessage = (data) => window.postMessage(data, "*");

let traveller = (scrollStride, scrollSpeed, time) => new Promise(async (resolve, reject) => {
    let max = parseInt(document.getElementById("viewer").offsetHeight)
    let intervals = Math.floor(time / scrollSpeed)
    let viewer = document.getElementById("viewerContainer")

    if (max > 0) {
        let current = 0

        let adder = scrollStride

        while (intervals-- > 0) {

            await getWait(scrollSpeed)
            current += adder

            viewer.scroll(0, current)

            if (current <= 0 || current >= max) {
                adder *= -1
                current = current >= max ? max : current <= 0 ? 0 : current
            }
        }
    }
    resolve()
})

let getPath = () => Array.from(document.querySelectorAll(".path-name-in-drop-down, .path-name:not(.level_1)")).map(a => a.innerHTML.trim()).join("/")

let getChecked = () => {
    let path = getPath()

    return Array.from(document.querySelectorAll(".datatable-checkbox"))
        .reduce((a, b) => b.checked ?
            [...a, `${path}/${b.closest("datatable-row-wrapper").querySelector(".file-name > a").innerHTML.trim()}`]
            : a, [])
}