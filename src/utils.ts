export enum LogType {
    info, success, warning, error
}

export default class Utils {
    static log(message: string, type: LogType = LogType.info, element: HTMLDivElement): void {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        element.appendChild(entry);
        element.scrollTop = element.scrollHeight;

        console.log(`[P2P] ${message}`);


    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}