const ffmpeg = require("ffmpeg");
const express = require("express");
const app = express();
const multer = require("multer");
const jimp = require("jimp");
const bodyparser = require("body-parser");
const fs = require("fs");
const path = require("path");
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, __dirname + "/uploads");
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
	},
});
const upload = multer({ storage: storage });
app.use(express.static(__dirname + "/public"));
app.use(express.static(__dirname + "/converted"));
app.use(express.static(__dirname + "/uploads"));
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(bodyparser.urlencoded({ extended: false }));

//////////////////////////////////////////

// Removing any uploaded or converted files if there are any
const uploads = __dirname + "/uploads"
const converted = __dirname + "/converted"

if (!fs.existsSync(uploads)){
    fs.mkdirSync(uploads);
}
else{
	fs.readdirSync(uploads).forEach(f => fs.rmSync(`${uploads}/${f}`))
}
if (!fs.existsSync(converted)){
	fs.mkdirSync(converted)
}
else{
	fs.readdirSync(converted).forEach(f => fs.rmSync(`${converted}/${f}`))
}


app.get("/", (req, res) => {
	res.render("index.ejs");
});


app.get("/document", (req, res) => {
	res.render("document");
});

app.post("/document", upload.single("file"), function (req, res, next) {
	res.send(req.file);
});

// Video file handling

app.get("/video", (req, res) => {
	res.render("video");
});

app.post("/video", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const output =
		__dirname +
		"/converted/" +
		Date.now() +
		"_converted." +
		req.body.format;

	try {
		var process = new ffmpeg(filepath);
		process.then(
			function (video) {
				// Setting video resolution
				let videoSize;
				if (req.body.width && !req.body.height) {
					videoSize = req.body.width + "x?";
				} else if (req.body.height && !req.body.width) {
					videoSize = "?x" + req.body.height;
				} else if (req.body.width && req.body.height) {
					videoSize = req.body.width + "x" + req.body.height;
				} else {
					videoSize =
						video.metadata.video.resolution.w +
						"x" +
						video.metadata.video.resolution.h;
				}

				let preserveRatio;
				if (req.body.noPreserving) {
					preserveRatio = false;
				} else {
					preserveRatio = true;
				}

				video
					.setVideoFrameRate(
						req.body.framerate || video.metadata.video.fps
					)
					.setVideoSize(videoSize, true, preserveRatio)
					.save(output, function (error, file) {
						if (!error) console.log("File: " + file);
						res.download(file, () => {
							fs.unlink(output, (err) => {
								if (err) throw err;
								console.log("Deleted: " + file);
							});
							fs.unlink(filepath, (err) => {
								if (err) throw err;
								console.log("Deleted: " + filepath);
							});
						});
					});
			},
			function (err) {
				console.log("Error: " + err);
			}
		);
	} catch (e) {
		console.log(e.code);
		console.log(e.msg);
	}
});

// Audio file handling

app.get("/audio", (req, res) => {
	res.render("audio");
});

app.post("/audio", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const output =
		Date.now() +
		"_converted." +
		req.body.format;

	try {
		var process = new ffmpeg(filepath);
		process.then(
			function (audio) {
				audio.save("converted/" + output, function (error, file) {
					if (!error) {
					console.log("File: " + file);
					res.download("converted/" + output, () => {
						fs.unlink("converted/" + output, (err) => {
							if (err) throw err;
							console.log("Deleted: " + file);
						});
						fs.unlink(filepath, (err) => {
							if (err) throw err;
							console.log("Deleted: " + filepath);
						});
					});}
					else{
						res.send(error)
					}

				});
			},
			function (err) {
				console.log("Error: " + err);
			}
		);
	} catch (e) {
		console.log(e.code);
		console.log(e.msg);
	}
});

// Image processing

app.get("/image", (req, res) => {
	res.render("image");
});

app.post("/image", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const outputfile = Date.now() + "_converted." + req.body.format;
	let width, height;

	jimp.read(filepath, async (err, image) => {
		if (req.body.width && !req.body.height){
			width = Number(req.body.width)
			height = jimp.AUTO
		}
		else if (!req.body.width && req.body.height){
			height = jimp.AUTO;
			width = Number(req.body.height)
		}
		else if (req.body.width && req.body.height){
			width = Number(req.body.width)
			height = Number(req.body.height)
		}
		else if (image.getWidth() && image.getHeight() ){
			width =  image.getWidth() 
			height = image.getHeight()
		}
		else{
			res.render("image")
		}

		if (err) {
			res.render("image")
		}

		await image
			.quality(Number(req.body.quality) || 85) // set JPEG quality
			.resize(width, height)
			.writeAsync("converted/" + outputfile); // save
		res.download("converted/" + outputfile, () => {
			// Removing the files
			fs.unlink("converted/" + outputfile, (err) => {
				if (err) throw err;
				console.log("Deleted: " + outputfile);
			});
			fs.unlink(filepath, (err) => {
				if (err) throw err;
				console.log("Deleted: " + filepath);
			});
		});
	});
});

const PORT = process.env.PORT || 60699
app.listen(PORT, () => {
	console.log("Server: http://127.0.0.1:" + PORT);
});
