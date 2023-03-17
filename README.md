# Digifile
Chrome extension to enable download/preview buttons (i.e., digify scraper)

## Installation
*I haven't compressed it as that makes it difficult to conveniently distribute/access the js utilities* 
- `git clone https://github.com/smartboy84/digifile/`  
- Go to `chrome://extensions` and `load unpacked` 

## Interface features
### PDF viewer
- `print` - opens file as pdf in same window
- `download` - downloads file  
### Extension options
- `Concurrent pages` - allows for setting max number of pages which should be open at any one time. Keep this low to prevent crashes   
- `Pause button` - extension gracefully pauses scraping and saves `progress.txt` and `errors.txt`


## Utilities
### `build_heirarchy.mjs {download_dir}`
As browsers do not allow selection of download directory, scraper has to download files in the same folder   
This utility can be used to extract paths from the filenames and re-create the file heirarchy

### `generate_progress.mjs`
If the extension is stopped before completion, you can use this utility to create a `progress.txt` file which is can be supplied to the extension to allow it to continue from the point at which it stopped   
Can also be used when updating a local archive with new files 

**Note**: *`progress.txt` generation is the same regardless of if `build_heirarchy.mjs` has been run or not*

## Scraping/updating
1. If continuing/updating and `progress.txt` was deleted/wasn't downloaded by the extension, run the helper utility to create it  
2. Download the file index from digify, may take a couple of minutes   
4. Change download directory to where you have/want your archive to be made   
3. Plug in the `progress.txt` file (if updating) and select the downloaded excel file listing
4. When [new] files have been downloaded, run the heirarchy builder to merge/organise the files
5. Review `errors.txt` to determine any errors that occurred 

## Notes

* Due to API limitations, must set files to automatically download to some location

* Process can take a very long time - ~10 sec per 15 pages. 
    - Don't worry if it freezes/accidently closes/explodes as you can use `generate_progress.mjs` to create a `progress` file to continue from where you left off
    - E.g., downloading ~1500 files took ~8 hours


* Feel free to manually close unresponsive tabs, the extension recognises this and adds it to `errors.txt`. 
    - As this file isn't downloaded, it won't be included in `progress.txt` so in future re-runs the extension will try to scrape it again  
    - While the extension can handle big files (>500 mb), it's better to just close these tabs and manually download them later
