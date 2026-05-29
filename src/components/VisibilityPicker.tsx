'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, APP_ID } from '@/lib/firebase';
import { getDocs, collection, getDoc, doc } from 'firebase/firestore';
import {
    Globe, Users, UserCheck, ListChecks, Search, Check, X, Loader2, List, Settings
} from 'lucide-react';
import AudienceListManager, { AudienceList } from './AudienceListManager';

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

export type VisibilityMode = 'public' | 'followers' | 'mutual' | 'custom';

interface MemberInfo {
    uid: string;
    name: string;
    photoURL: string;
    userId: string;
}

interface Props {
    currentUid: string;
    visibility: VisibilityMode;
    onVisibilityChange: (mode: VisibilityMode) => void;
    selectedListIds: string[];
    onSelectedListIdsChange: (ids: string[]) => void;
    selectedUserIds: string[];
    onSelectedUserIdsChange: (ids: string[]) => void;
}

const VISIBILITY_OPTIONS: { mode: VisibilityMode; label: string; desc: string; icon: React.ComponentType<any> }[] = [
    { mode: 'public',    label: '全体に公開',       desc: '誰でも閲覧可能',           icon: Globe },
    { mode: 'followers', label: 'フォロワーに公開', desc: 'あなたのフォロワーのみ',   icon: Users },
    { mode: 'mutual',    label: '相互フォロワーに公開', desc: '相互フォロー中の人のみ', icon: UserCheck },
    { mode: 'custom',    label: 'カスタム公開',     desc: 'リスト・個別メンバーを選択', icon: ListChecks },
];

export default function VisibilityPicker({
    currentUid, visibility, onVisibilityChange,
    selectedListIds, onSelectedListIdsChange,
    selectedUserIds, onSelectedUserIdsChange,
}: Props) {
    const [audienceLists, setAudienceLists] = useState<AudienceList[]>([]);
    const [listsLoading, setListsLoading] = useState(false);
    const [showListManager, setShowListManager] = useState(false);

    // For individual member selection
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [allMembers, setAllMembers] = useState<MemberInfo[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    /* ── Load audience lists ──────────────────────────────────── */
    const loadLists = useCallback(async () => {
        if (!currentUid) return;
        setListsLoading(true);
        try {
            const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', currentUid, 'audience_lists'));
            const l: AudienceList[] = [];
            snap.forEach(d => l.push({ id: d.id, ...d.data() } as AudienceList));
            setAudienceLists(l);
        } catch (e) { console.error(e); }
        finally { setListsLoading(false); }
    }, [currentUid]);

    useEffect(() => { loadLists(); }, [loadLists]);

    /* ── Load following members for individual selection ──────── */
    const loadMembers = useCallback(async () => {
        if (allMembers.length > 0 || !currentUid) return;
        setMembersLoading(true);
        try {
            const folSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', currentUid, 'following'));
            const members: MemberInfo[] = [];
            for (const f of folSnap.docs) {
                try {
                    const pSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', f.id, 'profile', 'data'));
                    if (pSnap.exists()) {
                        const p = pSnap.data();
                        members.push({ uid: f.id, name: p.name || p.userId || '名無し', photoURL: p.photoURL || '', userId: p.userId || '' });
                    }
                } catch {}
            }
            setAllMembers(members);
        } catch (e) { console.error(e); }
        finally { setMembersLoading(false); }
    }, [currentUid, allMembers.length]);

    const toggleList = (listId: string) => {
        onSelectedListIdsChange(
            selectedListIds.includes(listId)
                ? selectedListIds.filter(id => id !== listId)
                : [...selectedListIds, listId]
        );
    };

    const toggleUser = (uid: string) => {
        onSelectedUserIdsChange(
            selectedUserIds.includes(uid)
                ? selectedUserIds.filter(id => id !== uid)
                : [...selectedUserIds, uid]
        );
    };

    const filteredMembers = allMembers.filter(m =>
        !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.userId.toLowerCase().includes(memberSearch.toLowerCase())
    );

    // Count total custom targets
    const customTargetCount = (() => {
        const listMemberIds = new Set<string>();
        selectedListIds.forEach(lid => {
            const list = audienceLists.find(l => l.id === lid);
            if (list) list.memberIds.forEach(uid => listMemberIds.add(uid));
        });
        selectedUserIds.forEach(uid => listMemberIds.add(uid));
        return listMemberIds.size;
    })();

    return (
        <>
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T1, marginBottom: 8 }}>公開範囲</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {VISIBILITY_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isActive = visibility === opt.mode;
                        return (
                            <button key={opt.mode} onClick={() => onVisibilityChange(opt.mode)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px', borderRadius: 10, border: 'none', width: '100%',
                                    background: isActive ? 'rgba(74,124,89,.08)' : BG,
                                    boxShadow: isActive ? `inset 0 0 0 2px ${SAGE}` : NEU_SM,
                                    cursor: 'pointer', textAlign: 'left',
                                }}>
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    border: `2px solid ${isActive ? SAGE : TM}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: SAGE }} />}
                                </div>
                                <Icon size={14} color={isActive ? SAGE : TM} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{opt.label}</div>
                                    <div style={{ fontSize: 9, color: TM }}>{opt.desc}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ── Custom visibility options ──────────────── */}
                {visibility === 'custom' && (
                    <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: BG, boxShadow: NEU_SM }}>
                        {/* Summary */}
                        <div style={{ fontSize: 10, color: TM, marginBottom: 10 }}>
                            公開対象: <b style={{ color: SAGE }}>{customTargetCount}人</b>
                            {selectedListIds.length > 0 && <> ({selectedListIds.length}リスト)</>}
                            {selectedUserIds.length > 0 && <> + {selectedUserIds.length}人の個別指定</>}
                        </div>

                        {/* Audience lists selection */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>公開リスト</div>
                                <button onClick={() => setShowListManager(true)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: SAGE, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Settings size={10} /> 管理
                                </button>
                            </div>

                            {listsLoading ? (
                                <div style={{ textAlign: 'center', padding: 10 }}>
                                    <Loader2 size={14} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                                </div>
                            ) : audienceLists.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 10, color: TM }}>
                                    リストがありません。「管理」からリストを作成してください。
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {audienceLists.map(list => {
                                        const checked = selectedListIds.includes(list.id);
                                        return (
                                            <button key={list.id} onClick={() => toggleList(list.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '8px 10px', borderRadius: 8, border: 'none', width: '100%',
                                                    background: checked ? 'rgba(74,124,89,.06)' : 'transparent',
                                                    cursor: 'pointer', textAlign: 'left',
                                                }}>
                                                <div style={{
                                                    width: 18, height: 18, borderRadius: 5,
                                                    border: `2px solid ${checked ? SAGE : TM}`,
                                                    background: checked ? SAGE : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {checked && <Check size={11} color="#fff" />}
                                                </div>
                                                <List size={12} color={checked ? SAGE : TM} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{list.name}</div>
                                                    <div style={{ fontSize: 9, color: TM }}>{list.memberIds.length}人</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Individual member selection */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>個別メンバー追加</div>
                            </div>

                            {/* Selected user chips */}
                            {selectedUserIds.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                    {selectedUserIds.map(uid => {
                                        const m = allMembers.find(x => x.uid === uid);
                                        return (
                                            <span key={uid} style={{
                                                display: 'flex', alignItems: 'center', gap: 3,
                                                padding: '2px 6px 2px 3px', borderRadius: 100,
                                                background: 'rgba(74,124,89,.1)', fontSize: 10, fontWeight: 600, color: SAGE,
                                            }}>
                                                <img src={m?.photoURL || '/default_avatar.png'} alt=""
                                                    style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                                                    onError={e => { (e.target as HTMLImageElement).src = '/default_avatar.png'; }} />
                                                {m?.name || uid.slice(0, 6)}
                                                <button onClick={() => toggleUser(uid)}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: SAGE, padding: 0, display: 'flex' }}>
                                                    <X size={9} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <button onClick={() => { setShowMemberPicker(!showMemberPicker); if (!showMemberPicker) loadMembers(); }}
                                style={{
                                    width: '100%', padding: '8px 0', borderRadius: 8, border: `1px dashed ${TM}`,
                                    background: 'transparent', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: SAGE,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                }}>
                                {showMemberPicker ? <X size={11} /> : <Users size={11} />}
                                {showMemberPicker ? '閉じる' : 'メンバーを追加'}
                            </button>

                            {showMemberPicker && (
                                <div style={{ marginTop: 8, borderRadius: 10, background: BG, boxShadow: NEU_SM, padding: 6, maxHeight: 200, overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', marginBottom: 4 }}>
                                        <Search size={11} color={TM} />
                                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                            placeholder="検索..."
                                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 10, color: T1, outline: 'none' }} />
                                    </div>
                                    {membersLoading ? (
                                        <div style={{ textAlign: 'center', padding: 12 }}>
                                            <Loader2 size={14} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                                        </div>
                                    ) : filteredMembers.map(m => {
                                        const sel = selectedUserIds.includes(m.uid);
                                        return (
                                            <button key={m.uid} onClick={() => toggleUser(m.uid)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                                    padding: '6px 8px', borderRadius: 6, border: 'none',
                                                    background: sel ? 'rgba(74,124,89,.06)' : 'transparent',
                                                    cursor: 'pointer', textAlign: 'left',
                                                }}>
                                                <img src={m.photoURL || '/default_avatar.png'} alt=""
                                                    style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                                                    onError={e => { (e.target as HTMLImageElement).src = '/default_avatar.png'; }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{m.name}</div>
                                                </div>
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 4,
                                                    border: `2px solid ${sel ? SAGE : TM}`,
                                                    background: sel ? SAGE : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {sel && <Check size={10} color="#fff" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Audience List Manager modal */}
            <AudienceListManager
                isOpen={showListManager}
                onClose={() => setShowListManager(false)}
                currentUid={currentUid}
                onListsUpdated={setAudienceLists}
            />

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
    );
}
