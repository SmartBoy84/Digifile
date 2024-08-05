let getObserver = (page, cFn) => new Promise(resolve => {
    new MutationObserver((mutations, observer) => {
        if (cFn(mutations)) {
            observer.disconnect();
            resolve()
        }
    }).observe(page, { childList: true, subtree: true }) // we want to watch for element additions and style changes
})

let renderFile = (resolution) =>
    new Promise(async (masterResolve, masterReject) => {
        console.log("Rendering")

        let collection = []

        if (resolution > 0) {
            let pageZoom = document.getElementById("scaleSelect")
            pageZoom.value = resolution
            pageZoom.dispatchEvent(new Event('change'))
        }

        let pageError = getError(); // yes, this is not superfluous code - it is necessary (LOOK)
        if (pageError) {
            masterReject(pageError)
            return
        }

        let pgNumber = document.getElementById("pageNumber")
        let pageCount = pgNumber.getAttribute("max")
        let currentPage = pgNumber.value

        let setPage = (n) => {
            pgNumber.value = n
            pgNumber.dispatchEvent(new Event('change'))
        }

        let pageContainer = document.querySelectorAll(".pdfViewer > .page")
        if (pageContainer.length < pageCount) {
            masterReject("Mismatching pagecounts")
            return
        }

        setProgress("Rendering page")
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            setPage(pageIndex + 1)
            changeProgress(parseFloat(pageIndex / pageCount) * 100)

            let page = pageContainer[pageIndex]

            // wait for page to load
            console.log("waiting for page to load")

            await Promise.all([
                // wait for canvas to appear
                page.querySelector(".canvasWrapper") ? null : getObserver(page,
                    () => document.querySelector(".canvasWrapper")
                ),

                // wait for loading icon to disappear
                !page.querySelector(".loadingIcon") ? null : getObserver(page,
                    () => !page.querySelector(".loadingIcon")
                ),
            ])

            let pageCanvas = page.querySelector(".canvasWrapper > canvas")
            if (!pageCanvas) {
                masterReject("Page canvas not found?!")
            }

            collection.push(pageCanvas.toDataURL("image/png"))
        }
        console.log("rendering routine finished")

        setProgress(null)
        setPage(currentPage)

        masterResolve(collection)
        return
    })

let saveFile = async (newPage, pathName, resolution) => {
    try {
        console.log("Downloading")

        // render file
        let collection = await (renderFile(resolution))

        if (collection.length == 0) {
            throw "empty document?"
        }

        // start PDF compilation
        setProgress("Compiling PDF")

        let dummyImg = new Image()
        let doc = new PDFDocument({ autoFirstPage: false });
        let stream = doc.pipe(blobStream());

        for (let i = 0; i < collection.length; i++) {

            await getWait(10) // allow other shizzle to run
            changeProgress(parseFloat(i / collection.length) * 100)

            dummyImg.src = collection[i]

            await dummyImg.decode()

            doc.addPage({ size: [dummyImg.width, dummyImg.height] });
            doc.image(dummyImg.src, 0, 0, { width: dummyImg.width, height: dummyImg.height });
        }

        setProgress("Packing the pdf...")
        changeProgress(100)

        doc.end();

        stream.on('finish', function () {
            let blob = stream.toBlob('application/pdf');
            if (newPage) {
                window.open(URL.createObjectURL(blob), "_blank");
            } else {
                let link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = pathName;
                link.click();
            }
        });

        setProgress(null)

    } catch (error) {
        console.log(`Error saving file: ${error}`)
        return error
    }
}