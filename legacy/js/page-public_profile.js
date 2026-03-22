import { app, auth, db, appId } from "./firebase-config.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // ▼ Firebase Config
        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('uid');

        // OSテーマカラーの定義
        const THEME_COLORS = {
            '甲': { bg: '#041208', main: '#10B981', sub: '#34D399' },
            '乙': { bg: '#08140B', main: '#34D399', sub: '#6EE7B7' },
            '丙': { bg: '#1A0808', main: '#EF4444', sub: '#FCA5A5' },
            '丁': { bg: '#180B05', main: '#F97316', sub: '#FDBA74' },
            '戊': { bg: '#171105', main: '#D97706', sub: '#FCD34D' },
            '己': { bg: '#141208', main: '#B45309', sub: '#FDE047' },
            '庚': { bg: '#080A0F', main: '#94A3B8', sub: '#CBD5E1' },
            '辛': { bg: '#0B0D14', main: '#CBD5E1', sub: '#F1F5F9' },
            '壬': { bg: '#050A14', main: '#3B82F6', sub: '#93C5FD' },
            '癸': { bg: '#060913', main: '#C5A880', sub: '#3B82F6' }
        };

        // OSカバーの読み込みと描画
        async function loadAndRenderOSCover(osNumber) {
            if (!osNumber) return;
            
            try {
                const docRef = doc(db, 'artifacts', appId, 'os_blueprints', String(osNumber));
                const docSnap = await getDoc(docRef);
                
                let osData;
                if (docSnap.exists()) {
                    osData = docSnap.data();
                } else if (String(osNumber) === '50') {
                    osData = { jukkan: "癸", kanji: "黒雨", ruby: "KOKUU" }; // フォールバック
                } else {
                    return;
                }
                
                applyOSCover(osData);
            } catch (e) {
                console.error("OS Data load error:", e);
            }
        }

        function applyOSCover(osData) {
            const cover = document.getElementById('profile-cover');
            const bgLayer = document.getElementById('os-cover-bg-layer');
            const content = document.getElementById('os-cover-content');
            const rubyEl = document.getElementById('os-ruby');
            const kanjiEl = document.getElementById('os-kanji');
            
            if (!cover || !bgLayer || !content || !rubyEl || !kanjiEl) return;
            
            const theme = THEME_COLORS[osData.jukkan] || THEME_COLORS['癸'];
            
            cover.classList.remove('cover-gradient');
            cover.style.borderColor = theme.main;
            
            bgLayer.style.backgroundColor = theme.bg;
            bgLayer.style.backgroundImage = `radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, ${theme.bg} 100%)`;
            
            rubyEl.textContent = osData.ruby;
            rubyEl.style.color = theme.sub;
            
            kanjiEl.textContent = osData.kanji;
            kanjiEl.style.color = '#ffffff';
            kanjiEl.style.textShadow = `0 0 15px ${theme.main}`;
            
            content.classList.remove('hidden');
        }

        function resetOSCover() {
            const cover = document.getElementById('profile-cover');
            const bgLayer = document.getElementById('os-cover-bg-layer');
            const content = document.getElementById('os-cover-content');
            
            if (cover) {
                cover.classList.add('cover-gradient');
                cover.style.borderColor = '';
            }
            if (bgLayer) {
                bgLayer.style.backgroundColor = '';
                bgLayer.style.backgroundImage = '';
            }
            if (content) {
                content.classList.add('hidden');
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            if (!targetUid) {
                showError();
                return;
            }

            try {
                // Publicデータのみを取得 (ログイン・認証不要)
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    if (data.isHidden) {
                        showError("このプロフィールは非公開に設定されています。");
                        return;
                    }

                    renderProfile(data);
                } else {
                    showError();
                }
            } catch (error) {
                console.error(error);
                showError("データの取得に失敗しました。");
            }
        });

        function showError(msg) {
            document.getElementById('loading-container').classList.add('hidden');
            const errEl = document.getElementById('error-container');
            errEl.classList.remove('hidden');
            if (msg) errEl.querySelector('p').textContent = msg;
        }

        function formatText(text) {
            if (!text) return '';
            const textStr = String(text).replace(/__(.*?)__/g, '<u>$1</u>');
            let rawHtml = '';
            try {
                if (window.marked) rawHtml = window.marked.parse(textStr, { breaks: true, gfm: true });
                else rawHtml = textStr.replace(/\n/g, '<br>');
            } catch (e) { rawHtml = textStr.replace(/\n/g, '<br>'); }
            return window.DOMPurify.sanitize(rawHtml, { 
                ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
            });
        }

        function setElText(id, text) { const el = document.getElementById(id); if(el) el.textContent = text || '-'; }
        function setElHtml(id, html) { const el = document.getElementById(id); if(el) el.innerHTML = html || ''; }

        function renderProfile(data) {
            document.getElementById('loading-container').classList.add('hidden');
            document.getElementById('profile-content').classList.remove('hidden');

            setElText('profile-name', data.name || data.userId || '名称未設定');
            setElText('profile-id', '@' + (data.userId || '-'));
            setElText('profile-job', data.jobTitle || '職業未設定');
            
            let locStr = '-';
            if(data.prefecture && data.birthplace) locStr = `${data.prefecture} (出身: ${data.birthplace})`;
            else if (data.prefecture) locStr = data.prefecture;
            else if (data.birthplace) locStr = `出身: ${data.birthplace}`;
            setElText('profile-location', locStr);

            if (data.photoURL) {
                const img = document.getElementById('header-icon-img');
                img.src = data.photoURL;
                img.classList.remove('hidden');
                document.getElementById('header-icon-placeholder').classList.add('hidden');
            }

            // ★ OSカバーの表示判定 (充実度100%以上のときのみ)
            const score = data.profileScore || 0;
            if (score >= 100 && data.osNumber) {
                loadAndRenderOSCover(data.osNumber);
            } else {
                resetOSCover();
            }

            // ランクバッジ
            const rank = data.membershipRank || 'arrival';
            const badgeEl = document.getElementById('rank-badge');
            if (badgeEl) {
                badgeEl.classList.remove('hidden');
                if (rank === 'covenant') { badgeEl.classList.add('badge-covenant'); badgeEl.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i>COVENANT'; } 
                else if (rank === 'guardian') { badgeEl.classList.add('badge-guardian'); badgeEl.innerHTML = '<i class="fa-solid fa-gavel mr-1"></i>GUARDIAN'; } 
                else if (rank === 'builder') { badgeEl.classList.add('badge-builder'); badgeEl.innerHTML = '<i class="fa-solid fa-hammer mr-1"></i>BUILDER'; } 
                else if (rank === 'settler') { badgeEl.classList.add('badge-settler'); badgeEl.innerHTML = '<i class="fa-solid fa-house mr-1"></i>SETTLER'; } 
                else { badgeEl.classList.add('badge-arrival'); badgeEl.innerHTML = '<i class="fa-solid fa-anchor mr-1"></i>ARRIVAL'; }
            }

            // SNS Links
            const snsContainer = document.getElementById('profile-sns-links');
            if (snsContainer && (data.websiteUrl || data.snsInstagram || data.snsX)) {
                if (data.websiteUrl) snsContainer.innerHTML += `<a href="${data.websiteUrl}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><i class="fa-solid fa-globe"></i></a>`;
                if (data.snsInstagram) snsContainer.innerHTML += `<a href="${data.snsInstagram.startsWith('http') ? data.snsInstagram : 'https://instagram.com/'+data.snsInstagram}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><i class="fa-brands fa-instagram"></i></a>`;
                if (data.snsX) snsContainer.innerHTML += `<a href="${data.snsX.startsWith('http') ? data.snsX : 'https://twitter.com/'+data.snsX}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><i class="fa-brands fa-x-twitter"></i></a>`;
            }

            // Bio
            if (data.bio) {
                document.getElementById('section-bio').classList.remove('hidden');
                setElHtml('profile-bio', formatText(data.bio));
            }

            // Message
            if (data.message) {
                document.getElementById('section-message').classList.remove('hidden');
                setElHtml('profile-message', formatText(data.message));
            }

            // Goals
            if (data.goals) {
                document.getElementById('section-goals').classList.remove('hidden');
                setElHtml('profile-goals', formatText(data.goals));
            }

            // Matching
            const canOfferArray = Array.isArray(data.canOffer) ? data.canOffer : [];
            const lookingForArray = Array.isArray(data.lookingFor) ? data.lookingFor : [];
            
            if (canOfferArray.length > 0 || lookingForArray.length > 0) {
                document.getElementById('section-matching').classList.remove('hidden');
                
                const canOfferList = document.getElementById('list-can-offer');
                if (canOfferArray.length > 0) {
                    canOfferList.innerHTML = canOfferArray.map(item => `<li class="flex items-start text-sm text-brand-700"><i class="fa-solid fa-check text-[#8b6a4f] mr-2 mt-1"></i><span>${item}</span></li>`).join('');
                } else {
                    canOfferList.innerHTML = '<li class="text-brand-300 italic text-sm">未設定</li>';
                }

                const lookingForList = document.getElementById('list-looking-for');
                if (lookingForArray.length > 0) {
                    lookingForList.innerHTML = lookingForArray.map(item => `<li class="flex items-start text-sm text-brand-700"><i class="fa-solid fa-magnifying-glass text-[#8b6a4f] mr-2 mt-1"></i><span>${item}</span></li>`).join('');
                } else {
                    lookingForList.innerHTML = '<li class="text-brand-300 italic text-sm">未設定</li>';
                }
            }

            // Tags (Skills / Hobbies)
            const skillsArray = Array.isArray(data.skills) ? data.skills : [];
            const hobbiesArray = Array.isArray(data.hobbies) ? data.hobbies : [];
            
            if (skillsArray.length > 0 || hobbiesArray.length > 0) {
                document.getElementById('section-tags').classList.remove('hidden');
                
                const skillsContainer = document.getElementById('skills-container');
                if (skillsArray.length > 0) {
                    skillsContainer.innerHTML = skillsArray.map(tag => `<span class="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`).join('');
                } else {
                    skillsContainer.innerHTML = '<span class="text-sm text-brand-300 italic">未設定</span>';
                }

                const hobbiesContainer = document.getElementById('hobbies-container');
                if (hobbiesArray.length > 0) {
                    hobbiesContainer.innerHTML = hobbiesArray.map(tag => `<span class="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`).join('');
                } else {
                    hobbiesContainer.innerHTML = '<span class="text-sm text-brand-300 italic">未設定</span>';
                }
            }

            // Career
            const careerArray = Array.isArray(data.career) ? data.career : [];
            if (careerArray.length > 0) {
                document.getElementById('section-career').classList.remove('hidden');
                const careerContainer = document.getElementById('career-container');
                
                careerArray.forEach(c => {
                    const formattedDesc = formatText(c.description || '');
                    careerContainer.innerHTML += `
                        <div class="relative pl-6 pb-2">
                            <div class="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-[#fffdf9] z-10 shadow-sm border border-brand-300"></div>
                            <h4 class="font-bold text-brand-900 text-base font-serif tracking-widest">${c.company || '会社名不明'}</h4>
                            <div class="flex items-center gap-2 mb-3 mt-1">
                                <span class="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-sm tracking-widest border border-brand-200">${c.role || '役割'}</span>
                                <span class="text-xs text-brand-400 font-medium tracking-widest">${c.start || '?'} 〜 ${c.end || '現在'}</span>
                            </div>
                            <div class="prose prose-sm max-w-none prose-stone text-brand-700 bg-brand-50 p-4 rounded-sm border border-brand-100 shadow-sm">${formattedDesc}</div>
                        </div>
                    `;
                });
            }
        }