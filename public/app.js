var localVideo;
var socketCount = 0;
var socketId;
var localStream;
var connections = [];

var peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.services.mozilla.com' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};

async function pageReady() {

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  var constraints = {
    video: true,
    audio: false,
  };

  if (!navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support getUserMedia API');
    return;
  }
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;


  socket = io.connect();
  socket.on('signal', gotMessageFromServer);

  socket.on('connect', function () {

    socketId = socket.id;

    socket.on('user-left', function (id) {
      left(id);
    });


    socket.on('user-joined', async function (id, count, clients) {
      clients.forEach(function (socketListId) {
        if (connections[socketListId]) {
          return;
        }
        connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
        //Wait for their ice candidate       
        connections[socketListId].onicecandidate = function (event) {
          if (event.candidate != null) {
            console.log('SENDING ICE');
            socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
          }
        }

        //Wait for their video stream
        connections[socketListId].onaddstream = function (event) {
          gotRemoteStream(event, socketListId)
        }

        //Add the local video stream
        connections[socketListId].addStream(localStream);

      });

      //Create an offer to connect with your local description

      if (count >= 2) {
        var description = await connections[id].createOffer();
        await connections[id].setLocalDescription(description);
        // console.log(connections);
        socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
      }

    });
  });
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}


function left(id) {
  var video = document.querySelector('[data-socket="' + id + '"]');
  if (video) {
    var parentDiv = video.parentElement;
    video.parentElement.parentElement.removeChild(parentDiv);
  }
  if (connections[id]) {
    connections[id].close();
    connections[id] = null;
    delete connections[id];
  }
};


function gotRemoteStream(event, id) {

  var video = document.createElement('video');
  var div = document.createElement('div');

  video.setAttribute('data-socket', id);
  video.srcObject = event.stream;
  video.autoplay = true;
  video.muted = true;
  video.playsinline = true;

  div.appendChild(video);
  document.querySelector('.videos').appendChild(div);
}

async function gotMessageFromServer(fromId, message) {

  //Parse the incoming signal
  var signal = JSON.parse(message)

  //Make sure it's not coming from yourself
  if (fromId == socketId) {
    return;
  }

  if (signal.sdp) {
    await connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
    if (signal.sdp.type == 'offer') {
      var description = await connections[fromId].createAnswer();
      await connections[fromId].setLocalDescription(description);
      socket.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }));
    }
  }
  if (signal.ice) {
    await connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
  }
}