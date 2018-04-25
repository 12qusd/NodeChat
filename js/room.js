var socket = io.connect('http://localhost:8080');
var username;
var room;

// Message constructor 
// takes in a room, username and message
// room is the UUID
// username is a string
// message is a string
function Message(room, username, message, time) {
	this.room = room;
	this.username = username;
	this.message = message;
	this.time = time;
}

// Checks if enter key is pressed and if so triggers sendMessage()
function CheckKey(event)
{
   var code = event.keyCode ? event.keyCode : event.which;
   if(code === 13)
   {
       sendMessage();
   }
}

// The autoscroll code bundled into a function
function autoscroll() {
	if (!($("#autoscroll").is(":checked"))) {
		$('.scrollable').animate({scrollTop: $('.scrollable').prop("scrollHeight")}, 1);
	}
}

// Given the result of the room's get request, prints out all the messages appropriately
function printAll(data) {
	for (var message of data.rows) {
		if (message.username === "Server Announcement") {
			serverMessage(message);
		}
		else {
			postMessage(message);
		}
	}
}

// sends a message and posts it to server so all users see it
function sendMessage() {
	var message = $("#text").val();
	$("#text").val("");
	username = $("#username").text();
	room = $("#roomid").text();
	var time = Date.now();
	var sending = new Message(room, username, message, time);
	socket.emit('message', sending);
}

// Posts a message from socket
socket.on('clientMessage', function(data) {
	postMessage(data);
});

// Posts user joining
socket.on("usermove", function(data) {
	serverMessage(data);
});

// Posts user to current user list
socket.on('useradd', function(data) {
	postUser(data);
});

// Whenever membership is updated
socket.on('userUpdate', function(data) {
	printUsers(data);
});

// print all the users currently in the room
function printUsers(data) {
	$(".userList").html('');
	for (var user of data.rows) {
		if (user.room === $("#roomid").text()) {
			postUser(user.username);
		}
	}
}
// Displays the message received from the server
function postMessage(result) {
	var messageInsert = "";
	usr = $("#username").text();
	if (result.username === usr) {
		messageInsert += "<span><span class='self'>" + result.username + ": </span>";
	}
	else {
		messageInsert += "<span><span class='username'>" + result.username + ": </span>";
	}
	messageInsert += "<p>" + result.message + "</p><br></span>";
	$(".scrollable").append(messageInsert);
	autoscroll();
}

// Displays a special server message with special formatting
// Message can be anything and could support various users
function serverMessage(result) {
	var messageInsert = "";
	messageInsert += "<span class='server'><span>" + result.username + ": </span>";
	messageInsert += "<p>" + result.message + "</p><br></span>";
	$(".scrollable").append(messageInsert);
	autoscroll();
}

// Posts a user to the user list
function postUser(result) {
	var messageInsert = "";
	usr = $("#username").text();
	if (result === usr) {
		messageInsert += "<span id='"+ result + "'><span class='self'>" + result + "<br></span>";
	}
	else {
		messageInsert += "<span id='"+ result + "'><span class='username'>" + result + "<br></span>";
	}
	$(".userList").prepend(messageInsert);
}

// Prompts the user for a username and posts new user to the server
function selectUsername() {
	var name = null;
	while (name === null || name === "") {
		name = prompt("Please enter a valid username");
	}
	room = $("#roomid").text();
	socket.emit('join', room, name, function(data){
		printAll(data);
	});
	var sending = new Message(room, name, "");
	socket.emit('newuser', sending);
	$("#username").text(name);
}

function changeUsername() {
	var name = null;
	while (name === null || name === "") {
		name = prompt("Please enter a valid username");
	}
	var currentName = $("#username").text();
	var sending = {
		newName: name,
		oldName: currentName
	}
	socket.emit('nameChange', sending);
	$("#username").text(name);
}
