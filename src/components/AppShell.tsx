'use client';

/**
 * AppShell — 共通シェルコンポーネント
 *
 * /user ページとまったく同じ DOM 構造を維持します：
 *
 *   <div display:flex>               ← ルート（AppShellが返すもの）
 *     <nav hidden lg:flex>           ← PC固定サイドバー (position:fixed)
 *     <div lg:ml-[220px] flex:1>     ← メインエリア（モバイルでは ml-0 = 全幅）
 *       <div mob-topbar>             ← モバイルトップバー（メインの中にある）
 *       {children}                   ← 各ページのコンテンツ
 *     </div>
 *   </div>
 *   <nav show-app-shell-nav>         ← モバイルボトムナビ (position:fixed)
 *   <NotificationModal / SettingsModal>
 *
 * Props:
 *   activeHref  — 現在のページパス。ナビのアクティブ状態に使用
 *   currentUid  — 通知/設定モーダルに使用するUID
 *   userName    — サイドバーフッターに表示する名前
 *   userIdStr   — サイドバーフッターに表示する @handle
 *   photoURL    — サイドバーフッターのアバター画像
 *   children    — メインコンテンツ（mob-topbarの直下に配置）
 *   onLogout    — ログアウト処理
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, Bell, Search } from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';
import SettingsModal from '@/components/SettingsModal';

// ── Design tokens ────────────────────────────────────────────────────────────
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';

// ── PC サイドバー用ナビアイテム（16pxアイコン）────────────────────────────────
const PC_NAV = [
    { href: '/home',          label: '甲板',    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { href: '/search',        label: '乗組員',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { href: '/events',        label: 'イベント', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { href: '/media/podcasts', label: '航海記',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg> },
    { href: '/user',          label: '船室',    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

// ── モバイルボトムナビアイテム（20pxアイコン）─────────────────────────────────
const BOTTOM_NAV = [
    { href: '/home',    label: '甲板',    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { href: '/media/podcasts', label: 'メディア', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg> },
    { href: '/events',  label: 'イベント', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { href: '/user',    label: '船室',    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

// ── Props ────────────────────────────────────────────────────────────────────
interface AppShellProps {
    activeHref: string;
    currentUid: string;
    userName?: string;
    userIdStr?: string;
    photoURL?: string;
    children?: React.ReactNode;
    onLogout: () => Promise<void>;
    /** モバイルのみトップバーを非表示にする（PCサイドバーはそのまま） */
    hideTopbarOnMobile?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AppShell({
    activeHref,
    currentUid,
    userName,
    userIdStr,
    photoURL,
    children,
    onLogout,
    hideTopbarOnMobile = false,
}: AppShellProps) {
    const [showNotif,    setShowNotif]    = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // ── ベルボタン ───────────────────────────────────────────────────────────
    const bellBtn = (size: number, dotSize: number) => (
        <button
            type="button"
            onClick={() => setShowNotif(true)}
            style={{
                width: size, height: size, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#d4ead9', cursor: 'pointer', position: 'relative', flexShrink: 0,
            }}
            title="通知"
        >
            <Bell size={size === 32 ? 14 : 13} />
            <span style={{
                position: 'absolute',
                top: dotSize === 6 ? 4 : 3, right: dotSize === 6 ? 4 : 3,
                width: dotSize, height: dotSize,
                background: '#ef4444', borderRadius: '50%',
                border: `1.5px solid ${SB}`,
            }} />
        </button>
    );

    // ── 設定ボタン ───────────────────────────────────────────────────────────
    const settingsBtn = (size: number) => (
        <button
            type="button"
            onClick={() => setShowSettings(true)}
            style={{
                width: size, height: size, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#d4ead9', cursor: 'pointer', flexShrink: 0,
            }}
            title="設定"
        >
            <Settings size={size === 32 ? 13 : 14} />
        </button>
    );

    return (
        <>
            {/*
             * ── ルートフレックスコンテナ ──────────────────────────────────
             * /user ページの
             *   <div style={{display:'flex', minHeight:'100dvh', ...}}>
             *     <nav hidden lg:flex>     ← PC固定サイドバー
             *     <div lg:ml-[220px]>      ← メインエリア
             * と同じ構造
             */}
            <div style={{
                display: 'flex', minHeight: '100dvh',
                fontFamily: "'Inter','Noto Sans JP',system-ui,sans-serif",
                fontSize: 14, lineHeight: 1.5,
                WebkitFontSmoothing: 'antialiased',
            }}>

                {/* ── PC Sidebar (position:fixed、モバイルでは display:none) ── */}
                <nav
                    className="hidden lg:flex"
                    style={{
                        width: 220, flexShrink: 0,
                        position: 'fixed', top: 0, left: 0, height: '100vh',
                        flexDirection: 'column', background: SB,
                        boxShadow: '4px 0 24px rgba(0,0,0,.18)', zIndex: 50,
                    }}
                >
                    {/* Logo + Bell */}
                    <div style={{
                        padding: '18px 20px 14px',
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '.18em', color: '#fff' }}>NOAH</div>
                            <div style={{ fontSize: 10, color: '#7aab88', marginTop: 3, letterSpacing: '.04em' }}>誰も一人にしない</div>
                        </div>
                        {bellBtn(30, 7)}
                    </div>

                    {/* Nav links */}
                    <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
                        {PC_NAV.map(item => {
                            const active = item.href === activeHref;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 12px', borderRadius: 10,
                                        color: active ? '#fff' : '#7aab88',
                                        cursor: 'pointer', transition: 'all .15s',
                                        border: 'none', background: active ? 'rgba(163,230,53,.08)' : 'none',
                                        fontSize: 13, fontWeight: 500, textDecoration: 'none', position: 'relative',
                                    }}
                                >
                                    {active && (
                                        <span style={{
                                            position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
                                            borderRadius: '0 3px 3px 0', background: LIME,
                                        }} />
                                    )}
                                    <span style={{ opacity: active ? 1 : .7, color: active ? LIME : 'inherit' }}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Footer: user + settings */}
                    <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 10 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%', background: SAGE,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
                            }}>
                                {photoURL
                                    ? <img src={photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    : (userName || '?')[0]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#d4ead9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {userName || userIdStr || ''}
                                </div>
                                {userIdStr && (
                                    <div style={{ fontSize: 10, color: '#7aab88', marginTop: 1 }}>マイページへ</div>
                                )}
                            </div>
                            {settingsBtn(28)}
                        </div>
                    </div>
                </nav>

                {/*
                 * ── メインエリア ──────────────────────────────────────────
                 * PC:     lg:ml-[220px] でサイドバーの幅分だけ右にずれる
                 * Mobile: ml は 0 なので全幅になる（左空白なし）
                 */}
                <div
                    className="lg:ml-[220px]"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
                >
                    {/* ── Mobile Topbar（PCでは display:none、hideTopbarOnMobile=true なら非表示）── */}
                    {!hideTopbarOnMobile && (
                        <div
                            className="mob-topbar"
                            style={{
                                alignItems: 'center', justifyContent: 'space-between',
                                padding: '0 16px', height: 52, background: SB,
                                position: 'sticky', top: 0, zIndex: 40,
                                boxShadow: '0 2px 12px rgba(0,0,0,.18)',
                            }}
                        >
                            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.18em', color: '#fff' }}>NOAH</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                                <Link href="/search" className="mob-topbar-btn" style={{ width:32, height:32, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'#d4ead9', cursor:'pointer' }}>
                                    <Search size={14}/>
                                </Link>
                                {bellBtn(32, 6)}
                                {settingsBtn(32)}
                            </div>
                        </div>
                    )}

                    {/* ── ページコンテンツ ── */}
                    {children}
                </div>
            </div>


            {/* ボトムナビは GlobalBottomNav (layout.tsx) がグローバルに管理 */}

            {/* ── Modals ───────────────────────────────────────────────────── */}
            <NotificationModal
                isOpen={showNotif}
                onClose={() => setShowNotif(false)}
                currentUid={currentUid}
            />
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                currentUid={currentUid}
                onLogout={onLogout}
            />

            {/* ── CSS ──────────────────────────────────────────────────────── */}
            <style>{`
                /* Mobile topbar: flex on mobile, hidden on PC */
                .mob-topbar { display: flex; }
                @media(min-width:1024px){ .mob-topbar { display: none !important; } }

                /* AppShell使用ページで旧Navbarボトムナビを完全非表示 */
                .legacy-bottom-nav { display: none !important; }

                /* フィルタードロワーのフッターはPCではボトムナビ分の余白不要 */
                @media(min-width:1024px) {
                    .filter-footer-pb { padding-bottom: 12px !important; }
                }

                /* マップの高さ: モバイルはタブ+ボトムナビ分、PCはタブのみ */
                .ev-map-height { height: calc(100dvh - 116px); }
                @media(min-width:1024px) {
                    .ev-map-height { height: calc(100dvh - 56px); }
                }

                /* モーダルフッターはPCではボトムナビ分の余白不要 */
                @media(min-width:1024px) {
                    .modal-footer-pb { padding-bottom: 12px !important; }
                }
            `}</style>
        </>
    );
}
