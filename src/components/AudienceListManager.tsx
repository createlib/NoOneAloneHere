'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import {
    X, Plus, Users, Trash2, PenLine, Search, Check, Loader2, UserPlus, List
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';
const FALLBACK_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#dbd7d2"/><circle cx="16" cy="12" r="5" fill="#b0a89e"/><ellipse cx="16" cy="26" rx="9" ry="7" fill="#b0a89e"/></svg>');

const MAX_LISTS = 10;

export interface AudienceList {
    id: string;
    name: string;
    memberIds: string[];
    createdAt: any;
    updatedAt: any;
}

interface MemberInfo {
    uid: string;
    name: string;
    photoURL: string;
    userId: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentUid: string;
    /** Called when lists change so parent can refresh */
    onListsUpdated?: (lists: AudienceList[]) => void;
}

export default function AudienceListManager({ isOpen, onClose, currentUid, onListsUpdated }: Props) {
    const [lists, setLists] = useState<AudienceList[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingList, setEditingList] = useState<AudienceList | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [listName, setListName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [allMembers, setAllMembers] = useState<MemberInfo[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [appear, setAppear] = useState(false);

    /* ── Load lists ────────────────────────────────────────────── */
    const loadLists = useCallback(async () => {
        if (!currentUid) return;
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', currentUid, 'audience_lists'));
            const l: AudienceList[] = [];
            snap.forEach(d => l.push({ id: d.id, ...d.data() } as AudienceList));
            l.sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
                const tb = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
                return ta - tb;
            });
            setLists(l);
            onListsUpdated?.(l);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [currentUid, onListsUpdated]);

    /* ── Load all community members ──────────────────────────── */
    const loadAllMembers = useCallback(async () => {
        if (allMembers.length > 0) return;
        setMembersLoading(true);
        try {
            // Load from following list first (most likely targets)
            const folSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', currentUid, 'following'));
            const uids = folSnap.docs.map(d => d.id);

            const members: MemberInfo[] = [];
            for (const uid of uids) {
                try {
                    const pSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'data'));
                    if (pSnap.exists()) {
                        const p = pSnap.data();
                        members.push({ uid, name: p.name || p.userId || '名無し', photoURL: p.photoURL || '', userId: p.userId || '' });
                    }
                } catch {}
            }
            setAllMembers(members);
        } catch (e) { console.error(e); }
        finally { setMembersLoading(false); }
    }, [currentUid, allMembers.length]);

    useEffect(() => {
        if (isOpen) {
            loadLists();
            loadAllMembers();
            setTimeout(() => setAppear(true), 10);
        } else {
            setAppear(false);
            setEditingList(null);
            setIsCreating(false);
        }
    }, [isOpen, loadLists, loadAllMembers]);

    /* ── Create / Update list ─────────────────────────────────── */
    const handleSave = async () => {
        if (!listName.trim()) return;
        setSaving(true);
        try {
            if (editingList) {
                // Update
                await setDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'audience_lists', editingList.id), {
                    name: listName.trim(),
                    memberIds: selectedMembers,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            } else {
                // Create
                const id = Date.now().toString();
                await setDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'audience_lists', id), {
                    name: listName.trim(),
                    memberIds: selectedMembers,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
            setEditingList(null);
            setIsCreating(false);
            setListName('');
            setSelectedMembers([]);
            await loadLists();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    /* ── Delete list ──────────────────────────────────────────── */
    const handleDelete = async (listId: string) => {
        if (!confirm('このリストを削除しますか？')) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'audience_lists', listId));
            await loadLists();
        } catch (e) { console.error(e); }
    };

    /* ── Start editing ────────────────────────────────────────── */
    const startEdit = (list: AudienceList) => {
        setEditingList(list);
        setIsCreating(false);
        setListName(list.name);
        setSelectedMembers([...list.memberIds]);
    };

    const startCreate = () => {
        if (lists.length >= MAX_LISTS) return alert(`リストは最大${MAX_LISTS}件までです`);
        setIsCreating(true);
        setEditingList(null);
        setListName('');
        setSelectedMembers([]);
    };

    const toggleMember = (uid: string) => {
        setSelectedMembers(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const filteredMembers = allMembers.filter(m =>
        !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.userId.toLowerCase().includes(memberSearch.toLowerCase())
    );

    if (!isOpen) return null;

    const isEditing = isCreating || editingList;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 8500,
            background: appear ? 'rgba(0,0,0,.4)' : 'transparent',
            backdropFilter: appear ? 'blur(4px)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .25s',
        }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '92%', maxWidth: 440, maxHeight: '80vh',
                background: BG, borderRadius: 20,
                boxShadow: '0 16px 60px rgba(0,0,0,.25)',
                display: 'flex', flexDirection: 'column',
                transform: appear ? 'scale(1)' : 'scale(.95)',
                opacity: appear ? 1 : 0,
                transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEditing && (
                            <button onClick={() => { setEditingList(null); setIsCreating(false); }}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T2, padding: 0 }}>
                                ← 
                            </button>
                        )}
                        <List size={16} color={SAGE} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: T1 }}>
                            {isEditing ? (editingList ? 'リストを編集' : '新しいリスト') : '公開リスト管理'}
                        </span>
                    </div>
                    <button onClick={onClose}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2 }}>
                        <X size={13} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                            <Loader2 size={20} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : isEditing ? (
                        /* ── Edit / Create form ──────────────────── */
                        <>
                            {/* List name */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T1, marginBottom: 6 }}>リスト名</div>
                                <input value={listName} onChange={e => setListName(e.target.value)}
                                    placeholder="例: なかよし、ビジネス仲間..."
                                    style={{
                                        width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10,
                                        background: BG, boxShadow: NEU_IN, fontSize: 13, color: T1, outline: 'none',
                                        boxSizing: 'border-box',
                                    }} />
                            </div>

                            {/* Member search */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T1, marginBottom: 6 }}>
                                    メンバーを選択 ({selectedMembers.length}人)
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: BG, boxShadow: NEU_IN }}>
                                        <Search size={12} color={TM} />
                                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                            placeholder="名前 / IDで検索..."
                                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 11, color: T1, outline: 'none' }} />
                                    </div>
                                </div>

                                {/* Selected chips */}
                                {selectedMembers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                        {selectedMembers.map(uid => {
                                            const m = allMembers.find(x => x.uid === uid);
                                            return (
                                                <span key={uid} style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    padding: '3px 8px 3px 4px', borderRadius: 100, background: 'rgba(74,124,89,.1)',
                                                    fontSize: 10, fontWeight: 600, color: SAGE,
                                                }}>
                                                    <img src={m?.photoURL || FALLBACK_AVATAR} alt=""
                                                        style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                                                        onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }} />
                                                    {m?.name || uid.slice(0, 8)}
                                                    <button onClick={() => toggleMember(uid)}
                                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: SAGE, padding: 0, display: 'flex' }}>
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Member list */}
                                <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 12, background: BG, boxShadow: NEU_SM, padding: 4 }}>
                                    {membersLoading ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                                            <Loader2 size={16} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                                        </div>
                                    ) : filteredMembers.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: TM }}>
                                            {memberSearch ? '該当するメンバーがいません' : 'フォロー中のメンバーがいません'}
                                        </div>
                                    ) : filteredMembers.map(m => {
                                        const selected = selectedMembers.includes(m.uid);
                                        return (
                                            <button key={m.uid} onClick={() => toggleMember(m.uid)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                                    padding: '8px 10px', borderRadius: 8, border: 'none',
                                                    background: selected ? 'rgba(74,124,89,.08)' : 'transparent',
                                                    cursor: 'pointer', textAlign: 'left',
                                                }}>
                                                <img src={m.photoURL || FALLBACK_AVATAR} alt=""
                                                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                    onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{m.name}</div>
                                                    <div style={{ fontSize: 9, color: TM }}>@{m.userId}</div>
                                                </div>
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: 6,
                                                    border: `2px solid ${selected ? SAGE : TM}`,
                                                    background: selected ? SAGE : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {selected && <Check size={12} color="#fff" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Save button */}
                            <button onClick={handleSave} disabled={saving || !listName.trim()}
                                style={{
                                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                                    background: SB, color: LIME, fontSize: 12, fontWeight: 800,
                                    cursor: saving || !listName.trim() ? 'not-allowed' : 'pointer',
                                    opacity: saving || !listName.trim() ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                }}>
                                {saving ? <Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> : <Check size={13} />}
                                {editingList ? '更新する' : '作成する'}
                            </button>
                        </>
                    ) : (
                        /* ── List overview ────────────────────────── */
                        <>
                            <div style={{ fontSize: 11, color: TM, marginBottom: 12 }}>
                                メンバーをグループにまとめて、コンテンツの公開先として利用できます。（{lists.length}/{MAX_LISTS}）
                            </div>

                            {lists.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <Users size={28} color={TM} style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: 12, fontWeight: 600, color: T2 }}>まだリストがありません</div>
                                    <div style={{ fontSize: 10, color: TM, marginTop: 4 }}>「+新しいリスト」から作成してください</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {lists.map(list => (
                                        <div key={list.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '12px 14px', borderRadius: 12, background: BG, boxShadow: NEU_SM,
                                            }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, background: 'rgba(74,124,89,.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                <Users size={16} color={SAGE} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{list.name}</div>
                                                <div style={{ fontSize: 10, color: TM }}>{list.memberIds.length}人のメンバー</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => startEdit(list)}
                                                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SAGE }}>
                                                    <PenLine size={11} />
                                                </button>
                                                <button onClick={() => handleDelete(list.id)}
                                                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc3c3c' }}>
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Create button */}
                            {lists.length < MAX_LISTS && (
                                <button onClick={startCreate}
                                    style={{
                                        width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 12, border: 'none',
                                        background: SB, color: LIME, fontSize: 12, fontWeight: 700,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    }}>
                                    <Plus size={14} /> 新しいリスト
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
