var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const stun = require('stun');
const { STUN_BINDING_RESPONSE, STUN_EVENT_BINDING_REQUEST } = stun.constants;
const Turn = require('node-turn');


var turnServer = {}
turnServer.run = function() {
    var turnPort = process.env.TURN_PORT || 3478;
    var server = new Turn({
        listeningPort: turnPort,
        listeningIps: process.env.TURN_IPS ? process.env.TURN_IPS.split(",") : [process.env.TURN_IP || '0.0.0.0'],
        authMech: 'long-term',
        credentials: {
            forsrc: "forsrc"
        }
    });
    server.start();
    console.log('[turn] server started port:', turnPort, server);
    this.handle(server);
};
turnServer.handle = function(server) {
}
turnServer.run();

var stunServer = {}

stunServer.run = function() {
    const server = stun.createServer({ type: 'udp4' });
    const port = process.env.STUN_PORT || 19302;
    server.listen(port, "0.0.0.0", () => {
        console.log('[stun] server started port:' + port);
    });

    stunServer.handle(server);
    stun.request('localhost:' + port, (err, res) => {
        if (err) {
            console.error(err);
        } else {
            const { address } = res.getXorAddress();
            console.log('stun ip', address);
      }
    });

};

stunServer.handle = function(server) {
    const userAgent = `node/${process.version} stun/v1.0.0`;
    server.on(STUN_EVENT_BINDING_REQUEST, (request, rinfo) => {
        const message = stun.createMessage(STUN_BINDING_RESPONSE, request.transactionId);
        message.addXorAddress(rinfo.address, rinfo.port);
        message.addSoftware(userAgent);
        server.send(message, rinfo.port, rinfo.address);
    });
}

//stunServer.run();


app.use(express.static('public'));
// When a socket connects, set up the specific listeners we will use.
io.on('connection', function(socket){
  // When a client tries to join a room, only allow them if they are first or
  // second in the room. Otherwise it is full.
  socket.on('join', function(room){
    console.log('A client joined')
    var clients = io.sockets.adapter.rooms[room];
    var numClients = typeof clients !== 'undefined' ? clients.length : 0;
    if(numClients == 0){
      socket.join(room);
    }else if(numClients == 1){
      socket.join(room);
      // When the client is second to join the room, both clients are ready.
      console.log('Broadcasting ready message')
      socket.emit('ready', room);
      socket.broadcast.emit('ready', room);
    }else{
      socket.emit('full', room);
    }
  });

  // When receiving the token message, use the Twilio REST API to request an
  // token to get ephemeral credentials to use the TURN server.
  socket.on('token', function(){
	var ip = process.env.TURN_IP || '0.0.0.0';
	var token = {"iceServers":[{"urls":[`turn:${ip}:3478`],"username":"forsrc","credential":"forsrc"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"};
	console.log('Received token request', token)
    socket.emit('token', token);

  });

  // Relay candidate messages
  socket.on('candidate', function(candidate){
    console.log('Received candidate. Broadcasting...')
    socket.broadcast.emit('candidate', candidate);
  });

  // Relay offers
  socket.on('offer', function(offer){
    console.log('Received offer. Broadcasting...')
    socket.broadcast.emit('offer', offer);
  });

  // Relay answers
  socket.on('answer', function(answer){
    console.log('Received answer. Broadcasting...')
    socket.broadcast.emit('answer', answer);
  });
});

http.listen(3000, function() {
  console.log('listening on *:3000');
});
