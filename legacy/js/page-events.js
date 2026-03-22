import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

        // ▼▼▼▼ Firebase Config ▼▼▼▼
        let map;
        let markers = [];
        let allEvents = [];
        let allJobs = [];
        let currentUser = null;
        let myProfile = null;
        let userLocation = null; 
        let isAdmin = false; 
        
        let currentViewMode = 'map'; 

        // Form States
        let tempMarker = null; 
        let selectedCoordsEvent = null;
        let selectedCoordsJob = null;
        let currentAdjustType = null; 

        let selectedTags = new Set();
        let isJoining = false;
        let editingEventId = null;
        let editingJobId = null;

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        const presetTags = ["交流会", "勉強会", "スポーツ", "音楽", "アート", "グルメ", "アウトドア", "ビジネス", "初心者歓迎", "オンライン"];
        
        let redIcon, blueIcon;

        // 複数画像管理用の配列 (プレビューURLを安全に保持)
        let currentEventImageUrls = [];
        let currentEventImageFiles = []; // 構造を { file: File, preview: String } に変更

        // SP Menu Toggle ---
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

        // Leafletアイコンの安全な初期化
        function initLeafletIcons() {
            if (typeof L !== 'undefined' && !redIcon) {
                redIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                });

                blueIcon = new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                });
            }
        }

        // ---------------------------------------------------------
        // Safe DOM Getter Helper
        // ---------------------------------------------------------
        const getVal = (id, defaultVal = '') => {
            const el = document.getElementById(id);
            return el ? el.value : defaultVal;
        };
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        // --- ★修正: マークダウン対応フォーマット関数（エラー回避・堅牢化） ---
        function formatText(text) {
            if (!text) return '';
            const textStr = String(text);
            let processedText = textStr.replace(/__(.*?)__/g, '<u>$1</u>');

            let rawHtml = '';
            try {
                if (window.marked && typeof window.marked.parse === 'function') {
                    // URL自動リンク化(gfm: true)と改行反映(breaks: true)を有効化
                    rawHtml = window.marked.parse(processedText, { breaks: true, gfm: true });
                } else if (typeof window.marked === 'function') {
                    rawHtml = window.marked(processedText, { breaks: true, gfm: true });
                } else {
                    rawHtml = processedText.replace(/\n/g, '<br>');
                }
            } catch (e) {
                console.error("Markdown Parse Error:", e);
                rawHtml = processedText.replace(/\n/g, '<br>'); 
            }
            
            let sanitizedHtml = rawHtml;
            try {
                if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                    sanitizedHtml = window.DOMPurify.sanitize(rawHtml, { 
                        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre', 'hr'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
                    });
                }
            } catch (e) {
                console.error("DOMPurify Error:", e);
            }

            try {
                // 生成されたリンク(aタグ)にtarget="_blank"とrel="noopener noreferrer"を付与して安全性を確保し、はみ出し防止クラスを付与
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sanitizedHtml;
                tempDiv.querySelectorAll('a').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    a.classList.add('break-all', 'text-brand-500', 'underline', 'hover:text-brand-700');
                });
                return tempDiv.innerHTML;
            } catch (e) {
                console.error("Link Formatting Error:", e);
                return sanitizedHtml;
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            initLeafletIcons();
            initMap();
            renderEventTagButtons();
            initFilterOptions();
            
            // Search Input Binding
            const pcSearch = document.getElementById('pc-map-search');
            const mobileSearch = document.getElementById('map-search-input');
            const handleSearch = (e) => {
                const val = e.target.value;
                if(pcSearch && pcSearch.value !== val) pcSearch.value = val;
                if(mobileSearch && mobileSearch.value !== val) mobileSearch.value = val;
                filterData();
            };
            if(pcSearch) pcSearch.addEventListener('input', handleSearch);
            if(mobileSearch) mobileSearch.addEventListener('input', handleSearch);

            const startDateInput = document.getElementById('event-start-date');
            const endDateInput = document.getElementById('event-end-date');
            if(startDateInput && endDateInput){
                startDateInput.addEventListener('change', () => {
                    if (!endDateInput.value) endDateInput.value = startDateInput.value;
                });
            }
            
            // 画面の初期ロード完了時にマップの再描画を強制する
            setTimeout(() => {
                switchView('map');
            }, 300);
        });

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myProfile = { name: '管理者', userId: 'admin', membershipRank: 'covenant' };
                updateNavForAuth(true);
                loadAllData();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (docSnap.exists()) {
                        myProfile = docSnap.data();
                        if (myProfile.userId === 'admin') isAdmin = true;
                    } else {
                        myProfile = { membershipRank: 'arrival' };
                    }
                } catch (e) { 
                    console.error("Profile Fetch Error:", e); 
                    myProfile = { membershipRank: 'arrival' };
                }
                updateNavForAuth(true);
                loadAllData();
            } else {
                currentUser = null;
                myProfile = null;
                isAdmin = false;
                updateNavForAuth(false);
                // 未ログインでもデータは表示する
                loadAllData();
            }
        });

        function updateNavForAuth(isLoggedIn) {
            document.querySelectorAll('.auth-required').forEach(el => {
                el.style.display = isLoggedIn ? '' : 'none';
            });
            const authText = document.getElementById('nav-auth-text');
            const authIcon = document.getElementById('nav-auth-icon');
            if (authText && authIcon) {
                if (isLoggedIn) {
                    authText.textContent = '下船する';
                    authIcon.className = 'fa-solid fa-right-from-bracket text-lg';
                } else {
                    authText.textContent = '乗船する';
                    authIcon.className = 'fa-solid fa-right-to-bracket text-lg';
                }
            }
        }

        window.handleAuthAction = () => {
            if (currentUser || isAdminMock) {
                if (isAdminMock) localStorage.removeItem('isAdminMock');
                signOut(auth);
                window.location.reload(); 
            } else {
                window.location.href = 'login.html';
            }
        };

        window.copyToClipboard = (text, msg = 'URLをコピーしました！') => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; 
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                const notif = document.getElementById('notification');
                if(notif) {
                    document.getElementById('notif-message').textContent = msg;
                    notif.classList.remove('hidden', 'translate-y-20');
                    setTimeout(() => notif.classList.add('translate-y-20'), 3000);
                    setTimeout(() => notif.classList.add('hidden'), 3300);
                } else {
                    alert(msg);
                }
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                alert('コピーに失敗しました。');
            }
            document.body.removeChild(textArea);
        };

        // イベント共有用の関数を追加
        window.shareEvent = (eventId) => {
            const evt = allEvents.find(e => e.id === eventId);
            if(!evt) return;
            
            const shareUrl = `${window.location.origin}${window.location.pathname}?eventId=${evt.id}`;
            const inviterName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
            const inviterId = myProfile ? myProfile.userId : '';
            
            const title = evt.title || '名称未設定';
            const loc = evt.isOnline ? (evt.locationName || 'オンライン') : (evt.locationName || '未設定');
            const price = Number(evt.price || 0) > 0 ? `¥${Number(evt.price).toLocaleString()}` : '無料';
            
            let desc = evt.description || '';
            if (desc.length > 80) {
                desc = desc.substring(0, 80) + '...以降は詳細へ';
            }
            
            const registerUrl = `https://noonealonehere.pages.dev/register.html?ref=${inviterId}`;
            
            const text = `${inviterName}さんにイベント招待されました。\n■${title}\n■${loc}\n■${price}\n■${desc}\n${shareUrl}\n\n―――\n\nNOAHに参加していない方は以下のリンクからユーザー登録をしてから参加ボタンを押してください。\n${registerUrl}`;
            
            copyToClipboard(text, 'イベントの招待文をコピーしました！');
        };

        // ==========================================
        // View Switcher & Core Load
        // ==========================================
        window.switchView = (viewName) => {
            currentViewMode = viewName;
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]');
                btn.classList.add('bg-[#fffdf9]', 'text-brand-700', 'border-transparent');
            });
            const activeBtn = document.getElementById(`tab-${viewName}`);
            if(activeBtn) {
                activeBtn.classList.remove('bg-[#fffdf9]', 'text-brand-700', 'border-transparent');
                activeBtn.classList.add('active', 'bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]');
            }

            const mapEl = document.getElementById('view-map');
            const evListEl = document.getElementById('view-list-events');
            const jobListEl = document.getElementById('view-list-jobs');

            if(mapEl) mapEl.classList.add('hidden');
            if(evListEl) evListEl.classList.add('hidden');
            if(jobListEl) jobListEl.classList.add('hidden');

            const viewEl = document.getElementById(`view-${viewName}`);
            if(viewEl) viewEl.classList.remove('hidden');

            if (viewName === 'map' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
            
            const placeholderText = viewName === 'list-jobs' ? "仕事や依頼を検索..." : "イベントや仕事を検索...";
            const pcSearch = document.getElementById('pc-map-search');
            const mapSearch = document.getElementById('map-search-input');
            if(pcSearch) pcSearch.placeholder = placeholderText;
            if(mapSearch) mapSearch.placeholder = placeholderText;
        };

        async function loadAllData() {
            const evLoad = document.getElementById('event-list-loading');
            const jobLoad = document.getElementById('job-list-loading');
            const evCont = document.getElementById('event-list-container');
            const jobCont = document.getElementById('job-list-container');
            const evEmp = document.getElementById('event-list-empty');
            const jobEmp = document.getElementById('job-list-empty');

            if(evLoad) evLoad.classList.remove('hidden');
            if(jobLoad) jobLoad.classList.remove('hidden');
            if(evCont) evCont.classList.add('hidden');
            if(jobCont) jobCont.classList.add('hidden');
            if(evEmp) evEmp.classList.add('hidden');
            if(jobEmp) jobEmp.classList.add('hidden');

            try {
                await loadEvents();
            } catch(e) { console.error("Event error:", e); }
            
            try {
                await loadJobs();
            } catch(e) { console.error("Job error:", e); }
            
            filterData();

            // URLパラメータをチェックして特定のイベントを開く
            const urlParams = new URLSearchParams(window.location.search);
            const targetEventId = urlParams.get('eventId');
            const targetJobId = urlParams.get('jobId');
            
            if (targetEventId) {
                switchView('list-events');
                setTimeout(() => { window.showEventSheetById(targetEventId); }, 500);
            } else if (targetJobId) {
                switchView('list-jobs');
                setTimeout(() => { window.showJobSheetById(targetJobId); }, 500);
            }
        }

        // ==========================================
        // Filter Logic
        // ==========================================
        function initFilterOptions() {
            const container = document.getElementById('filter-event-tags');
            if(!container) return;
            presetTags.forEach(tag => {
                const label = document.createElement('label');
                label.className = 'cursor-pointer';
                label.innerHTML = `
                    <input type="checkbox" value="${tag}" class="event-filter-tag hidden">
                    <div class="px-2 py-1 rounded-sm border border-brand-200 text-xs text-brand-700 hover:bg-[#fffdf9] transition-colors select-none tracking-widest shadow-sm bg-white">${tag}</div>
                `;
                container.appendChild(label);
            });
        }

        window.toggleFilters = () => {
            const panel = document.getElementById('filter-panel');
            const content = document.getElementById('filter-content');
            
            const eventSec = document.getElementById('filter-section-event');
            const jobSec = document.getElementById('filter-section-job');
            const title = document.getElementById('filter-title');
            
            if (currentViewMode === 'list-jobs') {
                if(eventSec) eventSec.classList.add('hidden');
                if(jobSec) jobSec.classList.remove('hidden');
                if(title) title.textContent = '仕事・依頼の絞り込み';
            } else {
                if(eventSec) eventSec.classList.remove('hidden');
                if(jobSec) jobSec.classList.add('hidden');
                if(title) title.textContent = 'イベントの絞り込み';
            }

            if (panel && panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                setTimeout(() => { 
                    panel.classList.remove('opacity-0'); 
                    if(content) content.classList.remove('translate-x-full'); 
                }, 10);
            } else if(panel) {
                panel.classList.add('opacity-0');
                if(content) content.classList.add('translate-x-full');
                setTimeout(() => panel.classList.add('hidden'), 300);
            }
        };

        window.applyFilters = () => {
            filterData(); 
            toggleFilters();
        };

        window.resetFilters = () => {
            try {
                if (currentViewMode === 'list-jobs') {
                    setVal('filter-job-type', "");
                    setVal('filter-job-category', "");
                    setVal('filter-job-workstyle', "");
                    setVal('filter-job-reward', "");
                } else {
                    setVal('filter-event-date', "all");
                    setVal('filter-event-format', "all");
                    setVal('filter-event-price', "all");
                    document.querySelectorAll('.event-filter-tag').forEach(cb => cb.checked = false);
                }
                setVal('pc-map-search', "");
                setVal('map-search-input', "");
                
                filterData();
                toggleFilters();
            } catch(e){
                console.error("Reset Filters Error: ", e);
            }
        };

        function filterData() {
            try {
                const pcSearchEl = document.getElementById('pc-map-search');
                const moSearchEl = document.getElementById('map-search-input');
                const term = ((pcSearchEl ? pcSearchEl.value : '') || (moSearchEl ? moSearchEl.value : '')).toLowerCase();
                
                // --- Event Filter ---
                const dateVal = getVal('filter-event-date', 'all');
                const formatVal = getVal('filter-event-format', 'all');
                const priceVal = getVal('filter-event-price', 'all');
                const selectedTagsArr = Array.from(document.querySelectorAll('.event-filter-tag:checked')).map(cb => cb.value);

                const now = new Date();
                const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                const filteredEvents = allEvents.filter(evt => {
                    const title = evt.title || '';
                    const desc = evt.description || evt.desc || '';
                    const matchTerm = !term || title.toLowerCase().includes(term) || desc.toLowerCase().includes(term);
                    
                    let matchDate = true;
                    if (dateVal !== 'all' && evt.startDate) {
                        const evtDate = new Date(evt.startDate);
                        if (dateVal === 'today') {
                            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                            matchDate = (evt.startDate === todayStr);
                        }
                        else if (dateVal === 'week') matchDate = (!isNaN(evtDate) && evtDate <= nextWeek);
                        else if (dateVal === 'month') matchDate = (!isNaN(evtDate) && evtDate <= nextMonth);
                    }

                    let matchFormat = true;
                    if (formatVal === 'offline') matchFormat = !evt.isOnline;
                    if (formatVal === 'online') matchFormat = !!evt.isOnline;

                    let matchPrice = true;
                    const priceNum = Number(evt.price || 0);
                    if (priceVal === 'free') matchPrice = (priceNum === 0);
                    if (priceVal === 'paid') matchPrice = (priceNum > 0);

                    const matchTags = selectedTagsArr.length === 0 || (evt.tags && selectedTagsArr.every(tag => evt.tags.includes(tag)));

                    return matchTerm && matchDate && matchFormat && matchPrice && matchTags;
                });

                // --- Job Filter ---
                const type = getVal('filter-job-type');
                const cat = getVal('filter-job-category');
                const style = getVal('filter-job-workstyle');
                const rew = getVal('filter-job-reward');

                const filteredJobs = allJobs.filter(job => {
                    const title = job.title || '';
                    const desc = job.desc || '';
                    const matchTerm = !term || title.toLowerCase().includes(term) || desc.toLowerCase().includes(term);
                    const matchType = !type || job.type === type;
                    const matchCat = !cat || job.category === cat;
                    const matchStyle = !style || job.workStyle === style;
                    const matchRew = !rew || job.rewardType === rew;
                    return matchTerm && matchType && matchCat && matchStyle && matchRew;
                });

                renderMarkers(filteredEvents, filteredJobs);
                renderEventList(filteredEvents);
                renderJobList(filteredJobs);
            } catch(e) {
                console.error("Filter Data Error: ", e);
            }
        }

        // ==========================================
        // Map & Event List Logic
        // ==========================================
        function initMap() {
            const mapEl = document.getElementById('map');
            if(!mapEl) return;

            if (typeof L === 'undefined') {
                setTimeout(initMap, 500); 
                return;
            }

            initLeafletIcons();
            
            // すでに初期化されている場合はスキップ
            if (map != undefined) return;

            map = L.map('map', { zoomControl: false }).setView([35.6895, 139.6917], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                        map.setView([userLocation.lat, userLocation.lng], 13);
                        filterData(); 
                    },
                    (error) => {
                        console.log("Location access denied or error");
                        filterData(); 
                    }
                );
            } else {
                filterData();
            }
        }

        async function loadEvents() {
            const nowIso = new Date().toISOString(); 
            const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
            
            try {
                const snapshot = await getDocs(eventsRef);
                allEvents = [];
                
                const safeGetTime = (createdAt) => {
                    if (!createdAt) return 0;
                    if (createdAt.toMillis) return createdAt.toMillis();
                    return new Date(createdAt).getTime() || 0;
                };

                snapshot.forEach(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    if (data.endTimestamp && data.endTimestamp < nowIso) return; 
                    allEvents.push(data);
                });

                allEvents.sort((a, b) => safeGetTime(b.createdAt) - safeGetTime(a.createdAt));
            } catch (e) {
                console.error("Event Load Error:", e);
            }
        }

        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        function renderEventList(eventsToRender) {
            const container = document.getElementById('event-list-container');
            const emptyMsg = document.getElementById('event-list-empty');
            const loadingMsg = document.getElementById('event-list-loading');
            
            if(loadingMsg) loadingMsg.classList.add('hidden');
            
            if (!eventsToRender || eventsToRender.length === 0) {
                if(container){
                    container.innerHTML = '';
                    container.classList.add('hidden');
                }
                if(emptyMsg) emptyMsg.classList.remove('hidden');
                return;
            }
            
            if(emptyMsg) emptyMsg.classList.add('hidden');
            if(container) container.classList.remove('hidden');

            let displayEvents = [...eventsToRender];
            
            if (userLocation) {
                displayEvents.forEach(e => {
                    if(e.lat && e.lng) e._distance = calculateDistance(userLocation.lat, userLocation.lng, e.lat, e.lng);
                    else e._distance = 99999; 
                });
                displayEvents.sort((a, b) => a._distance - b._distance);
                const statusEl = document.getElementById('event-list-status');
                if(statusEl) statusEl.textContent = '現在地から近い順';
            } else {
                const statusEl = document.getElementById('event-list-status');
                if(statusEl) statusEl.textContent = '新着順';
            }

            container.innerHTML = '';
            displayEvents.forEach(evt => renderEventItem(container, evt));
        }

        function renderEventItem(container, evt) {
            const thumb = evt.thumbnailUrl || 'https://via.placeholder.com/150?text=NOAH';
            const imageCountBadge = (evt.imageUrls && evt.imageUrls.length > 1) 
                ? `<div class="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 z-10"><i class="fa-regular fa-images"></i>${evt.imageUrls.length}</div>` 
                : '';

            const distStr = evt._distance !== undefined && evt._distance < 99999 ? `<span class="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-sm ml-2 text-[10px] font-bold"><i class="fa-solid fa-location-arrow mr-1"></i>${evt._distance.toFixed(1)}km</span>` : '';
            
            const dateStr = (evt.startDate === evt.endDate) 
                ? `${evt.startDate || ''} ${evt.startTime || ''}`
                : `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endDate || ''} ${evt.endTime || ''}`;

            const tags = evt.tags ? evt.tags.slice(0,2).map(t => `<span class="text-[10px] bg-[#f7f5f0] border border-brand-200 text-brand-600 px-1 rounded-sm">#${t}</span>`).join('') : '';

            const el = document.createElement('div');
            el.className = 'flex bg-[#fffdf9] border border-brand-200 rounded-sm overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-shadow h-28';
            el.onclick = () => showEventSheetById(evt.id);

            el.innerHTML = `
                <div class="w-28 h-full flex-shrink-0 relative border-r border-brand-100">
                    <img src="${thumb}" class="w-full h-full object-cover">
                    ${imageCountBadge}
                </div>
                <div class="p-3 flex flex-col justify-between flex-1 min-w-0">
                    <div>
                        <h3 class="font-bold text-sm text-brand-900 truncate font-serif tracking-widest">${evt.title || '名称未設定'}</h3>
                        <p class="text-[10px] text-brand-500 mt-1 flex items-center truncate"><i class="fa-regular fa-clock mr-1"></i>${dateStr} ${distStr}</p>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex gap-1 overflow-hidden">${tags}</div>
                        <span class="text-[10px] font-bold ${evt.price > 0 ? 'text-[#b8860b]' : 'text-brand-600'}">${evt.price > 0 ? '¥'+Number(evt.price).toLocaleString() : '無料'}</span>
                    </div>
                </div>
            `;
            container.appendChild(el);
        }

        function renderMarkers(eventsToRender = [], jobsToRender = []) {
            if (!map || typeof L === 'undefined') return;
            initLeafletIcons();

            markers.forEach(m => map.removeLayer(m));
            markers = [];
            
            // Events (Red)
            eventsToRender.forEach(data => {
                if (data.lat && data.lng) {
                    const marker = L.marker([data.lat, data.lng], {icon: redIcon}).addTo(map);
                    marker.on('click', () => {
                        window.showEventSheetById(data.id);
                    });
                    markers.push(marker);
                }
            });

            // Jobs (Blue)
            jobsToRender.forEach(data => {
                if (data.lat && data.lng) {
                    const marker = L.marker([data.lat, data.lng], {icon: blueIcon}).addTo(map);
                    marker.on('click', () => {
                        window.showJobSheetById(data.id);
                    });
                    markers.push(marker);
                }
            });
        }

        // ==========================================
        // Job List Logic
        // ==========================================
        async function loadJobs() {
            const jobsRef = collection(db, 'artifacts', appId, 'public', 'data', 'jobs');
            try {
                const snapshot = await getDocs(jobsRef);
                allJobs = [];
                
                const safeGetTime = (createdAt) => {
                    if (!createdAt) return 0;
                    if (createdAt.toMillis) return createdAt.toMillis();
                    return new Date(createdAt).getTime() || 0;
                };

                snapshot.forEach(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    allJobs.push(data);
                });
                
                allJobs.sort((a, b) => safeGetTime(b.createdAt) - safeGetTime(a.createdAt));
            } catch (e) { console.error("Job Load Error:", e); }
        }

        function renderJobList(jobsToRender) {
            const container = document.getElementById('job-list-container');
            const emptyMsg = document.getElementById('job-list-empty');
            const loadingMsg = document.getElementById('job-list-loading');
            
            if(loadingMsg) loadingMsg.classList.add('hidden');
            
            if (!jobsToRender || jobsToRender.length === 0) {
                if(container){
                    container.innerHTML = '';
                    container.classList.add('hidden');
                }
                if(emptyMsg) emptyMsg.classList.remove('hidden');
                return;
            }
            
            if(emptyMsg) emptyMsg.classList.add('hidden');
            if(container) container.classList.remove('hidden');

            container.innerHTML = jobsToRender.map(job => {
                const badgeColor = job.type === '正社員' ? 'bg-[#3e2723] text-[#d4af37]' : 'bg-brand-50 text-brand-600 border border-brand-200';
                
                let displayDate = '';
                if (job.createdAt) {
                    if (job.createdAt.toMillis) displayDate = new Date(job.createdAt.toMillis()).toLocaleDateString();
                    else displayDate = new Date(job.createdAt).toLocaleDateString();
                }

                return `
                <div class="bg-[#fffdf9] border border-brand-200 rounded-sm p-4 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer relative" onclick="showJobSheetById('${job.id}')">
                    <div class="absolute top-0 right-0 w-8 h-8 border-t border-r border-brand-200 m-2"></div>
                    <div class="flex justify-between items-start mb-2 pr-4">
                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-widest ${badgeColor}">${job.type || '未設定'}</span>
                        <span class="text-[10px] text-brand-400"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${displayDate}</span>
                    </div>
                    <h3 class="font-bold text-brand-900 font-serif tracking-widest leading-tight mb-2">${job.title || '名称未設定'}</h3>
                    <p class="text-xs text-brand-500 line-clamp-2 leading-relaxed mb-3">${job.desc || ''}</p>
                    <div class="flex flex-wrap gap-x-4 gap-y-2 border-t border-brand-100 pt-3">
                        <div class="text-[10px] font-bold text-brand-700 tracking-widest"><i class="fa-solid fa-yen-sign text-brand-400 mr-1"></i>${job.rewardType || '応相談'}: ${job.rewardAmount || ''}</div>
                        <div class="text-[10px] font-bold text-brand-700 tracking-widest"><i class="fa-solid fa-location-dot text-brand-400 mr-1"></i>${job.locationName || job.location || '-'}</div>
                        <div class="text-[10px] font-bold text-brand-700 tracking-widest"><i class="fa-solid fa-building text-brand-400 mr-1"></i>${job.company || job.organizerName || ''}</div>
                    </div>
                </div>
                `;
            }).join('');
        }

        // ==========================================
        // FAB & Menus & Modal Management
        // ==========================================
        window.toggleCreateMenu = () => {
            const menu = document.getElementById('create-menu');
            const icon = document.getElementById('fab-icon');
            if(!menu || !icon) return;

            if (menu.classList.contains('menu-closed')) {
                menu.classList.remove('menu-closed');
                menu.classList.add('menu-open');
                icon.style.transform = 'rotate(45deg)';
            } else {
                menu.classList.add('menu-closed');
                menu.classList.remove('menu-open');
                icon.style.transform = 'rotate(0deg)';
            }
        };

        window.openCreateModal = (type, existingData = null) => {
            toggleCreateMenu(); 
            
            if (!currentUser && !isAdminMock) {
                if (confirm('募集や企画を行うには乗船（ログイン）が必要です。\nログイン画面に移動しますか？')) {
                    window.location.href = 'login.html';
                }
                return;
            }

            if (!myProfile) myProfile = { membershipRank: 'arrival' };
            const rank = myProfile.membershipRank || 'arrival';

            if (type === 'event') {
                if (rank === 'arrival' && !isAdminMock && !isAdmin) {
                    alert('イベント企画は SETTLER 以上の機能です。契約変更をご検討ください。');
                    return;
                }
                
                const modal = document.getElementById('event-modal');
                if(modal) modal.classList.remove('hidden');
                
                if (isAdmin) {
                    const overrideSec = document.getElementById('admin-override-section-event');
                    if (overrideSec) overrideSec.classList.remove('hidden');
                }
                setVal('event-override-userid', '');

                editingEventId = existingData ? existingData.id : null;
                const titleEl = document.getElementById('event-modal-title');
                if(titleEl) titleEl.textContent = existingData ? 'イベントを編集' : 'イベントを企画';
                
                const btnEl = document.getElementById('event-submit-btn');
                if(btnEl) btnEl.innerHTML = existingData ? '<i class="fa-solid fa-pen mr-2"></i>イベントを更新する' : 'イベントを企画する';

                try {
                    setVal('event-title', existingData?.title || "");
                    setVal('event-price', existingData?.price || "0");
                    const todayStr = new Date().toISOString().split('T')[0];
                    setVal('event-start-date', existingData?.startDate || todayStr);
                    setVal('event-end-date', existingData?.endDate || todayStr);
                    setVal('event-start-time', existingData?.startTime || "");
                    setVal('event-end-time', existingData?.endTime || "");
                    setVal('event-desc', existingData?.description || existingData?.desc || "");
                    
                    const pubPart = document.getElementById('event-public-participants');
                    if(pubPart) pubPart.checked = existingData ? (existingData.isParticipantsPublic !== false) : true;
                    
                    selectedTags = new Set(existingData?.tags || []);
                    const customTags = (existingData?.tags || []).filter(t => !presetTags.includes(t));
                    setVal('event-custom-tags', customTags.join(', '));
                    renderEventTagButtons();
                    checkOnlineToggle();

                    if (existingData?.isOnline) {
                        setVal('event-online-tool', existingData.locationName ? existingData.locationName.replace("オンライン (", "").replace(")", "") : "");
                        setVal('event-online-url', existingData.onlineUrl || "");
                        setVal('event-location-name', "");
                        selectedCoordsEvent = null;
                    } else {
                        setVal('event-online-tool', "");
                        setVal('event-online-url', "");
                        setVal('event-location-name', existingData?.locationName || "");
                        selectedCoordsEvent = (existingData?.lat && existingData?.lng) ? { lat: existingData.lat, lng: existingData.lng } : null;
                    }

                    setVal('location-search-input', "");
                    const locRes = document.getElementById('location-results');
                    if(locRes) locRes.classList.add('hidden');
                    
                    if (existingData?.imageUrls && Array.isArray(existingData.imageUrls)) {
                        currentEventImageUrls = [...existingData.imageUrls];
                    } else if (existingData?.thumbnailUrl) {
                        currentEventImageUrls = [existingData.thumbnailUrl]; 
                    } else {
                        currentEventImageUrls = [];
                    }
                    
                    currentEventImageFiles.forEach(item => URL.revokeObjectURL(item.preview));
                    currentEventImageFiles = [];
                    renderEventImagePreviews();

                    if (tempMarker && map) map.removeLayer(tempMarker);
                    if (selectedCoordsEvent && typeof L !== 'undefined' && map) {
                        initLeafletIcons();
                        tempMarker = L.marker(selectedCoordsEvent, { draggable: true, icon: redIcon }).addTo(map);
                        tempMarker.on('dragend', function(e) { selectedCoordsEvent = e.target.getLatLng(); });
                    }
                } catch(e) { console.log(e); }

            } else if (type === 'job') {
                if (rank !== 'covenant' && rank !== 'guardian' && rank !== 'builder' && !isAdminMock && !isAdmin) {
                    alert('仕事・依頼の掲載は BUILDER 以上の機能です。契約変更をご検討ください。');
                    return;
                }
                
                const modal = document.getElementById('job-modal');
                if(modal) modal.classList.remove('hidden');
                const cont = document.getElementById('job-form-container');
                if(cont) cont.scrollTop = 0;

                if (isAdmin) {
                    const overrideSec = document.getElementById('admin-override-section-job');
                    if (overrideSec) overrideSec.classList.remove('hidden');
                }
                setVal('job-override-userid', ''); // フィールドを初期化

                editingJobId = existingData ? existingData.id : null;
                const titleEl = document.getElementById('job-modal-title');
                if(titleEl) titleEl.textContent = existingData ? '仕事・依頼を編集' : '仕事・依頼を掲載';
                
                const btnEl = document.getElementById('job-submit-btn');
                if(btnEl) btnEl.innerHTML = existingData ? '<i class="fa-solid fa-pen mr-2"></i>募集情報を更新する' : '募集を掲載する';
                
                try {
                    setVal('job-title', existingData?.title || "");
                    setVal('job-type', existingData?.type || "業務委託");
                    setVal('job-category', existingData?.category || "デザイン");
                    setVal('job-desc', existingData?.desc || "");
                    setVal('job-reward-type', existingData?.rewardType || "固定報酬");
                    setVal('job-reward-amount', existingData?.rewardAmount || "");
                    setVal('job-period', existingData?.period || "単発");
                    setVal('job-work-style', existingData?.workStyle || "フルリモート");
                    setVal('job-location', existingData?.location || "");
                    setVal('job-location-name', existingData?.locationName || "");
                    setVal('job-location-search-input', "");
                    setVal('job-skills', existingData?.skills || "");
                    setVal('job-deadline', existingData?.deadline || "");
                    setVal('job-flow', existingData?.flow || "面談1回");
                    setVal('job-company', existingData?.company || "");
                    setVal('job-url', existingData?.url || "");
                    
                    selectedCoordsJob = (existingData?.lat && existingData?.lng) ? { lat: existingData.lat, lng: existingData.lng } : null;

                    if (tempMarker && map) map.removeLayer(tempMarker);
                    if (selectedCoordsJob && typeof L !== 'undefined' && map) {
                        initLeafletIcons();
                        tempMarker = L.marker(selectedCoordsJob, { draggable: true, icon: blueIcon }).addTo(map);
                        tempMarker.on('dragend', function(e) { selectedCoordsJob = e.target.getLatLng(); });
                    }

                    toggleJobLocationUI();
                } catch(e){ console.log(e); }
            }
        };

        window.closeCreateModal = (type) => {
            const modal = document.getElementById(`${type}-modal`);
            if(modal) modal.classList.add('hidden');
            
            if (type === 'event') {
                currentEventImageFiles.forEach(item => URL.revokeObjectURL(item.preview));
                currentEventImageFiles = [];
                currentEventImageUrls = [];
                renderEventImagePreviews();
            }
        };

        // ==========================================
        // Shared Map Location Methods
        // ==========================================
        window.searchLocation = async (type) => {
            const inputId = type === 'event' ? 'event-location-search-input' : 'job-location-search-input';
            const query = getVal(inputId);
            if (!query) return;

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const results = await response.json();
                
                const listId = type === 'event' ? 'event-location-results' : 'job-location-results';
                const list = document.getElementById(listId);
                if(!list) return;
                list.innerHTML = '';
                list.classList.remove('hidden');

                if (results.length === 0) { 
                    list.innerHTML = '<div class="p-3 text-[10px] text-brand-500 tracking-widest leading-tight">見つかりませんでした。<br>※番地や建物名で出ない場合は、市区町村で検索し、地図上でピンを動かして調整してください。</div>'; 
                    return; 
                }

                results.forEach(place => {
                    const div = document.createElement('div');
                    div.className = 'p-3 border-b border-brand-100 cursor-pointer text-xs text-brand-700 hover:bg-brand-50 tracking-widest truncate';
                    div.textContent = place.display_name;
                    div.onclick = () => selectLocation(type, place);
                    list.appendChild(div);
                });
            } catch (e) { alert('検索エラーが発生しました'); }
        };

        function selectLocation(type, place) {
            const listId = type === 'event' ? 'event-location-results' : 'job-location-results';
            const nameInputId = type === 'event' ? 'event-location-name' : 'job-location-name';
            const icon = type === 'event' ? redIcon : blueIcon;

            const coords = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
            if (type === 'event') selectedCoordsEvent = coords; else selectedCoordsJob = coords;

            const listEl = document.getElementById(listId);
            if(listEl) listEl.classList.add('hidden');
            setVal(nameInputId, place.display_name.split(',')[0]);
            
            if (tempMarker && map) map.removeLayer(tempMarker);
            if (typeof L !== 'undefined' && map) {
                initLeafletIcons();
                tempMarker = L.marker(coords, { draggable: true, icon: icon }).addTo(map);
                tempMarker.on('dragend', function(e) { 
                    if (type === 'event') selectedCoordsEvent = e.target.getLatLng(); 
                    else selectedCoordsJob = e.target.getLatLng(); 
                });
                map.flyTo(coords, 15);
            }
        }

        window.startLocationAdjust = (type) => {
            currentAdjustType = type;
            
            if (typeof L === 'undefined' || !map) return alert("マップの読み込みに失敗しました");
            initLeafletIcons();

            if (type === 'event' && !selectedCoordsEvent) {
                const center = map.getCenter();
                selectedCoordsEvent = { lat: center.lat, lng: center.lng };
                if (tempMarker) map.removeLayer(tempMarker);
                tempMarker = L.marker(selectedCoordsEvent, { draggable: true, icon: redIcon }).addTo(map);
                tempMarker.on('dragend', function(e) { selectedCoordsEvent = e.target.getLatLng(); });
            }
            if (type === 'job' && !selectedCoordsJob) {
                const center = map.getCenter();
                selectedCoordsJob = { lat: center.lat, lng: center.lng };
                if (tempMarker) map.removeLayer(tempMarker);
                tempMarker = L.marker(selectedCoordsJob, { draggable: true, icon: blueIcon }).addTo(map);
                tempMarker.on('dragend', function(e) { selectedCoordsJob = e.target.getLatLng(); });
            }

            const evtMod = document.getElementById('event-modal');
            const jobMod = document.getElementById('job-modal');
            const ui = document.getElementById('adjust-location-ui');
            
            if (type === 'event' && evtMod) evtMod.classList.add('hidden');
            if (type === 'job' && jobMod) jobMod.classList.add('hidden');
            if (ui) ui.classList.remove('hidden');
            
            switchView('map');
            if (map) map.invalidateSize();
        };

        window.finishLocationAdjust = () => {
            const ui = document.getElementById('adjust-location-ui');
            if(ui) ui.classList.add('hidden');
            
            if (currentAdjustType === 'event') {
                const mod = document.getElementById('event-modal');
                if(mod) mod.classList.remove('hidden');
            }
            if (currentAdjustType === 'job') {
                const mod = document.getElementById('job-modal');
                if(mod) mod.classList.remove('hidden');
            }
            currentAdjustType = null;
        };

        window.toggleJobLocationUI = () => {
            const style = getVal('job-work-style');
            const wrapper = document.getElementById('job-location-wrapper');
            if(!wrapper) return;
            
            if (style === 'フルリモート') {
                wrapper.classList.add('hidden');
            } else {
                wrapper.classList.remove('hidden');
            }
        };

        // ==========================================
        // Event Creation Logic
        // ==========================================
        function renderEventTagButtons() {
            const container = document.getElementById('event-tag-area');
            if(!container) return;
            container.innerHTML = '';
            presetTags.forEach(tag => {
                const btn = document.createElement('button');
                btn.type = "button";
                btn.className = 'tag-btn px-3 py-1 rounded-sm border border-brand-200 text-[10px] font-bold text-brand-600 bg-[#fffdf9] transition-all tracking-widest';
                btn.textContent = tag;
                if(selectedTags.has(tag)) btn.classList.add('selected');

                btn.onclick = () => {
                    if (selectedTags.has(tag)) selectedTags.delete(tag);
                    else selectedTags.add(tag);
                    renderEventTagButtons();
                    checkOnlineToggle();
                };
                container.appendChild(btn);
            });
        }

        function checkOnlineToggle() {
            const offlineGroup = document.getElementById('offline-location-group');
            const onlineGroup = document.getElementById('online-url-group');
            if(!offlineGroup || !onlineGroup) return;

            if (selectedTags.has('オンライン')) {
                offlineGroup.classList.add('hidden');
                onlineGroup.classList.remove('hidden');
            } else {
                offlineGroup.classList.remove('hidden');
                onlineGroup.classList.add('hidden');
            }
        }

        window.handleEventImageSelect = (e) => {
            const files = Array.from(e.target.files);
            if(files.length === 0) return;

            const totalCount = currentEventImageUrls.length + currentEventImageFiles.length + files.length;
            
            if (totalCount > 5) {
                alert('画像は最大5枚までです。');
                return;
            }
            
            files.forEach(file => {
                const preview = URL.createObjectURL(file);
                currentEventImageFiles.push({ file: file, preview: preview });
            });
            
            renderEventImagePreviews();
        };

        window.renderEventImagePreviews = () => {
            const container = document.getElementById('event-image-previews');
            const addBtn = document.getElementById('event-image-add-btn');
            if (!container || !addBtn) return;
            
            let html = '';
            
            // 既存URL
            currentEventImageUrls.forEach((url, idx) => {
                html += `
                    <div class="relative w-20 h-20 rounded-sm border border-brand-200 overflow-hidden shadow-sm shrink-0">
                        <img src="${url}" class="w-full h-full object-cover">
                        <button type="button" onclick="removeEventImageUrl(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                    </div>
                `;
            });
            
            // 新規ファイル
            currentEventImageFiles.forEach((item, idx) => {
                html += `
                    <div class="relative w-20 h-20 rounded-sm border border-brand-200 overflow-hidden shadow-sm shrink-0">
                        <img src="${item.preview}" class="w-full h-full object-cover">
                        <button type="button" onclick="removeEventImageFile(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                        <div class="absolute bottom-0 left-0 w-full bg-brand-500 text-white text-[8px] text-center font-bold tracking-widest py-0.5">NEW</div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            if (currentEventImageUrls.length + currentEventImageFiles.length >= 5) {
                addBtn.classList.add('hidden');
            } else {
                addBtn.classList.remove('hidden');
            }
        };

        window.removeEventImageUrl = (idx) => {
            currentEventImageUrls.splice(idx, 1);
            renderEventImagePreviews();
        };

        window.removeEventImageFile = (idx) => {
            currentEventImageFiles.splice(idx, 1);
            renderEventImagePreviews();
        };

        window.submitEvent = async () => {
            if (!currentUser) return;
            const btn = document.getElementById('event-submit-btn');
            
            try {
                const title = getVal('event-title');
                const priceStr = getVal('event-price');
                const price = priceStr ? parseInt(priceStr) : 0;
                const startDate = getVal('event-start-date');
                const startTime = getVal('event-start-time');
                const endDate = getVal('event-end-date');
                const endTime = getVal('event-end-time');
                
                const isOnline = selectedTags.has('オンライン');

                if (!title || !startDate || !startTime || !endDate || !endTime) return alert('タイトルと日時は必須です');
                if (!isOnline && !selectedCoordsEvent) return alert('オフライン開催の場合は場所を設定してください');

                if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>送信中...';
                if(btn) btn.disabled = true;

                let finalImageUrls = [...currentEventImageUrls];
                
                if (currentEventImageFiles.length > 0 && !isAdminMock) {
                    try {
                        for (let i = 0; i < currentEventImageFiles.length; i++) {
                            const item = currentEventImageFiles[i];
                            const file = item.file;
                            
                            if (file.size > 5 * 1024 * 1024) {
                                throw new Error(`画像「${file.name}」のサイズが大きすぎます (上限5MB)。`);
                            }
                            
                            if(btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>画像をアップロード中 (${i+1}/${currentEventImageFiles.length})...`;
                            
                            const ext = file.name.split('.').pop() || 'jpg';
                            const safeFileName = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.' + ext;
                            
                            const snap = await uploadBytes(ref(storage, `events/${currentUser.uid}/${safeFileName}`), file);
                            const url = await getDownloadURL(snap.ref);
                            finalImageUrls.push(url);
                        }
                    } catch (e) {
                        console.error(e);
                        alert("画像のアップロードに失敗しました:\n" + e.message);
                        if(btn) { btn.innerHTML = editingEventId ? '<i class="fa-solid fa-pen mr-2"></i>イベントを更新する' : 'イベントを企画する'; btn.disabled = false; }
                        return; // 中断
                    }
                } else if (currentEventImageFiles.length > 0 && isAdminMock) {
                    finalImageUrls.push(...currentEventImageFiles.map(f => 'https://via.placeholder.com/640x360?text=Mock+Image'));
                }

                if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>データを保存中...';

                // 代表サムネイル（一覧表示用）は1枚目の画像
                let thumbnailUrl = null;
                if (finalImageUrls.length > 0) {
                    thumbnailUrl = finalImageUrls[0];
                }

                const customTagsStr = getVal('event-custom-tags');
                const customTags = customTagsStr ? customTagsStr.split(',').map(s=>s.trim()).filter(s=>s) : [];
                const finalTags = [...Array.from(selectedTags), ...customTags];
                
                let finalOrganizerId = currentUser.uid;
                let finalOrganizerName = (myProfile && (myProfile.name || myProfile.userId)) || '主催者';
                
                if (editingEventId) {
                    const oldEvt = allEvents.find(e => e.id === editingEventId);
                    if (oldEvt) {
                        finalOrganizerId = oldEvt.organizerId || finalOrganizerId;
                        finalOrganizerName = oldEvt.organizerName || finalOrganizerName;
                    }
                }

                const overrideUserIdInput = document.getElementById('event-override-userid');
                const overrideUserId = overrideUserIdInput ? overrideUserIdInput.value.trim() : '';

                if (isAdmin && overrideUserId && !isAdminMock) {
                    try {
                        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                        const q = query(usersRef, where("userId", "==", overrideUserId));
                        const querySnapshot = await getDocs(q);
                        
                        if (querySnapshot.empty) {
                            alert(`エラー: 指定されたユーザーID「@${overrideUserId}」は見つかりませんでした。\n正しいIDを指定するか、空欄にしてやり直してください。`);
                            if(btn) { btn.innerHTML = editingEventId ? '<i class="fa-solid fa-pen mr-2"></i>イベントを更新する' : 'イベントを企画する'; btn.disabled = false; }
                            return;
                        }
                        
                        const targetDoc = querySnapshot.docs[0];
                        finalOrganizerId = targetDoc.id;
                        const tData = targetDoc.data();
                        finalOrganizerName = tData.name || tData.userId;
                    } catch (error) {
                        console.error("Override fetch error:", error);
                        alert("代理投稿ユーザーの取得中にエラーが発生しました。");
                        if(btn) { btn.innerHTML = editingEventId ? '<i class="fa-solid fa-pen mr-2"></i>イベントを更新する' : 'イベントを企画する'; btn.disabled = false; }
                        return;
                    }
                }

                let descVal = getVal('event-desc');
                let publicParts = true;
                const ppEl = document.getElementById('event-public-participants');
                if(ppEl) publicParts = ppEl.checked;

                const eventData = {
                    title: title, price: price,
                    startDate: startDate, startTime: startTime, endDate: endDate, endTime: endTime,
                    endTimestamp: new Date(`${endDate}T${endTime}`).toISOString(),
                    description: descVal,
                    tags: finalTags, 
                    thumbnailUrl: thumbnailUrl, 
                    imageUrls: finalImageUrls, 
                    organizerId: finalOrganizerId,
                    organizerName: finalOrganizerName,
                    isParticipantsPublic: publicParts,
                    updatedAt: serverTimestamp()
                };

                if (!editingEventId) {
                    eventData.createdAt = serverTimestamp();
                    eventData.participantCount = 0;
                }

                if (isOnline) {
                    eventData.isOnline = true;
                    eventData.locationName = "オンライン (" + (getVal('event-online-tool', "ツール未定")) + ")";
                    eventData.onlineUrl = getVal('event-online-url', "");
                    eventData.lat = null; eventData.lng = null;
                } else {
                    eventData.isOnline = false;
                    eventData.locationName = getVal('event-location-name', "場所名未設定");
                    eventData.lat = selectedCoordsEvent.lat; eventData.lng = selectedCoordsEvent.lng;
                }
                
                if (isAdminMock) {
                    alert('【テスト】イベントを保存しました！(モックデータ)');
                } else {
                    if (editingEventId) {
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', editingEventId), eventData);
                        alert('イベントを更新しました！');
                    } else {
                        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), eventData);
                        alert('イベントを企画しました！');
                    }
                }
                closeCreateModal('event');
                closeDetail('event');
                
                // 投稿成功後に画像データをクリアする
                currentEventImageFiles.forEach(item => URL.revokeObjectURL(item.preview));
                currentEventImageUrls = [];
                currentEventImageFiles = [];
                renderEventImagePreviews();

                await loadAllData(); 
            } catch (e) {
                console.error("Submit Event Error:", e);
                alert('処理に失敗しました。\nエラー: ' + e.message);
            } finally {
                if(btn) { 
                    btn.innerHTML = editingEventId ? '<i class="fa-solid fa-pen mr-2"></i>イベントを更新する' : 'イベントを企画する'; 
                    btn.disabled = false; 
                }
            }
        };

        // ==========================================
        // Job Create Logic
        // ==========================================
        window.submitJob = async () => {
            if (!currentUser) return;
            const btn = document.getElementById('job-submit-btn');

            try {
                const title = getVal('job-title');
                const desc = getVal('job-desc');
                const style = getVal('job-work-style', '指定なし');

                if (!title || !desc) return alert('必須項目(タイトル・詳細)を入力してください');
                if (style !== 'フルリモート' && !selectedCoordsJob) return alert('勤務地・活動場所をマップで検索して設定してください');

                let finalOrganizerId = currentUser.uid;
                let finalOrganizerName = (myProfile && (myProfile.name || myProfile.userId)) || '投稿者';
                let finalOrganizerAvatar = (myProfile && myProfile.photoURL) || null;
                
                if (editingJobId) {
                    const oldJob = allJobs.find(j => j.id === editingJobId);
                    if (oldJob) {
                        finalOrganizerId = oldJob.organizerId || finalOrganizerId;
                        finalOrganizerName = oldJob.organizerName || finalOrganizerName;
                        finalOrganizerAvatar = oldJob.organizerAvatar || finalOrganizerAvatar;
                    }
                }

                const overrideUserIdInput = document.getElementById('job-override-userid');
                const overrideUserId = overrideUserIdInput ? overrideUserIdInput.value.trim() : '';

                if (isAdmin && overrideUserId && !isAdminMock) {
                    try {
                        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                        const q = query(usersRef, where("userId", "==", overrideUserId));
                        const querySnapshot = await getDocs(q);
                        
                        if (querySnapshot.empty) {
                            alert(`エラー: 指定されたユーザーID「@${overrideUserId}」は見つかりませんでした。\n正しいIDを指定するか、空欄にしてやり直してください。`);
                            if(btn) btn.textContent = editingJobId ? "募集情報を更新する" : "募集を掲載する";
                            return;
                        }
                        
                        const targetDoc = querySnapshot.docs[0];
                        finalOrganizerId = targetDoc.id;
                        const tData = targetDoc.data();
                        finalOrganizerName = tData.name || tData.userId;
                        finalOrganizerAvatar = tData.photoURL || null;
                    } catch (error) {
                        console.error("Override fetch error:", error);
                        alert("代理投稿ユーザーの取得中にエラーが発生しました。");
                        if(btn) btn.textContent = editingJobId ? "募集情報を更新する" : "募集を掲載する";
                        return;
                    }
                }

                const jobData = {
                    title: title, 
                    type: getVal('job-type', 'その他'), 
                    category: getVal('job-category', 'その他'), 
                    desc: desc,
                    rewardType: getVal('job-reward-type', '応相談'),
                    rewardAmount: getVal('job-reward-amount', ''),
                    period: getVal('job-period', '期間未定'),
                    workStyle: style,
                    location: getVal('job-location', ''), 
                    skills: getVal('job-skills', ''),
                    deadline: getVal('job-deadline', ''),
                    flow: getVal('job-flow', 'その他'),
                    company: getVal('job-company', ''),
                    url: getVal('job-url', ''),
                    
                    organizerId: finalOrganizerId,
                    organizerName: finalOrganizerName,
                    organizerAvatar: finalOrganizerAvatar,
                    updatedAt: serverTimestamp(),
                };

                if (!editingJobId) {
                    jobData.createdAt = serverTimestamp();
                }

                if (style === 'フルリモート') {
                    jobData.locationName = "フルリモート";
                    jobData.lat = null; jobData.lng = null;
                } else {
                    jobData.locationName = getVal('job-location-name', '場所名未設定');
                    jobData.lat = selectedCoordsJob.lat; jobData.lng = selectedCoordsJob.lng;
                }

                if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>送信中...';
                if (isAdminMock) {
                    alert('【テスト】仕事・依頼を保存しました！(モックデータ)');
                } else {
                    if (editingJobId) {
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', editingJobId), jobData);
                        alert('仕事・依頼を更新しました！');
                    } else {
                        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), jobData);
                        alert('仕事・依頼を掲載しました！');
                    }
                }
                closeCreateModal('job');
                closeDetail('job');
                await loadAllData(); 
                switchView('list-jobs'); 
            } catch (e) {
                console.error("Submit Job Error:", e);
                alert('処理に失敗しました。\nエラー: ' + e.message);
            } finally {
                if(btn) btn.innerHTML = editingJobId ? '<i class="fa-solid fa-pen mr-2"></i>募集情報を更新する' : '募集を掲載する';
            }
        };

        // ==========================================
        // Details Sheets Display & Participation
        // ==========================================
        window.showEventSheetById = (id) => {
            const evt = allEvents.find(e => e.id === id);
            if(evt) showEventSheet(evt);
        };
        window.showJobSheetById = (id) => {
            const job = allJobs.find(j => j.id === id);
            if(job) showJobSheet(job);
        };

        // スライドショー操作関数
        window.moveEventSlide = (id, dir) => {
            const container = document.getElementById(`event-slider-${id}`);
            if (container) {
                container.scrollBy({ left: dir * container.clientWidth, behavior: 'smooth' });
            }
        };

        window.updateSlideDots = (container, id, total) => {
            const index = Math.round(container.scrollLeft / container.clientWidth);
            const dotsContainer = document.getElementById(`event-slider-dots-${id}`);
            if (dotsContainer) {
                Array.from(dotsContainer.children).forEach((dot, i) => {
                    if (i === index) {
                        dot.className = "w-1.5 h-1.5 rounded-full bg-white scale-125 transition-all shadow-sm";
                    } else {
                        dot.className = "w-1.5 h-1.5 rounded-full bg-white/50 transition-all shadow-sm";
                    }
                });
            }
        };

        // フルスクリーン画像表示関数
        window.openFullscreenImage = (url) => {
            const modal = document.getElementById('fullscreen-image-modal');
            const img = document.getElementById('fullscreen-image');
            if(modal && img) {
                img.src = url;
                modal.classList.remove('hidden');
            }
        };

        window.closeFullscreenImage = () => {
            const modal = document.getElementById('fullscreen-image-modal');
            if(modal) modal.classList.add('hidden');
        };

        window.showEventSheet = async (evt) => {
            const sheet = document.getElementById('event-sheet');
            const content = document.getElementById('event-sheet-content');
            if(!sheet || !content) return;

            let sliderHtml = '';
            let images = evt.imageUrls || (evt.thumbnailUrl ? [evt.thumbnailUrl] : ['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=640&auto=format&fit=crop']);
            const priceNum = Number(evt.price || 0);
            const priceText = priceNum > 0 ? `¥${priceNum.toLocaleString()}` : '無料';

            if (images.length <= 1) {
                sliderHtml = `
                <div class="relative h-48 sm:h-64 w-full rounded-sm overflow-hidden mb-4 shadow-sm border border-brand-200">
                    <img src="${images[0]}" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onclick="openFullscreenImage('${images[0]}')">
                    <div class="absolute top-2 right-2 bg-[#3e2723]/80 backdrop-blur text-[#d4af37] px-3 py-1 rounded-sm text-xs font-bold tracking-widest border border-[#b8860b] shadow-sm z-10 pointer-events-none">${priceText}</div>
                </div>`;
            } else {
                let slides = images.map((url, i) => `
                    <div class="w-full h-full flex-shrink-0 snap-center relative cursor-pointer group" onclick="openFullscreenImage('${url}')">
                        <img src="${url}" class="w-full h-full object-cover group-hover:opacity-90 transition-opacity">
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div class="bg-black/50 text-white rounded-full p-3"><i class="fa-solid fa-expand"></i></div>
                        </div>
                    </div>
                `).join('');
                
                let dots = images.map((_, i) => `<div class="w-1.5 h-1.5 rounded-full ${i===0?'bg-white scale-125':'bg-white/50'} transition-all shadow-sm" id="slide-dot-${evt.id}-${i}"></div>`).join('');
                
                sliderHtml = `
                <div class="relative h-48 sm:h-64 w-full rounded-sm overflow-hidden mb-4 shadow-sm border border-brand-200 group">
                    <div id="event-slider-${evt.id}" class="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar" onscroll="updateSlideDots(this, '${evt.id}', ${images.length})">
                        ${slides}
                    </div>
                    <!-- 矢印ボタン -->
                    <button onclick="moveEventSlide('${evt.id}', -1)" class="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"><i class="fa-solid fa-chevron-left text-sm ml-[-2px]"></i></button>
                    <button onclick="moveEventSlide('${evt.id}', 1)" class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"><i class="fa-solid fa-chevron-right text-sm ml-[2px]"></i></button>
                    <!-- ドットインジケーター -->
                    <div class="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none" id="event-slider-dots-${evt.id}">
                        ${dots}
                    </div>
                    <div class="absolute top-2 right-2 bg-[#3e2723]/80 backdrop-blur text-[#d4af37] px-3 py-1 rounded-sm text-xs font-bold tracking-widest border border-[#b8860b] shadow-sm z-10 pointer-events-none">${priceText}</div>
                </div>`;
            }

            const tags = evt.tags ? evt.tags.map(t => `<span class="bg-brand-50 border border-brand-200 text-brand-600 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest">#${t}</span>`).join('') : '';
            
            const dateStr = (evt.startDate === evt.endDate) 
                    ? `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endTime || ''}`
                    : `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endDate || ''} ${evt.endTime || ''}`;

            let locHtml = evt.isOnline 
                ? `<div class="flex items-center gap-3"><i class="fa-solid fa-laptop text-brand-400 w-4 text-center"></i><span class="tracking-widest">${evt.locationName || 'オンライン'}</span></div>
                   ${evt.onlineUrl ? `<div class="flex items-center gap-3 mt-2"><i class="fa-solid fa-link text-brand-400 w-4 text-center"></i><a href="${evt.onlineUrl}" target="_blank" class="text-blue-600 underline truncate tracking-widest text-xs">${evt.onlineUrl}</a></div>` : ''}`
                : `<div class="flex items-center gap-3"><i class="fa-solid fa-location-dot text-brand-400 w-4 text-center"></i><span class="tracking-widest">${evt.locationName || '未設定'}</span></div>`;

            // イベント共有ボタン
            const shareBtn = `
                <div class="flex gap-2 mb-4">
                    <button onclick="shareEvent('${evt.id}')" class="flex-1 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-sm font-bold text-xs tracking-widest hover:bg-brand-100 transition-colors shadow-sm">
                        <i class="fa-solid fa-share-nodes mr-1"></i> イベント招待文をコピー
                    </button>
                </div>
            `;

            // 主催者リンクの保護（未ログイン時はloginへ）
            const organizerLinkAction = currentUser 
                ? `window.location.href='user.html?uid=${evt.organizerId}'` 
                : `if(confirm('プロフィールを見るにはログインが必要です。ログイン画面へ移動しますか？')) window.location.href='login.html'`;

            // ★修正: マークダウン対応フォーマット関数を使用して詳細を表示
            content.innerHTML = `
                ${sliderHtml}
                ${shareBtn}
                <h2 class="text-xl font-bold text-brand-900 leading-tight mb-3 font-serif tracking-widest">${evt.title || '名称未設定'}</h2>
                <div class="flex flex-wrap gap-2 mb-5">${tags}</div>
                <div class="space-y-3 text-xs text-brand-800 bg-[#fffdf9] p-4 rounded-sm mb-5 border border-brand-200 shadow-sm relative">
                    <div class="absolute top-0 right-0 w-6 h-6 border-t border-r border-brand-300 m-1"></div>
                    <div class="flex items-center gap-3"><i class="fa-regular fa-clock text-brand-400 w-4 text-center"></i><span class="tracking-widest">${dateStr}</span></div>
                    ${locHtml}
                    <div class="flex items-center gap-3 pt-2 border-t border-brand-100 cursor-pointer group" onclick="${organizerLinkAction}">
                        <i class="fa-solid fa-user text-brand-400 w-4 text-center"></i>
                        <span class="tracking-widest text-brand-600 font-bold group-hover:underline">主催: ${evt.organizerName || '不明'}</span>
                    </div>
                </div>
                <div class="mb-6">
                    <h3 class="font-bold text-brand-900 mb-2 text-xs font-serif tracking-widest border-b border-brand-200 pb-1">詳細</h3>
                    <div class="prose prose-sm max-w-none text-brand-700 leading-relaxed text-xs break-words overflow-wrap-anywhere">
                        ${formatText(evt.description || evt.desc || '詳細はありません')}
                    </div>
                </div>
                <div id="event-dynamic-area"><div class="text-center text-brand-400 py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i> 情報を読み込み中...</div></div>
            `;
            sheet.classList.remove('hidden', 'sheet-closed');
            sheet.classList.add('sheet-open');

            // Async Fetch Participants & Join Status
            let isJoined = false;
            let partsHtml = '';
            let participants = [];
            
            if (isAdminMock) {
                participants = ['user1', 'user2']; // Dummy
            } else {
                try {
                    const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events', evt.id, 'participants');
                    const partsSnap = await getDocs(partsRef);
                    partsSnap.forEach(d => participants.push(d.id));
                    
                    if (currentUser) {
                        isJoined = participants.includes(currentUser.uid);
                    }
                } catch(e) {
                    console.error("Parts fetch error:", e);
                }
            }

            const isOrganizer = currentUser && currentUser.uid === evt.organizerId;
            const dynArea = document.getElementById('event-dynamic-area');
            if(!dynArea) return;

            if (evt.isParticipantsPublic || isOrganizer || isAdmin) {
                if (participants.length === 0) {
                    partsHtml = '<div class="text-[10px] text-brand-500">まだ参加者はいません</div>';
                } else {
                    partsHtml = '<div class="flex -space-x-2 overflow-hidden py-1 pl-1">';
                    
                    // 各参加者の公開情報を取得し、アイコン表示可能か判定する
                    const participantDataPromises = participants.map(async (uid) => {
                        let avatarUrl = 'https://via.placeholder.com/32?text=U';
                        let isVisible = true;
                        
                        if (!isAdminMock) {
                            try {
                                const uDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
                                if(uDoc.exists()) {
                                    const data = uDoc.data();
                                    if(data.photoURL) avatarUrl = data.photoURL;
                                    
                                    // 主催者と管理者は常に表示
                                    if (uid === evt.organizerId || isAdmin) {
                                        isVisible = true;
                                    } else {
                                        // 検索非公開（無料会員含む）のユーザーはアイコン非表示
                                        if (data.isHidden === true) {
                                            isVisible = false;
                                        }
                                    }
                                } else {
                                    isVisible = false;
                                }
                            } catch(e){
                                isVisible = false;
                            }
                        }
                        return { uid, avatarUrl, isVisible };
                    });

                    const resolvedParticipants = await Promise.all(participantDataPromises);
                    const visibleList = resolvedParticipants.filter(p => p.isVisible);

                    let count = 0;
                    for (const p of visibleList) {
                        if (count >= 6) break;
                        const userLinkAction = currentUser ? `window.location.href='user.html?uid=${p.uid}'` : `if(confirm('プロフィールを見るにはログインが必要です。ログイン画面へ移動しますか？')) window.location.href='login.html'`;
                        partsHtml += `<div onclick="${userLinkAction}" class="cursor-pointer inline-block h-8 w-8 rounded-full ring-2 ring-[#fffdf9] bg-brand-100 border border-brand-300 flex items-center justify-center overflow-hidden hover:scale-110 transition-transform"><img src="${p.avatarUrl}" class="w-full h-full object-cover"></div>`;
                        count++;
                    }
                    
                    // 全参加者数から、表示したアイコンの数を引いたものを「+〇〇名」として表示
                    const remainingCount = participants.length - count;
                    if (remainingCount > 0) {
                        partsHtml += `<div class="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-[#fffdf9] bg-brand-50 text-[10px] font-bold text-brand-600 border border-brand-200">+${remainingCount}</div>`;
                    }
                    partsHtml += '</div>';
                }
            } else {
                partsHtml = '<div class="text-[10px] text-brand-500 bg-brand-50 px-2 py-1.5 rounded-sm border border-brand-200"><i class="fa-solid fa-lock mr-1"></i>参加者は主催者のみ確認できます</div>';
            }

            const btnHtml = `
                <button onclick="toggleJoinEvent('${evt.id}', ${isJoined})" class="w-full py-3.5 rounded-sm font-bold tracking-widest shadow-md transition-colors ${isJoined ? 'bg-brand-100 text-brand-700 border border-brand-300 hover:bg-brand-200' : 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b] hover:bg-[#2a1a17]'}">
                    ${isJoined ? '参加をキャンセルする' : '航海に参加する'}
                </button>
            `;

            let actionBtns = '';
            if (isOrganizer || isAdmin) {
                const eventJson = JSON.stringify(evt).replace(/'/g, "&apos;");
                actionBtns = `
                    <div class="flex gap-2 mt-3 pt-4 border-t border-brand-200">
                        <button onclick='openCreateModal("event", ${eventJson})' class="flex-1 py-2 rounded-sm text-brand-700 font-bold border border-brand-200 hover:bg-brand-50 transition-colors text-xs tracking-widest bg-white shadow-sm">
                            <i class="fa-solid fa-pen mr-1"></i> 編集
                        </button>
                        <button onclick="deleteEvent('${evt.id}')" class="flex-1 py-2 rounded-sm text-red-700 font-bold border border-brand-200 hover:bg-red-50 transition-colors text-xs tracking-widest bg-white shadow-sm">
                            <i class="fa-solid fa-trash mr-1"></i> 削除
                        </button>
                    </div>`;
            }

            dynArea.innerHTML = `
                <div class="mb-6"><h3 class="font-bold text-brand-900 mb-2 text-xs font-serif tracking-widest border-b border-brand-200 pb-1">参加者 (${participants.length}名)</h3>${partsHtml}</div>
                ${btnHtml}
                ${actionBtns}
            `;
        };

        window.toggleJoinEvent = async (eventId, isJoined) => {
            if (!currentUser) {
                if (confirm('参加するには乗船（ログイン）が必要です。\nログイン画面に移動しますか？')) {
                    window.location.href = 'login.html';
                }
                return;
            }
            if (isJoining) return;
            isJoining = true;

            if (isAdminMock) {
                alert('【テスト】参加状況を変更しました');
                isJoining = false;
                const evt = allEvents.find(e => e.id === eventId);
                if (evt) showEventSheet(evt);
                return;
            }

            const partRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId, 'participants', currentUser.uid);
            const myJoinRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'participating_events', eventId);
            
            try {
                if (isJoined) {
                    await deleteDoc(partRef);
                    await deleteDoc(myJoinRef);
                    alert('参加をキャンセルしました');
                } else {
                    const ts = serverTimestamp();
                    await setDoc(partRef, { joinedAt: ts, uid: currentUser.uid });
                    await setDoc(myJoinRef, { joinedAt: ts, eventId: eventId });
                    alert('イベントに参加しました！');
                }
                
                const evt = allEvents.find(e => e.id === eventId);
                if (evt) showEventSheet(evt);

            } catch (e) {
                console.error("Join Event Error:", e);
                alert('エラーが発生しました: ' + e.message);
            } finally {
                isJoining = false;
            }
        };

        window.deleteEvent = async (eventId) => {
            if (!confirm('本当にこのイベントを削除しますか？\nこの操作は取り消せません。')) return;
            if (isAdminMock) return alert("【テスト】削除しました");

            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId));
                alert('イベントを削除しました');
                closeDetail('event');
                await loadAllData(); 
            } catch (e) { alert('削除に失敗しました'); }
        };

        window.showJobSheet = (job) => {
            const sheet = document.getElementById('job-sheet');
            const content = document.getElementById('job-sheet-content');
            if(!sheet || !content) return;
            
            const badgeColor = job.type === '正社員' ? 'bg-[#3e2723] text-[#d4af37]' : 'bg-brand-50 text-brand-600 border border-brand-200';

            const shareUrl = `${window.location.origin}${window.location.pathname}?jobId=${job.id}`;
            const shareBtn = `
                <div class="flex gap-2 mb-4">
                    <button onclick="copyToClipboard('${shareUrl}')" class="flex-1 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-sm font-bold text-xs tracking-widest hover:bg-brand-100 transition-colors shadow-sm">
                        <i class="fa-solid fa-share-nodes mr-1"></i> URLをコピー
                    </button>
                </div>
            `;

            let actionBtns = '';
            const isOrganizer = currentUser && currentUser.uid === job.organizerId;
            if (isOrganizer || isAdmin) {
                const jobJson = JSON.stringify(job).replace(/'/g, "&apos;");
                actionBtns = `
                    <div class="flex gap-2 mt-4 pt-4 border-t border-brand-200">
                        <button onclick='openCreateModal("job", ${jobJson})' class="flex-1 py-2 rounded-sm text-brand-700 font-bold border border-brand-200 hover:bg-brand-50 transition-colors text-xs tracking-widest bg-white shadow-sm">
                            <i class="fa-solid fa-pen mr-1"></i> 編集
                        </button>
                        <button onclick="deleteJob('${job.id}')" class="flex-1 py-2 rounded-sm text-red-700 font-bold border border-brand-200 hover:bg-red-50 transition-colors text-xs tracking-widest bg-white shadow-sm">
                            <i class="fa-solid fa-trash mr-1"></i> 削除
                        </button>
                    </div>`;
            }

            // 主催者リンクの保護
            const organizerLinkAction = currentUser ? `window.location.href='user.html?uid=${job.organizerId}'` : `if(confirm('プロフィールを見るにはログインが必要です。ログイン画面へ移動しますか？')) window.location.href='login.html'`;
            
            // 掲載者プロフィールボタンの保護
            const profileBtn = currentUser 
                ? `<button onclick="window.location.href='user.html?uid=${job.organizerId}'" class="block w-full text-center py-3.5 rounded-sm font-bold tracking-widest shadow-md transition-colors bg-[#3e2723] text-[#d4af37] border border-[#b8860b] hover:bg-[#2a1a17]">掲載者のプロフィールを見る</button>`
                : `<button onclick="if(confirm('プロフィールを見るにはログインが必要です。ログイン画面へ移動しますか？')) window.location.href='login.html'" class="block w-full text-center py-3.5 rounded-sm font-bold tracking-widest shadow-md transition-colors bg-brand-100 text-brand-700 border border-brand-300 hover:bg-brand-200">掲載者のプロフィールを見る (ログイン)</button>`;


            content.innerHTML = `
                ${shareBtn}
                <div class="flex items-start gap-3 mb-4 mt-2">
                    <div class="w-12 h-12 rounded-sm bg-brand-100 overflow-hidden flex-shrink-0 border border-brand-200">
                        ${job.organizerAvatar ? `<img src="${job.organizerAvatar}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-brand-400"><i class="fa-solid fa-building"></i></div>`}
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-brand-900 leading-tight font-serif tracking-widest mb-1">${job.title || '名称未設定'}</h2>
                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-widest ${badgeColor}">${job.type || '未設定'}</span>
                        <span class="text-[10px] text-brand-500 ml-2 tracking-widest">${job.category || ''}</span>
                    </div>
                </div>

                <div class="bg-[#f7f5f0] border border-brand-200 p-4 rounded-sm mb-6 space-y-3 text-xs tracking-widest text-brand-800 shadow-inner">
                    <div class="flex justify-between border-b border-brand-100 pb-1"><span class="text-brand-500 font-bold">報酬</span><span class="font-bold">${job.rewardType || '応相談'}: ${job.rewardAmount || ''}</span></div>
                    <div class="flex justify-between border-b border-brand-100 pb-1"><span class="text-brand-500 font-bold">働き方</span><span>${job.workStyle || '-'}</span></div>
                    <div class="flex justify-between border-b border-brand-100 pb-1"><span class="text-brand-500 font-bold">勤務地</span><span>${job.locationName || job.location || '-'}</span></div>
                    <div class="flex justify-between border-b border-brand-100 pb-1"><span class="text-brand-500 font-bold">期間</span><span>${job.period || '-'}</span></div>
                    <div class="flex justify-between border-b border-brand-100 pb-1"><span class="text-brand-500 font-bold">締切</span><span>${job.deadline || '未定'}</span></div>
                    <div class="flex justify-between cursor-pointer group" onclick="${organizerLinkAction}"><span class="text-brand-500 font-bold">掲載元</span><span class="text-brand-600 font-bold group-hover:underline">${job.company || job.organizerName || '不明'}</span></div>
                </div>

                <div class="mb-6">
                    <h3 class="font-bold text-brand-900 mb-2 text-xs font-serif tracking-widest border-b border-brand-200 pb-1">業務内容詳細</h3>
                    <div class="prose prose-sm max-w-none text-brand-700 leading-relaxed text-xs break-words overflow-wrap-anywhere bg-[#fffdf9] p-3 border border-brand-100 rounded-sm">
                        ${formatText(job.desc || '詳細はありません')}
                    </div>
                </div>
                
                ${job.skills ? `
                <div class="mb-6">
                    <h3 class="font-bold text-brand-900 mb-2 text-xs font-serif tracking-widest border-b border-brand-200 pb-1">必須・歓迎条件</h3>
                    <div class="prose prose-sm max-w-none text-brand-700 leading-relaxed text-xs break-words overflow-wrap-anywhere bg-[#fffdf9] p-3 border border-brand-100 rounded-sm">
                        ${formatText(job.skills)}
                    </div>
                </div>` : ''}

                <div class="bg-brand-50 border border-brand-200 p-3 rounded-sm text-center mb-6">
                    <p class="text-[10px] text-brand-600 font-bold tracking-widest"><i class="fa-solid fa-circle-info mr-1"></i> 応募機能は現在開発中です。募集者へ直接コンタクトを取ってください。</p>
                </div>

                ${profileBtn}
                
                ${actionBtns}
            `;

            sheet.classList.remove('hidden', 'sheet-closed');
            sheet.classList.add('sheet-open');
        };

        window.deleteJob = async (jobId) => {
            if (!confirm('本当にこの求人を削除しますか？')) return;
            if (isAdminMock) return alert("【テスト】削除しました");

            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', jobId));
                alert('求人を削除しました');
                closeDetail('job');
                await loadAllData(); 
            } catch (e) { alert('削除に失敗しました'); }
        };

        window.closeDetail = (type) => {
            const sheet = document.getElementById(`${type}-sheet`);
            if(!sheet) return;
            sheet.classList.remove('sheet-open');
            sheet.classList.add('sheet-closed');
            setTimeout(() => sheet.classList.add('hidden'), 300);
        };