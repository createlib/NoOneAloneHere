'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Key, X, Pen, Trash2, Plus, NotebookPen } from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ── Design tokens (matches user/page.tsx) ──
const BG   = '#f8f6f3';
const T1   = '#2d2925';
const T2   = '#7a7166';
const TM   = '#a09590';
const SAGE = '#4a7c59';
const NEU_UP = '6px 6px 14px #e4e0db, -6px -6px 14px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #e4e0db, inset -3px -3px 8px #ffffff';
const NEU_SM = '3px 3px 8px #e4e0db, -3px -3px 8px #ffffff';
const AMBER  = '#b8860b';

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
    const [memos, setMemos]         = useState<MemoEntry[]>([]);
    const [newMemo, setNewMemo]     = useState('');
    const [editingId, setEditingId]       = useState<string | null>(null);
    const [editContent, setEditContent]   = useState('');
    const [isLoading, setIsLoading]       = useState(true);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [visible, setVisible]     = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Animate in/out
    useEffect(() => {
        if (isOpen) { setTimeout(() => setVisible(true), 10); }
        else { setVisible(false); }
    }, [isOpen]);

    // Fetch memos
    useEffect(() => {
        if (!isOpen) return;
        const fetchMemos = async () => {
            setIsLoading(true);
            try {
                const memoRef = doc(db, 'artifacts', APP_ID, 'users', currentUserId, 'private_memos', targetUserId);
                const snap = await getDoc(memoRef);
                setMemos(snap.exists() && snap.data().logs ? snap.data().logs : []);
            } catch (e) { console.error(e); }
            finally { setIsLoading(false); }
        };
        fetchMemos();
    }, [isOpen, currentUserId, targetUserId]);

    const saveMemosToDB = async (updated: MemoEntry[]) => {
        const memoRef = doc(db, 'artifacts', APP_ID, 'users', currentUserId, 'private_memos', targetUserId);
        await setDoc(memoRef, { logs: updated }, { merge: true });
        setMemos(updated);
    };

    const handleAddMemo = async () => {
        if (!newMemo.trim()) return;
        const entry: MemoEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            content: newMemo.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await saveMemosToDB([...memos, entry]);
        setNewMemo('');
    };

    const handleDelete = async (id: string) => {
        await saveMemosToDB(memos.filter(m => m.id !== id));
        setConfirmDeleteId(null);
    };

    const startEdit = (memo: MemoEntry) => { setEditingId(memo.id); setEditContent(memo.content); };
    const saveEdit  = async (id: string) => {
        if (!editContent.trim()) return;
        await saveMemosToDB(memos.map(m => m.id === id ? { ...m, content: editContent.trim(), updatedAt: new Date().toISOString() } : m));
        setEditingId(null);
    };

    if (!isOpen) return null;

    const sorted = [...memos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    return (
        <div
            ref={overlayRef}
            onClick={e => { if (e.target === overlayRef.current) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 6000,
                background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                transition: 'opacity .25s',
                opacity: visible ? 1 : 0,
            }}
        >
            <div style={{
                width: '100%', maxWidth: 560,
                background: BG, borderRadius: '20px 20px 0 0',
                boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '85vh',
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
            }}>
                {/* Drag handle */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,.12)' }} />
                </div>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Key size={14} color={AMBER} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T1, letterSpacing: '.04em' }}>鍵メモ</div>
                            <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>{targetUserName}さんへのプライベートメモ</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2 }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(0,0,0,.06)', margin: '0 20px' }} />

                {/* Body (scrollable) */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>

                    {/* Input area */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={newMemo}
                                onChange={e => setNewMemo(e.target.value)}
                                rows={3}
                                placeholder="例：2/25の名古屋のイベントで挨拶。Webデザインに興味あり。"
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddMemo(); }}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '12px 14px', borderRadius: 12,
                                    border: 'none', background: BG,
                                    boxShadow: NEU_IN,
                                    resize: 'none', fontSize: 12, color: T1,
                                    lineHeight: 1.7, outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button
                                onClick={handleAddMemo}
                                disabled={!newMemo.trim()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '7px 16px', borderRadius: 100, border: 'none',
                                    background: newMemo.trim() ? SAGE : BG,
                                    boxShadow: newMemo.trim() ? 'none' : NEU_SM,
                                    color: newMemo.trim() ? '#fff' : TM,
                                    fontSize: 11, fontWeight: 700, cursor: newMemo.trim() ? 'pointer' : 'not-allowed',
                                    transition: 'all .15s',
                                }}
                            >
                                <Plus size={11} />追加する
                            </button>
                        </div>
                    </div>

                    {/* Memo list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: TM }}>読み込み中…</div>
                        ) : sorted.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: TM }}>
                                <NotebookPen size={24} color={TM} style={{ margin: '0 auto 8px', display: 'block', opacity: .5 }} />
                                まだメモはありません
                            </div>
                        ) : sorted.map(memo => (
                            <div key={memo.id} style={{
                                background: BG, borderRadius: 12, boxShadow: NEU_UP,
                                padding: '12px 14px',
                            }}>
                                {/* Meta row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, color: TM, fontFamily: "'DM Mono',monospace", letterSpacing: '.04em' }}>
                                        {fmtDate(memo.updatedAt)}
                                    </span>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {confirmDeleteId === memo.id ? (
                                            <>
                                                <span style={{ fontSize: 10, color: '#ef4444', marginRight: 2 }}>削除しますか？</span>
                                                <button
                                                    onClick={() => handleDelete(memo.id)}
                                                    style={{ padding: '3px 10px', borderRadius: 100, border: 'none', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                                >削除</button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    style={{ padding: '3px 10px', borderRadius: 100, border: 'none', background: BG, boxShadow: NEU_SM, color: T2, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                                                >取消</button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => startEdit(memo)}
                                                    style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2 }}
                                                ><Pen size={10} /></button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(memo.id)}
                                                    style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
                                                ><Trash2 size={10} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content or edit */}
                                {editingId === memo.id ? (
                                    <div>
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            rows={3}
                                            style={{
                                                width: '100%', boxSizing: 'border-box',
                                                padding: '10px 12px', borderRadius: 10,
                                                border: 'none', background: BG, boxShadow: NEU_IN,
                                                resize: 'none', fontSize: 12, color: T1,
                                                lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', marginBottom: 8,
                                            }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                style={{ padding: '5px 12px', borderRadius: 100, border: 'none', background: BG, boxShadow: NEU_SM, color: T2, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                                            >キャンセル</button>
                                            <button
                                                onClick={() => saveEdit(memo.id)}
                                                style={{ padding: '5px 14px', borderRadius: 100, border: 'none', background: SAGE, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                            >保存</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 12, color: T1, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {memo.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
