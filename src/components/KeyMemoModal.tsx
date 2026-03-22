'use client';

import React, { useState, useEffect } from 'react';
import { Key, X, Pen, Trash2 } from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface MemoEntry {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

interface KeyMemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserId: string;
    targetUserId: string;
    targetUserName: string;
}

export default function KeyMemoModal({ isOpen, onClose, currentUserId, targetUserId, targetUserName }: KeyMemoModalProps) {
    const [memos, setMemos] = useState<MemoEntry[]>([]);
    const [newMemo, setNewMemo] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchMemos = async () => {
            setIsLoading(true);
            try {
                const memoRef = doc(db, 'artifacts', APP_ID, 'users', currentUserId, 'private_memos', targetUserId);
                const snap = await getDoc(memoRef);
                if (snap.exists() && snap.data().logs) {
                    setMemos(snap.data().logs);
                } else {
                    setMemos([]);
                }
            } catch (error) {
                console.error("Error fetching private memos:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMemos();
    }, [isOpen, currentUserId, targetUserId]);

    const saveMemosToDB = async (updatedMemos: MemoEntry[]) => {
        const memoRef = doc(db, 'artifacts', APP_ID, 'users', currentUserId, 'private_memos', targetUserId);
        await setDoc(memoRef, { logs: updatedMemos }, { merge: true });
        setMemos(updatedMemos);
    };

    const handleAddMemo = async () => {
        if (!newMemo.trim()) return;
        
        const newEntry: MemoEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            content: newMemo,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updatedMemos = [...memos, newEntry];
        await saveMemosToDB(updatedMemos);
        setNewMemo('');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('このメモを削除してもよろしいですか？')) return;
        const updatedMemos = memos.filter(m => m.id !== id);
        await saveMemosToDB(updatedMemos);
    };

    const startEdit = (memo: MemoEntry) => {
        setEditingId(memo.id);
        setEditContent(memo.content);
    };

    const saveEdit = async (id: string) => {
        if (!editContent.trim()) return;
        const updatedMemos = memos.map(m => {
            if (m.id === id) {
                return { ...m, content: editContent, updatedAt: new Date().toISOString() };
            }
            return m;
        });
        await saveMemosToDB(updatedMemos);
        setEditingId(null);
    };

    if (!isOpen) return null;

    const sortedMemos = [...memos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return (
        <div className="fixed inset-0 z-[6000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#fffdf9] bg-texture w-full max-w-lg rounded-md shadow-2xl flex flex-col border border-brand-300 transform transition-all animate-fade-in-up">
                <div className="p-4 sm:p-5 border-b border-brand-200 flex justify-between items-center bg-[#fffdf9] rounded-t-md">
                    <h3 className="font-bold text-brand-900 font-serif tracking-widest flex items-center">
                        <Key className="text-[#8b6a4f] mr-2" size={18} />
                        鍵メモ <span className="text-xs font-sans text-brand-500 ml-2 font-normal">({targetUserName}さん)</span>
                    </h3>
                    <button onClick={onClose} className="text-brand-400 hover:text-brand-700 transition-colors w-8 h-8 flex items-center justify-center rounded-sm bg-brand-50 border border-brand-100">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div className="mb-6">
                        <textarea 
                            value={newMemo}
                            onChange={(e) => setNewMemo(e.target.value)}
                            rows={3} 
                            className="w-full border border-brand-300 rounded-sm text-sm p-3 bg-white leading-relaxed focus:ring-brand-500 shadow-sm placeholder-brand-300 outline-none" 
                            placeholder="例：2/25の名古屋のイベントで挨拶。Webデザインに興味があるとのこと。"
                        ></textarea>
                        <div className="flex justify-end mt-2">
                            <button 
                                onClick={handleAddMemo}
                                disabled={!newMemo.trim()}
                                className="bg-[#3e2723] hover:bg-[#2a1a17] disabled:opacity-50 disabled:cursor-not-allowed text-[#d4af37] px-4 py-2 rounded-sm text-xs font-bold shadow-md transition-colors tracking-widest border border-[#b8860b] flex items-center gap-1"
                            >
                                <Pen size={12} /> 追加する
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center text-sm text-brand-400 py-4">読み込み中...</div>
                        ) : sortedMemos.length === 0 ? (
                            <div className="text-center text-sm text-brand-400 py-8 border border-dashed border-brand-200 rounded-sm bg-brand-50/50">
                                まだメモはありません。
                            </div>
                        ) : (
                            sortedMemos.map(memo => (
                                <div key={memo.id} className="bg-brand-50 border border-brand-200 p-4 rounded-sm shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[10px] text-brand-400 font-mono tracking-wider">
                                            {new Date(memo.updatedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(memo)} className="text-brand-400 hover:text-brand-700 transition-colors px-1"><Pen size={12} /></button>
                                            <button onClick={() => handleDelete(memo.id)} className="text-brand-400 hover:text-red-600 transition-colors px-1"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                    
                                    {editingId === memo.id ? (
                                        <div className="mt-2 text-sm text-brand-800 whitespace-pre-wrap leading-relaxed">
                                            <textarea 
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={3} 
                                                className="w-full border border-brand-300 rounded-sm text-xs p-2 bg-white leading-relaxed focus:ring-brand-500 shadow-sm mb-2 outline-none"
                                            ></textarea>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingId(null)} className="text-[10px] text-brand-500 hover:text-brand-800 px-2 py-1 tracking-widest font-bold">キャンセル</button>
                                                <button onClick={() => saveEdit(memo.id)} className="bg-brand-600 hover:bg-brand-800 text-white px-4 py-1.5 rounded-sm text-[10px] font-bold shadow-sm transition-colors tracking-widest">保存</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-sm text-brand-800 whitespace-pre-wrap leading-relaxed break-words">
                                            {memo.content}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
