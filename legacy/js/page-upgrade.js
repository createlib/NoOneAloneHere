import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
    import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

    const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

    onAuthStateChanged(auth, async (user) => {
        const loading = document.getElementById('loading-indicator');
        const content = document.getElementById('pricing-content');

        if (isAdminMock) {
            updateRankUI('covenant');
            loading.classList.add('hidden');
            content.classList.remove('hidden');
            return;
        }

        if (user && !user.isAnonymous) {
            try {
                const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const rank = data.membershipRank || 'arrival';
                    updateRankUI(rank);
                } else {
                    updateRankUI('arrival');
                }
            } catch(e) { 
                console.error(e);
                updateRankUI('arrival');
            }
            loading.classList.add('hidden');
            content.classList.remove('hidden');
        } else {
            window.location.href = 'login.html';
        }
    });

    function updateRankUI(currentRank) {
        // ランクの強さを数値化して比較しやすくする
        const rankLevels = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
        const rLevel = rankLevels[currentRank] || 0;

        const plans = [
            { id: 'arrival', level: 0 },
            { id: 'settler', level: 1, url: 'https://buy.stripe.com/eVq4gz28G87Bb0ldXY7bW08' },
            { id: 'builder', level: 2, url: '#' }, 
            { id: 'guardian', level: 3, url: '#' }, 
            { id: 'covenant', level: 4, url: 'https://buy.stripe.com/dRm14n28GevZ0lH2fg7bW09' }
        ];

        // 各状態のボタンスタイル定義
        const currentPlanStyle = "mt-auto w-full py-3.5 bg-[#f7f5f0] text-[#a09080] font-bold text-xs tracking-widest border border-[#dcd4c6] cursor-not-allowed flex justify-center items-center gap-2";
        const downgradeMsgStyle = "mt-auto w-full py-3.5 bg-[#f7f5f0]/50 text-[#a09080] font-bold text-[10px] tracking-widest cursor-not-allowed text-center border border-dashed border-[#e8dfd1]";
        const upgradeStyleDefault = "mt-auto block text-center w-full py-3.5 bg-[#8b6a4f] text-[#fffdf9] font-bold text-xs tracking-widest hover:bg-[#725b3f] transition-colors shadow-md";
        const upgradeStyleCov = "mt-auto block text-center w-full py-4 bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a1a17] font-bold text-sm tracking-widest hover:from-[#b8860b] hover:to-[#996515] hover:text-[#fffdf9] transition-all shadow-md transform hover:-translate-y-0.5";

        plans.forEach(p => {
            const btn = document.getElementById(`btn-${p.id}`);
            if(!btn) return;

            if (p.level === rLevel || (p.level === 4 && rLevel === 99)) {
                // 1. 現在契約中のプラン
                btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i>現在のプラン';
                btn.className = currentPlanStyle;
                if(btn.tagName === 'A') {
                    btn.removeAttribute('href');
                    btn.removeAttribute('target');
                } else {
                    btn.disabled = true;
                }
            } else if (p.level < rLevel && rLevel !== 99) {
                // 2. 現在より下のプラン (ダウングレード)
                btn.innerHTML = '※ダウングレードは運営へお問い合わせください';
                btn.className = downgradeMsgStyle;
                if(btn.tagName === 'A') {
                    btn.removeAttribute('href');
                    btn.removeAttribute('target');
                } else {
                    btn.disabled = true;
                }
            } else {
                // 3. 現在より上のプラン (アップグレード)
                if (p.id === 'covenant') {
                    btn.innerHTML = '契約を結ぶ';
                    btn.className = upgradeStyleCov;
                } else {
                    btn.innerHTML = '契約を変更する';
                    btn.className = upgradeStyleDefault;
                }
                
                if (btn.tagName === 'A') {
                    btn.href = p.url;
                    btn.target = '_blank';
                }
            }
        });
        
        lucide.createIcons();
    }