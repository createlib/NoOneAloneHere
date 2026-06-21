'use client';

import React, { useState } from 'react';
import { ChevronDown, ExternalLink, Play } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────── */
const BG     = '#f8f6f3';
const SB     = '#1a3024';
const SAGE   = '#4a7c59';
const LIME   = '#8ecfb2';
const T1     = '#2a2520';
const T2     = '#7a7068';
const TM     = '#b0a89e';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';

/* ══════════════════════════════════════════════════════════════
 *  アコーディオン（ビュー側）
 * ══════════════════════════════════════════════════════════════ */
function AccordionBlock({ title, bodyHtml }: { title: string; bodyHtml: string }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{
            border: '1px solid rgba(74,124,89,.22)',
            borderRadius: 12, marginBottom: 14,
            overflow: 'hidden', boxShadow: NEU_SM,
        }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', border: 'none', textAlign: 'left',
                    background: open ? 'rgba(74,124,89,.08)' : BG,
                    cursor: 'pointer', transition: 'background .2s',
                }}
            >
                <ChevronDown
                    size={16} color={SAGE}
                    style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .22s', flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: T1, flex: 1 }}>{title}</span>
            </button>

            <div style={{
                maxHeight: open ? 2000 : 0,
                overflow: 'hidden',
                transition: 'max-height .3s ease',
            }}>
                <div
                    className="article-body"
                    style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(74,124,89,.12)' }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  タブ（ビュー側）
 * ══════════════════════════════════════════════════════════════ */
interface TabData { label: string; content: string; }

function TabsBlock({ tabs }: { tabs: TabData[] }) {
    const [activeIdx, setActiveIdx] = useState(0);

    if (tabs.length === 0) return null;

    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: NEU_SM, marginBottom: 16 }}>
            {/* タブヘッダー（横スクロール対応） */}
            <div
                style={{
                    display: 'flex', background: BG,
                    borderBottom: '1px solid rgba(0,0,0,.08)',
                    overflowX: 'auto',
                    /* スクロールバー非表示 */
                    scrollbarWidth: 'none',
                    /* iOS スムーズスクロール */
                    WebkitOverflowScrolling: 'touch' as any,
                }}
                /* Webkit 用スクロールバー非表示 */
                className="noah-tabs-header"
            >
                {tabs.map((tab, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        style={{
                            padding: '10px 20px', border: 'none', flexShrink: 0,
                            borderBottom: i === activeIdx ? `2.5px solid ${SAGE}` : '2.5px solid transparent',
                            background: 'transparent',
                            fontSize: 13, fontWeight: i === activeIdx ? 700 : 500,
                            color: i === activeIdx ? T1 : TM,
                            cursor: 'pointer', transition: 'all .15s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* アクティブタブのコンテンツ */}
            <div
                className="article-body"
                key={activeIdx}
                style={{ padding: '16px 20px', minHeight: 80, background: BG }}
                dangerouslySetInnerHTML={{ __html: tabs[activeIdx]?.content || '' }}
            />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  横スクロール画像ギャラリー（ビュー側）+ ライトボックス
 * ══════════════════════════════════════════════════════════════ */
function GalleryBlock({ images }: { images: string[] }) {
    const [lightboxIdx, setLightboxIdx] = React.useState<number | null>(null);
    const touchStartX = React.useRef<number>(0);

    if (images.length === 0) return null;

    const prev = () => setLightboxIdx(i => i !== null ? (i - 1 + images.length) % images.length : null);
    const next = () => setLightboxIdx(i => i !== null ? (i + 1) % images.length : null);
    const close = () => setLightboxIdx(null);

    return (
        <>
            {/* 横スクロールギャラリー */}
            <div style={{
                display: 'flex', gap: 8,
                overflowX: 'auto', padding: '4px 0 12px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(74,124,89,.3) transparent',
                marginBottom: 8,
                WebkitOverflowScrolling: 'touch' as any,
            }}>
                {images.map((url, i) => (
                    <div
                        key={i}
                        onClick={() => setLightboxIdx(i)}
                        style={{
                            flexShrink: 0,
                            height: 200,
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: 10,
                            overflow: 'hidden',
                            boxShadow: NEU_SM,
                            background: '#111',
                        }}
                    >
                        <img
                            src={url}
                            alt={`gallery-${i + 1}`}
                            style={{
                                height: '100%',
                                width: 'auto',          // 縦画像でも横幅が自動調整される
                                maxWidth: 280,          // 横長画像の上限
                                objectFit: 'contain',   // 全体表示（切り抜きなし）
                                display: 'block',
                            }}
                        />
                        {/* 枚数バッジ */}
                        <div style={{
                            position: 'absolute', bottom: 6, left: 6,
                            background: 'rgba(0,0,0,.55)', color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 6px', borderRadius: 5,
                        }}>{i + 1}/{images.length}</div>
                    </div>
                ))}
            </div>

            {lightboxIdx !== null && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9000,
                        background: 'rgba(0,0,0,.92)',
                        display: 'flex', flexDirection: 'column',   // ← flexColumnに変更
                        alignItems: 'stretch',
                        touchAction: 'none',
                    }}
                    onClick={close}
                    onKeyDown={e => {
                        if (e.key === 'ArrowLeft') { e.stopPropagation(); prev(); }
                        if (e.key === 'ArrowRight') { e.stopPropagation(); next(); }
                        if (e.key === 'Escape') close();
                    }}
                    tabIndex={0}
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                        const dx = e.changedTouches[0].clientX - touchStartX.current;
                        if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
                    }}
                >
                    {/* 閉じるボタン */}
                    <button
                        onClick={e => { e.stopPropagation(); close(); }}
                        style={{
                            position: 'absolute', top: 16, right: 16,
                            width: 40, height: 40, borderRadius: '50%',
                            border: 'none', background: 'rgba(255,255,255,.15)',
                            color: '#fff', fontSize: 20, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10,
                        }}
                    >✕</button>

                    {/* 枚数表示 */}
                    <div style={{
                        position: 'absolute', top: 20, left: '50%',
                        transform: 'translateX(-50%)',
                        color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 700,
                        background: 'rgba(0,0,0,.4)', padding: '4px 12px', borderRadius: 20,
                        zIndex: 10, whiteSpace: 'nowrap',
                    }}>
                        {lightboxIdx + 1} / {images.length}
                    </div>

                    {/* 前へボタン */}
                    {images.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); prev(); }}
                            style={{
                                position: 'absolute', left: 12, top: '50%',
                                transform: 'translateY(-50%)',
                                width: 44, height: 44, borderRadius: '50%',
                                border: 'none', background: 'rgba(255,255,255,.2)',
                                color: '#fff', fontSize: 20, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(4px)',
                                transition: 'background .15s',
                                zIndex: 10,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.35)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                        >‹</button>
                    )}

                    {/* 次へボタン */}
                    {images.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); next(); }}
                            style={{
                                position: 'absolute', right: 12, top: '50%',
                                transform: 'translateY(-50%)',
                                width: 44, height: 44, borderRadius: '50%',
                                border: 'none', background: 'rgba(255,255,255,.2)',
                                color: '#fff', fontSize: 20, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(4px)',
                                transition: 'background .15s',
                                zIndex: 10,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.35)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                        >›</button>
                    )}

                    {/* ── メイン画像エリア（flex:1 で残り高さを占有） ───────── */}
                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,           // flex子要素のshrinkを正しく機能させる
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '56px 64px 12px', // 上: 閉じるボタン+枚数バッジ確保, 左右: 前後ボタン確保
                            overflow: 'hidden',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={images[lightboxIdx]}
                            alt={`gallery-${lightboxIdx + 1}`}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                borderRadius: 12,
                                boxShadow: '0 20px 80px rgba(0,0,0,.8)',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                display: 'block',
                            }}
                        />
                    </div>

                    {/* ── サムネイルストリップ（flexShrink:0 で高さを確保） ── */}
                    {images.length > 1 && (
                        <div
                            style={{
                                flexShrink: 0,
                                display: 'flex', gap: 6, padding: '8px 16px 16px',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,.4)',
                                overflowX: 'auto',
                                scrollbarWidth: 'none',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {images.map((url, i) => (
                                <img
                                    key={i} src={url} alt=""
                                    onClick={e => { e.stopPropagation(); setLightboxIdx(i); }}
                                    style={{
                                        width: 48, height: 48, borderRadius: 6,
                                        objectFit: 'cover', cursor: 'pointer',
                                        flexShrink: 0,
                                        opacity: i === lightboxIdx ? 1 : 0.5,
                                        border: i === lightboxIdx ? '2px solid #8ecfb2' : '2px solid transparent',
                                        transition: 'opacity .15s, border-color .15s',
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

        </>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  HTMLパーサー：カスタムブロックをReactノードに変換
 * ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
 *  リッチリンクカード（ビュー側）
 * ══════════════════════════════════════════════════════════════ */
interface RichLinkData {
    url: string; style: string;
    title: string; description: string;
    image: string; favicon: string; siteName: string;
    // NOAH記事用追加フィールド
    authorName?: string;
    authorIcon?: string;
    readingTime?: number;
    category?: string;
    isNoah?: boolean;
}

function RichLinkCard({ data }: { data: RichLinkData }) {
    const { url, style, title, description, image, favicon, siteName,
            authorName, authorIcon, readingTime, category, isNoah } = data;
    const displayTitle = title || url;

    // === NOAHプラットフォーム記事は専用カード ===
    if (isNoah) {
        if (style === 'banner') {
            return (
                <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
                    <div style={{
                        borderRadius: 14, overflow: 'hidden',
                        boxShadow: NEU_SM, background: BG,
                        border: '1px solid rgba(74,124,89,.12)',
                        transition: 'transform .18s, box-shadow .18s',
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                    >
                        {image && (
                            <div style={{ width: '100%', height: 180, overflow: 'hidden', background: '#eee', position: 'relative' }}>
                                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(26,48,36,.65))' }} />
                                {category && <div style={{ position: 'absolute', top: 10, left: 10, padding: '3px 8px', borderRadius: 6, background: SAGE, color: '#fff', fontSize: 9, fontWeight: 700 }}>{category}</div>}
                                <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 8px', borderRadius: 6, background: SB, color: LIME, fontSize: 9, fontWeight: 800, letterSpacing: '.06em' }}>NOAH</div>
                            </div>
                        )}
                        <div style={{ padding: '14px 16px' }}>
                            {!image && (
                                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                    {category && <span style={{ padding: '2px 7px', borderRadius: 5, background: SAGE, color: '#fff', fontSize: 9, fontWeight: 700 }}>{category}</span>}
                                    <span style={{ padding: '2px 7px', borderRadius: 5, background: SB, color: LIME, fontSize: 9, fontWeight: 800 }}>NOAH</span>
                                </div>
                            )}
                            <div style={{ fontSize: 15, fontWeight: 800, color: T1, lineHeight: 1.4, marginBottom: 8 }}>{displayTitle}</div>
                            {description && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any }}>{description}</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                {authorIcon && <img src={authorIcon} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                                {authorName && <span style={{ fontSize: 11, fontWeight: 600, color: T2 }}>{authorName}</span>}
                                {readingTime ? <span style={{ fontSize: 10, color: TM, marginLeft: 'auto' }}>&#128338; {readingTime}分</span> : null}
                            </div>
                        </div>
                    </div>
                </a>
            );
        }
        if (style === 'minimal') {
            return (
                <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 10,
                        background: BG, boxShadow: NEU_SM,
                        border: '1px solid rgba(74,124,89,.1)',
                        transition: 'transform .15s',
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                    >
                        {image ? (
                            <img src={image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(135deg, ${SB}, ${SAGE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: LIME }}>N</span>
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</div>
                            {authorName && <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>{authorName}{readingTime ? ` · ${readingTime}分` : ''}</div>}
                        </div>
                        {category && <span style={{ padding: '2px 7px', borderRadius: 5, background: SAGE, color: '#fff', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{category}</span>}
                        <span style={{ padding: '2px 7px', borderRadius: 5, background: SB, color: LIME, fontSize: 8, fontWeight: 800, flexShrink: 0 }}>NOAH</span>
                        <ExternalLink size={11} color={TM} style={{ flexShrink: 0 }} />
                    </div>
                </a>
            );
        }
        // card (NOAH default)
        return (
            <a href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
                <div style={{
                    display: 'flex', borderRadius: 14, overflow: 'hidden',
                    boxShadow: NEU_SM, background: BG,
                    border: '1px solid rgba(74,124,89,.12)', minHeight: 96,
                    transition: 'transform .18s, box-shadow .18s',
                }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                >
                    {image ? (
                        <div style={{ width: 120, flexShrink: 0, overflow: 'hidden', background: '#eee' }}>
                            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                    ) : (
                        <div style={{ width: 80, flexShrink: 0, background: `linear-gradient(135deg, ${SB}, ${SAGE})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: LIME, letterSpacing: '.04em' }}>NOAH</span>
                        </div>
                    )}
                    <div style={{ flex: 1, padding: '10px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                                {category && <span style={{ padding: '1px 6px', borderRadius: 4, background: SAGE, color: '#fff', fontSize: 8, fontWeight: 700 }}>{category}</span>}
                                <span style={{ padding: '1px 6px', borderRadius: 4, background: SB, color: LIME, fontSize: 8, fontWeight: 800 }}>NOAH</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T1, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any }}>{displayTitle}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            {authorIcon && <img src={authorIcon} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                            {authorName && <span style={{ fontSize: 10, fontWeight: 600, color: T2 }}>{authorName}</span>}
                            {readingTime ? <span style={{ fontSize: 9, color: TM, marginLeft: 'auto' }}>&#128338; {readingTime}分</span> : null}
                        </div>
                    </div>
                    <div style={{ padding: '10px 10px 10px 0', display: 'flex', alignItems: 'center' }}>
                        <ExternalLink size={11} color={TM} />
                    </div>
                </div>
            </a>
        );
    }

    // === 外部URL埋め込み (OGPカード) ===

    if (style === 'banner') {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
                <div style={{
                    borderRadius: 14, overflow: 'hidden', boxShadow: NEU_SM,
                    background: BG, border: '1px solid rgba(0,0,0,.06)',
                    transition: 'transform .18s, box-shadow .18s',
                }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 16px #d5d1cc,-4px -4px 16px #ffffff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = NEU_SM; }}
                >
                    {image && (
                        <div style={{ width: '100%', height: 180, overflow: 'hidden', background: '#eee' }}>
                            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                    )}
                    <div style={{ padding: '14px 16px' }}>
                        {siteName && <div style={{ fontSize: 10, color: TM, marginBottom: 4, fontWeight: 600, letterSpacing: '.05em' }}>{siteName}</div>}
                        <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.4 }}>{displayTitle}</div>
                        {description && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                            {favicon && <img src={favicon} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                            <span style={{ fontSize: 10, color: TM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{url}</span>
                            <ExternalLink size={10} color={TM} style={{ flexShrink: 0 }} />
                        </div>
                    </div>
                </div>
            </a>
        );
    }

    if (style === 'minimal') {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: BG, boxShadow: NEU_SM,
                    border: '1px solid rgba(0,0,0,.05)',
                    transition: 'transform .15s',
                }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                >
                    {favicon ? (
                        <img src={favicon} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'contain', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                        <ExternalLink size={14} color={SAGE} style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: T1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
                    {siteName && <span style={{ fontSize: 10, color: TM, flexShrink: 0 }}>{siteName}</span>}
                    <ExternalLink size={11} color={TM} style={{ flexShrink: 0 }} />
                </div>
            </a>
        );
    }

    // card (default)
    return (
        <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
            <div style={{
                display: 'flex', gap: 0,
                borderRadius: 14, overflow: 'hidden',
                boxShadow: NEU_SM, background: BG,
                border: '1px solid rgba(0,0,0,.06)', minHeight: 88,
                transition: 'transform .18s, box-shadow .18s',
            }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 16px #d5d1cc,-4px -4px 16px #ffffff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = NEU_SM; }}
            >
                {image && (
                    <div style={{ width: 120, flexShrink: 0, background: '#eee', overflow: 'hidden' }}>
                        <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                )}
                <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {siteName && <div style={{ fontSize: 10, color: TM, marginBottom: 3, fontWeight: 600 }}>{siteName}</div>}
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any }}>{displayTitle}</div>
                    {description && <div style={{ fontSize: 11, color: T2, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any }}>{description}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 6 }}>
                        {favicon && <img src={favicon} alt="" style={{ width: 12, height: 12, borderRadius: 2, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        <span style={{ fontSize: 10, color: TM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                    </div>
                </div>
                <div style={{ padding: '12px 12px 12px 0', display: 'flex', alignItems: 'center' }}>
                    <ExternalLink size={12} color={TM} />
                </div>
            </div>
        </a>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  動画埋め込み（ビュー側）
 * ══════════════════════════════════════════════════════════════ */
function getVideoEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)?([\w-]{11})($|[&?#])/);
    const ytSimple = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    const id = ytSimple?.[1];
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return '';
}

function getVideoThumbnail(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    return '';
}

interface VideoData { url: string; style: string; title: string; thumbnail: string; }

function VideoEmbedBlock({ data }: { data: VideoData }) {
    const { url, style, title } = data;
    const embedUrl = getVideoEmbedUrl(url);

    if (style === 'embed' && embedUrl) {
        return (
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: NEU_SM, aspectRatio: '16/9', background: '#000', marginBottom: 16 }}>
                <iframe src={embedUrl}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen title={title || 'video'} />
            </div>
        );
    }

    // text / fallback
    return (
        <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: BG, boxShadow: NEU_SM,
                border: '1px solid rgba(99,102,241,.15)',
                transition: 'transform .15s',
            }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
            >
                <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Play size={16} color="#6366f1" fill="#6366f1" style={{ marginLeft: 2 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || url}</div>
                    <div style={{ fontSize: 10, color: TM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{url}</div>
                </div>
                <ExternalLink size={13} color={TM} style={{ flexShrink: 0 }} />
            </div>
        </a>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  HTMLパーサー：カスタムブロックをReactノードに変換
 * ══════════════════════════════════════════════════════════════ */
type ArticleNode =
    | { type: 'html';       html: string }
    | { type: 'accordion';  title: string; body: string }
    | { type: 'tabs';       tabs: TabData[] }
    | { type: 'gallery';    images: string[] }
    | { type: 'richLink';   data: RichLinkData }
    | { type: 'videoEmbed'; data: VideoData };

function parseBodyToNodes(html: string): ArticleNode[] {
    if (typeof window === 'undefined') {
        return [{ type: 'html', html }];
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes: ArticleNode[] = [];
    let htmlBuffer = '';

    const flush = () => {
        if (htmlBuffer.trim()) {
            nodes.push({ type: 'html', html: htmlBuffer });
            htmlBuffer = '';
        }
    };

    for (const child of Array.from(doc.body.childNodes)) {
        if (child.nodeType !== 1 /* ELEMENT_NODE */) {
            htmlBuffer += (child as Text).textContent || '';
            continue;
        }
        const el = child as HTMLElement;
        const dataType = el.getAttribute('data-type');

        if (dataType === 'accordion') {
            flush();
            const title = el.getAttribute('data-title') || '';
            nodes.push({ type: 'accordion', title, body: el.innerHTML });

        } else if (dataType === 'tabs') {
            flush();
            const panels = Array.from(el.querySelectorAll('[data-type="tab-panel"]'));
            const tabs: TabData[] = panels.map(p => ({
                label:   p.getAttribute('data-label') || 'タブ',
                content: p.innerHTML,
            }));
            nodes.push({ type: 'tabs', tabs });

        } else if (dataType === 'image-gallery') {
            flush();
            try {
                const images: string[] = JSON.parse(el.getAttribute('data-images') || '[]');
                nodes.push({ type: 'gallery', images });
            } catch {
                // skip
            }
        } else if (dataType === 'rich-link') {
            flush();
            nodes.push({
                type: 'richLink',
                data: {
                    url:         el.getAttribute('data-url') || '',
                    style:       el.getAttribute('data-style') || 'card',
                    title:       el.getAttribute('data-title') || '',
                    description: el.getAttribute('data-description') || '',
                    image:       el.getAttribute('data-image') || '',
                    favicon:     el.getAttribute('data-favicon') || '',
                    siteName:    el.getAttribute('data-site-name') || '',
                    authorName:  el.getAttribute('data-author-name') || '',
                    authorIcon:  el.getAttribute('data-author-icon') || '',
                    readingTime: Number(el.getAttribute('data-reading-time') || 0),
                    category:    el.getAttribute('data-category') || '',
                    isNoah:      el.getAttribute('data-is-noah') === 'true',
                },
            });
        } else if (dataType === 'video-embed') {
            flush();
            nodes.push({
                type: 'videoEmbed',
                data: {
                    url:       el.getAttribute('data-url') || '',
                    style:     el.getAttribute('data-style') || 'embed',
                    title:     el.getAttribute('data-title') || '',
                    thumbnail: el.getAttribute('data-thumbnail') || '',
                },
            });
        } else {
            htmlBuffer += el.outerHTML;
        }
    }

    flush();
    return nodes;
}

/* ══════════════════════════════════════════════════════════════
 *  ArticleRenderer — メインコンポーネント
 * ══════════════════════════════════════════════════════════════ */
interface ArticleRendererProps {
    html: string;
    className?: string;
}

export function ArticleRenderer({ html, className = 'article-body' }: ArticleRendererProps) {
    const nodes = parseBodyToNodes(html);

    return (
        <div>
            {nodes.map((node, i) => {
                if (node.type === 'html') {
                    // テーブルをスクロールラッパーでくるむ
                    const wrapped = node.html
                        .replace(/<table/g, '<div class="table-wrapper"><table')
                        .replace(/<\/table>/g, '</table></div>');
                    return (
                        <div
                            key={i}
                            className={className}
                            style={{ fontSize: 15, lineHeight: 1.85, color: T1 }}
                            dangerouslySetInnerHTML={{ __html: wrapped }}
                        />
                    );
                }
                if (node.type === 'accordion') {
                    return <AccordionBlock key={i} title={node.title} bodyHtml={node.body} />;
                }
                if (node.type === 'tabs') {
                    return <TabsBlock key={i} tabs={node.tabs} />;
                }
                if (node.type === 'gallery') {
                    return <GalleryBlock key={i} images={node.images} />;
                }
                if (node.type === 'richLink') {
                    return <RichLinkCard key={i} data={node.data} />;
                }
                if (node.type === 'videoEmbed') {
                    return <VideoEmbedBlock key={i} data={node.data} />;
                }
                return null;
            })}
        </div>
    );
}
