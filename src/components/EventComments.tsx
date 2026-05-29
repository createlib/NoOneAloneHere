'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { db, APP_ID } from '@/lib/firebase';
import {
    collection, addDoc, deleteDoc, doc, onSnapshot,
    orderBy, query, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { MessageCircle, Send, Lock, Globe, Trash2, User, Loader2 } from 'lucide-react';

// ── Design tokens ────────────────────────────────────────────────────
const BG     = '#f8f6f3';
const SB     = '#1a3024';
const SAGE   = '#4a7c59';
const LIME   = '#8ecfb2';
const T1     = '#2a2520';
const T2     = '#7a7068';
const TM     = '#b0a89e';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

// ── Types ────────────────────────────────────────────────────────────
type Comment = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string;
    visibility: 'public' | 'organizer';
    createdAt: Timestamp | null;
};

type Props = {
    eventId: string;
    currentUserId: string;
    currentUserName?: string;
    currentUserPhoto?: string;
    organizerId: string;
    isOrganizer: boolean;
};

// ── Time formatter ───────────────────────────────────────────────────
function formatTime(ts: Timestamp | null): string {
    if (!ts) return '';
    const d = ts.toDate();
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'たった今';
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}日前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Avatar ───────────────────────────────────────────────────────────
function Avatar({ photoURL, name, size = 32 }: { photoURL?: string; name: string; size?: number }) {
    const [imgErr, setImgErr] = useState(false);
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            overflow: 'hidden', background: `linear-gradient(135deg, ${SB} 0%, ${SAGE} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: NEU_SM,
        }}>
            {photoURL && !imgErr ? (
                <img src={photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setImgErr(true)} />
            ) : (
                <span style={{ fontSize: size * 0.4, fontWeight: 800, color: LIME }}>
                    {(name || '?')[0].toUpperCase()}
                </span>
            )}
        </div>
    );
}

// ── CommentBubble (with inline delete confirmation) ──────────────────
function CommentBubble({ comment: c, isMine, isOrganizerComment, isPrivate, canDelete, onDelete }: {
    comment: Comment; isMine: boolean; isOrganizerComment: boolean;
    isPrivate: boolean; canDelete: boolean; onDelete: () => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div style={{
            display: 'flex',
            flexDirection: isMine ? 'row-reverse' : 'row',
            gap: 8, alignItems: 'flex-start',
        }}>
            {/* Avatar */}
            <Link href={`/user?uid=${c.authorId}`} style={{ flexShrink: 0 }}>
                <Avatar photoURL={c.authorPhotoURL} name={c.authorName} size={30} />
            </Link>

            {/* Bubble */}
            <div style={{ maxWidth: '75%', minWidth: 0 }}>
                {/* Name + time */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3,
                    flexDirection: isMine ? 'row-reverse' : 'row',
                }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, color: T1,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 120,
                    }}>
                        {c.authorName}
                    </span>
                    {isOrganizerComment && (
                        <span style={{
                            fontSize: 8, fontWeight: 700, padding: '1px 5px',
                            borderRadius: 100, background: SAGE, color: '#fff',
                        }}>
                            主催者
                        </span>
                    )}
                    {isPrivate && <Lock size={9} color="#d4a24a" />}
                    <span style={{ fontSize: 9, color: TM }}>{formatTime(c.createdAt)}</span>
                </div>

                {/* Text bubble */}
                <div style={{
                    padding: '8px 12px',
                    borderRadius: isMine ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    background: isPrivate ? 'rgba(212,162,74,.08)' : isMine ? 'rgba(74,124,89,.1)' : BG,
                    boxShadow: isPrivate ? 'none' : NEU_SM,
                    border: isPrivate ? '1px solid rgba(212,162,74,.2)' : 'none',
                    fontSize: 12, color: T1, lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                    {isPrivate && (
                        <div style={{
                            fontSize: 8, color: '#d4a24a', fontWeight: 700,
                            marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3,
                            letterSpacing: '.06em',
                        }}>
                            <Lock size={8} /> 主催者のみに表示
                        </div>
                    )}
                    {c.text}
                </div>

                {/* Delete row */}
                {canDelete && (
                    <div style={{
                        display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                        marginTop: 3,
                    }}>
                        {confirmDelete ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 9, color: '#d97070', fontWeight: 600 }}>削除しますか？</span>
                                <button
                                    onClick={() => { onDelete(); setConfirmDelete(false); }}
                                    style={{
                                        padding: '2px 10px', borderRadius: 6, border: 'none',
                                        background: '#d97070', color: '#fff', fontSize: 9,
                                        fontWeight: 700, cursor: 'pointer',
                                    }}
                                >はい</button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    style={{
                                        padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,.1)',
                                        background: BG, color: T2, fontSize: 9,
                                        fontWeight: 700, cursor: 'pointer',
                                    }}
                                >いいえ</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 3,
                                    padding: '2px 8px', borderRadius: 6,
                                    border: 'none', background: 'transparent',
                                    color: TM, fontSize: 9, cursor: 'pointer',
                                    transition: 'color .15s',
                                }}
                            >
                                <Trash2 size={9} /> 削除
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Main Component ──────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function EventComments({
    eventId, currentUserId, currentUserName, currentUserPhoto,
    organizerId, isOrganizer,
}: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'organizer'>('public');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Firestore realtime listener ──────────────────────────────────
    useEffect(() => {
        if (!eventId) return;
        const commentsRef = collection(
            db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'comments'
        );
        const q = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsub = onSnapshot(q, (snap) => {
            const list: Comment[] = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as Comment));
            setComments(list);
            setLoading(false);
            // auto-scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        }, () => setLoading(false));

        return () => unsub();
    }, [eventId]);

    // ── Filter comments by visibility ────────────────────────────────
    const visibleComments = comments.filter(c => {
        if (c.visibility === 'public') return true;
        // organizer-only: show to organizer and to the author themselves
        if (isOrganizer) return true;
        if (c.authorId === currentUserId) return true;
        return false;
    });

    // ── Send comment ─────────────────────────────────────────────────
    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        try {
            const commentsRef = collection(
                db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'comments'
            );
            await addDoc(commentsRef, {
                text: trimmed,
                authorId: currentUserId,
                authorName: currentUserName || '匿名',
                authorPhotoURL: currentUserPhoto || null,
                visibility,
                createdAt: serverTimestamp(),
            });
            setText('');
        } catch (e) {
            console.error('コメント送信エラー:', e);
            alert('コメントの送信に失敗しました。');
        }
        setSending(false);
    };

    // ── Delete comment ───────────────────────────────────────────────
    const handleDelete = async (commentId: string) => {
        try {
            await deleteDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'comments', commentId)
            );
        } catch (e) {
            console.error('コメント削除エラー:', e);
            alert('削除に失敗しました。');
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div style={{ marginTop: 20, borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MessageCircle size={14} color={SAGE} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T1, letterSpacing: '.04em' }}>
                    コメント
                </span>
                {visibleComments.length > 0 && (
                    <span style={{
                        fontSize: 10, fontWeight: 700, color: '#fff', background: SAGE,
                        borderRadius: 100, padding: '1px 7px', minWidth: 18, textAlign: 'center',
                    }}>
                        {visibleComments.length}
                    </span>
                )}
            </div>

            {/* Comments list */}
            <div
                ref={scrollRef}
                style={{
                    maxHeight: 320, overflowY: 'auto', marginBottom: 12,
                    scrollbarWidth: 'thin', scrollbarColor: '#c8c4bf transparent',
                }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Loader2 size={18} color={SAGE} style={{ animation: 'spin .8s linear infinite' }} />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                ) : visibleComments.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '24px 0', color: TM, fontSize: 12,
                    }}>
                        まだコメントはありません。<br />最初のコメントを投稿しましょう！
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {visibleComments.map(c => {
                            const isMine = c.authorId === currentUserId;
                            const isOrganizerComment = c.authorId === organizerId;
                            const isPrivate = c.visibility === 'organizer';
                            const canDelete = isMine || isOrganizer;

                            return (
                                <CommentBubble
                                    key={c.id}
                                    comment={c}
                                    isMine={isMine}
                                    isOrganizerComment={isOrganizerComment}
                                    isPrivate={isPrivate}
                                    canDelete={canDelete}
                                    onDelete={() => handleDelete(c.id)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Input area */}
            {currentUserId ? (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    padding: '12px 14px',
                    background: BG, borderRadius: 14, boxShadow: NEU_SM,
                }}>
                    {/* Text input */}
                    <div style={{ position: 'relative' }}>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="コメントを入力..."
                            rows={2}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            style={{
                                width: '100%', padding: '10px 12px',
                                border: 'none', borderRadius: 10,
                                background: BG, boxShadow: NEU_IN,
                                fontSize: 12, color: T1, outline: 'none',
                                fontFamily: 'inherit', resize: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Controls row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                        {/* Visibility toggle */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button
                                onClick={() => setVisibility('public')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 100, border: 'none',
                                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                    transition: 'all .15s',
                                    background: visibility === 'public' ? SAGE : BG,
                                    color: visibility === 'public' ? '#fff' : T2,
                                    boxShadow: visibility === 'public' ? 'none' : NEU_SM,
                                }}
                            >
                                <Globe size={10} /> 全体
                            </button>
                            <button
                                onClick={() => setVisibility('organizer')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 100, border: 'none',
                                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                    transition: 'all .15s',
                                    background: visibility === 'organizer' ? '#d4a24a' : BG,
                                    color: visibility === 'organizer' ? '#fff' : T2,
                                    boxShadow: visibility === 'organizer' ? 'none' : NEU_SM,
                                }}
                            >
                                <Lock size={10} /> 主催者のみ
                            </button>
                        </div>

                        {/* Send button */}
                        <button
                            onClick={handleSend}
                            disabled={!text.trim() || sending}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 16px', borderRadius: 100,
                                border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
                                background: text.trim() ? SB : BG,
                                color: text.trim() ? LIME : TM,
                                boxShadow: text.trim() ? 'none' : NEU_SM,
                                fontSize: 11, fontWeight: 700,
                                transition: 'all .15s',
                                opacity: sending ? 0.6 : 1,
                            }}
                        >
                            {sending ? (
                                <Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} />
                            ) : (
                                <Send size={12} />
                            )}
                            送信
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{
                    textAlign: 'center', padding: '12px 0', color: TM, fontSize: 11,
                }}>
                    コメントするにはログインが必要です
                </div>
            )}
        </div>
    );
}
