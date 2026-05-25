'use client';
import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { Users, X, Anchor, ChevronRight, Search, UserRound } from 'lucide-react';
import Link from 'next/link';

// ── Design tokens (matches profile page v3) ──────────────────────────────────
const BG    = '#f8f6f3';
const SAGE  = '#4a7c59';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#ada49c';
const NEU_UP = '6px 6px 14px rgba(0,0,0,.09),-6px -6px 14px rgba(255,255,255,.85)';
const NEU_SM = '3px 3px 8px rgba(0,0,0,.08),-3px -3px 8px rgba(255,255,255,.8)';
const NEU_IN = 'inset 3px 3px 8px rgba(0,0,0,.08),inset -3px -3px 8px rgba(255,255,255,.8)';

interface FollowModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'following' | 'followers' | 'mutual' | null;
    targetUid: string;
    myUid?: string;
}

const TYPE_META = {
    following: { label: 'フォロー中', icon: '▶', color: '#2d5a3d', bg: '#edf3ef' },
    followers: { label: 'フォロワー', icon: '◀', color: '#5b21b6', bg: '#ede9fe' },
    mutual:    { label: '共通の航海士', icon: '⚓', color: '#8b5e3c', bg: '#fdf4e3' },
};

export default function FollowModal({ isOpen, onClose, type, targetUid, myUid }: FollowModalProps) {
    const [users, setUsers]     = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery]     = useState('');
    const [appear, setAppear]   = useState(false);
    const overlayRef            = useRef<HTMLDivElement>(null);

    // mount animation
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => setAppear(true), 10);
        } else {
            setAppear(false);
        }
    }, [isOpen]);

    // fetch
    useEffect(() => {
        if (!isOpen || !type || !targetUid) return;
        let isMounted = true;
        setLoading(true);
        setUsers([]);

        const fetchUsers = async () => {
            try {
                let targetIds: string[] = [];

                if (type === 'mutual') {
                    if (!myUid || myUid === targetUid) { setLoading(false); return; }
                    const myFowSnap    = await getDocs(collection(db, 'artifacts', APP_ID, 'users', myUid, 'following'));
                    const myFlerSnap   = await getDocs(collection(db, 'artifacts', APP_ID, 'users', myUid, 'followers'));
                    const myFowIds     = new Set(myFowSnap.docs.map(d => d.id));
                    const myMutualIds  = myFlerSnap.docs.map(d => d.id).filter(id => myFowIds.has(id));
                    const tgtFowSnap   = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'following'));
                    const tgtFlerSnap  = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'followers'));
                    const tgtFowIds    = new Set(tgtFowSnap.docs.map(d => d.id));
                    const tgtMutualIds = tgtFlerSnap.docs.map(d => d.id).filter(id => tgtFowIds.has(id));
                    const tgtMutualSet = new Set(tgtMutualIds);
                    targetIds = myMutualIds.filter(id => tgtMutualSet.has(id));
                } else {
                    const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, type));
                    targetIds = snap.docs.map(d => d.id);
                }

                if (targetIds.length === 0) { if (isMounted) setLoading(false); return; }

                const loaded = await Promise.all(
                    targetIds.map(async uid => {
                        const s = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid));
                        return s.exists() ? { uid, ...s.data() } : null;
                    })
                );
                if (isMounted) {
                    const filtered = loaded.filter(Boolean);
                    setUsers(filtered);
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                if (isMounted) setLoading(false);
            }
        };

        fetchUsers();
        return () => { isMounted = false; };
    }, [isOpen, type, targetUid, myUid]);

    // search filter
    useEffect(() => {
        const q = query.trim().toLowerCase();
        setFiltered(q ? users.filter(u => (u.name||'').toLowerCase().includes(q) || (u.userId||'').toLowerCase().includes(q) || (u.jobTitle||'').toLowerCase().includes(q)) : users);
    }, [query, users]);

    // click outside to close
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    if (!isOpen) return null;

    const meta = type ? TYPE_META[type] : TYPE_META.following;

    return (
        <>
            {/* Overlay */}
            <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                style={{
                    position:'fixed', inset:0, zIndex:4000,
                    background: appear ? 'rgba(26,48,36,.45)' : 'rgba(26,48,36,0)',
                    backdropFilter: appear ? 'blur(8px)' : 'none',
                    display:'flex', alignItems:'flex-end', justifyContent:'center',
                    transition:'background .3s, backdrop-filter .3s',
                    padding:'0',
                }}
            >
                {/* Sheet */}
                <div style={{
                    width:'100%', maxWidth:540,
                    maxHeight:'88vh',
                    background:BG,
                    borderRadius:'22px 22px 0 0',
                    boxShadow:'0 -8px 40px rgba(0,0,0,.18)',
                    display:'flex', flexDirection:'column',
                    transform: appear ? 'translateY(0)' : 'translateY(100%)',
                    transition:'transform .35s cubic-bezier(.32,0,.15,1)',
                    overflow:'hidden',
                }}>

                    {/* Drag handle */}
                    <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
                        <div style={{width:36,height:4,borderRadius:2,background:'rgba(0,0,0,.12)'}}/>
                    </div>

                    {/* Header */}
                    <div style={{padding:'14px 20px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid rgba(0,0,0,.06)`}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                            {/* Type badge */}
                            <div style={{
                                display:'inline-flex', alignItems:'center', gap:5,
                                padding:'5px 13px', borderRadius:100,
                                background:meta.bg, color:meta.color,
                                fontSize:10, fontWeight:700, letterSpacing:'.08em',
                                boxShadow:NEU_SM,
                            }}>
                                <Users size={11}/> {meta.label}
                            </div>
                            {users.length > 0 && !loading && (
                                <span style={{fontSize:11,color:TM,fontWeight:600}}>{filtered.length}人</span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width:32, height:32, borderRadius:'50%', border:'none',
                                background:BG, boxShadow:NEU_SM, color:T2,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                cursor:'pointer', transition:'box-shadow .15s',
                            }}
                            onMouseEnter={e=>(e.currentTarget.style.boxShadow=NEU_IN)}
                            onMouseLeave={e=>(e.currentTarget.style.boxShadow=NEU_SM)}
                        >
                            <X size={15}/>
                        </button>
                    </div>

                    {/* Search bar */}
                    {users.length > 4 && (
                        <div style={{padding:'10px 20px',borderBottom:'1px solid rgba(0,0,0,.05)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderRadius:100,boxShadow:NEU_IN,background:BG}}>
                                <Search size={13} style={{color:TM,flexShrink:0}}/>
                                <input
                                    value={query}
                                    onChange={e=>setQuery(e.target.value)}
                                    placeholder="名前・職業で検索..."
                                    style={{border:'none',outline:'none',background:'transparent',fontSize:12,color:T1,flex:1,fontFamily:'inherit'}}
                                />
                                {query && (
                                    <button onClick={()=>setQuery('')} style={{border:'none',background:'none',padding:0,cursor:'pointer',color:TM,display:'flex'}}>
                                        <X size={12}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* User list */}
                    <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
                        {loading ? (
                            <div style={{textAlign:'center',padding:'48px 0',color:TM}}>
                                <div style={{
                                    width:32,height:32,borderRadius:'50%',
                                    border:`3px solid ${meta.bg}`,borderTopColor:meta.color,
                                    margin:'0 auto 12px',animation:'spin .8s linear infinite',
                                }}/>
                                <div style={{fontSize:12,fontWeight:600}}>読み込み中...</div>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{textAlign:'center',padding:'48px 0',color:TM}}>
                                <UserRound size={32} style={{margin:'0 auto 12px',opacity:.3}}/>
                                <div style={{fontSize:12,fontWeight:600}}>
                                    {query ? '該当するユーザーが見つかりません' : 'まだ誰もいません'}
                                </div>
                            </div>
                        ) : (
                            filtered.map((u, i) => (
                                <Link
                                    key={i}
                                    href={`/user?uid=${u.uid}`}
                                    onClick={onClose}
                                    style={{
                                        display:'flex', alignItems:'center', gap:12,
                                        padding:'12px 20px',
                                        textDecoration:'none',
                                        borderBottom: i < filtered.length-1 ? '1px solid rgba(0,0,0,.04)' : 'none',
                                        transition:'background .15s',
                                    }}
                                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(74,124,89,.04)')}
                                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                                >
                                    {/* Avatar */}
                                    {u.photoURL ? (
                                        <img
                                            src={u.photoURL}
                                            alt={u.name}
                                            style={{
                                                width:46, height:46, borderRadius:'50%',
                                                objectFit:'cover', flexShrink:0,
                                                boxShadow:NEU_SM,
                                                border:'2px solid rgba(255,255,255,.8)',
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width:46, height:46, borderRadius:'50%',
                                            background:BG, boxShadow:NEU_SM, flexShrink:0,
                                            display:'flex', alignItems:'center', justifyContent:'center', color:TM,
                                        }}>
                                            <Anchor size={18}/>
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:13,fontWeight:700,color:T1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                            {u.name || u.userId || '名無し'}
                                        </div>
                                        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2,flexWrap:'wrap'}}>
                                            <span style={{fontSize:10,color:TM,fontFamily:"'DM Mono',monospace",letterSpacing:'.04em'}}>@{u.userId}</span>
                                            {u.jobTitle && (
                                                <span style={{
                                                    fontSize:9, fontWeight:600, padding:'2px 7px',
                                                    borderRadius:100, background:'rgba(74,124,89,.08)',
                                                    color:SAGE, whiteSpace:'nowrap',
                                                    maxWidth:130, overflow:'hidden', textOverflow:'ellipsis',
                                                }}>{u.jobTitle}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight size={14} style={{color:TM,flexShrink:0}}/>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Spin animation */}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
    );
}
