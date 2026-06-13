'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────── */
const BG     = '#f8f6f3';
const SAGE   = '#4a7c59';
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
            {/* タブヘッダー */}
            <div style={{
                display: 'flex', background: BG,
                borderBottom: '1px solid rgba(0,0,0,.08)',
                overflowX: 'auto', scrollbarWidth: 'none',
            }}>
                {tabs.map((tab, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        style={{
                            padding: '10px 18px', border: 'none', flexShrink: 0,
                            borderBottom: i === activeIdx ? `2.5px solid ${SAGE}` : '2.5px solid transparent',
                            background: 'transparent',
                            fontSize: 12, fontWeight: i === activeIdx ? 700 : 500,
                            color: i === activeIdx ? T1 : TM,
                            cursor: 'pointer', transition: 'all .15s',
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
 *  横スクロール画像ギャラリー（ビュー側）
 * ══════════════════════════════════════════════════════════════ */
function GalleryBlock({ images }: { images: string[] }) {
    if (images.length === 0) return null;

    return (
        <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', padding: '4px 0 16px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(74,124,89,.3) transparent',
            marginBottom: 8,
        }}>
            {images.map((url, i) => (
                <img
                    key={i} src={url} alt={`gallery-${i + 1}`}
                    style={{
                        height: 220, borderRadius: 10,
                        objectFit: 'cover', flexShrink: 0,
                        boxShadow: NEU_SM,
                        cursor: 'pointer',
                    }}
                    onClick={() => window.open(url, '_blank')}
                />
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
 *  HTMLパーサー：カスタムブロックをReactノードに変換
 * ══════════════════════════════════════════════════════════════ */
type ArticleNode =
    | { type: 'html';      html: string }
    | { type: 'accordion'; title: string; body: string }
    | { type: 'tabs';      tabs: TabData[] }
    | { type: 'gallery';   images: string[] };

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
                    return (
                        <div
                            key={i}
                            className={className}
                            style={{ fontSize: 15, lineHeight: 1.85, color: T1 }}
                            dangerouslySetInnerHTML={{ __html: node.html }}
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
                return null;
            })}
        </div>
    );
}
