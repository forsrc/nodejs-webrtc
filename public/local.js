'use strict';

const _peerConnectionConfig = {
	"iceServers" : [ {
		"urls" : [ "stun:stun.l.google.com:19302" ]
	} ],
	"iceTransportPolicy" : "all"
}, constraints = {
	"optional" : [ {
		"googIPv6" : true
	} ]
}

const _localVideo = document.getElementById('localVideo');
const _remoteVideo = document.getElementById('remoteVideo');

const _offerOptions = {
	offerToReceiveAudio : 1,
	offerToReceiveVideo : 1
};

async function call() {

	if (!navigator.mediaDevices.getUserMedia) {
		alert('Your browser does not support getUserMedia API');
		return;
	}
	var stream = await navigator.mediaDevices.getUserMedia({
		video : true,
		audio : false
	});
	
	_localVideo.srcObject = stream;
	
	const videoTracks = stream.getVideoTracks();
	const audioTracks = stream.getAudioTracks();
	if (videoTracks.length > 0) {
		console.log(`Using video device: ${videoTracks[0].label}`);
	}
	if (audioTracks.length > 0) {
		console.log(`Using audio device: ${audioTracks[0].label}`);
	}
	
 
	var pc1 = new RTCPeerConnection(_peerConnectionConfig);
	console.log('Created local peer connection object pc1');
	var pc2 = new RTCPeerConnection(_peerConnectionConfig);
	console.log('Created remote peer connection object pc2');

	// addEventListener icecandidate
	pc1.onicecandidate = async function(event){
		await pc2.addIceCandidate(event.candidate);
	};
		
	pc2.onicecandidate = async function(event){
		await pc1.addIceCandidate(event.candidate);
	};

	// addEventListener oniceconnectionstatechange
	pc1.oniceconnectionstatechange = function(event){
		 console.log(`$'pc1' ICE state: ${pc1.iceConnectionState}`);
		 console.log('ICE state change event: ', event);
	};
		 
	pc2.oniceconnectionstatechange = function(event){
		 console.log(`$'pc2' ICE state: ${pc1.iceConnectionState}`);
		 console.log('ICE state change event: ', event);
	};
		 

		// ontrack
	pc2.ontrack = function(event){
		if (_remoteVideo.srcObject !== event.streams[0]) {
		    _remoteVideo.srcObject = event.streams[0];
		    console.log('pc2 received remote stream');
		  }
	};

	const localStream = _localVideo.srcObject;
	localStream.getTracks().forEach(function(track) {
		pc1.addTrack(track, localStream);
	});

	console.log('Added local stream to pc1');

	var offer =  await pc1.createOffer(_offerOptions);
	
	console.log('Offer from pc1 description.sdp');
	// console.log(`Offer from pc1\n${description.sdp}`);
	await pc1.setLocalDescription(offer);
	await pc2.setRemoteDescription(offer);
	console.log('pc2 setRemoteDescription complete');
	
	var answer = await pc2.createAnswer();
	
	console.log('Answer from pc2 description.sdp');
	 // console.log(`Answer from
		// pc2:\n${description.sdp}`);
	 
	await pc2.setLocalDescription(answer);
	await pc1.setRemoteDescription(answer);

};

call();
