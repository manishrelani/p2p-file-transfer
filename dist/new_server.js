import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { Room } from './interface.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use(cors());
app.use(express.static(__dirname));
const rooms = new Map();
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
    socket.on('create-room', (listOfFiles, callback) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        const room = new Room(roomCode, socket.id, null, listOfFiles);
        rooms.set(roomCode, room);
        callback(room);
        console.log(`Room created with code: ${roomCode}`);
    });
    socket.on('join-room', (roomCode, callback) => {
        const room = rooms.get(roomCode);
        console.log(`User ${socket.id} attempting to join room: ${roomCode}`);
        if (!room) {
            console.log(`Room ${roomCode} not found`);
            callback({ isSucess: false, data: 'Room not found' });
            return;
        }
        if (room.receiver) {
            console.log(`Room ${roomCode} is already full`);
            callback({ isSucess: false, data: 'Room is already full' });
            return;
        }
        room.receiver = socket.id;
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);
        console.log(`Room details:`, room);
        const data = {
            isSucess: true,
            data: {
                roomCode: room.code,
                files: room.files,
                initiator: room.initiator,
                receiver: room.receiver
            }
        };
        callback(data);
        console.log(`User ${socket.id} joined room: ${roomCode}`);
        console.log(`Room details:`, room);
        console.log(`Files in room:`, room.files);
        console.log(`Initiator: ${room.initiator}, Receiver: ${room.receiver}`);
        console.log(`Emitting peer-joined event to both peers in room: ${roomCode}`);
        io.to(room.initiator).emit('peer-joined', socket.id);
        io.to(room.receiver).emit('peer-joined', room.initiator);
        io.to(room.initiator).emit('start-offer');
    });
    socket.on('offer-created', (data) => {
        const room = rooms.get(data.roomCode);
        if (room && room.receiver) {
            socket.to(room.receiver).emit('offer', data.sessionDescription);
        }
    });
    socket.on('answer-created', (data) => {
        console.log('Answer created for room:', data.roomCode);
        const room = rooms.get(data.roomCode);
        console.log('Room details:', room);
        if (room) {
            console.log(`Sending answer to initiator: ${room.initiator}`);
            console.log('current :', room.initiator);
            socket.to(room.initiator).emit('answer', data.sessionDescription);
        }
    });
    socket.on('ice-candidate', (data) => {
        const room = rooms.get(data.roomCode);
        if (room) {
            if (socket.id === room.initiator) {
                console.log(`Sending ICE candidate to receiver: ${room.receiver}`);
            }
            else if (socket.id === room.receiver) {
                console.log(`Sending ICE candidate to initiator: ${room.initiator}`);
            }
            socket.to(room.code).emit('ice-candidate', data.candidate);
        }
    });
});
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}
