'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, getDocs, onSnapshot, query, where, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import MediaPostModal from '@/components/MediaPostModal';
import {
    Mic, Film, FileText, Search, Users, Sparkles, X, ChevronRight,
    Radio, Play, Plus, SlidersHorizontal, Loader2, Anchor, BookOpen
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════ *
 *  Design tokens  (neumorphic palette — same as crew/event pages)
 * ══════════════════════════════════════════════════════════════════ */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const AMBER = '#d4a24a';
const NEU  = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';
const FALLBACK_VIDEO   = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18"><rect width="32" height="18" fill="#2a2520"/><polygon points="12,4 12,14 22,9" fill="#4a7c59"/></svg>');
const FALLBACK_PODCAST = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#4a7c59"/><rect x="13" y="6" width="6" height="11" rx="3" fill="#f8f6f3"/><path d="M9 17 Q9 25 16 25 Q23 25 23 17" stroke="#f8f6f3" stroke-width="2" fill="none"/><rect x="15" y="25" width="2" height="4" fill="#f8f6f3"/></svg>');
const FALLBACK_AVATAR  = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#dbd7d2"/><circle cx="16" cy="12" r="5" fill="#b0a89e"/><ellipse cx="16" cy="26" rx="9" ry="7" fill="#b0a89e"/></svg>');

/* ══════════════════════════════════════════════════════════════════ *
 *  Types
 * ══════════════════════════════════════════════════════════════════ */
interface PodcastData { id:string; title:string; description:string; tags:string[]; authorId:string; authorName:string; authorIcon:string; thumbnailUrl:string; duration:number; createdAt:any; updatedAt:any; }
interface VideoData   { id:string; title:string; description:string; tags:string[]; authorId:string; authorName:string; authorIcon:string; thumbnailUrl:string; createdAt:string; }
interface LiveRoomData { id:string; hostName:string; hostIcon:string; title:string; status:string; startedAt:any; }
interface ArticleData { id:string; title:string; body:string; bodyText?:string; authorId:string; authorName:string; authorIcon:string; thumbnailUrl?:string; coverImageUrl?:string; tags:string[]; category?:string; createdAt:any; status?:string; visibility?:string; allowedUserIds?:string[]; allowedListIds?:string[]; }

type TabKey = 'cast' | 'theater' | 'article';

/* ══════════════════════════════════════════════════════════════════ *
 *  Tag presets per tab
 * ══════════════════════════════════════════════════════════════════ */
const CAST_TAGS   = ['','対談・インタビュー','ひとり語り','ノウハウ共有','活動報告'];
const THEATER_TAGS = ['','ピッチ・資金調達','ビジネスパートナー募集','PR・宣伝','活動記録','ノウハウ共有'];
const ARTICLE_TAGS = ['','ノウハウ','体験記','お知らせ','コラム','インタビュー','イベントレポート'];
const TAG_LABELS: Record<string,string> = { '':'すべて', 'ビジネスパートナー募集':'パートナー募集' };

/* helper */
const fmtDur = (s:number|undefined) => {
    if(!s||isNaN(s)||!isFinite(s)) return '';
    const m=Math.floor(s/60), sec=Math.floor(s%60);
    return `${m}:${sec<10?'0'+sec:sec}`;
};
const fmtDate = (d:any) => {
    try { const dt = d?.toDate ? d.toDate() : new Date(d); return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`; }
    catch { return ''; }
};

/* ══════════════════════════════════════════════════════════════════ *
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════ */
export default function MediaPage() {
    return (
        <Suspense fallback={null}>
            <MediaPageInner />
        </Suspense>
    );
}

function MediaPageInner() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialTab = (searchParams.get('tab') as TabKey) || 'cast';
    const [tab, setTab] = useState<TabKey>(['cast','theater','article'].includes(initialTab) ? initialTab : 'cast');
    const [searchQ, setSearchQ] = useState('');
    const [tagQ, setTagQ] = useState('');

    const [podcasts, setPodcasts] = useState<PodcastData[]>([]);
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [articles, setArticles] = useState<ArticleData[]>([]);
    const [liveRooms, setLiveRooms] = useState<LiveRoomData[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [canPost, setCanPost] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [postModalOpen, setPostModalOpen] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalItems, setModalItems] = useState<any[]>([]);
    const [modalType, setModalType] = useState<TabKey>('cast');

    /* ── Data fetch ──────────────────────────────────────────────── */
    useEffect(() => {
        if (loading) return;
        const go = async () => {
            try {
                if (user && !user.isAnonymous) {
                    const mySnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
                    if (mySnap.exists()) {
                        const d = mySnap.data();
                        setMyProfile(d);
                        const rank = d.membershipRank||'arrival';
                        if (rank!=='arrival'||d.userId==='admin') setCanPost(true);
                    }
                    const fSnap = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'following'));
                    setFollowingIds(fSnap.docs.map(d=>d.id));
                }

                // podcasts
                const pSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','podcasts'));
                const pods: PodcastData[] = [];
                pSnap.forEach(d=>pods.push({id:d.id,...d.data()} as PodcastData));
                pods.sort((a,b)=> new Date(b.createdAt||b.updatedAt||0).getTime() - new Date(a.createdAt||a.updatedAt||0).getTime());
                setPodcasts(pods);

                // videos
                const vSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','videos'));
                const vids: VideoData[] = [];
                vSnap.forEach(d=>vids.push({id:d.id,...d.data()} as VideoData));
                vids.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setVideos(vids);

                // articles
                const aSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','articles'));
                const allArts: ArticleData[] = [];
                aSnap.forEach(d=>{
                    const data = d.data();
                    if(data.status === 'published') allArts.push({id:d.id,...data} as ArticleData);
                });
                // Use local variable since state update is async
                let myFollowingIds: string[] = [];
                if (user && !user.isAnonymous) {
                    const fSnap2 = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'following'));
                    myFollowingIds = fSnap2.docs.map(d=>d.id);
                }
                const arts = allArts.filter(a => {
                    // Own articles always visible
                    if (user && a.authorId === user.uid) return true;
                    const vis = a.visibility || 'public';
                    // 'public' or legacy 'members'/'paid' → show to all
                    if (vis === 'public' || vis === 'members' || vis === 'paid') return true;
                    if (!user || user.isAnonymous) return false;

                    if (vis === 'followers' || vis === 'mutual') {
                        return myFollowingIds.includes(a.authorId);
                    }
                    if (vis === 'custom') {
                        if (a.allowedUserIds?.includes(user.uid)) return true;
                        return false;
                    }
                    return true;
                });

                arts.sort((a,b)=> {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt||0).getTime();
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt||0).getTime();
                    return tB-tA;
                });
                setArticles(arts);
            } catch(e){ console.error(e); }
            finally { setDataLoaded(true); }
        };
        go();

        // live rooms
        const lRef = collection(db,'artifacts',APP_ID,'public','data','live_rooms');
        const q = query(lRef, where('status','==','live'));
        const unsub = onSnapshot(q, snap => {
            const rooms: LiveRoomData[] = [];
            snap.forEach(d=>rooms.push({id:d.id,...d.data()} as LiveRoomData));
            rooms.sort((a,b)=>(b.startedAt?.toMillis?.()||0)-(a.startedAt?.toMillis?.()||0));
            setLiveRooms(rooms);
        });
        return ()=>unsub();
    }, [user, loading]);

    /* ── Tab change resets filter ──────────────────────────────── */
    const switchTab = (t:TabKey) => {
        setTab(t); setSearchQ(''); setTagQ('');
        const url = new URL(window.location.href);
        url.searchParams.set('tab', t);
        window.history.replaceState({}, '', url.toString());
    };

    /* ── Filtering helpers ────────────────────────────────────── */
    const currentTags = tab==='cast'?CAST_TAGS:tab==='theater'?THEATER_TAGS:ARTICLE_TAGS;
    const allItems = tab==='cast'?podcasts:tab==='theater'?videos:articles;
    const isFiltering = searchQ!==''||tagQ!=='';

    const filtered = allItems.filter((item:any) => {
        const matchTag = !tagQ || (item.tags && item.tags.includes(tagQ)) || (item.category && item.category === tagQ);
        const matchSearch = !searchQ ||
            (item.title||'').toLowerCase().includes(searchQ.toLowerCase()) ||
            (item.description||item.body||'').toLowerCase().includes(searchQ.toLowerCase());
        return matchTag && matchSearch;
    });
    const following = allItems.filter((i:any)=>followingIds.includes(i.authorId));
    let recommended = allItems.filter((i:any)=>!followingIds.includes(i.authorId));
    if(!recommended.length && allItems.length) recommended = [...allItems];

    /* ── Open full-list modal ─────────────────────────────────── */
    const openModal = (title:string, items:any[], type:TabKey) => {
        setModalTitle(title); setModalItems(items); setModalType(type); setModalOpen(true);
    };

    /* ── Post label ──────────────────────────────────── */
    const postLabel = tab==='cast'?'音声を投稿':tab==='theater'?'動画を投稿':tab==='article'?'記事を書く':'';
    const canOpenPost = canPost && postLabel;

    /* ══════════════════════════════════════════════════════════════ *
     *  CARDS
     * ══════════════════════════════════════════════════════════════ */
    const PodcastCard = ({p,scroll}:{p:PodcastData;scroll?:boolean}) => (
        <Link href={`/media/podcasts/detail?id=${p.id}`}
            style={{
                display:'flex', flexDirection:'column', gap:8,
                width: scroll?148:'100%', flexShrink: scroll?0:undefined,
                textDecoration:'none', color:T1,
            }}>
            <div style={{
                width:'100%', aspectRatio:'1', borderRadius:14, overflow:'hidden',
                background:BG, boxShadow:NEU_SM, position:'relative',
            }}>
                <img src={p.thumbnailUrl||FALLBACK_PODCAST} alt={p.title}
                    style={{ width:'100%',height:'100%',objectFit:'cover' }}
                    onError={e=>{const i=e.target as HTMLImageElement;i.onerror=null;i.src=FALLBACK_PODCAST;}} />
                {fmtDur(p.duration) && (
                    <span style={{
                        position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.7)',
                        color:'#fff',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:6,
                        fontFamily:'monospace',letterSpacing:'.08em',
                    }}>{fmtDur(p.duration)}</span>
                )}
            </div>
            <div>
                <div style={{ fontSize:12, fontWeight:700, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.title||'タイトルなし'}</div>
                <div style={{ fontSize:10, color:TM, marginTop:2 }}>{p.authorName||'名無し'}</div>
            </div>
        </Link>
    );

    const VideoCard = ({v,scroll}:{v:VideoData;scroll?:boolean}) => (
        <Link href={`/media/videos/detail?id=${v.id}`}
            style={{
                display:'flex', flexDirection:'column',
                width: scroll?240:'100%', flexShrink: scroll?0:undefined,
                textDecoration:'none', color:T1, borderRadius:14, overflow:'hidden',
                background:BG, boxShadow:NEU_SM,
            }}>
            <div style={{ width:'100%', aspectRatio:'16/9', background:'#000', overflow:'hidden', position:'relative' }}>
                <img src={v.thumbnailUrl||FALLBACK_VIDEO} alt={v.title}
                    style={{ width:'100%',height:'100%',objectFit:'cover' }}
                    onError={e=>{const i=e.target as HTMLImageElement;i.onerror=null;i.src=FALLBACK_VIDEO;}} />
                <div style={{
                    position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                    background:'rgba(0,0,0,.15)',
                }}>
                    <div style={{ width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.2)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <Play size={16} color="#fff" fill="#fff" />
                    </div>
                </div>
            </div>
            <div style={{ padding:'10px 12px', display:'flex', gap:8 }}>
                <img src={v.authorIcon||FALLBACK_AVATAR} alt=""
                    style={{ width:28,height:28,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${BG}`,boxShadow:NEU_SM }}
                    onError={e=>{const i=e.target as HTMLImageElement;i.onerror=null;i.src=FALLBACK_AVATAR;}} />
                <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{v.title}</div>
                    <div style={{ fontSize:10, color:TM, marginTop:2 }}>{v.authorName||'名無し'} · {fmtDate(v.createdAt)}</div>
                </div>
            </div>
        </Link>
    );

    const ArticleCard = ({a,scroll}:{a:ArticleData;scroll?:boolean}) => {
        const thumb = a.coverImageUrl || a.thumbnailUrl;
        const tag   = a.category || a.tags?.[0] || '';
        return (
            <Link
                href={`/media/articles/view?id=${a.id}`}
                style={{ textDecoration:'none', color:'inherit', display:'block',
                    width: scroll ? 240 : '100%', flexShrink: scroll ? 0 : undefined }}
            >
                <div className="article-card-inner" style={{
                    display:'flex', flexDirection:'column',
                    width:'100%', borderRadius:6,
                    background:BG, boxShadow:NEU_SM,
                    overflow:'hidden', cursor:'pointer',
                    transition:'box-shadow .2s, transform .2s',
                }}
                    onMouseEnter={e=>{
                        (e.currentTarget as HTMLDivElement).style.boxShadow='6px 6px 18px #ccc9c4,-6px -6px 18px #fff';
                        (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)';
                    }}
                    onMouseLeave={e=>{
                        (e.currentTarget as HTMLDivElement).style.boxShadow=NEU_SM;
                        (e.currentTarget as HTMLDivElement).style.transform='none';
                    }}
                >
                    {/* ── Thumbnail ── */}
                    <div className="article-card-thumb" style={{
                        overflow:'hidden', flexShrink:0, position:'relative',
                        background:'linear-gradient(135deg,#2a2520 0%,#1a3024 60%,#4a7c59 100%)',
                        aspectRatio: scroll ? '4/3' : '16/9',
                        width: '100%',
                    }}>
                        {thumb ? (
                            <img src={thumb} alt={a.title}
                                style={{ width:'100%', height:'100%', objectFit:'cover', display:'block',
                                    transition:'transform .3s' }}
                                onError={e=>{ (e.target as HTMLImageElement).style.display='none'; }} />
                        ) : (
                            <div style={{
                                position:'absolute', inset:0,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                flexDirection:'column', gap:8,
                            }}>
                                <BookOpen size={28} color='rgba(142,207,178,.5)' />
                                <span style={{ fontSize:10, color:'rgba(142,207,178,.6)', fontWeight:600 }}>NO IMAGE</span>
                            </div>
                        )}
                    </div>

                    {/* ── Info ── */}
                    <div className="article-card-info" style={{ padding: scroll ? '10px 12px 12px' : '12px 14px 14px', flex:1, minWidth:0 }}>
                        {/* Tag + date row */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                            {tag && (
                                <span style={{
                                    padding:'2px 9px', borderRadius:100,
                                    background:SB, color:LIME,
                                    fontSize:9, fontWeight:700, letterSpacing:'.04em',
                                    lineHeight:1.8, flexShrink:0,
                                }}>
                                    {tag}
                                </span>
                            )}
                            <span style={{ fontSize:10, color:TM, fontWeight:500 }}>
                                {fmtDate(a.createdAt)}
                            </span>
                        </div>
                        {/* Title */}
                        <div className="article-card-title" style={{
                            fontSize: scroll ? 12 : 13,
                            fontWeight:700, lineHeight:1.5,
                            display:'-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient:'vertical',
                            overflow:'hidden', color:T1,
                        }}>
                            {a.title || 'タイトルなし'}
                        </div>
                    </div>
                </div>
            </Link>
        );
    };

    /* ── Render card based on tab ─────────────────────────────── */
    const renderCard = (item:any, scroll?:boolean) => {
        if(tab==='cast') return <PodcastCard key={item.id} p={item} scroll={scroll} />;
        if(tab==='theater') return <VideoCard key={item.id} v={item} scroll={scroll} />;
        return <ArticleCard key={item.id} a={item} scroll={scroll} />;
    };

    // レスポンシブグリッド: タブ種別ごとに最適なカラム幅
    const gridCols = tab==='cast'
        ? 'repeat(auto-fill,minmax(140px,1fr))'
        : tab==='theater'
            ? 'repeat(auto-fill,minmax(240px,1fr))'
            : 'repeat(auto-fill,minmax(200px,1fr))';
    // 記事タブはモーダル内でも4-5列に
    const modalGridCols = tab==='cast'
        ? 'repeat(auto-fill,minmax(140px,1fr))'
        : tab==='theater'
            ? 'repeat(auto-fill,minmax(260px,1fr))'
            : 'repeat(auto-fill,minmax(200px,1fr))';
    // スクロール横並び幅は個別カードコンポーネント内で管理

    /* ══════════════════════════════════════════════════════════════ *
     *  RENDER
     * ══════════════════════════════════════════════════════════════ */
    return (
        <AppShell
            activeHref="/media/podcasts"
            currentUid={user?.uid || ''}
            userName={user?.displayName || user?.email || undefined}
            userIdStr={user?.email || undefined}
            photoURL={user?.photoURL || undefined}
            hideTopbarOnMobile
            onLogout={async () => {
                const { auth: fireAuth } = await import('@/lib/firebase');
                const { signOut } = await import('firebase/auth');
                try { await signOut(fireAuth); router.push('/login'); } catch {}
            }}
        >
            <div style={{ minHeight:'100vh', background:BG, paddingBottom:100 }}>

                {/* ── Tab bar ─────────────────────────────────────── */}
                <div style={{
                    display:'flex', gap:4, padding:'12px 16px 0',
                    borderBottom:'1px solid rgba(0,0,0,.06)',
                    background:BG,
                }}>
                    {([
                        { key:'cast' as TabKey, label:'CAST', icon:<Mic size={13}/> },
                        { key:'theater' as TabKey, label:'THEATER', icon:<Film size={13}/> },
                        { key:'article' as TabKey, label:'記事', icon:<FileText size={13}/> },
                    ]).map(t => {
                        const active = tab===t.key;
                        return (
                            <button key={t.key} onClick={()=>switchTab(t.key)}
                                style={{
                                    flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                                    padding:'10px 0', border:'none', cursor:'pointer',
                                    fontSize:11, fontWeight:800, letterSpacing:'.08em',
                                    color: active?SAGE:TM,
                                    background:'transparent',
                                    borderBottom: active?`2px solid ${SAGE}`:'2px solid transparent',
                                    transition:'all .2s',
                                }}
                            >
                                {t.icon} {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Search + Tags + Post btn ────────────────────── */}
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                    {/* Row: search + post btn */}
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div style={{ flex:1, position:'relative' }}>
                            <Search size={13} color={TM} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }} />
                            <input
                                type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                                placeholder="タイトルや内容で検索..."
                                style={{
                                    width:'100%', padding:'9px 12px 9px 34px', border:'none',
                                    borderRadius:12, background:BG, boxShadow:NEU_IN,
                                    fontSize:12, color:T1, outline:'none', boxSizing:'border-box',
                                }}
                            />
                        </div>
                        {canOpenPost && (tab==='article' ? (
                            <Link href="/media/articles/edit" style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'8px 14px', borderRadius:12, border:'none',
                                background:SB, color:LIME, fontSize:10, fontWeight:700,
                                textDecoration:'none', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(0,0,0,.2)',
                            }}>
                                <Plus size={12} /> {postLabel}
                            </Link>
                        ) : (
                            <button onClick={()=>setPostModalOpen(true)} style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'8px 14px', borderRadius:12, border:'none',
                                background:SB, color:LIME, fontSize:10, fontWeight:700,
                                cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(0,0,0,.2)',
                            }}>
                                <Plus size={12} /> {postLabel}
                            </button>
                        ))}
                    </div>

                    {/* Tags */}
                    <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
                        {currentTags.map(t => (
                            <button key={t} onClick={()=>setTagQ(t)}
                                style={{
                                    flexShrink:0, padding:'5px 14px', borderRadius:100,
                                    border:'none', fontSize:10, fontWeight:700, cursor:'pointer',
                                    background: tagQ===t?SB:BG,
                                    color: tagQ===t?LIME:T2,
                                    boxShadow: tagQ===t?'none':NEU_SM,
                                    transition:'all .15s',
                                }}
                            >
                                {TAG_LABELS[t]||t||'すべて'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Live rooms (cast tab only) ──────────────────── */}
                {tab==='cast' && !isFiltering && liveRooms.length>0 && (
                    <div style={{ padding:'0 16px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                            <Radio size={14} color="#dc2626" style={{ animation:'pulse 1.5s infinite' }} />
                            <span style={{ fontSize:12, fontWeight:800, color:'#dc2626', letterSpacing:'.06em' }}>配信中の SIGNAL CAST</span>
                        </div>
                        <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
                            {liveRooms.map(r => (
                                <Link key={r.id} href={`/media/live_room?roomId=${r.id}`}
                                    style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:72, flexShrink:0, textDecoration:'none' }}>
                                    <div style={{
                                        width:60, height:60, borderRadius:'50%', padding:2,
                                        background:'linear-gradient(135deg,#dc2626,#f97316,#d4a24a)',
                                        boxShadow:'0 2px 12px rgba(220,38,38,.3)',
                                    }}>
                                        <div style={{ width:'100%',height:'100%',borderRadius:'50%',overflow:'hidden',border:`2px solid ${BG}` }}>
                                            <img src={r.hostIcon||FALLBACK_AVATAR} alt=""
                                                style={{ width:'100%',height:'100%',objectFit:'cover' }}
                                                onError={e=>{const i=e.target as HTMLImageElement;i.onerror=null;i.src=FALLBACK_AVATAR;}} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign:'center', width:'100%' }}>
                                        <div style={{ fontSize:10, fontWeight:700, color:T1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{r.hostName||'名無し'}</div>
                                        <div style={{ fontSize:8, color:'#dc2626', fontWeight:800, marginTop:1 }}>● LIVE</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Content area ────────────────────────────────── */}
                <div style={{ padding:'0 16px' }}>
                    {!dataLoaded ? (
                        <div style={{ textAlign:'center', padding:'60px 0' }}>
                            <Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite', margin:'0 auto' }} />
                            <div style={{ fontSize:12, color:TM, marginTop:10 }}>読み込み中...</div>
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
                        </div>
                    ) : isFiltering ? (() => {
                        /* ── Filtered: same layout as default ──────── */
                        const filteredFollowing = filtered.filter((i:any) => followingIds.includes(i.authorId));
                        const filteredOther = filtered.filter((i:any) => !followingIds.includes(i.authorId));
                        if (!filteredOther.length && filtered.length) filteredOther.push(...filtered);
                        const hasResults = filtered.length > 0;
                        return (
                        <div>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14, paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                <Search size={13} color={SAGE} />
                                <span style={{ fontSize:13, fontWeight:700, color:T1 }}>検索結果</span>
                                <span style={{ fontSize:10, color:TM }}>({filtered.length}件)</span>
                            </div>
                            {!hasResults ? (
                                <div style={{ textAlign:'center', padding:'50px 20px', background:BG, borderRadius:18, boxShadow:NEU_SM }}>
                                    <Anchor size={28} color={TM} style={{ margin:'0 auto 10px' }} />
                                    <div style={{ fontSize:13, fontWeight:700, color:T2 }}>該当するコンテンツがありません</div>
                                </div>
                            ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                                    {filteredFollowing.length > 0 && (
                                        <section>
                                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                    <Users size={13} color={SAGE} />
                                                    <span style={{ fontSize:13, fontWeight:700, color:T1 }}>フォロー中の新着</span>
                                                </div>
                                                {filteredFollowing.length > 20 && (
                                                    <button onClick={() => openModal('フォロー中の新着', filteredFollowing, tab)}
                                                        style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:600, color:T2, cursor:'pointer' }}>
                                                        すべて見る <ChevronRight size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={tab==='article' ? 'article-grid' : ''} style={{ display:'grid', gridTemplateColumns:gridCols, gap:12 }}>
                                                {filteredFollowing.slice(0,40).map((i:any) => renderCard(i))}
                                            </div>
                                        </section>
                                    )}
                                    <section>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                <Sparkles size={13} color={AMBER} />
                                                <span style={{ fontSize:13, fontWeight:700, color:T1 }}>{filteredFollowing.length > 0 ? 'おすすめ' : '結果'}</span>
                                            </div>
                                            {filteredOther.length > 20 && (
                                                <button onClick={() => openModal(filteredFollowing.length > 0 ? 'おすすめ' : '検索結果', filteredOther, tab)}
                                                    style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:600, color:T2, cursor:'pointer' }}>
                                                    すべて見る <ChevronRight size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <div className={tab==='article' ? 'article-grid' : ''} style={{ display:'grid', gridTemplateColumns:gridCols, gap:12 }}>
                                            {filteredOther.slice(0,40).map((i:any) => renderCard(i))}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                        );
                    })() : (
                        /* ── Default: Following + Recommended ──────── */
                        <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                            {/* Following */}
                            {following.length>0 && (
                                <section>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                            <Users size={13} color={SAGE} />
                                            <span style={{ fontSize:13, fontWeight:700, color:T1 }}>フォロー中の新着</span>
                                        </div>
                                        <button onClick={()=>openModal('フォロー中の新着',following,tab)}
                                            style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:600, color:T2, cursor:'pointer' }}>
                                            すべて見る <ChevronRight size={12} />
                                        </button>
                                    </div>
                                    <div className={tab==='article' ? 'article-grid' : ''} style={{ display:'grid', gridTemplateColumns:gridCols, gap:12 }}>
                                        {following.slice(0,40).map((i:any) => renderCard(i))}
                                    </div>
                                </section>
                            )}

                            {/* Recommended */}
                            <section>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, paddingBottom:8, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                        <Sparkles size={13} color={AMBER} />
                                        <span style={{ fontSize:13, fontWeight:700, color:T1 }}>おすすめ</span>
                                    </div>
                                    <button onClick={()=>openModal('おすすめ',recommended,tab)}
                                        style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:600, color:T2, cursor:'pointer' }}>
                                        すべて見る <ChevronRight size={12} />
                                    </button>
                                </div>
                                {recommended.length===0 ? (
                                    <div style={{ textAlign:'center', padding:'50px 20px', background:BG, borderRadius:18, boxShadow:NEU_SM }}>
                                        <Anchor size={28} color={TM} style={{ margin:'0 auto 10px' }} />
                                        <div style={{ fontSize:13, fontWeight:700, color:T2 }}>まだコンテンツがありません</div>
                                    </div>
                                ) : (
                                    <div className={tab==='article' ? 'article-grid' : ''} style={{ display:'grid', gridTemplateColumns:gridCols, gap:12 }}>
                                        {recommended.slice(0,40).map((i:any) => renderCard(i))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {/* ── "See All" Modal ─────────────────────────────────── */}
            {modalOpen && (
                <div style={{
                    position:'fixed', inset:0, zIndex:6000,
                    background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                    display:'flex', alignItems:'flex-end', justifyContent:'center',
                }}
                    onClick={e=>{ if(e.target===e.currentTarget) setModalOpen(false); }}
                >
                    <div style={{
                        width:'100%', maxWidth:900, maxHeight:'88vh',
                        background:BG, borderRadius:'20px 20px 0 0',
                        boxShadow:'0 -8px 40px rgba(0,0,0,.2)',
                        display:'flex', flexDirection:'column', overflow:'hidden',
                    }}>
                        {/* Modal header */}
                        <div style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'16px 20px', borderBottom:'1px solid rgba(0,0,0,.06)', flexShrink:0,
                        }}>
                            <span style={{ fontSize:14, fontWeight:800, color:T1 }}>{modalTitle}</span>
                            <button onClick={()=>setModalOpen(false)}
                                style={{ width:32,height:32,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T2 }}>
                                <X size={14} />
                            </button>
                        </div>
                        {/* Modal body */}
                        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 40px' }}>
                            <div style={{
                                display:'grid',
                                gridTemplateColumns: modalGridCols,
                                gap:14,
                            }}>
                                {modalItems.map((i:any) => {
                                    if(modalType==='cast') return <PodcastCard key={i.id} p={i} />;
                                    if(modalType==='theater') return <VideoCard key={i.id} v={i} />;
                                    return <ArticleCard key={i.id} a={i} />;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Post Modal ──────────────────────────────────── */}
            {tab!=='article' && (
                <MediaPostModal
                    type={tab as 'cast'|'theater'}
                    isOpen={postModalOpen}
                    onClose={()=>setPostModalOpen(false)}
                    userId={user?.uid||''}
                    userProfile={myProfile}
                />
            )}

            <style>{`
                /* PC: 記事カード情報エリアの高さを固定 */
                @media(min-width:768px){
                    .article-card-info {
                        height: 88px;
                        overflow: hidden;
                    }
                    /* タイトルは常に2行分の高さを確保 */
                    .article-card-title {
                        min-height: 40px; /* 13px × 1.5 line-height × 2行 = 39px */
                    }
                }
                @media(max-width:767px){
                    .mob-topbar { display:flex !important; }

                    /* 記事カード: モバイルはnote風 縦スタック全幅1カラム */
                    .article-grid {
                        grid-template-columns: 1fr !important;
                        gap: 14px !important;
                    }
                    .article-card-inner {
                        flex-direction: column !important;  /* 縦スタック */
                        border-radius: 12px !important;
                    }
                    /* サムネイル: 横幅いっぱい・16/9比率 */
                    .article-card-thumb {
                        width: 100% !important;
                        aspect-ratio: 16/9 !important;
                        height: auto !important;
                        border-radius: 0 !important;
                    }
                    .article-card-info {
                        padding: 10px 14px 14px !important;
                        height: auto !important;
                    }
                }

            `}</style>
        </AppShell>
    );
}
