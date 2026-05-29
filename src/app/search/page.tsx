'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID as appId } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import {
    Compass, ShieldHalf, Search as SearchIcon, Dna, Users,
    EyeOff, Anchor, Lock, Loader2, X, SlidersHorizontal,
    House, Hammer, Gavel, Star, Home
} from 'lucide-react';
import AppShell from '@/components/AppShell';

// ── Design tokens (same as user/page.tsx) ──────────────────────────────────
const BG    = '#f8f6f3';
const SB    = '#1a3024';
const SAGE  = '#4a7c59';
const LIME  = '#8ecfb2';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#b0a89e';
const AMBER = '#c2840a';
const NEU_UP = '6px 6px 14px #dbd7d2,-6px -6px 14px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];

const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
function getRankLevel(rank: string) { return rankLevels[rank] || 0; }

type UserData = {
    id: string;
    userId: string;
    name?: string;
    jobTitle?: string;
    prefecture?: string;
    birthplace?: string;
    profileScore?: number;
    isHidden?: boolean;
    osNumber?: string | number;
    skills?: string[];
    hobbies?: string[];
    canOffer?: string[];
    lookingFor?: string[];
    photoURL?: string;
    membershipRank?: string;
    mbti?: string;
};


// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank?: string }) {
    if (!rank || rank === 'arrival') return null;
    const cfgs: Record<string, { bg: string; color: string; border: string; label: string }> = {
        settler:  { bg: 'rgba(74,124,89,.1)',  color: SAGE,    border: 'rgba(74,124,89,.25)',  label: 'SETTLER'  },
        builder:  { bg: 'rgba(194,132,10,.1)', color: AMBER,   border: 'rgba(194,132,10,.25)', label: 'BUILDER'  },
        guardian: { bg: 'rgba(62,39,35,.1)',   color: '#6b3a2e',border:'rgba(62,39,35,.25)',   label: 'GUARDIAN' },
        covenant: { bg: 'rgba(26,48,36,.85)',  color: LIME,    border: 'rgba(163,230,53,.3)',  label: 'COVENANT' },
        admin:    { bg: 'rgba(26,48,36,.85)',  color: LIME,    border: 'rgba(163,230,53,.3)',  label: 'COVENANT' },
    };
    const c = cfgs[rank];
    if (!c) return null;
    return (
        <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:100, background:c.bg, color:c.color, border:`1px solid ${c.border}`, fontSize:9, fontWeight:700, letterSpacing:'.06em', whiteSpace:'nowrap' }}>
            {c.label}
        </span>
    );
}

// ── MBTI badge ────────────────────────────────────────────────────────────────
function MbtiBadge({ mbti }: { mbti?: string | null }) {
    if (!mbti || mbti === '未設定') return null;
    const analysts  = ['INTJ','INTP','ENTJ','ENTP'];
    const diplomats = ['INFJ','INFP','ENFJ','ENFP'];
    const sentinels = ['ISTJ','ISFJ','ESTJ','ESFJ'];
    let bg = '#fafaf0', color = '#6b7a00', border = 'rgba(163,230,53,.2)';
    if (analysts.includes(mbti))  { bg = '#f5f3ff'; color = '#6d28d9'; border = '#ede9fe'; }
    if (diplomats.includes(mbti)) { bg = '#f0fdf4'; color = '#166534'; border = '#bbf7d0'; }
    if (sentinels.includes(mbti)) { bg = '#eff6ff'; color = '#1e40af'; border = '#bfdbfe'; }
    return (
        <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:100, background:bg, color, border:`1px solid ${border}`, fontSize:9, fontWeight:700, fontFamily:'monospace', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{mbti}</span>
    );
}

// ── Input/select base style ───────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
    padding: '9px 12px', border: 'none', borderRadius: 10,
    background: BG, boxShadow: NEU_IN,
    fontSize: 12, color: T1, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

// ── User card ─────────────────────────────────────────────────────────────────
function UserCard({ u, showRank }: { u: UserData; showRank?: boolean }) {
    const name  = u.name || u.userId || '名無し';
    const job   = u.jobTitle || '';
    const score = Number(u.profileScore) || 0;
    const [hovered, setHovered] = useState(false);

    return (
        <Link
            href={`/user?uid=${u.id || u.userId}`}
            style={{
                display: 'block', textDecoration: 'none',
                background: BG, borderRadius: 16,
                boxShadow: hovered ? '8px 8px 20px #d4d0cb,-8px -8px 20px #ffffff, 0 6px 18px rgba(74,124,89,.08)' : NEU_UP,
                transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'transform .18s, box-shadow .18s',
                position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Score bar at top */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${SAGE} ${score}%, rgba(0,0,0,.05) ${score}%)`, borderRadius: '16px 16px 0 0' }} />

            {/* Hidden badge */}
            {u.isHidden && (
                <div style={{ position:'absolute', top:8, right:8, display:'flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:100, background:'rgba(239,68,68,.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,.2)', fontSize:8, fontWeight:700 }}>
                    <EyeOff size={8}/> 非公開
                </div>
            )}

            <div style={{ padding: '14px 12px 12px' }}>
                {/* Avatar */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                    {u.photoURL ? (
                        <img src={u.photoURL} alt={name} style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover', boxShadow:NEU_SM, border:`2px solid ${BG}` }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                    ) : (
                        <div style={{ width:56, height:56, borderRadius:'50%', background:`linear-gradient(135deg, ${SB} 0%, ${SAGE} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:NEU_SM }}>
                            <span style={{ fontSize:20, fontWeight:800, color:LIME }}>{name.charAt(0).toUpperCase()}</span>
                        </div>
                    )}
                </div>

                {/* Name + handle */}
                <div style={{ textAlign:'center', marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{name}</div>
                    <div style={{ fontSize:9, color:TM, marginTop:1, letterSpacing:'.04em' }}>@{u.userId}</div>
                </div>

                {/* Badges */}
                <div style={{ display:'flex', justifyContent:'center', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                    {showRank && <RankBadge rank={u.membershipRank} />}
                    <MbtiBadge mbti={u.mbti} />
                </div>

                {/* Job */}
                {job && <div style={{ fontSize:10, color:T2, textAlign:'center', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{job}</div>}
            </div>
        </Link>
    );
}

// ── Circular progress avatar (for mobile list) ────────────────────────────────
function AvatarWithRing({ photoURL, name, score }: { photoURL?: string; name: string; score: number }) {
    const SIZE   = 52;   // SVG viewBox size
    const R      = 23;   // ring radius
    const STROKE = 2.8;  // ring strokeWidth
    const circ   = 2 * Math.PI * R;          // ~144.5
    const dash   = (score / 100) * circ;      // filled arc length
    const gap    = circ - dash;               // unfilled arc length
    // Start from top (rotate -90deg via transform)
    const ringColor = score >= 100 ? LIME : score >= 60 ? SAGE : score >= 30 ? AMBER : '#e0dbd5';

    return (
        <div style={{ position:'relative', width:SIZE, height:SIZE, flexShrink:0 }}>
            {/* SVG ring */}
            <svg width={SIZE} height={SIZE} style={{ position:'absolute', top:0, left:0, transform:'rotate(-90deg)' }} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                {/* Track */}
                <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth={STROKE} />
                {/* Progress arc */}
                {score > 0 && (
                    <circle
                        cx={SIZE/2} cy={SIZE/2} r={R}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${gap}`}
                        style={{ transition:'stroke-dasharray .6s ease' }}
                    />
                )}
            </svg>
            {/* Avatar */}
            <div style={{ position:'absolute', top:STROKE+1, left:STROKE+1, width:SIZE-2*(STROKE+1), height:SIZE-2*(STROKE+1), borderRadius:'50%', overflow:'hidden', background:`linear-gradient(135deg, ${SB} 0%, ${SAGE} 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {photoURL ? (
                    <img src={photoURL} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                ) : (
                    <span style={{ fontSize:15, fontWeight:800, color:LIME }}>{name.charAt(0).toUpperCase()}</span>
                )}
            </div>
        </div>
    );
}

// ── User row (mobile list view, flat / no-box style) ────────────────────────
function UserRowItem({ u, showRank }: { u: UserData; showRank?: boolean }) {
    const name  = u.name || u.userId || '名無し';
    const job   = u.jobTitle || '';
    const score = Number(u.profileScore) || 0;
    const [hovered, setHovered] = useState(false);

    return (
        <Link
            href={`/user?uid=${u.id || u.userId}`}
            className="crew-row-item"
            style={{
                display:'flex', alignItems:'center', gap:13,
                padding:'13px 16px',
                textDecoration:'none',
                background: hovered ? 'rgba(74,124,89,.04)' : 'transparent',
                transition: 'background .14s',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Avatar with score ring */}
            <AvatarWithRing photoURL={u.photoURL} name={name} score={score} />

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:'calc(100% - 70px)' }}>{name}</span>
                    {showRank && <RankBadge rank={u.membershipRank} />}
                    <MbtiBadge mbti={u.mbti} />
                    {u.isHidden && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:2, padding:'2px 5px', borderRadius:100, background:'rgba(239,68,68,.1)', color:'#ef4444', fontSize:8, fontWeight:700 }}>
                            <EyeOff size={8}/> 非公開
                        </span>
                    )}
                </div>
                <div style={{ fontSize:9, color:TM, letterSpacing:'.04em', marginBottom:2 }}>@{u.userId}</div>
                {job && <div style={{ fontSize:11, color:T2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{job}</div>}
            </div>
        </Link>
    );
}

// ── Main content ──────────────────────────────────────────────────────────────
function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();

    const [loading,   setLoading]   = useState(true);
    const [isAdmin,   setIsAdmin]   = useState(false);
    const [myRank,    setMyRank]    = useState('arrival');
    const [fetchError,setFetchError]= useState<string | null>(null);
    const [allUsers,  setAllUsers]  = useState<UserData[]>([]);

    const [searchQ,      setSearchQ]      = useState('');
    const [osQ,          setOsQ]          = useState(searchParams.get('osNumber') || '');
    const [areaQ,        setAreaQ]        = useState('');
    const [mbtiQ,        setMbtiQ]        = useState(searchParams.get('mbti') || '');
    const [isFilterOpen, setIsFilterOpen] = useState(!!(searchParams.get('osNumber') || searchParams.get('mbti')));

    useEffect(() => {
        if (searchParams.toString() && typeof window !== 'undefined')
            window.history.replaceState(null, '', window.location.pathname);
    }, [searchParams]);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            try {
                let currentRank = 'arrival', adminFlag = false;
                if (user.uid === 'Zm7FWRopJKVfyzbp8KXXokMFjNC3') {
                    adminFlag = true; currentRank = 'covenant';
                } else {
                    try {
                        const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                        if (snap.exists()) { const d = snap.data(); currentRank = d.membershipRank || 'arrival'; if (d.userId==='admin') adminFlag=true; }
                    } catch { /* ignore */ }
                }
                setIsAdmin(adminFlag); setMyRank(currentRank);

                const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
                const list: UserData[] = [];
                snap.forEach(d => list.push({ ...d.data() as UserData, id: d.id }));
                list.sort((a,b) => {
                    const sA = Number(a.profileScore)||0, sB = Number(b.profileScore)||0;
                    return sA !== sB ? sB - sA : String(a.name||a.userId||'').localeCompare(String(b.name||b.userId||''));
                });
                setAllUsers(list);
            } catch (err: any) {
                setFetchError(err.message || String(err));
            } finally { setLoading(false); }
        }
        if (!authLoading) fetchData();
    }, [user, authLoading]);

    const filteredUsers = useMemo(() => {
        const query = searchQ.toLowerCase();
        return allUsers.filter(u => {
            if (u.isHidden && !isAdmin) {
                if (!query || query !== String(u.userId).toLowerCase()) return false;
            }
            let ok = true;
            if (query) {
                const sa = (v: any) => Array.isArray(v) ? v : (typeof v==='string'?[v]:[]);
                ok = [u.name, u.userId, u.jobTitle, ...sa(u.skills), ...sa(u.hobbies), ...sa(u.canOffer), ...sa(u.lookingFor)].join(' ').toLowerCase().includes(query);
            }
            if (ok && areaQ) ok = u.prefecture === areaQ || u.birthplace === areaQ;
            if (ok && osQ.trim()) ok = String(u.osNumber) === osQ.trim();
            if (ok && mbtiQ) ok = u.mbti === mbtiQ;
            return ok;
        });
    }, [allUsers, searchQ, osQ, areaQ, mbtiQ, isAdmin]);

    const hasFilter  = !!(searchQ || osQ || areaQ || mbtiQ);
    const rLevel     = getRankLevel(myRank.toLowerCase());
    const hasAccess  = rLevel >= 1 || isAdmin;

    if (authLoading || loading) {
        return (
            <div style={{ display:'flex', minHeight:'100dvh', background:BG, alignItems:'center', justifyContent:'center' }}>
                <div style={{ textAlign:'center' }}>
                    <Loader2 size={30} color={SAGE} style={{ animation:'spin .8s linear infinite', margin:'0 auto 10px' }} />
                    <div style={{ fontSize:11, color:TM, letterSpacing:'.1em' }}>乗組員を探しています...</div>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    return (
        <AppShell
            activeHref="/search"
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
            {/* ── Fixed header + filter (stays on screen always) ── */}
            <div className="crew-sticky-header" style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, backdropFilter:'blur(24px)', background:'rgba(248,246,243,.92)' }}>
                {/* Title bar */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 20px', height:50, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                    <Compass size={15} color={SAGE} style={{ flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:700, color:T1, flex:1, letterSpacing:'.02em' }}>乗組員</span>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ background:BG, boxShadow:NEU_SM, borderRadius:20, padding:'4px 12px', fontSize:11, color:T2, display:'flex', alignItems:'center', gap:4 }}>
                            <Users size={11} color={SAGE}/> <strong style={{ color:T1 }}>{filteredUsers.length}</strong>{hasFilter ? '件' : '名'}
                        </span>
                        <button
                            onClick={() => setIsFilterOpen(o => !o)}
                            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:100, border:'none', background:isFilterOpen ? SB : BG, boxShadow:isFilterOpen ? 'none' : NEU_SM, color:isFilterOpen ? LIME : T2, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .18s' }}
                        >
                            <SlidersHorizontal size={12}/> {isFilterOpen ? '▲ 閉じる' : '▼ 絞り込み'}
                            {hasFilter && !isFilterOpen && <span style={{ background:SAGE, color:'#fff', borderRadius:100, padding:'0 5px', fontSize:9 }}>ON</span>}
                        </button>
                    </div>
                </div>

                {/* Filter panel (expands inside fixed header) */}
                <div style={{ overflow:'hidden', maxHeight:isFilterOpen ? 500 : 0, opacity:isFilterOpen ? 1 : 0, transition:'max-height .3s ease, opacity .25s ease', background:'rgba(248,246,243,.97)', borderBottom: isFilterOpen ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
                    <div style={{ padding:'16px 20px 12px' }}>

                        {/* Access restriction */}
                        {!hasAccess && (
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:BG, boxShadow:NEU_SM, marginBottom:12, borderLeft:`3px solid ${AMBER}` }}>
                                <Lock size={14} color={AMBER} />
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:T1 }}>SETTLER以上の会員限定</div>
                                    <div style={{ fontSize:10, color:T2 }}>絞り込み・フリー検索はアップグレードで利用可能</div>
                                </div>
                                <Link href="/upgrade" style={{ padding:'6px 12px', borderRadius:8, background:AMBER, color:'#fff', fontSize:10, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                                    <ShieldHalf size={10} style={{ display:'inline', marginRight:3 }}/>アップグレード
                                </Link>
                            </div>
                        )}

                        {/* Free word */}
                        <div style={{ marginBottom:10 }}>
                            <div style={{ fontSize:9, fontWeight:700, color:TM, letterSpacing:'.1em', marginBottom:4 }}>フリーワード</div>
                            <div style={{ position:'relative' }}>
                                <SearchIcon size={12} color={TM} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                                <input type="text" placeholder="名前、職業、スキルで検索..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                                    disabled={!hasAccess} style={{ ...inputBase, paddingLeft:30, opacity:hasAccess ? 1 : .5 }} />
                            </div>
                        </div>

                        {/* Filter selects */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:8, marginBottom:10 }}>
                            <div>
                                <div style={{ fontSize:9, fontWeight:700, color:TM, letterSpacing:'.1em', marginBottom:4 }}>OS No. (1〜60)</div>
                                <div style={{ position:'relative' }}>
                                    <Dna size={10} color={TM} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                                    <input type="number" placeholder="例: 42" min="1" max="60" value={osQ} onChange={e => setOsQ(e.target.value)}
                                        disabled={!hasAccess} style={{ ...inputBase, paddingLeft:26, opacity:hasAccess ? 1 : .5 }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize:9, fontWeight:700, color:TM, letterSpacing:'.1em', marginBottom:4 }}>エリア</div>
                                <select value={areaQ} onChange={e => setAreaQ(e.target.value)} disabled={!hasAccess}
                                    style={{ ...inputBase, cursor:'pointer', opacity:hasAccess ? 1 : .5 }}>
                                    <option value="">全てのエリア</option>
                                    {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <div style={{ fontSize:9, fontWeight:700, color:TM, letterSpacing:'.1em', marginBottom:4 }}>MBTI</div>
                                <select value={mbtiQ} onChange={e => setMbtiQ(e.target.value)} disabled={!hasAccess}
                                    style={{ ...inputBase, cursor:'pointer', opacity:hasAccess ? 1 : .5, fontFamily:'monospace' }}>
                                    <option value="">すべて</option>
                                    <optgroup label="分析家"><option value="INTJ">INTJ</option><option value="INTP">INTP</option><option value="ENTJ">ENTJ</option><option value="ENTP">ENTP</option></optgroup>
                                    <optgroup label="外交官"><option value="INFJ">INFJ</option><option value="INFP">INFP</option><option value="ENFJ">ENFJ</option><option value="ENFP">ENFP</option></optgroup>
                                    <optgroup label="番人"><option value="ISTJ">ISTJ</option><option value="ISFJ">ISFJ</option><option value="ESTJ">ESTJ</option><option value="ESFJ">ESFJ</option></optgroup>
                                    <optgroup label="探検家"><option value="ISTP">ISTP</option><option value="ISFP">ISFP</option><option value="ESTP">ESTP</option><option value="ESFP">ESFP</option></optgroup>
                                </select>
                            </div>
                        </div>

                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid rgba(0,0,0,.05)' }}>
                            <span style={{ fontSize:10, color:TM }}>※非公開ユーザーは表示されません</span>
                            <button onClick={() => { setSearchQ(''); setOsQ(''); setAreaQ(''); setMbtiQ(''); router.replace('/search'); }}
                                disabled={!hasAccess || !hasFilter}
                                style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:8, border:'none', background:BG, boxShadow:(!hasAccess||!hasFilter)?'none':NEU_SM, color:(!hasAccess||!hasFilter)?TM:T2, fontSize:11, fontWeight:600, cursor:(!hasAccess||!hasFilter)?'not-allowed':'pointer', opacity:(!hasAccess||!hasFilter)?.5:1 }}>
                                <X size={10}/> 条件クリア
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer to push content below fixed header */}
            <div style={{ height: 50 }} />

            {/* ── Error ── */}
            {fetchError && (
                <div style={{ margin:'12px 20px', padding:'10px 14px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:11 }}>{fetchError}</div>
            )}

            {/* ── Users grid / list ── */}
            <div style={{ flex:1, padding:'20px 20px 100px' }}>
                {filteredUsers.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px', background:BG, borderRadius:18, boxShadow:NEU_SM }}>
                        <Anchor size={28} color={TM} style={{ margin:'0 auto 10px' }} />
                        <div style={{ fontSize:13, fontWeight:700, color:T2 }}>該当する乗組員が見つかりません</div>
                        <div style={{ fontSize:11, color:TM, marginTop:4 }}>条件を変えて再検索してください</div>
                    </div>
                ) : (
                    <>
                        {/* PC: multi-column card grid */}
                        <div className="crew-grid-pc">
                            {filteredUsers.map(u => <UserCard key={u.id || u.userId} u={u} showRank={isAdmin} />)}
                        </div>
                        {/* Mobile: single-column row list */}
                        <div className="crew-list-sp">
                            {filteredUsers.map(u => <UserRowItem key={u.id || u.userId} u={u} showRank={isAdmin} />)}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }

                /* PC: show card grid, hide list */
                .crew-grid-pc {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
                    gap: 14px;
                }
                .crew-list-sp { display: none; }

                /* Mobile: hide card grid, show list */
                @media(max-width:1023px) {
                    .crew-grid-pc { display: none !important; }
                    .crew-list-sp {
                        display: flex;
                        flex-direction: column;
                        gap: 0;
                        background: #f8f6f3;
                        border-radius: 14px;
                        overflow: hidden;
                    }
                    .crew-row-item:not(:last-child) {
                        border-bottom: 1px solid rgba(0,0,0,.06);
                    }
                    /* モバイル: ヘッダー上部に安全マージン */
                    .crew-sticky-header {
                        padding-top: calc(env(safe-area-inset-top, 8px) + 12px) !important;
                    }
                }
                /* PC: fixed header はサイドバー分オフセット */
                @media(min-width:1024px) {
                    .crew-sticky-header {
                        left: 220px !important;
                    }
                }
            `}</style>
        </AppShell>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Loader2 size={30} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
