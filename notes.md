First trick was basically exploiting the fact that they forgot to actually disable downloading/printing.
Heck, they just had an element in plainsight that one could press and call it a day!

New method will be slightly more resistant to patching and be more versatile.
I have checked and it's possible to simply use Chromium API to take screenshots of the canvas elements.

This will also allow the user to control "quality" of the exported images - base level fitting the page to screen and negative values are less than that, positive is more than that. Base level could be made less.
Disadvantages of this method are that it requires manual scrolling and waiting for target page to load - might be a way to force all pages to load?
User interaction could be blocked by using the build in download prompt or making your own.

Inspiration: `https://chrome.google.com/webstore/detail/canvas-downloader-find-an/dgfcgcafnnbdpojemnkiiilnnghebgja`