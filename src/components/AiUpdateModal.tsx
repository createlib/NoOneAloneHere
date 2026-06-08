'use client';

import React, { useState } from 'react';
import {
    X, CheckCircle2, XCircle, Sparkles, Loader2,
    ChevronRight, ExternalLink, AlertCircle, ArrowRight,
} from 'lucide-react';
import { DiffSuggestion, DiffType } from '@/lib/aiArticleUpdater';

/* ── Design tokens ─────────────────────────────────── */
const BG     = '#f8f6f3';
const SB     = '#1a3024';
const SAGE   = '#4a7c59';
const LIME   = '#8ecfb2';
const T1     = '#2a2520';
const T2     = '#7a7068';
const TM     = '#b0a89e';
const RED    = '#d97070';
const AI_CLR = '#7c5cbf'; // AI ブランドカラー（紫）
const NEU    = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

/* ── Type label map ────────────────────────────────── */
const TYPE_LABEL: Record<DiffType, string> = {
    body_update:  '本文の修正',
    new_section:  '新セクションの追加',
    title_update: 'タイトルの修正',
    price_update: '料金・数値の更新',
    link_update:  'リンクの更新',
};
const TYPE_COLOR: Record<DiffType, string> = {
    body_update:  SAGE,
    new_section:  AI_CLR,
    title_update: '#c07a3b',
    price_update: '#d97070',
    link_update:  '#5b9bd5',
};

/* ── Props ─────────────────────────────────────────── */
interface AiUpdateModalProps {
    articleTitle: string;
    suggestions: DiffSuggestion[];
    isLoading: boolean;
    onClose: () => void;
    onApply: (approved: DiffSuggestion[], notifyFollowers: boolean) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onApproveAll: () => void;
    onRejectAll: () => void;
}

/* ══════════════════════════════════════════════════════
 *  DiffCard — 差分1件のカード
 * ══════════════════════════════════════════════════════ */
function DiffCard({
    s, index, total,
    onApprove, onReject,
}: {
    s: DiffSuggestion; index: number; total: number;
    onApprove: () => void; onReject: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const typeColor = TYPE_COLOR[s.type] || SAGE;
    const isApproved = s.approved === true;
    const isRejected = s.approved === false;

    return (
        <div style={{
            borderRadius: 16,
            background: BG,
            boxShadow: isApproved
                ? `0 0 0 2px ${SAGE}, ${NEU_SM}`
                : isRejected
                ? `0 0 0 1px rgba(0,0,0,.1), ${NEU_SM}`
                : NEU_SM,
            opacity: isRejected ? 0.6 : 1,
            transition: 'all .2s',
            overflow: 'hidden',
        }}>
            {/* カードヘッダー */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: isApproved ? 'rgba(74,124,89,.06)' : isRejected ? 'rgba(0,0,0,.03)' : 'transparent',
                borderBottom: '1px solid rgba(0,0,0,.06)',
                cursor: 'pointer',
            }} onClick={() => setExpanded(!expanded)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isApproved ? (
                        <CheckCircle2 size={18} color={SAGE} />
                    ) : isRejected ? (
                        <XCircle size={18} color={TM} />
                    ) : (
                        <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: BG, boxShadow: NEU_SM,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: 9, fontWeight: 800, color: AI_CLR }}>{index}</span>
                        </div>
                    )}
                    <div>
                        <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
                            padding: '2px 8px', borderRadius: 100,
                            background: `${typeColor}18`, color: typeColor,
                            marginRight: 6,
                        }}>
                            {TYPE_LABEL[s.type]}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{s.section}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: TM }}>提案 {index}/{total}</span>
                    <ChevronRight size={14} color={TM} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                </div>
            </div>

            {expanded && (
                <div style={{ padding: '14px 16px' }}>
                    {/* 理由 */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '10px 14px', borderRadius: 10,
                        background: `${AI_CLR}08`, marginBottom: 14,
                    }}>
                        <AlertCircle size={13} color={AI_CLR} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: AI_CLR, marginBottom: 3 }}>変更理由</div>
                            <div style={{ fontSize: 11, color: T2, lineHeight: 1.6 }}>{s.reason}</div>
                            {s.sourceUrl && (
                                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 10, color: AI_CLR, textDecoration: 'none' }}
                                    onClick={e => e.stopPropagation()}>
                                    <ExternalLink size={10} />
                                    {s.sourceTitle || s.sourceUrl}
                                </a>
                            )}
                        </div>
                    </div>

                    {/* 差分 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 8, marginBottom: 14, alignItems: 'stretch' }}>
                        {/* 変更前 */}
                        <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: NEU_IN }}>
                            <div style={{ padding: '6px 12px', background: 'rgba(217,112,112,.08)', fontSize: 9, fontWeight: 700, color: RED }}>
                                変更前（現在の記事）
                            </div>
                            <div style={{ padding: '10px 12px', fontSize: 12, color: T2, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: isApproved ? 'line-through' : 'none', opacity: isApproved ? 0.5 : 1 }}>
                                {s.originalText}
                            </div>
                        </div>

                        {/* 矢印 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRight size={16} color={isApproved ? SAGE : TM} />
                        </div>

                        {/* 変更後 */}
                        <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: NEU_IN }}>
                            <div style={{ padding: '6px 12px', background: isApproved ? 'rgba(74,124,89,.1)' : `${AI_CLR}10`, fontSize: 9, fontWeight: 700, color: isApproved ? SAGE : AI_CLR }}>
                                変更後（AI提案）
                            </div>
                            <div style={{ padding: '10px 12px', fontSize: 12, color: isApproved ? '#2a2520' : T2, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: isApproved ? 600 : 400 }}>
                                {s.proposedText}
                            </div>
                        </div>
                    </div>

                    {/* 承認・却下ボタン */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={onReject} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '8px 16px', borderRadius: 10, border: 'none',
                            background: isRejected ? 'rgba(217,112,112,.15)' : BG,
                            boxShadow: isRejected ? `inset 0 0 0 1.5px ${RED}` : NEU_SM,
                            fontSize: 11, fontWeight: 700,
                            color: isRejected ? RED : TM,
                            cursor: 'pointer', transition: 'all .2s',
                        }}>
                            <XCircle size={13} /> 却下
                        </button>
                        <button onClick={onApprove} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '8px 20px', borderRadius: 10, border: 'none',
                            background: isApproved ? SAGE : BG,
                            boxShadow: isApproved ? 'none' : NEU_SM,
                            fontSize: 11, fontWeight: 700,
                            color: isApproved ? '#fff' : T2,
                            cursor: 'pointer', transition: 'all .2s',
                        }}>
                            <CheckCircle2 size={13} /> 承認
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════
 *  AiUpdateModal — メインモーダル
 * ══════════════════════════════════════════════════════ */
export default function AiUpdateModal({
    articleTitle, suggestions, isLoading,
    onClose, onApply, onApprove, onReject, onApproveAll, onRejectAll,
}: AiUpdateModalProps) {
    const [notifyFollowers, setNotifyFollowers] = useState(true);

    const approvedCount = suggestions.filter(s => s.approved === true).length;
    const totalCount = suggestions.length;
    const progress = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 8000,
            background: 'rgba(26,48,36,.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
        }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '100%', maxWidth: 780, maxHeight: '90vh',
                background: BG, borderRadius: 20,
                boxShadow: '0 20px 80px rgba(0,0,0,.35)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* ── ヘッダー ────────────────────────────────── */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(0,0,0,.06)',
                    background: BG,
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: `${AI_CLR}14`, boxShadow: NEU_SM,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Sparkles size={17} color={AI_CLR} />
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>AI更新レビュー</div>
                                <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>
                                    「{articleTitle.length > 30 ? articleTitle.slice(0, 30) + '…' : articleTitle}」
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none',
                            background: BG, boxShadow: NEU_SM, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: TM,
                        }}>
                            <X size={15} />
                        </button>
                    </div>

                    {!isLoading && totalCount > 0 && (
                        <>
                            {/* 進捗 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <div style={{ flex: 1, height: 6, borderRadius: 100, background: 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: SAGE, borderRadius: 100, transition: 'width .4s' }} />
                                </div>
                                <span style={{ fontSize: 11, color: T2, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {approvedCount} / {totalCount} 件承認
                                </span>
                            </div>

                            {/* 一括ボタン */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={onApproveAll} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '5px 12px', borderRadius: 8, border: 'none',
                                    background: BG, boxShadow: NEU_SM, cursor: 'pointer',
                                    fontSize: 10, fontWeight: 700, color: SAGE,
                                }}>
                                    <CheckCircle2 size={11} /> すべて承認
                                </button>
                                <button onClick={onRejectAll} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '5px 12px', borderRadius: 8, border: 'none',
                                    background: BG, boxShadow: NEU_SM, cursor: 'pointer',
                                    fontSize: 10, fontWeight: 700, color: TM,
                                }}>
                                    <XCircle size={11} /> すべて却下
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* ── ボディ ──────────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* ローディング */}
                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%',
                                background: `${AI_CLR}12`, boxShadow: NEU,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px',
                            }}>
                                <Loader2 size={28} color={AI_CLR} style={{ animation: 'spin .8s linear infinite' }} />
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 6 }}>AI が最新情報を収集しています...</div>
                            <div style={{ fontSize: 11, color: TM }}>記事のトピックに関連する最新情報を Web から分析しています。しばらくお待ちください。</div>
                        </div>
                    )}

                    {/* 提案なし */}
                    {!isLoading && totalCount === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <CheckCircle2 size={40} color={SAGE} style={{ margin: '0 auto 12px' }} />
                            <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>記事は最新です！</div>
                            <div style={{ fontSize: 11, color: TM }}>現時点で更新が必要な箇所は見つかりませんでした。</div>
                        </div>
                    )}

                    {/* 差分カードリスト */}
                    {!isLoading && suggestions.map((s, i) => (
                        <DiffCard
                            key={s.id} s={s}
                            index={i + 1} total={totalCount}
                            onApprove={() => onApprove(s.id)}
                            onReject={() => onReject(s.id)}
                        />
                    ))}
                </div>

                {/* ── フッター ─────────────────────────────────── */}
                {!isLoading && totalCount > 0 && (
                    <div style={{
                        padding: '14px 20px',
                        borderTop: '1px solid rgba(0,0,0,.06)',
                        background: BG, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 10,
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T2 }}>
                            <input
                                type="checkbox"
                                checked={notifyFollowers}
                                onChange={e => setNotifyFollowers(e.target.checked)}
                                style={{ accentColor: SAGE, width: 14, height: 14 }}
                            />
                            フォロワー・保存者に更新を通知する
                        </label>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={onClose} style={{
                                padding: '9px 18px', borderRadius: 10, border: 'none',
                                background: BG, boxShadow: NEU_SM, cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, color: TM,
                            }}>
                                キャンセル
                            </button>
                            <button
                                onClick={() => onApply(suggestions.filter(s => s.approved === true), notifyFollowers)}
                                disabled={approvedCount === 0}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '9px 20px', borderRadius: 10, border: 'none',
                                    background: approvedCount > 0 ? SB : BG,
                                    boxShadow: approvedCount > 0 ? 'none' : NEU_SM,
                                    color: approvedCount > 0 ? LIME : TM,
                                    fontSize: 11, fontWeight: 800,
                                    cursor: approvedCount > 0 ? 'pointer' : 'default',
                                    opacity: approvedCount === 0 ? 0.5 : 1,
                                    transition: 'all .2s',
                                }}>
                                <Sparkles size={13} />
                                {approvedCount} 件の変更を記事に反映する
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
