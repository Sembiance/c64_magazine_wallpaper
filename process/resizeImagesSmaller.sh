#!/bin/bash

find ./ -type f -name "*.png" -exec convert {} -resize 400x540 {} \;
find ./ -type f -name "*.png" -exec composite -gravity Center {} /mnt/compendium/DevLab/commodore_magazine_wallpaper/process/background.png {} \;
