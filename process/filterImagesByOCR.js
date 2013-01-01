"use strict";

var base = require("node-base"),
	step = require("step"),
	path = require("path"),
	uuid = require("node-uuid"),
	histogram = require("histogram"),
	fs = require("fs");

var MAX_PER_BATCH = 1000;
var MIN_WORD_LENGTH = 3;
var UNIQUEID = uuid.v4();

if(process.argv.length<6)
	printUsageAndExit();

var minWords = +process.argv[2];
var goodDir = process.argv[3];
var badDir = process.argv[4];
var startAtIndex = (+process.argv[5] || 0);

if(!fs.statSync(goodDir).isDirectory())
	printUsageAndExit("outDir must be a directory");

if(!fs.statSync(badDir).isDirectory())
	printUsageAndExit("badDir must be a directory");

if(minWords<0)
	printUsageAndExit("minWords must be a number greater than 0");

function printUsageAndExit(err)
{
	if(err)
		base.error(err);

	base.error("Usage: filterImages <minWords> <goodDir> <badDir> <startAtIndex>");
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
	var tmpImage = path.join("/tmp", path.basename(image, path.extname(image)) + ".tif");
	var outFile = path.join("/tmp", UNIQUEID);

	if(!fs.statSync(image).isFile(image))
	{
		if(!imageQueue.length)
			cb();
		else
			process.nextTick(function() { processNextImage(cb); });
		return;
	}

	step(
		function convertToTIF()
		{
			base.run("convert", [image, "-contrast", "-normalize", "-despeckle", "-despeckle", "-type", "grayscale", "-sharpen", "1", "-posterize", "3", "-gamma", "100", tmpImage], { silent : true}, this.parallel());
			base.run("rm", ["-f", outFile + ".txt"], { silent : true }, this.parallel());
		},
		function ocrImage(err)
		{
			if(err)
				throw err;

			base.run("tesseract", [tmpImage, outFile], { "redirect-stderr" : true, silent : true }, this);
		},
		function tryRawIfNeeded(err)
		{
			if(err)
				throw err;

			base.run("rm", ["-f", tmpImage], { silent : true }, this.parallel());

			if(!fs.existsSync(outFile + ".txt"))
				base.run("tesseract", [image, outFile], { "redirect-stderr" : true, silent : true }, this.parallel());
		},
		function getResults(err)
		{
			if(err)
				throw err;

			fs.readFile(outFile + ".txt", "utf-8", this);
		},
		function checkSimilarity(err, result)
		{
			if(err)
				throw err;

			var words = result.strip("^A-Za-z0-9.,_ -").split(" ").filter(function(word) { return word.length>MIN_WORD_LENGTH; });

			var numWords = words.length;
			
			if(numWords>=minWords)
			{
				base.info("MATCH! %s has %s num words", image, numWords);
				fs.rename(image, path.join(goodDir, image), this);
			}
			else
			{
				base.info("NO MATCH. %s has %s num words", image, numWords);
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
