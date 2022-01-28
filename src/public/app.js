const socket = io();

const myFace = document.getElementById("myFace");
const peerFace = document.getElementById("peerFace");
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");
const micButton = document.getElementById("mic");
const videoButton = document.getElementById("video");
const chatButton = document.getElementById("chat");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const messageForm = document.getElementById("msg");
const chatArea = document.getElementById("chatWrapper");
const closeButton = document.querySelector("#close")

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let userName;
let myPeerConnection;
let myDataChannel;

function addMessage(message, isYou) {
  const ul = chatArea.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  if (isYou) li.classList.add("you");
  ul.appendChild(li);
}

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" }
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } }
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  const on = micButton.querySelector(".on");
  const off = micButton.querySelector(".off");
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    on.hidden = false;
    off.hidden = true;
    muted = true;
  } else {
    on.hidden = true;
    off.hidden = false;
    muted = false;
  }
}
function handleCameraClick() {
  const on = videoButton.querySelector(".on");
  const off = videoButton.querySelector(".off");
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!cameraOff) {
    on.hidden = false;
    off.hidden = true;
    cameraOff = true;
  } else {
    on.hidden = true;
    off.hidden = false;
    cameraOff = false;
  }
}

function handleChatClick() {
  chatArea.hidden = !chatArea.hidden;
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

// Welcome Form (join a room)

async function initCall() {
  document.getElementsByTagName("header")[0].hidden = true;
  welcome.hidden = true;
  call.style.display = "flex";
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.getElementsByTagName("input");
  await initCall();
  socket.emit("join_room", input[0].value, input[1].value, async (msg) => {
    window.alert(msg);
  });
  roomName = input[0].value;
  userName = input[1].value;
  input[0].value = "";
  input[1].value = "";
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const input = messageForm.querySelector("input");

  if (myDataChannel) {
    myDataChannel.send(
      JSON.stringify({ name: userName, message: input.value })
    );
  }
  addMessage(`You : ${input.value}`, true);
  input.value = "";
}

// Socket Code

socket.on("welcome", async (nickname) => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => {
    const msgObj = JSON.parse(event.data);
    addMessage(`${msgObj.name} : ${msgObj.message}`);
  });
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer", offer, roomName);
  socket.emit("offer", offer, roomName);

  addMessage(`${nickname} arrived! 😸`);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) => {
      const msgObj = JSON.parse(event.data);
      addMessage(`${msgObj.name} : ${msgObj.message}`);
    });
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");

  peerFace.hidden = false;
  myFace.classList.add("small");
  myPeerConnection.addIceCandidate(ice);
});

socket.on("bye", (nickname) => {
  addMessage(`${nickname} left! 😿`);
  myFace.classList.remove("small");
  peerFace.hidden = true;
});

// RTC Code

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302"
        ]
      }
    ]
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  peerFace.srcObject = data.stream;
}

//좌우반전 
$("#reverse").click(function() {
  if(myFace.style.transform === "")  {
    myFace.style.transform = "scaleX(-1)";
  } else {
    myFace.style.transform = "";
  }
  
});


//줌인
const zoomIn1 = document.querySelector("#zoomIn1");

function handleZoomIn1(){
  if(myFace.style.transform === ""){
  $("#myFace").css("transform", "scale(1)");
  }else{
    $("#myFace").css("transform", "scaleX(-1) scale(1)");
  }
}

zoomIn1.addEventListener("click",handleZoomIn1);


const zoomIn2 = document.querySelector("#zoomIn2");

function handleZoomIn2(){
  if(myFace.style.transform === ""){
    $("#myFace").css("transform", "scale(1.5)");
    }else{
      $("#myFace").css("transform", "scaleX(-1) scale(1.5)");
    }
}


zoomIn2.addEventListener("click",handleZoomIn2);

const zoomIn3 = document.querySelector("#zoomIn3");


function handleZoomIn3(){
  if(myFace.style.transform === ""){
    $("#myFace").css("transform", "scale(2)");
    }else{
      $("#myFace").css("transform", "scaleX(-1) scale(2)");
    }
}

zoomIn3.addEventListener("click",handleZoomIn3);


const zoomIn4 = document.querySelector("#zoomIn4");

function handleZoomIn4(){
  if(myFace.style.transform === ""){
    $("#myFace").css("transform", "scale(2.5)");
    }else{
      $("#myFace").css("transform", "scaleX(-1) scale(2.5)");
    }
}

zoomIn4.addEventListener("click",handleZoomIn4);



//방송 종료
function closeClick() {

 window.history.back();

}


closeButton.addEventListener("click", closeClick);
micButton.addEventListener("click", handleMuteClick);
videoButton.addEventListener("click", handleCameraClick);
chatButton.addEventListener("click", handleChatClick);
camerasSelect.addEventListener("input", handleCameraChange);
welcomeForm.addEventListener("submit", handleWelcomeSubmit);
messageForm.addEventListener("submit", handleMessageSubmit);
