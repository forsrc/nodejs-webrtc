var https = require('https');
var fs = require("fs");
var express = require('express');
var app = express();

var path = require('path');

const stun = require('stun');
const { STUN_BINDING_RESPONSE, STUN_EVENT_BINDING_REQUEST } = stun.constants;
const Turn = require('node-turn');


var turnServer = {}
turnServer.run = function () {
  var turnPort = process.env.TURN_PORT || 3478;
  var server = new Turn({
    listeningPort: turnPort,
    //listeningIps: process.env.TURN_IPS ? process.env.TURN_IPS.split(",") : [process.env.TURN_IP || '0.0.0.0'],
    authMech: 'long-term',
    credentials: {
      forsrc: "forsrc"
    }
  });
  server.start();
  console.log('[turn] server started port:', turnPort, server);
  this.handle(server);
};
turnServer.handle = function (server) {
}
//turnServer.run();


app.use(express.static('public'));

app.use(express.static('public'));

app.get('/', (req, res) => {
	console.log(req.params);
	res.sendFile(path.resolve(__dirname + '/public/index.html'));
  });

// app.get('/room/:room', (req, res) => {
//   console.log(req.params);
//   res.sendFile(path.resolve(__dirname + '/public/index.html'));
// });

var options = {
  key: fs.readFileSync('./ssl/privatekey.pem'),
  cert: fs.readFileSync('./ssl/certificate.pem')
};

var port = process.env.PORT || 3000;
var server = https.createServer(options, app).listen(port, function () {
  console.log('Nodejs Https server listening on port', port);
});



var io = require('socket.io')(server);

io.on('connection', function(socket){
	io.sockets.emit("user-joined", socket.id, io.engine.clientsCount, Object.keys(io.sockets.clients().sockets));

	socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message);
  	});

    socket.on("message", function(data){
		io.sockets.emit("broadcast-message", socket.id, data);
    })

	socket.on('disconnect', function() {
		io.sockets.emit("user-left", socket.id);
	})
});

