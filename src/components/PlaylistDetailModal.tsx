import React from 'react';
import { X, Play, Edit3, Film, Headphones, List } from 'lucide-react';
import Link from 'next/link';

/* ── Design tokens ─────────────────────────────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU  = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';

interface MediaItem {
    id: string;
    type: 'video' | 'podcast';
    title: string;
    thumbnailUrl?: string;
    createdAt: number;
}

interface Playlist {
    id: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    items?: MediaItem[];
    access?: 'free' | 'paid';
    price?: number;
    updatedAt?: any;
    createdAt?: any;
    authorId: string;
}

interface PlaylistDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    playlist: Playlist | null;
    canEdit: boolean;
    onEdit: () => void;
}

export default function PlaylistDetailModal({ isOpen, onClose, playlist, canEdit, onEdit }: PlaylistDetailModalProps) {
    if (!isOpen || !playlist) return null;

    const firstThumb = playlist.items?.[0]?.thumbnailUrl;
    const coverUrl = playlist.coverImageUrl || firstThumb || '';
    const itemCount = playlist.items?.length || 0;
    const isPaid = playlist.access === 'paid';

    return (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            {/* Backdrop */}
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(6px)' }} onClick={onClose}/>

            {/* Sheet */}
            <div style={{
                position:'relative', width:'100%', maxWidth:480,
                maxHeight:'92vh', background:BG, borderRadius:'20px 20px 0 0',
                boxShadow:'0 -4px 30px rgba(0,0,0,.15)',
                display:'flex', flexDirection:'column', overflow:'hidden',
                animation:'slideUp .25s ease-out',
            }}>
                {/* Drag handle */}
                <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0' }}>
                    <div style={{ width:36, height:4, borderRadius:2, background:'rgba(0,0,0,.12)' }}/>
                </div>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 20px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:8, background:SB, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <List size={14} color={LIME}/>
                        </div>
                        <span style={{ fontSize:14, fontWeight:800, color:T1 }}>プレイリスト</span>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                        {canEdit && (
                            <button onClick={()=>{onClose();onEdit();}} style={{
                                width:30, height:30, borderRadius:'50%', border:'none',
                                background:BG, boxShadow:NEU_SM, cursor:'pointer',
                                display:'flex', alignItems:'center', justifyContent:'center', color:SAGE,
                            }} title="編集">
                                <Edit3 size={13}/>
                            </button>
                        )}
                        <button onClick={onClose} style={{
                            width:30, height:30, borderRadius:'50%', border:'none',
                            background:BG, boxShadow:NEU_SM, cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center', color:TM,
                        }}>
                            <X size={15}/>
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div style={{ flex:1, overflowY:'auto', padding:'0 20px 20px' }}>
                    {/* Cover + info */}
                    <div style={{ marginBottom:18 }}>
                        <div style={{
                            aspectRatio:'16/9', borderRadius:14, overflow:'hidden',
                            background:`linear-gradient(135deg,${SB},#2d5a3e)`,
                            position:'relative', boxShadow:NEU,
                        }}>
                            {coverUrl ? (
                                <img src={coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                    onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                            ) : (
                                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <List size={36} color="rgba(255,255,255,.2)"/>
                                </div>
                            )}
                            {/* Price badge */}
                            <span style={{
                                position:'absolute', top:10, right:10,
                                padding:'4px 12px', borderRadius:100,
                                fontSize:10, fontWeight:800,
                                background: isPaid ? 'rgba(212,162,74,.9)' : 'rgba(0,0,0,.5)',
                                color: isPaid ? SB : '#fff',
                                backdropFilter:'blur(4px)',
                            }}>
                                {isPaid ? `¥${(playlist.price||0).toLocaleString()}` : '無料'}
                            </span>
                            {/* Play overlay */}
                            {itemCount > 0 && (
                                <Link href={`/media/${playlist.items![0].type}s/detail?id=${playlist.items![0].id}`}
                                    onClick={onClose}
                                    style={{
                                        position:'absolute', bottom:10, left:10,
                                        display:'flex', alignItems:'center', gap:6,
                                        padding:'8px 16px', borderRadius:100,
                                        background:'rgba(0,0,0,.5)', backdropFilter:'blur(6px)',
                                        color:'#fff', fontSize:11, fontWeight:700,
                                        textDecoration:'none', transition:'background .15s',
                                    }}
                                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,.7)';}}
                                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,.5)';}}
                                >
                                    <Play size={13} fill="#fff"/> すべて再生
                                </Link>
                            )}
                        </div>

                        {/* Title & meta */}
                        <div style={{ marginTop:14 }}>
                            <h2 style={{ fontSize:18, fontWeight:800, color:T1, lineHeight:1.3, margin:0 }}>{playlist.name}</h2>
                            {playlist.description && (
                                <p style={{ fontSize:12, color:T2, lineHeight:1.6, margin:'6px 0 0' }}>{playlist.description}</p>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                                <span style={{ fontSize:11, color:TM, fontWeight:600 }}>{itemCount}件のコンテンツ</span>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height:1, background:'rgba(0,0,0,.06)', margin:'0 -20px 16px' }}/>

                    {/* Track list */}
                    {itemCount === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px 0' }}>
                            <List size={28} color={TM} style={{ margin:'0 auto 8px', opacity:.4 }}/>
                            <div style={{ fontSize:12, fontWeight:600, color:TM }}>コンテンツがありません</div>
                        </div>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {playlist.items!.map((item, index) => {
                                const typeIcon = item.type==='video'
                                    ? <Film size={11} color={SAGE}/>
                                    : <Headphones size={11} color={SAGE}/>;
                                return (
                                    <Link
                                        href={`/media/${item.type}s/detail?id=${item.id}`}
                                        key={`${item.id}-${index}`}
                                        onClick={onClose}
                                        style={{ textDecoration:'none', color:'inherit', display:'block' }}
                                    >
                                        <div style={{
                                            display:'flex', alignItems:'center', gap:10,
                                            padding:10, borderRadius:12,
                                            background:BG, boxShadow:NEU_SM,
                                            transition:'transform .1s',
                                        }}
                                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
                                        onMouseLeave={e=>{e.currentTarget.style.transform='';}}
                                        >
                                            {/* Track number */}
                                            <span style={{ width:20, textAlign:'center', fontSize:11, fontWeight:700, color:TM, fontFamily:'monospace', flexShrink:0 }}>
                                                {index + 1}
                                            </span>
                                            {/* Thumbnail */}
                                            <div style={{
                                                width:52, height:40, borderRadius:8, overflow:'hidden', flexShrink:0,
                                                background:SB, display:'flex', alignItems:'center', justifyContent:'center',
                                                position:'relative',
                                            }}>
                                                {item.thumbnailUrl ? (
                                                    <img src={item.thumbnailUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                                        onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                                                ) : typeIcon}
                                                {/* Play hover */}
                                                <div style={{
                                                    position:'absolute', inset:0,
                                                    background:'rgba(0,0,0,.2)',
                                                    display:'flex', alignItems:'center', justifyContent:'center',
                                                    opacity:0, transition:'opacity .15s',
                                                }}
                                                onMouseEnter={e=>{e.currentTarget.style.opacity='1';}}
                                                onMouseLeave={e=>{e.currentTarget.style.opacity='0';}}
                                                >
                                                    <Play size={12} color="#fff" fill="#fff"/>
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{
                                                    fontSize:12, fontWeight:700, color:T1, lineHeight:1.3,
                                                    display:'-webkit-box', WebkitLineClamp:2,
                                                    WebkitBoxOrient:'vertical' as any, overflow:'hidden',
                                                }}>{item.title}</div>
                                                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                                                    {typeIcon}
                                                    <span style={{ fontSize:9, fontWeight:600, color:TM, letterSpacing:'.06em' }}>
                                                        {item.type==='video' ? 'THEATER' : 'CAST'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0.8; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    );
}
