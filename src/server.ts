// import cors from 'cors';
// import express from 'express';
// import http from 'http';
// import { Server, Socket } from 'socket.io';

// // Define interfaces for type safety
// interface FileInfo {
//     name: string;
//     size: number;
//     type: string;
// }

// interface Room {
//     initiator: string;
//     receiver: string | null;
//     fileInfo: FileInfo | null;
// }

// interface SignalData {
//     room: string;
//     type: string;
//     payload: any;
// }

// interface JoinRoomCallback {
//     success: boolean;
//     fileInfo?: FileInfo | null;
//     error?: string;
// }

// const app = express();

// // Use HTTP for development (you can add HTTPS later)
// const server = http.createServer(app);

// const io = new Server(server, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

// app.use(cors());
// // Serve static files from current directory
// app.use(express.static(__dirname));

// const rooms: Map<string, Room> = new Map();

// io.on('connection', (socket: Socket) => {
//     console.log('User connected:', socket.id);

//     socket.on('create-room', (callback: (roomCode: string) => void) => {
//         const roomCode = generateRoomCode();
//         rooms.set(roomCode, {
//             initiator: socket.id,
//             receiver: null,
//             fileInfo: null
//         });
//         socket.join(roomCode);
//         callback(roomCode);
//         console.log(`Room created: ${roomCode} by ${socket.id}`);
//     });

//     socket.on('join-room', (roomCode: string, callback: (response: JoinRoomCallback) => void) => {
//         const room = rooms.get(roomCode);
//         console.log(`User ${socket.id} attempting to join room: ${roomCode}`);

//         if (room && !room.receiver) {
//             room.receiver = socket.id;
//             socket.join(roomCode);

//             // Notify both users that peer joined
//             socket.to(roomCode).emit('peer-joined', { receiverId: socket.id });
//             socket.emit('peer-joined', { initiatorId: room.initiator });

//             callback({ success: true, fileInfo: room.fileInfo });
//             console.log(`User ${socket.id} joined room: ${roomCode}`);

//             // Tell initiator to start the offer process
//             io.to(room.initiator).emit('start-offer');
//         } else {
//             const error = !room ? 'Room not found' : 'Room is full';
//             callback({ success: false, error });
//             console.log(`Join failed: ${error} for room ${roomCode}`);
//         }
//     });

//     socket.on('set-file-info', (data: { roomCode: string; fileInfo: FileInfo }) => {
//         const room = rooms.get(data.roomCode);
//         if (room && room.initiator === socket.id) {
//             room.fileInfo = data.fileInfo;
//             console.log(`File info set for room ${data.roomCode}:`, data.fileInfo.name);
//         }
//     });

//     socket.on('signal', (data: SignalData) => {
//         console.log(`Signal ${data.type} from ${socket.id} to room ${data.room}`);
//         const room = rooms.get(data.room);

//         if (room) {
//             console.log(`Room found. Initiator: ${room.initiator}, Receiver: ${room.receiver}`);
//             console.log(`Sender is: ${socket.id}`);

//             // Get the target socket (the other person in the room)
//             const targetSocket = socket.id === room.initiator ? room.receiver : room.initiator;
//             console.log(`Target socket: ${targetSocket}`);

//             if (targetSocket) {
//                 // Send directly to the target socket
//                 io.to(targetSocket).emit('signal', {
//                     type: data.type,
//                     payload: data.payload,
//                     sender: socket.id
//                 });
//                 console.log(`Signal ${data.type} sent to ${targetSocket}`);
//             } else {
//                 console.log(`No target socket found for signal ${data.type}`);
//             }
//         } else {
//             console.log(`Room ${data.room} not found for signal`);
//         }
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//         // Clean up rooms when user disconnects
//         for (let [roomCode, room] of rooms.entries()) {
//             if (room.initiator === socket.id || room.receiver === socket.id) {
//                 socket.to(roomCode).emit('peer-disconnected');
//                 rooms.delete(roomCode);
//                 console.log(`Room ${roomCode} cleaned up due to disconnect`);
//             }
//         }
//     });
// });

// function generateRoomCode(): string {
//     return Math.random().toString(36).substring(2, 8).toUpperCase();
// }

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//     console.log(`Server running on all interfaces at port ${PORT}`);
// });
