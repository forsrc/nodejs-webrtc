const socket = io();
const room = "test";

socket.on('connect', () => {


  socket.on('ready', function (room) {
    console.log(room, "is ready.");
    socket.emit('log', room, socket.id, "OK");
    const buttonStartRemote = document.getElementById('buttonStartRemote');
    buttonStartRemote.disabled = false;
  });
});




const servers = {
  "iceServers":
    [{ "urls": ["turn:" + window.location.hostname + ":3478"], "username": "forsrc", "credential": "forsrc" }],
  "iceTransportPolicy": "all", "iceCandidatePoolSize": "0"
};

const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

const buttonStartLocal = document.getElementById('buttonStartLocal');
buttonStartLocal.disabled = false;

const buttonStartRemote = document.getElementById('buttonStartRemote');
buttonStartRemote.disabled = true;

var local = null;
var remote = null;

buttonStartLocal.onclick = function () {
  buttonStartLocal.disabled = true;
  var video = document.getElementById("video-local");
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true
    })
    .then(stream => {
      console.log('Received local stream');
      video.srcObject = stream;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
      }
      if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
      }


      socket.emit('join', room);
      //buttonStartRemote.disabled = false;
    })
    .catch(e => console.log('getUserMedia() error:', e));
}


buttonStartRemote.onclick = function () {
  buttonStartRemote.disabled = true;

  var video = document.getElementById("video-local");
  var stream = video.srcObject


  var rtcPeerConnection = new RTCPeerConnection(servers);
  var localICECandidates = [];
  var connected = false;


  rtcPeerConnection.addStream(stream);


  rtcPeerConnection.onicecandidate = function (event) {
    var candidate = event.candidate
    if (connected) {
      socket.emit('candidate', room, JSON.stringify(candidate));
    } else {
      localICECandidates.push(event.candidate);
    }

  }

  rtcPeerConnection.onaddstream = function (event) {
    var remoteVideo = document.getElementById('video-remote');
    remoteVideo.srcObject = event.stream;
    //remoteVideo.volume = 0;
  }


  socket.on('candidate', function (candidate) {
    if (!candidate || candidate === 'null') {
      return;
    }
    console.log("on candidate", candidate);
    var rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
    rtcPeerConnection.addIceCandidate(rtcCandidate);
  });

  socket.on('answer', function (answer) {
    if (!answer || answer === 'null') {
      return;
    }
    console.log("on answer");
    var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
    rtcPeerConnection.setRemoteDescription(rtcAnswer);
    connected = true;
    localICECandidates.forEach(candidate => {
      console.log(`>>> Sending local ICE candidate (${candidate.address})`);
      socket.emit('candidate', room, JSON.stringify(candidate));
    });
    localICECandidates = [];
  });

  socket.on('offer', function (offer) {
    if (!offer || offer === 'null') {
      return;
    }
    connected = true;
    var rtcOffer = new RTCSessionDescription(JSON.parse(offer));
    rtcPeerConnection.setRemoteDescription(rtcOffer);
    rtcPeerConnection.createAnswer(
      function (answer) {
        console.log(answer);
        rtcPeerConnection.setLocalDescription(answer);
        socket.emit('answer', room, JSON.stringify(answer));
      },
      function (err) {
        console.error(err);
      }
    );
  });


  rtcPeerConnection.createOffer(
    function (offer) {
      rtcPeerConnection.setLocalDescription(offer);
      socket.emit('offer', room, JSON.stringify(offer));
    },
    function (err) {
      console.error(err);
    }
  );
}
