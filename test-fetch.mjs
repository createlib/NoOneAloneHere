import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBVDZJhL9sMzVknD5tNomLWF-0z0jPU3i0",
    authDomain: "brainbridge-4b8ac.firebaseapp.com",
    projectId: "brainbridge-4b8ac",
    storageBucket: "brainbridge-4b8ac.firebasestorage.app",
    messagingSenderId: "803209683213",
    appId: "1:803209683213:web:b62d13784fa2bbbb9f5044"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appId = "default-app-id";

async function main() {
    console.log("Fetching users from Database...");
    try {
        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const snap = await getDocs(usersRef);
        console.log(`Snapshot size: ${snap.size}`);
        
        const arr = [];
        snap.forEach(d => arr.push(d.data()));
        console.log(`Document samples:`);
        console.log(arr.slice(0, 2));

        // Test filtering logic
        const filtered = arr.filter(u => u.isHidden !== true);
        console.log(`Count after hiding check: ${filtered.length}`);

        process.exit(0);
    } catch (e) {
        console.error("ERROR", e);
        process.exit(1);
    }
}

main();
