const Peer = window.Peer;
var room;
var peer;
var youJoyned = 0;     // 0: not  joyend yet,  1: you joyend

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');


  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  /////////////////////////////////////////////////////////////////////////
  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  /////////////////////////////////////////////////////////////////////////
  // eslint-disable-next-line require-atomic-updates
  peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  /////////////////////////////////////////////////////////////////////////
  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
      joinTrigger.style = "background:#00F00F";
      youJoyned = 1;
    });
    
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      let cData = new Int16Array(data);
      if (cData.length == 30){
        // Request Command data 
        textPR.innerHTML             = cData[0];
        textRR.innerHTML             = cData[1];
        statusSpo2.innerHTML         = cData[2];
        statusBatteryLavel.innerHTML = cData[3];
        
        console.log("Data number=" + cData[26] + " Status=" + cData[28] + " Checksum=" + cData[29]);

      }else{
        // Waveform data
        let buffer0 = new ArrayBuffer(8);
        let buffer1 = new ArrayBuffer(8);
        let rData = [new Int16Array(buffer0), new Int16Array(buffer1)];   // 2 * 2 16bit integer array
        
        rData[0][0] = cData[0];    // Copy data from 1d array to 2d array
        rData[0][1] = cData[1];
        rData[1][0] = cData[2];
        rData[1][1] = cData[3];
        
        displayWaveforms(rData);    // Draw waveform 
      }
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id=${peerId}]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      messages.textContent += '== You left ===\n';
      joinTrigger.style = "background:''";
      youJoyned = 0;
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    // for preparing to close
    if(youJoyned==1){
       room.close();
    }

    sendTrigger.addEventListener('click', onClickSend);

    /////////////////////////////////////////////////////////////////////////
    //  Request to send waveforms
    /////////////////////////////////////////////////////////////////////////
    function onClickSend() {
      if(sendWaveforms == 1){
        // Stop sending data
        sendWaveforms = 0;
        sendTrigger.innerText = 'Send Waveforms';
        sendTrigger.style = "background:''; width:250px";
      }else{
        // Clear the waveform window and start sending waveforms
        m_workDC.clearRect(0, 0, ox, oy);  // Clear all canvas
        sendWaveforms = 1;
        sendTrigger.innerText = 'Stop sending data';
        sendTrigger.style = "background:#00F00F; width:200px";
        initDisplay = 1;
      }

      // Send sendWaveform request
      let tmpData = "waveform" + String(sendWaveforms).trim() + "_";
      let checksum = 0;

      // Make checksum data and convert it in complement
      for(let n=0; n < 10; n++){
        checksum += tmpData.charCodeAt(n);
      }
      checksum = 65536-checksum;

      // Convert checksum data in hex and fix degit and add it in last
      let tmpStr = checksum.toString(16).padStart(4, '0').substr(-2);
      tmpData = tmpData + tmpStr.substring(0, 2) + tmpStr.substring(1, 1);
      console.log("tmpData= " + tmpData);

      room.send(tmpData);
    }

  });

  peer.on('error', console.error);
})();
