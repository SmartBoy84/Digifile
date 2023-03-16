import { promises as fs } from 'fs'
import path, { dirname } from 'path'

try {
    if (process.argv.length == 2) {
        throw ("Please supply path where the pdfs are stored!")
    }

    console.log(JSON.stringify((await fs.readdir(process.argv[2])).filter(e => e.split(".").pop().toLowerCase() == "pdf")))

} catch (error) {
    console.log(error)
}