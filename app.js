const ffmpeg = require("ffmpeg-for-static");
const ffmpegStatic = require("ffmpeg-static");
const { exec } = require("node:child_process");
const os = require("os")
const express = require("express");
const app = express();
const multer = require("multer");
const jimp = require("jimp");
const bodyparser = require("body-parser");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
// Libreoffice needs to be installed
const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);
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
const uploads = path.join(os.tmpdir(), "Uploads")
const converted = path.join(os.homedir(), "Converted")

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

// Video file handling

app.get("/video", (req, res) => {
	res.render("video");
});

app.post("/video", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const output =
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
					// .setVideoFrameRate(
					// 	req.body.framerate || video.metadata.video.fps
					// )
					// .setVideoSize(videoSize, true, preserveRatio)
					.save(__dirname + "/converted/" + output, function (error, file) {
						if (!error) {
						console.log("File: " + file);
						res.download(__dirname + "/converted/" + output, () => {
							fs.unlink(__dirname + "/converted/" + output, (err) => {
								if (err) throw err;
								console.log("Deleted: " + file);
							});
							fs.unlink(filepath, (err) => {
								if (err) throw err;
								console.log("Deleted: " + filepath);
							});
						});
						}
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

// Audio file handling

app.get("/audio", (req, res) => {
	res.render("audio");
});

app.post("/audio", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const outputpath = __dirname + "/converted/" + Date.now() + "_converted." + req.body.format;
	const volume = Number(req.body.volume) || 1
	let normalize;
	if (req.body.normalize == "on"){
		normalize = "-filter:a loudnorm "
	}
	else{
		normalize = ""
	}

	const command =
		ffmpegStatic +
		` -i ` +
		filepath +
		` -filter:a "volume=` + volume + `" ` +
		normalize +
        outputpath;

	console.log(command)
	exec(command, (err, output) => {
		// once the command has completed, the callback function is called
		if (err) {
			// log and return if we encounter an error
			console.error("could not execute command: ", err);
			return;
		}
        res.download(outputpath, ()=>{
			fs.unlink(outputpath, (err) => {
				if (err) throw err;
				console.log("Deleted: " + outputpath);
			});
			fs.unlink(filepath, (err) => {
				if (err) throw err;
				console.log("Deleted: " + filepath);
			});
		})
	});
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
			.writeAsync(__dirname + "/converted/" + outputfile); // save
		res.download(__dirname + "/converted/" + outputfile, () => {
			// Removing the files
			fs.unlink(__dirname + "/converted/" + outputfile, (err) => {
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



app.get("/document", (req, res) => {
	res.render("document", {warning:""});
});

// Requires libreoffice to be installed
// Processing of document files

app.post("/document", upload.single("file"), function (req, res) {
	const filepath = req.file.path;
	const outputfile = Date.now() + "_converted." + req.body.format;

	async function main() {
		const inputPath = filepath;
		const outputPath = __dirname + "/converted/" + outputfile
	
		// Read file
		const docxBuf = await fsp.readFile(inputPath);
	
		// Convert it to pdf format with undefined filter (see Libreoffice docs about filter)
		let pdfBuf = await libre.convertAsync(docxBuf, req.body.format, undefined);
		
		// Here in done you have pdf file which you can save or transfer in another stream
		await fsp.writeFile(outputPath, pdfBuf);
		res.download(outputPath, ()=>{
			fs.unlink(outputPath, (err) => {
				if (err) throw err;
				console.log("Deleted: " + outputfile);
			});
			fs.unlink(filepath, (err) => {
				if (err) throw err;
				console.log("Deleted: " + filepath);
			});
		})
	}
	
	main().catch(function (err) {
		console.log(`Error converting file: ${err}`);
		fs.readdirSync(uploads).forEach(f => fs.rmSync(`${uploads}/${f}`))
		res.render("document", {warning:"<script>alert(`Some error has occured. Use correct file.`)</script>"})
	});

});


const PORT = process.env.PORT || 60699
app.listen(PORT, () => {
	console.log("Server: http://127.0.0.1:" + PORT);
});
