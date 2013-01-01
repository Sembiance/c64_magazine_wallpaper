"use strict";

var base = require("node-base"),
	step = require("step"),
	path = require("path"),
	histogram = require("histogram"),
	fs = require("fs");

var MAX_DEVIATION = 24;
var MIN_COLOR = 192;

if(process.argv.length<3)
	printUsageAndExit();

var testImage = process.argv[2];

if(!fs.statSync(testImage).isFile())
	printUsageAndExit("testImage must be a file");

function printUsageAndExit(err)
{
	if(err)
		base.error(err);

	base.error("Usage: testImage <testFile>");
	process.exit(1);
}

var imageQueue = [testImage];

processNextImage(function finish(err)
{
	if(err)
	{
		base.error(err);
		process.exit(1);
	}

	process.exit(0);
});

function processNextImage(cb)
{
	var image = imageQueue.pop();

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

				if([r,g,b].average()>=MIN_COLOR && [r,g,b].standardDeviation()<=MAX_DEVIATION)
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
			
			base.info("%s has %s color percentage", image, colorPercentage);

			this();
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
