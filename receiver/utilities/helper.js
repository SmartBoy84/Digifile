let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let enableElement = (element, status) => element.setAttribute("class", `${element.getAttribute("class").replaceAll("hidden", "")}${status == true ? "" : " hidden"}`)

let setProgress = (message) => {
    enableElement(document.querySelector("#printServiceOverlay"), message != undefined)
    enableElement(document.querySelector("#overlayContainer"), message != undefined)

    enableElement(document.querySelector("#printServiceOverlay").querySelector("buttonRow"), false)
    enableElement(document.querySelector("#passwordOverlay", false))

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

let enableButton = (ele, cFn) => {

    let clone = ele.cloneNode(true)

    clone.removeAttribute("disabled")
    clone.addEventListener("click", () => cFn())

    ele.parentNode.replaceChild(clone, ele)
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