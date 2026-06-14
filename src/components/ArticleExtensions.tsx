'use client';

import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronDown, Plus, Trash2, Layers, GalleryHorizontal } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────── */
const BG     = '#f8f6f3';
const SAGE   = '#4a7c59';
const T1     = '#2a2520';
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

    const removeImage = (index: number) => {
        updateAttributes({ images: images.filter((_, i) => i !== index) });
    };

    return (
        <NodeViewWrapper>
            <div
                data-type="image-gallery"
                contentEditable={false}
                style={{
                    border: `2px solid rgba(74,124,89,.3)`,
                    borderRadius: 12, marginBottom: 16,
                    overflow: 'hidden', background: BG, boxShadow: NEU_SM,
                }}
            >
                {/* ヘッダー */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(74,124,89,.07)',
                    borderBottom: '1px solid rgba(74,124,89,.15)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <GalleryHorizontal size={12} color={SAGE} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: SAGE, letterSpacing: '.08em' }}>
                            IMAGE GALLERY ({images.length}枚)
                        </span>
                    </div>
                    <button
                        onClick={deleteNode}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: TM, display: 'flex' }}
                        title="ギャラリーを削除"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>

                {/* 横スクロール画像リスト */}
                <div style={{
                    display: 'flex', gap: 8, padding: 12,
                    overflowX: 'auto', scrollbarWidth: 'none',
                }}>
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

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-gallery', class: 'noah-gallery' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageGalleryNodeView);
    },
});
