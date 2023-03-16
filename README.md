# Digifile
Chrome extension to enable download/preview buttons (i.e., digify scraper)

Enables toolbar buttons:  
- print button opens file as pdf in same window
- download button downloads file

* Due to API limitations, must set automatic downlaod in browser and also set location to save scraped files there

Can also click extension button to scrape, must provide an excel sheet with all the links of the files in the database  
These can be found by clicking the three dots in the main page and selecting `export file index`  
Can take a very long time - ~10 sec per 15 pages  

After it finishes, run `build_heirarchy.mjs {download_dir}` to re-built the file heirarchy!

Pressing the `pause` button generates a list of all the currently indexed files.  
I've also provided a small `generate_progress.mjs` helper utility to construct this progress file in case the process was stopped some otherway.    
Supply `progress.txt` when scraping to continue from where the scraper left off 
