import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { messaging, db } from '../services/firebase';
import { useAuth } from './useAuth';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * usePushNotifications
 * ───────────────────────────────────────────────────────────────────
 * Bootstraps the FCM token for the signed-in user without re-prompting
 * for notification permission on every page load.
 *
 * Support for both Web environment and Capacitor Native mobile platforms.
 */

const VAPID_KEY =
    'BCQ5naTxjzLBGg5LAr8mdjvmWMdhHJ6NhECt7Zm1Heu7RPch5_sCH1ILKeOJotIArRjaHkNFet6N9S9tQLVX5t4';

/**
 * Manual entry point — call this from a settings toggle or a first-
 * time "enable notifications" button. Returns true if push is now
 * working for this device, false otherwise.
 */
export async function enablePushNotifications(uid) {
    if (typeof window === 'undefined' || !uid) {
        return false;
    }

    if (Capacitor.isNativePlatform()) {
        try {
            const permStatus = await PushNotifications.requestPermissions();
            if (permStatus.receive === 'granted') {
                await PushNotifications.register();
                return true;
            }
            return false;
        } catch (err) {
            console.error('enablePushNotifications: Capacitor failed', err);
            return false;
        }
    } else {
        if (!('Notification' in window)) return false;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;
            await registerFcmToken(uid);
            return true;
        } catch (err) {
            console.error('enablePushNotifications: Web failed', err);
            return false;
        }
    }
}

async function registerFcmToken(uid) {
    try {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (!token) return;

        // Dedupe: if we already wrote THIS token to Firestore this
        // session, skip the write. arrayUnion is idempotent in
        // Firestore, but writing on every mount still costs a doc
        // op + bandwidth.
        const cacheKey = `fcm_token_synced:${uid}`;
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached === token) return;
        } catch (e) {
            // sessionStorage may be unavailable in private mode
        }

        await updateDoc(doc(db, 'users', uid), {
            fcmTokens: arrayUnion(token),
        });

        try { sessionStorage.setItem(cacheKey, token); } catch (e) {}
        console.log('FCM token registered for', uid);
    } catch (err) {
        console.warn('registerFcmToken: failed', err);
    }
}

export const usePushNotifications = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.uid) return;

        if (Capacitor.isNativePlatform()) {
            const setupNativePush = async () => {
                try {
                    const permStatus = await PushNotifications.checkPermissions();
                    if (permStatus.receive === 'granted') {
                        await PushNotifications.register();
                    }

                    // Add registration listener
                    await PushNotifications.addListener('registration', async (token) => {
                        const tokenValue = token.value;
                        if (!tokenValue) return;

                        const cacheKey = `fcm_token_synced:${user.uid}`;
                        try {
                            const cached = sessionStorage.getItem(cacheKey);
                            if (cached === tokenValue) return;
                        } catch (e) {}

                        await updateDoc(doc(db, 'users', user.uid), {
                            fcmTokens: arrayUnion(tokenValue),
                        });

                        try { sessionStorage.setItem(cacheKey, tokenValue); } catch (e) {}
                        console.log('Capacitor native FCM token registered for', user.uid);
                    });

                    // Add registrationError listener
                    await PushNotifications.addListener('registrationError', (error) => {
                        console.error('Capacitor push registration error: ', error);
                    });

                    // Add pushNotificationReceived listener (Foreground push)
                    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                        console.log('Capacitor foreground notification received: ', notification);
                    });

                    // Add pushNotificationActionPerformed listener (Tap on notification)
                    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                        console.log('Capacitor notification action performed: ', notification);
                    });

                } catch (err) {
                    console.warn('setupNativePush: failed', err);
                }
            };

            setupNativePush();

            return () => {
                try {
                    PushNotifications.removeAllListeners();
                } catch (e) {
                    console.warn('Failed to clean up Capacitor push listeners:', e);
                }
            };
        } else {
            // Web platform setup
            if (typeof window === 'undefined' || !('Notification' in window)) return;

            const status = Notification.permission;
            if (status === 'denied') return;
            if (status === 'granted') {
                registerFcmToken(user.uid);
            }

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Web foreground message received:', payload);
            });
            return () => unsubscribe();
        }
    }, [user?.uid]);
};
