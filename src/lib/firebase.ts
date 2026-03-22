import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBVDZJhL9sMzVknD5tNomLWF-0z0jPU3i0",
    authDomain: "brainbridge-4b8ac.firebaseapp.com",
    projectId: "brainbridge-4b8ac",
    storageBucket: "brainbridge-4b8ac.firebasestorage.app",
    messagingSenderId: "803209683213",
    appId: "1:803209683213:web:b62d13784fa2bbbb9f5044"
};

// Next.js uses SSR (Server-Side Rendering), which can re-run modules.
// Prevent "Firebase App named '[DEFAULT]' already exists" error.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const APP_ID = 'default-app-id';

export { app, auth, db, storage, APP_ID };
