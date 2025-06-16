;
export class FileData {
    constructor(file) {
        this.file = file;
        this.id = crypto.randomUUID();
        this.size = file.size;
        this.name = file.name;
        this.mimeType = file.type;
    }
    toMetaData() {
        return {
            id: this.id,
            size: this.size,
            name: this.name,
            mimeType: this.mimeType
        };
    }
}
export class Room {
    constructor(code, initiator, receiver, files) {
        this.code = code;
        this.initiator = initiator;
        this.receiver = receiver;
        this.files = files;
    }
    static fromJSON(obj) {
        return new Room(obj.roomCode, obj.initiator, obj.receiver, obj.files);
    }
    toJson() {
        return {
            code: this.code,
            initiator: this.initiator,
            receiver: this.receiver,
            files: this.files
        };
    }
}
export const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
