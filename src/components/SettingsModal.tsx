'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    X, Globe, Lock, ChevronRight, LogOut,
    Bell, User, MapPin, Calendar, Users, Heart,
    Shield, MonitorSmartphone, Loader2, Link2, Copy, CheckCheck,
} from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG    = '#f8f6f3';
const SB    = '#1a3024';
const SAGE  = '#4a7c59';
const LIME  = '#8ecfb2';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#ada49c';
const NEU_UP = '6px 6px 14px #e4e0db,-6px -6px 14px #ffffff';
const NEU_SM = '3px 3px 8px #e4e0db,-3px -3px 8px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #e4e0db,inset -3px -3px 8px #ffffff';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'profile' | 'notifications' | 'invite';

interface PrivacySettings {
    profilePublic: string;         // "true" | "false"
    birthVisibility: string;       // "full" | "monthDay" | "none"
    genderVisibility: string;      // "public" | "mutual" | "private"
    hometownVisibility: string;
    activityAreaVisibility: string;
}

interface NotificationSettings {
    notif_follow: boolean;
    notif_new_member: boolean;
    notif_event_join: boolean;
    notif_live_start: boolean;
    notif_new_video: boolean;
    notif_new_podcast: boolean;
    notif_mutual: boolean;
    notif_system: boolean;
}

const DEFAULT_PRIVACY: PrivacySettings = {
    profilePublic: 'true',
    birthVisibility: 'none',
    genderVisibility: 'public',
    hometownVisibility: 'public',
    activityAreaVisibility: 'public',
};

const DEFAULT_NOTIF: NotificationSettings = {
    notif_follow: true,
    notif_new_member: true,
    notif_event_join: true,
    notif_live_start: true,
    notif_new_video: true,
    notif_new_podcast: true,
    notif_mutual: true,
    notif_system: true,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            style={{
                width: 44, height: 24, borderRadius: 12,
                background: checked ? SAGE : '#c9c4be',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background .2s', flexShrink: 0,
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,.15)',
            }}
        >
            <div style={{
                position: 'absolute', top: 3, left: checked ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                transition: 'left .2s',
            }} />
        </button>
    );
}

function SelectRow({
    label, icon: Icon, value, options, onChange, sub,
}: {
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    sub?: string;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} color={SAGE} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{label}</div>
                    {sub && <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>{sub}</div>}
                </div>
            </div>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    marginLeft: 12, padding: '5px 8px', borderRadius: 8, border: 'none',
                    background: BG, boxShadow: NEU_IN, fontSize: 11, color: T1,
                    fontFamily: 'inherit', cursor: 'pointer', outline: 'none', flexShrink: 0,
                }}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function ToggleRow({
    label, icon: Icon, checked, onChange, sub, color,
}: {
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    checked: boolean;
    onChange: (v: boolean) => void;
    sub?: string;
    color?: string;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} color={color || SAGE} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{label}</div>
                    {sub && <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>{sub}</div>}
                </div>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUid: string;
    onLogout: () => Promise<void>;
    initialTab?: Tab;
}

export default function SettingsModal({ isOpen, onClose, currentUid, onLogout, initialTab }: SettingsModalProps) {
    const [appear, setAppear]   = useState(false);
    const [tab, setTab]         = useState<Tab>(initialTab || 'profile');
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [loading, setLoading] = useState(true);
    const overlayRef            = useRef<HTMLDivElement>(null);

    const [privacy, setPrivacy]   = useState<PrivacySettings>(DEFAULT_PRIVACY);
    const [notifSet, setNotifSet] = useState<NotificationSettings>(DEFAULT_NOTIF);

    // ── 招待 state ────────────────────────────────────────────────────────────
    const [myUserId, setMyUserId]         = useState('');
    const [myName, setMyName]             = useState('');
    const [copied, setCopied]             = useState(false);
    const [referrals, setReferrals]       = useState<any[]>([]);
    const [refLoading, setRefLoading]     = useState(false);
    const [refLoaded, setRefLoaded]       = useState(false);

    // animate in/out
    useEffect(() => {
        if (isOpen) {
            setTab(initialTab || 'profile');
            setTimeout(() => setAppear(true), 10);
            loadSettings();
            loadMyProfile();
        } else {
            setAppear(false);
            setRefLoaded(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadMyProfile = async () => {
        if (!currentUid) return;
        try {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'profile', 'data'));
            if (snap.exists()) {
                const d = snap.data();
                setMyUserId(d.userId || '');
                setMyName(d.name || d.userId || '');
            }
        } catch (e) { console.error(e); }
    };

    const handleCopyInvite = () => {
        if (!myUserId) return alert('ユーザーIDが取得できませんでした');
        const inviteText = `${myName}さんからNOAHに招待されました。\n下記のリンクから乗船手続きを進めてください。\n\n■新規登録｜NOAH｜No One Alone, Here\nhttps://noonealonehere.pages.dev/register.html?ref=${myUserId}\n\n■公式LINE｜公式LINEを登録し、いつでも乗船できるようにしてください。\nhttps://lin.ee/aaP0V9F\n\n■公式オープンチャット｜「フルネーム＠NOAHのID」で参加申請してください。\nhttps://line.me/ti/g2/yo2C_bp7U7agH9Rz--E2YhZ4Sc4Yy1ybqhQQZw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default\n`;
        navigator.clipboard.writeText(inviteText)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
            .catch(() => alert('コピーに失敗しました。'));
    };

    const loadReferrals = async () => {
        if (!myUserId || refLoaded) return;
        setRefLoading(true);
        try {
            const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
            const q = query(usersRef, where('referrerId', '==', myUserId));
            const snap = await getDocs(q);
            const list: any[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setReferrals(list);
            setRefLoaded(true);
        } catch (e) { console.error(e); }
        finally { setRefLoading(false); }
    };

    const loadSettings = async () => {
        if (!currentUid) return;
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'profile', 'data'));
            if (snap.exists()) {
                const d = snap.data();
                setPrivacy({
                    profilePublic:         d.profilePublic         ?? 'true',
                    birthVisibility:       d.birthVisibility       ?? 'none',
                    genderVisibility:      d.genderVisibility      ?? 'public',
                    hometownVisibility:    d.hometownVisibility    ?? 'public',
                    activityAreaVisibility:d.activityAreaVisibility?? 'public',
                });
                setNotifSet({
                    notif_follow:      d.notif_follow      ?? true,
                    notif_new_member:  d.notif_new_member  ?? true,
                    notif_event_join:  d.notif_event_join  ?? true,
                    notif_live_start:  d.notif_live_start  ?? true,
                    notif_new_video:   d.notif_new_video   ?? true,
                    notif_new_podcast: d.notif_new_podcast ?? true,
                    notif_mutual:      d.notif_mutual      ?? true,
                    notif_system:      d.notif_system      ?? true,
                });
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!currentUid) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'profile', 'data'), {
                ...privacy, ...notifSet,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const VISIBILITY_OPTS = [
        { value: 'public',  label: '全員に公開' },
        { value: 'mutual',  label: '相互のみ' },
        { value: 'private', label: '非公開' },
    ];
    const BIRTH_OPTS = [
        { value: 'full',     label: '年月日を表示' },
        { value: 'monthDay', label: '月日のみ' },
        { value: 'none',     label: '非表示' },
    ];

    const TAB_STYLE = (active: boolean): React.CSSProperties => ({
        flex: 1, padding: '8px 0', border: 'none', borderRadius: 10,
        background: active ? SB : 'transparent',
        color: active ? LIME : T2,
        fontSize: 11, fontWeight: active ? 700 : 500,
        cursor: 'pointer', transition: 'all .15s', letterSpacing: '.04em',
    });

    return (
        <div
            ref={overlayRef}
            onClick={e => { if (e.target === overlayRef.current) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 7000,
                background: appear ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,0)',
                backdropFilter: appear ? 'blur(6px)' : 'none',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                transition: 'background .25s, backdrop-filter .25s',
            }}
        >
            <div style={{
                width: '100%', maxWidth: 540,
                background: BG,
                borderRadius: '22px 22px 0 0',
                boxShadow: '0 -8px 48px rgba(0,0,0,.22)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '88vh',
                transform: appear ? 'translateY(0)' : 'translateY(30px)',
                transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
            }}>
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,.12)' }} />
                </div>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: SB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield size={14} color={LIME} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>設定</div>
                            <div style={{ fontSize: 10, color: TM }}>プロフィール・通知の管理</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T2 }}
                    ><X size={14} /></button>
                </div>

                {/* Tab bar */}
                <div style={{ margin: '6px 20px 0', padding: 4, background: BG, boxShadow: NEU_IN, borderRadius: 14, display: 'flex', gap: 4 }}>
                    <button style={TAB_STYLE(tab === 'profile')}       onClick={() => setTab('profile')}>プロフィール</button>
                    <button style={TAB_STYLE(tab === 'notifications')} onClick={() => setTab('notifications')}>通知</button>
                    <button style={TAB_STYLE(tab === 'invite')}        onClick={() => { setTab('invite'); loadReferrals(); }}>招待</button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(0,0,0,.06)', margin: '10px 20px 0' }} />

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 8px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                            <Loader2 size={24} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                        </div>
                    ) : tab === 'profile' ? (
                        <>
                            {/* Profile public toggle */}
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TM, letterSpacing: '.1em', marginBottom: 6 }}>基本設定</div>
                                <div style={{ background: BG, borderRadius: 14, boxShadow: NEU_UP, padding: '4px 14px' }}>
                                    <ToggleRow
                                        label="プロフィールを公開"
                                        icon={privacy.profilePublic === 'true' ? Globe : Lock}
                                        checked={privacy.profilePublic === 'true'}
                                        onChange={v => setPrivacy(p => ({ ...p, profilePublic: v ? 'true' : 'false' }))}
                                        sub={privacy.profilePublic === 'true' ? '他のメンバーがプロフィールを閲覧できます' : '自分以外には表示されません'}
                                        color={privacy.profilePublic === 'true' ? SAGE : '#ef4444'}
                                    />
                                </div>
                            </div>

                            {/* Privacy per field */}
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TM, letterSpacing: '.1em', marginBottom: 6 }}>各項目の公開設定</div>
                                <div style={{ background: BG, borderRadius: 14, boxShadow: NEU_UP, padding: '4px 14px' }}>
                                    <SelectRow
                                        label="生年月日"
                                        icon={Calendar}
                                        value={privacy.birthVisibility}
                                        options={BIRTH_OPTS}
                                        onChange={v => setPrivacy(p => ({ ...p, birthVisibility: v }))}
                                        sub="他のユーザーへの表示形式"
                                    />
                                    <SelectRow
                                        label="性別"
                                        icon={Users}
                                        value={privacy.genderVisibility}
                                        options={VISIBILITY_OPTS}
                                        onChange={v => setPrivacy(p => ({ ...p, genderVisibility: v }))}
                                    />
                                    <SelectRow
                                        label="出身地"
                                        icon={MapPin}
                                        value={privacy.hometownVisibility}
                                        options={VISIBILITY_OPTS}
                                        onChange={v => setPrivacy(p => ({ ...p, hometownVisibility: v }))}
                                    />
                                    <SelectRow
                                        label="活動地域"
                                        icon={MapPin}
                                        value={privacy.activityAreaVisibility}
                                        options={VISIBILITY_OPTS}
                                        onChange={v => setPrivacy(p => ({ ...p, activityAreaVisibility: v }))}
                                        sub="最後の項目"
                                    />
                                </div>
                            </div>
                        </>
                    ) : tab === 'notifications' ? (
                        /* Notifications tab */
                        <>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TM, letterSpacing: '.1em', marginBottom: 6 }}>通知のオン/オフ</div>
                                <div style={{ background: BG, borderRadius: 14, boxShadow: NEU_UP, padding: '4px 14px' }}>
                                    <ToggleRow label="フォロー通知"     icon={User}    checked={notifSet.notif_follow}      onChange={v => setNotifSet(p => ({...p, notif_follow: v}))}      sub="誰かにフォローされたとき" />
                                    <ToggleRow label="相互フォロー通知" icon={Heart}   checked={notifSet.notif_mutual}      onChange={v => setNotifSet(p => ({...p, notif_mutual: v}))}      sub="相互フォローが成立したとき" color="#ec4899" />
                                    <ToggleRow label="新規乗船者通知"   icon={Users}   checked={notifSet.notif_new_member}  onChange={v => setNotifSet(p => ({...p, notif_new_member: v}))}  sub="あなたの紹介で新メンバーが参加したとき" />
                                    <ToggleRow label="イベント参加通知" icon={Calendar} checked={notifSet.notif_event_join} onChange={v => setNotifSet(p => ({...p, notif_event_join: v}))} sub="自分のイベントに誰かが参加したとき" color="#0ea5e9" />
                                    <ToggleRow label="ライブ配信通知"   icon={Bell}    checked={notifSet.notif_live_start}  onChange={v => setNotifSet(p => ({...p, notif_live_start: v}))}  sub="フォロー中のユーザーが配信を開始したとき" color="#ef4444" />
                                    <ToggleRow label="動画投稿通知"     icon={MonitorSmartphone} checked={notifSet.notif_new_video} onChange={v => setNotifSet(p => ({...p, notif_new_video: v}))} sub="フォロー中のユーザーが動画を投稿したとき" color="#6366f1" />
                                    <ToggleRow label="音声配信通知"     icon={Bell}    checked={notifSet.notif_new_podcast} onChange={v => setNotifSet(p => ({...p, notif_new_podcast: v}))} sub="フォロー中のユーザーが音声を配信したとき" color="#d97706" />
                                    <ToggleRow label="システム通知"     icon={Shield}  checked={notifSet.notif_system}      onChange={v => setNotifSet(p => ({...p, notif_system: v}))}      sub="NOAHからのお知らせ" color="#64748b" />
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Invite tab */
                        <>
                            {/* Copy invite link */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TM, letterSpacing: '.1em', marginBottom: 6 }}>招待リンク</div>
                                <div style={{ background: BG, borderRadius: 14, boxShadow: NEU_UP, padding: '14px' }}>
                                    {/* URL preview */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.06)', marginBottom: 10 }}>
                                        <Link2 size={12} color={SAGE} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: 10, color: T2, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            noonealonehere.pages.dev/register.html?ref={myUserId || '…'}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 10, color: TM, marginBottom: 10, lineHeight: 1.6 }}>
                                        招待文と登録URLをコピーして、LINEなどでシェアしてください。
                                    </p>
                                    <button
                                        onClick={handleCopyInvite}
                                        style={{
                                            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                                            background: copied ? '#10b981' : SB,
                                            color: copied ? '#fff' : LIME,
                                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                            letterSpacing: '.06em', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', gap: 6, transition: 'background .2s',
                                        }}
                                    >
                                        {copied
                                            ? <><CheckCheck size={13} /> コピーしました！</>
                                            : <><Copy size={13} /> 招待リンクをコピー</>
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Referral list */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TM, letterSpacing: '.1em', marginBottom: 6 }}>招待した人（乗船記録）</div>
                                <div style={{ background: BG, borderRadius: 14, boxShadow: NEU_UP, padding: '8px 14px', minHeight: 60 }}>
                                    {refLoading ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                            <Loader2 size={20} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                                        </div>
                                    ) : !refLoaded ? (
                                        <div style={{ textAlign: 'center', padding: '16px 0', color: TM, fontSize: 11 }}>タブを開くと自動的に読み込みます</div>
                                    ) : referrals.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                            <Users size={22} color={TM} style={{ margin: '0 auto 6px' }} />
                                            <div style={{ fontSize: 11, color: TM }}>まだ招待した人はいません</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {referrals.map(ref => (
                                                <Link
                                                    key={ref.id}
                                                    href={`/user?uid=${ref.id}`}
                                                    onClick={onClose}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '8px 4px', borderBottom: '1px solid rgba(0,0,0,.05)',
                                                        textDecoration: 'none', color: 'inherit',
                                                    }}
                                                >
                                                    {ref.photoURL
                                                        ? <img src={ref.photoURL} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }} alt="" />
                                                        : <div style={{ width: 34, height: 34, borderRadius: '50%', background: SAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                                            {(ref.name || '?')[0]}
                                                          </div>
                                                    }
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.name || '名称未設定'}</div>
                                                        <div style={{ fontSize: 9, color: TM, marginTop: 1 }}>@{ref.userId}</div>
                                                    </div>
                                                    <div style={{ fontSize: 9, color: TM, flexShrink: 0, textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, color: SAGE, fontSize: 11 }}>{ref.profileScore || 0}%</div>
                                                        <div>充実度</div>
                                                    </div>
                                                    <ChevronRight size={12} color={TM} style={{ flexShrink: 0 }} />
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer — 招待タブでは保存ボタン不要 */}
                <div style={{ padding: '12px 20px 28px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 12,
                            border: 'none', background: saved ? '#10b981' : SAGE,
                            color: '#fff', fontSize: 12, fontWeight: 700,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            letterSpacing: '.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'background .2s',
                            boxShadow: '0 4px 12px rgba(74,124,89,.3)',
                        }}
                    >
                        {saving ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} />保存中...</>
                            : saved ? '✓ 保存しました'
                                : '設定を保存'}
                    </button>

                    {/* Logout */}
                    <button
                        onClick={async () => { onClose(); await onLogout(); }}
                        style={{
                            width: '100%', padding: '10px', borderRadius: 12,
                            border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.04)',
                            color: '#ef4444', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', letterSpacing: '.06em',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                    >
                        <LogOut size={12} /> ログアウト
                    </button>
                </div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
