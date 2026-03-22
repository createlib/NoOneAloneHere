import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        // ▼▼▼▼ Firebase Config ▼▼▼▼
        let currentUser = null;
        let allUsers = [];
        let isAdmin = false;
        let myRank = 'arrival';

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        // 権限レベルの定義
        const rankLevels = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
        function getRankLevel(rank) { return rankLevels[rank] || 0; }

        // Areas setup
        const prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];
        
        function initFilterOptions() {
            const areaSelect = document.getElementById('filter-area');
            prefectures.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                areaSelect.appendChild(opt);
            });

            // ★追加: URLからOSナンバーの指定があれば検索フィールドに初期セットする
            const urlParams = new URLSearchParams(window.location.search);
            const targetOs = urlParams.get('osNumber');
            if (targetOs) {
                const osInput = document.getElementById('filter-os-number');
                if (osInput) osInput.value = targetOs;
            }
        }

        window.toggleTheaterMenu = () => {
            const menu = document.getElementById('sp-theater-menu');
            const content = document.getElementById('sp-theater-menu-content');
            if (menu && menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                setTimeout(() => { if(content) content.classList.remove('translate-y-full'); }, 10);
            } else if(menu) {
                if(content) content.classList.add('translate-y-full');
                setTimeout(() => menu.classList.add('hidden'), 300);
            }
        };

        // ★変更: 権限チェックを追加
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                
                if (isAdminMock) { 
                    isAdmin = true; 
                    myRank = 'covenant';
                } else {
                    try {
                        const mySnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                        if (mySnap.exists()) {
                            myRank = mySnap.data().membershipRank || 'arrival';
                            if (mySnap.data().userId === 'admin') {
                                isAdmin = true;
                                myRank = 'admin';
                            }
                        }
                    } catch(e){}
                }

                // 権限判定: SETTLER (1) 以上、または管理者
                const rLevel = getRankLevel((myRank || 'arrival').toLowerCase());
                
                if (rLevel >= 1 || isAdmin || isAdminMock) {
                    // アクセス許可
                    document.getElementById('search-content').classList.remove('hidden');
                    initFilterOptions();
                    fetchUsers();
                } else {
                    // アクセス拒否 (ロック画面表示)
                    document.getElementById('search-content').classList.add('hidden');
                    document.getElementById('locked-view').classList.remove('hidden');
                }
            } else {
                window.location.href = 'login.html';
            }
        });

        async function fetchUsers() {
            try {
                if (isAdminMock) {
                    allUsers = [
                        { userId: 'test1', name: 'Alice', jobTitle: 'Designer', prefecture: '東京都', profileScore: 80, isHidden: false, osNumber: "50" },
                        { userId: 'test2', name: 'Bob', jobTitle: 'Engineer', prefecture: '大阪府', profileScore: 60, isHidden: false, osNumber: "12" },
                        { userId: 'test3', name: 'Charlie', isHidden: true, osNumber: "33" } 
                    ];
                } else {
                    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                    const snap = await getDocs(usersRef);
                    allUsers = [];
                    snap.forEach(d => {
                        const data = d.data();
                        // 非公開ユーザーの除外 (管理者は除外しない)
                        if (data.isHidden !== true || isAdmin) {
                            allUsers.push({ id: d.id, ...data });
                        }
                    });
                }
                
                // スコア順、次に名前順でソート
                allUsers.sort((a, b) => {
                    const scoreA = a.profileScore || 0;
                    const scoreB = b.profileScore || 0;
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    const nameA = a.name || a.userId || '';
                    const nameB = b.name || b.userId || '';
                    return nameA.localeCompare(nameB);
                });

                filterUsers();
            } catch (e) {
                console.error("Fetch users err:", e);
                document.getElementById('users-grid').innerHTML = '<div class="col-span-full text-center text-red-500 py-10">ユーザーの取得に失敗しました</div>';
            }
        }

        window.filterUsers = () => {
            const searchQ = document.getElementById('search-input').value.toLowerCase();
            const areaQ = document.getElementById('filter-area').value;
            // ★変更: OSナンバーの値を取得
            const osQ = document.getElementById('filter-os-number').value.trim();

            const filtered = allUsers.filter(u => {
                let matchSearch = true;
                if (searchQ) {
                    const searchable = [
                        u.name, u.userId, u.jobTitle, 
                        (u.skills||[]).join(' '), (u.hobbies||[]).join(' '),
                        (u.canOffer||[]).join(' '), (u.lookingFor||[]).join(' ')
                    ].join(' ').toLowerCase();
                    matchSearch = searchable.includes(searchQ);
                }

                let matchArea = true;
                if (areaQ) {
                    matchArea = u.prefecture === areaQ || u.birthplace === areaQ;
                }

                // ★変更: OSナンバーでのマッチング判定
                let matchOs = true;
                if (osQ) {
                    matchOs = String(u.osNumber) === String(osQ);
                }
                
                return matchSearch && matchArea && matchOs;
            });

            renderGrid(filtered);
        };

        function renderGrid(users) {
            const grid = document.getElementById('users-grid');
            document.getElementById('result-count').textContent = users.length;

            if (users.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-brand-400 py-12 bg-[#fffdf9] rounded-sm border border-brand-200 border-dashed">該当する乗客が見つかりません。条件を変えてみてください。</div>';
                return;
            }

            let html = '';
            users.forEach(u => {
                const name = u.name || u.userId || '名無し';
                const job = u.jobTitle || '職業未設定';
                const loc = u.prefecture || '拠点未設定';
                const tags = (u.skills || []).slice(0, 3).map(t => `<span class="bg-[#f7f5f0] border border-brand-200 text-brand-600 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest truncate max-w-full">#${t}</span>`).join('');
                
                const hiddenBadge = u.isHidden ? '<div class="absolute top-1 sm:top-2 right-1 sm:right-2 bg-red-600 text-white text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm font-bold z-10"><i class="fa-solid fa-eye-slash sm:mr-1"></i><span class="hidden sm:inline">非公開</span></div>' : '';
                const rankBadge = getRankBadge(u.membershipRank);

                let iconHtml = '';
                if (u.photoURL) {
                    iconHtml = `
                    <img src="${u.photoURL}" class="w-16 h-16 rounded-full sm:rounded-sm border-2 border-[#fffdf9] bg-[#fffdf9] object-cover shadow-sm group-hover:scale-105 transition-transform relative z-10" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                    <div class="hidden w-16 h-16 rounded-full sm:rounded-sm border-2 border-[#fffdf9] bg-brand-50 flex items-center justify-center shadow-sm text-brand-300 group-hover:scale-105 transition-transform relative z-10">
                        <i class="fa-solid fa-anchor text-2xl"></i>
                    </div>`;
                } else {
                    iconHtml = `
                    <div class="w-16 h-16 rounded-full sm:rounded-sm border-2 border-[#fffdf9] bg-brand-50 flex items-center justify-center shadow-sm text-brand-300 group-hover:scale-105 transition-transform relative z-10">
                        <i class="fa-solid fa-anchor text-2xl"></i>
                    </div>`;
                }

                html += `
                <a href="user.html?uid=${u.id || u.userId}" class="block bg-[#fffdf9] rounded-sm shadow-sm border border-brand-200 hover:shadow-md transition-shadow hover:border-brand-400 group relative overflow-hidden">
                    ${hiddenBadge}
                    
                    <!-- 背景のヘッダー帯 -->
                    <div class="h-10 sm:h-16 bg-gradient-to-r from-[#dcd4c6] to-[#eae5d8] w-full border-b border-brand-200"></div>
                    
                    <div class="px-2 sm:px-5 pb-3 sm:pb-5">
                        
                        <!-- アイコンとバッジの行 -->
                        <div class="-mt-8 mb-2 sm:mb-3 flex flex-col sm:flex-row justify-between items-center sm:items-end relative">
                            ${iconHtml}
                            <div class="absolute -bottom-2 sm:relative sm:bottom-0 z-20">
                                ${rankBadge}
                            </div>
                        </div>
                        
                        <!-- テキスト情報 -->
                        <div class="text-center sm:text-left mt-3 sm:mt-0">
                            <h3 class="font-bold text-brand-900 text-xs sm:text-lg truncate font-serif tracking-wide group-hover:text-brand-600 transition-colors">${name}</h3>
                            <p class="text-[9px] sm:text-xs text-brand-500 truncate mb-0 sm:mb-3 tracking-widest">${job}</p>
                            
                            <!-- PCのみ表示する詳細情報 -->
                            <div class="hidden sm:block">
                                <div class="flex items-center gap-2 text-xs text-brand-600 mb-3">
                                    <i class="fa-solid fa-map-pin text-brand-300"></i>
                                    <span class="truncate">${loc}</span>
                                </div>
                                <div class="flex flex-wrap gap-1.5 h-[48px] overflow-hidden">
                                    ${tags}
                                </div>
                            </div>
                        </div>
                    </div>
                </a>
                `;
            });
            grid.innerHTML = html;
        }

        function getRankBadge(rank) {
            if (!rank || rank === 'arrival') return '';
            
            const badgeClasses = "text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm font-bold tracking-widest shadow-sm whitespace-nowrap flex items-center";
            
            if (rank === 'settler') return `<span class="bg-brand-100 text-brand-700 border border-brand-300 ${badgeClasses}"><i class="fa-solid fa-house sm:mr-1 text-brand-500"></i><span class="hidden sm:inline">SETTLER</span></span>`;
            if (rank === 'builder') return `<span class="bg-brand-200 text-brand-800 border border-brand-400 ${badgeClasses}"><i class="fa-solid fa-hammer sm:mr-1 text-brand-600"></i><span class="hidden sm:inline">BUILDER</span></span>`;
            if (rank === 'guardian') return `<span class="bg-brand-300 text-[#fffdf9] border border-brand-500 ${badgeClasses}"><i class="fa-solid fa-gavel sm:mr-1"></i><span class="hidden sm:inline">GUARDIAN</span></span>`;
            if (rank === 'covenant' || rank === 'admin') return `<span class="bg-[#3e2723] text-[#d4af37] border border-[#b8860b] ${badgeClasses}"><i class="fa-solid fa-shield-halved sm:mr-1"></i><span class="hidden sm:inline">COVENANT</span></span>`;
            return '';
        }