export const firebaseConfig = {
    apiKey: "AIzaSyBVDZJhL9sMzVknD5tNomLWF-0z0jPU3i0",
    authDomain: "brainbridge-4b8ac.firebaseapp.com",
    projectId: "brainbridge-4b8ac",
    storageBucket: "brainbridge-4b8ac.firebasestorage.app",
    messagingSenderId: "803209683213",
    appId: "1:803209683213:web:b62d13784fa2bbbb9f5044"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'default-app-id';
