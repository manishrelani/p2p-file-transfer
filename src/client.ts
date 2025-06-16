// // WebRTC and Socket.IO types
// interface FileInfo {
//     id: string;
//     name: string;
//     size: number;
//     type?: string;
//     mimeType?: string;
//     totalChunks?: number;
//     selected?: boolean;
// }

// interface Room {
//     initiator: string;
//     receiver: string | null;
//     fileInfo: FileInfo[] | null;
// }

// interface SignalData {
//     type: string;
//     payload: any;
//     room?: string;
//     sender?: string;
// }

// interface JoinRoomResponse {
//     success: boolean;
//     fileInfo?: FileInfo[] | null;
//     error?: string;
// }

// interface ControlMessage {
//     type: string;
//     fileId?: string;
//     name?: string;
//     size?: number;
//     mimeType?: string;
//     totalChunks?: number;
//     fileIndex?: number;
//     totalFiles?: number;
// }

// interface TransferState {
//     fileInfo: ControlMessage | null;
//     chunks: ArrayBuffer[];
//     receivedSize: number;
//     inProgress: boolean;
//     currentFileIndex: number;
//     selectedFiles: string[];
//     totalFilesSelected: number;
//     completedFiles: number;
// }



// // Global variables
// let localPeerConnection: RTCPeerConnection | null = null;
// let dataChannel: RTCDataChannel | null = null;
// let currentFiles: File[] = [];
// let currentMode: string = 'send'; // Default mode is 'send'
// let roomCode: string | null = null;
// let isInitiator: boolean = false;
// let transferStartTime: number | null = null;
// let socket: SocketIOClient.Socket | null = null;
// let writableStream: FileSystemWritableFileStream | null = null;
// let connectionRetryCount = 0;
// const maxRetries = 5;
// let receivedChunks: ArrayBuffer[] = [];
// let expectedFileInfo: any = null;
// let availableFiles: FileInfo[] = [];

// const transferState: TransferState = {
//     fileInfo: null,
//     chunks: [],
//     receivedSize: 0,
//     inProgress: false,
//     currentFileIndex: 0,
//     selectedFiles: [],
//     totalFilesSelected: 0,
//     completedFiles: 0
// };

// // Initialize once DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//     // UI Elements
//     const uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
//     const fileInput = document.getElementById('fileInput') as HTMLInputElement;
//     const fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
//     const fileName = document.getElementById('fileName') as HTMLDivElement;
//     const fileSize = document.getElementById('fileSize') as HTMLDivElement;
//     const shareSection = document.getElementById('shareSection') as HTMLDivElement;
//     const shareCode = document.getElementById('shareCode') as HTMLDivElement;
//     const connectionStatus = document.getElementById('connectionStatus') as HTMLDivElement;
//     const codeInput = document.getElementById('codeInput') as HTMLInputElement;
//     const peerInfo = document.getElementById('peerInfo') as HTMLDivElement;
//     const receiveStatus = document.getElementById('receiveStatus') as HTMLDivElement;
//     const transferStatus = document.getElementById('transferStatus') as HTMLDivElement;
//     const transferInfo = document.getElementById('transferInfo') as HTMLDivElement;
//     const progressFill = document.getElementById('progressFill') as HTMLDivElement;
//     const debugLog = document.getElementById('debugLog') as HTMLDivElement;

//     // WebRTC Configuration
//     const rtcConfig: RTCConfiguration = {
//         iceServers: [
//             { urls: 'stun:stun.l.google.com:19302' },
//             { urls: 'stun:stun1.l.google.com:19302' }
//         ]
//     };

//     // Initialize Socket.IO connection
//     function initializeSocket() {
//         // Connect to current host
//         socket = io();

//         socket.on('connect', () => {
//             log('Connected to signaling server', 'success');
//         });

//         socket.on('disconnect', () => {
//             log('Disconnected from signaling server', 'warning');
//         });

//         socket.on('signal', async (data: SignalData) => {
//             log(`Received signal: ${data.type}`, 'info');
//             await handleSignal(data);
//         });

//         socket.on('peer-joined', () => {
//             log('Peer joined the room', 'success');
//             updateConnectionStatus('connecting');
//         });

//         socket.on('start-offer', async () => {
//             log('Starting offer process...', 'info');
//             if (isInitiator && localPeerConnection) {
//                 await createOffer();
//             }
//         });

//         socket.on('peer-disconnected', () => {
//             log('Peer disconnected', 'warning');
//             updateConnectionStatus('disconnected');
//         });
//     }

//     // Initialize
//     initializeSocket();
//     setupFileUpload();

//     function setMode(mode: 'send' | 'receive', element: HTMLButtonElement) {
//         currentMode = mode;
//         document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
//         element.classList.add('active');
//         console.log(`Switched to ${mode} mode`);
//         console.log('element.classList', element.classList);



//         document.getElementById('sendSection')!.classList.toggle('active', mode === 'send');
//         document.getElementById('receiveSection')!.classList.toggle('active', mode === 'receive');

//         cleanup();
//     }

//     function setupFileUpload() {
//         // Enable multiple file selection
//         fileInput.setAttribute('multiple', 'true');

//         uploadArea.addEventListener('click', () => fileInput.click());
//         uploadArea.addEventListener('dragover', handleDragOver);
//         uploadArea.addEventListener('dragleave', handleDragLeave);
//         uploadArea.addEventListener('drop', handleDrop);
//         fileInput.addEventListener('change', handleFileSelect);
//     }

//     function handleDragOver(e: DragEvent) {
//         e.preventDefault();
//         uploadArea.classList.add('dragover');
//     }

//     function handleDragLeave(e: DragEvent) {
//         e.preventDefault();
//         uploadArea.classList.remove('dragover');
//     }

//     function handleDrop(e: DragEvent) {
//         e.preventDefault();
//         uploadArea.classList.remove('dragover');
//         const files = e.dataTransfer?.files;
//         if (files && files.length > 0) {
//             processFiles(Array.from(files));
//         }
//     }

//     function handleFileSelect(e: Event) {
//         const target = e.target as HTMLInputElement;
//         if (target.files && target.files.length > 0) {
//             processFiles(Array.from(target.files));
//         }
//     }

//     function processFiles(files: File[]) {
//         currentFiles = files;
//         displaySelectedFiles(files);

//         isInitiator = true;

//         // Create room if not already created
//         if (!roomCode) {
//             // Create room via Socket.IO
//             socket?.emit('create-room', (code: string) => {
//                 roomCode = code;
//                 shareCode.textContent = roomCode;
//                 shareSection.style.display = 'block';

//                 updateFilesOnServer(files);
//                 setupPeerConnection();
//                 log('Room created: ' + roomCode, 'success');
//             });
//         } else {
//             // Just update file info if room already exists
//             updateFilesOnServer(files);
//         }

//         log(`${files.length} files selected`, 'info');
//     }

//     function updateFilesOnServer(files: File[]) {
//         // Generate file info for each file
//         const filesInfo = files.map((file, index) => ({
//             id: generateFileId(file, index),
//             name: file.name,
//             size: file.size,
//             type: file.type,
//             mimeType: file.type
//         }));

//         // Set file info on server
//         socket?.emit('set-file-info', {
//             roomCode: roomCode,
//             fileInfo: filesInfo
//         });
//     }

//     function displaySelectedFiles(files: File[]) {
//         const totalSize = files.reduce((sum, file) => sum + file.size, 0);

//         fileName.innerHTML = `
//             <div class="file-list">
//                 <h4>${files.length} files selected:</h4>
//                 <ul>
//                     ${files.map((file, index) => `
//                         <li class="file-item">
//                             <span class="file-name">${file.name}</span>
//                             <span class="file-size">(${formatFileSize(file.size)})</span>
//                         </li>
//                     `).join('')}
//                 </ul>
//             </div>
//         `;
//         fileSize.textContent = `Total: ${formatFileSize(totalSize)}`;
//         fileInfo.style.display = 'block';
//     }

//     function generateFileId(file: File, index: number): string {
//         return `${Date.now()}_${index}_${file.name}`.replace(/[^a-zA-Z0-9]/g, '_');
//     }

//     // Initialize
//     // initializeSocket();
//     // setupFileUpload();

//     function connectToPeer() {
//         const code = codeInput.value.trim().toUpperCase();
//         if (!code) {
//             alert('Please enter a share code');
//             return;
//         }

//         roomCode = code;
//         isInitiator = false;

//         receiveStatus.className = 'connection-status status-connecting';
//         receiveStatus.innerHTML = '<span>🔄</span> Connecting...';

//         // Setup peer connection first
//         setupPeerConnection();

//         // Join room via Socket.IO
//         socket?.emit('join-room', roomCode, (response: JoinRoomResponse) => {
//             if (response.success) {
//                 log('Joined room: ' + code, 'success');

//                 // Show file list if available
//                 if (response.fileInfo && Array.isArray(response.fileInfo)) {
//                     showAvailableFiles(response.fileInfo);
//                     availableFiles = response.fileInfo;
//                 } else if (response.fileInfo) {
//                     // Handle single file for backward compatibility
//                     const singleFile = response.fileInfo as unknown as FileInfo;
//                     showAvailableFiles([{
//                         id: singleFile.name,
//                         name: singleFile.name,
//                         size: singleFile.size,
//                         type: singleFile.type,
//                         mimeType: singleFile.mimeType
//                     }]);
//                 }
//             } else {
//                 log('Failed to join room: ' + response.error, 'error');
//                 receiveStatus.className = 'connection-status status-disconnected';
//                 receiveStatus.innerHTML = '<span>❌</span> ' + response.error;
//             }
//         });
//     }

//     function showAvailableFiles(files: FileInfo[]) {
//         availableFiles = files;
//         peerInfo.style.display = 'block';

//         const totalSize = files.reduce((sum, file) => sum + file.size, 0);

//         peerInfo.innerHTML = `
//             <h4>📁 Available Files (${files.length})</h4>
//             <p><strong>Total Size:</strong> ${formatFileSize(totalSize)}</p>
//             <div class="file-selection">
//                 <div class="file-selection-header">
//                     <label>
//                         <input type="checkbox" id="selectAll" onclick="toggleSelectAll()"> 
//                         Select All
//                     </label>
//                 </div>
//                 <div class="file-list">
//                     ${files.map(file => `
//                         <div class="file-item">
//                             <label>
//                                 <input type="checkbox" class="file-checkbox" value="${file.id}" onclick="updateFileSelection()">
//                                 <span class="file-name">${file.name}</span>
//                                 <span class="file-size">(${formatFileSize(file.size)})</span>
//                             </label>
//                         </div>
//                     `).join('')}
//                 </div>
//                 <button id="downloadBtn" onclick="downloadSelectedFiles()" class="download-btn" disabled>
//                     Download Selected Files
//                 </button>
//             </div>
//         `;
//     }

//     function toggleSelectAll() {
//         const selectAllCheckbox = document.getElementById('selectAll') as HTMLInputElement;
//         const fileCheckboxes = document.querySelectorAll('.file-checkbox') as NodeListOf<HTMLInputElement>;

//         fileCheckboxes.forEach(checkbox => {
//             checkbox.checked = selectAllCheckbox.checked;
//         });

//         updateFileSelection();
//     }

//     function updateFileSelection() {
//         const fileCheckboxes = document.querySelectorAll('.file-checkbox:checked') as NodeListOf<HTMLInputElement>;
//         const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
//         const selectAllCheckbox = document.getElementById('selectAll') as HTMLInputElement;

//         transferState.selectedFiles = Array.from(fileCheckboxes).map(cb => cb.value);
//         downloadBtn.disabled = transferState.selectedFiles.length === 0;

//         // Update select all checkbox state
//         const allCheckboxes = document.querySelectorAll('.file-checkbox') as NodeListOf<HTMLInputElement>;
//         selectAllCheckbox.checked = transferState.selectedFiles.length === allCheckboxes.length;
//         selectAllCheckbox.indeterminate = transferState.selectedFiles.length > 0 && transferState.selectedFiles.length < allCheckboxes.length;

//         log(`${transferState.selectedFiles.length} files selected`, 'info');
//     }

//     function downloadSelectedFiles() {
//         if (transferState.selectedFiles.length === 0) {
//             alert('Please select files to download');
//             return;
//         }

//         // Reset transfer state
//         transferState.completedFiles = 0;
//         transferState.totalFilesSelected = transferState.selectedFiles.length;
//         transferState.currentFileIndex = 0;
//         transferState.inProgress = true;  // Mark transfer as in progress

//         transferStatus.style.display = 'block';
//         transferInfo.textContent = `Preparing to download ${transferState.selectedFiles.length} files...`;
//         progressFill.style.width = '0%';
//         progressFill.textContent = '0%';

//         log(`Requesting download of ${transferState.selectedFiles.length} selected files`, 'info');

//         // Send request to start download
//         if (dataChannel && dataChannel.readyState === 'open') {
//             dataChannel.send(JSON.stringify({
//                 type: 'download-request',
//                 selectedFiles: transferState.selectedFiles
//             }));
//         } else {
//             log('Data channel not ready, cannot send download request', 'error');
//             alert('Connection not established. Please try reconnecting.');
//         }
//     }

//     function showFileInfo(fileInfo: FileInfo) {
//         peerInfo.style.display = 'block';
//         peerInfo.innerHTML = `
//             <h4>📄 Incoming File</h4>
//             <p><strong>Name:</strong> ${fileInfo.name}</p>
//             <p><strong>Size:</strong> ${formatFileSize(fileInfo.size)}</p>
//             <p><strong>Type:</strong> ${fileInfo.mimeType || 'Unknown'}</p>
//         `;
//     }

//     function setupPeerConnection() {
//         log('Setting up peer connection...');
//         localPeerConnection = new RTCPeerConnection(rtcConfig);

//         localPeerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
//             if (event.candidate) {
//                 log('Sending ICE candidate');
//                 socket?.emit('signal', {
//                     type: 'ice-candidate',
//                     payload: event.candidate,
//                     room: roomCode
//                 });
//             }
//         };

//         localPeerConnection.onconnectionstatechange = () => {
//             const state = localPeerConnection?.connectionState;
//             log('Connection state: ' + state);
//             if (state) {
//                 updateConnectionStatus(state);
//             }
//         };

//         if (isInitiator) {
//             dataChannel = localPeerConnection.createDataChannel('fileTransfer', {
//                 ordered: true
//             });
//             setupDataChannel(dataChannel);
//             log('Data channel created (initiator)');
//         } else {
//             localPeerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
//                 dataChannel = event.channel;
//                 setupDataChannel(dataChannel);
//                 log('Data channel received (receiver)');
//             };
//         }
//     }

//     function setupDataChannel(channel: RTCDataChannel) {
//         channel.onopen = () => {
//             log('Data channel opened', 'success');
//             updateConnectionStatus('connected');
//         };

//         channel.onmessage = (event: MessageEvent) => {
//             if (event.data === 'send-file') {
//                 // Initiator is ready to send file
//                 log('Initiator ready to send file', 'info');
//                 if (isInitiator && transferState.selectedFiles.length > 0) {
//                     startFileTransfer();
//                 }
//             }
//             else if (typeof event.data === 'string') {
//                 try {
//                     const message = JSON.parse(event.data);
//                     handleControlMessage(message);
//                 } catch (error) {
//                     log(`Error parsing control message: ${(error as Error).message}`, 'error');
//                 }
//             }
//             else if (event.data instanceof ArrayBuffer) {
//                 // Binary file data
//                 handleFileData(event.data);
//             }
//         };

//         channel.onerror = (error: Event) => {
//             log('Data channel error: ' + error, 'error');
//         };

//         channel.onclose = () => {
//             log('Data channel closed', 'warning');
//             updateConnectionStatus('disconnected');
//         };
//     }

//     async function handleSignal(signal: SignalData) {
//         try {
//             switch (signal.type) {
//                 case 'offer':
//                     if (!isInitiator && localPeerConnection) {
//                         await localPeerConnection.setRemoteDescription(signal.payload.offer);
//                         const answer = await localPeerConnection.createAnswer();
//                         await localPeerConnection.setLocalDescription(answer);

//                         socket?.emit('signal', {
//                             type: 'answer',
//                             payload: answer,
//                             room: roomCode
//                         });

//                         // Handle file info properly for multiple files
//                         if (signal.payload.fileInfo) {
//                             if (Array.isArray(signal.payload.fileInfo)) {
//                                 // Multiple files
//                                 showAvailableFiles(signal.payload.fileInfo);
//                                 availableFiles = signal.payload.fileInfo;
//                             } else {
//                                 // Single file for backward compatibility
//                                 showFileInfo(signal.payload.fileInfo);
//                             }
//                         }

//                         log('Answer sent', 'success');
//                     }
//                     break;

//                 case 'answer':
//                     if (isInitiator && localPeerConnection) {
//                         await localPeerConnection.setRemoteDescription(signal.payload);
//                         log('Answer received', 'success');
//                     }
//                     break;

//                 case 'ice-candidate':
//                     if (localPeerConnection) {
//                         await localPeerConnection.addIceCandidate(signal.payload);
//                         log('ICE candidate added');
//                     }
//                     break;
//             }
//         } catch (error) {
//             log(`Error handling signal: ${(error as Error).message}`, 'error');
//         }
//     }

//     async function createOffer() {
//         try {
//             if (!localPeerConnection) return;

//             log('Creating offer...', 'info');
//             const offer = await localPeerConnection.createOffer();
//             await localPeerConnection.setLocalDescription(offer);

//             const payload: { offer: RTCSessionDescriptionInit; fileInfo?: any } = {
//                 offer: offer
//             };

//             // Include file info if available
//             if (currentFiles.length > 0) {
//                 // Send array of file info objects
//                 payload.fileInfo = currentFiles.map((file, index) => ({
//                     id: generateFileId(file, index),
//                     name: file.name,
//                     size: file.size,
//                     mimeType: file.type
//                 }));
//             }

//             socket?.emit('signal', {
//                 type: 'offer',
//                 payload: payload,
//                 room: roomCode
//             });
//             log('Offer sent', 'success');
//         } catch (error) {
//             log(`Error creating offer: ${(error as Error).message}`, 'error');
//         }
//     }

//     function startFileTransfer() {
//         // For multiple files, we need to handle the selected files first
//         if (isInitiator && transferState.selectedFiles && transferState.selectedFiles.length > 0) {
//             // Start sending the selected files
//             startMultiFileTransfer(transferState.selectedFiles);
//             return;
//         }

//         // If no specific files are selected, send all files
//         if (isInitiator && currentFiles.length > 0) {
//             const allFileIds = currentFiles.map((_, index) => generateFileId(currentFiles[index], index));
//             startMultiFileTransfer(allFileIds);
//             return;
//         }

//         // Legacy compatibility - this can be removed once fully migrated to multi-file
//         log('No files selected for transfer', 'warning');
//     }

//     function startMultiFileTransfer(fileIds: string[]) {
//         if (!dataChannel) {
//             log('Cannot start transfer: missing data channel', 'error');
//             return;
//         }

//         if (dataChannel.readyState !== 'open') {
//             log('Data channel not ready, retrying in 1 second...', 'warning');
//             setTimeout(() => startMultiFileTransfer(fileIds), 1000);
//             return;
//         }

//         transferStartTime = Date.now();
//         transferStatus.style.display = 'block';

//         // Store selected files IDs to transfer
//         transferState.selectedFiles = fileIds;
//         transferState.totalFilesSelected = fileIds.length;
//         transferState.completedFiles = 0;
//         transferState.currentFileIndex = 0;

//         log(`Starting transfer of ${fileIds.length} files`, 'info');

//         // First send list of files to be transferred
//         const filesToSend = currentFiles.filter((file, index) =>
//             fileIds.includes(generateFileId(file, index))
//         ).map((file, index) => ({
//             id: generateFileId(file, index),
//             name: file.name,
//             size: file.size,
//             mimeType: file.type
//         }));

//         dataChannel.send(JSON.stringify({
//             type: 'transfer-start',
//             totalFiles: filesToSend.length,
//             files: filesToSend
//         }));

//         // Start with first file
//         transferNextFile();
//     }

//     function transferNextFile() {
//         if (transferState.completedFiles >= transferState.totalFilesSelected) {
//             // All files completed
//             dataChannel?.send(JSON.stringify({ type: 'all-transfers-complete' }));

//             if (transferStartTime) {
//                 const duration = (Date.now() - transferStartTime) / 1000;
//                 log(`All transfers completed in ${duration.toFixed(2)} seconds`, 'success');
//             }

//             transferInfo.textContent = `✅ All files sent successfully`;
//             return;
//         }

//         // Find the next file to transfer
//         const fileIndex = transferState.currentFileIndex;
//         const fileId = transferState.selectedFiles[fileIndex];

//         const fileToSend = findFileById(fileId);
//         if (!fileToSend) {
//             log(`File with ID ${fileId} not found, skipping`, 'error');
//             transferState.currentFileIndex++;
//             transferState.completedFiles++;
//             setTimeout(transferNextFile, 100);
//             return;
//         }

//         startSingleFileTransfer(fileToSend);
//     }

//     function findFileById(fileId: string): File | null {
//         for (let i = 0; i < currentFiles.length; i++) {
//             if (generateFileId(currentFiles[i], i) === fileId) {
//                 return currentFiles[i];
//             }
//         }
//         return null;
//     }

//     function startSingleFileTransfer(file: File) {
//         if (!file || !dataChannel) {
//             log('Cannot start transfer: missing file or data channel', 'error');
//             return;
//         }

//         const fileIndex = transferState.currentFileIndex;
//         const totalFiles = transferState.totalFilesSelected;

//         transferInfo.textContent = `Sending: ${file.name} (${fileIndex + 1}/${totalFiles})`;

//         const chunkSize = 16384; // 16KB chunks
//         const totalChunks = Math.ceil(file.size / chunkSize);
//         let currentChunk = 0;

//         const fileId = generateFileId(file, fileIndex);

//         // Send file info first
//         const fileInfoMessage = {
//             type: 'file-info',
//             fileId: fileId,
//             name: file.name,
//             size: file.size,
//             mimeType: file.type,
//             totalChunks: totalChunks,
//             fileIndex: fileIndex,
//             totalFiles: totalFiles
//         };

//         dataChannel.send(JSON.stringify(fileInfoMessage));
//         log(`Starting transfer of file: ${file.name} (${formatFileSize(file.size)})`, 'info');

//         // Start sending chunks after a small delay
//         setTimeout(() => {
//             sendNextChunk();
//         }, 100);

//         function sendNextChunk() {
//             if (!dataChannel) return;

//             if (currentChunk >= totalChunks) {
//                 // Transfer complete
//                 dataChannel.send(JSON.stringify({
//                     type: 'file-complete',
//                     fileId: fileId,
//                     name: file.name,
//                     fileIndex: fileIndex
//                 }));

//                 // Update progress
//                 transferState.currentFileIndex++;
//                 transferState.completedFiles++;

//                 // Calculate overall progress
//                 const overallProgress = (transferState.completedFiles / transferState.totalFilesSelected) * 100;
//                 progressFill.style.width = overallProgress + '%';
//                 progressFill.textContent = Math.round(overallProgress) + '%';

//                 // Continue with next file
//                 setTimeout(transferNextFile, 500);
//                 return;
//             }

//             const start = currentChunk * chunkSize;
//             const end = Math.min(start + chunkSize, file.size);
//             const chunk = file.slice(start, end);

//             const reader = new FileReader();
//             reader.onload = () => {

//                 try {
//                     if (reader.result && dataChannel) {
//                         dataChannel.send(reader.result as ArrayBuffer);
//                         currentChunk++;

//                         // Calculate file progress
//                         const fileProgress = (currentChunk / totalChunks);
//                         // Calculate overall progress
//                         const overallProgress = ((transferState.completedFiles + fileProgress) / transferState.totalFilesSelected) * 100;

//                         progressFill.style.width = overallProgress + '%';
//                         progressFill.textContent = Math.round(overallProgress) + '%';

//                         // Continue sending
//                         setTimeout(sendNextChunk, 0);
//                     }
//                 } catch (error) {
//                     log(`Error sending chunk: ${(error as Error).message}`, 'error');
//                 }
//             };

//             reader.readAsArrayBuffer(chunk);
//         }
//     }

//     function handleControlMessage(message: any) {
//         switch (message.type) {
//             case 'download-request':
//                 if (isInitiator && message.selectedFiles && Array.isArray(message.selectedFiles)) {
//                     log(`Received request to download ${message.selectedFiles.length} files`, 'info');
//                     transferState.selectedFiles = message.selectedFiles;
//                     startFileTransfer();
//                 }
//                 break;

//             case 'transfer-start':
//                 log(`Starting reception of ${message.totalFiles} files`, 'info');
//                 transferState.totalFilesSelected = message.totalFiles;
//                 transferState.completedFiles = 0;
//                 break;

//             case 'file-info':
//                 transferState.fileInfo = message;
//                 transferState.chunks = [];
//                 transferState.receivedSize = 0;
//                 transferState.inProgress = true;

//                 transferStatus.style.display = 'block';
//                 if (message.name && message.size) {
//                     transferInfo.textContent = `Receiving: ${message.name} (${message.fileIndex + 1}/${message.totalFiles})`;

//                     const fileInfo = {
//                         id: message.fileId || message.name,
//                         name: message.name,
//                         size: message.size,
//                         mimeType: message.mimeType || ''
//                     };

//                     log(`Receiving file: ${message.name} (${formatFileSize(message.size)})`, 'success');
//                     setupFileWriting(message);
//                 }
//                 break;

//             case 'file-complete':
//                 log(`File transfer complete: ${message.name || 'unknown'}`, 'info');
//                 setTimeout(() => {
//                     completeFileReception();
//                 }, 100);
//                 break;

//             case 'all-transfers-complete':
//                 log('All transfers complete', 'success');
//                 transferInfo.textContent = `✅ All files received successfully!`;
//                 transferState.inProgress = false;
//                 break;

//             case 'transfer-complete': // Legacy support
//                 log('Transfer complete signal received', 'info');
//                 setTimeout(() => {
//                     completeFileReception();
//                 }, 100);
//                 break;
//         }
//     }

//     async function setupFileWriting(fileInfo: any) {
//         try {
//             if (!window.showSaveFilePicker) {
//                 log('showSaveFilePicker is not available. Use a Chromium‑based browser.', 'error');
//                 alert('File Save Picker is not available.\nPlease use a supported browser (e.g. Chrome or Edge).');
//                 return;
//             }

//             if (!fileInfo.name) return;

//             const options = {
//                 suggestedName: fileInfo.name,
//                 types: [
//                     {
//                         description: 'All Files',
//                         accept: { '*/*': [] }
//                     }
//                 ]
//             };

//             const fileHandle = await window.showSaveFilePicker(options);
//             writableStream = await fileHandle.createWritable();

//             dataChannel?.send('send-file'); // Notify initiator to start sending file

//             log('Writable stream created for ' + fileInfo.name, 'success');
//         } catch (error) {
//             log(`Error creating writable stream: ${(error as Error).message}`, 'error');
//         }
//     }

//     async function handleFileData(data: ArrayBuffer) {
//         if (!transferState.fileInfo) {
//             log('Received file data but no file info available', 'error');
//             return;
//         }

//         // Update local progress
//         transferState.receivedSize += data.byteLength;

//         if (transferState.fileInfo.size) {
//             const fileProgress = (transferState.receivedSize / transferState.fileInfo.size);

//             // Calculate overall progress
//             const overallProgress = (
//                 (transferState.completedFiles + fileProgress) /
//                 transferState.totalFilesSelected
//             ) * 100;

//             progressFill.style.width = overallProgress + '%';
//             progressFill.textContent = Math.round(overallProgress) + '%';
//         }

//         if (writableStream) {
//             try {
//                 await writableStream.write(data);
//             } catch (error) {
//                 log(`Error writing data: ${(error as Error).message}`, 'error');
//             }
//         } else {
//             // Fallback for when FileSystemWritableFileStream is not available
//             receivedChunks.push(data);
//         }
//     }

//     async function completeFileReception() {
//         if (writableStream) {
//             try {
//                 await writableStream.close();
//                 writableStream = null;
//                 log('File saved successfully', 'success');

//                 // Update progress tracking
//                 transferState.completedFiles++;

//                 // Calculate overall progress
//                 const overallProgress = (transferState.completedFiles / transferState.totalFilesSelected) * 100;
//                 progressFill.style.width = overallProgress + '%';
//                 progressFill.textContent = Math.round(overallProgress) + '%';

//                 // If all files are complete, update UI
//                 if (transferState.completedFiles >= transferState.totalFilesSelected) {
//                     transferInfo.textContent = `✅ All files received successfully!`;
//                     transferState.inProgress = false;
//                 }

//             } catch (error) {
//                 log(`Error closing writable stream: ${(error as Error).message}`, 'error');
//             }
//         } else if (receivedChunks.length > 0) {
//             // Fallback for browsers that don't support FileSystemWritableFileStream
//             const blob = new Blob(receivedChunks);
//             const url = URL.createObjectURL(blob);

//             if (transferState.fileInfo?.name) {
//                 triggerDownload(url, transferState.fileInfo.name);
//                 receivedChunks = [];
//             }

//             // Update progress tracking
//             transferState.completedFiles++;
//         } else {
//             log('No data to save', 'warning');
//         }
//     }

//     function triggerDownload(url: string, filename: string) {
//         try {
//             const a = document.createElement('a');
//             a.href = url;
//             a.download = filename;
//             a.style.display = 'none';
//             document.body.appendChild(a);
//             a.click();
//             document.body.removeChild(a);

//             log('Download triggered for: ' + filename, 'success');

//             // Clean up URL after a delay
//             setTimeout(() => {
//                 URL.revokeObjectURL(url);
//             }, 1000);

//         } catch (error) {
//             log(`Error triggering download: ${(error as Error).message}`, 'error');
//         }
//     }

//     function updateConnectionStatus(state: string) {
//         const statusElement = currentMode === 'send' ? connectionStatus : receiveStatus;

//         switch (state) {
//             case 'connected':
//                 statusElement.className = 'connection-status status-connected';
//                 statusElement.innerHTML = '<span>✅</span> Connected!';
//                 break;
//             case 'connecting':
//                 statusElement.className = 'connection-status status-connecting';
//                 statusElement.innerHTML = '<span>🔄</span> Connecting...';
//                 break;
//             case 'failed':
//             case 'disconnected':
//                 statusElement.className = 'connection-status status-disconnected';
//                 statusElement.innerHTML = '<span>❌</span> Connection failed';
//                 break;
//         }
//     }

//     function copyCode() {
//         if (!shareCode.textContent) return;

//         navigator.clipboard.writeText(shareCode.textContent).then(() => {
//             log('Share code copied to clipboard', 'success');
//             alert('Code copied to clipboard!');
//         }).catch(() => {
//             // Fallback for older browsers
//             const textArea = document.createElement('textarea');
//             textArea.value = shareCode.textContent || '';
//             document.body.appendChild(textArea);
//             textArea.select();
//             document.execCommand('copy');
//             document.body.removeChild(textArea);
//             alert('Code copied to clipboard!');
//         });
//     }

//     function formatFileSize(bytes: number): string {
//         if (bytes === 0) return '0 Bytes';
//         const k = 1024;
//         const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
//         const i = Math.floor(Math.log(bytes) / Math.log(k));
//         return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
//     }

//     // Update the cleanup function
//     function cleanup() {
//         // Don't clean up if transfer is in progress
//         if (transferState.inProgress) {
//             log('Transfer in progress, skipping cleanup', 'warning');
//             return;
//         }

//         if (localPeerConnection) {
//             localPeerConnection.close();
//             localPeerConnection = null;
//         }
//         dataChannel = null;
//         currentFiles = []; // Clear the files array
//         roomCode = null;
//         receivedChunks = [];
//         expectedFileInfo = null;
//         availableFiles = [];

//         // Reset transfer state
//         transferState.fileInfo = null;
//         transferState.chunks = [];
//         transferState.receivedSize = 0;
//         transferState.currentFileIndex = 0;
//         transferState.selectedFiles = [];
//         transferState.totalFilesSelected = 0;
//         transferState.completedFiles = 0;

//         // Reset UI
//         fileInfo.style.display = 'none';
//         shareSection.style.display = 'none';
//         transferStatus.style.display = 'none';
//         peerInfo.style.display = 'none';
//         progressFill.style.width = '0%';
//         progressFill.textContent = '0%';
//         codeInput.value = '';
//     }

//     function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
//         const timestamp = new Date().toLocaleTimeString();
//         const entry = document.createElement('div');
//         entry.className = `log-entry log-${type}`;
//         entry.textContent = `[${timestamp}] ${message}`;
//         debugLog.appendChild(entry);
//         debugLog.scrollTop = debugLog.scrollHeight;

//         console.log(`[P2P] ${message}`);
//     }

//     function toggleLog() {
//         debugLog.style.display = debugLog.style.display === 'none' ? 'block' : 'none';
//     }

//     async function retryConnection() {
//         if (connectionRetryCount >= maxRetries) {
//             log('Maximum retry attempts reached. Connection failed.', 'error');
//             updateConnectionStatus('failed');
//             return;
//         }

//         connectionRetryCount++;
//         log(`Retry attempt ${connectionRetryCount}/${maxRetries}...`, 'warning');

//         // Clean up existing connection
//         if (localPeerConnection) {
//             localPeerConnection.close();
//             localPeerConnection = null;
//         }

//         // Wait a bit before retrying
//         await new Promise(resolve => setTimeout(resolve, 2000));

//         // Restart the connection process
//         setupPeerConnection();

//         if (isInitiator) {
//             await createOffer();
//         }
//     }

//     // Format code input
//     codeInput.addEventListener('input', (e) => {
//         const target = e.target as HTMLInputElement;
//         let value = target.value.replace(/[^A-Z0-9]/g, '');
//         target.value = value;
//     });

//     // Expose functions to global scope for HTML access
//     (window as any).setMode = setMode;
//     (window as any).connectToPeer = connectToPeer;
//     (window as any).copyCode = copyCode;
//     (window as any).toggleLog = toggleLog;
//     (window as any).retryConnection = retryConnection;
//     (window as any).toggleSelectAll = toggleSelectAll;
//     (window as any).updateFileSelection = updateFileSelection;
//     (window as any).downloadSelectedFiles = downloadSelectedFiles;


// });

// // File System Access API typings
// interface FileSystemWritableFileStream extends WritableStream {
//     write(data: ArrayBuffer | Blob | string | any): Promise<void>;
//     seek(position: number): Promise<void>;
//     truncate(size: number): Promise<void>;
// }

// interface FileSystemFileHandle {
//     createWritable(): Promise<FileSystemWritableFileStream>;
//     getFile(): Promise<File>;
// }



