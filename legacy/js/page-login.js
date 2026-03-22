import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // ▼▼▼▼ Firebase Config ▼▼▼▼
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        // ログイン済みならマイページへ
        onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) {
                window.location.href = 'user.html';
            }
        });

        window.handleLogin = async (e) => {
            e.preventDefault();
            const userInput = e.target.userid.value.trim();
            const password = e.target.password.value;
            const btn = document.getElementById('btn-login');

            // Admin Backdoor
            if (userInput === 'admin' && password === 'admin') {
                localStorage.setItem('isAdminMock', 'true');
                window.location.href = 'user.html';
                return;
            }

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> ログイン中...';

            try {
                let email = userInput;

                // 入力値がメールアドレスでない場合（@がない場合）、ユーザーIDとして検索
                if (!userInput.includes('@')) {
                    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                    const q = query(usersRef, where("userId", "==", userInput));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        if (userData.email) {
                            email = userData.email;
                        } else {
                            throw new Error("初期設定が完了していません。一度「メールアドレス」でログインし、プロフィールを保存し直してください。");
                        }
                    } else {
                        throw new Error("指定されたユーザーIDは見つかりません。");
                    }
                }

                await signInWithEmailAndPassword(auth, email, password);
                showNotification('乗船しました。ホームへ移動します', 'success');
                // redirect is handled by onAuthStateChanged
            } catch (error) {
                console.error(error);
                let msg = 'ログインに失敗しました。';
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'ID・メールアドレス、またはパスワードが間違っています。';
                else if (error.code === 'auth/user-not-found') msg = 'ユーザーが見つかりません。';
                else if (error.message) msg = error.message;
                
                showNotification(msg, 'error');
                btn.innerHTML = '<i class="fa-solid fa-ship mr-2"></i> 乗船する';
            }
        };

        window.togglePassword = (id) => {
            const input = document.getElementById(id);
            const icon = input.nextElementSibling.querySelector('i');
            if (input.type === "password") {
                input.type = "text";
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = "password";
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        };

        window.showNotification = (msg, type) => {
            const notif = document.getElementById('notification');
            const msgEl = document.getElementById('notif-message');
            
            if(type === 'error') {
                notif.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] bg-[#fffdf9] text-red-700 shadow-xl border border-brand-200 rounded-sm p-4 text-center transition-all duration-300';
            } else {
                notif.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] bg-[#3e2723] text-[#f7f5f0] shadow-xl border border-[#b8860b] rounded-sm p-4 text-center transition-all duration-300';
            }
            msgEl.textContent = msg;
            notif.classList.remove('hidden', 'translate-y-10', 'opacity-0');
            setTimeout(() => {
                notif.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => notif.classList.add('hidden'), 300);
            }, 3000);
        };