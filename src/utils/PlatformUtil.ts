import {MobileDeviceData} from "../data/MobileDeviceData";
import MobileDetect from 'mobile-detect'

export class PlatformUtil {
    public static getMobileDeviceData(userAgent: string): MobileDeviceData {
        const mobileDetect = new MobileDetect(userAgent || '');
        return {
            manufacturer: mobileDetect.mobile(),
            browser: mobileDetect.userAgent(),
            os: mobileDetect.os()
        }
    }

    public static isMac(userAgent?: string): boolean {
        if (!userAgent) {
            // Default to checking window.navigator.userAgent if available
            if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
                userAgent = window.navigator.userAgent;
            } else {
                return false;
            }
        }
        return !!userAgent.toLowerCase().match("mac");
    }

    public static isSafari(userAgent?: string): boolean {
        if (!userAgent) {
            if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
                userAgent = window.navigator.userAgent;
            } else {
                return false;
            }
        }
        return !!userAgent.toLowerCase().match("safari");
    }

    public static isFirefox(userAgent?: string): boolean {
        if (!userAgent) {
            if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
                userAgent = window.navigator.userAgent;
            } else {
                return false;
            }
        }
        return !!userAgent.toLowerCase().match("firefox");
    }

    public static isIOS(userAgent?: string): boolean {
        if (!userAgent) {
            if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
                userAgent = window.navigator.userAgent;
            } else {
                return false;
            }
        }
        return /iphone|ipad|ipod/i.test(userAgent);
    }
}
