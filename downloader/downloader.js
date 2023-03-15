let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let printFile = () => document.getElementById("print").click()
let isLocked = () => document.querySelector("#passwordOverlay") && !document.querySelector("#passwordOverlay").getAttribute("class").includes("hidden")


function urlContentToDataUri(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise(callback => {
            let reader = new FileReader();
            reader.onload = function () { callback(this.result) };
            reader.readAsDataURL(blob);
        }));
}

let saveFile = async (newPage, pathName) => {

    if (isLocked()) {
        console.log("File locked, aborting")
        return "document locked"
    }

    let printService = document.querySelector("#printServiceOverlay")
    let finalPDF = new jsPDF()

    let wait = new Promise((resolve, reject) => {
        new MutationObserver((mutations, observer) => {
            for (var mutation of mutations) {

                if (mutation.type == "attributes" && printService.getAttribute("class").includes("hidden")) {
                    console.log("finished rendering")

                    // adder.disconnect()
                    observer.disconnect()
                    resolve()
                }
            }
        }).observe(printService, { attributes: true })
    })

    printFile()
    await wait

    let images = document.querySelector("#printContainer").querySelectorAll("img")

    if (images.length == 0) {
        return "empty document?"
    }

    for (let i = 0; i < images.length; i++) {
        finalPDF.addImage(images[i], 'JPEG', 0, 0, 210, 297, '', 'FAST') // I have no clue what these magic values are - maybe I'll check them out?
        if (i < images.length - 1) {
            await finalPDF.addPage() // so that a blank page isn't added at the end
        }
    }
    document.getElementById("printCancel").click()

    if (newPage) {
        window.open(URL.createObjectURL(finalPDF.output("blob")), "_self")
    }
    else {
        finalPDF.save(pathName)
    }
}

let enableButton = (ele, cFn) => {

    let clone = ele.cloneNode(true)

    clone.removeAttribute("disabled")
    clone.addEventListener("click", () => cFn())

    ele.parentNode.replaceChild(clone, ele)
}

window.addEventListener("DOMContentLoaded", async () => {

    while (true) {
        await getWait(50)

        let number = document.querySelector("#pageNumber")
        let loadingPages = document.querySelectorAll(".loadingIcon")

        if (isLocked()) {
            console.log("[warning] file locked")
            break
        }

        if (number) {
            let num = parseInt(number.getAttribute("max"))
            if (num > 0 && loadingPages.length < num) // the second case ensures that at least one page has loaded! 
                // The goal is to get as close as possible to when the printService is initialized, this still isn't sufficient
                break
        }
    }

    // cater for scraper's demands, if present
    console.log("loaded, asking for my type")
    let myType = await chrome.runtime.sendMessage({ "type": "scrape" })

    console.log("My type is:", myType ? "automatically scraped" : "normal page")

    await getWait(2000) // really hacky solution, but what can I do?

    // prepare printing
    var event = new CustomEvent("beforeprint")
    document.dispatchEvent(event)

    if (myType) {
        let error = await saveFile(false, myType)
        chrome.runtime.sendMessage({ "type": "error", "error": error ? error : "" })

        window.close() // wicked
    }

    let fileName = document.querySelector(".viewer-file-name").innerHTML.replace(/\.[^/.]+$/, ".pdf")

    let buttons = document.querySelectorAll(".toolbarButton")
    buttons.forEach(ele => {
        switch (ele.getAttribute("tabindex")) {
            case "22":
                enableButton(ele, () => saveFile(true, fileName))
                break;

            case "23":
                enableButton(ele, () => saveFile(false, fileName))
                break;
        }
    })
})