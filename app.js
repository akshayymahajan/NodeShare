var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var crypto = require('crypto');
var config = require('./config');

clients = {};
sockets = {};
users = {};

io.on('connection', function(socket){
	
	// on connection, save client id and set status as online.
	socket.on('online', function(data) {
		if (typeof clients[data.sid.trim()] === 'undefined') {
			console.log('adding new user');
			user = {}
			user.available = true;
			user.socket = socket;
			user.uname = data.uname;

			clients[data.sid.trim()] = user
			
			sockets[socket.id] = data;
			
			users[data.sid.trim()] = data.uname;
			
			socket.broadcast.emit('newUser', data);
			socket.emit('onlineAck', {
				status: true,
				clients: users
			});
		} else {
			console.log('update status');
			clients[data.sid.trim()].available = true;
		}
	});

	// set both the clients availability to false
	socket.on('peerConnect', function(data) {
		var rec = clients[data.to];
		var sender = clients[data.from];
		if (rec.available && sender.available) {
			rec.available = false;
			sender.available = false;
			rec.socket.emit('connectRequest', {uname: users[data.from], sid: data.from});
			rec.socket.on('allow', function(data) {
				socket.emit('accepted', true);
				console.log('connected');
			});
			rec.socket.on('deny', function(data) {
				socket.emit('accepted', false);
				rec.available = true;
				sender.available = true;
				console.log('denied');
			})
		} else {
			console.log('error connecting');
			sender.available = true;
			socket.emit('peerError', {status: 0, msg: 'User busy'});
		}
	});

	socket.on('file', function(stream, data) {
		console.log('file incoming');
		var rec = data.to;
		// upload a file to the server. 
		clients[rec].socket.emit('peerReceive', stream, data);
	});

	socket.on('connection-disconnect', function(data) {
		clients[data.to].available = true;
		clients[data.from].available = true;
		clients[data.to].socket.emit('other-disconnected');
	});

	socket.on('disconnect', function() {
		var user = sockets[socket.id];
		if(user) {
			socket.broadcast.emit('user-disconnect', user.sid);
			delete users[user.sid];
			delete clients[user.sid];
			delete sockets[socket.id];
		}
	})
});

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(express.static('static'));

app.get('/', function(req, res) {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	var id = crypto.createHash('sha1').update(current_date + random).digest('hex');
	res.render(__dirname + '/views/index', {id: id});
});

http.listen(config.PORT, function(){
	console.log('listening on 3000');
});