'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Film, Video, Image as ImageIcon, Tags, MessageSquare, Crown, CloudUpload } from 'lucide-react';

function VideoPostContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editVid = searchParams.get('vid');

    const [isAdmin, setIsAdmin] = useState(false);
    const [myData, setMyData] = useState<any>(null);

    const [videoInputType, setVideoInputType] = useState<'url' | 'upload'>('url');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
    const [isEmbedMode, setIsEmbedMode] = useState(false);

    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');

    const [allowComments, setAllowComments] = useState(true);
    const [overrideUserId, setOverrideUserId] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const presetTags = [
        { label: 'ピッチ・資金調達', value: 'ピッチ・資金調達' },
        { label: 'パートナー募集', value: 'ビジネスパートナー募集' },
        { label: 'PR・宣伝', value: 'PR・宣伝' },
        { label: '活動記録', value: '活動記録' },
        { label: 'ノウハウ共有', value: 'ノウハウ共有' }
    ];

    useEffect(() => {
        if (loading) return;

        if (user && !user.isAnonymous) {
            getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'))
                .then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setMyData(data);
                        if (data.userId === 'admin') setIsAdmin(true);
                        
                        const rank = data.membershipRank || 'arrival';
                        if (rank === 'arrival' && data.userId !== 'admin') {
                            alert("動画の投稿はSETTLER以上の会員のみ可能です。");
                            router.push('/');
                        }
                    }
                });

            if (editVid) loadEditData();
        } else {
            router.push('/login');
        }
    }, [user, loading, editVid, router]);

    const loadEditData = async () => {
        if (!user || !editVid) return;
        try {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', editVid));
            if (snap.exists()) {
                const data = snap.data();
                if (data.authorId !== user.uid && !isAdmin) {
                    alert("編集権限がありません");
                    router.push('/media/videos');
                    return;
                }

                setTitle(data.title || '');
                setDescription(data.description || '');

                if (data.sourceType === 'url' || data.embedUrl) {
                    setVideoInputType('url');
                    setVideoUrl(data.sourceUrl || data.embedUrl || '');
                    handleUrlPreview(data.sourceUrl || data.embedUrl);
                } else {
                    setVideoInputType('upload');
                    setVideoPreviewUrl(data.sourceUrl || '');
                    setIsEmbedMode(false);
                }

                if (data.thumbnailUrl) {
                    setThumbPreviewUrl(data.thumbnailUrl);
                }

                setAllowComments(data.allowComments !== false);

                const tags = data.tags || [];
                const presetValues = presetTags.map(p => p.value);
                setSelectedTags(tags.filter((t: string) => presetValues.includes(t)));
                setCustomTags(tags.filter((t: string) => !presetValues.includes(t)).join(', '));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const parseVideoUrl = (url: string) => {
        let embedUrl = null;
        let isEmbed = false;
        let tUrl = null;

        if (!url) return { isEmbed: false, url: '', thumbUrl: null };

        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
        if (ytMatch && ytMatch[1]) {
            embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            tUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
            isEmbed = true;
        } else if (url.includes('vimeo.com')) {
            const vimeoMatch = url.match(/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i);
            if (vimeoMatch && vimeoMatch[1]) {
                embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                isEmbed = true;
            }
        } else if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (match) {
                embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                isEmbed = true;
            }
        }

        return { isEmbed, url: isEmbed ? embedUrl : url, thumbUrl: tUrl };
    };

    const handleUrlPreview = (url: string) => {
        setVideoUrl(url);
        if (url) {
            const parsed = parseVideoUrl(url);
            setVideoPreviewUrl(parsed.url || '');
            setIsEmbedMode(parsed.isEmbed);
            if (parsed.thumbUrl && !thumbFile && !thumbPreviewUrl) {
                setThumbPreviewUrl(parsed.thumbUrl);
            }
        } else {
            setVideoPreviewUrl('');
            setIsEmbedMode(false);
        }
    };

    const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setVideoPreviewUrl(URL.createObjectURL(file));
            setIsEmbedMode(false);
        }
    };

    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbFile(file);
            setThumbPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleTagToggle = (tagValue: string) => {
        if (selectedTags.includes(tagValue)) {
            setSelectedTags(selectedTags.filter(t => t !== tagValue));
        } else {
            setSelectedTags([...selectedTags, tagValue]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        let finalVideoUrl = '';
        let finalThumbUrl = '';
        let finalEmbedUrl = '';

        if (!editVid) {
            if (videoInputType === 'upload' && !videoFile) return alert('動画ファイルを選択してください');
            if (videoInputType === 'url' && !videoUrl.trim()) return alert('動画のURLを入力してください');
        }

        if (videoInputType === 'upload' && videoFile) {
            if (videoFile.size > 100 * 1024 * 1024) return alert('動画ファイルが大きすぎます (上限100MB)');
        }
        if (thumbFile) {
            if (thumbFile.size > 5 * 1024 * 1024) return alert('画像サイズが大きすぎます (上限5MB)');
        }

        setIsSaving(true);
        setUploadProgress(5);
        setProgressText('アップロードの準備中...');

        try {
            if (videoInputType === 'upload' && videoFile) {
                const storageRef = ref(storage, `videos/video/${user.uid}/${Date.now()}_${videoFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, videoFile);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75;
                            setUploadProgress(5 + p);
                            setProgressText(`動画をアップロード中... (${Math.floor(5 + p)}%)`);
                        },
                        (error) => reject(new Error(`動画のアップロードに失敗: ${error.message}`)),
                        async () => {
                            try {
                                finalVideoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch (err) {
                                reject(new Error("動画URLの取得に失敗しました"));
                            }
                        }
                    );
                });
            } else if (videoInputType === 'url') {
                const rawUrl = videoUrl.trim();
                const parsed = parseVideoUrl(rawUrl);
                finalVideoUrl = rawUrl;
                finalEmbedUrl = parsed.url || '';
                setIsEmbedMode(parsed.isEmbed);
                if (!thumbFile && parsed.thumbUrl) {
                    finalThumbUrl = parsed.thumbUrl;
                }
            }

            if (thumbFile) {
                setUploadProgress(80);
                setProgressText('画像をアップロード中...');
                const thumbRef = ref(storage, `videos/thumbnails/${user.uid}/${Date.now()}_${thumbFile.name}`);
                const snap = await uploadBytes(thumbRef, thumbFile);
                finalThumbUrl = await getDownloadURL(snap.ref);
                setUploadProgress(95);
            }

            if (editVid) {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', editVid));
                if (snap.exists()) {
                    const oldData = snap.data();
                    if (!finalVideoUrl && !finalEmbedUrl) {
                        finalVideoUrl = oldData.sourceUrl || '';
                        finalEmbedUrl = oldData.embedUrl || '';
                        setIsEmbedMode(!!oldData.embedUrl);
                    }
                    if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl || '';
                }
            }

            setUploadProgress(100);
            setProgressText('データを保存しています...');

            let finalAuthorId = user.uid;
            let finalAuthorName = myData ? (myData.name || myData.userId) : '名無し';
            let finalAuthorIcon = myData?.photoURL || null;

            if (isAdmin && overrideUserId) {
                const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                const q = query(usersRef, where("userId", "==", overrideUserId.trim()));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setIsSaving(false);
                    return alert(`エラー: 指定されたユーザーID「@${overrideUserId}」は見つかりませんでした。`);
                }

                const targetDoc = querySnapshot.docs[0];
                finalAuthorId = targetDoc.id;
                const tData = targetDoc.data();
                finalAuthorName = tData.name || tData.userId;
                finalAuthorIcon = tData.photoURL || null;
            }

            const cTags = customTags.split(',').map(t => t.trim()).filter(Boolean);
            const tags = Array.from(new Set([...selectedTags, ...cTags]));

            const docId = editVid || Date.now().toString();
            const videoDataPayload = {
                authorId: finalAuthorId,
                authorName: finalAuthorName,
                authorIcon: finalAuthorIcon,
                sourceType: videoInputType,
                sourceUrl: finalVideoUrl,
                embedUrl: isEmbedMode ? finalEmbedUrl : '',
                thumbnailUrl: finalThumbUrl || null,
                title,
                description,
                tags,
                allowComments,
                updatedAt: new Date().toISOString(),
                ...(!editVid && { createdAt: new Date().toISOString() })
            };

            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', docId), videoDataPayload, { merge: true });

            if (!editVid) {
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                    const notifyPromises = followersSnap.docs.map(fDoc => {
                        return addDoc(collection(db, 'artifacts', APP_ID, 'users', fDoc.id, 'notifications'), {
                            type: 'new_video',
                            fromUid: finalAuthorId,
                            contentId: docId,
                            createdAt: serverTimestamp(),
                            isRead: false
                        });
                    });
                    await Promise.all(notifyPromises);
                } catch (err) {
                    console.error("Notifications err:", err);
                }
            }

            router.push(`/media/videos/${docId}`);

        } catch (error: any) {
            console.error(error);
            alert(`保存中にエラーが発生しました。\n${error.message}`);
            setIsSaving(false);
        }
    };

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
                        <Film className="text-[#b8860b]" /> 動画の投稿・編集
                    </h1>
                    <div className="w-20"></div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6">
                <div className="mb-8 text-center">
                    <p className="text-sm text-brand-600 tracking-widest leading-relaxed">
                        あなたの活動やPRを動画で届けましょう。<br />
                        <span className="text-xs text-brand-400">※動画ファイルのアップロード、またはYouTube等のURL指定が可能です。</span>
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-8">

                    {/* Video Input */}
                    <div className="bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm">
                        <label className="flex items-center text-sm font-bold text-brand-900 mb-4 tracking-widest"><Video className="text-[#b8860b] mr-2" size={16} />動画データ <span className="text-red-500 ml-1">*</span></label>
                        
                        <div className="flex gap-6 mb-4 border-b border-brand-200">
                            <button type="button" onClick={() => setVideoInputType('url')} className={`pb-2 border-b-2 text-sm tracking-widest transition-colors ${videoInputType === 'url' ? 'border-brand-600 text-brand-900 font-bold' : 'border-transparent text-brand-400 hover:text-brand-600'}`}>URLを指定</button>
                            <button type="button" onClick={() => setVideoInputType('upload')} className={`pb-2 border-b-2 text-sm tracking-widest transition-colors flex items-center gap-1.5 ${videoInputType === 'upload' ? 'border-brand-600 text-brand-900 font-bold' : 'border-transparent text-brand-400 hover:text-brand-600'}`}>
                                ファイルをアップロード {(!isAdmin) && <span className="text-[9px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">準備中</span>}
                            </button>
                        </div>

                        {videoInputType === 'url' ? (
                            <div>
                                <p className="text-[10px] sm:text-xs text-brand-500 mb-2 leading-relaxed">
                                    <b>YouTube</b>, <b>Vimeo</b>, <b>Google Drive</b> などのリンクを貼り付けると自動で公式プレイヤーが埋め込まれます。
                                </p>
                                <input type="url" value={videoUrl} onChange={e => handleUrlPreview(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm focus:bg-white transition-colors" placeholder="https://www.youtube.com/watch?v=..." />
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs text-brand-500 mb-3">MP4形式などの動画ファイルを選択してください。（※上限: 100MB）</p>
                                <input type="file" accept="video/mp4, video/webm, video/quicktime" onChange={handleVideoFileUpload} className="block w-full text-sm text-brand-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-[#b8860b] hover:file:bg-brand-100 file:border file:border-brand-200 file:cursor-pointer transition-colors bg-[#f7f5f0] p-2 rounded-sm border border-brand-200" />
                            </div>
                        )}

                        {videoPreviewUrl && (
                            <div className="mt-4 bg-brand-50 p-4 rounded-sm border border-brand-200">
                                <p className="text-[10px] font-bold text-brand-500 tracking-widest uppercase mb-2">Preview</p>
                                {isEmbedMode ? (
                                    <iframe src={videoPreviewUrl} className="w-full rounded-sm shadow-inner bg-black aspect-video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                ) : (
                                    <video src={videoPreviewUrl} controls className="w-full rounded-sm bg-black max-h-64"></video>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Thumbnail Input */}
                    <div className="bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm">
                        <label className="flex items-center text-sm font-bold text-brand-900 mb-2 tracking-widest"><ImageIcon className="text-[#b8860b] mr-2" size={16} />サムネイル画像 <span className="text-[10px] text-brand-400 font-normal ml-1">(任意)</span></label>
                        <p className="text-xs text-brand-500 mb-4">設定しない場合はデフォルト背景が適用されます。<br />YouTube等のリンクを使用する場合は自動で画像が取得されます。</p>
                        <div className="flex flex-col items-center sm:flex-row gap-6">
                            <label className="relative w-full sm:w-64 aspect-video bg-brand-50 rounded-sm border-2 border-dashed border-brand-300 flex flex-col items-center justify-center text-brand-400 hover:bg-[#fffdf9] cursor-pointer overflow-hidden group shadow-inner">
                                <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                {thumbPreviewUrl ? (
                                    <img src={thumbPreviewUrl} className="absolute inset-0 w-full h-full object-cover" alt="Thumbnail Preview" />
                                ) : (
                                    <div className="group-hover:scale-110 transition-transform flex flex-col items-center">
                                        <ImageIcon className="text-3xl mb-2" />
                                        <span className="text-xs tracking-widest font-bold">画像を選択</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Text Inputs */}
                    <div className="bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-brand-900 mb-2 tracking-widest">動画タイトル <span className="text-red-500">*</span></label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full border border-brand-200 rounded-sm p-3.5 bg-[#f7f5f0] text-sm font-bold focus:bg-white transition-colors" placeholder="動画のタイトルを入力" />
                        </div>

                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-2">
                                <label className="block text-sm font-bold text-brand-900 tracking-widest">概要欄・説明</label>
                                <span className="text-[10px] bg-[#f7f5f0] text-brand-600 px-2 py-1 rounded-sm border border-brand-200 font-bold tracking-widest flex items-center gap-1 w-fit">Markdown対応</span>
                            </div>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} className="w-full border border-brand-200 rounded-sm p-4 bg-[#f7f5f0] text-sm leading-relaxed focus:bg-white transition-colors" placeholder="・動画の概要&#13;&#10;・今回のテーマについて&#13;&#10;・関連リンク集"></textarea>
                        </div>
                    </div>

                    {/* Tags and Settings */}
                    <div className="bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm space-y-8">
                        <div>
                            <label className="flex items-center text-sm font-bold text-brand-900 mb-3 tracking-widest"><Tags className="text-brand-400 mr-2" size={16} />カテゴリー・タグ</label>
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                {presetTags.map(tag => (
                                    <label key={tag.value} className="cursor-pointer">
                                        <input type="checkbox" checked={selectedTags.includes(tag.value)} onChange={() => handleTagToggle(tag.value)} className="hidden" />
                                        <div className={`px-4 py-2 border text-xs font-bold rounded-sm tracking-widest transition-all shadow-sm ${selectedTags.includes(tag.value) ? 'bg-brand-100 border-brand-300 text-brand-800' : 'bg-white border-brand-200 text-brand-700 hover:bg-brand-50'}`}>
                                            {tag.label}
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <input type="text" value={customTags} onChange={e => setCustomTags(e.target.value)} className="w-full border border-brand-200 rounded-sm p-3 bg-[#f7f5f0] text-sm focus:bg-white transition-colors" placeholder="その他のタグ (カンマ区切りで入力)" />
                        </div>

                        <div className="border-t border-brand-100 pt-6">
                            <label className="flex items-center text-sm font-bold text-brand-900 mb-4 tracking-widest"><MessageSquare className="text-brand-400 mr-2" size={16} />コメント機能の設定</label>
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-700 bg-[#f7f5f0] border border-brand-200 px-4 py-2 rounded-sm hover:bg-white transition-colors">
                                    <input type="radio" checked={allowComments} onChange={() => setAllowComments(true)} className="text-[#b8860b] focus:ring-[#b8860b]" /> 許可する
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-700 bg-[#f7f5f0] border border-brand-200 px-4 py-2 rounded-sm hover:bg-white transition-colors">
                                    <input type="radio" checked={!allowComments} onChange={() => setAllowComments(false)} className="text-brand-400 focus:ring-brand-400" /> 許可しない
                                </label>
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="bg-red-50/30 border border-red-300 rounded-sm p-6 relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-sm"></div>
                            <h3 className="flex items-center text-sm font-bold text-red-600 mb-1 tracking-widest"><Crown className="mr-2" size={16} />【管理者機能】 代理投稿</h3>
                            <p className="text-xs text-brand-600 mb-3">他のユーザーとして投稿する場合、そのユーザーの「希望ユーザーID（@以降の英数字）」を入力してください。<br />※空欄の場合はあなた自身として投稿されます。</p>
                            <input type="text" value={overrideUserId} onChange={e => setOverrideUserId(e.target.value)} className="w-full border border-red-200 rounded-sm p-3.5 bg-[#fffdf9] text-sm focus:border-red-500 focus:ring-red-500 transition-colors" placeholder="例: taro_123" />
                        </div>
                    )}

                    <div className="pb-12 pt-6">
                        <button type="submit" disabled={isSaving} className="w-full py-4 bg-gradient-to-r from-[#3e2723] to-[#2a1a17] text-[#d4af37] font-bold text-lg rounded-sm hover:from-[#2a1a17] hover:to-[#1a110f] transition-all shadow-xl tracking-widest border border-[#b8860b] flex items-center justify-center gap-3 transform hover:-translate-y-0.5 disabled:opacity-50">
                            <CloudUpload size={24} /> {editVid ? '編集を保存する' : '動画を公開する'}
                        </button>
                    </div>

                </form>
            </main>

            {isSaving && (
                <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-[#fffdf9] p-8 rounded-sm shadow-2xl border border-brand-300 text-center max-w-sm w-full mx-4">
                        <CloudUpload className="mx-auto w-10 h-10 text-[#b8860b] mb-4 animate-bounce" />
                        <h3 className="text-lg font-bold text-brand-900 font-serif tracking-widest mb-2">アップロード中...</h3>
                        <p className="text-xs text-brand-500 mb-4 tracking-widest">{progressText || 'しばらくお待ちください'}</p>
                        <div className="w-full bg-brand-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-[#b8860b] h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VideoPostPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#b8860b]"></div></div>}>
            <VideoPostContent />
        </Suspense>
    );
}
