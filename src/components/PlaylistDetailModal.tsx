import React from 'react';
import { X, Play, Edit3, ListMusic, ListVideo } from 'lucide-react';
import Link from 'next/link';

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
    coverImageUrl?: string;
    items?: MediaItem[];
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

    const coverUrl = playlist.coverImageUrl || (playlist.items && playlist.items.length > 0 && playlist.items[0].thumbnailUrl) || 'https://via.placeholder.com/640x360?text=No+Cover';
    const itemCount = playlist.items?.length || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[#fffdf9] w-full max-w-3xl max-h-[90vh] rounded-md shadow-2xl relative flex flex-col overflow-hidden border border-brand-200 animate-scale-in">
                
                {/* Header Actions */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                    {canEdit && (
                        <button onClick={() => { onClose(); onEdit(); }} className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-md" title="編集">
                            <Edit3 size={16} />
                        </button>
                    )}
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-md">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row min-h-0">
                    
                    {/* Left/Top: Playlist Info block */}
                    <div className="w-full md:w-[320px] bg-texture flex-shrink-0 p-6 md:border-r border-brand-200 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <img src={coverUrl} className="w-full h-full object-cover blur-3xl scale-110" alt="background blur" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="w-full aspect-video md:aspect-square bg-black rounded-sm shadow-xl overflow-hidden border border-brand-200/50 mb-6 group relative">
                                <img src={coverUrl} className="w-full h-full object-cover" alt="Playlist Cover" />
                                {itemCount > 0 && (
                                    <Link href={`/media/${playlist.items![0].type}s/detail?id=${playlist.items![0].id}`} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-12 h-12 bg-[#b8860b] rounded-full flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                                            <Play size={20} className="ml-1" />
                                        </div>
                                    </Link>
                                )}
                            </div>
                            
                            <h2 className="text-xl font-bold text-brand-900 font-serif leading-tight mb-2">{playlist.name}</h2>
                            <p className="text-sm text-brand-500 font-bold mb-4 font-serif">プレイリスト • {itemCount} 本</p>
                            
                            {itemCount > 0 && (
                                <Link 
                                    href={`/media/${playlist.items![0].type}s/detail?id=${playlist.items![0].id}`}
                                    className="w-full py-3 bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] border border-[#b8860b] rounded-sm text-sm font-bold shadow-md tracking-widest transition-colors flex items-center justify-center gap-2 mt-auto"
                                >
                                    <Play size={16} fill="currentColor" /> すべて再生
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Right/Bottom: Playlist Items */}
                    <div className="flex-1 bg-[#fffdf9] flex flex-col min-h-0">
                        <div className="p-4 border-b border-brand-100 bg-[#fdfaf5] sticky top-0 z-10 shadow-sm">
                            <h3 className="text-sm font-bold text-brand-800 tracking-widest font-serif">コンテンツ一覧</h3>
                        </div>
                        <div className="flex-1 p-2 md:p-4 overflow-y-auto custom-scrollbar">
                            {itemCount === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-brand-400 py-12">
                                    <ListVideo className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-bold tracking-widest">アイテムがありません</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {playlist.items!.map((item, index) => (
                                        <Link 
                                            href={`/media/${item.type}s/detail?id=${item.id}`} 
                                            key={`${item.id}-${index}`}
                                            className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-sm hover:bg-[#f7f5f0] transition-colors group cursor-pointer border border-transparent hover:border-brand-200"
                                            onClick={onClose}
                                        >
                                            <div className="text-brand-300 font-bold font-mono text-xs w-5 text-center flex-shrink-0 group-hover:text-brand-500 transition-colors">
                                                {index + 1}
                                            </div>
                                            <div className="w-24 md:w-32 aspect-video bg-black rounded-sm overflow-hidden flex-shrink-0 relative border border-brand-200/50 shadow-sm">
                                                <img src={item.thumbnailUrl || 'https://via.placeholder.com/160x120?text=No+Image'} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play size={16} className="text-white drop-shadow-md" fill="white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="text-sm font-bold text-brand-800 line-clamp-2 md:line-clamp-1 group-hover:text-[#b8860b] transition-colors leading-snug">{item.title}</h4>
                                                <div className="flex items-center gap-2 mt-1.5 opacity-70">
                                                    {item.type === 'video' ? <ListVideo size={10} className="text-brand-500"/> : <ListMusic size={10} className="text-brand-500"/>}
                                                    <span className="text-[10px] text-brand-500 font-medium tracking-widest">{item.type.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
