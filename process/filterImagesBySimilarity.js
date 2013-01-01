"use strict";

var base = require("node-base"),
	step = require("step"),
	path = require("path"),
	fs = require("fs");

if(process.argv.length<5)
	printUsageAndExit();

var matchImage = process.argv[2];
var minSimilarity = +process.argv[3];
var outDir = process.argv[4];

if(!fs.statSync(matchImage).isFile())
	printUsageAndExit("file must be a file");

if(!fs.statSync(outDir).isDirectory())
	printUsageAndExit("outDir must be a directory");

if(minSimilarity<0 || minSimilarity>100)
	printUsageAndExit("minSimilarity must be a number between 0 and 100 (percentage similarity)");

function printUsageAndExit(err)
{
	if(err)
		base.error(err);

	base.error("Usage: filterImages <file> <minSimilarity> <outDir>");
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

		imageQueue = images.filter(function(image) { return fs.statSync(image).isFile() && image!==matchImage; }) ;

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

	step(
		function getSimilarity()
		{
			base.run("puzzle-diff", [matchImage, image], { silent : true}, this);
		},
		function checkSimilarity(err, result)
		{
			if(err)
				throw err;

			var similarity = (+result)*100;
			if(similarity>=minSimilarity)
			{
				base.info("MATCH! %s has %s similarity", image, similarity);
				fs.rename(image, path.join(outDir, image), this);
			}
			else
			{
				base.info("NO MATCH. %s has %s similarity", image, similarity);
				this();
			}
		},
		function processNextOrFinish(err)
		{
			if(err || !imageQueue.length)
				cb(err);
			else if(imageQueue.length)
				process.nextTick(function() { processNextImage(cb); });
			else
				cb();
		}
	);
}