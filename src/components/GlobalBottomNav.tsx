'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── Filled Icons for better visibility on frosted glass ──────────────────────
const HomeIcon = ({ active }: { active: boolean }) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#fff' : 'rgba(255,255,255,.55)'} stroke="none">
        <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z"/>
    </svg>
);
const SearchIcon = ({ active }: { active: boolean }) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#fff' : 'rgba(255,255,255,.55)'} stroke="none">
        <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14A4.5 4.5 0 1114 9.5 4.49 4.49 0 019.5 14z"/>
    </svg>
);
const CalendarIcon = ({ active }: { active: boolean }) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#fff' : 'rgba(255,255,255,.55)'} stroke="none">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z"/>
    </svg>
);
const UserIcon = ({ active }: { active: boolean }) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? '#fff' : 'rgba(255,255,255,.55)'} stroke="none">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
);

const NAV_ITEMS = [
    { href: '/home',   label: '甲板',     Icon: HomeIcon },
    { href: '/search', label: '乗組員',   Icon: SearchIcon },
    { href: '/events', label: 'イベント',  Icon: CalendarIcon },
    { href: '/user',   label: '船室',     Icon: UserIcon },
];

// Pages where the nav should NOT appear
const HIDDEN_PATHS = ['/login', '/register', '/contact', '/terms', '/tokusho'];

export default function GlobalBottomNav() {
    const pathname = usePathname();

    // Hide on certain pages
    if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

    return (
        <>
            <nav
                className="global-bottom-nav"
                style={{
                    display: 'flex',
                    position: 'fixed',
                    bottom: 'calc(10px + env(safe-area-inset-bottom))',
                    left: 12, right: 12,
                    height: 58,
                    // Neutral dark gray frosted glass — NOT green
                    background: 'rgba(28, 28, 32, .55)',
                    backdropFilter: 'blur(28px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
                    borderRadius: 28,
                    zIndex: 2000,
                    padding: '0 4px',
                    boxShadow: '0 4px 32px rgba(0,0,0,.3), inset 0 0.5px 0 rgba(255,255,255,.12)',
                    border: '1px solid rgba(255,255,255,.1)',
                }}
            >
                {NAV_ITEMS.map(({ href, label, Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            style={{
                                flex: 1, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: 2, cursor: 'pointer',
                                textDecoration: 'none', transition: 'all .2s',
                                position: 'relative',
                            }}
                        >
                            {/* Active highlight pill */}
                            {active && (
                                <div style={{
                                    position: 'absolute', inset: '6px 6px',
                                    background: 'rgba(255,255,255,.12)',
                                    borderRadius: 16,
                                }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>
                                <Icon active={active} />
                            </span>
                            <span style={{
                                position: 'relative', zIndex: 1,
                                fontSize: 9, fontWeight: active ? 700 : 500,
                                letterSpacing: '.02em',
                                color: active ? '#fff' : 'rgba(255,255,255,.55)',
                            }}>{label}</span>
                        </Link>
                    );
                })}
            </nav>

            <style>{`
                /* PC では非表示 */
                @media(min-width:1024px) {
                    .global-bottom-nav { display: none !important; }
                }
                /* モバイルでは body に底の余白を確保 */
                @media(max-width:1023px) {
                    body { padding-bottom: 86px !important; }
                }
            `}</style>
        </>
    );
}
