'use client';

import React, { useState, useEffect, useRef, Suspense, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage, APP_ID } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, getDocs, getCountFromServer, query, where, setDoc, deleteDoc, serverTimestamp, addDoc, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Anchor, LogOut, Camera, CheckCircle, XCircle, AlertCircle, Globe, Instagram, Twitter, MessageCircle, Heart, Share, ShieldHalf, LayoutDashboard, Crown, User as UserIcon, Settings, Lock, FileText, Compass, Settings2, Pencil, Copy, Image, Film, Play, Headphones, Dna, Unlock, ChevronRight, Check, Key, Plus, List, Gavel, Hammer, Home, SatelliteDish, CalendarHeart, Bell, CalendarDays, Repeat2, Hash, AtSign } from 'lucide-react';

import FollowModal from '@/components/FollowModal';
import KeyMemoModal from '@/components/KeyMemoModal';
import PlaylistModal from '@/components/PlaylistModal';
import PlaylistDetailModal from '@/components/PlaylistDetailModal';
import NotificationModal from '@/components/NotificationModal';
import SettingsModal from '@/components/SettingsModal';
import EventsCalendarModal from '@/components/EventsCalendarModal';
import EventDetailSheet from '@/components/EventDetailSheet';
import { PostImageGrid } from '@/components/ImageLightbox';

import { marked } from 'marked';
import DOMPurify from 'dompurify';

function formatText(text: string) {
    if (!text) return '';
    try {
        const textStr = String(text).replace(/__(.*?)__/g, '<u>$1</u>');
        const rawHtml = marked.parse(textStr, { breaks: true, gfm: true }) as string;
        if (typeof window === 'undefined') {
            return rawHtml;
        }
        return DOMPurify.sanitize(rawHtml, { 
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        });
    } catch {
        if (typeof window === 'undefined') return String(text).replace(/\n/g, '<br>');
        return DOMPurify.sanitize(String(text).replace(/\n/g, '<br>'));
    }
}

const OS_THEMES: Record<string, { bg: string, main: string, sub: string }> = {
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


const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];


function calculateOsNumber(dateStr: string) {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const diff = Math.floor((Date.UTC(y,m,d) - Date.UTC(1900,1,20)) / 86400000);
  return ((diff % 60) + 60) % 60 + 1;
}

function getRankBadge(rank: string) {
    const r = rank?.toLowerCase() || 'arrival';
    if (r === 'covenant') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d4af37]/20 text-[#8b6508] border border-[#d4af37]/50 tracking-widest"><ShieldHalf size={10} className="mr-1"/>COVENANT</span>;
    if (r === 'guardian') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3e2723]/10 text-[#3e2723] border border-[#3e2723]/30 tracking-widest"><Gavel size={10} className="mr-1"/>GUARDIAN</span>;
    if (r === 'builder') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8b6a4f]/10 text-[#8b6a4f] border border-[#8b6a4f]/30 tracking-widest"><Hammer size={10} className="mr-1"/>BUILDER</span>;
    if (r === 'settler') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8b9a6]/20 text-[#725b3f] border border-[#c8b9a6]/50 tracking-widest"><Home size={10} className="mr-1"/>SETTLER</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7f5f0] text-[#a09080] border border-[#e8dfd1] tracking-widest"><Anchor size={10} className="mr-1"/>ARRIVAL</span>;
}

function getMbtiBadge(mbti?: string | null) {
    if (!mbti || mbti === '未設定') return null;
    const analysts = ['INTJ', 'INTP', 'ENTJ', 'ENTP'];
    const diplomats = ['INFJ', 'INFP', 'ENFJ', 'ENFP'];
    const sentinels = ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'];
    const explorers = ['ISTP', 'ISFP', 'ESTP', 'ESFP'];
    
    const names: Record<string, string> = {
        'INTJ': '建築家', 'INTP': '論理学者', 'ENTJ': '指揮官', 'ENTP': '討論者',
        'INFJ': '提唱者', 'INFP': '仲介者', 'ENFJ': '主人公', 'ENFP': '運動家',
        'ISTJ': '管理者', 'ISFJ': '擁護者', 'ESTJ': '幹部', 'ESFJ': '領事',
        'ISTP': '巨匠', 'ISFP': '冒険家', 'ESTP': '起業家', 'ESFP': 'エンターテイナー'
    };
    
    let colorClass = 'bg-[#f7f5f0] text-[#725b3f] border-[#e8dfd1]';
    if (analysts.includes(mbti)) colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
    if (diplomats.includes(mbti)) colorClass = 'bg-green-50 text-green-700 border-green-200';
    if (sentinels.includes(mbti)) colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (explorers.includes(mbti)) colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';

    const displayName = names[mbti] ? `${mbti} (${names[mbti]})` : mbti;

    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border tracking-widest font-mono shadow-sm ${colorClass}`}>{displayName}</span>;
}


const MBTI_DESCRIPTIONS: Record<string, string> = {
  INTJ: '独創的な戦略家。高い目標に向かって計画を立て粛々と実行する。知識と能力を重んじ、非効率を嫌う。',
  INTP: '知的好奇心旺盛な思索家。理論と可能性を探求し、複雑な問題を解くことに喜びを見出す論理の追求者。',
  ENTJ: '生まれついてのリーダー。大きなビジョンを描き、組織を動かして目標を達成する圧倒的な推進力を持つ。',
  ENTP: '知的な挑戦者。アイデアを議論し既成概念を覆すことを楽しむ。可能性と革新を常に追いかける発明家。',
  INFJ: '理想主義的なビジョナリー。深い洞察と高い共感力で、世界をより良くしたいと願う完璧主義の提唱者。',
  INFP: '感受性豊かな理想家。自分の価値観に正直に生き、真の人間関係と人生の意味を深く大切にする内省者。',
  ENFJ: '人を動かすカリスマ。共感力が高く、周囲の可能性を引き出すことに喜びを感じる天性のリーダー。',
  ENFP: 'エネルギッシュな自由人。創造力と熱意で周囲を鼓舞し、可能性と繋がりに満ちた未来を描く冒険者。',
  ISTJ: '誠実な責任感の持ち主。事実と規律を重んじ、約束を必ず果たす信頼の柱。強い職業倫理を持つ。',
  ISFJ: '思いやりある守り人。大切な人を陰ながら支え、穏やかで安心できる環境を守ることを大切にする。',
  ESTJ: '秩序ある指導者。ルールと組織を大切にし、効率的に物事を進める実行力と決断力の持ち主。',
  ESFJ: '調和を大切にするケア役。人間関係のハーモニーを保ち、みんなが笑顔でいられる環境を作る世話役。',
  ISTP: '冷静な問題解決者。仕組みを理解し手を動かして問題を解く、柔軟で合理的な実践家。',
  ISFP: '感性鋭い芸術家。今この瞬間を大切にし、自分らしさを静かに表現する自由で穏やかな魂。',
  ESTP: '行動派のリアリスト。リスクをものともせず今ここで結果を出す、エネルギー溢れる行動の人。',
  ESFP: '場を明るくする天才。人生を祝祭として捉え、周囲を元気にする天性の魅力と社交性を持つ。',
};

const SKILL_CATEGORIES_V: Record<string, string[]> = {
  '💻 IT・エンジニアリング': ['Web制作','WordPress','Firebase','ノーコード (Bubble等)','ローコード','アプリ開発','プログラミング (フロントエンド)','プログラミング (バックエンド)','インフラ・サーバー','データ分析','AI・機械学習活用','UI/UXデザイン','セキュリティ'],
  '🎨 クリエイティブ・デザイン': ['グラフィックデザイン','Webデザイン','ロゴ作成','イラストレーション','動画撮影','動画編集','写真撮影','画像加工','3Dモデリング','アニメーション','サウンドクリエイト','コピーライティング','シナリオライティング'],
  '💼 ビジネス・企画': ['起業','経営・マネジメント','新規事業立案','事業戦略','マーケティング','デジタルマーケティング','SEO/SEM','SNS運用','広告運用','広報・PR','営業','BtoBセールス','BtoCセールス','カスタマーサクセス','人事・採用','組織開発','経理・財務','法務・知財'],
  '🎤 対人・コミュニケーション': ['プレゼンテーション','ファシリテーション','講師・セミナー登壇','コーチング','メンタリング','コンサルティング','交渉・ネゴシエーション','インタビュー・取材','イベント企画・運営','コミュニティマネジメント'],
  '🌐 語学・グローバル': ['英語 (日常会話)','英語 (ビジネス)','中国語','韓国語','スペイン語','フランス語','その他外国語','翻訳・通訳','海外ビジネス展開'],
  '🌿 ライフスタイル・その他': ['料理指導','栄養指導','整理収納','ファイナンシャルプランニング','フィットネストレーナー','マインドフルネス指導','キャリアコンサルティング','動画配信 (YouTuber等)','VTuber','インフルエンサー'],
};

const HOBBY_CATEGORIES_V: Record<string, string[]> = {
  '🏃 スポーツ・運動系': ['ランニング','ウォーキング','筋トレ','ヨガ','ピラティス','ダンス','バスケットボール','サッカー','フットサル','野球','テニス','バドミントン','卓球','ゴルフ','ボルダリング','登山','サーフィン','スノーボード','スキー','サイクリング','水泳','格闘技','武道','マラソン','トライアスロン'],
  '🎵 音楽・エンタメ': ['カラオケ','楽器演奏（ギター）','楽器演奏（ピアノ）','楽器演奏（その他）','作曲・DTM','歌','バンド活動','ライブ鑑賞','フェス','DJ','映画鑑賞','アニメ鑑賞','漫画','ゲーム','ボードゲーム','謎解き','マジック','お笑い鑑賞','舞台鑑賞','ミュージカル','クラシック音楽'],
  '🎨 文化・アート': ['絵画','イラスト','デザイン','写真撮影','動画編集','手芸','DIY','小説執筆','ブログ','書道','華道','茶道','陶芸','美術館巡り'],
  '📚 学び・教養': ['読書','自己啓発','歴史','心理学','投資・資産運用','マーケティング','プログラミング','語学学習（英語）','語学学習（その他）','資格取得','経済','政治','哲学','科学'],
  '🍳 食・暮らし': ['料理','お菓子作り','パン作り','カフェ巡り','食べ歩き','お酒','ワイン','日本酒','クラフトビール','コーヒー','紅茶','お茶','インテリア','ミニマリズム','ガーデニング','観葉植物','ペット','サウナ','銭湯'],
  '✈️ 旅行・お出かけ': ['国内旅行','海外旅行','一人旅','キャンプ','グランピング','温泉巡り','神社仏閣巡り','御朱印集め','ドライブ','ツーリング','ツーリング（自転車）','テーマパーク'],
  '🤝 コミュニティ・人': ['交流会','イベント主催','ボランティア','地域活動','コーチング','子育て','メンタリング','NPO活動'],
  '🌿 その他': ['瞑想','マインドフルネス','占い','スピリチュアル','その他'],
};
// SettingsMenu — gear button (opens SettingsModal)
// placement='sidebar': fixed bottom-left (PC sidebar footer)
// placement='topbar':  absolute dropdown below button (mobile topbar)
function SettingsMenu({ variant = 'dark', onOpenSettings }: { variant?: 'dark' | 'light'; placement?: 'sidebar' | 'topbar'; onOpenSettings: () => void }) {
  const isDark = variant === 'dark';
  const btnStyle: React.CSSProperties = isDark
    ? { width:32, height:32, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'#d4ead9', cursor:'pointer' }
    : { width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7aab88', cursor:'pointer' };

  return (
    <button type="button" onClick={onOpenSettings} style={btnStyle} title="設定">
      <Settings size={isDark ? 13 : 14} />
    </button>
  );
}

// Extracted Profile Content Component to use useSearchParams inside Suspense
function UserProfileContent() {
  const searchParams = useSearchParams();
  const uidParam = searchParams.get('uid');
  const { user } = useAuth();
  const router = useRouter();
  
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [osData, setOsData] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [isPlaylistDetailOpen, setIsPlaylistDetailOpen] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<any>(null);
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal]         = useState(false);
  const [showEventsModal, setShowEventsModal]             = useState(false);
  const [activityDetailEvent, setActivityDetailEvent]     = useState<any>(null);

  // === FLIP EDIT STATES ===
  const [isEditing, setIsEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string|null>(null);
  // edit form fields
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File|null>(null);
  const [editName, setEditName] = useState('');
  const [editRealName, setEditRealName] = useState('');
  const [editFurigana, setEditFurigana] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editPrefecture, setEditPrefecture] = useState('');
  const [editBirthplace, setEditBirthplace] = useState('');
  const [editGender, setEditGender] = useState('無回答');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editBirthVisibility, setEditBirthVisibility] = useState('full');
  const [editBio, setEditBio] = useState('');
  const [showMdHelp, setShowMdHelp] = useState(false);
  // Flip card height measurement
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const [flipHeight, setFlipHeight] = useState(0);
  const [flipPhase, setFlipPhase] = useState<string>('');
  // Section inline edit states
  const [editingSection, setEditingSection] = useState<'expression'|'personality'|'skills'|'matching'|'career'|null>(null);
  const [secFlipPhase, setSecFlipPhase] = useState('');
  const [secEditMessage, setSecEditMessage] = useState('');
  const [secEditMbti, setSecEditMbti] = useState('未設定');
  const [secEditSkills, setSecEditSkills] = useState<string[]>([]);
  const [secEditCustomSkills, setSecEditCustomSkills] = useState('');
  const [secEditHobbies, setSecEditHobbies] = useState<string[]>([]);
  const [secEditCustomHobbies, setSecEditCustomHobbies] = useState('');
  const [secEditCanOffer, setSecEditCanOffer] = useState('');
  const [secEditLookingFor, setSecEditLookingFor] = useState('');
  const [secSaving, setSecSaving] = useState(false);
  const [secEditError, setSecEditError] = useState<string|null>(null);
  // Career inline edit
  type CareerItemV = {company:string;role:string;start:string;end:string;description:string};
  const [secEditCareer, setSecEditCareer] = useState<CareerItemV[]>([]);


  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);
  const [followModalType, setFollowModalType] = useState<'following'|'followers'|'mutual'|null>(null);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'media' | 'activity' | 'threads'>('profile');
  const [mediaTab, setMediaTab] = useState<'videos' | 'podcasts' | 'articles' | 'playlists' | 'liked'>('videos');

  // ── 活動タブ用 state ──────────────────────────────────────────
  const [activityJoined,  setActivityJoined]  = useState<any[]>([]);
  const [activityHosted,  setActivityHosted]  = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded,  setActivityLoaded]  = useState(false);
  const [featuredEventIds,setFeaturedEventIds]= useState<string[]>([]);
  const [pinSaving,       setPinSaving]       = useState<string|null>(null);
  const [actRoleFilter,   setActRoleFilter]   = useState<'all'|'joined'|'hosted'>('all');
  const [actPeriodFilter, setActPeriodFilter] = useState<'all'|'past'|'upcoming'>('all');

  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [userPodcasts, setUserPodcasts] = useState<any[]>([]);
  const [userArticles, setUserArticles] = useState<any[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  // ── スレッドタブ用 state ──────────────────────────────────────
  const [userThreads, setUserThreads] = useState<any[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);

  // ── 活動タブ: データ取得 ─────────────────────────────────────
  const loadActivityData = async (uid: string, profId: string) => {
    if (activityLoaded || activityLoading) return;
    setActivityLoading(true);
    try {
      // 参加イベント（endTimestamp フィルターなし・全件）
      const joinSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', uid, 'participating_events'));
      const joinPromises = joinSnap.docs.map(async jd => {
        try {
          const es = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', jd.id));
          if (es.exists()) return { id: es.id, role: 'joined', ...es.data() };
        } catch { /* skip */ }
        return null;
      });
      const joined = (await Promise.all(joinPromises)).filter(Boolean) as any[];
      joined.sort((a,b)=>new Date(b.startDate||0).getTime()-new Date(a.startDate||0).getTime());
      setActivityJoined(joined);

      // 主催イベント（endTimestamp フィルターなし・全件）
      const evSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'events'));
      const hosted: any[] = [];
      evSnap.forEach(d => {
        const ev = d.data();
        if (ev.organizerId===uid||ev.organizerId===profId||ev.authorId===uid)
          hosted.push({ id: d.id, role: 'hosted', ...ev });
      });
      hosted.sort((a,b)=>new Date(b.startDate||0).getTime()-new Date(a.startDate||0).getTime());
      setActivityHosted(hosted);

      // featuredEventIds を公開プロフィールから読む
      const pubSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid));
      if (pubSnap.exists()) setFeaturedEventIds(pubSnap.data().featuredEventIds || []);
      setActivityLoaded(true);
    } catch(e) { console.error('loadActivityData error', e); }
    finally { setActivityLoading(false); }
  };

  // ── ピン留めトグル ───────────────────────────────────────────
  const togglePin = async (eventId: string) => {
    if (!user) return;
    setPinSaving(eventId);
    const next = featuredEventIds.includes(eventId)
      ? featuredEventIds.filter(id=>id!==eventId)
      : [...featuredEventIds, eventId];
    await updateDoc(doc(db,'artifacts',APP_ID,'public','data','users',user.uid),{featuredEventIds:next});
    setFeaturedEventIds(next);
    setPinSaving(null);
  };

  // ── スレッドデータ取得 ────────────────────────────────────────
  const loadThreadsData = async (uid: string) => {
    if (threadsLoaded || threadsLoading) return;
    setThreadsLoading(true);
    try {
      const postsSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
      const posts: any[] = [];
      postsSnap.forEach(d => {
        const data = d.data();
        if (data.authorId === uid && (data.parentId === null || data.parentId === undefined)) {
          posts.push({ id: d.id, ...data });
        }
      });
      posts.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return tB - tA;
      });
      setUserThreads(posts);
      setThreadsLoaded(true);
    } catch (e) { console.error('loadThreadsData error', e); }
    finally { setThreadsLoading(false); }
  };

  // ── タブ切替ハンドラ ─────────────────────────────────────────
  const handleTabChange = (tab: 'profile'|'media'|'activity'|'threads') => {
    setActiveTab(tab);
    if (tab==='activity' && !activityLoaded && targetUid && userData)
      loadActivityData(targetUid, userData.userId || targetUid);
    if (tab==='threads' && !threadsLoaded && targetUid)
      loadThreadsData(targetUid);
  };

    useEffect(() => {
    const isMock = typeof window !== 'undefined' && localStorage.getItem('isAdminMock') === 'true';
    async function loadData() {
      if (!user && !isMock) return;
      
      let targetId = uidParam || (user?.uid || 'admin_mock');
      
      // Clear data if we are switching users to prevent old data from sticking around on error
      if (targetId !== targetUid) {
          setUserData(null);
          setLoading(true);
      }
      
      setTargetUid(targetId);
      const selfViewing = targetId === (user?.uid || 'admin_mock');
      setIsSelf(selfViewing);
      
      try {
           const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetId);
           const publicSnap = await getDoc(publicRef);
           
           let loadedData: any = null;
           if (publicSnap.exists()) {
             loadedData = publicSnap.data();
           } else {
               // Resolution Fallback: Handle Legacy "Custom User ID" deep links
               const fallbackQuery = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), where('userId', '==', targetId));
               const fallbackSnap = await getDocs(fallbackQuery);
               if (!fallbackSnap.empty) {
                   const resolvedDoc = fallbackSnap.docs[0];
                   const realUid = resolvedDoc.id;
                   
                   loadedData = resolvedDoc.data();
                   
                   // Overwrite local trackers with the resolved precise Auth UID
                   targetId = realUid;
                   setTargetUid(realUid);
                   setIsSelf(realUid === (user?.uid || 'admin_mock'));
               }
           }
           
           let mutuallyFollowing = false;
           
           if (!selfViewing && user) {
               // Check relationships
               const myFollowingRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'following', targetId);
               const isFowSnap = await getDoc(myFollowingRef);
               const currentlyFollowing = isFowSnap.exists();
               setIsFollowing(currentlyFollowing);
               
               const followerRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'followers', targetId);
               const isFowBackSnap = await getDoc(followerRef);
               const currentlyFollowedBack = isFowBackSnap.exists();
               
               mutuallyFollowing = currentlyFollowing && currentlyFollowedBack;
               setIsMutual(mutuallyFollowing);
           } else {
               setIsMutual(false); // Do not show mutual UI for self
               mutuallyFollowing = true;
           }
           
           // Load private data if mutual, self, covenant, or admin
           let loadPrivData = mutuallyFollowing || loadedData?.membershipRank === 'covenant' || selfViewing;

           // Check Admin Hook
           let myAdmin = false;
           if (selfViewing && (loadedData?.membershipRank === 'admin' || loadedData?.userId === 'admin' || isMock)) {
               myAdmin = true;
           } else if (!selfViewing && user) {
               const myRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
               const mySnap = await getDoc(myRef);
               if (mySnap.exists() && (mySnap.data().membershipRank === 'admin' || mySnap.data().userId === 'admin')) myAdmin = true;
           }
           
           if (user?.uid === "Zm7FWRopJKVfyzbp8KXXokMFjNC3" || isMock) myAdmin = true;
           setIsAdmin(myAdmin);
           if (myAdmin) loadPrivData = true;

           if (loadPrivData) {
             try {
               const privateRef = doc(db, 'artifacts', APP_ID, 'users', targetId, 'profile', 'data');
               const privateSnap = await getDoc(privateRef);
               if (privateSnap.exists()) {
                   loadedData = { ...(loadedData || {}), ...privateSnap.data() };
               }
             } catch (privErr) {
               console.warn("Private data access denied or failed", privErr);
             }
           }
           
           setUserData(loadedData);
           
           if (loadedData?.osNumber) {
               const osRef = doc(db, 'artifacts', APP_ID, 'os_blueprints', String(loadedData.osNumber));
               const osSnap = await getDoc(osRef);
               if (osSnap.exists()) {
                   setOsData(osSnap.data());
               }
           }
        
        // Load Counts
        try {
          const fowColl = collection(db, 'artifacts', APP_ID, 'users', targetId, 'following');
          const countSnapFow = await getCountFromServer(fowColl);
          setFollowingCount(countSnapFow.data().count);
          
          const flerColl = collection(db, 'artifacts', APP_ID, 'users', targetId, 'followers');
          const countSnapFler = await getCountFromServer(flerColl);
          setFollowersCount(countSnapFler.data().count);
        } catch (countErr) {
          console.warn("Could not fetch user connection counts", countErr);
        }
        
      } catch (e) {
        console.error("Error loading profile:", e);
      } finally {
        setLoading(false);
      }
      return targetId;
    }
    
    async function loadUserMedia(uid: string) {
      if (!uid) return;
      setMediaLoading(true);
      try {
        // Videos
        const videosRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos');
        const vq = query(videosRef, where('authorId', '==', uid));
        const vSnap = await getDocs(vq);
        const videos = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        videos.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setUserVideos(videos);

        // Podcasts
        const podsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts');
        const pq = query(podsRef, where('authorId', '==', uid));
        const pSnap = await getDocs(pq);
        const pods = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        pods.sort((a: any, b: any) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
        setUserPodcasts(pods);

        // Articles
        const artSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'articles'));
        const arts: any[] = [];
        artSnap.forEach(d => {
          const data = d.data();
          if (data.authorId === uid && data.status === 'published') {
            arts.push({ id: d.id, ...data });
          }
        });
        arts.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        setUserArticles(arts);

        // Playlists
        const playRef = collection(db, 'artifacts', APP_ID, 'users', uid, 'playlists');
        const playSnap = await getDocs(playRef);
        const lists = playSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        lists.sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.createdAt || a.updatedAt || 0));
        setUserPlaylists(lists);

        // Liked items (self only)
        if (user && uid === user.uid) {
          const allLiked: any[] = [];
          // Liked videos
          const allVidSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'));
          const lvPromises = allVidSnap.docs.map(async (d) => {
            const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', d.id, 'likes', user.uid));
            if (lSnap.exists()) return { id: d.id, ...d.data(), _likeType: 'video' as const };
            return null;
          });
          const lvResults = (await Promise.all(lvPromises)).filter(Boolean);
          allLiked.push(...lvResults);

          // Liked podcasts
          const allPodSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'));
          const lpPromises = allPodSnap.docs.map(async (d) => {
            const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', d.id, 'likes', user.uid));
            if (lSnap.exists()) return { id: d.id, ...d.data(), _likeType: 'podcast' as const };
            return null;
          });
          const lpResults = (await Promise.all(lpPromises)).filter(Boolean);
          allLiked.push(...lpResults);

          // Liked articles
          const allArtSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'articles'));
          const laPromises = allArtSnap.docs.map(async (d) => {
            const data = d.data();
            if (data.status !== 'published') return null;
            try {
              const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'articles', d.id, 'likes', user.uid));
              if (lSnap.exists()) return { id: d.id, ...data, _likeType: 'article' as const };
            } catch {}
            return null;
          });
          const laResults = (await Promise.all(laPromises)).filter(Boolean);
          allLiked.push(...laResults);

          allLiked.sort((a: any, b: any) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
            return tB - tA;
          });
          setLikedItems(allLiked);
        }

      } catch (e) {
        console.error("Error loading user media:", e);
      } finally {
        setMediaLoading(false);
      }
    }

    if (user || isMock) {
        loadData().then((uid) => {
            if (uid) loadUserMedia(uid);
        });
    } else if (!loading) {
        setLoading(false);
    }
  }, [user, uidParam, mediaRefreshKey]);

  useEffect(() => {
      if (!targetUid) return;
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetUid);
      const unsub = onSnapshot(roomRef, (snap) => {
          if (snap.exists() && snap.data().status === 'live') {
              setIsLive(true);
          } else {
              setIsLive(false);
          }
      });
      return () => unsub();
  }, [targetUid]);


  const handleRankChange = async (newRank: string) => {
      if (!isAdmin || !targetUid) return;
      if (!confirm(`ユーザーのランクを「${newRank.toUpperCase()}」に変更しますか？`)) return;
      try {
          await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid), { membershipRank: newRank });
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data'), { membershipRank: newRank }, { merge: true });
          setUserData({ ...userData, membershipRank: newRank });
          alert('ランクの変更が完了しました');
      } catch (e) {
          console.error(e);
          alert('ランク変更時にエラーが発生しました。');
      }
  };

  const toggleFollow = async () => {
      if (!user || !targetUid || targetUid === user.uid) return;
      
      try {
          const myFollowingRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'following', targetUid);
          const targetFollowerRef = doc(db, 'artifacts', APP_ID, 'users', targetUid, 'followers', user.uid);
          
          if (isFollowing) {
              await deleteDoc(myFollowingRef);
              await deleteDoc(targetFollowerRef);
              setIsFollowing(false);
              setIsMutual(false);
              setFollowersCount(prev => Math.max(0, prev - 1));
          } else {
              const ts = serverTimestamp();
              await setDoc(myFollowingRef, { createdAt: ts });
              await setDoc(targetFollowerRef, { createdAt: ts });
              setIsFollowing(true);
              // Optimistically assuming they might follow you back is handled by the initial load.
              // For a simple toggle, just updating counts
              setFollowersCount(prev => prev + 1);

              // Inject Notification
              try {
                  await addDoc(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'notifications'), {
                      type: 'system',
                      title: '新しい共鳴者',
                      body: `${userData?.name || 'ユーザー'}さんがあなたをフォローしました。`,
                      link: `/p?uid=${user.uid}`,
                      isRead: false,
                      createdAt: Date.now()
                  });
              } catch (err) {
                  console.error("Failed to send notification", err);
              }
          }
      } catch(e) {
          console.error("Follow error", e);
      }
  };

  const handleLogout = async () => {
    const { auth: fireAuth } = await import('@/lib/firebase');
    const { signOut } = await import('firebase/auth');
    try { await signOut(fireAuth); router.push('/login'); } catch {}
  };

  const copyProfileLink = async () => {
      if (!user) return;
      const url = `${window.location.origin}/p?uid=${user.uid}`;
      let success = false;
      // 1) Modern Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
          try { await navigator.clipboard.writeText(url); success = true; } catch {}
      }
      // 2) Fallback: execCommand (works on http/localhost)
      if (!success) {
          try {
              const ta = document.createElement('textarea');
              ta.value = url;
              ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
              document.body.appendChild(ta);
              ta.focus(); ta.select();
              success = document.execCommand('copy');
              document.body.removeChild(ta);
          } catch {}
      }
      if (success) {
          setCopyLinkDone(true);
          setTimeout(() => setCopyLinkDone(false), 2000);
      } else {
          // Last resort: show the URL in a small toast they can manually copy
          prompt('以下のURLをコピーしてください：', url);
      }
  };

  if (loading) {
    return (
      <div>
        <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#1a3024] flex items-center justify-between px-4 z-40 border-b border-white/10">
          <span className="text-white font-black tracking-[0.2em] font-serif text-base">NOAH</span>
        </div>
        <div className="pt-14 lg:pt-0 text-center py-20 text-[#a09080] font-bold tracking-widest min-h-[50vh] flex items-center justify-center">Loading...</div>
      </div>
    );
  }


  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-[#fffdf9] p-8 rounded-sm shadow-md border border-[#e8dfd1] text-center max-w-sm mx-4">
              <UserIcon className="w-12 h-12 text-[#c8b9a6] mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#3e2723] mb-2 font-serif tracking-widest">ユーザーが見つかりません</h3>
              <p className="text-[#a09080] text-sm mb-6">IDが間違っているか、データが取得できませんでした。</p>
              <Link href="/user" className="inline-block w-full bg-[#3e2723] text-[#f7f5f0] font-bold py-3 rounded-sm hover:bg-[#2a1a17] transition-colors tracking-widest">自分のページに戻る</Link>
          </div>
      </div>
    );
  }

  // OS Cover logic
  const isProfileComplete = (userData.profileScore || 0) >= 100;
  const showOSCover = (isSelf || isMutual) && isProfileComplete && userData.osNumber;
  const STEM_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const calculatedStem = userData.osNumber ? STEM_LIST[(Number(userData.osNumber) - 1) % 10] : '癸';
  const osTheme = showOSCover ? OS_THEMES[calculatedStem] : OS_THEMES['癸'];

  const rank = userData.membershipRank || 'arrival';

  // Derived
  const playlists = userPlaylists || [];


  // === FLIP EDIT HANDLERS ===
  const openEdit = () => {
    if (!userData) return;
    // Pre-populate fields
    setEditPhotoURL(userData.photoURL || '');
    setEditPhotoFile(null);
    setEditName(userData.name || '');
    setEditRealName(userData.realName || '');
    setEditFurigana(userData.furigana || '');
    setEditJobTitle(userData.jobTitle || '');
    setEditPrefecture(userData.prefecture || '');
    setEditBirthplace(userData.birthplace || '');
    setEditGender(userData.gender || '無回答');
    setEditBirthDate(userData.birthDate || '');
    setEditBirthVisibility(userData.birthVisibility || 'full');
    setEditBio(userData.bio || '');
    // Animate: fold front away (first 300ms), then swap, then unfold back in
    setFlipPhase('flip-fold');
    setTimeout(() => {
      setIsEditing(true);
      setFlipPhase('flip-unfold'); // instantly at 90deg with back content
    }, 300);
    setTimeout(() => {
      setFlipPhase('flip-unfolding'); // animate back to 0deg
    }, 320);
    setTimeout(() => {
      setFlipPhase('');
    }, 650);
    // Scroll into view
    setTimeout(() => {
      document.querySelector('.flip-card-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Close edit with reverse animation
  const closeEdit = () => {
    setFlipPhase('flip-fold');
    setTimeout(() => {
      setIsEditing(false);
      setFlipPhase('flip-unfold');
    }, 300);
    setTimeout(() => {
      setFlipPhase('flip-unfolding');
    }, 320);
    setTimeout(() => {
      setFlipPhase('');
    }, 650);
  };

  // ── Section inline edit helpers ──
  const doSecFlip = (openSection: typeof editingSection, onMid: ()=>void) => {
    setSecFlipPhase('flip-fold');
    setTimeout(() => { onMid(); setSecFlipPhase('flip-unfold'); }, 300);
    setTimeout(() => { setSecFlipPhase('flip-unfolding'); }, 320);
    setTimeout(() => { setSecFlipPhase(''); }, 650);
    // If switching from another section, close it first
    if (editingSection && editingSection !== openSection) setEditingSection(null);
  };

  const openSectionEdit = (section: 'expression'|'personality'|'skills'|'matching'|'career') => {
    if (section === 'expression') {
      doSecFlip(section, () => { setSecEditMessage(userData?.message || ''); setEditingSection('expression'); });
    } else if (section === 'personality') {
      doSecFlip(section, () => { setSecEditMbti(userData?.mbti || '未設定'); setEditingSection('personality'); });
    } else if (section === 'skills') {
      const skills = Array.isArray(userData?.skills) ? userData.skills : (userData?.skills ? [userData.skills] : []);
      const hobbies = Array.isArray(userData?.hobbies) ? userData.hobbies : (userData?.hobbies ? [userData.hobbies] : []);
      doSecFlip(section, () => {
        setSecEditSkills(skills.filter((s:string) => Object.values(SKILL_CATEGORIES_V).flat().includes(s)));
        setSecEditCustomSkills(skills.filter((s:string) => !Object.values(SKILL_CATEGORIES_V).flat().includes(s)).join('、'));
        setSecEditHobbies(hobbies.filter((h:string) => Object.values(HOBBY_CATEGORIES_V).flat().includes(h)));
        setSecEditCustomHobbies(hobbies.filter((h:string) => !Object.values(HOBBY_CATEGORIES_V).flat().includes(h)).join('、'));
        setEditingSection('skills');
      });
    } else if (section === 'matching') {
      doSecFlip(section, () => {
        setSecEditCanOffer((userData?.canOffer || []).join('、'));
        setSecEditLookingFor((userData?.lookingFor || []).join('、'));
        setEditingSection('matching');
      });
    } else if (section === 'career') {
      const career = Array.isArray(userData?.career) ? userData.career : [];
      doSecFlip(section, () => {
        setSecEditCareer(career.map((e:any) => ({company:e.company||'',role:e.role||'',start:e.start||'',end:e.end||'',description:e.description||''})));
        setEditingSection('career');
      });
    }
    setTimeout(() => document.querySelector(`.sec-edit-${section}`)?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  };

  const closeSectionEdit = () => {
    doSecFlip(null, () => { setEditingSection(null); setSecEditError(null); });
  };

  const toggleSecCheck = (item: string, list: string[], setList: (l:string[])=>void) => {
    setList(list.includes(item) ? list.filter(x=>x!==item) : [...list, item]);
  };

  const handleSectionSave = async (section: string) => {
    if (!user || !targetUid) return;
    setSecSaving(true); setSecEditError(null);
    try {
      let patch: any = {};
      if (section === 'expression') {
        patch = { message: secEditMessage.trim() };
      } else if (section === 'personality') {
        patch = { mbti: secEditMbti };
      } else if (section === 'skills') {
        const custom = secEditCustomSkills.split(/[、,，]/).map(s=>s.trim()).filter(Boolean);
        const custom2 = secEditCustomHobbies.split(/[、,，]/).map(s=>s.trim()).filter(Boolean);
        patch = {
          skills: [...new Set([...secEditSkills, ...custom])],
          hobbies: [...new Set([...secEditHobbies, ...custom2])],
        };
      } else if (section === 'matching') {
        patch = {
          canOffer: secEditCanOffer.split(/[、,，]/).map(s=>s.trim()).filter(Boolean),
          lookingFor: secEditLookingFor.split(/[、,，]/).map(s=>s.trim()).filter(Boolean),
        };
      } else if (section === 'career') {
        patch = { career: secEditCareer.filter(e=>e.company.trim()) };
      }
      patch.updatedAt = new Date().toISOString();
      const { doc: fbDoc, setDoc: fbSetDoc } = await import('firebase/firestore');
      await fbSetDoc(fbDoc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data'), patch, { merge: true });
      await fbSetDoc(fbDoc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid), patch, { merge: true });
      setUserData({ ...userData, ...patch });
      closeSectionEdit();
    } catch (err) {
      setSecEditError('保存に失敗しました。');
      console.error(err);
    } finally {
      setSecSaving(false);
    }
  };


  const handleEditPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPhotoFile(file);
      const reader = new FileReader();
      reader.onload = ev => { if (ev.target?.result) setEditPhotoURL(ev.target.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleEditSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !targetUid) return;
    if (!editRealName.trim())    { setEditError('本名を入力してください（必須）'); return; }
    if (!editFurigana.trim())    { setEditError('ふりがなを入力してください（必須）'); return; }
    if (!editBirthDate)          { setEditError('生年月日を入力してください（必須）'); return; }
    if (!editGender || editGender === '無回答') { setEditError('性別を選択してください（必須）'); return; }
    if (!editBirthplace)         { setEditError('出身地を選択してください（必須）'); return; }
    if (!editPrefecture)         { setEditError('活動地域を選択してください（必須）'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      let currentPhotoUrl = userData?.photoURL || null;
      if (editPhotoFile) {
        const snap = await uploadBytes(ref(storage, `profiles/${targetUid}/${Date.now()}_${editPhotoFile.name}`), editPhotoFile);
        currentPhotoUrl = await getDownloadURL(snap.ref);
      }
      const osNumberVal = calculateOsNumber(editBirthDate);
      const patchData: any = {
        name: editName.trim(),
        realName: editRealName.trim(),
        furigana: editFurigana.trim(),
        jobTitle: editJobTitle.trim(),
        prefecture: editPrefecture,
        birthplace: editBirthplace,
        gender: editGender,
        birthDate: editBirthDate,
        bio: editBio.trim(),
        photoURL: currentPhotoUrl,
        osNumber: osNumberVal,
        updatedAt: new Date().toISOString(),
      };
      const { doc: fbDoc, setDoc: fbSetDoc } = await import('firebase/firestore');
      const privateRef = fbDoc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data');
      await fbSetDoc(privateRef, patchData, { merge: true });
      // Update public data
      const publicRef = fbDoc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid);
      await fbSetDoc(publicRef, { name: patchData.name, photoURL: currentPhotoUrl, osNumber: osNumberVal, jobTitle: patchData.jobTitle }, { merge: true });
      // Refresh userData in state
      setUserData((prev: any) => ({ ...prev, ...patchData }));
      closeEdit();
    } catch (err) {
      console.error(err);
      setEditError('保存に失敗しました。再試行してください。');
    } finally {
      setEditSaving(false);
    }
  };

  const hasPlaylistPermission = isSelf && ['guardian', 'covenant', 'admin'].includes(rank);

  // ── v3 Design System Tokens ──
  const NEU_UP = '6px 6px 20px #dbd7d2,-6px -6px 20px #ffffff';
  const NEU_IN = 'inset 4px 4px 12px #dbd7d2,inset -4px -4px 12px #ffffff';
  const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
  const DK_UP = '5px 5px 16px rgba(0,0,0,.38),-5px -5px 14px rgba(255,255,255,.05)';
  const DK_IN = 'inset 4px 4px 12px rgba(0,0,0,.38),inset -4px -4px 10px rgba(255,255,255,.05)';
  const DK_SM = '3px 3px 8px rgba(0,0,0,.3),-3px -3px 8px rgba(255,255,255,.04)';
  const BG = '#f8f6f3';
  const SB = '#1a3024';
  const AMBER = '#c2840a';
  const LIME = '#8ecfb2';
  const T1 = '#2a2520';
  const T2 = '#7a7068';
  const TM = '#b0a89e';
  const SAGE = '#4a7c59';

  return (
    <div style={{display:'flex',minHeight:'100dvh',background:BG,fontFamily:"'Inter','Noto Sans JP',system-ui,sans-serif",fontSize:14,lineHeight:1.5,WebkitFontSmoothing:'antialiased',overflowX:'hidden',width:'100%',maxWidth:'100vw'}}>

      {/* ── PC Sidebar ── */}
      <nav className="hidden lg:flex" style={{width:220,flexShrink:0,position:'fixed',top:0,left:0,height:'100vh',flexDirection:'column',background:SB,boxShadow:'4px 0 24px rgba(0,0,0,.18)',zIndex:50}}>
        {/* Logo */}
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,letterSpacing:'.18em',color:'#fff'}}>NOAH</div>
            <div style={{fontSize:10,color:'#7aab88',marginTop:3,letterSpacing:'.04em'}}>誰も一人にしない</div>
          </div>
          <button type="button" onClick={()=>setShowNotificationModal(true)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#8ebf9e',position:'relative'}}>
            <Bell size={13}/>
            <span style={{position:'absolute',top:3,right:3,width:7,height:7,background:'#ef4444',borderRadius:'50%',border:'1.5px solid '+SB}}/>
          </button>
          {isSelf && <button type="button" onClick={()=>setShowEventsModal(true)} style={{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#8ebf9e'}}>
            <CalendarDays size={13}/>
          </button>}
        </div>
        {/* Nav items */}
        <div style={{flex:1,padding:'10px',display:'flex',flexDirection:'column',gap:3,overflowY:'auto'}}>
          {[
            ['/home','甲板',<svg key="h" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>],
            ['/search','乗組員',<svg key="s" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>],
            ['/events','イベント',<svg key="e" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>],
            ['/media/podcasts','航海記',<svg key="m" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>],
            ['/user','船室',<svg key="u" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
          ].map(([href,label,icon])=>{
            const active=(href as string)==='/user';
            return(
              <Link key={href as string} href={href as string}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,color:active?'#fff':'#7aab88',cursor:'pointer',transition:'all .15s',border:'none',background:active?'rgba(163,230,53,.08)':'none',fontSize:13,fontWeight:500,textDecoration:'none',position:'relative'}}>
                {active&&<span style={{position:'absolute',left:0,top:6,bottom:6,width:3,borderRadius:'0 3px 3px 0',background:LIME}}/>}
                <span style={{opacity:active?1:.7,color:active?LIME:'inherit'}}>{icon}</span>
                {label as string}
              </Link>
            );
          })}
        </div>
        {/* Sidebar footer */}
        <div style={{padding:14,borderTop:'1px solid rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:6,borderRadius:10,cursor:'pointer'}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:SAGE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0,overflow:'hidden'}}>
              {userData.photoURL?<img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(userData.name||'?')[0]}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#d4ead9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{userData.name||userData.userId}</div>
              <div style={{fontSize:10,color:'#7aab88',marginTop:1}}>@{userData.userId}</div>
            </div>
            <SettingsMenu variant="dark" onOpenSettings={() => setShowSettingsModal(true)}/>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="lg:ml-[220px]" style={{flex:1,display:'grid',gridTemplateColumns:'1fr',minHeight:'100vh',alignItems:'start',minWidth:0,width:'100%',maxWidth:'100%',overflowX:'hidden'}} >
        <div className="lg:grid" style={{gridTemplateColumns:'320px 1fr',width:'100%',maxWidth:'100%',overflowX:'hidden'} as any}>

        {/* ── Mobile Topbar (hidden on PC via CSS) ── */}
        <div className="mob-topbar" style={{alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,background:SB,position:'sticky',top:0,zIndex:40,gridColumn:'1/-1',boxShadow:'0 2px 12px rgba(0,0,0,.18)'}}>
          <div style={{fontSize:16,fontWeight:800,letterSpacing:'.18em',color:'#fff'}}>NOAH</div>
          <div style={{display:'flex',gap:8}}>
            <Link href="/search" style={{width:32,height:32,borderRadius:'50%',border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',color:'#d4ead9',cursor:'pointer'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </Link>
            <button type="button" onClick={()=>setShowNotificationModal(true)} style={{width:32,height:32,borderRadius:'50%',border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',color:'#d4ead9',cursor:'pointer',position:'relative'}}>
              <Bell size={14}/><span style={{position:'absolute',top:4,right:4,width:6,height:6,background:'#ef4444',borderRadius:'50%',border:'1.5px solid '+SB}}/>
            </button>
            {isSelf && <button type="button" onClick={()=>setShowEventsModal(true)} style={{width:32,height:32,borderRadius:'50%',border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',color:'#d4ead9',cursor:'pointer'}}>
              <CalendarDays size={14}/>
            </button>}
            {isSelf&&<SettingsMenu variant="dark" placement="topbar" onOpenSettings={() => setShowSettingsModal(true)}/>}
          </div>
        </div>

        {/* ── Profile Column ── */}
        <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto profile-col-wrap"
          style={{padding:'20px 16px',borderRight:'2px solid rgba(0,0,0,.04)',scrollbarWidth:'thin',scrollbarColor:'#c8c4bf transparent'} as any}
          /* Mobile: dark green bg */
        >
          {/* Mobile: the profile-col gets dark green bg */}
          <style>{`
            /* Mobile topbar: flex on mobile, hidden on PC */
            .mob-topbar { display: flex; }
            @media(min-width:1024px){ .mob-topbar { display: none !important; } }
            @media(max-width:1023px){
              .profile-col-inner{background:${SB}!important;padding:24px 20px 20px!important;border-radius:0!important;box-shadow:none!important;}
            }
          `}</style>


          {/* ═══════════════════════════════════════
              FLIP CARD (表：プロフィール表示 / 裏：編集)
              ═══════════════════════════════════════ */}
          <style>{`
            /* ── Flip card: simple half-turn swap ── */
            .flip-card-outer{width:100%;perspective:900px}
            .flip-card-inner{
              width:100%;
              transition:transform .3s cubic-bezier(.55,0,1,.45);
              transform-origin:center center
            }
            /* First half: fold away */
            .flip-card-inner.flip-fold{transform:rotateY(-90deg)}
            /* Second half: unfold into view */
            .flip-card-inner.flip-unfold{transform:rotateY(90deg);transition:none}
            .flip-card-inner.flip-unfolding{transform:rotateY(0deg);transition:transform .3s cubic-bezier(0,.55,.45,1)}
            .edit-input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#f8f6f3;font-size:12px;color:#2a2520;outline:none;transition:border .15s;font-family:inherit}
            .edit-input:focus{border-color:#4a7c59;box-shadow:0 0 0 3px rgba(74,124,89,.12)}
            .edit-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7068;margin-bottom:4px;display:block}
            @media(max-width:1023px){
              .flip-face-back .edit-input{background:rgba(255,255,255,.1)!important;color:#e8f4ec!important;border-color:rgba(255,255,255,.15)!important}
              .flip-face-back .edit-label{color:#7aab88!important}
            }
          `}</style>
          <div className="flip-card-outer">
            <div className={`flip-card-inner${flipPhase?` ${flipPhase}`:''}`}>

              {/* ─── FRONT FACE ─── */}
              <div ref={frontFaceRef} style={{display:isEditing?'none':'block'}}>
                <div className="profile-col-inner p-card-wrap" style={{background:BG,borderRadius:18,boxShadow:NEU_UP,padding:20,position:'relative'}}>
                  {(isSelf||isAdmin)&&(
                    <button type="button" onClick={isSelf?openEdit:undefined}
                      className="edit-btn-link"
                      style={{position:'absolute',top:16,right:16,fontSize:11,fontWeight:600,padding:'6px 12px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4}}>
                      <Pencil size={10}/>{isSelf?'プロフィール編集':'代理編集'}
                    </button>
                  )}
                  <div style={{width:80,height:80,borderRadius:'50%',boxShadow:NEU_IN,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,flexShrink:0,position:'relative',cursor:(isLive&&!isSelf)?'pointer':'default'}}
                    onClick={()=>{if(isLive&&!isSelf)router.push(`/media/live_room?roomId=${targetUid}`);}}>
                    <div style={{width:68,height:68,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:700,color:AMBER,outline:`2px solid ${AMBER}`,outlineOffset:2,overflow:'hidden',position:'relative'}}>
                      {userData.photoURL?<img src={userData.photoURL} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(userData.name||'?')[0]}
                      {isLive&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.4)',display:'flex',alignItems:'center',justifyContent:'center'}}><Headphones size={22} color="#fff"/></div>}
                    </div>
                    {isLive&&<div style={{position:'absolute',bottom:-6,left:'50%',transform:'translateX(-50%)',background:'#ef4444',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:100,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#fff',animation:'pulse 1s infinite'}}/>LIVE</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <div className="p-name" style={{fontSize:18,fontWeight:700,color:T1,lineHeight:1.2}}>{userData.name||userData.userId||'名無し'}</div>
                    <div className="rank-badge" style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:9,fontWeight:700,letterSpacing:'.1em',padding:'3px 10px 3px 8px',borderRadius:100,backdropFilter:'blur(12px)',background:'rgba(74,124,89,.12)',border:'1px solid rgba(74,124,89,.3)',color:SAGE,flexShrink:0}}>
                      <ShieldHalf size={9}/>{(rank||'arrival').toUpperCase()}
                    </div>
                  </div>
                  <div className="p-handle" style={{fontSize:12,color:T2,fontFamily:"'DM Mono',monospace",letterSpacing:'.06em'}}>@{userData.userId||'unknown'}</div>
                  {userData.jobTitle&&<div className="p-jobtitle" style={{display:'flex',alignItems:'center',gap:5,marginTop:4,fontSize:12,fontWeight:600,color:T1}}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                    <span>{userData.jobTitle}</span>
                  </div>}
                  {/* ── 基本情報チップ（@IDの直下、bioの前） ── */}
                  {(()=>{
                    // プライバシー可視性ヘルパー
                    const canSee=(vis:string)=>isSelf||vis==='public'||(vis==='mutual'&&isMutual);
                    const showPref=userData.prefecture&&canSee(userData.activityAreaVisibility||'public');
                    const showBP=userData.birthplace&&canSee(userData.hometownVisibility||'public');
                    const showGender=userData.gender&&canSee(userData.genderVisibility||'public');
                    const showBirth=userData.birthDate&&userData.birthVisibility&&userData.birthVisibility!=='none'&&canSee(userData.birthVisibility==='none'?'private':'public');
                    if(!showPref&&!showBP&&!showGender&&!showBirth)return null;
                    return(
                    <div className="p-info-chips" style={{display:'flex',flexWrap:'wrap',gap:'6px 12px',margin:'10px 0',padding:'10px 0',borderTop:'1px solid rgba(0,0,0,.07)',borderBottom:'1px solid rgba(0,0,0,.07)',color:T2}}>
                      {showPref&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>{userData.prefecture}</span>
                      </div>}
                      {showBP&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        <span>{userData.birthplace}出身</span>
                      </div>}
                      {showGender&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>{userData.gender}</span>
                      </div>}
                      {showBirth&&(()=>{
                        const p=userData.birthDate.split('-');if(p.length<2)return null;
                        const vis=userData.birthVisibility;let label='';
                        if(vis==='monthDay'){if(!p[1]||!p[2])return null;label=`${parseInt(p[1],10)}月${parseInt(p[2],10)}日`;}
                        else{if(!p[0])return null;const y=parseInt(p[0],10);const m=p[1]?parseInt(p[1],10):null;const d=p[2]?parseInt(p[2],10):null;label=`${y}年${m!==null?m+'月':''}${d!==null?d+'日':''}`;}
                        return(<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span>{label}</span>
                        </div>);
                      })()}
                    </div>
                    );
                  })()}
                  {userData.bio&&<div className="p-bio" style={{fontSize:12,color:T2,marginTop:6,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:formatText(userData.bio)}}/>}

                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:8}}>
                    {isMutual&&<span className="mutual-badge" style={{fontSize:10,padding:'3px 10px',borderRadius:100,background:'rgba(163,230,53,.12)',border:'1px solid rgba(163,230,53,.3)',color:LIME,fontWeight:700}}>相互フォロー</span>}
                    {isAdmin&&!isSelf&&<select value={rank} onChange={e=>handleRankChange(e.target.value)} style={{fontSize:10,border:'1px solid #e8dfd1',background:BG,color:T1,borderRadius:4,padding:'2px 4px'}}>
                      {['arrival','settler','builder','guardian','covenant','admin'].map(r=><option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>}
                  </div>
                  {!isSelf&&(
                    <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                      <button onClick={toggleFollow} className={isFollowing?"follow-btn-following":"follow-btn-notfollowing"} style={{padding:'8px 20px',borderRadius:100,fontSize:12,fontWeight:700,cursor:'pointer',background:isFollowing?BG:'#1a3024',color:isFollowing?T2:'#fff',border:isFollowing?`1px solid rgba(0,0,0,.1)`:'none',boxShadow:isFollowing?NEU_SM:'none',transition:'all .15s'}}>
                        {isFollowing?'フォロー中':'フォロー'}
                      </button>
                      <button onClick={()=>setIsMemoOpen(true)} className="memo-btn" style={{padding:'8px 14px',borderRadius:100,fontSize:11,fontWeight:600,cursor:'pointer',background:BG,color:T2,border:'none',boxShadow:NEU_SM,display:'flex',alignItems:'center',gap:4}}><Key size={12}/>メモ</button>
                    </div>
                  )}
                  {isSelf&&['guardian','covenant','admin'].includes(rank)&&(
                    <div style={{marginTop:12}}>
                      {isLive
                        ?<Link href={`/media/live_room?roomId=${user?.uid||''}`} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 16px',borderRadius:8,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',color:'#ef4444',fontSize:12,fontWeight:700,textDecoration:'none'}}><SatelliteDish size={14} className="animate-pulse"/>配信ルームへ</Link>
                        :<Link href="/media/live/new" className="signal-cast-btn" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 16px',borderRadius:8,background:'#1a3024',color:'#fff',fontSize:12,fontWeight:700,textDecoration:'none'}}><SatelliteDish size={14} className="animate-pulse"/>SIGNAL CASTを配信</Link>
                      }
                    </div>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:16}}>
                  {[[followersCount,'フォロワー','followers'],[followingCount,'フォロー中','following']].map(([n,l,t])=>(
                    <button key={t as string} onClick={()=>setFollowModalType(t as any)}
                      className="stat-cell-btn" style={{background:BG,borderRadius:10,boxShadow:NEU_IN,padding:'12px 10px',cursor:'pointer',border:'none',textAlign:'left',transition:'box-shadow .15s'}}
                      onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_SM)}
                      onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_IN)}>
                      <div className="stat-num" style={{fontSize:22,fontWeight:700,color:T1,lineHeight:1}}>{n as number}</div>
                      <div className="stat-lbl" style={{fontSize:9,color:TM,marginTop:3,letterSpacing:'.04em'}}>{l as string}</div>
                    </button>
                  ))}
                </div>
                {(isSelf||isMutual)&&userData.osNumber&&(userData.profileScore||0)>=100&&(
                  <Link href={isSelf ? '/diagnostic' : `/diagnostic?uid=${targetUid}`} className="os-card-link"
                    style={{background:BG,borderRadius:18,boxShadow:NEU_UP,padding:'14px 16px',display:'flex',alignItems:'center',gap:13,cursor:'pointer',transition:'box-shadow .15s',marginTop:14,textDecoration:'none',border:`1px solid ${osTheme.main}22`}}
                    onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_SM)}
                    onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_UP)}>
                    <div className="os-seal-wrap" style={{width:52,height:52,borderRadius:'50%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0,background:`radial-gradient(circle at 30% 30%, ${osTheme.bg}, #0a0604)`,boxShadow:`0 0 0 2px ${osTheme.main}55, inset 3px 3px 8px rgba(0,0,0,.5)`,border:`1px solid ${osTheme.main}33`}}>
                      <div style={{fontSize:18,fontWeight:800,color:osTheme.main,lineHeight:1}}>{userData.osNumber}</div>
                      <div style={{fontSize:8,color:osTheme.sub,marginTop:1,fontFamily:"'Noto Sans JP'"}}>{osData?.kanji||userData.osKanji||''}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,color:TM,letterSpacing:'.1em',textTransform:'uppercase'}}>Soul OS · 行動設計図</div>
                      <div style={{fontSize:14,fontWeight:700,color:T1,marginTop:2}}>{osData?.kanji||userData.osKanji||'未診断'}</div>
                      <div style={{fontSize:11,color:T2,marginTop:2,lineHeight:1.4,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{osData?.copy||''}</div>
                    </div>
                    <ChevronRight size={14} color={osTheme.main}/>
                  </Link>
                )}
                {isSelf&&!isProfileComplete&&(
                  <div style={{marginTop:14}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:11,color:T2,fontWeight:500}}>プロフィール充実度</span>
                      <span style={{fontSize:12,fontWeight:700,color:AMBER}}>{userData.profileScore||0}%</span>
                    </div>
                    <div className="score-track-wrap" style={{height:6,borderRadius:4,boxShadow:NEU_IN,overflow:'hidden',background:BG}}>
                      <div style={{height:'100%',width:`${userData.profileScore||0}%`,background:`linear-gradient(90deg,${AMBER},#d97706)`,borderRadius:4,transition:'width 1.2s cubic-bezier(.34,1.56,.64,1)'}}/>
                    </div>
                    {!isProfileComplete&&rank!=='covenant'&&<Link href="/upgrade" style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:8,fontSize:10,padding:'4px 12px',borderRadius:100,background:`linear-gradient(90deg,${AMBER},#d97706)`,color:'#fff',fontWeight:700,textDecoration:'none'}}><ShieldHalf size={10}/>アップグレード</Link>}
                  </div>
                )}
                {isSelf&&(
                  <button onClick={copyProfileLink} className="copy-link-btn" style={{width:'100%',marginTop:10,padding:'8px',borderRadius:10,background:copyLinkDone?'rgba(74,124,89,.12)':BG,boxShadow:NEU_SM,border:'none',color:copyLinkDone?SAGE:T2,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all .2s'}}>
                    {copyLinkDone
                      ? <><Check size={12} color={SAGE}/> コピーしました！</>
                      : <><Share size={12}/> 公開プロフィールリンクをコピー</>}
                  </button>
                )}
              </div>{/* /flip-face-front */}

              {/* ─── BACK FACE (編集フォーム) ─── */}
              <div ref={backFaceRef} style={{display:isEditing?'block':'none'}}>
                <form onSubmit={handleEditSave}>
                  <div className="profile-col-inner p-card-wrap" style={{background:BG,borderRadius:18,boxShadow:NEU_UP,padding:20}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                      <div style={{fontSize:13,fontWeight:700,color:T1,display:'flex',alignItems:'center',gap:6}}><Pencil size={13} color={SAGE}/>基本情報を編集</div>
                      <button type="button" onClick={()=>{setEditError(null);closeEdit();}} style={{width:28,height:28,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T2,fontSize:14}}>✕</button>
                    </div>
                    {editError&&<div style={{padding:'8px 12px',borderRadius:8,background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:11,marginBottom:12,fontWeight:600}}>{editError}</div>}
                    {/* Avatar */}
                    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                      <div style={{position:'relative',flexShrink:0}}>
                        <div style={{width:64,height:64,borderRadius:'50%',boxShadow:NEU_IN,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:BG,fontSize:22,fontWeight:700,color:AMBER}}>
                          {editPhotoURL?<img src={editPhotoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(editName||'?')[0]}
                        </div>
                        <label htmlFor="edit-photo-input" style={{position:'absolute',bottom:-2,right:-2,width:22,height:22,borderRadius:'50%',background:SAGE,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 2px 6px rgba(0,0,0,.2)'}}>
                          <Camera size={11} color="#fff"/>
                        </label>
                        <input id="edit-photo-input" type="file" accept="image/*" style={{display:'none'}} onChange={handleEditPhoto}/>
                      </div>
                      <div><div style={{fontSize:11,fontWeight:600,color:T1}}>{editName||'表示名なし'}</div><div style={{fontSize:10,color:T2,marginTop:2}}>アイコンをタップして変更</div></div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:11}}>
                      <div><label className="edit-label">表示名</label><input className="edit-input" value={editName} onChange={e=>setEditName(e.target.value)} placeholder="NOAHでの表示名"/></div>
                      <div><label className="edit-label">本名 <span style={{color:'#ef4444'}}>*</span><span style={{fontSize:9,color:TM,fontWeight:400,marginLeft:3}}>(非公開)</span></label>
                        <input className="edit-input" value={editRealName} onChange={e=>setEditRealName(e.target.value)} placeholder="山田 太郎" style={{borderColor:!editRealName.trim()?'#fca5a5':undefined}}/></div>
                      <div><label className="edit-label">ふりがな <span style={{color:'#ef4444'}}>*</span><span style={{fontSize:9,color:TM,fontWeight:400,marginLeft:3}}>(非公開)</span></label>
                        <input className="edit-input" value={editFurigana} onChange={e=>setEditFurigana(e.target.value)} placeholder="やまだ たろう" style={{borderColor:!editFurigana.trim()?'#fca5a5':undefined}}/></div>
                      <div><label className="edit-label">職業・肩書</label><input className="edit-input" value={editJobTitle} onChange={e=>setEditJobTitle(e.target.value)} placeholder="エンジニア / 起業家"/></div>
                      <div><label className="edit-label">活動地域 <span style={{color:'#ef4444'}}>*</span></label>
                        <select className="edit-input" value={editPrefecture} onChange={e=>setEditPrefecture(e.target.value)} style={{borderColor:!editPrefecture?'#fca5a5':undefined}}>
                          <option value="">選択してください</option>{PREFECTURES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                      <div><label className="edit-label">出身地 <span style={{color:'#ef4444'}}>*</span></label>
                        <select className="edit-input" value={editBirthplace} onChange={e=>setEditBirthplace(e.target.value)} style={{borderColor:!editBirthplace?'#fca5a5':undefined}}>
                          <option value="">選択してください</option>{PREFECTURES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                      <div><label className="edit-label">性別 <span style={{color:'#ef4444'}}>*</span></label>
                        <select className="edit-input" value={editGender} onChange={e=>setEditGender(e.target.value)} style={{borderColor:(!editGender||editGender==='無回答')?'#fca5a5':undefined}}>
                          {['選択してください','男性','女性','ノンバイナリー','その他'].map(g=><option key={g} value={g==='選択してください'?'':g}>{g}</option>)}
                        </select></div>
                      <div><label className="edit-label">生年月日 <span style={{color:'#ef4444'}}>*</span></label>
                        <input className="edit-input" type="date" value={editBirthDate} onChange={e=>setEditBirthDate(e.target.value)} style={{borderColor:!editBirthDate?'#fca5a5':undefined}}/>
                        <div style={{fontSize:10,color:'#7aab88',marginTop:3}}>公開範囲は設定画面から変更できます</div>
                      </div>
                      <div>
                        <label className="edit-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span>自己紹介 <span style={{fontSize:9,color:TM,fontWeight:400}}>Markdown対応</span></span>
                          <button type="button" onClick={()=>setShowMdHelp(v=>!v)} style={{fontSize:9,color:SAGE,background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:700}}>{showMdHelp?'▲ 閉じる':'▼ 書き方'}</button>
                        </label>
                        {showMdHelp&&<div style={{fontSize:10,color:T2,background:'rgba(74,124,89,.06)',borderRadius:6,padding:'7px 10px',marginBottom:6,lineHeight:1.8}}>
                          <b>**太字**</b> · <i>*斜体*</i> · <u>__下線__</u><br/>
                          # 見出し · - リスト · {'>'} 引用
                        </div>}
                        <textarea className="edit-input" rows={5} value={editBio} onChange={e=>setEditBio(e.target.value)} placeholder="自己紹介（マークダウン可）" style={{resize:'vertical'}}/>
                        <div style={{fontSize:10,color:editBio.length>=150?SAGE:TM,textAlign:'right',marginTop:2}}>{editBio.length}字{editBio.length<150&&' / 推奨150字'}</div>
                      </div>

                    </div>
                    <div style={{marginTop:10,fontSize:10,color:TM}}><span style={{color:'#ef4444'}}>*</span> は必須項目です（本名・ふりがなは非公開）</div>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:12}}>
                    <button type="submit" disabled={editSaving}
                      style={{flex:1,padding:'11px',borderRadius:10,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:editSaving?'not-allowed':'pointer',opacity:editSaving?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:NEU_SM}}>
                      {editSaving?'保存中...':'💾 保存して閉じる'}
                    </button>
                    <button type="button" onClick={()=>{setEditError(null);closeEdit();}}
                      style={{padding:'11px 16px',borderRadius:10,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                  </div>
                </form>
              </div>{/* /flip-face-back */}

            </div>{/* /flip-card-inner */}
          </div>{/* /flip-card-outer */}

        </div>{/* /profile-col */}



        {/* ── Content Column ── */}
        <div className="content-col-wrap lg:border-t-0" style={{minHeight:'100vh',background:BG,overflow:'hidden',minWidth:0,maxWidth:'100%',boxSizing:'border-box'}}>
          <style>{`
            .content-col-tabs{border-top:none!important}
            @media(max-width:1023px){
              .content-col-border{border-top:2px solid #8ecfb2!important}
            }
          `}</style>
          {/* Tab Bar - glassmorphism */}
          <div style={{position:'sticky',top:0,zIndex:30,backdropFilter:'blur(24px)',background:'rgba(248,246,243,.88)',borderBottom:'1px solid rgba(0,0,0,.06)',padding:'0 24px',display:'flex',alignItems:'center',gap:4,height:50}}>
            {[['profile','プロフィール'],['threads','スレッド'],['media','メディア'],['activity','活動']].map(([id,label])=>{
              const active=activeTab===id;
              return(
                <button key={id} onClick={()=>handleTabChange(id as any)}
                  style={{fontSize:13,fontWeight:active?700:500,padding:'7px 16px',borderRadius:100,border:'none',background:active?BG:'none',color:active?T1:T2,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',boxShadow:active?NEU_SM:'none'}}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Section flip animation CSS */}
          <style>{`
            .sec-flip-outer{width:100%}
            .sec-flip-inner{width:100%;transition:transform .3s cubic-bezier(.55,0,1,.45);transform-origin:center center}
            .sec-flip-inner.flip-fold{transform:rotateY(-90deg)}
            .sec-flip-inner.flip-unfold{transform:rotateY(90deg);transition:none}
            .sec-flip-inner.flip-unfolding{transform:rotateY(0deg);transition:transform .3s cubic-bezier(0,.55,.45,1)}
            .sec-edit-input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#f8f6f3;font-size:12px;color:#2a2520;outline:none;transition:border .15s;font-family:inherit;resize:vertical}
            .sec-edit-input:focus{border-color:#4a7c59;box-shadow:0 0 0 3px rgba(74,124,89,.12)}
            .sec-edit-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7068;margin-bottom:4px;display:block}
            .sec-check-item{display:inline-flex;align-items:center;padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,.08);cursor:pointer;font-size:11px;transition:all .1s;margin:2px;white-space:nowrap}
            .sec-check-item.checked{background:#2d5a3d;color:#fff;border-color:#2d5a3d}
            .sec-check-item.unchecked{background:#f8f6f3;color:#5a5248}
            details.sec-cat summary{list-style:none;cursor:pointer;padding:6px 10px;font-size:11px;font-weight:700;background:rgba(0,0,0,.03);border-radius:6px;margin-bottom:4px}
            details.sec-cat[open] summary{border-radius:6px 6px 0 0}
            details.sec-cat > div{padding:6px;background:rgba(0,0,0,.02);border-radius:0 0 6px 6px;margin-bottom:6px}
          `}</style>
          {/* ── Profile Tab ── */}
          {activeTab==='profile'&&(
            <div>

              {/* ══ 自分を表現する (Expression) section ══ */}
              <div className="sec-edit-expression" style={{borderTop:'1px solid rgba(0,0,0,.04)',marginTop:8}}>
                <div className={`sec-flip-inner${editingSection==='expression'&&secFlipPhase?` ${secFlipPhase}`:''}`}>
                  {editingSection!=='expression'&&(
                    <div style={{padding:'22px 24px 0',position:'relative'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                        <span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>自分を表現する</span>
                        <span style={{fontSize:9,fontWeight:600,letterSpacing:'.06em',padding:'2px 8px',borderRadius:100,background:'#ede9fe',color:'#5b21b6'}}>相互フォローのみ</span>
                      </div>
                      {isSelf&&<button type="button" onClick={()=>openSectionEdit('expression')} style={{position:'absolute',top:16,right:16,fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}><Pencil size={10}/> 編集</button>}
                      {(isMutual||isSelf)
                        ?<div style={{fontSize:13.5,lineHeight:1.85,color:T1}} dangerouslySetInnerHTML={{__html:formatText(userData.message||'')}}/>
                        :<div style={{padding:'24px',textAlign:'center',color:TM,fontSize:13}}>
                          <Lock size={20} style={{margin:'0 auto 8px',opacity:.4}}/>相互フォローで公開されます
                        </div>
                      }
                      {isSelf&&!userData.message&&<div style={{padding:'16px',textAlign:'center',color:TM,fontSize:12,fontStyle:'italic'}}>未入力 — 編集ボタンで自由に記載できます（Markdown・URL対応）</div>}
                    </div>
                  )}
                  {editingSection==='expression'&&(
                    <div style={{padding:'16px 24px',background:'rgba(74,124,89,.04)',borderRadius:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:SAGE,marginBottom:12}}>✏️ 自分を表現する — 自由記述</div>
                      <div style={{fontSize:10,color:TM,marginBottom:8,lineHeight:1.7}}>URLリンク・note記事・思いや目標など、Markdown形式でなんでも記載できます（相互フォローのみ公開）</div>
                      <div style={{fontSize:10,color:T2,background:'rgba(74,124,89,.06)',borderRadius:6,padding:'7px 10px',marginBottom:8,lineHeight:1.8}}>
                        <b>**太字**</b> · <i>*斜体*</i> · __下線__ · # 見出し · - リスト &gt; 引用 · [テキスト](URL)
                      </div>
                      <textarea className="sec-edit-input" rows={8} value={secEditMessage} onChange={e=>setSecEditMessage(e.target.value)} placeholder={"例：\n# 私の軸\n今、〇〇に全力で取り組んでいます。\n\n**参考note:** [私の記事タイトル](https://note.com/...)\n\nいつか..."}/>
                      <div style={{fontSize:10,color:TM,textAlign:'right',marginTop:2}}>{secEditMessage.length}字</div>
                      {secEditError&&<div style={{color:'#ef4444',fontSize:11,marginTop:6}}>{secEditError}</div>}
                      <div style={{display:'flex',gap:8,marginTop:10}}>
                        <button type="button" disabled={secSaving} onClick={()=>handleSectionSave('expression')} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:secSaving?'not-allowed':'pointer',opacity:secSaving?.7:1}}>
                          {secSaving?'保存中...':'💾 保存'}
                        </button>
                        <button type="button" onClick={closeSectionEdit} style={{padding:'9px 14px',borderRadius:8,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ══ パーソナリティ (MBTI) section ══ */}
              {(userData.mbti&&userData.mbti!=='未設定'||isSelf)&&(
                <div className="sec-edit-personality" style={{borderTop:'1px solid rgba(0,0,0,.04)',marginTop:8}}>
                  <div className={`sec-flip-inner${editingSection==='personality'&&secFlipPhase?` ${secFlipPhase}`:''}`}>
                    {editingSection!=='personality'&&(
                      <div style={{padding:'22px 24px 0',position:'relative'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                          <span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>パーソナリティ</span>
                        </div>
                        {isSelf&&<button type="button" onClick={()=>openSectionEdit('personality')} style={{position:'absolute',top:16,right:16,fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}><Pencil size={10}/> 編集</button>}
                        {userData.mbti&&userData.mbti!=='未設定'?(
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
                              <div style={{fontSize:16,fontWeight:800,minWidth:62,height:62,borderRadius:10,boxShadow:NEU_IN,background:BG,display:'flex',alignItems:'center',justifyContent:'center',color:SAGE,letterSpacing:'.05em',flexShrink:0,padding:'0 8px'}}>{userData.mbti}</div>
                              <div>
                                <div style={{fontSize:10,color:TM,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4}}>{getMbtiBadge(userData.mbti)}</div>
                                <div style={{fontSize:12,color:T2,lineHeight:1.7}}>{MBTI_DESCRIPTIONS[userData.mbti]||''}</div>
                              </div>
                            </div>
                          </div>
                        ):(
                          isSelf&&<div style={{fontSize:12,color:TM,fontStyle:'italic'}}>未設定 — 編集ボタンから設定できます</div>
                        )}
                      </div>
                    )}
                    {editingSection==='personality'&&(
                      <div style={{padding:'16px 24px',background:'rgba(74,124,89,.04)',borderRadius:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:SAGE,marginBottom:12}}>✏️ パーソナリティ編集</div>
                        <label className="sec-edit-label">MBTI タイプ</label>
                        <select className="sec-edit-input" value={secEditMbti} onChange={e=>setSecEditMbti(e.target.value)} style={{resize:'none'}}>
                          <option value="未設定">未設定</option>
                          <optgroup label="分析家 (紫)">
                            {['INTJ','INTP','ENTJ','ENTP'].map(t=><option key={t} value={t}>{t} ({({'INTJ':'建築家','INTP':'論理学者','ENTJ':'指揮官','ENTP':'討論者'} as any)[t]})</option>)}
                          </optgroup>
                          <optgroup label="外交官 (緑)">
                            {['INFJ','INFP','ENFJ','ENFP'].map(t=><option key={t} value={t}>{t} ({({'INFJ':'提唱者','INFP':'仲介者','ENFJ':'主人公','ENFP':'運動家'} as any)[t]})</option>)}
                          </optgroup>
                          <optgroup label="番人 (青)">
                            {['ISTJ','ISFJ','ESTJ','ESFJ'].map(t=><option key={t} value={t}>{t} ({({'ISTJ':'管理者','ISFJ':'擁護者','ESTJ':'幹部','ESFJ':'領事'} as any)[t]})</option>)}
                          </optgroup>
                          <optgroup label="探検家 (黄)">
                            {['ISTP','ISFP','ESTP','ESFP'].map(t=><option key={t} value={t}>{t} ({({'ISTP':'巨匠','ISFP':'冒険家','ESTP':'起業家','ESFP':'エンターテイナー'} as any)[t]})</option>)}
                          </optgroup>
                        </select>
                        {secEditMbti!=='未設定'&&MBTI_DESCRIPTIONS[secEditMbti]&&(
                          <div style={{fontSize:11,color:T2,marginTop:8,padding:'8px 10px',background:'rgba(74,124,89,.06)',borderRadius:6,lineHeight:1.7}}>{MBTI_DESCRIPTIONS[secEditMbti]}</div>
                        )}
                        {secEditError&&<div style={{color:'#ef4444',fontSize:11,marginTop:6}}>{secEditError}</div>}
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button type="button" disabled={secSaving} onClick={()=>handleSectionSave('personality')} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:secSaving?'not-allowed':'pointer',opacity:secSaving?.7:1}}>
                            {secSaving?'保存中...':'💾 保存'}
                          </button>
                          <button type="button" onClick={closeSectionEdit} style={{padding:'9px 14px',borderRadius:8,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ スキル・趣味 section ══ */}
              {(userData.skills?.length>0||userData.hobbies?.length>0||isSelf)&&(
                <div className="sec-edit-skills" style={{borderTop:'1px solid rgba(0,0,0,.04)',marginTop:8}}>
                  <div className={`sec-flip-inner${editingSection==='skills'&&secFlipPhase?` ${secFlipPhase}`:''}`}>
                    {editingSection!=='skills'&&(
                      <div style={{padding:'22px 24px 0',position:'relative'}}>
                        {isSelf&&<button type="button" onClick={()=>openSectionEdit('skills')} style={{position:'absolute',top:16,right:16,fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}><Pencil size={10}/> 編集</button>}
                        {userData.skills?.length>0&&(
                          <div style={{marginBottom:16}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>スキル</span></div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                              {(Array.isArray(userData.skills)?userData.skills:[userData.skills]).map((t:string,i:number)=>(
                                <span key={i} style={{fontSize:12,fontWeight:500,padding:'5px 13px',borderRadius:100,whiteSpace:'nowrap',boxShadow:NEU_IN,background:'#edf3ef',color:'#2d5a3d'}}>#{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {userData.hobbies?.length>0&&(
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>趣味・興味</span></div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                              {(Array.isArray(userData.hobbies)?userData.hobbies:[userData.hobbies]).map((t:string,i:number)=>(
                                <span key={i} style={{fontSize:12,fontWeight:500,padding:'5px 13px',borderRadius:100,whiteSpace:'nowrap',boxShadow:NEU_IN,background:'#fdf4e3',color:'#7a4f1a'}}>#{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {isSelf&&!userData.skills?.length&&!userData.hobbies?.length&&<div style={{fontSize:12,color:TM,fontStyle:'italic'}}>未設定 — 編集ボタンから追加できます</div>}
                      </div>
                    )}
                    {editingSection==='skills'&&(
                      <div style={{padding:'16px 24px',background:'rgba(74,124,89,.04)',borderRadius:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:SAGE,marginBottom:12}}>✏️ スキル・趣味編集</div>
                        {/* Skills */}
                        <div style={{marginBottom:16}}>
                          <label className="sec-edit-label" style={{marginBottom:8}}>スキル（3つ以上推奨）</label>
                          {Object.entries(SKILL_CATEGORIES_V).map(([cat,items])=>(
                            <details key={cat} className="sec-cat">
                              <summary>{cat} {items.filter(i=>secEditSkills.includes(i)).length>0&&<span style={{color:SAGE,fontWeight:800}}>✓{items.filter(i=>secEditSkills.includes(i)).length}</span>}</summary>
                              <div>{items.map(item=>(
                                <button key={item} type="button" onClick={()=>toggleSecCheck(item,secEditSkills,setSecEditSkills)} className={`sec-check-item ${secEditSkills.includes(item)?'checked':'unchecked'}`}>{item}</button>
                              ))}</div>
                            </details>
                          ))}
                          <div style={{marginTop:6}}>
                            <label className="sec-edit-label">カスタムスキル（読点・カンマ区切り）</label>
                            <input className="sec-edit-input" value={secEditCustomSkills} onChange={e=>setSecEditCustomSkills(e.target.value)} placeholder="例：陶芸、フラワーアレンジメント"/>
                          </div>
                        </div>
                        {/* Hobbies */}
                        <div>
                          <label className="sec-edit-label" style={{marginBottom:8}}>趣味・興味（3つ以上推奨）</label>
                          {Object.entries(HOBBY_CATEGORIES_V).map(([cat,items])=>(
                            <details key={cat} className="sec-cat">
                              <summary>{cat} {items.filter(i=>secEditHobbies.includes(i)).length>0&&<span style={{color:SAGE,fontWeight:800}}>✓{items.filter(i=>secEditHobbies.includes(i)).length}</span>}</summary>
                              <div>{items.map(item=>(
                                <button key={item} type="button" onClick={()=>toggleSecCheck(item,secEditHobbies,setSecEditHobbies)} className={`sec-check-item ${secEditHobbies.includes(item)?'checked':'unchecked'}`}>{item}</button>
                              ))}</div>
                            </details>
                          ))}
                          <div style={{marginTop:6}}>
                            <label className="sec-edit-label">カスタム趣味（読点・カンマ区切り）</label>
                            <input className="sec-edit-input" value={secEditCustomHobbies} onChange={e=>setSecEditCustomHobbies(e.target.value)} placeholder="例：ビーズアクセサリー、キャンドル作り"/>
                          </div>
                        </div>
                        {secEditError&&<div style={{color:'#ef4444',fontSize:11,marginTop:6}}>{secEditError}</div>}
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button type="button" disabled={secSaving} onClick={()=>handleSectionSave('skills')} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:secSaving?'not-allowed':'pointer',opacity:secSaving?.7:1}}>
                            {secSaving?'保存中...':'💾 保存'}
                          </button>
                          <button type="button" onClick={closeSectionEdit} style={{padding:'9px 14px',borderRadius:8,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ マッチング section ══ */}
              {((userData.canOffer?.length>0)||(userData.lookingFor?.length>0)||isSelf)&&(
                <div className="sec-edit-matching" style={{borderTop:'1px solid rgba(0,0,0,.04)',marginTop:8}}>
                  <div className={`sec-flip-inner${editingSection==='matching'&&secFlipPhase?` ${secFlipPhase}`:''}`}>
                    {editingSection!=='matching'&&(
                      <div style={{padding:'22px 24px 0',position:'relative'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}><span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>マッチング</span></div>
                        {isSelf&&<button type="button" onClick={()=>openSectionEdit('matching')} style={{position:'absolute',top:16,right:16,fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}><Pencil size={10}/> 編集</button>}
                        {userData.canOffer?.length>0&&(
                          <div style={{marginBottom:14}}>
                            <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',padding:'4px 11px',borderRadius:100,marginBottom:9,boxShadow:NEU_SM,background:'#e8f4eb',color:'#1d5a2d'}}>提供できること</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                              {userData.canOffer.map((t:string,i:number)=><span key={i} style={{fontSize:12,fontWeight:500,padding:'5px 13px',borderRadius:100,boxShadow:NEU_IN,background:'#e8f4eb',color:'#1d5a2d'}}>{t}</span>)}
                            </div>
                          </div>
                        )}
                        {userData.lookingFor?.length>0&&(
                          <div>
                            <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',padding:'4px 11px',borderRadius:100,marginBottom:9,boxShadow:NEU_SM,background:'#fdedf0',color:'#8b2635'}}>求めていること</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                              {userData.lookingFor.map((t:string,i:number)=><span key={i} style={{fontSize:12,fontWeight:500,padding:'5px 13px',borderRadius:100,boxShadow:NEU_IN,background:'#fdedf0',color:'#8b2635'}}>{t}</span>)}
                            </div>
                          </div>
                        )}
                        {isSelf&&!userData.canOffer?.length&&!userData.lookingFor?.length&&<div style={{fontSize:12,color:TM,fontStyle:'italic'}}>未設定 — 編集ボタンから入力できます</div>}
                      </div>
                    )}
                    {editingSection==='matching'&&(
                      <div style={{padding:'16px 24px',background:'rgba(74,124,89,.04)',borderRadius:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:SAGE,marginBottom:12}}>✏️ マッチング情報編集</div>
                        <div style={{marginBottom:12}}>
                          <label className="sec-edit-label">提供できること</label>
                          <textarea className="sec-edit-input" rows={3} value={secEditCanOffer} onChange={e=>setSecEditCanOffer(e.target.value)} placeholder={"例：Webデザイン、起業の相談、美味しいコーヒーを淹れること"}/>
                          <div style={{fontSize:10,color:TM,marginTop:2}}>読点（、）またはカンマ（,）で区切ってください</div>
                        </div>
                        <div>
                          <label className="sec-edit-label">求めていること</label>
                          <textarea className="sec-edit-input" rows={3} value={secEditLookingFor} onChange={e=>setSecEditLookingFor(e.target.value)} placeholder={"例：エンジニアの仲間、動画編集できる人"}/>
                          <div style={{fontSize:10,color:TM,marginTop:2}}>読点（、）またはカンマ（,）で区切ってください</div>
                        </div>
                        {secEditError&&<div style={{color:'#ef4444',fontSize:11,marginTop:6}}>{secEditError}</div>}
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button type="button" disabled={secSaving} onClick={()=>handleSectionSave('matching')} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:secSaving?'not-allowed':'pointer',opacity:secSaving?.7:1}}>
                            {secSaving?'保存中...':'💾 保存'}
                          </button>
                          <button type="button" onClick={closeSectionEdit} style={{padding:'9px 14px',borderRadius:8,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ 経歴 section ══ */}
              {(isMutual||isSelf)&&(
                <div className="sec-edit-career" style={{borderTop:'1px solid rgba(0,0,0,.04)',marginTop:8}}>
                  <div className={`sec-flip-inner${editingSection==='career'&&secFlipPhase?` ${secFlipPhase}`:''}`}>
                    {editingSection!=='career'&&(
                      <div style={{padding:'22px 24px 0',position:'relative'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                          <span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>経歴</span>
                          <span style={{fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:100,background:'#ede9fe',color:'#5b21b6'}}>相互フォローのみ</span>
                        </div>
                        {isSelf&&<button type="button" onClick={()=>openSectionEdit('career')} style={{position:'absolute',top:16,right:16,fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:100,border:'none',background:BG,boxShadow:NEU_SM,color:T2,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}><Pencil size={10}/> 編集</button>}
                        {userData.career?.length>0?(
                          <div style={{display:'flex',flexDirection:'column',position:'relative',paddingLeft:22}}>
                            <div style={{position:'absolute',left:6,top:8,bottom:8,width:2,background:'rgba(74,124,89,.2)',borderRadius:2}}/>
                            {userData.career.map((cr:any,i:number)=>(
                              <div key={i} style={{position:'relative',paddingBottom:20}}>
                                <div style={{position:'absolute',left:-19,top:4,width:14,height:14,borderRadius:'50%',background:i===0?SAGE:BG,boxShadow:i===0?`0 0 0 3px rgba(74,124,89,.2)`:NEU_SM,zIndex:1}}/>
                                <div style={{fontSize:10,color:TM,letterSpacing:'.04em'}}>{cr.start||'?'} — {cr.end||'現在'}</div>
                                <div style={{fontSize:13,fontWeight:700,color:T1,marginTop:2}}>{cr.company}</div>
                                <div style={{fontSize:12,color:T2,marginTop:1}}>{cr.role}</div>
                                {cr.description&&<div style={{fontSize:12,color:T2,marginTop:5,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:formatText(cr.description)}}/>}
                              </div>
                            ))}
                          </div>
                        ):(
                          isSelf&&<div style={{fontSize:12,color:TM,fontStyle:'italic'}}>未登録 — 編集ボタンから追加できます</div>
                        )}
                      </div>
                    )}
                    {editingSection==='career'&&(
                      <div style={{padding:'16px 24px',background:'rgba(74,124,89,.04)',borderRadius:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:SAGE,marginBottom:12}}>✏️ 経歴編集</div>
                        {secEditCareer.map((entry,i)=>(
                          <div key={i} style={{marginBottom:14,padding:'12px',background:BG,borderRadius:10,boxShadow:NEU_SM,position:'relative'}}>
                            <div style={{position:'absolute',top:10,right:10}}>
                              <button type="button" onClick={()=>setSecEditCareer(secEditCareer.filter((_,j)=>j!==i))}
                                style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:'1px solid #fca5a5',background:'#fef2f2',color:'#ef4444',cursor:'pointer',fontWeight:600}}>削除</button>
                            </div>
                            <div style={{fontSize:10,fontWeight:700,color:T2,marginBottom:8}}>経歴 #{i+1}</div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                              <div>
                                <label className="sec-edit-label">会社・組織名</label>
                                <input className="sec-edit-input" value={entry.company} onChange={e=>{const l=[...secEditCareer];l[i]={...l[i],company:e.target.value};setSecEditCareer(l);}} placeholder="例：株式会社〇〇"/>
                              </div>
                              <div>
                                <label className="sec-edit-label">役職・役割</label>
                                <input className="sec-edit-input" value={entry.role} onChange={e=>{const l=[...secEditCareer];l[i]={...l[i],role:e.target.value};setSecEditCareer(l);}} placeholder="例：代表取締役"/>
                              </div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                              <div>
                                <label className="sec-edit-label">開始年月</label>
                                <input className="sec-edit-input" type="month" value={entry.start} onChange={e=>{const l=[...secEditCareer];l[i]={...l[i],start:e.target.value};setSecEditCareer(l);}}/>
                              </div>
                              <div>
                                <label className="sec-edit-label">終了年月（空欄=現在）</label>
                                <input className="sec-edit-input" type="month" value={entry.end} onChange={e=>{const l=[...secEditCareer];l[i]={...l[i],end:e.target.value};setSecEditCareer(l);}} placeholder="現在"/>
                              </div>
                            </div>
                            <div>
                              <label className="sec-edit-label">業務内容・詳細</label>
                              <textarea className="sec-edit-input" rows={2} value={entry.description} onChange={e=>{const l=[...secEditCareer];l[i]={...l[i],description:e.target.value};setSecEditCareer(l);}} placeholder="担当業務や実績など"/>
                            </div>
                          </div>
                        ))}
                        <button type="button"
                          onClick={()=>setSecEditCareer([...secEditCareer,{company:'',role:'',start:'',end:'',description:''}])}
                          style={{width:'100%',padding:'10px',borderRadius:8,border:'1px dashed #4a7c59',background:'rgba(74,124,89,.06)',color:SAGE,fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                          ＋ 経歴を追加
                        </button>
                        <div style={{fontSize:10,color:TM,marginBottom:8}}>会社・組織名が入力された項目のみ保存されます</div>
                        {secEditError&&<div style={{color:'#ef4444',fontSize:11,marginBottom:6}}>{secEditError}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <button type="button" disabled={secSaving} onClick={()=>handleSectionSave('career')}
                            style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:SAGE,color:'#fff',fontSize:12,fontWeight:700,cursor:secSaving?'not-allowed':'pointer',opacity:secSaving?.7:1}}>
                            {secSaving?'保存中...':'💾 保存'}
                          </button>
                          <button type="button" onClick={closeSectionEdit}
                            style={{padding:'9px 14px',borderRadius:8,border:'none',background:BG,color:T2,fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:NEU_SM}}>戻る</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SNS Links */}
              {(userData.websiteUrl||userData.snsInstagram||userData.snsX)&&(
                <div style={{padding:'22px 24px 40px',borderTop:'1px solid rgba(0,0,0,.04)',marginTop:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}><span style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:T2}}>リンク・SNS</span></div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {userData.snsX&&<a href={userData.snsX.startsWith('http')?userData.snsX:'https://twitter.com/'+userData.snsX} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,textDecoration:'none',background:BG,boxShadow:NEU_SM,transition:'box-shadow .15s'}} onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_IN)} onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_SM)}>
                      <div style={{width:32,height:32,borderRadius:10,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#111',flexShrink:0}}>𝕏</div>
                      <div><div style={{fontSize:12,fontWeight:600,color:T1}}>X (Twitter)</div><div style={{fontSize:11,color:T2,marginTop:1}}>{userData.snsX.replace(/^https?:\/\/(twitter|x)\.com\//,'@')}</div></div>
                    </a>}
                    {userData.snsInstagram&&<a href={userData.snsInstagram.startsWith('http')?userData.snsInstagram:'https://instagram.com/'+userData.snsInstagram} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,textDecoration:'none',background:BG,boxShadow:NEU_SM,transition:'box-shadow .15s'}} onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_IN)} onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_SM)}>
                      <div style={{width:32,height:32,borderRadius:10,background:'#fce7f3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>📷</div>
                      <div><div style={{fontSize:12,fontWeight:600,color:T1}}>Instagram</div><div style={{fontSize:11,color:T2,marginTop:1}}>{userData.snsInstagram.replace(/^https?:\/\/instagram\.com\//,'@')}</div></div>
                    </a>}
                    {userData.websiteUrl&&<a href={userData.websiteUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,textDecoration:'none',background:BG,boxShadow:NEU_SM,transition:'box-shadow .15s'}} onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_IN)} onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_SM)}>
                      <div style={{width:32,height:32,borderRadius:10,background:'#edf3ef',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#2d5a3d',flexShrink:0}}>WEB</div>
                      <div><div style={{fontSize:12,fontWeight:600,color:T1}}>ウェブサイト</div><div style={{fontSize:11,color:T2,marginTop:1}}>{userData.websiteUrl.replace(/^https?:\/\//,'')}</div></div>
                    </a>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Media Tab ── */}
          {activeTab==='media'&&(
            <div style={{padding:'0 0 88px'}}>
              {/* Sub-tab bar */}
              <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,.06)',padding:'0 24px',gap:0}}>
                {([
                  {key:'videos'  as const, icon:<Film size={15}/>,       label:'動画',     count:userVideos.length},
                  {key:'podcasts'as const, icon:<Headphones size={15}/>, label:'音声',     count:userPodcasts.length},
                  {key:'articles'as const, icon:<FileText size={15}/>,   label:'記事',     count:userArticles.length},
                  {key:'playlists'as const,icon:<List size={15}/>,       label:'リスト',   count:playlists.length},
                  ...(isSelf ? [{key:'liked' as const, icon:<Heart size={15}/>, label:'いいね', count:likedItems.length}] : []),
                ] as const).map(t=>{
                  const active = mediaTab===t.key;
                  return (
                    <button key={t.key} onClick={()=>setMediaTab(t.key as any)}
                      style={{
                        flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        padding:'12px 4px 10px', border:'none', cursor:'pointer',
                        background:'transparent', position:'relative',
                        color: active ? SAGE : TM, transition:'color .15s',
                      }}>
                      {t.icon}
                      <span style={{fontSize:9,fontWeight:700,letterSpacing:'.06em'}} className="media-tab-label">{t.label}</span>
                      {t.count > 0 && <span style={{fontSize:8,fontWeight:700,color:active?SAGE:TM,opacity:.7}}>{t.count}</span>}
                      {active && <div style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:2,background:SAGE,borderRadius:2}}/>}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{padding:'16px 24px'}}>
                {mediaLoading ? (
                  <div style={{textAlign:'center',padding:'50px 0'}}>
                    <div style={{width:22,height:22,border:`2px solid ${SAGE}`,borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto',animation:'spin .8s linear infinite'}}/>
                    <div style={{fontSize:12,color:TM,marginTop:10}}>読み込み中...</div>
                  </div>
                ) : (
                  <>
                    {/* ── Videos ─────────────────────────── */}
                    {mediaTab==='videos' && (
                      userVideos.length===0 ? (
                        <div style={{textAlign:'center',padding:'50px 20px'}}>
                          <Film size={32} color={TM} style={{margin:'0 auto 10px',opacity:.4}}/>
                          <div style={{fontSize:13,fontWeight:600,color:T2}}>動画はまだありません</div>
                        </div>
                      ) : (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14}}>
                          {userVideos.map((m:any)=>(
                            <Link key={m.id} href={`/media/videos/detail?id=${m.id}`} style={{textDecoration:'none',color:'inherit',display:'block'}}>
                              <div style={{borderRadius:14,overflow:'hidden',background:BG,boxShadow:NEU_SM,transition:'transform .15s,box-shadow .15s'}}
                                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.12)';}}
                                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=NEU_SM;}}>
                                <div style={{aspectRatio:'16/9',background:'linear-gradient(135deg,#1a3024,#0d1f14)',position:'relative',overflow:'hidden'}}>
                                  {(m.thumbnailUrl||m.thumbnailURL) ? (
                                    <img src={m.thumbnailUrl||m.thumbnailURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                  ) : (
                                    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><Film size={24} color="rgba(255,255,255,.3)"/></div>
                                  )}
                                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.1)'}}>
                                    <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.2)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                      <Play size={14} color="#fff" fill="#fff"/>
                                    </div>
                                  </div>
                                </div>
                                <div style={{padding:'10px 12px'}}>
                                  <div style={{fontSize:12,fontWeight:700,color:T1,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>{m.title||'無題'}</div>
                                  <div style={{fontSize:10,color:TM,marginTop:4}}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString('ja-JP',{month:'short',day:'numeric'}) : ''}</div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )
                    )}

                    {/* ── Podcasts ────────────────────────── */}
                    {mediaTab==='podcasts' && (
                      userPodcasts.length===0 ? (
                        <div style={{textAlign:'center',padding:'50px 20px'}}>
                          <Headphones size={32} color={TM} style={{margin:'0 auto 10px',opacity:.4}}/>
                          <div style={{fontSize:13,fontWeight:600,color:T2}}>音声はまだありません</div>
                        </div>
                      ) : (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:14}}>
                          {userPodcasts.map((m:any)=>(
                            <Link key={m.id} href={`/media/podcasts/detail?id=${m.id}`} style={{textDecoration:'none',color:'inherit',display:'block'}}>
                              <div style={{borderRadius:14,overflow:'hidden',background:BG,boxShadow:NEU_SM,transition:'transform .15s'}}
                                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                                onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                                <div style={{aspectRatio:'1',background:'linear-gradient(135deg,#1a3024,#2d5a3e)',position:'relative',overflow:'hidden'}}>
                                  {(m.thumbnailUrl||m.thumbnailURL) ? (
                                    <img src={m.thumbnailUrl||m.thumbnailURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                  ) : (
                                    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><Headphones size={24} color="rgba(255,255,255,.3)"/></div>
                                  )}
                                  {m.duration && !isNaN(m.duration) && isFinite(m.duration) && (
                                    <span style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.7)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:6,fontFamily:'monospace'}}>
                                      {Math.floor(m.duration/60)}:{String(Math.floor(m.duration%60)).padStart(2,'0')}
                                    </span>
                                  )}
                                </div>
                                <div style={{padding:'10px 12px'}}>
                                  <div style={{fontSize:12,fontWeight:700,color:T1,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>{m.title||'無題'}</div>
                                  <div style={{fontSize:10,color:TM,marginTop:4}}>{m.authorName||''}</div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )
                    )}

                    {/* ── Articles ────────────────────────── */}
                    {mediaTab==='articles' && (
                      userArticles.length===0 ? (
                        <div style={{textAlign:'center',padding:'50px 20px'}}>
                          <FileText size={32} color={TM} style={{margin:'0 auto 10px',opacity:.4}}/>
                          <div style={{fontSize:13,fontWeight:600,color:T2}}>記事はまだありません</div>
                          {isSelf && (
                            <Link href="/media/articles/edit" style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:14,padding:'7px 18px',borderRadius:100,background:SB,color:LIME,fontSize:11,fontWeight:700,textDecoration:'none'}}>
                              <Plus size={12}/> 記事を書く
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:12}}>
                          {userArticles.map((a:any)=>{
                            const artDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt||0);
                            return (
                              <Link key={a.id} href={`/media/articles/view?id=${a.id}`} style={{textDecoration:'none',color:'inherit',display:'block'}}>
                                <div style={{display:'flex',gap:12,padding:12,borderRadius:14,background:BG,boxShadow:NEU_SM,transition:'transform .15s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                                  {(a.coverImageUrl||a.thumbnailUrl) && (
                                    <div style={{width:80,height:80,borderRadius:10,overflow:'hidden',flexShrink:0,background:'#eee'}}>
                                      <img src={a.coverImageUrl||a.thumbnailUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                    </div>
                                  )}
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:13,fontWeight:700,color:T1,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>{a.title||'無題'}</div>
                                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6,flexWrap:'wrap'}}>
                                      {a.category && (
                                        <span style={{fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:100,background:'rgba(74,124,89,.08)',color:SAGE}}>{a.category}</span>
                                      )}
                                      {a.readingTime && <span style={{fontSize:10,color:TM}}>約{a.readingTime}分</span>}
                                    </div>
                                    <div style={{fontSize:10,color:TM,marginTop:4}}>{artDate.toLocaleDateString('ja-JP',{year:'numeric',month:'short',day:'numeric'})}</div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )
                    )}

                    {/* ── Playlists ───────────────────────── */}
                    {mediaTab==='playlists' && (
                      <>
                        {isSelf && hasPlaylistPermission && (
                          <div style={{marginBottom:16}}>
                            <button onClick={()=>setIsPlaylistModalOpen(true)}
                              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',borderRadius:100,border:'none',background:SB,color:LIME,fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.2)'}}>
                              <Plus size={13}/> 新規プレイリスト
                            </button>
                          </div>
                        )}
                        {playlists.length===0 ? (
                          <div style={{textAlign:'center',padding:'50px 20px'}}>
                            <List size={32} color={TM} style={{margin:'0 auto 10px',opacity:.4}}/>
                            <div style={{fontSize:13,fontWeight:600,color:T2}}>プレイリストはまだありません</div>
                          </div>
                        ) : (
                          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
                            {playlists.map((pl:any)=>{
                              const itemCount = pl.items?.length || 0;
                              const isPaid = pl.access === 'paid';
                              return (
                                <div key={pl.id} onClick={()=>{setSelectedPlaylist(pl);setIsPlaylistDetailOpen(true);}}
                                  style={{borderRadius:14,overflow:'hidden',background:BG,boxShadow:NEU_SM,cursor:'pointer',transition:'transform .15s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                                  <div style={{aspectRatio:'16/9',background:'linear-gradient(135deg,#2d5a3e,#1a3024)',position:'relative',overflow:'hidden'}}>
                                    {pl.coverImageUrl ? (
                                      <img src={pl.coverImageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                    ) : (
                                      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><List size={28} color="rgba(255,255,255,.25)"/></div>
                                    )}
                                    {/* Price badge */}
                                    <span style={{
                                      position:'absolute',top:8,right:8,
                                      padding:'3px 10px',borderRadius:100,
                                      fontSize:9,fontWeight:800,letterSpacing:'.04em',
                                      background: isPaid ? 'rgba(212,162,74,.9)' : 'rgba(0,0,0,.5)',
                                      color: isPaid ? '#1a3024' : '#fff',
                                      backdropFilter:'blur(4px)',
                                    }}>
                                      {isPaid ? `¥${(pl.price||0).toLocaleString()}` : '無料'}
                                    </span>
                                  </div>
                                  <div style={{padding:'10px 12px'}}>
                                    <div style={{fontSize:12,fontWeight:700,color:T1,lineHeight:1.3}}>{pl.name||pl.title||'無題'}</div>
                                    <div style={{fontSize:10,color:TM,marginTop:4,display:'flex',alignItems:'center',gap:6}}>
                                      <span>{itemCount}件のコンテンツ</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* ── Liked ───────────────────────────── */}
                    {mediaTab==='liked' && isSelf && (
                      likedItems.length===0 ? (
                        <div style={{textAlign:'center',padding:'50px 20px'}}>
                          <Heart size={32} color={TM} style={{margin:'0 auto 10px',opacity:.4}}/>
                          <div style={{fontSize:13,fontWeight:600,color:T2}}>いいねしたコンテンツはありません</div>
                        </div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:10}}>
                          {likedItems.map((item:any)=>{
                            const likeType = item._likeType || 'video';
                            const href = likeType==='video' ? `/media/videos/detail?id=${item.id}`
                              : likeType==='podcast' ? `/media/podcasts/detail?id=${item.id}`
                              : `/media/articles/view?id=${item.id}`;
                            const typeIcon = likeType==='video' ? <Film size={12}/> : likeType==='podcast' ? <Headphones size={12}/> : <FileText size={12}/>;
                            const typeLabel = likeType==='video' ? 'THEATER' : likeType==='podcast' ? 'CAST' : '記事';
                            const thumbUrl = item.thumbnailUrl || item.thumbnailURL || item.coverImageUrl;
                            return (
                              <Link key={`${likeType}-${item.id}`} href={href} style={{textDecoration:'none',color:'inherit',display:'block'}}>
                                <div style={{display:'flex',gap:12,padding:10,borderRadius:12,background:BG,boxShadow:NEU_SM,transition:'transform .1s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                                  onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                                  <div style={{width:56,height:56,borderRadius:10,overflow:'hidden',flexShrink:0,background:'linear-gradient(135deg,#1a3024,#2d5a3e)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    {thumbUrl ? (
                                      <img src={thumbUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                    ) : typeIcon}
                                  </div>
                                  <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                                    <div style={{fontSize:12,fontWeight:700,color:T1,lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>{item.title||'無題'}</div>
                                    <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}>
                                      <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:9,fontWeight:600,padding:'2px 7px',borderRadius:100,background:'rgba(74,124,89,.08)',color:SAGE}}>
                                        {typeIcon} {typeLabel}
                                      </span>
                                      <span style={{fontSize:10,color:TM}}>{item.authorName||''}</span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Threads Tab ── */}
          {activeTab==='threads'&&(
            <div style={{padding:'20px 24px 88px',minWidth:0,maxWidth:'100%',boxSizing:'border-box',overflowX:'hidden'}}>
              {threadsLoading ? (
                <div style={{textAlign:'center',padding:'60px 0'}}>
                  <div style={{width:24,height:24,border:`2px solid ${SAGE}`,borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto',animation:'spin .8s linear infinite'}}/>
                  <div style={{fontSize:12,color:TM,marginTop:10}}>読み込み中...</div>
                </div>
              ) : userThreads.length === 0 ? (
                <div style={{textAlign:'center',padding:'60px 20px'}}>
                  <AtSign size={36} color={TM} style={{margin:'0 auto 12px'}}/>
                  <div style={{fontSize:14,fontWeight:700,color:T2,marginBottom:6}}>まだスレッドがありません</div>
                  <div style={{fontSize:12,color:TM}}>{isSelf ? '甲板から最初の投稿をしてみましょう' : 'このユーザーはまだ投稿していません'}</div>
                  {isSelf && (
                    <Link href="/home" style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:16,padding:'8px 20px',borderRadius:100,border:'none',background:SB,color:LIME,fontSize:12,fontWeight:700,textDecoration:'none',boxShadow:'0 2px 8px rgba(0,0,0,.2)'}}>
                      <Plus size={14}/> 投稿する
                    </Link>
                  )}
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:0}}>
                  {userThreads.map((p:any) => {
                    const ts = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt||0);
                    const ago = (() => {
                      const s = Math.floor((Date.now()-ts.getTime())/1000);
                      if (s<60) return `${s}秒前`;
                      if (s<3600) return `${Math.floor(s/60)}分前`;
                      if (s<86400) return `${Math.floor(s/3600)}時間前`;
                      return ts.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
                    })();
                    return (
                      <Link key={p.id} href={`/home/post?id=${p.id}`} style={{textDecoration:'none',color:'inherit'}}>
                        <div style={{padding:'16px 0',borderBottom:'1px solid rgba(0,0,0,.06)'}}>
                          <div style={{display:'flex',gap:12}}>
                            {/* Avatar */}
                            <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',background:SAGE,boxShadow:NEU_SM,flexShrink:0}}>
                              {(p.authorIcon || userData?.photoURL) ? (
                                <img src={p.authorIcon || userData?.photoURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
                                  onError={(e:any)=>{e.target.src='/default_avatar.png';}}/>
                              ) : (
                                <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:16,fontWeight:700}}>{(userData?.name||'?')[0]}</div>
                              )}
                            </div>
                            {/* Content */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                                <span style={{fontSize:13,fontWeight:700,color:T1}}>{p.authorName || userData?.name || '名無し'}</span>
                                <span style={{fontSize:11,color:TM}}>@{p.authorUserId || userData?.userId || ''}</span>
                                <span style={{fontSize:11,color:TM}}>· {ago}</span>
                              </div>
                              {/* Topic tag */}
                              {p.topicTag && (
                                <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:100,fontSize:9,fontWeight:600,background:'rgba(74,124,89,.08)',color:SAGE,marginBottom:6}}>
                                  <Hash size={8}/> {p.topicTag}
                                </span>
                              )}
                              {/* Text */}
                              <p style={{fontSize:14,lineHeight:1.7,color:T1,whiteSpace:'pre-wrap',wordBreak:'break-word',margin:'2px 0 0'}}>{p.text}</p>
                              {/* Images */}
                              <PostImageGrid images={p.images || []} />
                              {/* Engagement */}
                              <div style={{display:'flex',gap:18,marginTop:10}}>
                                <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:TM}}>
                                  <MessageCircle size={13}/> {p.replyCount||0}
                                </span>
                                <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:TM}}>
                                  <Repeat2 size={13}/> {p.repostCount||0}
                                </span>
                                <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:TM}}>
                                  <Heart size={13}/> {p.likeCount||0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Activity Tab ── */}
          {activeTab==='activity'&&(
            <div style={{padding:'20px 24px 88px',minWidth:0,maxWidth:'100%',boxSizing:'border-box',overflowX:'hidden'}}>
              {/* ── 自分ビュー ── */}
              {isSelf&&(
                <div>
                  {/* フィルター: ロール & 期間 */}
                  <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
                    {([['all','すべて'],['joined','参加'],['hosted','主催']] as const).map(([v,l])=>(
                      <button key={v} onClick={()=>setActRoleFilter(v)}
                        style={{fontSize:11,padding:'5px 14px',borderRadius:100,border:'none',cursor:'pointer',fontWeight:700,
                          background:actRoleFilter===v?SB:BG,color:actRoleFilter===v?LIME:TM,
                          boxShadow:actRoleFilter===v?'2px 2px 6px rgba(0,0,0,.18)':NEU_SM,transition:'all .15s'}}>
                        {l}
                      </button>
                    ))}
                    <div style={{width:1,background:'rgba(0,0,0,.08)',margin:'0 2px'}}/>
                    {([['all','全期間'],['upcoming','予定中'],['past','過去']] as const).map(([v,l])=>(
                      <button key={v} onClick={()=>setActPeriodFilter(v)}
                        style={{fontSize:11,padding:'5px 14px',borderRadius:100,border:'none',cursor:'pointer',fontWeight:700,
                          background:actPeriodFilter===v?SB:BG,color:actPeriodFilter===v?LIME:TM,
                          boxShadow:actPeriodFilter===v?'2px 2px 6px rgba(0,0,0,.18)':NEU_SM,transition:'all .15s'}}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {/* イベントリスト */}
                  {activityLoading
                    ?<div style={{textAlign:'center',padding:'32px 0',color:TM,fontSize:12}}>読み込み中…</div>
                    :(() => {
                      const now = new Date().toISOString().slice(0,10);
                      let items = [
                        ...(actRoleFilter!=='hosted'?activityJoined:[]),
                        ...(actRoleFilter!=='joined'?activityHosted:[]),
                      ];
                      if (actPeriodFilter==='upcoming') items=items.filter(e=>(e.startDate||'')>=now);
                      if (actPeriodFilter==='past')     items=items.filter(e=>(e.startDate||'')<now);
                      items.sort((a,b)=>new Date(b.startDate||0).getTime()-new Date(a.startDate||0).getTime());
                      if (items.length===0) return(
                        <div style={{textAlign:'center',padding:'32px 0',color:TM,fontSize:13}}>
                          <CalendarDays size={28} style={{margin:'0 auto 10px',opacity:.3}}/>
                          該当するイベントはありません
                        </div>
                      );
                      return items.map(evt=>{
                        const isPinned=featuredEventIds.includes(evt.id);
                        const isSaving=pinSaving===evt.id;
                        const isUpcoming=(evt.startDate||'')>=now;
                        return(
                          <div key={evt.id+evt.role}
                            onClick={()=>setActivityDetailEvent(evt)}
                            style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:14,background:BG,
                              boxShadow:isPinned?`0 0 0 2px ${LIME},${NEU_SM}`:NEU_SM,
                              marginBottom:10,transition:'box-shadow .2s',cursor:'pointer'}}>
                            <img src={evt.thumbnailUrl||`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="%231a3024"/><text x="50%" y="56%" text-anchor="middle" fill="%238ecfb2" font-size="8" font-weight="700" font-family="sans-serif">N</text></svg>')}`} alt=""
                              style={{width:48,height:48,borderRadius:8,objectFit:'cover',flexShrink:0,border:'1px solid rgba(0,0,0,.07)'}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                                <span style={{fontSize:9,padding:'2px 7px',borderRadius:100,fontWeight:700,
                                  background:evt.role==='hosted'?SB:'rgba(74,124,89,.12)',
                                  color:evt.role==='hosted'?LIME:SAGE}}>
                                  {evt.role==='hosted'?'主催':'参加'}
                                </span>
                                {isUpcoming&&<span style={{fontSize:9,padding:'2px 7px',borderRadius:100,fontWeight:700,background:'rgba(251,191,36,.15)',color:'#b45309'}}>予定中</span>}
                              </div>
                              <div style={{fontSize:13,fontWeight:700,color:T1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{evt.title||'名称未設定'}</div>
                              <div style={{fontSize:10,color:T2,marginTop:2}}>{evt.startDate||''}{evt.startDate!==evt.endDate&&evt.endDate?` 〜 ${evt.endDate}`:''}</div>
                            </div>
                            {/* ピンボタン — 明示ピル型 */}
                            <button onClick={e=>{e.stopPropagation();togglePin(evt.id);}} disabled={isSaving}
                              style={{flexShrink:0,padding:'4px 10px',borderRadius:100,border:'none',cursor:'pointer',
                                background:isPinned?SB:BG,
                                color:isPinned?LIME:TM,
                                boxShadow:isPinned?'2px 2px 8px rgba(0,0,0,.22)':NEU_SM,
                                fontSize:10,fontWeight:700,letterSpacing:'.04em',
                                display:'flex',alignItems:'center',gap:4,
                                transition:'all .2s',opacity:isSaving?.5:1,
                                whiteSpace:'nowrap'}}>
                              {isPinned?<>✓ 公開中</>:<>○ 公開する</>}
                            </button>
                          </div>
                        );
                      });
                    })()}
                </div>
              )}

              {/* ── 他人ビュー（相互フォロー / 非相互）── */}
              {!isSelf&&(
                (() => {
                  // 全員に公開
                  if (activityLoading) return <div style={{textAlign:'center',padding:'32px 0',color:TM,fontSize:12}}>読み込み中…</div>;
                  const now = new Date().toISOString().slice(0,10);
                  const featured = featuredEventIds;
                  const allEvts = [...activityJoined,...activityHosted];
                  // 今後の主催イベント（ピン済み・未ピン問わず全件表示）
                  const upcomingHosted = activityHosted.filter(e=>(e.startDate||'')>=now)
                    .sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime());
                  // 過去のピン済み実績
                  const pastFeatured = allEvts
                    .filter(e=>featured.includes(e.id)&&(e.startDate||'')<now)
                    .sort((a,b)=>new Date(b.startDate).getTime()-new Date(a.startDate).getTime());
                  if (upcomingHosted.length===0&&pastFeatured.length===0) return(
                    <div style={{textAlign:'center',padding:'48px 0',color:TM,fontSize:13}}>
                      <CalendarDays size={28} style={{margin:'0 auto 10px',opacity:.3}}/>
                      公開されている活動はまだありません
                    </div>
                  );
                  return(
                    <div>
                      {/* 今後の主催イベント */}
                      {upcomingHosted.length>0&&(
                        <div style={{marginBottom:24}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',color:SAGE,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                            <CalendarDays size={12} color={SAGE}/>主催予定のイベント
                          </div>
                          {upcomingHosted.map(evt=>(
                            <div key={evt.id}
                              onClick={()=>setActivityDetailEvent(evt)}
                              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,
                                background:`linear-gradient(135deg,${SB}08,${SB}04)`,
                                border:`1px solid ${LIME}40`,boxShadow:NEU_SM,marginBottom:10,cursor:'pointer'}}>
                              <img src={evt.thumbnailUrl||`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="%231a3024"/><text x="50%" y="56%" text-anchor="middle" fill="%238ecfb2" font-size="8" font-weight="700" font-family="sans-serif">N</text></svg>')}`} alt=""
                                style={{width:52,height:52,borderRadius:10,objectFit:'cover',flexShrink:0}}/>
                              <div style={{flex:1,minWidth:0}}>
                                <span style={{fontSize:9,padding:'2px 7px',borderRadius:100,fontWeight:700,background:SB,color:LIME,marginBottom:5,display:'inline-block'}}>主催</span>
                                <div style={{fontSize:13,fontWeight:700,color:T1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{evt.title||'名称未設定'}</div>
                                <div style={{fontSize:10,color:T2,marginTop:2}}>{evt.startDate||''}{evt.locationName?` · ${evt.locationName}`:''}</div>
                              </div>
                              <ChevronRight size={13} color={LIME} style={{flexShrink:0}}/>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 過去の実績（ピン済みのみ） */}
                      {pastFeatured.length>0&&(
                        <div>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',color:T2,marginBottom:10}}>イベント実績</div>
                          {pastFeatured.map(evt=>(
                            <div key={evt.id+evt.role}
                              onClick={()=>setActivityDetailEvent(evt)}
                              style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,background:BG,boxShadow:NEU_SM,marginBottom:8,cursor:'pointer'}}>
                              <img src={evt.thumbnailUrl||`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="%231a3024"/><text x="50%" y="56%" text-anchor="middle" fill="%238ecfb2" font-size="7" font-weight="700" font-family="sans-serif">N</text></svg>')}`} alt=""
                                style={{width:40,height:40,borderRadius:8,objectFit:'cover',flexShrink:0,opacity:.9}}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                                  <span style={{fontSize:9,padding:'1px 6px',borderRadius:100,fontWeight:700,
                                    background:evt.role==='hosted'?SB:'rgba(74,124,89,.12)',
                                    color:evt.role==='hosted'?LIME:SAGE}}>
                                    {evt.role==='hosted'?'主催':'参加'}
                                  </span>
                                </div>
                                <div style={{fontSize:12,fontWeight:600,color:T1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{evt.title||'名称未設定'}</div>
                                <div style={{fontSize:10,color:TM,marginTop:1}}>{evt.startDate||''}</div>
                              </div>
                              <ChevronRight size={13} color={TM} style={{flexShrink:0}}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}


        </div>{/* /content-col */}

        </div>{/* /lg:grid */}
      </div>{/* /main */}



      {/* Modals */}
      {followModalType&&<FollowModal isOpen={!!followModalType} targetUid={targetUid||""} myUid={user?.uid||""} type={followModalType} onClose={()=>setFollowModalType(null)}/>}
      {isMemoOpen&&!isSelf&&<KeyMemoModal isOpen={isMemoOpen} onClose={()=>setIsMemoOpen(false)} currentUserId={user?.uid||""} targetUserId={targetUid||""} targetUserName={userData?.name||""}/>}
      {isPlaylistModalOpen&&isSelf&&<PlaylistModal isOpen={isPlaylistModalOpen} onClose={()=>{setIsPlaylistModalOpen(false);setEditingPlaylistId(null);}} userId={user?.uid||""} playlistId={editingPlaylistId} onSaved={()=>{setIsPlaylistModalOpen(false);setEditingPlaylistId(null);setMediaRefreshKey(k=>k+1);}}/>}
      {selectedPlaylist&&<PlaylistDetailModal isOpen={isPlaylistDetailOpen} playlist={selectedPlaylist} onClose={()=>{setIsPlaylistDetailOpen(false);setSelectedPlaylist(null);}} canEdit={isSelf} onEdit={()=>{setIsPlaylistDetailOpen(false);setEditingPlaylistId(selectedPlaylist.id);setIsPlaylistModalOpen(true);}}/>}
      <NotificationModal isOpen={showNotificationModal} onClose={()=>setShowNotificationModal(false)} currentUid={user?.uid||""}/>    
      {isSelf && <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentUid={user?.uid||""} onLogout={handleLogout}/>}
      {isSelf && <EventsCalendarModal
        isOpen={showEventsModal}
        onClose={() => setShowEventsModal(false)}
        currentUid={user?.uid || ''}
        profileUserId={userData?.userId}
        onOpenEvent={(evt) => { setShowEventsModal(false); window.location.href = `/events?eventId=${evt.id}`; }}
      />}
      {/* 活動タブイベント詳細シート */}
      {activityDetailEvent && (
        <EventDetailSheet
          event={activityDetailEvent}
          onClose={()=>setActivityDetailEvent(null)}
          setFullImageUrl={()=>{}}
          userData={userData}
          currentUserId={user?.uid}
          hideEventLink={false}
        />
      )}


      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        html,body{overflow-x:hidden!important;max-width:100vw!important}
        *{box-sizing:border-box}

        /* PC ではフロートナビの余白をリセット */
        @media(min-width:1024px){body{padding-bottom:0}}

        /* モバイル: すべての要素が画面幅内に収まるように */
        @media(max-width:1023px){
          .profile-col-wrap,.content-col-wrap{
            width:100%!important;max-width:100vw!important;overflow-x:hidden!important;
          }
        }

        /* Mobile hero: dark green profile column dark→light text */
        @media(max-width:1023px){
          .profile-col-wrap{
            background:#1a3024!important;
          }
          /* Profile card transparent on mobile */
          .profile-col-wrap .p-card-wrap{
            background:transparent!important;
            box-shadow:none!important;
            border-radius:0!important;
            padding:24px 20px 20px!important;
          }
          /* Name */
          .profile-col-wrap .p-name{color:#e8f4ec!important}
          /* Handle */
          .profile-col-wrap .p-handle{color:#7aab88!important}
          /* Job title */
          .profile-col-wrap .p-jobtitle{color:#d4ead9!important}
          /* Bio */
          .profile-col-wrap .p-bio{color:rgba(255,255,255,.65)!important}
          /* Info chips: more readable on dark green background */
          .profile-col-wrap .p-info-chips{
            color:#8ebf9e!important;
            border-top-color:rgba(255,255,255,.1)!important;
            border-bottom-color:rgba(255,255,255,.1)!important;
          }
          /* Rank badge: lime */
          .profile-col-wrap .rank-badge{
            background:rgba(163,230,53,.1)!important;
            border-color:rgba(163,230,53,.25)!important;
            color:#8ecfb2!important;
            box-shadow:3px 3px 8px rgba(0,0,0,.3),-3px -3px 8px rgba(255,255,255,.04)!important;
          }
          /* MBTI badge: adjust for dark bg */
          .profile-col-wrap .mbti-line{color:rgba(255,255,255,.7)!important}
          /* Mutual badge */
          .profile-col-wrap .mutual-badge{
            background:rgba(163,230,53,.1)!important;
            border-color:rgba(163,230,53,.25)!important;
            color:#8ecfb2!important;
          }
          /* Follow button */
          .profile-col-wrap .follow-btn-following{
            background:rgba(255,255,255,.08)!important;
            color:#d4ead9!important;
            border:1px solid rgba(255,255,255,.15)!important;
            box-shadow:none!important;
          }
          .profile-col-wrap .follow-btn-notfollowing{
            background:#8ecfb2!important;
            color:#1a3024!important;
          }
          /* Memo button */
          .profile-col-wrap .memo-btn{
            background:rgba(255,255,255,.06)!important;
            color:#c9b97a!important;
            border:1px solid rgba(201,185,122,.2)!important;
            box-shadow:none!important;
          }
          /* Edit button */
          .profile-col-wrap .edit-btn-link{
            background:rgba(255,255,255,.08)!important;
            box-shadow:none!important;
            border:1px solid rgba(255,255,255,.15)!important;
            color:#d4ead9!important;
          }
          /* Stats grid */
          .profile-col-wrap .stat-num{color:#e8f4ec!important}
          .profile-col-wrap .stat-lbl{color:rgba(255,255,255,.4)!important}
          .profile-col-wrap .stat-cell-btn{
            background:rgba(255,255,255,.02)!important;
            box-shadow:inset 4px 4px 12px rgba(0,0,0,.38),inset -4px -4px 10px rgba(255,255,255,.05)!important;
          }
          /* OS card */
          .profile-col-wrap .os-card-link{
            background:rgba(255,255,255,.04)!important;
            border:1px solid rgba(255,255,255,.08)!important;
            box-shadow:5px 5px 16px rgba(0,0,0,.38),-5px -5px 14px rgba(255,255,255,.05)!important;
          }
          .profile-col-wrap .os-seal-wrap{
            background:#1a3024!important;
            box-shadow:inset 4px 4px 12px rgba(0,0,0,.38),inset -4px -4px 10px rgba(255,255,255,.05)!important;
            outline:2px solid #c2840a!important;
            outline-offset:-2px!important;
          }
          .profile-col-wrap .os-name-text{color:#e8f4ec!important}
          .profile-col-wrap .os-copy-text{color:#7aab88!important}
          .profile-col-wrap .os-lbl-text{color:rgba(255,255,255,.3)!important}
          /* Score */
          .profile-col-wrap .score-track-wrap{
            box-shadow:inset 4px 4px 12px rgba(0,0,0,.38),inset -4px -4px 10px rgba(255,255,255,.05)!important;
            background:rgba(0,0,0,.2)!important;
          }
          .profile-col-wrap .score-ttl-text{color:#7aab88!important}
          /* Info strip */
          .profile-col-wrap .info-strip-wrap{
            background:rgba(255,255,255,.03)!important;
            box-shadow:5px 5px 16px rgba(0,0,0,.38),-5px -5px 14px rgba(255,255,255,.05)!important;
            border-radius:14px!important;
            border-top:none!important;
            margin:0 0 0!important;
            padding:14px 0 8px!important;
          }
          .profile-col-wrap .info-chip-item{color:#7aab88!important}
          /* Copy link btn */
          .profile-col-wrap .copy-link-btn{
            background:rgba(255,255,255,.06)!important;
            box-shadow:none!important;
            border:1px solid rgba(255,255,255,.1)!important;
            color:#7aab88!important;
          }
          /* LIVE indicator */
          .profile-col-wrap .live-btn{
            background:rgba(239,68,68,.15)!important;
            border:1px solid rgba(239,68,68,.3)!important;
            color:#fca5a5!important;
          }
          .profile-col-wrap .signal-cast-btn{
            background:#8ecfb2!important;
            color:#1a3024!important;
          }
          /* Border top lime for content col */
          .content-col-wrap{border-top:2px solid #8ecfb2}
        }
      `}</style>
    </div>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={
      <div style={{display:'flex',minHeight:'100dvh',background:'#f8f6f3',alignItems:'center',justifyContent:'center',color:'#7a7068',fontWeight:700,letterSpacing:'.1em',fontSize:13}}>
        Loading...
      </div>
    }>
      <UserProfileContent/>
    </Suspense>
  );
}
