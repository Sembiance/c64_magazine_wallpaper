"use strict";

var base = require("node-base"),
	step = require("step"),
	path = require("path"),
	histogram = require("histogram"),
	fs = require("fs");

var MAX_DEVIATION = 24;
var MIN_COLOR = 192;
var MAX_PER_BATCH = 1000;

if(process.argv.length<6)
	printUsageAndExit();

var minColorPercentage = +process.argv[2];
var goodDir = process.argv[3];
var badDir = process.argv[4];
var startAtIndex = (+process.argv[5] || 0);

if(!fs.statSync(goodDir).isDirectory())
	printUsageAndExit("outDir must be a directory");

if(!fs.statSync(badDir).isDirectory())
	printUsageAndExit("badDir must be a directory");

if(minColorPercentage<0 || minColorPercentage>100)
	printUsageAndExit("minColorPercentage must be a number greater than 0 and less than 100 (percentage of colors in the image)");

function printUsageAndExit(err)
{
	if(err)
		base.error(err);

	base.error("Usage: filterImages <minColorPercentage> <goodDir> <badDir> <startAtIndex>");
	process.exit(1);
}

var imageQueue = [];

step(
	function getImages()
	{
		fs.readdir(".", this);
	},
	function processImages(err, images)
	{
		if(err)
			throw err;

		imageQueue = images.filter(function(image, i) { return i>=(startAtIndex*MAX_PER_BATCH) && i<((startAtIndex+1)*MAX_PER_BATCH) && fs.statSync(image).isFile(); }) ;

		processNextImage(this);
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

function processNextImage(cb)
{
	var image = imageQueue.pop();

	if(!fs.statSync(image).isFile(image))
	{
		if(!imageQueue.length)
			cb();
		else
			process.nextTick(function() { processNextImage(cb); });
		return;
	}

	step(
		function getSimilarity()
		{
			histogram(image, this);
		},
		function checkSimilarity(err, result)
		{
			if(err)
				throw err;

			var totalCount = result.hexmap.values().sum();
			var nonColorCount = result.hexmap.map(function(color, count)
			{
				var r = parseInt(color.substr(1, 2), 16);
				var g = parseInt(color.substr(3, 2), 16);
				var b = parseInt(color.substr(5, 2), 16);
				var rgb = [r,g,b];

				//base.info(r, g, b, rgb.average(), rgb.standardDeviation());

				if(rgb.average()>=MIN_COLOR && rgb.standardDeviation()<=MAX_DEVIATION)
				{
					//base.info("%s %s %s is non-color", r, g, b, color);
					return [color, count];
				}
				else
				{
					//base.info("%s %s %s is COLOR", r, g, b, color);
					return ["color", 0];
				}
			}).values().sum();

			var colorPercentage = (((totalCount-nonColorCount)/totalCount)*100);
			//base.info(image, colorPercentage, nonColorCount, totalCount);
			
			if(colorPercentage>=minColorPercentage)
			{
				base.info("MATCH! %s has %s color percentage", image, colorPercentage);
				fs.rename(image, path.join(goodDir, image), this);
			}
			else
			{
				base.info("NO MATCH. %s has %s color percentage", image, colorPercentage);
				fs.rename(image, path.join(badDir, image), this);
			}
		},
		function processNextOrFinish(err)
		{
			if(err)
				cb(new Error("Error with image [" + image + "] and error: " + err));
			else if(!imageQueue.length)
				cb();
			else
				process.nextTick(function() { processNextImage(cb); });
		}
	);
}
