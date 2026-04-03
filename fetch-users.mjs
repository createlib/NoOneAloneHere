import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function run() {
  const usersRef = collection(db, 'artifacts', 'default-app-id', 'public', 'data', 'users');
  const snap = await getDocs(usersRef);
  console.log("Total users:", snap.size);
  snap.forEach(d => {
    const data = d.data();
    console.log(`Doc ID: ${d.id}, name: ${data.name}, userId: ${data.userId}, hidden: ${data.isHidden}, rank: ${data.membershipRank}`);
  });
  process.exit(0);
}
run();
