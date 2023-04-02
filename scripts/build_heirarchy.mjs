#!/usr/bin/env node

import { promises as fs } from 'fs'
import path, { dirname } from 'path'

try {
    if (process.argv.length == 2) {
        throw ("Please supply path to fix up!")
    }

    console.log("building heirarchy, please wait")
    let files = (await fs.readdir(process.argv[2])).filter(e => e.split(".").pop().toLowerCase() == "pdf").map(a => `${process.argv[2]}/${a}`)
    for (let file of files) {

        let finalPath = file.replaceAll("$$", "/")
        await fs.mkdir(path.dirname(finalPath), { recursive: true })
        await fs.rename(file, file.replaceAll("$$", "/"))
    }

} catch (error) {
    console.log(error)
}
