import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};


if (!firebaseConfig.apiKey) {
    throw new Error("Firebase API Key is missing. Please check your .env.local file.");
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
// Use initializeFirestore to force long polling if WebSockets are blocked
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

let analytics;
if (typeof window !== "undefined") {
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
        isSupported().then((supported) => {
            if (supported) {
                analytics = getAnalytics(app);
            }
        });
    });
}

export { auth, db, analytics };
