'use client';

import React, { useState, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronDown, Plus, Trash2, Layers, GalleryHorizontal, ExternalLink, Play } from 'lucide-react';

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
 *  ACCORDION
 * ══════════════════════════════════════════════════════════════ */
function AccordionNodeView({ node, updateAttributes }: any) {
    const [open, setOpen] = useState(true); // editor では常に開いて編集可能

    return (
        <NodeViewWrapper>
            <div
                data-type="accordion"
                style={{
                    border: `2px solid rgba(74,124,89,.35)`,
                    borderRadius: 12, marginBottom: 16,
                    overflow: 'hidden', background: BG, boxShadow: NEU_SM,
                }}
            >
                {/* ヘッダー */}
                <div
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: 'rgba(74,124,89,.07)',
                        borderBottom: '1px solid rgba(74,124,89,.18)',
                        cursor: 'pointer',
                    }}
                    onClick={() => setOpen(v => !v)}
                >
                    <ChevronDown
                        size={15} color={SAGE}
                        style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s', flexShrink: 0 }}
                    />
                    <input
                        value={node.attrs.title}
                        onChange={e => updateAttributes({ title: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        placeholder="アコーディオン見出しを入力..."
                        style={{
                            flex: 1, border: 'none', background: 'transparent',
                            outline: 'none', fontSize: 14, fontWeight: 700,
                            color: T1, cursor: 'text',
                            fontFamily: "'Noto Sans JP', sans-serif",
                        }}
                    />
                    <span style={{ fontSize: 9, color: TM, letterSpacing: '.08em', flexShrink: 0 }}>ACCORDION</span>
                </div>

                {/* 本文（NodeViewContentでインライン編集） */}
                {open && (
                    <div style={{ padding: '12px 16px' }}>
                        <NodeViewContent />
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
}

export const AccordionExtension = Node.create({
    name: 'accordion',
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            title: {
                default: 'クリックして見出しを編集',
                renderHTML: attrs => ({ 'data-title': attrs.title }),
                parseHTML: element => element.getAttribute('data-title') || 'クリックして見出しを編集',
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="accordion"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'accordion', class: 'noah-accordion' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AccordionNodeView);
    },
});

/* ══════════════════════════════════════════════════════════════
 *  TAB PANEL（Tabs の子ノード）
 * ══════════════════════════════════════════════════════════════ */
function TabPanelNodeView({ node, updateAttributes, getPos, editor }: any) {
    const deletePanel = () => {
        if (!editor) return;
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    };

    return (
        <NodeViewWrapper>
            <div style={{ borderTop: '1px solid rgba(0,0,0,.06)' }}>
                {/* タブ名ヘッダー */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px',
                    background: 'rgba(74,124,89,.05)',
                }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SAGE, flexShrink: 0 }} />
                    <input
                        value={node.attrs.label}
                        onChange={e => updateAttributes({ label: e.target.value })}
                        placeholder="タブ名..."
                        style={{
                            border: 'none', background: 'transparent', outline: 'none',
                            fontSize: 11, fontWeight: 700, color: SAGE, cursor: 'text',
                            fontFamily: "'Noto Sans JP', sans-serif",
                            flex: 1,
                        }}
                    />
                    <span style={{ fontSize: 9, color: TM, letterSpacing: '.06em', flexShrink: 0, marginRight: 4 }}>
                        テキスト・画像を複数追加可
                    </span>
                    <button
                        onClick={deletePanel}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: TM, display: 'flex', padding: 2 }}
                        title="このタブを削除"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>

                {/* タブ内容（インライン編集） — テキスト・画像・リストなど複数ブロックを追加可能 */}
                <div style={{ padding: '10px 12px', minHeight: 60 }}>
                    <NodeViewContent />
                </div>
            </div>
        </NodeViewWrapper>
    );
}

export const TabPanelExtension = Node.create({
    name: 'tabPanel',
    group: 'tabContent',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            label: {
                default: 'タブ',
                renderHTML: attrs => ({ 'data-label': attrs.label }),
                parseHTML: element => element.getAttribute('data-label') || 'タブ',
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="tab-panel"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tab-panel' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TabPanelNodeView);
    },
});

/* ══════════════════════════════════════════════════════════════
 *  TABS（TabPanel を束ねる親ノード）
 * ══════════════════════════════════════════════════════════════ */
function TabsNodeView({ node, editor, getPos }: any) {
    const addTab = () => {
        if (!editor) return;
        try {
            const pos = typeof getPos === 'function' ? getPos() : null;
            if (pos == null) return;
            editor.chain().focus().insertContentAt(pos + node.nodeSize - 1, {
                type: 'tabPanel',
                attrs: { label: `タブ${node.childCount + 1}` },
                content: [{ type: 'paragraph' }],
            }).run();
        } catch (e) { console.error(e); }
    };

    return (
        <NodeViewWrapper>
            <div
                data-type="tabs"
                style={{
                    border: `2px solid rgba(74,124,89,.3)`,
                    borderRadius: 12, marginBottom: 16,
                    overflow: 'hidden', background: BG, boxShadow: NEU_SM,
                }}
            >
                {/* タブブロックヘッダー */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(74,124,89,.07)',
                    borderBottom: '1px solid rgba(74,124,89,.15)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Layers size={12} color={SAGE} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: SAGE, letterSpacing: '.08em' }}>TABS BLOCK</span>
                    </div>
                    <button
                        onClick={addTab}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: SAGE, fontSize: 10, fontWeight: 700 }}
                    >
                        <Plus size={12} /> タブを追加
                    </button>
                </div>

                {/* 全タブパネルを一覧表示（NodeViewContentで管理） */}
                <NodeViewContent />
            </div>
        </NodeViewWrapper>
    );
}

export const TabsExtension = Node.create({
    name: 'tabs',
    group: 'block',
    content: 'tabPanel+',
    defining: true,

    parseHTML() {
        return [{ tag: 'div[data-type="tabs"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tabs', class: 'noah-tabs' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TabsNodeView);
    },
});

/* ══════════════════════════════════════════════════════════════
 *  IMAGE GALLERY（横スクロールギャラリー）
 * ══════════════════════════════════════════════════════════════ */
function ImageGalleryNodeView({ node, updateAttributes, deleteNode }: any) {
    const images: string[] = Array.isArray(node.attrs.images) ? node.attrs.images : [];
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const removeImage = (index: number) => {
        updateAttributes({ images: images.filter((_, i) => i !== index) });
    };

    // を8方向スクロールボタン
    const scroll = (dir: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir === 'right' ? 160 : -160, behavior: 'smooth' });
        }
    };

    return (
        <NodeViewWrapper>
            <div
                data-type="image-gallery"
                contentEditable={false}
                style={{
                    border: `2px solid rgba(74,124,89,.3)`,
                    borderRadius: 12, marginBottom: 16,
                    background: BG, boxShadow: NEU_SM,
                    // overflow: 'hidden' を削除→横スクロールが機能するように
                }}
            >
                {/* ヘッダー */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(74,124,89,.07)',
                    borderBottom: '1px solid rgba(74,124,89,.15)',
                    borderRadius: '10px 10px 0 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <GalleryHorizontal size={12} color={SAGE} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: SAGE, letterSpacing: '.08em' }}>
                            IMAGE GALLERY ({images.length}枚)
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* 左右スクロールボタン */}
                        {images.length > 2 && (
                            <>
                                <button onClick={() => scroll('left')}
                                    style={{ border: 'none', background: 'rgba(74,124,89,.15)', cursor: 'pointer', color: SAGE, display: 'flex', borderRadius: 4, padding: '2px 5px' }}
                                    title="左にスクロール"
                                >←</button>
                                <button onClick={() => scroll('right')}
                                    style={{ border: 'none', background: 'rgba(74,124,89,.15)', cursor: 'pointer', color: SAGE, display: 'flex', borderRadius: 4, padding: '2px 5px' }}
                                    title="右にスクロール"
                                >→</button>
                            </>
                        )}
                        <button
                            onClick={deleteNode}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: TM, display: 'flex' }}
                            title="ギャラリーを削除"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                {/* 横スクロール画像リスト */}
                <div
                    ref={scrollRef}
                    style={{
                        display: 'flex', gap: 8, padding: 12,
                        overflowX: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(74,124,89,.4) transparent',
                        WebkitOverflowScrolling: 'touch' as any,
                    }}
                >
                    {images.length === 0 ? (
                        <div style={{ color: TM, fontSize: 12, padding: '20px 0' }}>
                            ツールバーの「ギャラリー」ボタンから画像を追加できます
                        </div>
                    ) : (
                        images.map((url, i) => (
                            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                                <img
                                    src={url} alt=""
                                    style={{ height: 120, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                                />
                                {/* 各画像の操作ボタン (削除) */}
                                <button
                                    onClick={() => removeImage(i)}
                                    style={{
                                        position: 'absolute', top: 4, right: 4,
                                        width: 20, height: 20, borderRadius: '50%',
                                        border: 'none', background: 'rgba(0,0,0,.65)',
                                        color: '#fff', cursor: 'pointer', fontSize: 12,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >×</button>
                                {/* 番号バッジ */}
                                <div style={{
                                    position: 'absolute', bottom: 4, left: 4,
                                    padding: '1px 5px', borderRadius: 4,
                                    background: 'rgba(0,0,0,.5)', color: '#fff',
                                    fontSize: 9, fontWeight: 700,
                                }}>{i + 1}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </NodeViewWrapper>
    );
}

export const ImageGalleryExtension = Node.create({
    name: 'imageGallery',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            images: {
                default: [],
                renderHTML: attrs => ({ 'data-images': JSON.stringify(attrs.images || []) }),
                parseHTML: element => {
                    try { return JSON.parse(element.getAttribute('data-images') || '[]'); }
                    catch { return []; }
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="image-gallery"]' }];
    },

    renderHTML({ HTMLAttributes, node }) {
        // attrsから直接imagesを取得して確実に出力（HTMLAttributesの内容に音存しない場合のフォールバック対応）
        const images = node?.attrs?.images || [];
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-type': 'image-gallery',
            'data-images': JSON.stringify(images),
            class: 'noah-gallery',
        })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageGalleryNodeView);
    },
});

/* ══════════════════════════════════════════════════════════════
 *  RICH LINK CARD
 *  style: 'card' | 'banner' | 'minimal'
 * ══════════════════════════════════════════════════════════════ */
interface OgData {
    title: string;
    description: string;
    image: string;
    favicon: string;
    siteName: string;
    url: string;
    // NOAH記事用
    authorName?: string;
    authorIcon?: string;
    readingTime?: number;
    category?: string;
    isNoah?: boolean;
}

function RichLinkNodeView({ node, updateAttributes, deleteNode }: any) {
    const { url, style, title, description, image, favicon, siteName,
            authorName, authorIcon, readingTime, category, isNoah } = node.attrs;
    const [loading, setLoading] = useState(!title);
    const [ogData, setOgData] = useState<OgData>({
        title: title || '',
        description: description || '',
        image: image || '',
        favicon: favicon || '',
        siteName: siteName || '',
        url: url || '',
        authorName: authorName || '',
        authorIcon: authorIcon || '',
        readingTime: readingTime || 0,
        category: category || '',
        isNoah: isNoah || false,
    });

    useEffect(() => {
        if (!url || title) return;
        setLoading(true);

        // ドメインに依存せずパスパターンで判定（ドメイン変更に自動対応）
        const isNoahUrl = /\/media\/articles\/view[^?]*\?.*id=/i.test(url);

        if (isNoahUrl) {
            // NOAH記事はFirestoreから直接取得
            const idMatch = url.match(/[?&]id=([^&]+)/);
            if (idMatch) {
                import('@/lib/firebase').then(({ db, APP_ID }) => {
                    import('firebase/firestore').then(({ doc, getDoc }) => {
                        getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'articles', idMatch[1]))
                            .then(snap => {
                                if (snap.exists()) {
                                    const d = snap.data();
                                    const ogd: OgData = {
                                        title:      d.title || '',
                                        description: d.bodyText?.slice(0, 120) || '',
                                        image:      d.coverImageUrl || '',
                                        favicon:    '',
                                        siteName:   'NOAH',
                                        url,
                                        authorName:  d.authorName || '',
                                        authorIcon:  d.authorIcon || '',
                                        readingTime: d.readingTime || 1,
                                        category:    d.category || '',
                                        isNoah:      true,
                                    };
                                    setOgData(ogd);
                                    updateAttributes({
                                        title: ogd.title, description: ogd.description,
                                        image: ogd.image, favicon: ogd.favicon, siteName: ogd.siteName,
                                        authorName: ogd.authorName, authorIcon: ogd.authorIcon,
                                        readingTime: ogd.readingTime, category: ogd.category, isNoah: true,
                                    });
                                }
                            })
                            .catch(() => {})
                            .finally(() => setLoading(false));
                    });
                });
            } else {
                setLoading(false);
            }
            return;
        }

        // 外部URL: 静的エクスポート環境ではOGP APIが使えないため
        // 保存済み属性をそのまま使用（エディタ外観のみ）
        setLoading(false);
    }, [url]);

    const display = ogData.title ? ogData : { ...ogData, title: url };

    return (
        <NodeViewWrapper>
            <div
                data-type="rich-link"
                contentEditable={false}
                style={{ position: 'relative', marginBottom: 16 }}
            >
                {/* スタイル切替バー */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    marginBottom: 4, flexWrap: 'wrap',
                }}>
                    {(['card', 'banner', 'minimal'] as const).map(s => (
                        <button key={s} onClick={() => updateAttributes({ style: s })}
                            style={{
                                padding: '2px 8px', borderRadius: 6, border: 'none',
                                fontSize: 9, fontWeight: 700, cursor: 'pointer',
                                background: style === s ? SAGE : 'rgba(0,0,0,.06)',
                                color: style === s ? '#fff' : TM,
                                letterSpacing: '.05em',
                            }}>
                            {s === 'card' ? 'カード' : s === 'banner' ? 'バナー' : 'ミニマル'}
                        </button>
                    ))}
                    <button onClick={deleteNode}
                        style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: TM, display: 'flex' }}>
                        <Trash2 size={11} />
                    </button>
                </div>

                {loading ? (
                    <div style={{
                        padding: '14px 16px', borderRadius: 12, background: 'rgba(0,0,0,.04)',
                        fontSize: 12, color: TM, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <div style={{ width: 14, height: 14, border: `2px solid ${SAGE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                        OGP情報を取得中...
                    </div>
                ) : (
                    <RichLinkPreview data={display} style={style} />
                )}
            </div>
        </NodeViewWrapper>
    );
}

/* ══════════════════════════════════════════════════════════════
 * NOAH記事用汏え込みカード
 * ══════════════════════════════════════════════════════════════ */
function NoahArticleCardBanner({ data }: { data: OgData }) {
    return (
        <div style={{
            borderRadius: 14, overflow: 'hidden',
            boxShadow: NEU_SM, background: BG,
            border: '1px solid rgba(74,124,89,.12)',
        }}>
            {data.image && (
                <div style={{ width: '100%', height: 160, overflow: 'hidden', background: '#eee', position: 'relative' }}>
                    <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 40%, rgba(26,48,36,.7))',
                    }} />
                    {data.category && (
                        <div style={{
                            position: 'absolute', top: 10, left: 10,
                            padding: '3px 8px', borderRadius: 6,
                            background: SAGE, color: '#fff',
                            fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
                        }}>{data.category}</div>
                    )}
                    {/* NOAHバッジ */}
                    <div style={{
                        position: 'absolute', top: 10, right: 10,
                        padding: '3px 8px', borderRadius: 6,
                        background: SB, color: LIME,
                        fontSize: 9, fontWeight: 800, letterSpacing: '.06em',
                    }}>NOAH</div>
                </div>
            )}
            <div style={{ padding: '14px 16px' }}>
                {!data.image && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {data.category && (
                            <span style={{ padding: '2px 8px', borderRadius: 5, background: SAGE, color: '#fff', fontSize: 9, fontWeight: 700 }}>{data.category}</span>
                        )}
                        <span style={{ padding: '2px 8px', borderRadius: 5, background: SB, color: LIME, fontSize: 9, fontWeight: 800 }}>NOAH</span>
                    </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 800, color: T1, lineHeight: 1.4, marginBottom: 8 }}>{data.title || data.url}</div>
                {data.description && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    {data.authorIcon && <img src={data.authorIcon} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${BG}`, flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    {data.authorName && <span style={{ fontSize: 11, fontWeight: 600, color: T2 }}>{data.authorName}</span>}
                    {data.readingTime ? <span style={{ fontSize: 10, color: TM, marginLeft: 'auto' }}>&#128338; {data.readingTime}分</span> : null}
                </div>
            </div>
        </div>
    );
}

function NoahArticleCardHorizontal({ data }: { data: OgData }) {
    return (
        <div style={{
            display: 'flex', gap: 0,
            borderRadius: 14, overflow: 'hidden',
            boxShadow: NEU_SM, background: BG,
            border: '1px solid rgba(74,124,89,.12)', minHeight: 96,
        }}>
            {data.image ? (
                <div style={{ width: 120, flexShrink: 0, position: 'relative', background: '#eee', overflow: 'hidden' }}>
                    <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
            ) : (
                <div style={{ width: 80, flexShrink: 0, background: `linear-gradient(135deg, ${SB}, ${SAGE})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: LIME, letterSpacing: '.05em' }}>NOAH</span>
                </div>
            )}
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                        {data.category && <span style={{ padding: '1px 6px', borderRadius: 4, background: SAGE, color: '#fff', fontSize: 8, fontWeight: 700 }}>{data.category}</span>}
                        <span style={{ padding: '1px 6px', borderRadius: 4, background: SB, color: LIME, fontSize: 8, fontWeight: 800 }}>NOAH</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.title || data.url}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    {data.authorIcon && <img src={data.authorIcon} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    {data.authorName && <span style={{ fontSize: 10, fontWeight: 600, color: T2 }}>{data.authorName}</span>}
                    {data.readingTime ? <span style={{ fontSize: 9, color: TM, marginLeft: 'auto' }}>&#128338; {data.readingTime}分</span> : null}
                </div>
            </div>
            <div style={{ padding: '12px 10px 12px 0', display: 'flex', alignItems: 'center' }}>
                <ExternalLink size={11} color={TM} />
            </div>
        </div>
    );
}

function NoahArticleCardMinimal({ data }: { data: OgData }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: BG, boxShadow: NEU_SM,
            border: '1px solid rgba(74,124,89,.1)',
        }}>
            {data.image ? (
                <img src={data.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(135deg, ${SB}, ${SAGE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: LIME }}>N</span>
                </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title || data.url}</div>
                {data.authorName && <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>{data.authorName}{data.readingTime ? ` &#183; ${data.readingTime}分` : ''}</div>}
            </div>
            {data.category && <span style={{ padding: '2px 7px', borderRadius: 5, background: SAGE, color: '#fff', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{data.category}</span>}
            <span style={{ padding: '2px 7px', borderRadius: 5, background: SB, color: LIME, fontSize: 8, fontWeight: 800, flexShrink: 0 }}>NOAH</span>
            <ExternalLink size={11} color={TM} style={{ flexShrink: 0 }} />
        </div>
    );
}

function RichLinkPreview({ data, style }: { data: OgData; style: string }) {
    // NOAHプラットフォームの記事は専用カードで表示
    if (data.isNoah) {
        if (style === 'banner') return <NoahArticleCardBanner data={data} />;
        if (style === 'minimal') return <NoahArticleCardMinimal data={data} />;
        return <NoahArticleCardHorizontal data={data} />; // card = default
    }

    if (style === 'banner') {
        return (
            <div style={{
                borderRadius: 14, overflow: 'hidden', boxShadow: NEU_SM,
                background: BG, border: '1px solid rgba(0,0,0,.06)',
            }}>
                {data.image && (
                    <div style={{ width: '100%', height: 160, overflow: 'hidden', background: '#eee' }}>
                        <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                )}
                <div style={{ padding: '14px 16px' }}>
                    {data.siteName && <div style={{ fontSize: 10, color: TM, marginBottom: 4, fontWeight: 600, letterSpacing: '.05em' }}>{data.siteName}</div>}
                    <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.4 }}>{data.title}</div>
                    {data.description && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.description}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                        {data.favicon && <img src={data.favicon} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        <span style={{ fontSize: 10, color: TM }}>{data.url}</span>
                        <ExternalLink size={10} color={TM} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                    </div>
                </div>
            </div>
        );
    }

    if (style === 'minimal') {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: BG, boxShadow: NEU_SM,
                border: '1px solid rgba(0,0,0,.05)',
            }}>
                {data.favicon ? (
                    <img src={data.favicon} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'contain', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                    <ExternalLink size={14} color={SAGE} style={{ flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: T1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title || data.url}</span>
                {data.siteName && <span style={{ fontSize: 10, color: TM, flexShrink: 0 }}>{data.siteName}</span>}
                <ExternalLink size={11} color={TM} style={{ flexShrink: 0 }} />
            </div>
        );
    }

    // card (default)
    return (
        <div style={{
            display: 'flex', gap: 0,
            borderRadius: 14, overflow: 'hidden',
            boxShadow: NEU_SM, background: BG,
            border: '1px solid rgba(0,0,0,.06)',
            minHeight: 88,
        }}>
            {data.image && (
                <div style={{ width: 120, flexShrink: 0, background: '#eee', overflow: 'hidden' }}>
                    <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
            )}
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {data.siteName && <div style={{ fontSize: 10, color: TM, marginBottom: 3, fontWeight: 600 }}>{data.siteName}</div>}
                <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.title || data.url}</div>
                {data.description && <div style={{ fontSize: 11, color: T2, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 6 }}>
                    {data.favicon && <img src={data.favicon} alt="" style={{ width: 12, height: 12, borderRadius: 2, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <span style={{ fontSize: 10, color: TM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.url}</span>
                </div>
            </div>
            <div style={{ padding: '12px 12px 12px 0', display: 'flex', alignItems: 'center' }}>
                <ExternalLink size={12} color={TM} />
            </div>
        </div>
    );
}

export const RichLinkExtension = Node.create({
    name: 'richLink',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url:         { default: '' },
            style:       { default: 'card' },
            title:       { default: '' },
            description: { default: '' },
            image:       { default: '' },
            favicon:     { default: '' },
            siteName:    { default: '' },
            // NOAH記事用追加属性
            authorName:  { default: '' },
            authorIcon:  { default: '' },
            readingTime: { default: 0 },
            category:    { default: '' },
            isNoah:      { default: false },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="rich-link"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-type':        'rich-link',
            'data-url':         HTMLAttributes.url || '',
            'data-style':       HTMLAttributes.style || 'card',
            'data-title':       HTMLAttributes.title || '',
            'data-description': HTMLAttributes.description || '',
            'data-image':       HTMLAttributes.image || '',
            'data-favicon':     HTMLAttributes.favicon || '',
            'data-site-name':   HTMLAttributes.siteName || '',
            'data-author-name': HTMLAttributes.authorName || '',
            'data-author-icon': HTMLAttributes.authorIcon || '',
            'data-reading-time':String(HTMLAttributes.readingTime || 0),
            'data-category':    HTMLAttributes.category || '',
            'data-is-noah':     HTMLAttributes.isNoah ? 'true' : '',
            class: 'noah-rich-link',
        })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(RichLinkNodeView);
    },
});

/* ══════════════════════════════════════════════════════════════
 *  VIDEO EMBED
 *  style: 'embed' | 'text'
 * ══════════════════════════════════════════════════════════════ */
function getVideoEmbedUrl(url: string): string {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return '';
}

function getVideoThumbnail(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    return '';
}

function VideoEmbedNodeView({ node, updateAttributes, deleteNode }: any) {
    const { url, style, title } = node.attrs;
    const embedUrl = getVideoEmbedUrl(url);

    return (
        <NodeViewWrapper>
            <div
                data-type="video-embed"
                contentEditable={false}
                style={{ position: 'relative', marginBottom: 16 }}
            >
                {/* スタイル切替バー */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                    {(['embed', 'text'] as const).map(s => (
                        <button key={s} onClick={() => updateAttributes({ style: s })}
                            style={{
                                padding: '2px 8px', borderRadius: 6, border: 'none',
                                fontSize: 9, fontWeight: 700, cursor: 'pointer',
                                background: style === s ? '#6366f1' : 'rgba(0,0,0,.06)',
                                color: style === s ? '#fff' : TM,
                                letterSpacing: '.05em',
                            }}>
                            {s === 'embed' ? '⊞ 埋め込み' : '🔗 テキスト'}
                        </button>
                    ))}
                    <button onClick={deleteNode}
                        style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: TM, display: 'flex' }}>
                        <Trash2 size={11} />
                    </button>
                </div>

                {style === 'embed' && embedUrl ? (
                    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: NEU_SM, aspectRatio: '16/9', background: '#000' }}>
                        <iframe
                            src={embedUrl}
                            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    // text / fallback
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 12,
                        background: BG, boxShadow: NEU_SM,
                        border: '1px solid rgba(99,102,241,.15)',
                    }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,.1)',
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
                )}
            </div>
        </NodeViewWrapper>
    );
}

export const VideoEmbedExtension = Node.create({
    name: 'videoEmbed',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url:       { default: '' },
            style:     { default: 'embed' },
            title:     { default: '' },
            thumbnail: { default: '' },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="video-embed"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-type':      'video-embed',
            'data-url':       HTMLAttributes.url || '',
            'data-style':     HTMLAttributes.style || 'embed',
            'data-title':     HTMLAttributes.title || '',
            'data-thumbnail': HTMLAttributes.thumbnail || '',
            class: 'noah-video-embed',
        })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoEmbedNodeView);
    },
});
