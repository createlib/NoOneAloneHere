import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

        let currentUser = null;
        let currentUserData = {};
        let careerList = [];
        let existingReferrerId = null;
        let myRank = 'arrival';
        let isAdmin = false;
        
        let targetUid = null;
        let editUid = null;
        
        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        // Const Arrays
        const prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];
        
        // バリエーション豊かなカテゴリ分けされたスキル・趣味データ
        const skillCategories = {
            "💻 IT・エンジニアリング": ["Web制作", "WordPress", "Firebase", "ノーコード (Bubble等)", "ローコード", "アプリ開発", "プログラミング (フロントエンド)", "プログラミング (バックエンド)", "インフラ・サーバー", "データ分析", "AI・機械学習活用", "UI/UXデザイン", "セキュリティ"],
            "🎨 クリエイティブ・デザイン": ["グラフィックデザイン", "Webデザイン", "ロゴ作成", "イラストレーション", "動画撮影", "動画編集", "写真撮影", "画像加工", "3Dモデリング", "アニメーション", "サウンドクリエイト", "コピーライティング", "シナリオライティング"],
            "💼 ビジネス・企画": ["起業", "経営・マネジメント", "新規事業立案", "事業戦略", "マーケティング", "デジタルマーケティング", "SEO/SEM", "SNS運用", "広告運用", "広報・PR", "営業", "BtoBセールス", "BtoCセールス", "カスタマーサクセス", "人事・採用", "組織開発", "経理・財務", "法務・知財"],
            "🎤 対人・コミュニケーション": ["プレゼンテーション", "ファシリテーション", "講師・セミナー登壇", "コーチング", "メンタリング", "コンサルティング", "交渉・ネゴシエーション", "インタビュー・取材", "イベント企画・運営", "コミュニティマネジメント"],
            "🌐 語学・グローバル": ["英語 (日常会話)", "英語 (ビジネス)", "中国語", "韓国語", "スペイン語", "フランス語", "その他外国語", "翻訳・通訳", "海外ビジネス展開"],
            "🌿 ライフスタイル・その他": ["料理指導", "栄養指導", "整理収納", "ファイナンシャルプランニング", "フィットネストレーナー", "マインドフルネス指導", "キャリアコンサルティング", "動画配信 (YouTuber等)", "VTuber", "インフルエンサー"]
        };

        const hobbyCategories = {
            "🏃 スポーツ・運動系": ["ランニング", "ウォーキング", "筋トレ", "ヨガ", "ピラティス", "ダンス", "バスケットボール", "サッカー", "フットサル", "野球", "テニス", "バドミントン", "卓球", "ゴルフ", "ボルダリング", "登山", "サーフィン", "スノーボード", "スキー", "サイクリング", "水泳", "格闘技", "武道", "マラソン", "トライアスロン"],
            "🎵 音楽・エンタメ": ["カラオケ", "楽器演奏（ギター）", "楽器演奏（ピアノ）", "楽器演奏（その他）", "作曲・DTM", "歌", "バンド活動", "ライブ鑑賞", "フェス", "DJ", "映画鑑賞", "アニメ鑑賞", "漫画", "ゲーム", "ボードゲーム", "謎解き", "マジック", "お笑い鑑賞", "舞台鑑賞", "ミュージカル", "クラシック音楽"],
            "🎨 文化・アート": ["絵画", "イラスト", "デザイン", "写真撮影", "動画編集", "手芸", "DIY", "小説執筆", "ブログ", "書道", "華道", "茶道", "陶芸", "美術館巡り"],
            "📚 学び・教養": ["読書", "自己啓発", "歴史", "心理学", "投資・資産運用", "マーケティング", "プログラミング", "語学学習（英語）", "語学学習（その他）", "資格取得", "経済", "政治", "哲学", "科学"],
            "🍳 食・暮らし": ["料理", "お菓子作り", "パン作り", "カフェ巡り", "食べ歩き", "お酒", "ワイン", "日本酒", "クラフトビール", "コーヒー", "紅茶", "お茶", "インテリア", "ミニマリズム", "ガーデニング", "観葉植物", "ペット", "サウナ", "銭湯"],
            "✈️ 旅行・お出かけ": ["国内旅行", "海外旅行", "一人旅", "キャンプ", "グランピング", "温泉巡り", "神社仏閣巡り", "御朱印集め", "ドライブ", "ツーリング", "ツーリング（自転車）", "テーマパーク"],
            "🤝 コミュニティ・人": ["交流会", "イベント主催", "ボランティア", "地域活動", "コーチング", "子育て", "メンタリング", "NPO活動"],
            "🌿 その他": ["瞑想", "マインドフルネス", "占い", "スピリチュアル", "その他"]
        };

        const getVal = (id, def = '') => { 
            const el = document.getElementById(id); 
            if (!el) return def;
            return (el.value === undefined || el.value === null) ? def : el.value; 
        };
        const setVal = (id, val) => { 
            const el = document.getElementById(id); 
            if (el) el.value = (val === undefined || val === null) ? '' : val; 
        };

        document.addEventListener('DOMContentLoaded', () => {
            initSelects();
            
            const urlParams = new URLSearchParams(window.location.search);
            targetUid = urlParams.get('uid');
            if (targetUid) {
                const backLink = document.getElementById('back-link');
                if (backLink) backLink.href = `user.html?uid=${targetUid}`;
            }
            
            const photoInput = document.getElementById('photo-upload');
            if(photoInput) {
                photoInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const img = document.getElementById('profile-image-preview');
                            img.src = ev.target.result;
                            img.classList.remove('hidden');
                            const placeholder = document.getElementById('edit-icon-placeholder');
                            if (placeholder) placeholder.classList.add('hidden');
                        };
                        reader.readAsDataURL(file);
                        window.updateLiveScore(); 
                    }
                });
            }
            
            setTimeout(window.updateLiveScore, 500);
        });

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                targetUid = 'test_admin_uid';
                populateForm({userId:'admin', name:'管理者'});
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                // ★修正: let を外して、グローバル変数に正しくIDをセットする
                editUid = user.uid; 
                
                try {
                    const myDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
                    const mySnap = await getDoc(myDocRef);
                    let myData = null;
                    if (mySnap.exists()) {
                        myData = mySnap.data();
                        if (myData.userId === 'admin') isAdmin = true;
                    }

                    if (user.uid === "Zm7FWRopJKVfyzbp8KXXokMFjNC3") { 
                        isAdmin = true;
                    }

                    if (targetUid && targetUid !== user.uid) {
                        if (isAdmin) {
                            editUid = targetUid;
                            showNotification('管理者権限で他ユーザーを編集します', 'info');
                        } else {
                            alert("権限がありません");
                            window.location.href = "user.html";
                            return;
                        }
                    } else {
                        targetUid = user.uid;
                    }

                    await loadUserProfile(editUid);
                } catch (e) { console.error(e); }
            } else {
                window.location.href = 'login.html';
            }
        });

        // --- Helper Methods ---
        window.openMarkdownHelp = () => {
            document.getElementById('md-help-modal').classList.remove('hidden');
        };
        window.closeMarkdownHelp = () => {
            document.getElementById('md-help-modal').classList.add('hidden');
        };

        window.showNotification = (msg, isError = false) => {
            const notif = document.getElementById('notification');
            const msgEl = document.getElementById('notif-message');
            const iconEl = notif.querySelector('i');
            
            if(isError === 'error' || isError === true) {
                notif.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 z-[3000] bg-[#fffdf9] text-red-700 px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 border border-red-300 transition-all duration-300';
                iconEl.className = 'fa-solid fa-triangle-exclamation text-red-500 text-lg';
            } else {
                notif.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 z-[3000] bg-[#3e2723] text-[#f7f5f0] px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 backdrop-blur-md border border-[#8b6a4f] transition-all duration-300';
                iconEl.className = 'fa-solid fa-check text-[#d4af37] text-lg';
            }
            
            msgEl.textContent = msg;
            notif.classList.remove('hidden', 'translate-y-20');
            setTimeout(() => {
                notif.classList.add('translate-y-20');
                setTimeout(() => notif.classList.add('hidden'), 300);
            }, 3000);
        };

        function initSelects() {
            const areaSelect = document.getElementById('prefecture');
            const birthSelect = document.getElementById('birthplace');
            
            let prefOptions = '<option value="">選択してください</option>';
            prefectures.forEach(p => prefOptions += `<option value="${p}">${p}</option>`);
            
            if(areaSelect) areaSelect.innerHTML = prefOptions;
            if(birthSelect) birthSelect.innerHTML = prefOptions;
            
            const skillsContainer = document.getElementById('skills-checkbox-container');
            if(skillsContainer) {
                createCategoryCheckboxes(skillCategories, skillsContainer, 'skill-tag');
            }
            
            const hobbiesContainer = document.getElementById('hobbies-checkbox-container');
            if(hobbiesContainer) {
                createCategoryCheckboxes(hobbyCategories, hobbiesContainer, 'hobby-tag');
            }
        }

        function createCategoryCheckboxes(data, container, nameAttr) {
            container.innerHTML = '';
            for (const [category, items] of Object.entries(data)) {
                const details = document.createElement('details');
                details.className = 'group border border-brand-200 rounded-sm bg-[#fffdf9] overflow-hidden mb-2 shadow-sm';
                
                details.innerHTML = `
                    <summary class="p-3 cursor-pointer hover:bg-brand-50 font-bold text-sm text-brand-800 flex justify-between tracking-widest">${category} <span class="accordion-arrow text-brand-400">▼</span></summary>
                    <div class="p-3 flex flex-wrap gap-2 border-t border-dashed border-brand-200 bg-brand-50">
                        ${items.map(item => `
                            <label class="cursor-pointer">
                                <input type="checkbox" name="${nameAttr}" value="${item}" class="tag-checkbox hidden" onchange="window.updateLiveScore()">
                                <div class="px-3 py-1.5 rounded-sm border border-brand-200 text-xs hover:bg-[#fffdf9] transition-colors tracking-widest text-brand-700 bg-white shadow-sm">${item}</div>
                            </label>
                        `).join('')}
                    </div>
                `;
                container.appendChild(details);
            }
        }

        async function loadUserProfile(uid) {
            try {
                const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    currentUserData = docSnap.data();
                } else {
                    currentUserData = { userId: uid };
                }
                populateForm(currentUserData);
            } catch (e) {
                console.error(e);
                showNotification("データの読み込みに失敗しました", true);
            }
        }

        function populateForm(data) {
            window._originalEmail = data.email || null;
            
            setVal('name', data.name);
            setVal('realName', data.realName);
            setVal('furigana', data.furigana);
            setVal('jobTitle', data.jobTitle);
            setVal('prefecture', data.prefecture);
            setVal('birthplace', data.birthplace); 
            setVal('gender', data.gender);
            setVal('birthDate', data.birthDate);
            setVal('birthVisibility', data.birthVisibility || 'full');
            setVal('bio', data.bio);
            setVal('message', data.message);
            setVal('goals', data.goals);
            
            if(Array.isArray(data.canOffer)) setVal('canOffer', data.canOffer.join(', '));
            else setVal('canOffer', data.canOffer || '');
            
            if(Array.isArray(data.lookingFor)) setVal('lookingFor', data.lookingFor.join(', '));
            else setVal('lookingFor', data.lookingFor || '');

            setVal('contactEmail', data.contactEmail);
            setVal('websiteUrl', data.websiteUrl);
            setVal('snsInstagram', data.snsInstagram);
            setVal('snsX', data.snsX);
            
            if(data.profilePublic) document.getElementById('profilePublic').value = data.profilePublic;
            
            if(data.photoURL) {
                document.getElementById('profile-image-preview').src = data.photoURL;
                document.getElementById('profile-image-preview').classList.remove('hidden');
                const placeholder = document.getElementById('edit-icon-placeholder');
                if (placeholder) placeholder.classList.add('hidden');
            }

            const selectedSkills = data.skills || [];
            document.querySelectorAll('input[name="skill-tag"]').forEach(cb => {
                if(selectedSkills.includes(cb.value)) {
                    cb.checked = true;
                    cb.closest('details').open = true;
                }
            });
            const allPresetSkills = Object.values(skillCategories).flat();
            const customSkills = selectedSkills.filter(s => !allPresetSkills.includes(s));
            setVal('custom-skills', customSkills.join(', '));

            const selectedHobbies = data.hobbies || [];
            document.querySelectorAll('input[name="hobby-tag"]').forEach(cb => {
                if(selectedHobbies.includes(cb.value)) {
                    cb.checked = true;
                    cb.closest('details').open = true;
                }
            });
            const allPresetHobbies = Object.values(hobbyCategories).flat();
            const customHobbies = selectedHobbies.filter(s => !allPresetHobbies.includes(s));
            setVal('custom-hobbies', customHobbies.join(', '));

            document.getElementById('career-list-container').innerHTML = '';
            if(data.career && data.career.length > 0) {
                data.career.forEach(c => addCareerField(c));
            }
            
            window.updateLiveScore();
        }

        window.addCareerField = (data = {}) => {
            const container = document.getElementById('career-list-container');
            const div = document.createElement('div');
            div.className = 'bg-[#f7f5f0] p-5 rounded-sm border border-brand-200 relative career-item shadow-sm';
            div.innerHTML = `
                <button type="button" onclick="this.parentElement.remove(); window.updateLiveScore();" class="absolute top-2 right-3 text-brand-300 hover:text-red-800 transition-colors"><i class="fa-solid fa-trash"></i></button>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 mt-2">
                    <input type="text" class="career-company w-full border-brand-200 rounded-sm p-2 text-sm bg-[#fffdf9]" placeholder="会社・組織名" value="${data.company||''}">
                    <input type="text" class="career-role w-full border-brand-200 rounded-sm p-2 text-sm bg-[#fffdf9]" placeholder="役職・役割" value="${data.role||''}">
                </div>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <input type="month" class="career-start w-full border-brand-200 rounded-sm p-2 text-sm bg-[#fffdf9] text-brand-700" value="${data.start||''}">
                    <input type="month" class="career-end w-full border-brand-200 rounded-sm p-2 text-sm bg-[#fffdf9] text-brand-700" value="${data.end||''}">
                </div>
                <div class="flex justify-between items-center mb-1.5">
                    <label class="block text-xs font-bold text-brand-700 tracking-widest">業務内容・詳細</label>
                    <button type="button" onclick="openMarkdownHelp()" class="text-brand-600 hover:text-brand-900 transition-colors text-[10px] flex items-center gap-1 bg-brand-100 px-2 py-1 rounded-sm border border-brand-300 shadow-sm font-bold"><i class="fa-regular fa-circle-question"></i>書き方</button>
                </div>
                <textarea class="career-desc w-full border-brand-200 rounded-sm p-3 text-sm bg-[#fffdf9] leading-relaxed" rows="3" placeholder="どのような課題に取り組み、何を残したか。">${data.description||''}</textarea>
            `;
            container.appendChild(div);
            window.updateLiveScore();
        };
        
        window.addCareer = () => {
            window.addCareerField();
        };

        function calculateProfileScore(data) {
            let score = 0;
            
            if (data.photoURL) score += 8;
            if (data.name) score += 4;
            if (data.realName) score += 4;
            if (data.furigana) score += 4;
            if (data.jobTitle) score += 4;
            if (data.prefecture) score += 4;
            if (data.birthplace) score += 4;
            if (data.gender && data.gender !== '無回答') score += 4;
            if (data.birthDate) score += 4;
            
            if (data.bio && data.bio.length >= 150) score += 10;
            if (data.message && data.message.length >= 150) score += 10;
            if (data.goals && data.goals.length >= 150) score += 10;
            
            if (data.canOffer && data.canOffer.length > 0) score += 5;
            if (data.lookingFor && data.lookingFor.length > 0) score += 5;
            
            if (data.skills && data.skills.length >= 3) score += 5;
            if (data.hobbies && data.hobbies.length >= 3) score += 5;
            
            if (data.career && data.career.length > 0) score += 5;
            
            if (data.websiteUrl || data.snsInstagram || data.snsX || data.contactEmail) score += 5;
            
            return Math.min(score, 100);
        }

        window.updateLiveScore = () => {
            const previewEl = document.getElementById('profile-image-preview');
            const currentPhotoUrl = previewEl && !previewEl.classList.contains('hidden') ? true : false;
            
            const checkedSkills = Array.from(document.querySelectorAll('input[name="skill-tag"]:checked')).length;
            const customSkills = getVal('custom-skills').split(',').filter(s => s.trim()).length;
            const skillCount = checkedSkills + customSkills;

            const checkedHobbies = Array.from(document.querySelectorAll('input[name="hobby-tag"]:checked')).length;
            const customHobbies = getVal('custom-hobbies').split(',').filter(s => s.trim()).length;
            const hobbyCount = checkedHobbies + customHobbies;

            const canOfferCount = getVal('canOffer').split(',').filter(s => s.trim()).length;
            const lookingForCount = getVal('lookingFor').split(',').filter(s => s.trim()).length;

            const careerCount = document.querySelectorAll('.career-item').length;

            const data = {
                photoURL: currentPhotoUrl ? 'dummy' : null,
                name: getVal('name'),
                realName: getVal('realName'),
                furigana: getVal('furigana'),
                jobTitle: getVal('jobTitle'),
                prefecture: getVal('prefecture'),
                birthplace: getVal('birthplace'),
                gender: getVal('gender'),
                birthDate: getVal('birthDate'),
                bio: getVal('bio'),
                message: getVal('message'),
                goals: getVal('goals'),
                canOffer: new Array(canOfferCount),
                lookingFor: new Array(lookingForCount),
                skills: new Array(skillCount),
                hobbies: new Array(hobbyCount),
                career: new Array(careerCount),
                websiteUrl: getVal('websiteUrl'),
                snsInstagram: getVal('snsInstagram'),
                snsX: getVal('snsX'),
                contactEmail: getVal('contactEmail')
            };

            const score = calculateProfileScore(data);
            
            updateCharCount('bio', 150);
            updateCharCount('message', 150);
            updateCharCount('goals', 150);

            updateItemCount('canOffer', canOfferCount, 1);
            updateItemCount('lookingFor', lookingForCount, 1);
            
            updateTagCount('skills-status', skillCount, 3);
            updateTagCount('hobbies-status', hobbyCount, 3);
            
            updateCareerCount(careerCount);

            renderScoreSummary(score, data);
        };

        function updateCharCount(id, target) {
            const el = document.getElementById(id);
            const countEl = document.getElementById(`${id}-count`);
            if(el && countEl) {
                const len = el.value.trim().length;
                if(len >= target) {
                    countEl.innerHTML = `<span class="text-green-600 font-bold"><i class="fa-solid fa-check mr-1"></i>${len} / ${target}文字 (クリア)</span>`;
                } else {
                    countEl.innerHTML = `<span class="text-brand-400 font-bold">${len} / ${target}文字 (あと${target - len}文字)</span>`;
                }
            }
        }
        function updateItemCount(id, count, target) {
            const countEl = document.getElementById(`${id}-count`);
            if(countEl) {
                if(count >= target) {
                    countEl.innerHTML = `<span class="text-green-600 font-bold"><i class="fa-solid fa-check mr-1"></i>${count}個入力済み (クリア)</span>`;
                } else {
                    countEl.innerHTML = `<span class="text-brand-400 font-bold">現在${count}個 (あと${target - count}個追加してください)</span>`;
                }
            }
        }
        function updateTagCount(id, count, target) {
            const countEl = document.getElementById(id);
            if(countEl) {
                if(count >= target) {
                    countEl.innerHTML = `<span class="text-green-600"><i class="fa-solid fa-check mr-1"></i>${count}個選択済み (クリア)</span>`;
                } else {
                    countEl.innerHTML = `<span class="text-brand-500">現在${count}個 (あと${target - count}個選択してください)</span>`;
                }
            }
        }
        function updateCareerCount(count) {
            const countEl = document.getElementById('career-status');
            if(countEl) {
                if(count >= 1) {
                    countEl.innerHTML = `<span class="text-green-600 font-bold"><i class="fa-solid fa-check mr-1"></i>${count}件入力済み (クリア)</span>`;
                } else {
                    countEl.innerHTML = `<span class="text-brand-500">未入力 (1件以上追加してください)</span>`;
                }
            }
        }

        function renderScoreSummary(score, data) {
            const summaryEl = document.getElementById('score-summary');
            if(!summaryEl) return;

            if(score >= 100) {
                summaryEl.classList.add('hidden');
                return;
            }

            summaryEl.classList.remove('hidden');
            let missing = [];

            if(!data.photoURL) missing.push('プロフィール画像の設定 (8%)');
            if(!data.name) missing.push('表示名 (4%)');
            if(!data.realName) missing.push('本名 (4%)');
            if(!data.furigana) missing.push('ふりがな (4%)');
            if(!data.jobTitle) missing.push('職業・肩書 (4%)');
            if(!data.prefecture) missing.push('活動拠点 (4%)');
            if(!data.birthplace) missing.push('出身地 (4%)');
            if(!data.gender || data.gender === '無回答') missing.push('性別 (4%)');
            if(!data.birthDate) missing.push('生年月日 (4%)');
            
            if(!data.bio || data.bio.length < 150) missing.push('自己紹介150字以上 (10%)');
            if(!data.message || data.message.length < 150) missing.push('想い・メッセージ150字以上 (10%)');
            if(!data.goals || data.goals.length < 150) missing.push('目標・ビジョン150字以上 (10%)');
            
            if(data.canOffer.length === 0) missing.push('提供できること1つ以上 (5%)');
            if(data.lookingFor.length === 0) missing.push('求めていること1つ以上 (5%)');
            
            if(data.skills.length < 3) missing.push('スキル3つ以上 (5%)');
            if(data.hobbies.length < 3) missing.push('趣味3つ以上 (5%)');
            
            if(data.career.length === 0) missing.push('経歴1つ以上 (5%)');
            
            if(!data.websiteUrl && !data.snsInstagram && !data.snsX && !data.contactEmail) missing.push('SNS・外部リンク1つ以上 (5%)');

            document.getElementById('score-summary-current').textContent = score;
            document.getElementById('score-summary-missing').innerHTML = missing.map(m => `<li>・${m}</li>`).join('');
        }

        // ==========================================
        // ★ THE PERSONAL OS / Core Logic Engine
        // 誕生日から1〜60の運命数(OSナンバー：日干支)を算出する完全版関数
        // ==========================================
        function calculateOsNumber(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split(/[-/]/);
            if (parts.length < 3) return null;
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

            const targetDate = new Date(0);
            targetDate.setUTCFullYear(y, m, d);
            targetDate.setUTCHours(0, 0, 0, 0);
            
            const baseDate = new Date(0);
            baseDate.setUTCFullYear(1900, 1, 20);
            baseDate.setUTCHours(0, 0, 0, 0);

            const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
            const day_idx = ((diffDays % 60) + 60) % 60;
            return day_idx + 1;
        }

        const safeStr = (val) => {
            if (val === undefined || val === null) return '';
            return String(val).trim();
        };

        window.saveProfile = async (e) => {
            e.preventDefault();
            if (!currentUser || !editUid) return;
            const btn = document.getElementById('btn-save');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';
            showNotification('記録を保存中...', 'info');

            try {
                const uid = editUid; 
                const privateRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data');
                
                let currentPhotoUrl = currentUserData.photoURL || null;
                const finalUserId = currentUserData.userId || uid; 

                const fileEl = document.getElementById('photo-upload');
                if (fileEl && fileEl.files[0] && !isAdminMock) {
                    try {
                        const snap = await uploadBytes(ref(storage, `profiles/${uid}/${Date.now()}_${fileEl.files[0].name}`), fileEl.files[0]);
                        currentPhotoUrl = await getDownloadURL(snap.ref);
                    } catch(err) {
                        console.error("Upload error:", err);
                        showNotification('画像のアップロードに失敗しました', true);
                    }
                }

                const checkedSkills = Array.from(document.querySelectorAll('input[name="skill-tag"]:checked')).map(cb => cb.value);
                const customSkillsStr = getVal('custom-skills');
                const customSkills = customSkillsStr ? customSkillsStr.split(',').map(s=>s.trim()).filter(s=>s) : [];
                const finalSkills = [...new Set([...checkedSkills, ...customSkills])];

                const checkedHobbies = Array.from(document.querySelectorAll('input[name="hobby-tag"]:checked')).map(cb => cb.value);
                const customHobbiesStr = getVal('custom-hobbies');
                const customHobbies = customHobbiesStr ? customHobbiesStr.split(',').map(s=>s.trim()).filter(s=>s) : [];
                const finalHobbies = [...new Set([...checkedHobbies, ...customHobbies])];

                let newCareerList = [];
                document.querySelectorAll('.career-item').forEach(item => {
                    newCareerList.push({
                        company: item.querySelector('.career-company').value,
                        role: item.querySelector('.career-role').value,
                        start: item.querySelector('.career-start').value,
                        end: item.querySelector('.career-end').value,
                        description: item.querySelector('.career-desc').value
                    });
                });

                const birthDateVal = getVal('birthDate');
                const osNumberVal = calculateOsNumber(birthDateVal);

                const finalData = {
                    ...currentUserData, 
                    userId: safeStr(finalUserId),
                    referrerId: currentUserData.referrerId || null,
                    membershipRank: safeStr(currentUserData.membershipRank || 'arrival'),
                    email: window._originalEmail || currentUser.email || null, 
                    name: safeStr(getVal('name')),
                    realName: safeStr(getVal('realName')), 
                    furigana: safeStr(getVal('furigana')),
                    jobTitle: safeStr(getVal('jobTitle')),
                    prefecture: safeStr(getVal('prefecture')),
                    birthplace: safeStr(getVal('birthplace')),
                    gender: safeStr(getVal('gender')),
                    birthDate: safeStr(birthDateVal),
                    osNumber: osNumberVal, 
                    birthVisibility: safeStr(getVal('birthVisibility', 'full')),
                    bio: safeStr(getVal('bio')),
                    message: safeStr(getVal('message')),
                    canOffer: getVal('canOffer') ? getVal('canOffer').split(',').map(s=>s.trim()).filter(s=>s) : [],
                    lookingFor: getVal('lookingFor') ? getVal('lookingFor').split(',').map(s=>s.trim()).filter(s=>s) : [],
                    goals: safeStr(getVal('goals')),
                    contactEmail: safeStr(getVal('contactEmail')),
                    websiteUrl: safeStr(getVal('websiteUrl')),
                    snsInstagram: safeStr(getVal('snsInstagram')),
                    snsX: safeStr(getVal('snsX')),
                    profilePublic: safeStr(getVal('profilePublic', 'true')),
                    photoURL: currentPhotoUrl || null,
                    skills: finalSkills || [],
                    hobbies: finalHobbies || [],
                    career: newCareerList || [],
                    updatedAt: new Date().toISOString()
                };

                finalData.profileScore = calculateProfileScore(finalData);

                if (isAdminMock) {
                    showNotification(`保存しました(テスト) 充実度: ${finalData.profileScore}%`, 'success');
                    setTimeout(() => window.location.href = `user.html?uid=${targetUid}`, 1500);
                    return;
                }

                await setDoc(privateRef, finalData, { merge: true }); 

                const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
                const isPaidMember = (finalData.membershipRank !== 'arrival');
                const isPublicSetting = (finalData.profilePublic === 'true');
                const canPublish = isPaidMember || isAdmin;

                if (isPublicSetting && canPublish) {
                    const publicData = {
                        ...finalData,
                        isHidden: false
                    };
                    delete publicData.realName;
                    await setDoc(publicRef, publicData, { merge: true }); 
                } else {
                    const minimalData = {
                        userId: finalData.userId,
                        name: finalData.name || finalData.userId,
                        photoURL: finalData.photoURL || null,
                        email: finalData.email || null, 
                        isHidden: true,
                        referrerId: finalData.referrerId || null,
                        profileScore: finalData.profileScore || 0,
                        osNumber: finalData.osNumber || null 
                    };
                    await setDoc(publicRef, minimalData, { merge: true }); 
                }

                if (isPublicSetting && !canPublish) {
                    alert(`プロフィールを保存しました。(充実度: ${finalData.profileScore}%)\n※現在ARRIVAL会員のため、設定を「公開」にしても検索結果には表示されません。`);
                } else {
                    showNotification(`航海録を更新しました (充実度: ${finalData.profileScore}%)`);
                }
                
                setTimeout(() => { 
                    window.location.href = targetUid ? `user.html?uid=${targetUid}` : 'user.html'; 
                }, 1500);

            } catch (e) {
                console.error("Profile Save Error:", e);
                showNotification('保存に失敗しました。時間をおいて再試行してください。', true);
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i> 航海録を保存する';
            }
        };