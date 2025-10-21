/**
 * Utility class for browser detection and feature support
 */
export class BrowserDetection {
    /**
     * Check if the current browser supports File System Access API
     * Returns false for Firefox and other browsers without support
     */
    public static supportsFileSystemAccess(): boolean {
        return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    }

    /**
     * Get browser name for display purposes
     */
    public static getBrowserName(): string {
        if (typeof navigator === 'undefined') {
            return 'Unknown';
        }

        const userAgent = navigator.userAgent.toLowerCase();

        if (userAgent.indexOf('firefox') > -1) {
            return 'Firefox';
        } else if (userAgent.indexOf('edg') > -1) {
            return 'Edge';
        } else if (userAgent.indexOf('chrome') > -1) {
            return 'Chrome';
        } else if (userAgent.indexOf('safari') > -1) {
            return 'Safari';
        } else if (userAgent.indexOf('opera') > -1 || userAgent.indexOf('opr') > -1) {
            return 'Opera';
        }

        return 'Unknown';
    }
}
