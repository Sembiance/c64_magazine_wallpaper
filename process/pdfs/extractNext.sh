#!/bin/bash

rm -rf wip
mkdir -p wip
next=`ls -1 *.pdf | head -n 1`
mv "$next" wip
cd wip
pdfimages "$next" ./
/home/sembiance/bin/rename "[-]" "" *.ppm
find ./ -type f -name "*.ppm" -exec convert {} {}.png \;
rm -f *.ppm
/home/sembiance/bin/rename "ppm.png" "png" *.png
/home/sembiance/bin/bfr insert 0 `basename -s ".pdf" "$next"` *.png
mv *.png ../../images
cd ..
mv wip/"$next" done
