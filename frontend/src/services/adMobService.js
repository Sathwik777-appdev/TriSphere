import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const initializeAdMob = async () => {
    if (!Capacitor.isNativePlatform()) {
        console.log('AdMob is only available on native devices.');
        return false;
    }

    try {
        await AdMob.initialize({
            requestTrackingAuthorization: true,
            testingDevices: ['2077ef9a63d2b398840261c8221a0c9b'],
            initializeForTesting: true, // Use true during development
        });
        console.log('AdMob Initialized Successfully!');
        return true;
    } catch (error) {
        console.error('Failed to initialize AdMob', error);
        return false;
    }
};

export const showBannerAd = async (adId = 'ca-app-pub-3940256099942544/6300978111') => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        await AdMob.showBanner({
            adId: adId,
            adSize: BannerAdSize.BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true,
        });
    } catch (error) {
        console.error('Failed to show Banner Ad', error);
    }
};

export const hideBannerAd = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        await AdMob.hideBanner();
    } catch (error) {
        console.error('Failed to hide Banner Ad', error);
    }
};

export const removeBannerAd = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        await AdMob.removeBanner();
    } catch (error) {
        console.error('Failed to remove Banner Ad', error);
    }
};
