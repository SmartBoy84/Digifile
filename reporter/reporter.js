window.addEventListener("DOMContentLoaded", async () => {
    console.log("Loaded!")
    await new Promise(resolve => setTimeout(resolve, 1000))

    // looping allows this window to be reused if necessary
    while (true) {
        
        let command = await chrome.runtime.sendMessage({ "type": "reporter" })

        if (command["type"] == "download") {

            let data = command["data"]
            let fileName = command["name"]

            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
            var downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", fileName);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        if (command["type"] == "alert") {
            alert(command["alert"])
        }
    }
    // window.close()
})