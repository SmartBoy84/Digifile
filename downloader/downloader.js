let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let printFile = () => document.getElementById("print").click()
let isLocked = () => document.querySelector("#passwordOverlay") && !document.querySelector("#passwordOverlay").getAttribute("class").includes("hidden")
let getName = () => document.querySelector(".viewer-file-name").innerHTML


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

    // let adder = new MutationObserver(async (mutations) => {
    //     for (var child of mutations) {
    //         if (child.type === "childList" && child.addedNodes.length > 0) {
    //             for (ele of child.addedNodes) {
    //                 let image = ele.querySelector("img")
    //                 if (ele) {
    //                     finalPDF.addPage()
    //                     console.log("added image!", data)

    //                     finalPDF.addImage(image, 'JPEG', 0, 0, 210, 297)

    //                 }
    //             }
    //         }
    //     }
    // }).observe(printContainer, { childList: true, subtree: true })

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
        finalPDF.addImage(images[i], 'JPEG', 0, 0, 210, 297, '', 'FAST')
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
    /*
    fix passwordOverlay case (there are likely going to be other cases, videos?!)
    */
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
            if (num > 0 && loadingPages.length < num) // the last one ensures that atleast one page has loaded!
                break
        }
    }

    // cater for scraper's demands, if present
    console.log("loaded, asking for my type")
    let myType = await chrome.runtime.sendMessage({ "type": "scrape" })

    console.log("My type is:", myType ? myType : "normal page")

    await getWait(2000) // really hacky solution, but what can I do?

    // prepare printing
    var event = new CustomEvent("beforeprint")
    document.dispatchEvent(event)

    if (myType) {
        console.log("automatic scraping in play!")

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