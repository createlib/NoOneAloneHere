'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import {
    X, Mic, Film, Upload, Link as LinkIcon, Image as ImageIcon,
    Loader2, CheckCircle2, Crown, MessageSquare, Tag
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────────── */
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
const RED  = '#d97070';

const CAST_TAGS  = ['対談・インタビュー','ひとり語り','ノウハウ共有','活動報告','ビジネス','恋愛'];
const VIDEO_TAGS = ['ピッチ・資金調達','ビジネスパートナー募集','PR・宣伝','活動記録','ノウハウ共有'];

/* ── Input field ────────────────────────────────────────────────────── */
const Field = ({ label, required, hint, children }: { label:string; required?:boolean; hint?:string; children:React.ReactNode }) => (
    <div style={{ marginBottom:16 }}>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:T1, marginBottom:6, letterSpacing:'.04em' }}>
            {label} {required && <span style={{ color:RED, fontSize:10 }}>*</span>}
        </label>
        {hint && <div style={{ fontSize:9, color:TM, marginBottom:6 }}>{hint}</div>}
        {children}
    </div>
);

const inputStyle: React.CSSProperties = {
    width:'100%', padding:'10px 12px', border:'none', borderRadius:10,
    background:BG, boxShadow:NEU_IN, fontSize:12, color:T1, outline:'none',
    boxSizing:'border-box', fontFamily:'inherit',
};

/* ══════════════════════════════════════════════════════════════════════ *
 *  MediaPostModal
 * ══════════════════════════════════════════════════════════════════════ */
type PostType = 'cast' | 'theater';

interface Props {
    type: PostType;
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userProfile: any;   // { name, userId, photoURL, membershipRank }
    editId?: string | null;
}

export default function MediaPostModal({ type, isOpen, onClose, userId, userProfile, editId }: Props) {
    const router = useRouter();
    const isAdmin = userProfile?.userId === 'admin';

    /* ── Form state ──────────────────────────────────────────────────── */
    const [sourceMode, setSourceMode] = useState<'upload'|'url'>('upload');
    const [file, setFile] = useState<File|null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [parsedUrl, setParsedUrl] = useState('');
    const [isEmbed, setIsEmbed] = useState(false);
    const [duration, setDuration] = useState(0);

    const [thumbFile, setThumbFile] = useState<File|null>(null);
    const [thumbPreview, setThumbPreview] = useState('');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [guests, setGuests] = useState('');           // cast only
    const [relatedUrls, setRelatedUrls] = useState(''); // cast only

    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');
    const [allowComments, setAllowComments] = useState(true);
    const [overrideUserId, setOverrideUserId] = useState('');

    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const audioRef = useRef<HTMLAudioElement>(null);

    /* ── Load edit data ──────────────────────────────────────────────── */
    useEffect(() => {
        if (!isOpen || !editId) return;
        const load = async () => {
            try {
                const colName = type==='cast'?'podcasts':'videos';
                const snap = await getDoc(doc(db,'artifacts',APP_ID,'public','data',colName,editId));
                if (!snap.exists()) return;
                const d = snap.data();

                setTitle(d.title||'');
                setDescription(d.description||'');
                setAllowComments(d.allowComments!==false);

                if (type==='cast') {
                    setGuests(d.guests?d.guests.join(', '):'');
                    const urls = Array.isArray(d.relatedArticleUrls)?d.relatedArticleUrls.join(', '):(d.relatedArticleUrl||'');
                    setRelatedUrls(urls);
                    setDuration(d.duration||0);
                    if (d.sourceType==='url') { setSourceMode('url'); setUrlInput(d.audioUrl||''); parseCastUrl(d.audioUrl||''); }
                    else { setSourceMode('upload'); setParsedUrl(d.audioUrl||''); }
                } else {
                    if (d.sourceType==='url'||d.embedUrl) { setSourceMode('url'); setUrlInput(d.sourceUrl||d.embedUrl||''); parseVideoUrl(d.sourceUrl||d.embedUrl||''); }
                    else { setSourceMode('upload'); setParsedUrl(d.sourceUrl||''); }
                }
                if (d.thumbnailUrl) setThumbPreview(d.thumbnailUrl);

                const presetList = type==='cast'?CAST_TAGS:VIDEO_TAGS;
                const allTags = d.tags||[];
                setSelectedTags(allTags.filter((t:string)=>presetList.includes(t)));
                setCustomTags(allTags.filter((t:string)=>!presetList.includes(t)).join(', '));
            } catch(e) { console.error(e); }
        };
        load();
    }, [isOpen, editId, type]);

    /* ── Reset on close ────────────────────────────────────────────── */
    useEffect(() => {
        if (!isOpen) {
            setSourceMode('upload'); setFile(null); setUrlInput(''); setParsedUrl(''); setIsEmbed(false); setDuration(0);
            setThumbFile(null); setThumbPreview('');
            setTitle(''); setDescription(''); setGuests(''); setRelatedUrls('');
            setSelectedTags([]); setCustomTags(''); setAllowComments(true); setOverrideUserId('');
            setSaving(false); setProgress(0); setProgressText('');
        }
    }, [isOpen]);

    /* ── URL parsers ─────────────────────────────────────────────────── */
    const parseCastUrl = (url:string) => {
        if (!url) { setParsedUrl(''); setIsEmbed(false); return; }
        let embed=null, isE=false;
        if (url.includes('open.spotify.com/episode/')) { const m=url.match(/episode\/([a-zA-Z0-9]+)/); if(m) { embed=`https://open.spotify.com/embed/episode/${m[1]}?utm_source=generator`; isE=true; } }
        else if (url.includes('open.spotify.com/show/')) { const m=url.match(/show\/([a-zA-Z0-9]+)/); if(m) { embed=`https://open.spotify.com/embed/show/${m[1]}?utm_source=generator`; isE=true; } }
        else if (url.includes('podcasts.apple.com')) { embed=url.replace('podcasts.apple.com','embed.podcasts.apple.com'); isE=true; }
        else if (url.includes('drive.google.com/file/d/')) { const m=url.match(/d\/([a-zA-Z0-9_-]+)/); if(m) { embed=`https://drive.google.com/file/d/${m[1]}/preview`; isE=true; } }
        setParsedUrl(isE?(embed||''):url); setIsEmbed(isE); setDuration(0);
    };

    const parseVideoUrl = (url:string) => {
        if (!url) { setParsedUrl(''); setIsEmbed(false); return; }
        const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
        if (yt&&yt[1]) { setParsedUrl(`https://www.youtube.com/embed/${yt[1]}`); setIsEmbed(true); if(!thumbFile&&!thumbPreview) setThumbPreview(`https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`); return; }
        const vim = url.match(/vimeo.com\/(\d+)/);
        if (vim&&vim[1]) { setParsedUrl(`https://player.vimeo.com/video/${vim[1]}`); setIsEmbed(true); return; }
        const gd = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (gd&&gd[1]) { setParsedUrl(`https://drive.google.com/file/d/${gd[1]}/preview`); setIsEmbed(true); return; }
        setParsedUrl(url); setIsEmbed(false);
    };

    const handleUrlChange = (v:string) => { setUrlInput(v); type==='cast'?parseCastUrl(v):parseVideoUrl(v); };

    /* ── File handlers ───────────────────────────────────────────────── */
    const handleFileUpload = (e:React.ChangeEvent<HTMLInputElement>) => {
        const f=e.target.files?.[0]; if(!f) return;
        setFile(f); setParsedUrl(URL.createObjectURL(f)); setIsEmbed(false);
        if(type==='cast'&&audioRef.current) audioRef.current.src=URL.createObjectURL(f);
    };
    const handleThumbUpload = (e:React.ChangeEvent<HTMLInputElement>) => {
        const f=e.target.files?.[0]; if(!f) return;
        setThumbFile(f); setThumbPreview(URL.createObjectURL(f));
    };
    const handleAudioMeta = () => { if(audioRef.current) setDuration(audioRef.current.duration); };

    /* ── Submit ───────────────────────────────────────────────────────── */
    const handleSubmit = async () => {
        if(!title.trim()) return alert('タイトルを入力してください。');
        if(!editId) {
            if(sourceMode==='upload'&&!file) return alert(type==='cast'?'音声ファイルを選択してください':'動画ファイルを選択してください');
            if(sourceMode==='url'&&!urlInput.trim()) return alert('URLを入力してください');
        }
        const maxSize = type==='cast'?30:100;
        if(file&&file.size>maxSize*1024*1024) return alert(`ファイルが大きすぎます (上限${maxSize}MB)`);
        if(thumbFile&&thumbFile.size>5*1024*1024) return alert('画像サイズが大きすぎます (上限5MB)');

        setSaving(true); setProgress(5); setProgressText('アップロード準備中...');

        try {
            let finalUrl='', finalThumbUrl='', finalEmbedUrl='';

            // Author info
            let authorId=userId, authorName=userProfile?.name||'名無し', authorIcon=userProfile?.photoURL||null;
            if(isAdmin&&overrideUserId.trim()) {
                const q=query(collection(db,'artifacts',APP_ID,'public','data','users'),where('userId','==',overrideUserId.trim()));
                const snap=await getDocs(q);
                if(snap.empty) throw new Error(`ユーザーID「@${overrideUserId.trim()}」が見つかりません`);
                const td=snap.docs[0]; authorId=td.id; const d=td.data(); authorName=d.name||d.userId; authorIcon=d.photoURL||null;
            }

            // Upload main file
            if(sourceMode==='upload'&&file) {
                const folder=type==='cast'?'podcasts/audio':'videos/video';
                const sRef=ref(storage,`${folder}/${userId}/${Date.now()}_${file.name}`);
                const task=uploadBytesResumable(sRef,file);
                await new Promise<void>((resolve,reject)=>{
                    task.on('state_changed', s=>{
                        const p=(s.bytesTransferred/s.totalBytes)*75;
                        setProgress(5+p); setProgressText(`アップロード中... (${Math.floor(5+p)}%)`);
                    }, e=>reject(e), async()=>{ try{ finalUrl=await getDownloadURL(task.snapshot.ref); resolve(); }catch(e){reject(e);} });
                });
            } else if(sourceMode==='url') {
                finalUrl=urlInput.trim();
                if(type==='theater') finalEmbedUrl=isEmbed?parsedUrl:'';
            }

            // Upload thumbnail
            if(thumbFile) {
                setProgress(80); setProgressText('画像をアップロード中...');
                const folder=type==='cast'?'podcasts/thumbnails':'videos/thumbnails';
                const tRef=ref(storage,`${folder}/${userId}/${Date.now()}_${thumbFile.name}`);
                const snap=await uploadBytes(tRef,thumbFile);
                finalThumbUrl=await getDownloadURL(snap.ref);
            }

            // Merge with edit data
            if(editId) {
                const colName=type==='cast'?'podcasts':'videos';
                const snap=await getDoc(doc(db,'artifacts',APP_ID,'public','data',colName,editId));
                if(snap.exists()) {
                    const old=snap.data();
                    if(!finalUrl) finalUrl=type==='cast'?(old.audioUrl||''):(old.sourceUrl||'');
                    if(!finalThumbUrl) finalThumbUrl=old.thumbnailUrl||'';
                    if(type==='theater'&&!finalEmbedUrl) finalEmbedUrl=old.embedUrl||'';
                }
            }

            setProgress(100); setProgressText('保存中...');

            const cTags=customTags.split(',').map(t=>t.trim()).filter(Boolean);
            const tags=Array.from(new Set([...selectedTags,...cTags]));
            const docId=editId||Date.now().toString();
            const colName=type==='cast'?'podcasts':'videos';

            const payload:any = {
                authorId, authorName, authorIcon,
                sourceType:sourceMode, title, description, tags, allowComments,
                updatedAt:new Date().toISOString(),
                ...(!editId&&{createdAt:new Date().toISOString()}),
            };

            if(type==='cast') {
                payload.audioUrl=sourceMode==='url'?parsedUrl:finalUrl;
                payload.isEmbed=isEmbed;
                payload.thumbnailUrl=finalThumbUrl||null;
                payload.duration=duration;
                payload.guests=guests?guests.split(',').map(s=>s.trim()).filter(Boolean):[];
                payload.relatedArticleUrls=relatedUrls?relatedUrls.split(',').map(s=>s.trim()).filter(Boolean):[];
            } else {
                payload.sourceUrl=finalUrl;
                payload.embedUrl=isEmbed?finalEmbedUrl:'';
                payload.thumbnailUrl=finalThumbUrl||null;
            }

            await setDoc(doc(db,'artifacts',APP_ID,'public','data',colName,docId),payload,{merge:true});

            // Notify followers
            if(!editId) {
                try {
                    const fSnap=await getDocs(collection(db,'artifacts',APP_ID,'users',authorId,'followers'));
                    await Promise.all(fSnap.docs.map(f=>addDoc(collection(db,'artifacts',APP_ID,'users',f.id,'notifications'),{
                        type:type==='cast'?'new_podcast':'new_video', fromUid:authorId, contentId:docId, createdAt:serverTimestamp(), isRead:false,
                    })));
                } catch {}
            }

            onClose();
            const detailPath=type==='cast'?`/media/podcasts/detail?id=${docId}`:`/media/videos/detail?id=${docId}`;
            router.push(detailPath);
        } catch(e:any) {
            console.error(e); alert(`エラー: ${e.message}`);
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const presetTags = type === 'cast' ? CAST_TAGS : VIDEO_TAGS;
    const isCast = type === 'cast';

    /* ══════════════════════════════════════════════════════════════════ *
     *  RENDER
     * ══════════════════════════════════════════════════════════════════ */
    return (
        <div
            style={{
                position:'fixed', inset:0, zIndex:6000,
                background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                display:'flex', alignItems:'flex-end', justifyContent:'center',
            }}
            onClick={e => { if(e.target===e.currentTarget && !saving) onClose(); }}
        >
            <div style={{
                width:'100%', maxWidth:600, maxHeight:'92vh',
                background:BG, borderRadius:'20px 20px 0 0',
                boxShadow:'0 -8px 40px rgba(0,0,0,.2)',
                display:'flex', flexDirection:'column', overflow:'hidden',
            }}>
                {/* ── Header ────────────────────────────────────────── */}
                <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'14px 20px', borderBottom:'1px solid rgba(0,0,0,.06)', flexShrink:0,
                }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {isCast ? <Mic size={16} color={SAGE} /> : <Film size={16} color={SAGE} />}
                        <span style={{ fontSize:14, fontWeight:800, color:T1, letterSpacing:'.04em' }}>
                            {editId ? (isCast?'音声を編集':'動画を編集') : (isCast?'音声を配信':'動画を投稿')}
                        </span>
                    </div>
                    <button onClick={()=>!saving&&onClose()}
                        style={{ width:32,height:32,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T2 }}>
                        <X size={14} />
                    </button>
                </div>

                {/* ── Body (scrollable) ─────────────────────────────── */}
                <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 30px', scrollbarWidth:'thin' }}>

                    {/* Source type toggle */}
                    <div style={{ display:'flex', gap:4, marginBottom:16, background:BG, borderRadius:12, boxShadow:NEU_IN, padding:4 }}>
                        {(['upload','url'] as const).map(m => (
                            <button key={m} onClick={()=>setSourceMode(m)}
                                style={{
                                    flex:1, padding:'8px 0', borderRadius:10, border:'none',
                                    fontSize:10, fontWeight:700, cursor:'pointer',
                                    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                                    background: sourceMode===m?'#fff':'transparent',
                                    color: sourceMode===m?SAGE:TM,
                                    boxShadow: sourceMode===m?NEU_SM:'none',
                                    transition:'all .2s',
                                }}>
                                {m==='upload'?<Upload size={11}/>:<LinkIcon size={11}/>}
                                {m==='upload'?'ファイル':'URL'}
                            </button>
                        ))}
                    </div>

                    {/* File / URL input */}
                    <Field label={isCast?'音声データ':'動画データ'} required
                        hint={sourceMode==='upload'
                            ?(isCast?'MP3形式など (上限30MB)':'MP4形式など (上限100MB)')
                            :(isCast?'Spotify, Apple Podcasts, Google Drive等のURL':'YouTube, Vimeo, Google Drive等のURL')
                        }>
                        {sourceMode==='upload' ? (
                            <div style={{
                                border:`2px dashed rgba(0,0,0,.1)`, borderRadius:12, padding:'14px 16px',
                                background:BG, boxShadow:NEU_IN, position:'relative', cursor:'pointer',
                                textAlign:'center',
                            }}>
                                <input type="file" accept={isCast?'audio/*':'video/*'} onChange={handleFileUpload}
                                    style={{ position:'absolute',inset:0,opacity:0,cursor:'pointer' }} />
                                <Upload size={18} color={TM} style={{ margin:'0 auto 4px' }} />
                                <div style={{ fontSize:10, fontWeight:600, color:T2 }}>
                                    {file ? file.name : 'ファイルを選択'}
                                </div>
                            </div>
                        ) : (
                            <input type="url" value={urlInput} onChange={e=>handleUrlChange(e.target.value)}
                                placeholder={isCast?'https://open.spotify.com/episode/...':'https://www.youtube.com/watch?v=...'}
                                style={inputStyle} />
                        )}
                    </Field>

                    {/* Preview */}
                    {parsedUrl && (
                        <div style={{ marginBottom:16, padding:10, borderRadius:12, background:BG, boxShadow:NEU_SM }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                                <CheckCircle2 size={11} color={SAGE} />
                                <span style={{ fontSize:9, fontWeight:700, color:SAGE, letterSpacing:'.06em' }}>PREVIEW</span>
                            </div>
                            {isEmbed ? (
                                <iframe src={parsedUrl} style={{ width:'100%',borderRadius:8,border:'none',minHeight:isCast?152:180 }}
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
                            ) : isCast ? (
                                <audio ref={audioRef} controls src={parsedUrl} onLoadedMetadata={handleAudioMeta}
                                    style={{ width:'100%',height:36 }} />
                            ) : (
                                <video src={parsedUrl} controls style={{ width:'100%',borderRadius:8,maxHeight:180 }} />
                            )}
                        </div>
                    )}

                    {/* Thumbnail */}
                    <Field label="サムネイル画像" hint="設定しない場合はデフォルト背景が適用されます">
                        <div style={{
                            width:'100%', aspectRatio:'16/9', maxWidth:260, borderRadius:12,
                            border:'2px dashed rgba(0,0,0,.1)', background:BG, boxShadow:NEU_IN,
                            overflow:'hidden', position:'relative', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                            <input type="file" accept="image/*" onChange={handleThumbUpload}
                                style={{ position:'absolute',inset:0,opacity:0,cursor:'pointer',zIndex:1 }} />
                            {thumbPreview ? (
                                <img src={thumbPreview} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                            ) : (
                                <div style={{ textAlign:'center' }}>
                                    <ImageIcon size={20} color={TM} style={{ margin:'0 auto 4px' }} />
                                    <div style={{ fontSize:9, fontWeight:600, color:TM }}>画像を選択</div>
                                </div>
                            )}
                        </div>
                    </Field>

                    {/* Title */}
                    <Field label={isCast?'配信タイトル':'動画タイトル'} required>
                        <input type="text" value={title} onChange={e=>setTitle(e.target.value)}
                            placeholder="タイトルを入力" style={{...inputStyle,fontWeight:700}} />
                    </Field>

                    {/* Guests (cast only) */}
                    {isCast && (
                        <Field label="ゲスト" hint="複数いる場合はカンマ区切り">
                            <input type="text" value={guests} onChange={e=>setGuests(e.target.value)}
                                placeholder="ゲスト名" style={inputStyle} />
                        </Field>
                    )}

                    {/* Description */}
                    <Field label="概要欄" hint="Markdown対応">
                        <textarea value={description} onChange={e=>setDescription(e.target.value)}
                            rows={4} placeholder={isCast?"・オープニング\n・テーマについて":"・動画の概要\n・関連リンク"}
                            style={{...inputStyle,resize:'vertical',lineHeight:1.6}} />
                    </Field>

                    {/* Related URLs (cast only) */}
                    {isCast && (
                        <Field label="関連記事 (Note等)" hint="複数の場合はカンマ区切り">
                            <input type="text" value={relatedUrls} onChange={e=>setRelatedUrls(e.target.value)}
                                placeholder="https://note.com/..." style={inputStyle} />
                        </Field>
                    )}

                    {/* Tags */}
                    <Field label="カテゴリー・タグ">
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                            {presetTags.map(t => (
                                <button key={t} type="button" onClick={()=>setSelectedTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                                    style={{
                                        padding:'5px 12px', borderRadius:8, border:'none', fontSize:10, fontWeight:700, cursor:'pointer',
                                        background:selectedTags.includes(t)?SB:BG,
                                        color:selectedTags.includes(t)?LIME:T2,
                                        boxShadow:selectedTags.includes(t)?'none':NEU_SM,
                                        transition:'all .15s',
                                    }}>{t}</button>
                            ))}
                        </div>
                        <input type="text" value={customTags} onChange={e=>setCustomTags(e.target.value)}
                            placeholder="その他のタグ (カンマ区切り)" style={inputStyle} />
                    </Field>

                    {/* Comment toggle */}
                    <Field label="コメント機能">
                        <div style={{ display:'flex', gap:6 }}>
                            {([true,false] as const).map(v => (
                                <button key={String(v)} type="button" onClick={()=>setAllowComments(v)}
                                    style={{
                                        flex:1, padding:'7px 0', borderRadius:8, border:'none', fontSize:10, fontWeight:700, cursor:'pointer',
                                        background:allowComments===v?SAGE:BG,
                                        color:allowComments===v?'#fff':T2,
                                        boxShadow:allowComments===v?'none':NEU_SM,
                                        transition:'all .15s',
                                    }}>{v?'許可する':'許可しない'}</button>
                            ))}
                        </div>
                    </Field>

                    {/* Admin override */}
                    {isAdmin && (
                        <div style={{ marginTop:12, padding:12, borderRadius:12, border:`1px solid ${RED}`, background:'rgba(217,112,112,.05)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:RED, marginBottom:6 }}>
                                <Crown size={11} /> 管理者: 代理投稿
                            </div>
                            <input type="text" value={overrideUserId} onChange={e=>setOverrideUserId(e.target.value)}
                                placeholder="ユーザーID (空欄で自分)" style={{...inputStyle,borderRadius:8}} />
                        </div>
                    )}
                </div>

                {/* ── Footer: Submit ────────────────────────────────── */}
                <div style={{
                    padding:'14px 20px', borderTop:'1px solid rgba(0,0,0,.06)', flexShrink:0,
                    display:'flex', gap:10,
                }}>
                    <button onClick={()=>!saving&&onClose()}
                        style={{
                            flex:1, padding:'12px 0', borderRadius:12, border:'none',
                            background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700,
                            color:T2, cursor:'pointer',
                        }}>キャンセル</button>
                    <button onClick={handleSubmit} disabled={saving}
                        style={{
                            flex:2, padding:'12px 0', borderRadius:12, border:'none',
                            background:SB, color:LIME, fontSize:12, fontWeight:800,
                            cursor:saving?'wait':'pointer', opacity:saving?0.6:1,
                            boxShadow:'0 2px 12px rgba(0,0,0,.2)',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                            letterSpacing:'.06em', transition:'opacity .15s',
                        }}>
                        {saving ? (
                            <><Loader2 size={14} style={{ animation:'spin .8s linear infinite' }} /> {progressText||'処理中...'}</>
                        ) : (
                            <>{isCast?<Mic size={14}/>:<Film size={14}/>} {editId?'保存する':(isCast?'配信する':'投稿する')}</>
                        )}
                    </button>
                </div>

                {/* Upload progress overlay */}
                {saving && progress>0 && (
                    <div style={{
                        position:'absolute', bottom:70, left:20, right:20,
                        height:4, borderRadius:4, background:'rgba(0,0,0,.08)', overflow:'hidden',
                    }}>
                        <div style={{
                            height:'100%', borderRadius:4, background:SAGE,
                            width:`${progress}%`, transition:'width .3s',
                        }} />
                    </div>
                )}
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
