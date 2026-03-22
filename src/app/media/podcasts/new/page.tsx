'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Podcast, ArrowLeft, CloudUpload, Image as ImageIcon, Music, SatelliteDish, Crown, CheckCircle2, AlertTriangle, Link as LinkIcon, Edit, Lock, Globe, Users, Shield, Radio, Mic, Video, Copy } from 'lucide-react';

const PRESET_TAGS = ['対談・インタビュー', 'ひとり語り', 'ノウハウ共有', '活動報告', 'ビジネス', '恋愛'];

export default function PodcastPostPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editPid = searchParams.get('pid');

    const [isSaving, setIsSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    
    const [myProfile, setMyProfile] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Form states
    const [audioType, setAudioType] = useState<'upload' | 'url' | 'live'>('upload');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrlInput, setAudioUrlInput] = useState('');
    const [duration, setDuration] = useState(0);
    const [parsedAudioUrl, setParsedAudioUrl] = useState('');
    const [isEmbedMode, setIsEmbedMode] = useState(false);

    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');

    const [title, setTitle] = useState('');
    const [guests, setGuests] = useState('');
    const [description, setDescription] = useState('');
    const [relatedArticleUrls, setRelatedArticleUrls] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');
    const [allowComments, setAllowComments] = useState(true);

    const [overrideUserId, setOverrideUserId] = useState('');

    // Live specific
    const [livePrivacy, setLivePrivacy] = useState('public');
    const [liveType, setLiveType] = useState('talk');
    const [liveRecord, setLiveRecord] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) {
            router.push('/login');
            return;
        }

        const init = async () => {
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                if (snap.exists()) {
                    const data = snap.data();
                    setMyProfile(data);
                    if (data.userId === 'admin') setIsAdmin(true);

                    // Check rank for live feature
                    const rank = data.membershipRank || 'arrival';
                    const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
                    const lvl = rankLevels[rank] || 0;
                    
                    if (lvl === 0 && data.userId !== 'admin') {
                        alert("音声の配信はSETTLER以上の会員のみ可能です。");
                        router.push('/settings'); // Or upgrade page
                        return;
                    }
                }
                
                if (editPid) {
                    const podSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', editPid));
                    if (podSnap.exists()) {
                        const pData = podSnap.data();
                        if (pData.authorId !== user.uid && myProfile?.userId !== 'admin') {
                            alert('編集権限がありません');
                            router.push('/media/podcasts');
                            return;
                        }
                        setTitle(pData.title || '');
                        setDescription(pData.description || '');
                        setGuests(pData.guests ? pData.guests.join(', ') : '');
                        
                        let urls = '';
                        if (pData.relatedArticleUrls && Array.isArray(pData.relatedArticleUrls)) {
                            urls = pData.relatedArticleUrls.join(', ');
                        } else if (pData.relatedArticleUrl) {
                            urls = pData.relatedArticleUrl;
                        }
                        setRelatedArticleUrls(urls);
                        
                        setDuration(pData.duration || 0);
                        
                        if (pData.sourceType === 'url') {
                            setAudioType('url');
                            setAudioUrlInput(pData.audioUrl || '');
                            handleAudioUrlParse(pData.audioUrl || '');
                        } else {
                            setAudioType('upload');
                            setParsedAudioUrl(pData.audioUrl || '');
                            setIsEmbedMode(false);
                        }
                        
                        if (pData.thumbnailUrl) {
                            setThumbPreviewUrl(pData.thumbnailUrl);
                        }

                        if (pData.allowComments === false) setAllowComments(false);

                        const allTags = pData.tags || [];
                        const preset = allTags.filter((t: string) => PRESET_TAGS.includes(t));
                        const custom = allTags.filter((t: string) => !PRESET_TAGS.includes(t));
                        setSelectedTags(preset);
                        setCustomTags(custom.join(', '));
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, [user, loading, editPid, router]);

    const handleAudioUrlParse = (url: string) => {
        let embedUrl = null;
        let isEmbed = false;

        if (!url) {
            setParsedAudioUrl('');
            setIsEmbedMode(false);
            return;
        }

        if (url.includes('open.spotify.com/episode/')) {
            const match = url.match(/episode\/([a-zA-Z0-9]+)/);
            if (match) { embedUrl = `https://open.spotify.com/embed/episode/${match[1]}?utm_source=generator`; isEmbed = true; }
        } else if (url.includes('open.spotify.com/show/')) {
            const match = url.match(/show\/([a-zA-Z0-9]+)/);
            if (match) { embedUrl = `https://open.spotify.com/embed/show/${match[1]}?utm_source=generator`; isEmbed = true; }
        } else if (url.includes('podcasts.apple.com')) {
            embedUrl = url.replace('podcasts.apple.com', 'embed.podcasts.apple.com');
            isEmbed = true;
        } else if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (match) { embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`; isEmbed = true; }
        }

        setParsedAudioUrl(isEmbed ? (embedUrl || '') : url);
        setIsEmbedMode(isEmbed);
        setDuration(0);
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
            const url = URL.createObjectURL(file);
            setParsedAudioUrl(url);
            setIsEmbedMode(false);
            if (audioRef.current) {
                audioRef.current.src = url;
            }
        }
    };

    const handleAudioLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbFile(file);
            setThumbPreviewUrl(URL.createObjectURL(file));
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) return;
        if (!title.trim()) return alert('タイトルを入力してください。');

        let finalAudioUrl = '';
        let finalThumbUrl = '';
        let finalIsEmbedMode = isEmbedMode;

        if (audioType !== 'live' && !editPid) {
            if (audioType === 'upload' && !audioFile) return alert('音声ファイルを選択してください');
            if (audioType === 'url' && !audioUrlInput.trim()) return alert('音声のURLを入力してください');
        }

        if (audioType === 'upload' && audioFile && audioFile.size > 30 * 1024 * 1024) {
             return alert(`音声ファイルが大きすぎます (上限30MB)`);
        }
        if (thumbFile && thumbFile.size > 5 * 1024 * 1024) {
             return alert(`画像サイズが大きすぎます (上限5MB)`);
        }

        setIsSaving(true);
        setProgress(5);
        setProgressText(audioType === 'live' ? '配信の準備中...' : 'アップロードの準備中...');

        try {
            // Determine Final Author Info
            let finalAuthorId = user.uid;
            let finalAuthorName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
            let finalAuthorIcon = myProfile ? myProfile.photoURL : null;

            if (isAdmin && overrideUserId.trim()) {
                const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                const q = query(usersRef, where("userId", "==", overrideUserId.trim()));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    throw new Error(`エラー: 指定されたユーザーID「@${overrideUserId.trim()}」は見つかりませんでした。`);
                }
                const targetDoc = querySnapshot.docs[0];
                finalAuthorId = targetDoc.id;
                const tData = targetDoc.data();
                finalAuthorName = tData.name || tData.userId;
                finalAuthorIcon = tData.photoURL || null;
            }

            const customTagsArray = customTags.split(',').map(t=>t.trim()).filter(t=>t);
            const tags = Array.from(new Set([...selectedTags, ...customTagsArray]));
            const guestsArray = guests ? guests.split(',').map(s=>s.trim()).filter(s=>s) : [];
            const relatedUrlsArray = relatedArticleUrls ? relatedArticleUrls.split(',').map(s=>s.trim()).filter(s=>s) : [];

            // Thumb upload helper
            const uploadThumb = async () => {
                if (!thumbFile) return;
                setProgressText('画像をアップロード中...');
                const thumbRef = ref(storage, `podcasts/thumbnails/${user.uid}/${Date.now()}_${thumbFile.name}`);
                const snap = await uploadBytes(thumbRef, thumbFile);
                finalThumbUrl = await getDownloadURL(snap.ref);
            };

            // ---- LIVE ROOM ----
            if (audioType === 'live') {
                // Clear old data
                try {
                    const oldCommentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'comments');
                    const oldCommentsSnap = await getDocs(oldCommentsRef);
                    await Promise.all(oldCommentsSnap.docs.map(d => deleteDoc(d.ref)));
                    
                    const oldPartsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'participants');
                    const oldPartsSnap = await getDocs(oldPartsRef);
                    await Promise.all(oldPartsSnap.docs.map(d => deleteDoc(d.ref)));
                } catch (e) {
                    console.warn("Init old data error:", e);
                }

                await uploadThumb();

                const roomData = {
                    hostId: finalAuthorId,
                    hostName: finalAuthorName,
                    hostIcon: finalAuthorIcon,
                    title,
                    desc: description,
                    guestsStr: guests,
                    privacy: livePrivacy,
                    type: liveType,
                    tags,
                    isRecord: liveRecord,
                    thumbUrl: finalThumbUrl || null,
                    status: 'live',
                    startedAt: serverTimestamp()
                };

                const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId);
                await setDoc(roomRef, roomData);

                const partRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'participants', finalAuthorId);
                await setDoc(partRef, {
                    uid: finalAuthorId,
                    name: finalAuthorName,
                    icon: finalAuthorIcon,
                    role: 'host',
                    isMuted: false,
                    joinedAt: serverTimestamp()
                });

                // Notify followers
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                    const notifyPromises = followersSnap.docs.map(fDoc => {
                        const notifRef = collection(db, 'artifacts', APP_ID, 'users', fDoc.id, 'notifications');
                        return addDoc(notifRef, {
                            type: 'live_start',
                            fromUid: finalAuthorId,
                            contentId: finalAuthorId,
                            createdAt: serverTimestamp(),
                            isRead: false
                        });
                    });
                    await Promise.all(notifyPromises);
                } catch (e) { console.error(e); }

                router.push(`/media/live_room/${finalAuthorId}`);
                return;
            }

            // ---- PODCAST ----
            if (audioType === 'upload' && audioFile) {
                const storageRef = ref(storage, `podcasts/audio/${user.uid}/${Date.now()}_${audioFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, audioFile);
                
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75; 
                            setProgress(5 + p);
                            setProgressText(`音声をアップロード中... (${Math.floor(5 + p)}%)`);
                        }, 
                        (error) => reject(error), 
                        async () => {
                            try {
                                finalAudioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch(err) {
                                reject(err);
                            }
                        }
                    );
                });
            } else if (audioType === 'url') {
                finalAudioUrl = parsedAudioUrl; // we parsed it during input change
            }

            await uploadThumb();

            if (editPid) {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', editPid));
                if (snap.exists()) {
                    const oldData = snap.data();
                    if (!finalAudioUrl) {
                        finalAudioUrl = oldData.audioUrl;
                        finalIsEmbedMode = oldData.isEmbed || false;
                    }
                    if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl;
                }
            }

            setProgress(100);
            setProgressText('データを保存しています...');

            const docId = editPid || Date.now().toString();
            const payload = {
                authorId: finalAuthorId,
                authorName: finalAuthorName,
                authorIcon: finalAuthorIcon,
                sourceType: audioType,
                audioUrl: finalAudioUrl || '',
                isEmbed: finalIsEmbedMode,
                thumbnailUrl: finalThumbUrl || null,
                title,
                description,
                relatedArticleUrls: relatedUrlsArray,
                guests: guestsArray,
                tags,
                allowComments,
                duration,
                updatedAt: new Date().toISOString(),
                createdAt: editPid ? undefined : new Date().toISOString()
            };

            // Remove undefined createdAt for edit
            if (!payload.createdAt) delete payload.createdAt;

            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', docId), payload, { merge: true });
            
            if (!editPid) {
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                    const p = followersSnap.docs.map(f => addDoc(collection(db, 'artifacts', APP_ID, 'users', f.id, 'notifications'), {
                        type: 'new_podcast',
                        fromUid: finalAuthorId,
                        contentId: docId,
                        createdAt: serverTimestamp(),
                        isRead: false
                    }));
                    await Promise.all(p);
                } catch (e) {}
            }

            router.push(`/media/podcasts/${docId}`);

        } catch (e: any) {
            console.error(e);
            alert(`処理中にエラーが発生しました。\n${e.message}`);
            setIsSaving(false);
        }
    };

    const rankLevel = myProfile ? ({ 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 }[myProfile.membershipRank as string] || 0) : 0;
    const canLiveStream = rankLevel >= 3 || isAdmin;

    return (
        <div className="antialiased min-h-screen bg-texture pb-20">
            <nav className="bg-[rgba(255,253,249,0.95)] backdrop-blur border-b border-brand-200 fixed w-full z-50 top-0 h-16 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-full flex justify-between items-center">
                    <button onClick={() => router.back()} className="text-brand-500 hover:text-brand-800 transition-colors flex items-center gap-2 text-sm font-bold tracking-widest">
                        <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center hover:bg-brand-100 transition-colors">
                            <ArrowLeft size={16} />
                        </div>
                        <span className="hidden sm:inline">キャンセル</span>
                    </button>
                    <h1 className="font-serif font-bold text-brand-900 tracking-widest text-lg flex items-center gap-2">
                        <Podcast className="text-[#b8860b]" /> 音声の配信・編集
                    </h1>
                    <div className="w-20"></div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6">
                <div className="mb-8 text-center">
                    <p className="text-sm text-brand-600 tracking-widest leading-relaxed">
                        あなたの声で、深い考えや対話を届けましょう。<br />
                        <span className="text-xs text-brand-400">※音声ファイルのアップロード、各種サービスのURL指定、または生配信が可能です。</span>
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                    
                    <div className="bg-white p-6 sm:p-8 rounded-sm border border-brand-200 shadow-sm relative overlow-hidden">
                        <label className="block text-sm font-bold text-brand-900 mb-4 tracking-widest flex items-center gap-2">
                            <Music className="text-[#b8860b] w-4 h-4" />音声データ・配信方法 <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="flex gap-4 sm:gap-6 mb-6 border-b border-brand-200 overflow-x-auto no-scrollbar">
                            <button type="button" onClick={() => setAudioType('upload')} className={`pb-2 border-b-2 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap ${audioType === 'upload' ? 'border-[#b8860b] text-[#b8860b] font-bold' : 'border-transparent text-brand-400 hover:text-brand-600'}`}>ファイルをアップロード</button>
                            <button type="button" onClick={() => setAudioType('url')} className={`pb-2 border-b-2 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap ${audioType === 'url' ? 'border-[#b8860b] text-[#b8860b] font-bold' : 'border-transparent text-brand-400 hover:text-brand-600'}`}>URLを指定</button>
                            {canLiveStream && !editPid && (
                                <button type="button" onClick={() => setAudioType('live')} className={`pb-2 border-b-2 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap flex items-center gap-1 ${audioType === 'live' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-red-400 hover:text-red-600'}`}>
                                    <SatelliteDish size={14} />生配信 (SIGNAL CAST)
                                </button>
                            )}
                        </div>

                        {audioType === 'upload' && (
                            <div>
                                <p className="text-xs text-brand-500 mb-3">MP3形式などの音声ファイルを選択してください。（※上限: 30MB）</p>
                                <input type="file" accept="audio/mp3, audio/mpeg, audio/mp4, audio/m4a" onChange={handleAudioUpload} className="block w-full text-sm text-brand-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-[#b8860b] hover:file:bg-brand-100 file:border file:border-brand-200 file:cursor-pointer transition-colors bg-[#f7f5f0] p-2 rounded-sm border border-brand-200" />
                            </div>
                        )}

                        {audioType === 'url' && (
                            <div>
                                <p className="text-[10px] sm:text-xs text-brand-500 mb-2 leading-relaxed">
                                    <b>Spotify</b>, <b>Apple Podcasts</b>, <b>Google Drive</b> などのリンクを貼り付けると、自動で公式プレイヤーが埋め込まれます。または、直接再生可能な <code>.mp3</code> URLを入力してください。
                                </p>
                                <input type="url" value={audioUrlInput} onChange={e => { setAudioUrlInput(e.target.value); handleAudioUrlParse(e.target.value); }} className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm focus:bg-white transition-colors" placeholder="https://open.spotify.com/episode/..." />
                            </div>
                        )}

                        {(parsedAudioUrl && audioType !== 'live') && (
                            <div className="mt-4 bg-brand-50 p-4 rounded-sm border border-brand-200">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-brand-500 tracking-widest uppercase">Preview</p>
                                    <CheckCircle2 size={14} className="text-green-600" />
                                </div>
                                {!isEmbedMode ? (
                                    <audio ref={audioRef} controls src={parsedAudioUrl} onLoadedMetadata={handleAudioLoadedMetadata} className="w-full h-10"></audio>
                                ) : (
                                    <iframe src={parsedAudioUrl} className="w-full rounded-sm shadow-inner bg-white min-h-[160px]" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-sm border border-brand-200 shadow-sm relative overlow-hidden">
                        <label className="block text-sm font-bold text-brand-900 mb-2 tracking-widest flex items-center gap-2">
                            <ImageIcon className="text-[#b8860b] w-4 h-4" />サムネイル画像 <span className="text-[10px] text-brand-400 font-normal ml-1">(任意)</span>
                        </label>
                        <p className="text-xs text-brand-500 mb-4">設定しない場合は、NOAH CASTのデフォルト背景が適用されます。<br />※Spotify等の埋め込みリンクを使用する場合は設定不要です。</p>
                        <div className="flex flex-col items-center sm:flex-row gap-6">
                            <div className="relative w-full sm:w-64 aspect-video bg-brand-50 rounded-sm border-2 border-dashed border-brand-300 flex flex-col items-center justify-center text-brand-400 hover:bg-[#fffdf9] cursor-pointer overflow-hidden group shadow-inner">
                                <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                {thumbPreviewUrl ? (
                                    <img src={thumbPreviewUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="group-hover:scale-110 transition-transform flex flex-col items-center">
                                        <ImageIcon className="text-3xl mb-2 w-8 h-8" />
                                        <span className="text-xs tracking-widest font-bold">画像を選択</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-sm border border-brand-200 shadow-sm relative overlow-hidden space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-brand-900 mb-2 tracking-widest">配信タイトル <span className="text-red-500">*</span></label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm font-bold focus:bg-white transition-colors outline-none focus:border-[#b8860b]" placeholder="エピソードのタイトルを入力" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-brand-900 mb-2 tracking-widest">ゲスト <span className="text-[10px] text-brand-400 font-normal ml-1">(任意)</span></label>
                            <input type="text" value={guests} onChange={e => setGuests(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm focus:bg-white transition-colors outline-none focus:border-[#b8860b]" placeholder="ゲスト名（複数いる場合はカンマ区切り）" />
                        </div>

                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-2">
                                <label className="block text-sm font-bold text-brand-900 tracking-widest">概要欄・エピソードメモ</label>
                                <span className="text-[10px] bg-[#f7f5f0] text-brand-600 px-2 py-1 rounded-sm border border-brand-200 font-bold tracking-widest flex items-center gap-1 w-fit">Markdown対応</span>
                            </div>
                            <p className="text-xs text-brand-500 mb-3">このエピソードで話している内容や、関連リンクなどを記述してください。</p>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} className="w-full border border-brand-200 rounded-sm p-4 bg-[#f7f5f0] text-sm leading-relaxed focus:bg-white transition-colors outline-none focus:border-[#b8860b]" placeholder="・オープニング&#13;&#10;・今回のテーマについて&#13;&#10;・ゲストからのお知らせ"></textarea>
                        </div>

                        <div className="pt-2">
                            <label className="block text-sm font-bold text-brand-900 mb-2 tracking-widest flex items-center gap-2"><LinkIcon className="text-brand-400 w-4 h-4" />関連記事 (Note等) <span className="text-[10px] text-brand-400 font-normal ml-1">(任意)</span></label>
                            <p className="text-[10px] sm:text-xs text-brand-500 mb-2">noteの記事URL等を貼り付けます。複数ある場合は「, (カンマ)」で区切ってください。</p>
                            <input type="text" value={relatedArticleUrls} onChange={e => setRelatedArticleUrls(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm focus:bg-white transition-colors outline-none focus:border-[#b8860b]" placeholder="https://note.com/..., https://..." />
                        </div>
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-sm border border-brand-200 shadow-sm relative overlow-hidden space-y-8">
                        <div>
                            <label className="block text-sm font-bold text-brand-900 mb-3 tracking-widest">カテゴリー・タグ</label>
                            <p className="text-xs text-brand-500 mb-4">配信内容に合うものを選択してください。</p>
                            
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                {PRESET_TAGS.map(tag => (
                                    <label key={tag} className="cursor-pointer">
                                        <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} className="hidden" />
                                        <div className={`px-4 py-2 border text-xs font-bold rounded-sm tracking-widest transition-all shadow-sm whitespace-nowrap ${selectedTags.includes(tag) ? 'bg-[#3e2723] border-[#b8860b] text-[#d4af37]' : 'border-brand-200 text-brand-700 hover:bg-brand-50'}`}>{tag}</div>
                                    </label>
                                ))}
                            </div>
                            <input type="text" value={customTags} onChange={e => setCustomTags(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3 bg-[#f7f5f0] text-sm focus:bg-white transition-colors outline-none focus:border-[#b8860b]" placeholder="その他のタグ (カンマ区切りで入力)" />
                        </div>

                        {audioType !== 'live' && (
                            <div className="border-t border-brand-100 pt-6">
                                <label className="block text-sm font-bold text-brand-900 mb-4 tracking-widest">コメント機能の設定</label>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-700 bg-[#f7f5f0] border border-brand-200 px-4 py-2 rounded-sm hover:bg-white transition-colors">
                                        <input type="radio" checked={allowComments === true} onChange={() => setAllowComments(true)} className="text-[#b8860b] focus:ring-[#b8860b]" /> 許可する
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-700 bg-[#f7f5f0] border border-brand-200 px-4 py-2 rounded-sm hover:bg-white transition-colors">
                                        <input type="radio" checked={allowComments === false} onChange={() => setAllowComments(false)} className="text-brand-400 focus:ring-brand-400" /> 許可しない
                                    </label>
                                </div>
                            </div>
                        )}

                        {audioType === 'live' && (
                            <div className="border-t border-brand-100 pt-6">
                                <label className="block text-sm font-bold text-red-600 mb-4 tracking-widest flex items-center gap-2"><SatelliteDish className="animate-pulse w-4 h-4" />ライブ配信設定</label>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-800 mb-1.5 tracking-widest">公開範囲 <span className="text-red-500">*</span></label>
                                        <select value={livePrivacy} onChange={e => setLivePrivacy(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3 bg-white text-sm font-bold text-brand-700 focus:border-[#b8860b] focus:ring-[#b8860b] outline-none">
                                            <option value="public">🌍 公開（SETTLER以上）</option>
                                            <option value="followers">👥 フォロワー限定</option>
                                            <option value="invite">🔒 招待制（クローズド）</option>
                                            <option value="community">🏢 コミュニティ限定</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-800 mb-1.5 tracking-widest">ルーム種別 <span className="text-red-500">*</span></label>
                                        <select value={liveType} onChange={e => setLiveType(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3 bg-white text-sm font-bold text-brand-700 focus:border-[#b8860b] focus:ring-[#b8860b] outline-none">
                                            <option value="talk">💬 通常トーク</option>
                                            <option value="panel">🗣 パネルディスカッション</option>
                                            <option value="interview">🎤 インタビュー形式</option>
                                            <option value="music">🎵 音楽・ライブ形式</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-brand-50 p-4 border border-brand-200 rounded-sm">
                                    <label className="block text-xs font-bold text-brand-800 mb-3 tracking-widest">アーカイブ設定</label>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-xs font-bold text-brand-700 bg-white border border-brand-200 px-3 py-2.5 rounded-sm shadow-sm hover:bg-brand-50 transition-colors whitespace-nowrap">
                                            <input type="radio" checked={liveRecord === true} onChange={() => { setLiveRecord(true); alert("【重要確認】\n配信の自動録音機能はありません。\n\n必ずご自身のボイスレコーダー等で録音を行い、配信終了後にマイページから音声ファイルをアップロードしてください。"); }} className="text-[#b8860b] focus:ring-[#b8860b]" /> 録音して残す
                                        </label>
                                        <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-xs font-bold text-brand-700 bg-white border border-brand-200 px-3 py-2.5 rounded-sm shadow-sm hover:bg-brand-50 transition-colors whitespace-nowrap">
                                            <input type="radio" checked={liveRecord === false} onChange={() => setLiveRecord(false)} className="text-[#b8860b] focus:ring-[#b8860b]" /> 録音しない
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-brand-500 mt-2 text-center sm:text-left">※「録音して残す」を選択すると、配信終了後に自動でポッドキャスト枠が作成されます。</p>
                                    
                                    {liveRecord && (
                                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-sm text-red-600 text-[10px] sm:text-xs leading-relaxed shadow-inner">
                                            <span className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={12} />【重要】自動録音機能はありません</span>
                                            システム側での録音は行われません。必ずご自身の端末（スマホのボイスレコーダー等）で別途録音を行ってください。<br />
                                            配信終了後に作成される「ポッドキャスト枠」の編集画面から、録音した音声ファイルをアップロードできます。
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="bg-red-50/30 border border-red-300 p-6 sm:p-8 rounded-sm space-y-4">
                            <h3 className="text-sm font-bold text-red-600 mb-1 tracking-widest flex items-center gap-2"><Crown size={16} />【管理者機能】 代理投稿</h3>
                            <p className="text-xs text-brand-600 mb-3">他のユーザーとして投稿する場合、そのユーザーの「希望ユーザーID（@以降の英数字）」を入力してください。<br />※空欄の場合はあなた自身として投稿されます。</p>
                            <input type="text" value={overrideUserId} onChange={e => setOverrideUserId(e.target.value)} className="w-full border border-red-200 rounded-sm p-3.5 bg-[#fffdf9] text-sm focus:border-red-500 focus:ring-red-500 transition-colors outline-none" placeholder="例: taro_123" />
                        </div>
                    )}

                    <div className="pb-12 pt-6">
                        <button type="submit" disabled={isSaving} className={`w-full py-4 font-bold text-lg rounded-sm transition-all shadow-xl tracking-widest border flex items-center justify-center gap-3 transform hover:-translate-y-0.5 ${audioType === 'live' ? 'bg-gradient-to-r from-[#3e2723] to-red-900 text-white border-red-600 hover:from-[#2a1a17] hover:to-red-800' : 'bg-gradient-to-r from-[#2a1a17] to-[#3e2723] text-[#d4af37] border-[#b8860b] hover:from-[#1a110f] hover:to-[#2a1a17]'}`}>
                            {audioType === 'live' ? (
                                <><SatelliteDish className="animate-pulse w-6 h-6" /> ライブ配信を START する</>
                            ) : editPid ? (
                                <><CloudUpload className="w-6 h-6" /> 編集を保存する</>
                            ) : (
                                <><Podcast className="w-6 h-6" /> 音声を配信する</>
                            )}
                        </button>
                    </div>
                </form>
            </main>

            {isSaving && (
                <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
                    <div className="bg-[#fffdf9] p-8 rounded-sm shadow-2xl border border-brand-300 text-center max-w-sm w-full">
                        <CloudUpload className="text-4xl text-[#b8860b] mb-4 w-12 h-12 mx-auto animate-bounce" />
                        <h3 className="text-lg font-bold text-brand-900 font-serif tracking-widest mb-2">アップロード中...</h3>
                        <p className="text-xs text-brand-500 mb-4 tracking-widest">{progressText}</p>
                        <div className="w-full bg-brand-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-[#b8860b] h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
