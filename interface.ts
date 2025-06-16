


export interface ICECandidate {

    roomCode: string;
    candidate: RTCIceCandidate;
}

export interface SessionDescriptionData {
    roomCode: string;
    sessionDescription: RTCSessionDescriptionInit;
}

export interface FileMetaData {
    id: string;
    size: number;
    name: string;
    mimeType: string;
}

export interface TransferState {
    totalFileSent: number;
    isInProgress: boolean;
};

export interface FileTransferStatus {
    progress: number;
    isComplete: boolean;
    fileMetaData: FileMetaData;
    offset: number;
    startTime: number;
}

export interface FileReceiveStatus {
    progress: number;
    isComplete: boolean;
    fileMetaData: FileMetaData;
    totalChunksReceived: number;
    startTime: number;
}

export interface FileChunks {
    fileId: string;
    chunk: ArrayBuffer;
    offset: number;

}

export class FileData implements FileMetaData {
    readonly file: File;
    readonly id: string;
    readonly size: number;
    readonly name: string;
    readonly mimeType: string;

    constructor(file: File) {
        this.file = file;
        this.id = crypto.randomUUID();
        this.size = file.size;
        this.name = file.name;
        this.mimeType = file.type;
    }

    toMetaData(): FileMetaData {
        return {
            id: this.id,
            size: this.size,
            name: this.name,
            mimeType: this.mimeType
        };
    }
}




export class Room {
    code: string;
    initiator: string;
    receiver: string | null;
    files: FileMetaData[];

    constructor(code: string, initiator: string, receiver: string | null, files: FileMetaData[]) {
        this.code = code;
        this.initiator = initiator;
        this.receiver = receiver;
        this.files = files;
    }



    static fromJSON(obj: any): Room {
        return new Room(obj.roomCode, obj.initiator, obj.receiver, obj.files);
    }

    toJson(): any {
        return {
            code: this.code,
            initiator: this.initiator,
            receiver: this.receiver,
            files: this.files
        };
    }

}
export interface ResponseInterface {
    isSucess: boolean;
    data?: any;


}

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: ArrayBuffer | Blob | string | any): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

export interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
}





export const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
