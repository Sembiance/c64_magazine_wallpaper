"use strict";

var base = require("node-base"),
	uuid = require("node-uuid"),
	step = require("step"),
	fs = require("fs");

step(
	function getImages()
	{
		fs.readdir(".", this);
	},
	function processImages(err, images)
	{
		if(err)
			throw err;

		images = images.filter(function(image) { return image.endsWith(".png"); });

		images.forEach(function(image)
		{
			fs.rename(image, uuid.v4() + ".png", this.parallel());
		}.bind(this));

		this.parallel()();
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