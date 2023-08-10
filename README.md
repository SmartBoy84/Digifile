# Digifile
Chrome extension to enable download/preview buttons (i.e., digify scraper)

## Installation
>I haven't compressed it as that makes it difficult to conveniently distribute/access the js utilities
- `git clone https://github.com/smartboy84/digifile/`  
- Go to `chrome://extensions` and `load unpacked`  
- When running, open the console (`inspect views: service worker` in extension page) to monitor the scraping process   

## Interface features
### PDF viewer
- `print` - opens file as pdf in same window
- `download` - downloads file  
### Extension options
- `Pause button` - extension gracefully pauses scraping and saves `progress.txt` and `errors.txt`
- `Concurrent pages` - allows for setting max number of pages which should be open at any one time. Keep this low to prevent crashes
#### Scraper
-  `Resolution` - basically controls the zoom of the page when "screenshotting"; default is very high res already (set to 0 for max)
-   `Max page count` - Max allowed page count (high page counts can cause excessive stalling/crashes due to ram limitations)
#### Roamer
>This was added so that digify reports me having been on it (evades suspicion)
- `Scroll speed` - time to wait before moving to next page, prevent digify confirmation dialog from showing
- `Scroll stride` - number of pixels to scroll by
- `Max/min` - sets the range the `roamer` should wait on each document (default is 30-50 minutes)

## Utilities
### `fixup {download_dir}`
As browsers do not allow selection of download directory, scraper has to download files in the same folder   
This utility extract paths from the filenames and re-creates the file heirarchy 
It writes a `progress.txt` file (made regardless of file heirarchy has been regenerated or not) which can be provided to the extension to continue from where it left off in the event of some unforseen accident (e.g., computer explodes)  

*I have compiled this for various platforms and put it in releases*

**Note**: *`progress.txt` generation is the same regardless of if `fixup` has been run or not*

## Selecting
Prior to starting the scraper, open a document directory page and select files/folders  
This selection is filtered out from the excel sheet and will be the only documents that are scraped from the directory litsting (if they are found)

## Scraping/updating
1. If continuing/updating and `progress.txt` was deleted/wasn't downloaded by the extension, run the helper utility to create it  
2. Download the file index from digify, may take a couple of minutes   
4. Change download directory to where you have/want your archive to be made   
3. Plug in the `progress.txt` file (if updating) and select the downloaded excel file listing
4. When [new] files have been downloaded, run the heirarchy builder to merge/organise the files and create `progress.txt`
5. Review `errors.txt` (if it was created/downlaoded) to determine any errors that occurred 

## Notes

* Due to API limitations, must set files to automatically download to some location

* Process can take a very long time - ~10 sec per 15 pages. 
    - Don't worry if it freezes/accidently closes/explodes as you can use `fixup` to create a `progress` file to continue from where you left off
    - E.g., downloading ~1500 files took ~8 hours


* Feel free to manually close unresponsive tabs, the extension recognises this and adds it to `errors.txt`. 
    - As this file isn't downloaded, it won't be included in `progress.txt` so in future re-runs the extension will try to scrape it again  
    - While the extension can handle big files (>500 mb), it's better to just close these tabs and manually download them later
