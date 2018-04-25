// Requiring all the libraries
var express = require('express');
var anyDB = require('any-db');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var path = require('path');

// ID generator - use with idgen()
var idgen = require('uuid/v4');

// Allows for catching data from POST requests
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// Declares consolidate as the engine for rendering templates
// Uses hogan to render templates
var engines = require('consolidate');
app.engine('html', engines.hogan);
app.set('views', __dirname + '/templates');
app.set('view engine', 'html');

// Setting static routes
app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/css'));

var conn = anyDB.createConnection('sqlite3://chatroom.db');
conn.query("CREATE TABLE IF NOT EXISTS message (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, username TEXT, message TEXT, time INTEGER)", 
	function(error, data){
		return;
	});

conn.query("CREATE TABLE IF NOT EXISTS rooms (room TEXT)", function (error, data){
	return;
});

conn.query("CREATE TABLE IF NOT EXISTS users (room TEXT, username TEXT)", function (error, data){
	return;
});

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

// Inserts a message into the message table
function insertMessage(newMessage) {
	var sql = "INSERT INTO message (room, username, message, time) VALUES ($1, $2, $3, $4)";
	var arr = [newMessage.room, newMessage.username, newMessage.message, newMessage.time];
	conn.query(sql, arr, function (error, data){
		if (error != null) {
			return error;
		}
		else {
			return data;
		}
	});
}

// Inserts a user into the users table
function insertUser(room, username) {
	var sql = "INSERT INTO users (room, username) VALUES ($1, $2)";
	var arr = [room, username];
	conn.query(sql, arr, function (error, data){
		if (error != null) {
			return error;
		}
		else {
			return data;
		}
	});
}

// removes a user into the users table
function deleteUser(room, username) {
	
}

app.get('/newroom', function(request, response) {
	var sql = "SELECT * FROM rooms";
	conn.query(sql, function(error, data){
		if (error != null) {
			response.send(error);
		}
		else {
			var uuid = idgen().substring(0,6);
			for (var i = 0; i < data.rows.length; i++) {
				if (uuid === data.rows[i].room) {
					uuid = idgen().substring(0,6);
					i = 0;
				}
			}
			response.send(uuid);
		}
	});
});

// Whenever a roomname is requested, returns dynamically
app.get('/:roomName', function (request, response) {
	var sql = "INSERT INTO rooms (room) VALUES ($1)";
	var arr = [request.params.roomName];
	conn.query(sql, arr, function (error, data){
		if (error != null) {
			return error;
		}
		else {
			return data;
		}
	});
	response.render('room.html', {roomName: request.params.roomName});
});

// Default path
app.get('/', function(request,response){
	response.sendFile(path.join(__dirname + '/index.html'));
});

// Process get request to certain room
app.get('/:roomName/data', function (request, response){
	var sql = "SELECT * FROM message WHERE room=$1";
	conn.query(sql, [request.params.roomName], function(error, data){
		if (error != null) {
			response.send(error);
		}
		else {
			response.send(data);
		}
	});
});
io.sockets.on('connection', function(socket) {

	// User joins a room
	socket.on('join', function(roomName, username, callback) {
		socket.join(roomName);
		socket.username = username;
		socket.room = roomName;
		var sql = "SELECT * FROM message WHERE room=$1";
		conn.query(sql, [roomName], function(error, data) {
			if (error != null) {
				console.log(error);	
			}
			else {
				callback(data);
			}
		});
	});

	// Processing and responding to a message from socket
	// Also emits message to all clients
	socket.on('message', function(data) {
		// get the parameters
		var room = data.room;
		var username = data.username;
		var message = data.message;
		var time = data.time;

		// create message object
		var newMessage = new Message(room, username, message, time);

		// SQL queries
		insertMessage(newMessage);
		
		// Return a successful response
		io.in(room).emit('clientMessage', newMessage);
	});

	// When user joins a room
	socket.on('newuser', function(data) {
		var message = "User <span class='username'>" + data.username + "</span> just joined!";
		room = data.room;
		var joinMessage = new Message(room, "Server Announcement", message);
		insertMessage(joinMessage);
		insertUser(room, data.username);

		// Give a response of the joinMessage when user joins
		io.in(room).emit('usermove', joinMessage);
		io.in(room).emit('useradd', socket.username);

		var sql = "SELECT * FROM users WHERE room=$1";
		conn.query(sql, [room], function(error, data) {
			if (error != null) {
				console.log(error);			}
			else {
				io.in(room).emit("userUpdate", data);
			}
		});
	});

	// When user decides to change username
	socket.on('nameChange', function(data) {
		var sql = "DELETE FROM users WHERE room=$1 AND username=$2";
		var room = socket.room;
		var username = data.oldName;
		var newName = data.newName;
		var arr = [room, username];
		// Broadcast that the user left
		var message = "User <span class='username'>" + username + "</span> just changed their name to <span class='username'>" + data.newName + "</span>";
		var changeMessage = new Message(room, "Server Announcement", message);
		insertMessage(changeMessage);
		io.in(room).emit('usermove', changeMessage);

		conn.query(sql, arr, function (error, data){
			if (error != null) {
				console.log(error);
			}
			else {
				// If the query is successful then add new username
				var sql2 = "INSERT INTO users (room, username) VALUES ($1, $2)";
				var arr = [room, newName];
				conn.query(sql2, arr, function (error, data) {
					if (error != null) {
						console.log(error);
					}
					else {
						// if that query is successful then get all the users
						var sql3 = "SELECT * FROM users WHERE room=$1";
						conn.query(sql3, [room], function(error, data) {
							if (error != null) {
								console.log(error);
							}
							else {
								io.in(room).emit("userUpdate", data);
							}
						});
					}
				});
			}
		});
	});

	// When user leaves a room
	socket.on('disconnect', function() {
		var sql = "DELETE FROM users WHERE room=$1 AND username=$2";
		var room = socket.room;
		var username = socket.username;
		var arr = [room, username];
		// Broadcast that the user left
		var message = "User <span class='username'>" + username + "</span> just left!";
		var leaveMessage = new Message(room, "Server Announcement", message);
		insertMessage(leaveMessage);
		io.in(room).emit('usermove', leaveMessage);

		conn.query(sql, arr, function (error, data){
			if (error != null) {
				console.log(error);
			}
			else {
				// If the query is successful then get all the usernames
				var sql2 = "SELECT * FROM users WHERE room=$1";
				conn.query(sql2, [room], function(error, data) {
					if (error != null) {
						console.log(error);
					}
					else {
						io.in(room).emit("userUpdate", data);
					}
				});
			}
		});
	});

	// When an error occurs
	socket.on('error', function() {
		var message = "A websocket error occurred. This is bad";
		room = socket.room;
		var errorMessage = new Message(room, "Server Announcement", message);
		insertMessage(errorMessage);
		io.emit("clientMessage", errorMessage);
	});

});
server.listen(8080);
console.log("Listening on 8080...");