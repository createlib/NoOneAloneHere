'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
    ArrowLeft, Save, Send, Bold, Italic, Strikethrough, Highlighter,
    Heading2, Heading3, List, ListOrdered, Quote, Code, Link as LinkIcon,
    Image as ImageIcon, Youtube as YtIcon, Minus, Table as TableIcon,
    AlignLeft, AlignCenter, Plus, X, Eye, ChevronDown, MessageSquare,
    BookOpen, Hash, Upload, Loader2, FileText, PenLine, Underline as UnderlineIcon,
    Type, Pilcrow, SquareCode, Sparkles, Layers, GalleryHorizontal, ListCollapse,
    RefreshCw, ArchiveRestore, AlertCircle,
} from 'lucide-react';
import VisibilityPicker, { VisibilityMode } from '@/components/VisibilityPicker';
import AiUpdateModal from '@/components/AiUpdateModal';
import { fetchAiUpdates, DiffSuggestion } from '@/lib/aiArticleUpdater';
import { AccordionExtension, TabsExtension, TabPanelExtension, ImageGalleryExtension } from '@/components/ArticleExtensions';

/* ── Design tokens ─────────────────────────────────────────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU  = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

const CATEGORIES = ['ノウハウ','体験記','お知らせ','コラム','インタビュー','イベントレポート'];

const lowlight = createLowlight(common);

/* ── Toolbar button ────────────────────────────────────────────── */
const TBtn = ({ active, onClick, children, title }: { active?:boolean; onClick:()=>void; children:React.ReactNode; title?:string }) => (
    <button type="button" onClick={onClick} title={title}
        style={{
            width:30, height:30, borderRadius:6, border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            background: active?SAGE:'transparent',
            color: active?'#fff':T1,
            transition:'all .15s',
        }}>
        {children}
    </button>
);

/* ══════════════════════════════════════════════════════════════════ *
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════ */
export default function ArticleEditorPage() {
    return (
        <React.Suspense fallback={<div style={{ minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center' }}><Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
            <ArticleEditorInner />
        </React.Suspense>
    );
}

function ArticleEditorInner() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    const [title, setTitle] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [coverFile, setCoverFile] = useState<File|null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [category, setCategory] = useState('ノウハウ');
    const [visibility, setVisibility] = useState<VisibilityMode>('public');
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedListIds, setAllowedListIds] = useState<string[]>([]);
    const [allowComments, setAllowComments] = useState(true);
    const [status, setStatus] = useState<'draft'|'published'>('draft');

    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState('');
    const [showPublishPanel, setShowPublishPanel] = useState(false);
    const [showBlockMenu, setShowBlockMenu] = useState(false);
    const [toolbarPos, setToolbarPos] = useState<{top:number}|null>(null);
    const [showDrafts, setShowDrafts] = useState(false);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [draftsLoading, setDraftsLoading] = useState(false);

    // タブ挿入モーダル
    const [showTabsModal, setShowTabsModal] = useState(false);
    const [tabLabels, setTabLabels] = useState(['タブ1', 'タブ2']);

    // ギャラリーアップロード中フラグ
    const [galleryUploading, setGalleryUploading] = useState(false);

    // 下書きに戻す確認モーダル
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);

    // AI 更新チェック
    const [showAiModal, setShowAiModal]       = useState(false);
    const [aiLoading, setAiLoading]           = useState(false);
    const [aiSuggestions, setAiSuggestions]   = useState<DiffSuggestion[]>([]);

    const [myProfile, setMyProfile] = useState<any>(null);
    const coverInputRef   = useRef<HTMLInputElement>(null);
    const imageInputRef   = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const editorWrapRef   = useRef<HTMLDivElement>(null);

    /* ── Tiptap editor ──────────────────────────────────────────── */
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                heading: { levels: [2, 3] },
            }),
            Placeholder.configure({ placeholder: '本文を書き始めましょう...' }),
            Image.configure({ inline: false, allowBase64: true }),
            Link.configure({ openOnClick: false, autolink: true }),
            Highlight.configure({ multicolor: true }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Youtube.configure({ controls: true }),
            Table.configure({ resizable: true }),
            TableRow, TableCell, TableHeader,
            CodeBlockLowlight.configure({ lowlight }),
            // ── カスタムブロック ────────────────────────────────
            AccordionExtension,
            TabPanelExtension,
            TabsExtension,
            ImageGalleryExtension,
        ],
        content: '',
        editorProps: {
            attributes: {
                style: `
                    font-size: 15px; line-height: 1.85; color: ${T1};
                    outline: none; min-height: 400px; padding: 0;
                    font-family: 'Noto Sans JP', -apple-system, sans-serif;
                `,
            },
        },
    });

    /* ── Load profile & edit data ──────────────────────────────── */
    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.push('/login'); return; }

        const init = async () => {
            const snap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
            if (snap.exists()) setMyProfile(snap.data());

            if (editId && editor) {
                const aSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','articles',editId));
                if (aSnap.exists()) {
                    const d = aSnap.data();
                    setTitle(d.title||'');
                    setCoverUrl(d.coverImageUrl||'');
                    setTags(d.tags||[]);
                    setCategory(d.category||'ノウハウ');
                    setVisibility(d.visibility||'public');
                    setAllowedUserIds(d.allowedUserIds||[]);
                    setAllowedListIds(d.allowedListIds||[]);
                    setAllowComments(d.allowComments!==false);
                    setStatus(d.status||'draft');
                    editor.commands.setContent(d.body||'');
                }
            }
        };
        init();
    }, [user, loading, editId, editor]);

    /* ── Track cursor position for floating toolbar ──────────── */
    useEffect(() => {
        if (!editor) return;
        const updatePos = () => {
            try {
                const { from } = editor.state.selection;
                const coords = editor.view.coordsAtPos(from);
                const wrapEl = editorWrapRef.current;
                if (wrapEl) {
                    const wrapRect = wrapEl.getBoundingClientRect();
                    // Position toolbar just below the current line
                    setToolbarPos({ top: coords.bottom - wrapRect.top + 8 });
                }
            } catch {}
        };
        editor.on('selectionUpdate', updatePos);
        editor.on('transaction', updatePos);
        editor.on('focus', updatePos);
        updatePos();
        return () => {
            editor.off('selectionUpdate', updatePos);
            editor.off('transaction', updatePos);
            editor.off('focus', updatePos);
        };
    }, [editor]);

    /* ── Auto-save every 30s ─────────────────────────────────── */
    useEffect(() => {
        if (!editor || !user) return;
        const interval = setInterval(() => {
            if (editor.getHTML() && title) {
                // 公開済み記事は published のまま静かに保存（draft に落とさない）
                // 下書きは draft のまま保存
                handleSave(status, true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [editor, user, title, status]);

    /* ── Save handler ────────────────────────────────────────── */
    const handleSave = useCallback(async (targetStatus: 'draft'|'published', silent = false) => {
        if (!user || !editor) return;
        if (!title.trim()) { if(!silent) alert('タイトルを入力してください'); return; }
        if (!silent) setSaving(true);

        try {
            let finalCoverUrl = coverUrl;

            // Upload cover if new file
            if (coverFile) {
                const cRef = ref(storage, `articles/covers/${user.uid}/${Date.now()}_${coverFile.name}`);
                const snap = await uploadBytes(cRef, coverFile);
                finalCoverUrl = await getDownloadURL(snap.ref);
                setCoverUrl(finalCoverUrl);
                setCoverFile(null);
            }

            const html = editor.getHTML();
            const plainText = editor.getText();
            const wordCount = plainText.length;
            const readingTime = Math.max(1, Math.round(wordCount / 500));

            const docId = editId || Date.now().toString();

            // Resolve custom audience: merge list members + individual users
            let resolvedAllowedUserIds: string[] = [];
            if (visibility === 'custom') {
                const uidSet = new Set(allowedUserIds);
                for (const lid of allowedListIds) {
                    try {
                        const lSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'audience_lists',lid));
                        if (lSnap.exists()) (lSnap.data().memberIds||[]).forEach((uid:string) => uidSet.add(uid));
                    } catch {}
                }
                uidSet.delete(user.uid);
                resolvedAllowedUserIds = Array.from(uidSet);
            }

            const payload: any = {
                authorId: user.uid,
                authorName: myProfile?.name || myProfile?.userId || '名無し',
                authorIcon: myProfile?.photoURL || null,
                title: title.trim(),
                body: html,
                bodyText: plainText.slice(0, 2000),
                coverImageUrl: finalCoverUrl || null,
                tags,
                category,
                status: targetStatus,
                visibility,
                allowedUserIds: visibility === 'custom' ? resolvedAllowedUserIds : [],
                allowedListIds: visibility === 'custom' ? allowedListIds : [],
                allowComments,
                readingTime,
                wordCount,
                updatedAt: new Date().toISOString(),
            };

            if (!editId) {
                payload.createdAt = new Date().toISOString();
                payload.likeCount = 0;
                payload.commentCount = 0;
                payload.viewCount = 0;
            }
            if (targetStatus === 'published' && status !== 'published') {
                payload.publishedAt = new Date().toISOString();
            }

            await setDoc(doc(db,'artifacts',APP_ID,'public','data','articles',docId), payload, { merge: true });

            // Notify on first publish
            if (targetStatus === 'published' && status !== 'published') {
                try {
                    let notifyUids: string[] = [];
                    if (visibility === 'public' || visibility === 'followers') {
                        // Notify all followers
                        const fSnap = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'followers'));
                        notifyUids = fSnap.docs.map(f => f.id);
                    } else if (visibility === 'mutual') {
                        // Notify mutual followers only
                        const fSnap = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'followers'));
                        const followingSnap = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'following'));
                        const followingIds = new Set(followingSnap.docs.map(d => d.id));
                        notifyUids = fSnap.docs.filter(f => followingIds.has(f.id)).map(f => f.id);
                    } else if (visibility === 'custom') {
                        // Notify custom audience
                        const uidSet = new Set(allowedUserIds);
                        for (const lid of allowedListIds) {
                            try {
                                const lSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'audience_lists',lid));
                                if (lSnap.exists()) (lSnap.data().memberIds||[]).forEach((uid:string) => uidSet.add(uid));
                            } catch {}
                        }
                        uidSet.delete(user.uid);
                        notifyUids = Array.from(uidSet);
                    }
                    await Promise.all(notifyUids.map(uid => addDoc(
                        collection(db,'artifacts',APP_ID,'users',uid,'notifications'),
                        { type:'new_article', fromUid:user.uid, contentId:docId, createdAt:serverTimestamp(), isRead:false }
                    )));
                } catch {}
            }

            setStatus(targetStatus);
            const now = new Date();
            setLastSaved(`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`);

            if (!silent) {
                if (targetStatus === 'published') {
                    // replace で履歴置き換え → 戻るボタンで編集画面に戻れなくする
                    router.replace(`/media/articles/view?id=${docId}`);
                } else if (targetStatus === 'draft') {
                    // 下書き保存: URL を編集 URL に更新（新規の場合のみ）
                    if (!editId) {
                        window.history.replaceState(null, '', `/media/articles/edit?id=${docId}`);
                    }
                }
            }
        } catch (e: any) {
            console.error(e);
            if (!silent) alert(`保存に失敗しました: ${e.message}`);
        } finally {
            if (!silent) setSaving(false);
        }
    }, [user, editor, title, coverUrl, coverFile, tags, category, visibility, allowedUserIds, allowedListIds, allowComments, editId, status, myProfile]);

    /* ── 下書きに戻す ────────────────────────────────────────── */
    const doRevertToDraft = useCallback(async () => {
        if (!user || !editor || !editId) return;
        setSaving(true);
        try {
            await setDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'articles', editId),
                { status: 'draft', updatedAt: new Date().toISOString() },
                { merge: true }
            );
            setStatus('draft');
            setShowRevertConfirm(false);
            // 記事一覧へ replace（戻れないように）
            router.replace('/media/podcasts?tab=article');
        } catch (e: any) {
            console.error(e);
            alert(`失敗しました: ${e.message}`);
        } finally {
            setSaving(false);
        }
    }, [user, editor, editId, router]);

    /* ── Cover image handler ─────────────────────────────────── */
    const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 10 * 1024 * 1024) { alert('カバー画像は10MB以下にしてください'); return; }
        setCoverFile(f);
        setCoverUrl(URL.createObjectURL(f));
    };

    /* ── Insert image into editor ─────────────────────────────── */
    const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f || !user || !editor) return;
        if (f.size > 10 * 1024 * 1024) { alert('画像は10MB以下にしてください'); return; }
        try {
            const iRef = ref(storage, `articles/images/${user.uid}/${Date.now()}_${f.name}`);
            const snap = await uploadBytes(iRef, f);
            const url = await getDownloadURL(snap.ref);
            editor.chain().focus().setImage({ src: url }).run();
        } catch (err) { console.error(err); alert('画像のアップロードに失敗しました'); }
    };

    /* ── Tag handlers ────────────────────────────────────────── */
    const addTag = () => {
        const t = tagInput.trim().replace(/^#/, '');
        if (t && !tags.includes(t) && tags.length < 10) {
            setTags([...tags, t]);
            setTagInput('');
        }
    };

    /* ── YouTube embed ───────────────────────────────────────── */
    const insertYoutube = () => {
        const url = prompt('YouTube URLを入力:');
        if (url && editor) editor.commands.setYoutubeVideo({ src: url });
    };

    /* ── Link ────────────────────────────────────────────────── */
    const insertLink = () => {
        if (!editor) return;
        const prev = editor.getAttributes('link').href || '';
        const url = prompt('URLを入力:', prev);
        if (url === null) return;
        if (url === '') { editor.chain().focus().unsetLink().run(); return; }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    /* ── アコーディオン挿入 ──────────────────────────────────── */
    const insertAccordion = () => {
        if (!editor) return;
        editor.chain().focus().insertContent({
            type: 'accordion',
            attrs: { title: 'クリックして見出しを編集' },
            content: [{ type: 'paragraph' }],
        }).run();
    };

    /* ── タブ挿入 ────────────────────────────────────────────── */
    const insertTabs = () => {
        if (!editor) return;
        editor.chain().focus().insertContent({
            type: 'tabs',
            content: tabLabels.filter(l => l.trim()).map(label => ({
                type: 'tabPanel',
                attrs: { label },
                content: [{ type: 'paragraph' }],
            })),
        }).run();
        setShowTabsModal(false);
        setTabLabels(['タブ1', 'タブ2']);
    };

    /* ── ギャラリー画像アップロード ──────────────────────────── */
    const handleGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !user || !editor) return;
        setGalleryUploading(true);
        try {
            const urls: string[] = [];
            for (const f of Array.from(files)) {
                if (f.size > 10 * 1024 * 1024) continue;
                const gRef = ref(storage, `articles/gallery/${user.uid}/${Date.now()}_${f.name}`);
                const snap = await uploadBytes(gRef, f);
                urls.push(await getDownloadURL(snap.ref));
            }
            if (urls.length > 0) {
                editor.chain().focus().insertContent({
                    type: 'imageGallery',
                    attrs: { images: urls },
                }).run();
            }
        } catch (err) { console.error(err); alert('画像のアップロードに失敗しました'); }
        finally { setGalleryUploading(false); e.target.value = ''; }
    };

    /* ── Load drafts ─────────────────────────────────────────── */
    const loadDrafts = async () => {
        if (!user) return;
        setDraftsLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db,'artifacts',APP_ID,'public','data','articles'),
                where('authorId','==',user.uid),
                where('status','==','draft'),
            ));
            const list: any[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.updatedAt||b.createdAt||0).getTime() - new Date(a.updatedAt||a.createdAt||0).getTime());
            setDrafts(list);
        } catch (e) { console.error(e); }
        finally { setDraftsLoading(false); }
    };

    /* ── AI 更新チェック ─────────────────────────────────────── */
    const handleAiCheck = async () => {
        if (!editor) return;
        setShowAiModal(true);
        setAiLoading(true);
        setAiSuggestions([]);
        try {
            const results = await fetchAiUpdates(title, editor.getHTML(), tags);
            setAiSuggestions(results.map(s => ({ ...s, approved: null })));
        } catch (e) {
            console.error('AI更新チェックエラー:', e);
            alert('AI分析中にエラーが発生しました');
            setShowAiModal(false);
        } finally {
            setAiLoading(false);
        }
    };

    const handleAiApprove = (id: string) =>
        setAiSuggestions(prev => prev.map(s => s.id === id ? { ...s, approved: true } : s));
    const handleAiReject = (id: string) =>
        setAiSuggestions(prev => prev.map(s => s.id === id ? { ...s, approved: false } : s));
    const handleAiApproveAll = () =>
        setAiSuggestions(prev => prev.map(s => ({ ...s, approved: true })));
    const handleAiRejectAll = () =>
        setAiSuggestions(prev => prev.map(s => ({ ...s, approved: false })));

    const handleAiApply = async (approved: DiffSuggestion[], notifyFollowers: boolean) => {
        if (!editor) return;
        // 承認された変更をエディタに適用
        for (const s of approved) {
            if (s.type === 'title_update') {
                setTitle(s.proposedText);
            } else if (s.type === 'new_section') {
                // 末尾にセクションを追加
                editor.chain().focus().setContent(
                    editor.getHTML() + `<h2>${s.section}</h2><p>${s.proposedText.replace(/\n/g, '</p><p>')}</p>`
                ).run();
            } else {
                // 本文内の文字列を置き換え
                const currentHtml = editor.getHTML();
                if (currentHtml.includes(s.originalText)) {
                    editor.commands.setContent(currentHtml.replace(s.originalText, s.proposedText));
                } else {
                    // 見つからない場合は末尾に追記
                    editor.chain().focus().setContent(
                        currentHtml + `<p><em>（AI追記）${s.proposedText}</em></p>`
                    ).run();
                }
            }
        }
        setShowAiModal(false);
        // 自動保存
        await handleSave('draft', true);
        if (notifyFollowers) {
            alert(`${approved.length} 件の変更を適用しました。\n公開設定から「公開」を押すとフォロワーに通知されます。`);
        } else {
            alert(`${approved.length} 件の変更を適用し、下書き保存しました。`);
        }
    };

    if (!editor) return null;

    /* ══════════════════════════════════════════════════════════════ *
     *  RENDER
     * ══════════════════════════════════════════════════════════════ */
    return (
        <div style={{ minHeight:'100vh', background:BG }}>
            {/* ── Top bar ─────────────────────────────────────────── */}
            <div style={{
                position:'sticky', top:0, zIndex:100,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 16px', background:BG,
                borderBottom:'1px solid rgba(0,0,0,.06)',
                backdropFilter:'blur(10px)',
            }}>
                <button onClick={() => router.back()}
                    style={{ display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', cursor:'pointer', color:T2, fontSize:12, fontWeight:600 }}>
                    <ArrowLeft size={16} /> 戻る
                </button>

                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    {lastSaved && (
                        <span style={{ fontSize:9, color:TM, marginRight:6 }}>
                            {status === 'published' ? '更新済み' : '保存済み'} {lastSaved}
                        </span>
                    )}

                    {/* 下書き一覧（下書き/新規のみ） */}
                    {status !== 'published' && (
                        <button onClick={() => { setShowDrafts(true); loadDrafts(); }}
                            style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'7px 12px', borderRadius:10, border:'none',
                                background:BG, boxShadow:NEU_SM, fontSize:11, fontWeight:700,
                                color:SAGE, cursor:'pointer',
                            }}>
                            <FileText size={12} /> 下書き一覧
                        </button>
                    )}

                    {/* AI更新チェック（既存記事編集時のみ）*/}
                    {editId && (
                        <button
                            onClick={handleAiCheck}
                            style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'7px 12px', borderRadius:10, border:'none',
                                background:'#f0ecfc', boxShadow:NEU_SM,
                                fontSize:11, fontWeight:700, color:'#7c5cbf', cursor:'pointer',
                            }}
                            title="AIが最新情報を収集し、記事の更新箇所を提案します"
                        >
                            <Sparkles size={12} /> AI更新チェック
                        </button>
                    )}

                    {/* 下書きに戻す（公開済みのみ） */}
                    {editId && status === 'published' && (
                        <button onClick={() => setShowRevertConfirm(true)} disabled={saving}
                            style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'7px 14px', borderRadius:10, border:'none',
                                background:BG, boxShadow:NEU_SM, fontSize:11, fontWeight:700,
                                color:'#b05020', cursor:'pointer',
                            }}
                            title="公開を取り消して下書きに戻す">
                            <ArchiveRestore size={12} /> 下書きに戻す
                        </button>
                    )}

                    {/* 下書き保存（下書き/新規のみ） */}
                    {status !== 'published' && (
                        <button onClick={() => handleSave('draft')} disabled={saving}
                            style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'7px 14px', borderRadius:10, border:'none',
                                background:BG, boxShadow:NEU_SM, fontSize:11, fontWeight:700,
                                color:T2, cursor:'pointer',
                            }}>
                            <Save size={12} /> 下書き保存
                        </button>
                    )}

                    {/* 公開する / 更新する */}
                    <button onClick={() => setShowPublishPanel(true)}
                        style={{
                            display:'flex', alignItems:'center', gap:4,
                            padding:'7px 14px', borderRadius:10, border:'none',
                            background:SB, color:LIME, fontSize:11, fontWeight:800,
                            cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.2)',
                        }}>
                        {editId && status === 'published'
                            ? <><RefreshCw size={12} /> 更新する</>
                            : <><Send size={12} /> 公開する</>
                        }
                    </button>
                </div>
            </div>

            {/* ── Editor area ─────────────────────────────────────── */}
            <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 20px 100px' }}>

                {/* Cover image */}
                <div style={{ marginBottom:24 }}>
                    {coverUrl ? (
                        <div style={{ position:'relative', borderRadius:16, overflow:'hidden', boxShadow:NEU }}>
                            <img src={coverUrl} alt="" style={{ width:'100%', aspectRatio:'1280/670', objectFit:'cover', display:'block' }} />
                            <div style={{ position:'absolute', top:10, right:10, display:'flex', gap:6 }}>
                                <button onClick={() => coverInputRef.current?.click()}
                                    style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'rgba(0,0,0,.5)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }}>
                                    変更
                                </button>
                                <button onClick={() => { setCoverUrl(''); setCoverFile(null); }}
                                    style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'rgba(0,0,0,.5)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }}>
                                    削除
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => coverInputRef.current?.click()}
                            style={{
                                width:'100%', padding:'28px 20px', borderRadius:16, border:'none',
                                background:BG, boxShadow:NEU_SM, cursor:'pointer',
                                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                                color:TM, fontSize:12, fontWeight:600,
                            }}>
                            <ImageIcon size={16} /> カバー画像を追加
                        </button>
                    )}
                    <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCover} style={{ display:'none' }} />
                </div>

                {/* Title */}
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="タイトルを入力..."
                    style={{
                        width:'100%', border:'none', background:'transparent', outline:'none',
                        fontSize:28, fontWeight:800, color:T1, letterSpacing:'.01em',
                        lineHeight:1.4, marginBottom:20, fontFamily:'inherit',
                        boxSizing:'border-box',
                    }}
                />

                {/* Divider */}
                <div style={{ width:60, height:3, borderRadius:2, background:SAGE, opacity:0.3, marginBottom:24 }} />

                {/* Editor area with floating toolbar */}
                <div ref={editorWrapRef} style={{ position:'relative' }}>
                    {/* ── Floating Toolbar (follows cursor) ───────── */}
                    {editor.isFocused && toolbarPos && (
                        <div
                            onMouseDown={(e) => e.preventDefault()}
                            style={{
                            position:'absolute',
                            top: Math.max(0, toolbarPos.top),
                            left: 0, right: 0,
                            display:'flex', flexWrap:'wrap', gap:2, padding:'6px 8px',
                            borderRadius:12, background:'#fff',
                            boxShadow:'0 4px 20px rgba(0,0,0,.12)',
                            border:'1px solid rgba(0,0,0,.06)',
                            zIndex:50,
                            transition:'top .15s ease-out',
                        }}>
                            <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="太字"><Bold size={13} /></TBtn>
                            <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><Italic size={13} /></TBtn>
                            <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下線"><UnderlineIcon size={13} /></TBtn>
                            <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="取消線"><Strikethrough size={13} /></TBtn>
                            <TBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} title="ハイライト"><Highlighter size={13} /></TBtn>
                            <div style={{ width:1, background:'rgba(0,0,0,.08)', margin:'4px 2px' }} />
                            <TBtn active={editor.isActive('heading',{level:2})} onClick={() => editor.chain().focus().toggleHeading({level:2}).run()} title="H2"><Heading2 size={13} /></TBtn>
                            <TBtn active={editor.isActive('heading',{level:3})} onClick={() => editor.chain().focus().toggleHeading({level:3}).run()} title="H3"><Heading3 size={13} /></TBtn>
                            <div style={{ width:1, background:'rgba(0,0,0,.08)', margin:'4px 2px' }} />
                            <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="箇条書き"><List size={13} /></TBtn>
                            <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="番号リスト"><ListOrdered size={13} /></TBtn>
                            <TBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><Quote size={13} /></TBtn>
                            <TBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="コード"><SquareCode size={13} /></TBtn>
                            <TBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="インラインコード"><Code size={13} /></TBtn>
                            <div style={{ width:1, background:'rgba(0,0,0,.08)', margin:'4px 2px' }} />
                            <TBtn onClick={insertLink} active={editor.isActive('link')} title="リンク"><LinkIcon size={13} /></TBtn>
                            <TBtn onClick={() => imageInputRef.current?.click()} title="画像"><ImageIcon size={13} /></TBtn>
                            <TBtn onClick={insertYoutube} title="YouTube"><YtIcon size={13} /></TBtn>
                            <TBtn onClick={() => editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()} title="テーブル"><TableIcon size={13} /></TBtn>
                            <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="区切り線"><Minus size={13} /></TBtn>
                            <div style={{ width:1, background:'rgba(0,0,0,.08)', margin:'4px 2px' }} />
                            <TBtn onClick={insertAccordion} title="アコーディオン">
                                <ListCollapse size={13} />
                            </TBtn>
                            <TBtn onClick={() => setShowTabsModal(true)} title="タブブロック">
                                <Layers size={13} />
                            </TBtn>
                            <TBtn
                                onClick={() => galleryInputRef.current?.click()}
                                title={galleryUploading ? 'アップロード中...' : '画像ギャラリー'}
                            >
                                {galleryUploading
                                    ? <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }} />
                                    : <GalleryHorizontal size={13} />}
                            </TBtn>
                        </div>
                    )}

                    {/* Editor content */}
                    <EditorContent editor={editor} />
                </div>
                <input ref={imageInputRef}   type="file" accept="image/*" onChange={handleInsertImage} style={{ display:'none' }} />
                <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryImages} style={{ display:'none' }} />

                {/* Tags section */}
                <div style={{ marginTop:40, paddingTop:20, borderTop:'1px solid rgba(0,0,0,.06)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                        <Hash size={13} color={SAGE} />
                        <span style={{ fontSize:12, fontWeight:700, color:T1 }}>タグ</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                        {tags.map(t => (
                            <span key={t} style={{
                                display:'flex', alignItems:'center', gap:4,
                                padding:'4px 10px', borderRadius:8, background:BG, boxShadow:NEU_SM,
                                fontSize:11, fontWeight:600, color:SAGE,
                            }}>
                                #{t}
                                <button onClick={() => setTags(tags.filter(x => x !== t))}
                                    style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, display:'flex', padding:0 }}>
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if(e.key==='Enter') { e.preventDefault(); addTag(); } }}
                            placeholder="タグを追加..."
                            style={{
                                flex:1, padding:'7px 12px', border:'none', borderRadius:8,
                                background:BG, boxShadow:NEU_IN, fontSize:11, color:T1, outline:'none',
                            }} />
                        <button onClick={addTag}
                            style={{ padding:'7px 12px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:700, color:SAGE, cursor:'pointer' }}>
                            追加
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 公開/更新 パネル (modal) ───────────────────── */}
            {showPublishPanel && (
                <div style={{
                    position:'fixed', inset:0, zIndex:6000,
                    background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                }}
                    onClick={e => { if(e.target===e.currentTarget) setShowPublishPanel(false); }}
                >
                    <div style={{
                        width:'90%', maxWidth:440, background:BG, borderRadius:20,
                        boxShadow:'0 16px 60px rgba(0,0,0,.2)', padding:24,
                    }}>
                        {/* ヘッダー */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {editId && status === 'published'
                                    ? <RefreshCw size={16} color={SAGE} />
                                    : <Send size={16} color={SAGE} />
                                }
                                <span style={{ fontSize:15, fontWeight:800, color:T1 }}>
                                    {editId && status === 'published' ? '更新設定' : '公開設定'}
                                </span>
                            </div>
                            <button onClick={() => setShowPublishPanel(false)}
                                style={{ width:30,height:30,borderRadius:'50%',border:'none',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T2 }}>
                                <X size={13} />
                            </button>
                        </div>

                        {/* 公開ステータスバッジ（更新時のみ表示） */}
                        {editId && status === 'published' && (
                            <div style={{
                                display:'flex', alignItems:'center', gap:6,
                                padding:'8px 12px', borderRadius:10, marginBottom:16,
                                background:'rgba(74,124,89,.08)', border:'1px solid rgba(74,124,89,.2)',
                            }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:SAGE }} />
                                <span style={{ fontSize:11, fontWeight:700, color:SAGE }}>現在公開中</span>
                                <span style={{ fontSize:10, color:T2, marginLeft:4 }}>— 更新すると即時反映されます</span>
                            </div>
                        )}

                        {/* Visibility (shared component) */}
                        <VisibilityPicker
                            currentUid={user?.uid||''}
                            visibility={visibility}
                            onVisibilityChange={setVisibility}
                            selectedListIds={allowedListIds}
                            onSelectedListIdsChange={setAllowedListIds}
                            selectedUserIds={allowedUserIds}
                            onSelectedUserIdsChange={setAllowedUserIds}
                        />

                        {/* Category */}
                        <div style={{ marginBottom:18 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:T1, marginBottom:8 }}>カテゴリ</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {CATEGORIES.map(c => (
                                    <button key={c} onClick={() => setCategory(c)}
                                        style={{
                                            padding:'5px 12px', borderRadius:8, border:'none', fontSize:10, fontWeight:700, cursor:'pointer',
                                            background: category===c?SB:BG,
                                            color: category===c?LIME:T2,
                                            boxShadow: category===c?'none':NEU_SM,
                                        }}>{c}</button>
                                ))}
                            </div>
                        </div>

                        {/* Comments */}
                        <div style={{ marginBottom:24 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:T1, marginBottom:8 }}>コメント</div>
                            <div style={{ display:'flex', gap:6 }}>
                                {([true,false] as const).map(v => (
                                    <button key={String(v)} onClick={() => setAllowComments(v)}
                                        style={{
                                            flex:1, padding:'7px 0', borderRadius:8, border:'none', fontSize:10, fontWeight:700, cursor:'pointer',
                                            background: allowComments===v?SAGE:BG,
                                            color: allowComments===v?'#fff':T2,
                                            boxShadow: allowComments===v?'none':NEU_SM,
                                        }}>{v?'許可する':'許可しない'}</button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display:'flex', gap:8, flexDirection:'column' }}>
                            {/* メインボタン: キャンセル + 公開/更新 */}
                            <div style={{ display:'flex', gap:8 }}>
                                <button onClick={() => setShowPublishPanel(false)}
                                    style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700, color:T2, cursor:'pointer' }}>
                                    キャンセル
                                </button>
                                <button onClick={() => { setShowPublishPanel(false); handleSave('published'); }} disabled={saving}
                                    style={{
                                        flex:2, padding:'12px 0', borderRadius:12, border:'none',
                                        background:SB, color:LIME, fontSize:12, fontWeight:800,
                                        cursor:'pointer', boxShadow:'0 2px 12px rgba(0,0,0,.2)',
                                        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                                        opacity:saving?.6:1,
                                    }}>
                                    {saving
                                        ? <Loader2 size={14} style={{ animation:'spin .8s linear infinite' }} />
                                        : (editId && status==='published' ? <RefreshCw size={14} /> : <Send size={14} />)
                                    }
                                    {editId && status === 'published' ? '更新する' : '公開する'}
                                </button>
                            </div>
                            {/* 下書きに戻す（公開済みのみ） */}
                            {editId && status === 'published' && (
                                <button
                                    onClick={() => { setShowPublishPanel(false); setShowRevertConfirm(true); }}
                                    disabled={saving}
                                    style={{
                                        width:'100%', padding:'10px 0', borderRadius:12, border:'1px solid rgba(176,80,32,.3)',
                                        background:'rgba(176,80,32,.05)', fontSize:11, fontWeight:700,
                                        color:'#b05020', cursor:'pointer',
                                        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                                    }}>
                                    <ArchiveRestore size={13} /> 公開を取り消して下書きに戻す
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Drafts list modal ────────────────────────────────── */}
            {showDrafts && (
                <div style={{
                    position:'fixed', inset:0, zIndex:6000,
                    background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                }}
                    onClick={e => { if(e.target===e.currentTarget) setShowDrafts(false); }}
                >
                    <div style={{
                        width:'90%', maxWidth:440, background:BG, borderRadius:20,
                        boxShadow:'0 16px 60px rgba(0,0,0,.2)', padding:24,
                        maxHeight:'80vh', display:'flex', flexDirection:'column',
                    }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <FileText size={16} color={SAGE} />
                                <span style={{ fontSize:15, fontWeight:800, color:T1 }}>下書き一覧</span>
                            </div>
                            <button onClick={() => setShowDrafts(false)}
                                style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:4 }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ flex:1, overflowY:'auto' }}>
                            {draftsLoading ? (
                                <div style={{ textAlign:'center', padding:40 }}>
                                    <Loader2 size={20} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
                                </div>
                            ) : drafts.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'40px 20px' }}>
                                    <FileText size={28} color={TM} style={{ margin:'0 auto 10px' }} />
                                    <div style={{ fontSize:13, fontWeight:700, color:T2 }}>下書きはありません</div>
                                    <div style={{ fontSize:10, color:TM, marginTop:4 }}>記事を保存すると下書きとして保存されます</div>
                                </div>
                            ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                    {drafts.map(d => (
                                        <div key={d.id} style={{
                                            display:'flex', alignItems:'center', gap:10,
                                            padding:'12px 14px', borderRadius:12,
                                            background:BG, boxShadow:NEU_SM, cursor:'pointer',
                                        }}
                                            onClick={() => { router.push(`/media/articles/edit?id=${d.id}`); setShowDrafts(false); }}
                                        >
                                            {d.coverImageUrl && (
                                                <img src={d.coverImageUrl} alt=""
                                                    style={{ width:48, height:36, borderRadius:8, objectFit:'cover', flexShrink:0 }}
                                                    onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                                            )}
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontSize:12, fontWeight:700, color:T1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                                    {d.title || 'タイトルなし'}
                                                </div>
                                                <div style={{ fontSize:9, color:TM, marginTop:3 }}>
                                                    {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('ja-JP', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '日付不明'}
                                                </div>
                                            </div>
                                            <button onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm('この下書きを削除しますか？')) return;
                                                try {
                                                    await deleteDoc(doc(db,'artifacts',APP_ID,'public','data','articles',d.id));
                                                    setDrafts(prev => prev.filter(x => x.id !== d.id));
                                                } catch (err) { console.error(err); alert('削除に失敗しました'); }
                                            }}
                                                style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:4, flexShrink:0 }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 下書きに戻す 確認モーダル ─────────────────────── */}
            {showRevertConfirm && (
                <div style={{
                    position:'fixed', inset:0, zIndex:8000,
                    background:'rgba(0,0,0,.5)', backdropFilter:'blur(4px)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                }}
                    onClick={e => { if(e.target===e.currentTarget) setShowRevertConfirm(false); }}
                >
                    <div style={{
                        width:'90%', maxWidth:380, background:BG, borderRadius:20,
                        boxShadow:'0 16px 60px rgba(0,0,0,.25)', padding:28, textAlign:'center',
                    }}>
                        <div style={{
                            width:52, height:52, borderRadius:'50%',
                            background:'rgba(176,80,32,.1)', margin:'0 auto 16px',
                            display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                            <ArchiveRestore size={24} color="#b05020" />
                        </div>
                        <div style={{ fontSize:16, fontWeight:800, color:T1, marginBottom:8 }}>公開を取り消しますか？</div>
                        <div style={{ fontSize:12, color:T2, lineHeight:1.7, marginBottom:24 }}>
                            記事を下書き状態に戻します。<br />
                            公開ページからは非表示になり、<br />
                            コメントやいいねは保持されます。
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <button onClick={() => setShowRevertConfirm(false)}
                                style={{ flex:1, padding:'11px 0', borderRadius:12, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700, color:T2, cursor:'pointer' }}>
                                キャンセル
                            </button>
                            <button onClick={doRevertToDraft} disabled={saving}
                                style={{
                                    flex:2, padding:'11px 0', borderRadius:12, border:'none',
                                    background:'#b05020', color:'#fff', fontSize:12, fontWeight:800,
                                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                                    opacity:saving?.6:1,
                                }}>
                                {saving ? <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }} /> : <ArchiveRestore size={13} />}
                                下書きに戻す
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Saving overlay ──────────────────────────────────── */}
            {saving && (
                <div style={{
                    position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
                    padding:'8px 20px', borderRadius:100, background:SB, color:LIME,
                    fontSize:11, fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,.3)',
                    display:'flex', alignItems:'center', gap:8, zIndex:7000,
                }}>
                    <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }} />
                    {status === 'published' ? '更新中...' : '保存中...'}
                </div>
            )}

            {/* Editor styles */}
            <style>{`
                @keyframes spin { to { transform:rotate(360deg) } }
                .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left; color: ${TM}; pointer-events: none; height: 0;
                    font-size: 15px;
                }
                .tiptap h2 { font-size: 22px; font-weight: 800; margin: 32px 0 12px; color: ${T1}; border-bottom: 2px solid rgba(0,0,0,.06); padding-bottom: 8px; }
                .tiptap h3 { font-size: 17px; font-weight: 700; margin: 24px 0 8px; color: ${T1}; }
                .tiptap p { margin: 0 0 12px; }
                .tiptap ul, .tiptap ol { padding-left: 24px; margin: 8px 0; }
                .tiptap li { margin: 4px 0; }
                .tiptap blockquote { border-left: 3px solid ${SAGE}; padding: 8px 16px; margin: 16px 0; background: rgba(74,124,89,.04); border-radius: 0 8px 8px 0; color: ${T2}; font-style: italic; }
                .tiptap pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 10px; margin: 16px 0; overflow-x: auto; font-size: 13px; line-height: 1.6; }
                .tiptap code { background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
                .tiptap pre code { background: transparent; padding: 0; }
                .tiptap img { max-width: 100%; border-radius: 10px; margin: 16px 0; box-shadow: ${NEU_SM}; }
                .tiptap a { color: ${SAGE}; text-decoration: underline; }
                .tiptap mark { background: #fef08a; padding: 1px 4px; border-radius: 3px; }
                .tiptap hr { border: none; border-top: 2px solid rgba(0,0,0,.06); margin: 24px 0; }
                .tiptap table { border-collapse: collapse; margin: 16px 0; width: 100%; }
                .tiptap th, .tiptap td { border: 1px solid rgba(0,0,0,.1); padding: 8px 12px; font-size: 13px; }
                .tiptap th { background: rgba(74,124,89,.06); font-weight: 700; }
                .tiptap s { text-decoration: line-through; color: ${TM}; }
                .tiptap iframe { border-radius: 10px; margin: 16px 0; }
                /* ── カスタムブロック (エディタ内プレビュー) ─ */
                .tiptap [data-type="accordion"] { user-select: auto; }
                .tiptap [data-type="tabs"]      { user-select: auto; }
                .tiptap [data-type="tab-panel"] { user-select: auto; }
                .tiptap [data-type="image-gallery"] img::-webkit-scrollbar { display:none; }
            `}</style>

            {/* ── タブ挿入モーダル ─────────────────────────────── */}
            {showTabsModal && (
                <div style={{
                    position:'fixed', inset:0, zIndex:7000,
                    background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                }}
                    onClick={e => { if(e.target===e.currentTarget) setShowTabsModal(false); }}
                >
                    <div style={{
                        width:'90%', maxWidth:420, background:BG, borderRadius:20,
                        boxShadow:'0 16px 60px rgba(0,0,0,.25)', padding:24,
                    }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                            <Layers size={16} color={SAGE} />
                            <span style={{ fontSize:15, fontWeight:800, color:T1 }}>タブブロックを挿入</span>
                            <button onClick={() => setShowTabsModal(false)}
                                style={{ marginLeft:'auto', border:'none', background:'transparent', cursor:'pointer', color:TM }}>
                                <X size={18} />
                            </button>
                        </div>
                        <p style={{ fontSize:11, color:T2, marginBottom:14, lineHeight:1.6 }}>
                            タブ名を入力してください。挿入後、各タブ内容をエディタで編集できます。
                        </p>

                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                            {tabLabels.map((label, i) => (
                                <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <div style={{
                                        width:22, height:22, borderRadius:'50%', background:SAGE,
                                        color:'#fff', fontSize:10, fontWeight:700,
                                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                                    }}>{i+1}</div>
                                    <input
                                        value={label}
                                        onChange={e => setTabLabels(prev => prev.map((l,j) => j===i ? e.target.value : l))}
                                        placeholder={`タブ${i+1}の名前`}
                                        style={{
                                            flex:1, padding:'8px 12px', borderRadius:8,
                                            border:'none', background:BG, boxShadow:NEU_IN,
                                            fontSize:12, color:T1, outline:'none',
                                        }}
                                    />
                                    {tabLabels.length > 2 && (
                                        <button onClick={() => setTabLabels(prev => prev.filter((_,j)=>j!==i))}
                                            style={{ border:'none', background:'transparent', cursor:'pointer', color:TM }}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {tabLabels.length < 6 && (
                            <button onClick={() => setTabLabels(prev => [...prev, `タブ${prev.length+1}`])}
                                style={{
                                    display:'flex', alignItems:'center', gap:5, width:'100%',
                                    padding:'8px 12px', borderRadius:8, border:'none',
                                    background:BG, boxShadow:NEU_SM, fontSize:11, fontWeight:700,
                                    color:SAGE, cursor:'pointer', marginBottom:16,
                                }}>
                                <Plus size={13} /> タブを追加
                            </button>
                        )}

                        <div style={{ display:'flex', gap:10 }}>
                            <button onClick={() => setShowTabsModal(false)}
                                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700, color:T2, cursor:'pointer' }}>
                                キャンセル
                            </button>
                            <button onClick={insertTabs}
                                disabled={tabLabels.filter(l=>l.trim()).length < 2}
                                style={{
                                    flex:2, padding:'10px 0', borderRadius:10, border:'none',
                                    background:SB, color:LIME, fontSize:12, fontWeight:800,
                                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                                    opacity:tabLabels.filter(l=>l.trim()).length<2?.5:1,
                                }}>
                                <Layers size={13} /> 挿入する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI 更新チェックモーダル */}
            {showAiModal && (
                <AiUpdateModal
                    articleTitle={title}
                    suggestions={aiSuggestions}
                    isLoading={aiLoading}
                    onClose={() => setShowAiModal(false)}
                    onApply={handleAiApply}
                    onApprove={handleAiApprove}
                    onReject={handleAiReject}
                    onApproveAll={handleAiApproveAll}
                    onRejectAll={handleAiRejectAll}
                />
            )}
        </div>
    );
}
