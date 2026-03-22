import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, createUserWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, doc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // ▼▼▼▼ Firebase Config ▼▼▼▼
        let isReferrerValid = false;
        let referrerCheckTimeout = null;
        const ADMIN_SECRET = "admin_start";

        signInAnonymously(auth).catch(e => console.log("Anon auth:", e));

        document.addEventListener('DOMContentLoaded', () => {
            // URLパラメータから紹介者IDを取得して自動入力
            const urlParams = new URLSearchParams(window.location.search);
            const refId = urlParams.get('ref');
            
            if (refId) {
                const refInput = document.getElementById('referrer-input');
                if (refInput) {
                    refInput.value = refId;
                    refInput.setAttribute('readonly', 'true');
                    refInput.classList.add('bg-brand-50', 'text-brand-600', 'font-bold');
                    // 自動でバリデーションを走らせる
                    window.checkReferrer(refId);
                }
            }
        });

        window.validateInput = (input) => {
            input.value = input.value.replace(/[^a-zA-Z0-9_]/g, '');
        };

        window.checkReferrer = async (value) => {
            const msgElement = document.getElementById('referrer-msg');
            const iconContainer = document.getElementById('referrer-status-icon');
            
            isReferrerValid = false;
            updateRegisterButton();
            
            if (!value) {
                msgElement.textContent = '半角英数字とアンダーバーのみ';
                msgElement.className = 'mt-1.5 text-[10px] text-brand-500 font-bold tracking-widest';
                iconContainer.classList.add('hidden');
                return;
            }

            if (value === ADMIN_SECRET) {
                msgElement.textContent = '管理者モード: 紹介者チェックをスキップします';
                msgElement.className = 'mt-1.5 text-[10px] text-brand-600 font-bold tracking-widest';
                iconContainer.classList.remove('hidden');
                iconContainer.innerHTML = '<i class="fa-solid fa-crown text-[#d4af37]"></i>';
                isReferrerValid = true;
                updateRegisterButton();
                return;
            }

            if (value === "admin") {
                msgElement.textContent = 'このIDは紹介者として指定できません';
                msgElement.className = 'mt-1.5 text-[10px] text-red-500 font-bold tracking-widest';
                iconContainer.classList.remove('hidden');
                iconContainer.innerHTML = '<i class="fa-solid fa-ban text-red-500"></i>';
                isReferrerValid = false;
                updateRegisterButton();
                return;
            }

            msgElement.textContent = '確認中...';
            msgElement.className = 'mt-1.5 text-[10px] text-brand-500 font-bold tracking-widest';
            iconContainer.classList.remove('hidden');
            iconContainer.innerHTML = '<i class="fa-solid fa-compass fa-spin text-brand-400"></i>';

            if (referrerCheckTimeout) clearTimeout(referrerCheckTimeout);

            referrerCheckTimeout = setTimeout(async () => {
                try {
                    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                    const q = query(usersRef, where("userId", "==", value));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        const displayName = userData.name || userData.userId || 'ユーザー';
                        msgElement.textContent = `紹介者: ${displayName} さんを確認しました`;
                        msgElement.className = 'mt-1.5 text-[10px] text-green-700 font-bold tracking-widest';
                        iconContainer.innerHTML = '<i class="fa-solid fa-circle-check text-green-600"></i>';
                        isReferrerValid = true;
                    } else {
                        msgElement.textContent = '該当する紹介者が見つかりません';
                        msgElement.className = 'mt-1.5 text-[10px] text-red-600 font-bold tracking-widest';
                        iconContainer.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-500"></i>';
                    }
                } catch (error) {
                    console.error("Referrer check error:", error);
                    msgElement.textContent = '確認できませんでした';
                    msgElement.className = 'mt-1.5 text-[10px] text-red-500 font-bold tracking-widest';
                    iconContainer.innerHTML = '<i class="fa-solid fa-circle-exclamation text-red-500"></i>';
                }
                updateRegisterButton();
            }, 500);
        };

        function updateRegisterButton() {
            const btn = document.getElementById('btn-register');
            if (isReferrerValid) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

        window.handleRegister = async (e) => {
            e.preventDefault();
            if (!isReferrerValid) return;

            const form = e.target;
            const referrerId = form.referrer.value;
            const userId = form.userid.value;
            const email = form.email.value;
            const password = form.password.value;

            showNotification('乗船手続き中...', 'info');

            try {
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                const idQuery = query(usersRef, where("userId", "==", userId));
                const idCheckSnapshot = await getDocs(idQuery);
                
                if (!idCheckSnapshot.empty) {
                    throw new Error("このユーザーIDは既に使用されています。別のIDを指定してください。");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const timestamp = new Date().toISOString();
                
                // 1. Private Data
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
                    userId: userId,
                    referrerId: referrerId || null, // ★追加：非公開データにも確実に保存
                    email: email,
                    name: userId,
                    createdAt: timestamp,
                    profilePublic: "false",
                    membershipRank: "arrival" 
                });

                // 2. Public Data
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
                    userId: userId,
                    name: userId,
                    email: email,
                    isHidden: true,
                    updatedAt: timestamp,
                    referrerId: referrerId || null, // ★追加：検索用に確実に保存
                    profileScore: 0                 // ★追加：初期スコアを保存
                });

                showNotification('乗船手続き完了！ホームへ移動します', 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);

            } catch (error) {
                console.error("Reg error:", error);
                let msg = '登録に失敗しました。';
                if (error.code === 'auth/email-already-in-use') msg = 'このメールアドレスは既に使用されています。';
                if (error.message) msg = error.message;
                showNotification(msg, 'error');
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
                notif.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] bg-[#fffdf9] text-red-700 shadow-xl border border-brand-200 rounded-sm p-4 text-center';
            } else {
                notif.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] bg-[#3e2723] text-[#f7f5f0] shadow-xl border border-[#b8860b] rounded-sm p-4 text-center';
            }
            msgEl.textContent = msg;
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        };