'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Hexagon, Merge, Share2, Sun, Lock } from 'lucide-react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const THEME_COLORS: Record<string, { bg: string; main: string; sub: string }> = {
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

function hexToRgba(hex: string, alpha: number) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Fallback logic
function getFallbackData() {
    return {
        id: "50", jukkan: "癸", kanji: "玄盤", ruby: "GENBAN", catchcopy: "静水深流で基盤を支える蓄積型構築者",
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

function DiagnosticContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [data, setData] = useState<any>(null);
    const [theme, setTheme] = useState(THEME_COLORS['癸']);
    const [userRank, setUserRank] = useState('arrival');
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const loadData = async () => {
            try {
                const profileRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
                const snap = await getDoc(profileRef);
                let rank = 'arrival';
                let osId = searchParams.get('osId');

                if (snap.exists()) {
                    const profData = snap.data();
                    rank = profData.membershipRank || 'arrival';
                    if (!osId) osId = profData.osNumber ? String(profData.osNumber) : "50";
                }
                if (localStorage.getItem('isAdminMock') === 'true' || rank === 'admin') {
                    rank = 'admin';
                    if (!osId) osId = "50";
                }

                setUserRank(rank);

                const docRef = doc(db, 'artifacts', APP_ID, 'os_blueprints', String(osId));
                const docSnap = await getDoc(docRef);
                
                let blueprintData;
                if (docSnap.exists()) {
                    blueprintData = docSnap.data();
                } else {
                    blueprintData = getFallbackData();
                }

                setTheme(THEME_COLORS[blueprintData.jukkan || '癸'] || THEME_COLORS['癸']);
                setData(blueprintData);
            } catch (error) {
                console.error(error);
                setData(getFallbackData());
            } finally {
                setTimeout(() => setIsDataLoading(false), 800);
            }
        };

        loadData();
    }, [user, loading, router, searchParams]);

    if (loading || isDataLoading || !data) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-800" style={{ backgroundColor: theme.bg, color: theme.main }}>
                <div className="w-10 h-10 border-2 border-transparent rounded-full animate-spin mb-4" style={{ borderTopColor: theme.main, borderColor: `rgba(255,255,255,0.1) rgba(255,255,255,0.1) rgba(255,255,255,0.1) ${theme.main}` }}></div>
                <div className="font-serif tracking-[0.3em] text-xs">ANALYZING SOUL OS...</div>
            </div>
        );
    }

    const SynIcons = [Hexagon, Merge, Share2, Sun];

    const radarOptions = {
        scales: {
            r: {
                min: 0,
                max: 100,
                beginAtZero: true,
                angleLines: { color: 'rgba(255, 255, 255, 0.05)' }, 
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { font: { size: 12, weight: 'bold' as const, family: "'Zen Kaku Gothic New', sans-serif" }, color: '#E2E8F0' },
                ticks: { display: false, stepSize: 20 }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(13, 19, 38, 0.95)', 
                titleFont: { size: 14, family: "'Noto Serif JP', serif" },
                bodyFont: { size: 13, family: "'Zen Kaku Gothic New', sans-serif" }, 
                borderColor: theme.main, 
                borderWidth: 1, 
                padding: 15, 
                callbacks: { 
                    label: (ctx: any) => " " + data.parameter.tooltips[ctx.dataIndex]
                }
            }
        },
        animation: { duration: 2500, easing: 'easeOutQuart' as const }
    };

    const radarData = {
        labels: ['推進・行動力', '表現・発信力', '構築・管理力', '知略・分析力', '共感・調和力'],
        datasets: [{
            data: data.parameter.stats,
            backgroundColor: hexToRgba(theme.main, 0.15),
            borderColor: theme.main,
            pointBackgroundColor: theme.main,
            pointBorderColor: theme.bg,
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: theme.main,
            borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
            fill: true
        }]
    };

    const p4Lines = data.origin.p4 ? data.origin.p4.split('\n') : [];

    return (
        <div style={{ backgroundColor: theme.bg, color: '#E2E8F0' }} className="min-h-screen font-sans leading-loose tracking-widest transition-colors duration-800 overflow-x-hidden p-6 md:p-10 pb-32">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => router.push('/user')} className="inline-flex items-center gap-2 mb-8 text-sm tracking-widest transition-opacity hover:opacity-70" style={{ color: theme.sub }}>
                    <ArrowLeft size={16} /> マイページに戻る
                </button>

                <section className="text-center py-5 pb-16 border-b border-white/10 mb-20 animate-fade-in-up">
                    <div className="inline-block border px-6 py-2 text-xs md:text-sm tracking-widest rounded-full mb-8 whitespace-nowrap" style={{ borderColor: theme.sub, color: theme.sub }}>
                        PERSONAL BEHAVIORAL OS | No.{data.id} {data.kanji}
                    </div>
                    <div className="font-serif tracking-[0.6em] text-sm md:text-base mb-2" style={{ color: theme.main }}>{data.ruby}</div>
                    <h1 className="text-5xl md:text-7xl font-serif text-white tracking-[0.15em] my-4 whitespace-nowrap" style={{ textShadow: `0 0 40px ${theme.main}` }}>{data.kanji}</h1>
                    <div className="text-base md:text-xl italic mb-10 text-white break-words">{data.catchcopy}</div>
                    <div className="flex justify-center flex-wrap gap-2.5">
                        {data.keywords.map((kw: string) => (
                            <span key={kw} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded text-sm tracking-widest whitespace-nowrap" style={{ color: theme.sub }}>#{kw}</span>
                        ))}
                    </div>
                </section>

                <section className="mb-28 animate-fade-in-up">
                    <div className="text-center mb-12">
                        <span className="block font-serif tracking-[0.3em] text-xs md:text-sm mb-1" style={{ color: theme.sub }}>CHAPTER I : THE ORIGIN</span>
                        <h2 className="inline-block font-serif text-xl md:text-3xl text-white border-b border-white/10 pb-4 break-keep">魂の基本設計図（OS）と情景</h2>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-10 mb-12 shadow-2xl backdrop-blur-md text-center">
                        <div className="text-base md:text-lg italic text-white whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: data.origin.metaphor }} />
                    </div>

                    <div className="text-justify text-[#C9D1D9] text-base md:text-[1.05rem] leading-[2.2] space-y-7">
                        <p dangerouslySetInnerHTML={{ __html: data.origin.p1.replace(/「(.*?)」/g, `<span style="color:${theme.main};font-weight:bold">「$1」</span>`) }} />
                        <p dangerouslySetInnerHTML={{ __html: data.origin.p2.replace(/「(.*?)」/g, `<span style="color:${theme.main};font-weight:bold">「$1」</span>`) }} />
                        <p dangerouslySetInnerHTML={{ __html: data.origin.p3.replace(/「(.*?)」/g, `<span style="color:${theme.main};font-weight:bold">「$1」</span>`) }} />
                    </div>

                    {p4Lines.length > 0 && (
                        <div className="mt-12 mb-12 p-6 sm:p-8 bg-white/5 border border-white/10 rounded-lg relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b" style={{ backgroundImage: `linear-gradient(to bottom, ${theme.main}, ${theme.sub})` }}></div>
                            <div className="relative z-10 space-y-6">
                                {p4Lines.map((line: string, i: number) => {
                                    const match = line.match(/^【(.*?)】\s*(.*)$/);
                                    if (match) {
                                        return (
                                            <div key={i}>
                                                <h4 className="inline-flex items-center px-3 py-1 bg-black/50 border text-xs font-bold tracking-widest rounded-sm mb-3 shadow-md" style={{ borderColor: theme.sub, color: theme.sub }}>
                                                    {match[1]}
                                                </h4>
                                                <p className="text-[1.05rem] text-[#C9D1D9] leading-[2.0] text-justify">{match[2]}</p>
                                            </div>
                                        )
                                    }
                                    return <p key={i} className="text-[1.05rem] text-[#C9D1D9] leading-[2.0] text-justify">{line}</p>
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-center items-center gap-5 mt-16 p-10 md:p-12 bg-black/20 rounded-xl border border-white/10">
                        {data.origin.nodes.map((n: any, i: number) => (
                            <React.Fragment key={i}>
                                <div className="text-center w-full max-w-[250px] md:w-40">
                                    <div className="w-32 h-32 md:w-32 md:h-32 mx-auto rounded-full border flex items-center justify-center font-serif text-white bg-black/50 shadow-inner text-center whitespace-pre-wrap leading-relaxed mb-4" 
                                         style={{ borderColor: i === 2 ? theme.main : (i === 0 ? theme.sub : '#fff'), color: i === 2 ? theme.main : '#fff', textShadow: i === 2 ? `0 0 10px ${theme.main}` : 'none' }}>
                                        {n.word}
                                    </div>
                                    <div className="text-xs md:text-sm text-[#8BA2BC] whitespace-pre-wrap">{n.desc}</div>
                                </div>
                                {i < 2 && <div className="text-2xl md:text-3xl opacity-50 rotate-90 md:rotate-0 my-2 md:my-0" style={{ color: theme.sub }}>▶︎</div>}
                            </React.Fragment>
                        ))}
                    </div>
                </section>

                <section className="mb-28 animate-fade-in-up">
                    <div className="text-center mb-12">
                        <span className="block font-serif tracking-[0.3em] text-xs md:text-sm mb-1" style={{ color: theme.sub }}>CHAPTER II : THE RESONANCE</span>
                        <h2 className="inline-block font-serif text-xl md:text-3xl text-white border-b border-white/10 pb-4 break-keep">人間関係における役割と魂の共鳴</h2>
                    </div>
                    <div className="text-center text-sm md:text-base mb-10 text-[#E2E8F0]">
                        あなたの才能は他者と交わることで真の価値を発揮します。<br className="hidden md:block" />
                        <strong>「誰と組めば運命が劇的に加速するのか」</strong>を解き明かします。
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {data.resonance.map((res: any, i: number) => {
                            const Icon = SynIcons[i % 4];
                            return (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/30 transition-transform duration-300 hover:shadow-2xl group">
                                    <Icon className="w-8 h-8 mb-5 opacity-90" style={{ color: theme.sub }} />
                                    <h3 className="text-lg md:text-xl font-serif text-white mb-6 border-b border-white/10 pb-4 break-keep">{res.title}</h3>
                                    
                                    <div className="mb-6">
                                        <span className="block text-xs font-bold tracking-[0.1em] mb-2" style={{ color: theme.sub }}>【あなたの役割 (GIVE)】</span>
                                        <div className="text-[0.95rem] text-[#C9D1D9] leading-relaxed">{res.give}</div>
                                    </div>
                                    <div className="mb-6">
                                        <span className="block text-xs font-bold tracking-[0.1em] mb-2" style={{ color: theme.sub }}>【相手に求めるもの (TAKE)】</span>
                                        <div className="text-[0.95rem] text-[#C9D1D9] leading-relaxed">{res.take}</div>
                                    </div>

                                    <div className="relative mt-auto p-5 md:p-6 rounded-lg bg-black/25 border border-white/10 overflow-hidden">
                                        <span className="block text-xs font-bold tracking-[0.1em] mb-4" style={{ color: theme.main }}>▶︎ 最高の化学反応を起こす相手</span>
                                        <div className={`transition-all duration-400 ease-in-out ${userRank === 'arrival' ? 'filter blur-[6px] opacity-30 select-none pointer-events-none' : ''}`}>
                                            {res.matches.map((m: any, idx: number) => {
                                                const osMatch = m.name.match(/No\.(\d+)/);
                                                const osNum = osMatch ? osMatch[1] : '';
                                                return (
                                                    <div key={idx} className="text-[0.95rem] text-white mb-2 leading-relaxed">
                                                        {osNum ? (
                                                            <a href={`/search?osNumber=${osNum}`} className="font-bold mr-2 font-serif tracking-[0.05em] underline underline-offset-4 hover:opacity-80 transition-opacity" style={{ color: theme.main }}>{m.name}</a>
                                                        ) : (
                                                            <span className="font-bold mr-2 font-serif tracking-[0.05em]" style={{ color: theme.main }}>{m.name}</span>
                                                        )}
                                                        {m.desc}
                                                    </div>
                                                )
                                            })}
                                            <div className="text-xs text-[#8BA2BC] mt-4 pt-3 border-t border-dashed border-white/10">{res.note}</div>
                                        </div>
                                        
                                        {userRank === 'arrival' && (
                                            <div onClick={() => router.push('/upgrade')} className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 opacity-100 hover:opacity-90 cursor-pointer transition-opacity text-center">
                                                <Lock className="w-6 h-6 mb-2 text-white/80" />
                                                <div className="text-sm font-bold tracking-[0.1em] text-white">SETTLER以上で解放</div>
                                                <div className="text-xs text-white/50 mt-1 underline">契約を変更して確認する</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section className="mb-28 animate-fade-in-up">
                    <div className="text-center mb-12">
                        <span className="block font-serif tracking-[0.3em] text-xs md:text-sm mb-1" style={{ color: theme.sub }}>CHAPTER III : THE PARAMETER</span>
                        <h2 className="inline-block font-serif text-xl md:text-3xl text-white border-b border-white/10 pb-4 break-keep">才能の五次元解析と美しき偏り</h2>
                    </div>

                    <div className="max-w-[500px] mx-auto mb-10">
                        <Radar data={radarData} options={radarOptions} />
                    </div>

                    <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl backdrop-blur-md text-justify text-[#C9D1D9] text-base md:text-[1.05rem] leading-[2.2]">
                        <p className="mb-6" dangerouslySetInnerHTML={{ __html: data.parameter.p1 }} />
                        <p className="mb-0" dangerouslySetInnerHTML={{ __html: data.parameter.p2.replace(/「(.*?)」/g, `<span style="color:${theme.main};font-weight:bold">「$1」</span>`) }} />
                    </div>
                </section>

                <section className="mb-28 animate-fade-in-up">
                    <div className="text-center mb-12">
                        <span className="block font-serif tracking-[0.3em] text-xs md:text-sm mb-1" style={{ color: theme.sub }}>CHAPTER IV : THE STRATEGY</span>
                        <h2 className="inline-block font-serif text-xl md:text-3xl text-white border-b border-white/10 pb-4 break-keep">現実世界でのサバイバル戦略</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-8 md:p-10 rounded-2xl relative overflow-hidden bg-white/5 border border-white/10">
                            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                            <h3 className="text-[#10B981] text-lg md:text-xl font-serif mb-6 break-keep relative z-10">⭕️ 才能が覚醒する絶対領域</h3>
                            <ul className="list-disc pl-5 text-[#E2E8F0] text-sm md:text-[0.95rem] leading-[1.8] relative z-10 space-y-4">
                                {data.strategy.good.map((s: string, i: number) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div className="p-8 md:p-10 rounded-2xl relative overflow-hidden bg-white/5 border border-white/10">
                            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                            <h3 className="text-[#EF4444] text-lg md:text-xl font-serif mb-6 break-keep relative z-10">❌ 才能が枯渇する禁忌</h3>
                            <ul className="list-disc pl-5 text-[#E2E8F0] text-sm md:text-[0.95rem] leading-[1.8] relative z-10 space-y-4">
                                {data.strategy.bad.map((s: string, i: number) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="animate-fade-in-up">
                    <div className="text-center mb-12">
                        <span className="block font-serif tracking-[0.3em] text-xs md:text-sm mb-1" style={{ color: theme.sub }}>CHAPTER V : THE MESSAGE</span>
                        <h2 className="inline-block font-serif text-xl md:text-3xl text-white border-b border-white/10 pb-4 break-keep">プロファイラーからの最終宣告</h2>
                    </div>

                    <div className="text-center p-10 md:p-16 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)] border-y border-white/10">
                        <div className="text-base md:text-lg text-white font-serif leading-[2.2] space-y-7">
                            {data.message.map((m: string, i: number) => (
                                <p key={i} dangerouslySetInnerHTML={{ __html: m.replace(/\n/g, '<br className="hidden md:inline" />') }} />
                            ))}
                        </div>
                        <div className="mt-16 font-serif tracking-[0.2em] text-sm md:text-base" style={{ color: theme.sub }}>
                            THE HUMAN BEHAVIORAL OS PROFILER
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default function DiagnosticPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#060913] flex items-center justify-center text-white">Loading...</div>}>
            <DiagnosticContent />
        </Suspense>
    );
}
