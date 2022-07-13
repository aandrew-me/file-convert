let state = false;
let button = document.getElementById("toggle");
let circle = document.getElementById("inside");

const theme = localStorage.getItem("theme");

if (theme == "dark") {
	toggle();
}

function toggle() {
	if (state == false) {
		circle.style.left = "20px";
		button.style.backgroundColor = "rgb(80, 193, 238)";
		state = true;
		localStorage.setItem("theme", "dark");
		document.body.style.backgroundColor = "rgb(30, 30, 30)";
		document.body.style.color = "white";
		document.getElementById("container").style.backgroundColor =
			"rgb(55, 55, 55)";
	} else {
		circle.style.left = "0px";
		state = false;
		localStorage.setItem("theme", "light");
		button.style.backgroundColor = "rgb(147, 174, 185)";
		document.body.style.backgroundColor = "white";
		document.getElementById("container").style.backgroundColor =
			"whitesmoke";
		document.body.style.color = "black";
	}
}

let hidden = true;
function toggleAdvanced() {
  if (hidden) {
	document.getElementById("advanced").style.display = "block";
	hidden = false;
  }
  else {
	document.getElementById("advanced").style.display = "none";
	hidden = true;
  }
}

function notify(title, bodytext){
	bodytext = "Video Processing"
	title = "The video will download after processing has been finished"
	const notification = new Notification(title, {
	   body: bodytext,
	   requireInteraction:false
	})
}