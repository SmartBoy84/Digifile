#!/usr/bin/env node

import fs from 'fs'
import path, { dirname } from 'path'

try {
    if (process.argv.length == 2) {
        throw ("Please supply path where the pdfs are stored!")
    }

    function* readAllFiles(dir) {
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
            if (file.isDirectory()) {
                yield* readAllFiles(path.join(dir, file.name));
            } else {
                yield path.join(dir, file.name);
            }
        }
    }

    let allFiles = [];
    for (let file of readAllFiles(process.argv[2])) {
        file = file.replaceAll(process.argv[2], "/").replaceAll(/^\/*/g, "/").replaceAll(/^\/\$\$/g, "$$$$").replaceAll("/", "$$$$")
        allFiles.push(file)
    }

    console.log(JSON.stringify(allFiles.filter(e => e.split(".").pop().toLowerCase() == "pdf")))

} catch (error) {
    console.log(error)
}
