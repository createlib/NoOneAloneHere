import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '@/lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, serverTimestamp, where, getDoc } from 'firebase/firestore';
import { X, Plus, Save, Trash2, Film, Headphones, Check, FolderOpen, List } from 'lucide-react';

/* ── Design tokens (matching profile page) ──────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU  = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

interface MediaItem {
    id: string;
    type: 'video' | 'podcast';
    title: string;
    thumbnailUrl?: string;
    createdAt: number;
}

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    playlistId?: string | null;
    onSaved?: () => void;
}

export default function PlaylistModal({ isOpen, onClose, userId, playlistId, onSaved }: PlaylistModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [access, setAccess] = useState<'free'|'paid'>('free');
    const [price, setPrice] = useState<number>(0);
    const [filterType, setFilterType] = useState<'video'|'podcast'>('video');
    const [availableMedia, setAvailableMedia] = useState<MediaItem[]>([]);
    const [playlistItems, setPlaylistItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setDescription('');
        setCoverUrl('');
        setAccess('free');
        setPrice(0);
        setFilterType('video');
        setPlaylistItems([]);

        const fetchAvailableMedia = async () => {
            setLoading(true);
            try {
                const vQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'), where('authorId', '==', userId));
                const vSnap = await getDocs(vQ);
                const videos = vSnap.docs.map(d => ({
                    id: d.id, type: 'video' as const,
                    title: d.data().title || '', thumbnailUrl: d.data().thumbnailUrl || '',
                    createdAt: new Date(d.data().createdAt || 0).getTime()
                }));
                const pQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'), where('authorId', '==', userId));
                const pSnap = await getDocs(pQ);
                const podcasts = pSnap.docs.map(d => ({
                    id: d.id, type: 'podcast' as const,
                    title: d.data().title || '', thumbnailUrl: d.data().thumbnailUrl || '',
                    createdAt: new Date(d.data().createdAt || 0).getTime()
                }));
                setAvailableMedia([...videos, ...podcasts].sort((a,b) => b.createdAt - a.createdAt));

                if (playlistId) {
                    const plSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'playlists', playlistId));
                    if (plSnap.exists()) {
                        const data = plSnap.data();
                        setName(data.name || '');
                        setDescription(data.description || '');
                        setCoverUrl(data.coverImageUrl || '');
                        setAccess(data.access || 'free');
                        setPrice(data.price || 0);
                        setPlaylistItems(data.items || []);
                    }
                }
            } catch (error) {
                console.error("Error fetching media for playlist:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAvailableMedia();
    }, [isOpen, userId, playlistId]);

    if (!isOpen) return null;

    const toggleItem = (item: MediaItem) => {
        const idx = playlistItems.findIndex(p => p.id === item.id);
        if (idx !== -1) {
            setPlaylistItems(playlistItems.filter(p => p.id !== item.id));
        } else {
            setPlaylistItems([...playlistItems, item]);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return alert("プレイリスト名を入力してください。");
        setSaving(true);
        try {
            const pid = playlistId || crypto.randomUUID();
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'playlists', pid), {
                name: name.trim(), description: description.trim(),
                coverImageUrl: coverUrl.trim(), access,
                price: access === 'paid' ? price : 0,
                items: playlistItems, authorId: userId,
                updatedAt: serverTimestamp(),
                ...(playlistId ? {} : { createdAt: serverTimestamp() }),
            }, { merge: true });
            if (onSaved) onSaved();
            onClose();
        } catch (e) { console.error(e); alert("保存に失敗しました"); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!playlistId) return;
        if (!window.confirm("このプレイリストを削除します。よろしいですか？")) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'playlists', playlistId));
            if (onSaved) onSaved();
            onClose();
        } catch (e) { console.error(e); alert("削除に失敗しました"); }
        finally { setSaving(false); }
    };

    const inputStyle: React.CSSProperties = {
        width:'100%', padding:'10px 14px', borderRadius:10,
        border:'none', background:BG, boxShadow:NEU_IN,
        fontSize:13, color:T1, outline:'none',
    };
    const labelStyle: React.CSSProperties = {
        display:'block', fontSize:10, fontWeight:700, letterSpacing:'.08em', color:T2, marginBottom:6,
    };

    const filtered = availableMedia.filter(m => m.type === filterType);

    return (
        <div style={{ position:'fixed', inset:0, zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            {/* Backdrop */}
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)' }} onClick={onClose}/>

            {/* Modal */}
            <div style={{
                position:'relative', width:'100%', maxWidth:720, maxHeight:'88vh',
                background:BG, borderRadius:20, boxShadow:NEU,
                display:'flex', flexDirection:'column', overflow:'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'16px 22px', borderBottom:'1px solid rgba(0,0,0,.06)',
                }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:10, background:SB, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {playlistId ? <FolderOpen size={15} color={LIME}/> : <Plus size={15} color={LIME}/>}
                        </div>
                        <span style={{ fontSize:15, fontWeight:800, color:T1, letterSpacing:'.04em' }}>
                            {playlistId ? 'プレイリスト編集' : '新規プレイリスト'}
                        </span>
                    </div>
                    <button onClick={onClose} style={{
                        width:32, height:32, borderRadius:'50%', border:'none', background:BG, boxShadow:NEU_SM,
                        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TM,
                    }}><X size={16}/></button>
                </div>

                {/* Body — scrollable */}
                <div style={{ flex:1, overflowY:'auto', padding:'20px 22px 10px' }}>
                    {/* Info section */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14, marginBottom:20 }}>
                        <div>
                            <label style={labelStyle}>プレイリスト名 <span style={{color:'#ef4444'}}>*</span></label>
                            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="例: お気に入り動画" style={inputStyle}/>
                        </div>
                        <div>
                            <label style={labelStyle}>説明文（任意）</label>
                            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="プレイリストの説明..." rows={2}
                                style={{...inputStyle, resize:'none' as const, lineHeight:1.6}}/>
                        </div>
                        <div>
                            <label style={labelStyle}>カバー画像URL（任意）</label>
                            <input type="text" value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://..." style={{...inputStyle, fontSize:11}}/>
                            {coverUrl && (
                                <div style={{ marginTop:8, aspectRatio:'16/9', borderRadius:10, overflow:'hidden', background:'#111' }}>
                                    <img src={coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={()=>setCoverUrl('')}/>
                                </div>
                            )}
                        </div>

                        {/* Access toggle */}
                        <div>
                            <label style={labelStyle}>公開設定</label>
                            <div style={{ display:'flex', gap:8 }}>
                                {(['free','paid'] as const).map(v=>(
                                    <button key={v} onClick={()=>setAccess(v)} style={{
                                        flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer',
                                        fontSize:11, fontWeight:700, letterSpacing:'.06em', transition:'all .15s',
                                        background: access===v ? (v==='free' ? SB : '#d4a24a') : BG,
                                        color: access===v ? (v==='free' ? LIME : SB) : TM,
                                        boxShadow: access===v ? '0 2px 8px rgba(0,0,0,.15)' : NEU_SM,
                                    }}>
                                        {v==='free' ? '無料公開' : '有料コンテンツ'}
                                    </button>
                                ))}
                            </div>
                            {access==='paid' && (
                                <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                                    <span style={{ fontSize:14, fontWeight:800, color:T2 }}>¥</span>
                                    <input type="number" value={price||''} onChange={e=>setPrice(Math.max(0,parseInt(e.target.value)||0))} placeholder="500"
                                        style={{...inputStyle, width:140, fontFamily:'monospace', fontSize:14, fontWeight:700}}/>
                                    <span style={{ fontSize:9, color:TM }}>決済連携後に有効</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height:1, background:'rgba(0,0,0,.06)', margin:'0 -22px 16px' }}/>

                    {/* Current items */}
                    <div style={{ marginBottom:18 }}>
                        <label style={{...labelStyle, marginBottom:10}}>追加済み ({playlistItems.length})</label>
                        {playlistItems.length===0 ? (
                            <div style={{ textAlign:'center', padding:'16px 0', fontSize:12, color:TM }}>
                                下のリストからコンテンツを追加してください
                            </div>
                        ) : (
                            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                                {playlistItems.map(item => (
                                    <div key={item.id} style={{
                                        flexShrink:0, width:100, borderRadius:12, background:BG, boxShadow:NEU_SM,
                                        overflow:'hidden', position:'relative',
                                    }}>
                                        <div style={{ aspectRatio:'1', background:SB, overflow:'hidden' }}>
                                            {item.thumbnailUrl ? (
                                                <img src={item.thumbnailUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                                            ) : (
                                                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                    {item.type==='video' ? <Film size={18} color="rgba(255,255,255,.3)"/> : <Headphones size={18} color="rgba(255,255,255,.3)"/>}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ padding:'6px 8px' }}>
                                            <div style={{ fontSize:10, fontWeight:600, color:T1, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{item.title}</div>
                                        </div>
                                        {/* Remove button */}
                                        <button onClick={()=>toggleItem(item)} style={{
                                            position:'absolute', top:4, right:4,
                                            width:20, height:20, borderRadius:'50%',
                                            background:'rgba(239,68,68,.85)', border:'none',
                                            display:'flex', alignItems:'center', justifyContent:'center',
                                            cursor:'pointer', color:'#fff',
                                        }}>
                                            <X size={10}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div style={{ height:1, background:'rgba(0,0,0,.06)', margin:'0 -22px 16px' }}/>

                    {/* Available media */}
                    <div>
                        <label style={{...labelStyle, marginBottom:10}}>コンテンツを追加</label>
                        {/* Filter tabs */}
                        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                            {([{key:'video' as const, icon:<Film size={13}/>, label:'動画'},{key:'podcast' as const, icon:<Headphones size={13}/>, label:'音声'}]).map(t=>(
                                <button key={t.key} onClick={()=>setFilterType(t.key)} style={{
                                    display:'flex', alignItems:'center', gap:5,
                                    padding:'7px 16px', borderRadius:100, border:'none', cursor:'pointer',
                                    fontSize:11, fontWeight:700, transition:'all .15s',
                                    background: filterType===t.key ? SB : BG,
                                    color: filterType===t.key ? LIME : TM,
                                    boxShadow: filterType===t.key ? '0 2px 8px rgba(0,0,0,.2)' : NEU_SM,
                                }}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Media list */}
                        {loading ? (
                            <div style={{ textAlign:'center', padding:'30px 0' }}>
                                <div style={{ width:20, height:20, border:`2px solid ${SAGE}`, borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto', animation:'spin .8s linear infinite' }}/>
                                <div style={{ fontSize:11, color:TM, marginTop:8 }}>読み込み中...</div>
                            </div>
                        ) : filtered.length===0 ? (
                            <div style={{ textAlign:'center', padding:'30px 0', fontSize:12, color:TM }}>
                                選択可能なコンテンツがありません
                            </div>
                        ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {filtered.map(item => {
                                    const isSelected = playlistItems.some(p => p.id === item.id);
                                    return (
                                        <div key={item.id} onClick={()=>toggleItem(item)} style={{
                                            display:'flex', alignItems:'center', gap:12,
                                            padding:10, borderRadius:12, cursor:'pointer',
                                            background:BG, transition:'all .15s',
                                            boxShadow: isSelected ? `inset 0 0 0 2px ${SAGE}` : NEU_SM,
                                        }}
                                        onMouseEnter={e=>{if(!isSelected) e.currentTarget.style.boxShadow=`0 0 0 2px ${SAGE}`;}}
                                        onMouseLeave={e=>{if(!isSelected) e.currentTarget.style.boxShadow=NEU_SM;}}
                                        >
                                            {/* Thumbnail */}
                                            <div style={{ width:52, height:40, borderRadius:8, overflow:'hidden', flexShrink:0, background:SB, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                {item.thumbnailUrl ? (
                                                    <img src={item.thumbnailUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                                                ) : (
                                                    item.type==='video' ? <Film size={16} color="rgba(255,255,255,.3)"/> : <Headphones size={16} color="rgba(255,255,255,.3)"/>
                                                )}
                                            </div>
                                            {/* Title */}
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontSize:12, fontWeight:700, color:T1, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{item.title}</div>
                                                <div style={{ fontSize:9, color:TM, marginTop:2, fontFamily:'monospace' }}>{new Date(item.createdAt).toLocaleDateString('ja-JP')}</div>
                                            </div>
                                            {/* Check */}
                                            <div style={{
                                                width:24, height:24, borderRadius:'50%', flexShrink:0,
                                                display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
                                                background: isSelected ? SAGE : BG,
                                                color: isSelected ? '#fff' : TM,
                                                boxShadow: isSelected ? '0 2px 6px rgba(74,124,89,.3)' : NEU_SM,
                                            }}>
                                                {isSelected ? <Check size={13}/> : <Plus size={13}/>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'14px 22px', borderTop:'1px solid rgba(0,0,0,.06)',
                }}>
                    {playlistId && (
                        <button onClick={handleDelete} disabled={saving} style={{
                            marginRight:'auto', display:'flex', alignItems:'center', gap:5,
                            padding:'8px 14px', borderRadius:10, border:'none',
                            background:'rgba(239,68,68,.08)', color:'#ef4444',
                            fontSize:11, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? .5 : 1,
                        }}>
                            <Trash2 size={13}/> 削除
                        </button>
                    )}
                    <div style={{ flex: playlistId ? 0 : 1 }}/>
                    <button onClick={onClose} disabled={saving} style={{
                        padding:'9px 20px', borderRadius:10, border:'none',
                        background:BG, boxShadow:NEU_SM, color:T2,
                        fontSize:12, fontWeight:700, cursor:'pointer',
                    }}>キャンセル</button>
                    <button onClick={handleSave} disabled={saving || !name.trim()} style={{
                        display:'flex', alignItems:'center', gap:6,
                        padding:'9px 22px', borderRadius:10, border:'none',
                        background: (!name.trim() || saving) ? TM : SB,
                        color: LIME, fontSize:12, fontWeight:700,
                        cursor: (!name.trim() || saving) ? 'not-allowed' : 'pointer',
                        boxShadow:'0 2px 8px rgba(0,0,0,.2)', opacity: saving ? .7 : 1,
                    }}>
                        <Save size={13}/> {saving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
