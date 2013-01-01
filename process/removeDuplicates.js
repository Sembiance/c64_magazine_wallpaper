"use strict";

var base = require("node-base"),
	step = require("step"),
	path = require("path"),
	uuid = require("node-uuid"),
	histogram = require("histogram"),
	fs = require("fs");

if(process.argv.length<3)
	printUsageAndExit();

var maxDifference = +process.argv[2];

if(maxDifference<0)
	printUsageAndExit("maxDifference must be a number greater than or equal to 0");

function printUsageAndExit(err)
{
	if(err)
		base.error(err);

	base.error("Usage: removeDuplicates <maxDifference>");
	process.exit(1);
}

var imageQueue = [];

step(
	function mkOutputDir()
	{
		base.run("mkdir", ["-p", "duplicates"], { silent : true }, this);
	},
	function getImages()
	{
		fs.readdir(".", this);
	},
	function processImages(err, images)
	{
		if(err)
			throw err;

		imageQueue = images.filter(function(image, i) { return fs.statSync(image).isFile(); }) ;

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

var compareQueue = [];

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
		function compareToRemaining()
		{
			compareQueue = imageQueue.slice();
			if(!compareQueue.length)
				this();
			else
				compareNext(this);
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

	function compareNext(compareCB)
	{
		var compareImage = compareQueue.pop();
		
		step(
			function getSimilarity()
			{
				base.run("imageDiff", [image, compareImage], { silent : true}, this);
			},
			function checkSimilarity(err, result)
			{
				if(err)
					throw err;

				var difference = +result;
				if(difference<=maxDifference)
				{
					base.info("MATCH! %s and %s have %s difference", image, compareImage, difference);
					fs.rename(compareImage, path.join("duplicates", compareImage), this);
					imageQueue.remove(compareImage);
				}
				else
				{
					base.info("NO MATCH. %s and %s have %s difference", image, compareImage, difference);
					this();
				}
			},
			function processNextOrFinish(err)
			{
				if(err || !compareQueue.length)
					compareCB(err);
				else if(compareQueue.length)
					process.nextTick(function() { compareNext(compareCB); });
				else
					compareCB();
			}
		);
	}
}


