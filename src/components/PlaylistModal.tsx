import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { X, Search, Plus, Save, Trash2, Mic, Play, FolderOpen, Check } from 'lucide-react';

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
    const [coverUrl, setCoverUrl] = useState('');
    const [filterType, setFilterType] = useState<'video'|'podcast'>('video');
    const [availableMedia, setAvailableMedia] = useState<MediaItem[]>([]);
    const [playlistItems, setPlaylistItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setCoverUrl('');
        setFilterType('video');
        setPlaylistItems([]);

        const fetchAvailableMedia = async () => {
            setLoading(true);
            try {
                // Fetch user's videos
                const vQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'), where('authorId', '==', userId));
                const vSnap = await getDocs(vQ);
                const videos = vSnap.docs.map(d => ({
                    id: d.id,
                    type: 'video' as const,
                    title: d.data().title || '',
                    thumbnailUrl: d.data().thumbnailUrl || '',
                    createdAt: new Date(d.data().createdAt || 0).getTime()
                }));

                // Fetch user's podcasts
                const pQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'), where('authorId', '==', userId));
                const pSnap = await getDocs(pQ);
                const podcasts = pSnap.docs.map(d => ({
                    id: d.id,
                    type: 'podcast' as const,
                    title: d.data().title || '',
                    thumbnailUrl: d.data().thumbnailUrl || '',
                    createdAt: new Date(d.data().createdAt || 0).getTime()
                }));

                const allItems = [...videos, ...podcasts].sort((a,b) => b.createdAt - a.createdAt);
                setAvailableMedia(allItems);

                if (playlistId) {
                    // editing existing
                    // Here we'd fetch the exact playlist and fill name, coverUrl, playlistItems...
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
            const payload = {
                name: name.trim(),
                coverImageUrl: coverUrl.trim(),
                items: playlistItems,
                authorId: userId,
                updatedAt: serverTimestamp(),
                createdAt: playlistId ? undefined : serverTimestamp(),
            };
            
            // Wait, what's undefined is ignored by setDoc if merge is false, but we use merge:true
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'playlists', pid), payload, { merge: true });
            if (onSaved) onSaved();
            onClose();
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[#fffdf9] w-full max-w-4xl max-h-[90vh] rounded-md shadow-2xl relative flex flex-col overflow-hidden border border-brand-200 animate-scale-in">
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-6 border-b border-brand-200 bg-[#fdfaf5]">
                    <h2 className="text-lg font-bold text-brand-900 font-serif tracking-widest flex items-center gap-2">
                        {playlistId ? <FolderOpen className="text-[#b8860b]" size={20} /> : <Plus className="text-[#b8860b]" size={20} />}
                        {playlistId ? 'プレイリスト編集' : 'プレイリスト作成'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-brand-400 hover:text-brand-900 hover:bg-brand-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body Content */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    
                    {/* Left: Input details */}
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-brand-200 p-6 bg-texture overflow-y-auto">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-brand-700 tracking-widest mb-2 font-serif">プレイリスト名 <span className="text-red-500">*</span></label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: お気に入り動画" className="w-full bg-[#fdfaf5] border border-brand-300 rounded-sm px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-serif" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-700 tracking-widest mb-2 font-serif">カバー画像URL (任意)</label>
                                <input type="text" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." className="w-full bg-[#fdfaf5] border border-brand-300 rounded-sm px-4 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-xs" />
                                {coverUrl && (
                                    <div className="mt-3 aspect-video bg-black rounded-sm overflow-hidden border border-brand-200 relative">
                                        <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" onError={() => setCoverUrl('')} />
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 mt-6 border-t border-brand-200 space-y-4">
                                <div className="text-sm font-bold text-brand-700 font-serif tracking-widest">現在の項目 ({playlistItems.length})</div>
                                {playlistItems.length === 0 ? (
                                    <div className="text-xs text-brand-400 italic">右のリストからコンテンツを選択してください</div>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {playlistItems.map(item => (
                                            <div key={item.id} className="flex items-center gap-2 bg-[#fffdf9] p-2 rounded-sm border border-brand-200">
                                                <div className="w-8 h-8 rounded-sm bg-black overflow-hidden flex-shrink-0 relative">
                                                    <img src={item.thumbnailUrl || 'https://via.placeholder.com/80x80'} className="w-full h-full object-cover opacity-80" />
                                                </div>
                                                <div className="text-xs font-bold text-brand-800 line-clamp-1 flex-1">{item.title}</div>
                                                <button onClick={() => toggleItem(item)} className="p-1 text-red-500 hover:bg-red-50 rounded-sm"><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Selectable Media */}
                    <div className="w-full md:w-2/3 flex flex-col bg-[#fffdf9] p-6 min-h-0">
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setFilterType('video')} className={`flex-1 py-2 text-xs font-bold tracking-widest rounded-sm border transition-all ${filterType === 'video' ? 'bg-[#b8860b] text-[#fffdf9] border-[#b8860b]' : 'bg-[#f7f5f0] text-brand-600 border-brand-200 hover:bg-[#fffdf9]'}`}>
                                動画から選択
                            </button>
                            <button onClick={() => setFilterType('podcast')} className={`flex-1 py-2 text-xs font-bold tracking-widest rounded-sm border transition-all ${filterType === 'podcast' ? 'bg-[#b8860b] text-[#fffdf9] border-[#b8860b]' : 'bg-[#f7f5f0] text-brand-600 border-brand-200 hover:bg-[#fffdf9]'}`}>
                                音声から選択
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {loading ? (
                                <div className="text-center py-10 text-brand-400 font-bold tracking-widest text-sm">読み込み中...</div>
                            ) : availableMedia.filter(m => m.type === filterType).length === 0 ? (
                                <div className="text-center py-10 text-brand-400 font-bold tracking-widest text-sm border border-dashed border-brand-200 rounded-sm bg-brand-50/50">
                                    選択可能なコンテンツがありません
                                </div>
                            ) : (
                                availableMedia.filter(m => m.type === filterType).map(item => {
                                    const isSelected = playlistItems.some(p => p.id === item.id);
                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleItem(item)}
                                            className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-all ${isSelected ? 'border-[#b8860b] bg-[#fdfaf5]' : 'border-brand-200 hover:border-[#b8860b] hover:bg-[#fffdf9]'} group`}
                                        >
                                            <div className="w-16 h-12 bg-black rounded-sm overflow-hidden flex-shrink-0 relative border border-brand-200">
                                                <img src={item.thumbnailUrl || 'https://via.placeholder.com/160x120'} className="w-full h-full object-cover opacity-80" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-bold line-clamp-1 font-serif ${isSelected ? 'text-brand-900' : 'text-brand-700'}`}>{item.title}</h4>
                                                <div className="text-[10px] text-brand-400 font-mono mt-1">{new Date(item.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <div className="flex-shrink-0 pl-2">
                                                {isSelected ? (
                                                    <div className="w-6 h-6 rounded-full bg-[#b8860b] text-white flex items-center justify-center shadow-sm">
                                                        <Check size={14} className="ml-px" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-brand-300 text-brand-300 group-hover:border-[#b8860b] group-hover:text-[#b8860b] flex items-center justify-center transition-colors">
                                                        <Plus size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="h-16 border-t border-brand-200 bg-[#fdfaf5] flex justify-end items-center px-6 gap-3">
                    <button onClick={onClose} disabled={saving} className="px-6 py-2 border border-brand-300 bg-[#fffdf9] text-brand-700 hover:bg-brand-50 rounded-sm text-sm font-bold shadow-sm tracking-widest disabled:opacity-50">キャンセル</button>
                    <button onClick={handleSave} disabled={saving || !name.trim()} className="px-6 py-2 bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] border border-[#b8860b] rounded-sm text-sm font-bold shadow-md tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={16} /> {saving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
