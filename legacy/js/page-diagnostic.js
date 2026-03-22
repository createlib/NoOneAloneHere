import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        // ▼ 本番環境のFirebase Configを設定してください ▼
        // 10パターンのプレミアム・カラーパレット（背景・メイン・サブ）
        const THEME_COLORS = {
            '甲': { bg: '#041208', main: '#10B981', sub: '#34D399' }, // 木・陽
            '乙': { bg: '#08140B', main: '#34D399', sub: '#6EE7B7' }, // 木・陰
            '丙': { bg: '#1A0808', main: '#EF4444', sub: '#FCA5A5' }, // 火・陽
            '丁': { bg: '#180B05', main: '#F97316', sub: '#FDBA74' }, // 火・陰
            '戊': { bg: '#171105', main: '#D97706', sub: '#FCD34D' }, // 土・陽
            '己': { bg: '#141208', main: '#B45309', sub: '#FDE047' }, // 土・陰
            '庚': { bg: '#080A0F', main: '#94A3B8', sub: '#CBD5E1' }, // 金・陽
            '辛': { bg: '#0B0D14', main: '#CBD5E1', sub: '#F1F5F9' }, // 金・陰
            '壬': { bg: '#050A14', main: '#3B82F6', sub: '#93C5FD' }, // 水・陽
            '癸': { bg: '#060913', main: '#C5A880', sub: '#3B82F6' }  // 水・陰
        };

        const ICONS = [
            '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
            '<circle cx="8" cy="12" r="6"/><circle cx="16" cy="12" r="6"/>',
            '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>',
            '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>'
        ];

        // HexをRGBAに変換（レーダーチャートの透過用）
        function hexToRgba(hex, alpha) {
            hex = hex.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        let chartInstance = null;

        // メイン処理
        onAuthStateChanged(auth, async (user) => {
            let userRank = 'arrival';
            let targetOsId = new URLSearchParams(window.location.search).get('osId');

            if (localStorage.getItem('isAdminMock') === 'true') {
                userRank = 'covenant'; // 管理者は全解禁
                if (!targetOsId) targetOsId = "50";
            } else if (user) {
                try {
                    // ログインユーザーのランクをFirestoreから取得
                    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
                    const snap = await getDoc(profileRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        userRank = data.membershipRank || 'arrival';
                        
                        if (!targetOsId) targetOsId = data.osNumber ? String(data.osNumber) : "50"; 
                    }
                } catch(e) { console.error(e); }
            } else {
                // 未ログインはログイン画面へ
                window.location.href = 'login.html';
                return;
            }

            // ランク判定 (ARRIVAL以外ならCSSのロックを解除)
            document.body.setAttribute('data-tier', userRank === 'arrival' ? 'ARRIVAL' : 'SETTLER');

            // Firestoreから診断データをロードして描画
            await fetchBlueprint(targetOsId);
        });

        async function fetchBlueprint(id) {
            try {
                // ★ Firestoreから取得（設計したコレクションパス）
                const docRef = doc(db, 'artifacts', appId, 'os_blueprints', String(id));
                const docSnap = await getDoc(docRef);
                
                let data;
                if (docSnap.exists()) {
                    data = docSnap.data();
                } else {
                    console.warn("Firestoreにデータがありません。モックを使用します。");
                    data = getFallbackData();
                }

                // 1. カラーテーマの適用
                applyTheme(data.jukkan || '癸');

                // 2. DOMへの流し込み
                renderDOM(data);

                // 3. ローディング解除
                setTimeout(() => {
                    document.getElementById('loader').style.opacity = '0';
                    document.body.style.overflow = 'auto';
                    setTimeout(() => {
                        document.getElementById('loader').style.display = 'none';
                        document.getElementById('main-content').style.opacity = '1';
                        initAnimations();
                        renderChart(data.parameter);
                    }, 500);
                }, 500);

            } catch (e) {
                console.error(e);
                alert("データの読み込みに失敗しました。");
            }
        }

        function applyTheme(jukkan) {
            const theme = THEME_COLORS[jukkan] || THEME_COLORS["癸"];
            const root = document.documentElement;
            root.style.setProperty('--bg-color', theme.bg);
            root.style.setProperty('--accent-main', theme.main);
            root.style.setProperty('--accent-sub', theme.sub);
            document.querySelector('.spinner').style.borderTopColor = theme.main;
        }

        function renderDOM(d) {
            document.getElementById('dom-badge').textContent = `PERSONAL BEHAVIORAL OS | No.${d.id} ${d.kanji}`;
            document.getElementById('dom-ruby').textContent = d.ruby;
            document.getElementById('dom-title').textContent = d.kanji;
            document.getElementById('dom-catchcopy').textContent = d.catchcopy;
            document.getElementById('dom-keywords').innerHTML = d.keywords.map(k => `<span class="kw-tag">#${k}</span>`).join('');

            // ORIGIN
            document.getElementById('dom-metaphor').innerHTML = `<p>${d.origin.metaphor.replace(/\n/g, '<br class="pc-only">')}</p>`;
            document.getElementById('dom-origin-text').innerHTML = `
                <p>${d.origin.p1.replace(/「(.*?)」/g, '<span class="highlight-text">「$1」</span>')}</p>
                <p>${d.origin.p2.replace(/「(.*?)」/g, '<span class="highlight-text">「$1」</span>')}</p>
                <p>${d.origin.p3.replace(/「(.*?)」/g, '<span class="highlight-text">「$1」</span>')}</p>
            `;

            // ★追加: p4 (性格・強み・注意点) のパースと表示
            const traitsContainer = document.getElementById('dom-origin-traits');
            if (d.origin.p4) {
                const formattedP4 = d.origin.p4.split('\n').map(line => {
                    const match = line.match(/^【(.*?)】\s*(.*)$/);
                    if (match) {
                        return `<div class="mb-6 last:mb-0">
                                    <h4 class="inline-flex items-center px-3 py-1 bg-[rgba(0,0,0,0.5)] border border-[var(--accent-sub)] text-[var(--accent-sub)] text-xs font-bold tracking-widest rounded-sm mb-3 shadow-md">
                                        <i class="fa-regular fa-gem mr-2 text-[var(--accent-main)]"></i>${match[1]}
                                    </h4>
                                    <p class="text-[1.05rem] text-[#C9D1D9] leading-[2.0] m-0 text-justify">${match[2]}</p>
                                </div>`;
                    } else {
                        return `<p class="text-[1.05rem] text-[#C9D1D9] leading-[2.0] mb-4 text-justify">${line}</p>`;
                    }
                }).join('');
                
                traitsContainer.innerHTML = `
                    <div class="mt-12 mb-12 p-6 sm:p-8 bg-[var(--surface-color)] border border-[var(--border-subtle)] rounded-lg relative overflow-hidden shadow-xl">
                        <div class="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[var(--accent-main)] to-[var(--accent-sub)]"></div>
                        <div class="absolute -right-6 -bottom-6 text-[var(--accent-main)] opacity-10 text-8xl pointer-events-none"><i class="fa-solid fa-fingerprint"></i></div>
                        <div class="relative z-10">
                            ${formattedP4}
                        </div>
                    </div>
                `;
                traitsContainer.style.display = 'block';
            } else {
                traitsContainer.style.display = 'none';
            }

            document.getElementById('dom-nodes').innerHTML = `
                <div class="node"><div class="node-circle serif" style="border-color: var(--accent-sub);">${d.origin.nodes[0].word.replace(/\n/g, '<br>')}</div><div class="node-desc">${d.origin.nodes[0].desc.replace(/\n/g, '<br>')}</div></div>
                <div class="arrow">▶︎</div>
                <div class="node"><div class="node-circle serif" style="border-color: #fff;">${d.origin.nodes[1].word.replace(/\n/g, '<br>')}</div><div class="node-desc">${d.origin.nodes[1].desc.replace(/\n/g, '<br>')}</div></div>
                <div class="arrow">▶︎</div>
                <div class="node"><div class="node-circle serif highlight">${d.origin.nodes[2].word.replace(/\n/g, '<br>')}</div><div class="node-desc">${d.origin.nodes[2].desc.replace(/\n/g, '<br>')}</div></div>
            `;

            // RESONANCE
            document.getElementById('dom-resonance').innerHTML = d.resonance.map((res, i) => `
                <div class="syn-card">
                    <svg class="syn-icon" viewBox="0 0 24 24">${ICONS[i % 4]}</svg>
                    <h3 class="syn-title serif">${res.title}</h3>
                    <div class="syn-section"><span class="syn-label">【あなたの役割 (GIVE)】</span><div class="syn-text">${res.give}</div></div>
                    <div class="syn-section"><span class="syn-label">【相手に求めるもの (TAKE)】</span><div class="syn-text">${res.take}</div></div>
                    
                    <div class="premium-container">
                        <span class="syn-label" style="color: var(--accent-main);">▶︎ 最高の化学反応を起こす相手</span>
                        <div class="premium-content">
                            ${res.matches.map(m => {
                                const match = m.name.match(/No\.(\d+)/);
                                const osNum = match ? match[1] : '';
                                if(osNum) {
                                    return '<div class="syn-match-item"><a href="search.html?osNumber=' + osNum + '" style="color: var(--accent-main); font-weight: bold; margin-right: 8px; font-family: var(--font-serif); letter-spacing: 0.05em; text-decoration: underline; text-underline-offset: 3px; cursor: pointer;" class="hover:opacity-80 transition-opacity" title="このOSの乗客を探す">' + m.name + '</a>' + m.desc + '</div>';
                                }
                                return '<div class="syn-match-item"><span>' + m.name + '</span>' + m.desc + '</div>';
                            }).join('')}
                            <div class="syn-note">${res.note}</div>
                        </div>
                        <div class="premium-overlay" onclick="location.href='upgrade.html'">
                            <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <div style="font-size: 0.85rem; color: #fff; letter-spacing: 0.1em; font-weight: bold;">SETTLER以上で解放</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; text-decoration:underline;">契約を変更して確認する</div>
                        </div>
                    </div>
                </div>
            `).join('');

            // PARAMETER
            document.getElementById('dom-param-text').innerHTML = `
                <p>${d.parameter.p1}</p>
                <p style="margin-bottom:0;">${d.parameter.p2.replace(/「(.*?)」/g, '<span class="highlight-text">「$1」</span>')}</p>
            `;

            // STRATEGY
            document.getElementById('dom-strat-good').innerHTML = d.strategy.good.map(s => `<li>${s}</li>`).join('');
            document.getElementById('dom-strat-bad').innerHTML = d.strategy.bad.map(s => `<li>${s}</li>`).join('');

            // MESSAGE
            document.getElementById('dom-message').innerHTML = d.message.map(m => `<p>${m.replace(/\n/g, '<br class="pc-only">')}</p>`).join('');
        }

        function renderChart(param) {
            const ctx = document.getElementById('radarChart').getContext('2d');
            const mainColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-main').trim();
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim();

            Chart.defaults.color = '#8BA2BC';
            Chart.defaults.font.family = "'Zen Kaku Gothic New', sans-serif";

            if (chartInstance) chartInstance.destroy();
            
            const isMobile = window.innerWidth < 768; // スマホ判定

            chartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['推進・行動力', '表現・発信力', '構築・管理力', '知略・分析力', '共感・調和力'],
                    datasets: [{
                        data: param.stats,
                        backgroundColor: hexToRgba(mainColor, 0.15),
                        borderColor: mainColor,
                        pointBackgroundColor: mainColor,
                        pointBorderColor: bgColor,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: mainColor,
                        borderWidth: 2, pointRadius: 4, pointHoverRadius: 6
                    }]
                },
                options: {
                    layout: {
                        padding: isMobile ? { left: 15, right: 15, top: 10, bottom: 10 } : 0
                    },
                    scales: {
                        r: {
                            min: 0,
                            max: 100,
                            beginAtZero: true,
                            angleLines: { color: 'rgba(255, 255, 255, 0.05)' }, 
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { font: { size: isMobile ? 11 : 14, weight: '500' }, color: '#E2E8F0' },
                            ticks: { display: false, stepSize: 20 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(13, 19, 38, 0.95)', 
                            titleFont: { size: isMobile ? 13 : 14, family: "'Noto Serif JP', serif" },
                            bodyFont: { size: isMobile ? 12 : 13 }, 
                            borderColor: mainColor, 
                            borderWidth: 1, 
                            padding: isMobile ? 10 : 15, 
                            callbacks: { 
                                label: (ctx) => {
                                    const text = param.tooltips[ctx.dataIndex];
                                    if (isMobile) {
                                        const splitIdx = text.indexOf('] ');
                                        if (splitIdx !== -1) {
                                            return [
                                                " " + text.substring(0, splitIdx + 1),
                                                " " + text.substring(splitIdx + 2)
                                            ];
                                        }
                                    }
                                    return " " + text;
                                }
                            }
                        }
                    },
                    animation: { duration: 2500, easing: 'easeOutQuart' }
                }
            });
        }

        function initAnimations() {
            const faders = document.querySelectorAll('.fade-in');
            const observer = new IntersectionObserver(entries => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }});
            }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });
            faders.forEach(f => observer.observe(f));
        }

        // DB未登録時のフォールバックデータ
        function getFallbackData() {
            return {
                id: 50, jukkan: "癸", kanji: "玄盤", ruby: "GENBAN", catchcopy: "静水深流で基盤を支える蓄積型構築者",
                keywords: ["究極の蓄積", "基盤整備", "長期計画", "裏方統括の極致"],
                origin: {
                    metaphor: "「凍てつく冬の大地。\n表層は分厚い泥と氷に閉ざされ、一切の動きがないように見える。\nしかし、その強固な岩盤のさらに奥深くでは、\n長い年月をかけて濾過された『清らかで巨大な地下水脈』が、\n轟音を立てて脈々と流れている。」",
                    p1: "なぜあなたの行動設計図（OS）に「玄盤」という名が冠されたのか。それはあなたが、一過性の流行や軽薄なスポットライトが当たる表層の世界には一切の興味を持たず、「何十年先も決して崩壊しない社会のインフラ」を、地下深くで設計していく使命を帯びているからです。",
                    p2: "自然界の物理法則と深層心理の力学を統合した本プロファイリングにおいて、あなたのパーソナリティは<strong>「強烈な重圧を内側に溜め込み、純化させる」</strong>という極めて特殊な構造を持っています。周りが浮き足立っている時、あなた一人だけが「3年後、このシステムが破綻しないか」を静かに計算しています。",
                    p3: "あなたはプレッシャーに潰されているのではありません。外からの不条理な圧力や混沌とした状況を真っ向から受け止め、それを内なる「冷徹な知性と美学のフィルター」に通すことで不純物を極限まで削ぎ落とします。そして純度100%の真理とデータだけを蓄積していく、「究極の自己濾過システム」を内蔵しているのです。",
                    p4: "【性格】 非常にさっぱりとした気質で、迷いなく行動を起こす力強さを持っています。正義感が強く、自分が信じた道であればどんな障害があっても突き進む、確固たる信念と精神的なタフさを備えています。\n【強み】 卓越した決断力と実行力を持ち合わせており、ゼロから新しいプロジェクトを立ち上げる指導者や経営者として、組織を牽引するカリスマ性を発揮します。困難な状況でも決して逃げ出さない責任感が周囲の信頼を集めます。\n【注意点】 目標達成に向けた推進力が強すぎるあまり、率直すぎる言動が意図せず他者との摩擦を生み、敵を作ってしまうことがあります。自分のペースを他者にも求めてしまう傾向があるため、あえて一歩引いて周囲の意見に耳を傾け、調和や協調性を意識してコミュニケーションをとることで、あなたの築く基盤はより盤石になり、運気も大きく安定していくでしょう。",
                    nodes: [ { word: "現実の\n重圧", desc: "社会の枠組みや\n強烈なプレッシャー" }, { word: "知性の\n濾過器", desc: "感情を排した\n精密な分析と純化" }, { word: "極限の\n蓄積", desc: "岩盤を砕くほどの\n圧倒的なポテンシャル" } ]
                },
                resonance: [
                    { title: "ビジネスパートナーなら", give: "絶対に崩壊しない実務基盤と冷徹なリスク管理を提供。相手の暴走を受け止める安全な着陸地点となります。", take: "あなたに欠けている「自己アピール」や「ゼロから熱狂を生む力」を持ち、堂々と旗を振る突破力が必要です。", matches: [ { name: "No.43 赫陽", desc: "光の中心で旗を掲げ続ける理念先導者" }, { name: "No.51 蒼槍", desc: "信念を最前線で貫く直進型開拓旗手" } ], note: "※あなたが表に出る必要はありません。彼らを泳がせることで無敵の帝国が完成します。" },
                    { title: "恋愛・人生のパートナーなら", give: "一時的な感情の波に左右されない、何十年も続く静かで揺るぎない「生活の絶対的な安定と深い庇護」を与えます。", take: "重圧を抱え込みがちなあなたの心の氷をゆっくりと溶かす、急かさない温かさと持続的な愛情を持つ人が最適です。", matches: [ { name: "No.14 紅穏", desc: "慎重に温度を保つ内省型持続者" }, { name: "No.20 玄育", desc: "静かに縁を育てる循環型支援者" } ], note: "※言葉にしなくてもあなたの重い鎧を静かに外し、深い安心感を与えてくれる存在です。" },
                    { title: "友人・交友関係なら", give: "無駄な馴れ合いを省いた、極めて客観的で本質を突くアドバイスにより、友人の真の危機を救う「最後の砦」となります。", take: "浅い世間話ではなく、哲学や美意識、未来予測について、沈黙すら心地よいレベルで深く語り合える知性や柔軟性。", matches: [ { name: "No.10 玄審", desc: "本質を見抜き純度を高める静謐な鑑定士" }, { name: "No.16 柔整", desc: "柔軟に場を整える調整型実務者" } ], note: "※お互いに干渉しすぎず、大人の知的なキャッチボールができる関係性を築けます。" },
                    { title: "人生の師匠（メンター）なら", give: "師匠が描く壮大で抽象的なビジョンを、実務レベルで寸分の狂いもなく完璧に組み上げる「最強の実行部隊」となります。", take: "あなたが陥りやすい「狭く深すぎる視野」を広げ、あなたが構築した基盤を社会規模にスケールアップさせる「大局観」。", matches: [ { name: "No.29 蒼嶺", desc: "水脈を束ね大局を描く統合型構想者" }, { name: "No.49 蒼海", desc: "流れを制して時代を動かす知略統率者" } ], note: "※彼らの高い視座を取り入れることで、あなたが作るシステムは一気に巨大な帝国へと成長します。" }
                ],
                parameter: {
                    stats: [30, 15, 100, 90, 65],
                    tooltips: [ "[30] 軽薄に動かない重厚なポテンシャル", "[LOW 15] 自己アピールは他者に任せるのが大正解", "[MAX 100] 誰も真似できない絶対的基盤構築", "[EXCELLENT 90] 長期を見通す深い洞察と濾過力", "[65] 必要な縁だけを静かに守り抜く力" ],
                    p1: "データが明確に示している通り、あなたの才能は<strong>「構築・管理力」</strong>と<strong>「知略・分析力」</strong>に極端に振り切れています。日常や仕事のシーンで言えば、「誰もやりたがらない煩雑なルールの整備」「属人化している業務のシステム化」「数年先の資産運用計画」などにおいて、あなたは感情に流されることなく、狂いのない精度で完遂します。",
                    p2: "一方で、「表現・発信力」や瞬間的な「推進・行動力」は意図的に低く出ています。アイデアを即座に形にしてSNS等で派手にアピールする人々を見て、焦燥感を抱くこともあるでしょう。<br>しかし、今日からその自己否定は完全に捨ててください。「軽薄に動かないこと、安易に喋らないこと」こそが、あなたの最大の武器なのです。自己アピールにエネルギーを浪費しないからこそ、実務とインフラ構築の極致に到達できる。あなたの沈黙は無知ではなく、深い思考と計算の証です。"
                },
                strategy: {
                    good: [ "数年〜数十年単位の「長期的なビジョンと蓄積」が求められるプロジェクト。", "誰もやりたがらないが、組織にとって「絶対に崩れてはならない」基盤整備や根幹の制度設計。" ],
                    bad: [ "「とりあえず今すぐやって」といった、行き当たりばったりで即効性のみを求められるアジャイル型の現場。", "中身や実態のない「過剰な自己アピール」や「ノリの良さ」ばかりが評価される軽薄な組織。" ]
                },
                message: [
                    "「静かであることは、決して弱いということではない。」",
                    "世の中は常に、声の大きい者や動きの速い者を評価しがちです。\n社会のスピードが異常に加速する現代において、\n時間をかけて「本物」を構築しようとするあなたの歩みは、時にひどく孤独に感じられることでしょう。",
                    "しかし、忘れないでください。\nハリボテの城は、嵐が来れば一瞬で崩れ去ります。\nそのとき、吹き荒れる風の中で人々が最後にすがりつくのは、あなたが静かに、しかし執念深く築き上げてきた「揺るぎない基盤」なのです。",
                    "あなたの人生は「大器晩成」であり、データを蓄積するごとに圧倒的な価値と権力を帯びていきます。",
                    "誇り高く、自分の思考の重さを信じ抜き、あなただけの「盤石なる帝国」を築き上げてください。"
                ]
            };
        }