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
turnServer.run();


app.use(express.static('public'));

app.use(express.static('public'));


app.get('/room/:room', (req, res) => {
  console.log(req.params);
  res.sendFile(path.resolve(__dirname + '/public/webrtc-multi.html'));
});

var options = {
  key: fs.readFileSync('./ssl/privatekey.pem'),
  cert: fs.readFileSync('./ssl/certificate.pem')
};

var port = process.env.PORT || 3000;
var server = https.createServer(options, app).listen(port, function () {
  console.log('Nodejs Https server listening on port', port);
});



var io = require('socket.io')(server);

// When a socket connects, set up the specific listeners we will use.
io.on('connection', function (socket) {
  // When a client tries to join a room, only allow them if they are first or
  // second in the room. Otherwise it is full.
  var _room = null;
  socket.on('join', function (room) {
    console.log('A client joined', room)
    var clients = io.sockets.adapter.rooms[room];
    var length = typeof clients !== 'undefined' ? clients.length : 0;
    socket.join(room);
    _room = room;
    console.log(room, length);

    if (length >= 1) {
      socket.emit('ready', room);
      socket.to(room).emit('ready', room);
      console.log(room, 'is ready');
    }

  });

  // When receiving the token message, use the Twilio REST API to request an
  // token to get ephemeral credentials to use the TURN server.

  socket.on('token', function () {
    var ip = process.env.TURN_IP || 'localhost';
    var port = process.env.TURN_PORT || 3478;
    var token = { "iceServers": [{ "urls": [`turn:${ip}:${port}`], "username": "forsrc", "credential": "forsrc" }], "iceTransportPolicy": "all", "iceCandidatePoolSize": "0" };
    console.log('Received token request', token)
    socket.emit('token', token);

  });

  socket.on('log', function (id, log) {
    console.log(_room, id, log)
  });

  // Relay candidate messages
  socket.on('candidate', function (candidate) {
    console.log(_room, 'Received candidate. Broadcasting...')
    socket.to(_room).emit('candidate', candidate);
    //socket.broadcast.emit('candidate', candidate);
  });

  // Relay offers
  socket.on('offer', function (offer) {
    console.log(_room, 'Received offer. Broadcasting...')
    socket.to(_room).emit('offer', offer);
    //socket.broadcast.emit('offer', offer);
  });

  // Relay answers
  socket.on('answer', function (answer) {
    console.log(_room, 'Received answer. Broadcasting...')
    socket.to(_room).emit('answer', answer);
    //socket.broadcast.emit('answer', answer);
  });

  ///////////////

  socket.on('call', (id) => {
    console.log(_room, 'call', id);
    socket.to(_room).emit("user-joined", socket.id, io.engine.clientsCount, Object.keys(io.sockets.clients().sockets));
    socket.emit("user-joined", socket.id, io.engine.clientsCount, Object.keys(io.sockets.clients().sockets));
  });


  socket.on('signal', (toId, message) => {
    console.log(_room, 'signal', toId);
    socket.to(toId).emit('signal', socket.id, message)
  });

  socket.on("message", function (data) {
    socket.to(_room).emit("broadcast-message", socket.id, data);
    socket.emit('signal', socket.id, message);
  })

  socket.on('disconnect', function () {
    socket.to(_room).emit("user-left", socket.id);
    socket.emit("user-left", socket.id);
  })
});

