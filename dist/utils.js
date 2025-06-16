export var LogType;
(function (LogType) {
    LogType[LogType["info"] = 0] = "info";
    LogType[LogType["success"] = 1] = "success";
    LogType[LogType["warning"] = 2] = "warning";
    LogType[LogType["error"] = 3] = "error";
})(LogType || (LogType = {}));
export default class Utils {
    static log(message, type = LogType.info, element) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        element.appendChild(entry);
        element.scrollTop = element.scrollHeight;
        console.log(`[P2P] ${message}`);
    }
    static formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
