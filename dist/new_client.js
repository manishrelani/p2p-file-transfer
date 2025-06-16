import * as intr from './interface.js';
let socket;
const chunkSize = 1024 * 100; // 100 KB 
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const shareSection = document.getElementById('shareSection');
    const shareCode = document.getElementById('shareCode');
    const connectionStatus = document.getElementById('connectionStatus');
    const codeInput = document.getElementById('codeInput');
    const peerInfo = document.getElementById('peerInfo');
    const receiveStatus = document.getElementById('receiveStatus');
    const transferStatus = document.getElementById('transferStatus');
    const transferInfo = document.getElementById('transferInfo');
    const progressFill = document.getElementById('progressFill');
    const debugLog = document.getElementById('debugLog');
    const sendBtn = document.getElementById('sendModeBtn');
    const receiveBtn = document.getElementById('receiveModeBtn');
    console.log('sendBtn:', sendBtn);
    console.log('receiveBtn:', receiveBtn);
    if (sendBtn) {
        sendBtn.addEventListener('click', function () {
            console.log('sendModeBtn clicked');
            setMode('send', this);
        });
    }
    else {
        console.error('sendModeBtn not found');
    }
    if (receiveBtn) {
        receiveBtn.addEventListener('click', function () {
            console.log('receiveModeBtn clicked');
            setMode('receive', this);
        });
    }
    else {
        console.error('receiveModeBtn not found');
    }
    let currentMode = 'send';
    let isInitiator = false;
    let room = null;
    let currentFileList = [];
    let localPeerConnection = null;
    let dataChannel = null;
    let writableStreams = {};
    let fileTransferStatus = {};
    let fileReceiverStatus = {};
    let allFilesTransferState = {
        totalFileSent: 0,
        isInProgress: false,
    };
    let remoteDescriptionSet = false;
    const pendingCandidates = [];
    initializeSocket();
    setupFile();
    function initializeSocket() {
        socket = io();
        socket.on('connect', () => {
            connectionStatus.textContent = 'Connected to server';
            console.log('Connected to server');
        });
        socket.on('disconnect', () => {
            connectionStatus.textContent = 'Disconnected from server';
            console.log('Disconnected from server');
        });
        socket.on('peer-joined', (code) => {
            console.log(`Peer joined room: ${code}`);
            if (room) {
                if (isInitiator) {
                    room.receiver = code;
                }
                else {
                    room.initiator = code;
                }
                updateConnectionStatus('connecting');
            }
        });
        socket.on('start-offer', () => {
            console.log('Starting offer process');
            if (localPeerConnection) {
                createOffer(localPeerConnection);
            }
            else {
                console.error('No local peer connection available to create offer');
            }
        });
        // intiator has created offer now this is for reciver to create answer
        socket.on('offer', (offer) => {
            console.log('Received offer:', offer);
            if (localPeerConnection) {
                createAnswer(localPeerConnection, offer);
            }
        });
        // reciver has created answer now this is for intiator to handle answer
        socket.on('answer', (answer) => {
            console.log('Received answer:', answer);
            handleAnswer(answer);
        });
        socket.on('ice-candidate', async (candidate) => {
            await handleNewICECandidate(candidate);
        });
    }
    function setupFile() {
        fileInput.setAttribute('multiple', 'true');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
    }
    function setMode(mode, element) {
        currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
        console.log(`Switched to ${mode} mode`);
        console.log('element.classList', element.classList);
        document.getElementById('sendSection').classList.toggle('active', mode === 'send');
        document.getElementById('receiveSection').classList.toggle('active', mode === 'receive');
        cleanup();
    }
    function cleanup() {
        if (localPeerConnection) {
            localPeerConnection.close();
            localPeerConnection = null;
        }
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        writableStreams = {};
        fileTransferStatus = {};
        fileReceiverStatus = {};
        allFilesTransferState = { totalFileSent: 0, isInProgress: false };
        currentFileList = [];
        fileInfo.style.display = 'none';
        fileName.textContent = '';
        fileSize.textContent = '';
        shareSection.style.display = 'none';
        shareCode.textContent = '';
        transferStatus.textContent = '';
        progressFill.style.width = '0%';
        progressFill.textContent = '';
    }
    function handleDragOver(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    }
    function handleDragLeave(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    }
    function handleDrop(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processFiles(Array.from(files));
        }
    }
    function handleFileSelect(e) {
        const target = e.target;
        if (target.files && target.files.length > 0) {
            processFiles(Array.from(target.files));
        }
    }
    function processFiles(files) {
        isInitiator = true;
        currentFileList = files.map(file => new intr.FileData(file));
        displaySelectedFiles(currentFileList);
        socket?.emit('create-room', currentFileList.map(file => file.toMetaData()), (roomData) => {
            room = roomData;
            shareCode.textContent = room.code;
            shareSection.style.display = 'block';
            setupPeerConnection(room.code);
        });
    }
    function joinRoom() {
        const code = codeInput.value.trim().toUpperCase();
        if (!code) {
            alert('Please enter a room code');
            return;
        }
        if (room) {
            alert('You are already in a room. Please leave the current room before joining another.');
            return;
        }
        socket.emit('join-room', code, (response) => {
            if (response.isSucess) {
                const data = intr.Room.fromJSON(response.data);
                room = data;
                shareCode.textContent = code;
                shareSection.style.display = 'block';
                isInitiator = false;
                console.log('Type of:', data.files[0].name);
                displaySelectedFiles(data.files);
                setupPeerConnection(code);
            }
            else {
                alert(`Error joining room: ${response.data}`);
            }
        });
    }
    function displaySelectedFiles(files) {
        fileInfo.style.display = 'block';
        fileName.textContent = files.map(file => file.name).join(', ');
        fileSize.textContent = `Total size: ${files.reduce((total, file) => total + file.size, 0)} bytes`;
    }
    async function setupPeerConnection(roomCode) {
        const peerConnection = new RTCPeerConnection(intr.rtcConfig);
        localPeerConnection = peerConnection;
        console.log('Setting up peer connection for room:', roomCode);
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const candidate = {
                    roomCode: roomCode,
                    candidate: event.candidate
                };
                socket.emit('ice-candidate', candidate);
            }
        };
        if (isInitiator) {
            // Create a data channel for file transfer
            const dataChannel = peerConnection.createDataChannel('fileTransfer', { ordered: true });
            console.log('Data channel created:', dataChannel.label);
            setupDataChannel(dataChannel);
        }
        else {
            peerConnection.ondatachannel = (event) => {
                setupDataChannel(event.channel);
            };
        }
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'connected') {
                connectionStatus.textContent = 'Peer connected';
                console.log('Peer connected');
            }
            else if (peerConnection.iceConnectionState === 'disconnected') {
                connectionStatus.textContent = 'Peer disconnected';
                console.log('Peer disconnected');
            }
        };
    }
    function setupDataChannel(channel) {
        dataChannel = channel;
        dataChannel.onopen = () => {
            console.log('Data channel opened');
            transferStatus.textContent = 'Ready to send file';
        };
        dataChannel.onmessage = (event) => {
            if (event.data === '200') {
                console.log('Data channel is ready to receive files');
                transferStatus.textContent = 'Data channel is ready to receive files';
                setupFilesOnReceiverSide();
                console.log('Received message:', event.data);
            }
            else if (event.data === 'ready-to-receive') {
                console.log('Ready to receive files');
                transferStatus.textContent = 'Ready to receive files';
                startFileTransfer();
            }
            else if (typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'file-chunk') {
                        writeToFile(data.data);
                    }
                    else {
                        console.warn('Unknown data type received:', data.type);
                    }
                }
                catch (error) {
                    console.error('Error parsing file chunk:', error);
                }
            }
            else {
                console.warn('Received unexpected data:', event.data);
            }
        };
        dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            transferStatus.textContent = 'Error in data channel';
        };
        dataChannel.onclose = () => {
            console.log('Data channel closed');
            transferStatus.textContent = 'File transfer completed';
        };
    }
    async function writeToFile(chunkData) {
        var _a;
        const writable = writableStreams[chunkData.fileId];
        if (!writable) {
            console.error(`No writable stream found for file ID: ${chunkData.fileId}`);
            return;
        }
        try {
            const fileMetaData = room.files.find(file => file.id === chunkData.fileId);
            if (!fileMetaData) {
                console.error(`File metadata not found for file ID: ${chunkData.fileId}`);
                return;
            }
            const fileStatus = fileReceiverStatus[_a = chunkData.fileId] ?? (fileReceiverStatus[_a] = {
                progress: 0,
                isComplete: false,
                fileMetaData: fileMetaData,
                totalChunksReceived: 0,
                startTime: Date.now()
            });
            await writable.write({
                type: "write",
                position: chunkData.offset,
                data: chunkData.chunk
            });
            fileStatus.totalChunksReceived += chunkData.chunk.byteLength;
            fileStatus.isComplete = fileStatus.totalChunksReceived === fileMetaData.size;
            fileStatus.progress = (fileStatus.totalChunksReceived / fileMetaData.size) * 100;
            progressFill.style.width = `${fileStatus.progress} %`;
            progressFill.textContent = Math.round(fileStatus.progress) + '%';
            transferStatus.textContent = `Receiving file: ${fileMetaData.name} (${Math.round(fileStatus.progress)}%)`;
            console.log(`Received chunk for file ID ${chunkData.fileId}:`, fileStatus);
            if (fileStatus.isComplete) {
                writable.close();
                delete writableStreams[chunkData.fileId];
                transferStatus.textContent = `File received: ${fileMetaData.name}`;
                console.log(`File received: ${fileMetaData.name}`);
            }
        }
        catch (error) {
            console.error(`Error writing chunk to file ID ${chunkData.fileId}:`, error);
        }
    }
    async function createOffer(peerConnection) {
        if (room) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            const offerData = {
                roomCode: room.code,
                sessionDescription: offer
            };
            console.log('Created offer:', offer);
            socket.emit('offer-created', offerData);
        }
    }
    async function createAnswer(peerConnection, offer) {
        try {
            await peerConnection.setRemoteDescription(offer);
            remoteDescriptionSet = true;
            console.log('Set remote description with offer:', offer);
            for (const candidate of pendingCandidates) {
                console.log('Adding pending ICE candidate:', candidate);
                await peerConnection.addIceCandidate(candidate);
            }
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            if (!room) {
                console.error('Room is not defined. Cannot create answer.');
                return;
            }
            const answerData = {
                roomCode: room.code,
                sessionDescription: answer
            };
            console.log('Created answer:', answerData);
            socket.emit('answer-created', answerData);
        }
        catch (error) {
            console.error('Error creating answer:', error);
            updateConnectionStatus('failed');
            transferStatus.textContent = 'Failed to create answer';
        }
    }
    async function handleAnswer(answer) {
        if (localPeerConnection) {
            try {
                await localPeerConnection.setRemoteDescription(answer);
                remoteDescriptionSet = true;
                for (const candidate of pendingCandidates) {
                    await localPeerConnection.addIceCandidate(candidate);
                }
                console.log('Set remote description with answer:', answer);
                updateConnectionStatus('connected');
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (dataChannel && dataChannel.readyState === 'open') {
                    dataChannel.send('200');
                }
                else {
                    console.warn('Data channel is not open yet. Waiting for it to open before sending ready message.');
                    dataChannel?.addEventListener('open', () => {
                        dataChannel.send('200');
                        console.log('Data channel is now open. Sent ready message.');
                    });
                }
            }
            catch (error) {
                console.error('Error setting remote description with answer:', error);
            }
        }
        else {
            console.error('No local peer connection available to set remote description');
        }
    }
    async function handleNewICECandidate(candidate) {
        if (localPeerConnection) {
            try {
                if (remoteDescriptionSet) {
                    console.log('Setting remote ICE candidate:', candidate);
                    await localPeerConnection.addIceCandidate(candidate);
                }
                else {
                    pendingCandidates.push(candidate);
                    console.log('ICE candidate added to pending list:', candidate);
                }
            }
            catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
        else {
            console.error('No local peer connection available to add ICE candidate');
        }
    }
    async function setupFilesOnReceiverSide() {
        if (room) {
            if ('showDirectoryPicker' in window) {
                try {
                    for (const fileMeta of room.files) {
                        const file = await window.showSaveFilePicker({ suggestedName: fileMeta.name });
                        // const fileHandle = await file. (fileMeta.name, { create: true });
                        const writable = await file.createWritable();
                        writableStreams[fileMeta.id] = writable;
                    }
                    if (dataChannel) {
                        dataChannel.send('ready-to-receive');
                    }
                }
                catch (err) {
                    alert('Error accessing the directory: ' + err.message);
                }
                alert('Directory picker is not supported in this browser. Please use a Cromium-based browser like Chrome or Edge to select a directory.');
            }
            else {
                console.error('Directory picker is not supported in this browser. Please use a Chromium-based browser like Chrome or Edge.');
                alert('Directory picker is not supported in this browser. Please use a Chromium-based browser like Chrome or Edge to select a directory.');
            }
        }
        else {
            console.error('Room is not defined. Cannot set up files on receiver side.');
            return;
        }
    }
    async function startFileTransfer() {
        if (!room || !dataChannel) {
            console.error('Room or data channel is not available. Cannot start file transfer.');
            return;
        }
        if (allFilesTransferState.isInProgress) {
            console.warn('File transfer is already in progress. Please wait until it completes.');
            return;
        }
        allFilesTransferState.isInProgress = true;
        console.log('Starting file transfer for room:', room.code);
        for (const fileData of currentFileList) {
            await sendFile(fileData);
        }
        if (allFilesTransferState.totalFileSent === room.files.length) {
            allFilesTransferState.isInProgress = false;
        }
    }
    async function sendFile(fileData) {
        var _a;
        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.error('Data channel is not open. Cannot send file.');
            return;
        }
        try {
            transferStatus.textContent = `Sending file: ${fileData.name}`;
            console.log(`Sending file: ${fileData.name}`);
            const fileStatus = fileTransferStatus[_a = fileData.id] ?? (fileTransferStatus[_a] = {
                progress: 0,
                isComplete: false,
                fileMetaData: fileData.toMetaData(),
                offset: 0,
                startTime: Date.now()
            });
            while (fileStatus.offset < fileData.size) {
                const chunk = fileData.file.slice(fileStatus.offset, fileStatus.offset + chunkSize);
                const arrayBuffer = await chunk.arrayBuffer();
                const data = { "fileId": fileData.id, "chunk": arrayBuffer, "offset": fileStatus.offset };
                const progress = ((fileStatus.offset / fileData.size) / room.files.length) * 100;
                fileStatus.progress = progress;
                progressFill.style.width = `${progress} %`;
                progressFill.textContent = Math.round(progress) + '%';
                dataChannel.send(JSON.stringify({ 'type': 'file-chunk', 'data': data }));
                fileStatus.offset += chunkSize;
            }
            fileStatus.isComplete = true;
            allFilesTransferState.totalFileSent += 1;
            progressFill.style.width = `${(allFilesTransferState.totalFileSent / room.files.length) * 100} %`;
            progressFill.textContent = Math.round((allFilesTransferState.totalFileSent / room.files.length) * 100) + '%';
            transferStatus.textContent = `File sent: ${fileData.name}`;
            console.log(`File sent: ${fileData.name} `);
        }
        catch (error) {
            console.error('Error sending file:', error);
            transferStatus.textContent = `Error sending file: ${fileData.name} `;
        }
    }
    function updateConnectionStatus(state) {
        const statusElement = currentMode === 'send' ? connectionStatus : receiveStatus;
        switch (state) {
            case 'connected':
                statusElement.className = 'connection-status status-connected';
                statusElement.innerHTML = '<span>✅</span> Connected!';
                break;
            case 'connecting':
                statusElement.className = 'connection-status status-connecting';
                statusElement.innerHTML = '<span>🔄</span> Connecting...';
                break;
            case 'failed':
            case 'disconnected':
                statusElement.className = 'connection-status status-disconnected';
                statusElement.innerHTML = '<span>❌</span> Connection failed';
                break;
        }
    }
    function copyCode() {
        if (!shareCode.textContent)
            return;
        navigator.clipboard.writeText(shareCode.textContent).then(() => {
            alert('Code copied to clipboard!');
        });
        // .catch(() => {
        //     // Fallback for older browsers
        //     const textArea = document.createElement('textarea');
        //     textArea.value = shareCode.textContent || '';
        //     document.body.appendChild(textArea);
        //     textArea.select();
        //     document.execCommand('copy');
        //     document.body.removeChild(textArea);
        //     alert('Code copied to clipboard!');
        // });
    }
    window.setMode = setMode;
    window.joinRoom = joinRoom;
    window.copyCode = copyCode;
});
