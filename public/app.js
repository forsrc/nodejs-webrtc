function logIt(message, error) {
  // Print on console
  console.log(message);

  // Add to logs on page
  let logs = document.getElementById('logs');
  let tmp = document.createElement('P');
  tmp.innerText = message;
  if (error) {
    tmp.classList.add('error');
  }
  logs.appendChild(tmp);
}

var connected = false;
var localICECandidates = [];

// Create an object to save various objects to without polluting the global
// namespace.
var VideoChat = {
  // Initialise our connection to the WebSocket.
  socket: io(),

  // Call to getUserMedia (provided by adapter.js for cross browser compatibility)
  // asking for access to both the video and audio streams. If the request is
  // accepted callback to the onMediaStream function, otherwise callback to the
  // noMediaStream function.
  requestMediaStream: function(event) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then(stream => {
        VideoChat.onMediaStream(stream);
      })
      .catch(error => {
        VideoChat.noMediaStream(error);
      });
  },

  // The onMediaStream function receives the media stream as an argument.
  onMediaStream: function(stream) {
    // Get the video element.
    VideoChat.localVideo = document.getElementById('local-video');
    // Turn the volume down to 0 to avoid echoes.
    VideoChat.localVideo.volume = 0;
    VideoChat.localStream = stream;
    VideoChat.videoButton.setAttribute('disabled', 'disabled');
    // Turn the media stream into a URL that can be used by the video and add it
    // as the video's `src`. As the video has the `autoplay` attribute it will
    // start to stream immediately.
    // The localVideo.src have been deprecated
    // VideoChat.localVideo.src = window.URL.createObjectURL(stream);
    VideoChat.localVideo.srcObject = stream;
    // Now we're ready to join the chat room.
    VideoChat.socket.emit('join', 'test');
    VideoChat.socket.on('ready', VideoChat.readyToCall);
    VideoChat.socket.on('offer', VideoChat.onOffer);
  },

  // There's not much to do in this demo if there is no media stream. So
  // let's just stop.
  noMediaStream: function() {
    logIt('No media stream for us.', error);
    // Sad trombone.
  },

  // When we are ready to call, enable the Call button.
  readyToCall: function(event) {
    VideoChat.callButton.removeAttribute('disabled');
  },

  // Set up a callback to run when we have the ephemeral token to use Twilio's
  // TURN server.
  startCall: function(event) {
    logIt('>>> Sending token request...');
    VideoChat.socket.on('token', VideoChat.onToken(VideoChat.createOffer));
    VideoChat.socket.emit('token');
  },

  // When we receive the ephemeral token back from the server.
  onToken: function(callback) {
    return function(token) {
      logIt('<<< Received token');
      // Set up a new RTCPeerConnection using the token's iceServers.
      VideoChat.peerConnection = new RTCPeerConnection({
        iceServers: token.iceServers
      });
      // Add the local video stream to the peerConnection.
      VideoChat.peerConnection.addStream(VideoChat.localStream);
      // Set up callbacks for the connection generating iceCandidates or
      // receiving the remote media stream.
      VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;
      VideoChat.peerConnection.onaddstream = VideoChat.onAddStream;
      // Set up listeners on the socket for candidates or answers being passed
      // over the socket connection.
      VideoChat.socket.on('candidate', VideoChat.onCandidate);
      VideoChat.socket.on('answer', VideoChat.onAnswer);
      callback();
    };
  },

  // When the peerConnection generates an ice candidate, send it over the socket
  // to the peer.
  onIceCandidate: function(event) {
    if (event.candidate) {
      logIt(`<<< Received local ICE candidate (${event.candidate.address})`);
      if (connected) {
        VideoChat.socket.emit('candidate', JSON.stringify(event.candidate));
      } else {
        localICECandidates.push(event.candidate);
      }
    }
  },

  // When receiving a candidate over the socket, turn it back into a real
  // RTCIceCandidate and add it to the peerConnection.
  onCandidate: function(candidate) {
    rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
    logIt(
      `<<< Received remote ICE candidate (${rtcCandidate.address} - ${rtcCandidate.relatedAddress})`
    );
    VideoChat.peerConnection.addIceCandidate(rtcCandidate);
  },

  // Create an offer that contains the media capabilities of the browser.
  createOffer: function() {
    logIt('>>> Creating offer...');
    VideoChat.peerConnection.createOffer(
      function(offer) {
        // If the offer is created successfully, set it as the local description
        // and send it over the socket connection to initiate the peerConnection
        // on the other side.
        VideoChat.peerConnection.setLocalDescription(offer);
        VideoChat.socket.emit('offer', JSON.stringify(offer));
      },
      function(err) {
        // Handle a failed offer creation.
        logIt(err, true);
      }
    );
  },

  // Create an answer with the media capabilities that both browsers share.
  // This function is called with the offer from the originating browser, which
  // needs to be parsed into an RTCSessionDescription and added as the remote
  // description to the peerConnection object. Then the answer is created in the
  // same manner as the offer and sent over the socket.
  createAnswer: function(offer) {
    return function() {
      logIt('>>> Creating answer...');
      connected = true;
      rtcOffer = new RTCSessionDescription(JSON.parse(offer));
      VideoChat.peerConnection.setRemoteDescription(rtcOffer);
      VideoChat.peerConnection.createAnswer(
        function(answer) {
          console.log(answer);
          VideoChat.peerConnection.setLocalDescription(answer);
          VideoChat.socket.emit('answer', JSON.stringify(answer));
        },
        function(err) {
          // Handle a failed answer creation.
          logIt(err, true);
        }
      );
    };
  },

  // When a browser receives an offer, set up a callback to be run when the
  // ephemeral token is returned from Twilio.
  onOffer: function(offer) {
    logIt('<<< Received offer');
    VideoChat.socket.on(
      'token',
      VideoChat.onToken(VideoChat.createAnswer(offer))
    );
    VideoChat.socket.emit('token');
  },

  // When an answer is received, add it to the peerConnection as the remote
  // description.
  onAnswer: function(answer) {
    logIt('<<< Received answer');
    console.log(answer);
    var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
    VideoChat.peerConnection.setRemoteDescription(rtcAnswer);
    connected = true;
    localICECandidates.forEach(candidate => {
      VideoChat.socket.emit('candidate', JSON.stringify(candidate));
    });
    localICECandidates = [];
  },

  // When the peerConnection receives the actual media stream from the other
  // browser, add it to the other video element on the page.
  onAddStream: function(event) {
    logIt('<<< Received new stream from remote. Adding it...');
    VideoChat.remoteVideo = document.getElementById('remote-video');
    // VideoChat.remoteVideo.src = window.URL.createObjectURL(event.stream);
    VideoChat.remoteVideo.srcObject = event.stream;
  }
};

// Get the video button and add a click listener to start the getUserMedia
// process
VideoChat.videoButton = document.getElementById('get-video');
VideoChat.videoButton.addEventListener(
  'click',
  VideoChat.requestMediaStream,
  false
);

// Get the call button and add a click listener to start the peerConnection
VideoChat.callButton = document.getElementById('call');
VideoChat.callButton.addEventListener('click', VideoChat.startCall, false);
