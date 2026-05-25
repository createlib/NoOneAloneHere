'use client';

/**
 * PWANotifications
 *
 * 役割：
 *   1. Firestore の users/{uid}/notifications (isRead==false) をリアルタイム監視
 *   2. 新しい通知ドキュメントが追加されたとき、ユーザーの通知設定に応じて
 *      OS/ブラウザのポップアップ（HTML5 Notification）を出す
 *
 * 重要な設計方針：
 *   - 通知ボックス（NotificationModal）には常にすべての通知が届く
 *     （Firestore への書き込みは設定に関係なく行われる）
 *   - 設定 (notif_follow, notif_new_member など) は
 *     OSポップアップを鳴らすかどうかのみを制御する
 */

import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

// 通知 type → 設定キー のマッピング
const TYPE_TO_SETTING: Record<string, string> = {
    follow:      'notif_follow',
    mutual:      'notif_mutual',
    new_member:  'notif_new_member',
    event_join:  'notif_event_join',
    live_start:  'notif_live_start',
    new_video:   'notif_new_video',
    new_podcast: 'notif_new_podcast',
    system:      'notif_system',
};

export default function PWANotifications() {
    const { user } = useAuth();

    // 通知設定をキャッシュ（毎回 Firestore を叩かないように ref で保持）
    const settingsRef = useRef<Record<string, boolean>>({});
    const settingsLoadedRef = useRef(false);

    // OS 通知の許可を求める
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission().catch(console.warn);
        }
    }, []);

    // 通知設定を読み込む
    useEffect(() => {
        if (!user) return;

        const loadSettings = async () => {
            try {
                const snap = await getDoc(
                    doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data')
                );
                if (snap.exists()) {
                    const d = snap.data();
                    // 設定が存在すればその値を使う。存在しない（未設定）場合はデフォルトで true
                    settingsRef.current = {
                        notif_follow:      d.notif_follow      ?? true,
                        notif_mutual:      d.notif_mutual      ?? true,
                        notif_new_member:  d.notif_new_member  ?? true,
                        notif_event_join:  d.notif_event_join  ?? true,
                        notif_live_start:  d.notif_live_start  ?? true,
                        notif_new_video:   d.notif_new_video   ?? true,
                        notif_new_podcast: d.notif_new_podcast ?? true,
                        notif_system:      d.notif_system      ?? true,
                    };
                } else {
                    // プロフィールがない場合はすべてオン
                    settingsRef.current = Object.fromEntries(
                        Object.values(TYPE_TO_SETTING).map(k => [k, true])
                    );
                }
            } catch (e) {
                console.warn('通知設定の読み込みに失敗しました', e);
                // 読み込み失敗時はすべてオンとして扱う
                settingsRef.current = Object.fromEntries(
                    Object.values(TYPE_TO_SETTING).map(k => [k, true])
                );
            }
            settingsLoadedRef.current = true;
        };

        loadSettings();
    }, [user]);

    // Firestore リアルタイム監視 → ポップアップ制御
    useEffect(() => {
        if (!user) return;

        let initialLoad = true;

        const q = query(
            collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications'),
            where('isRead', '==', false)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            // アプリバッジ更新（未読数表示）
            if (typeof navigator !== 'undefined' && (navigator as any).setAppBadge) {
                (navigator as any).setAppBadge(snapshot.docs.length).catch(console.warn);
            }

            // 初回マウント時の既存未読分はポップアップしない
            if (initialLoad) {
                initialLoad = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                if (change.type !== 'added') return;

                const data = change.doc.data();

                // ── 通知書き込み（Firestore への保存）は設定に関係なく常に行われている ──
                // ここではポップアップを出すかだけを判定する

                // 設定がまだ読み込まれていない場合はデフォルトでポップアップを出す
                const settingKey = TYPE_TO_SETTING[data.type] ?? 'notif_system';
                const popupEnabled = settingsLoadedRef.current
                    ? (settingsRef.current[settingKey] ?? true)
                    : true;

                // 設定がオフなら OS ポップアップをスキップ
                // （通知ボックスには既に届いている）
                if (!popupEnabled) return;

                // タイトル・本文のフォールバック
                let nTitle = data.title;
                let nBody  = data.body;

                if (!nTitle || !nBody) {
                    switch (data.type) {
                        case 'live_start':
                            nTitle = 'NOAH SIGNAL CAST';
                            nBody  = 'フォローしているユーザーが配信を開始しました。';
                            break;
                        case 'new_podcast':
                            nTitle = '新しい音声の配信';
                            nBody  = 'フォローしているユーザーが音声を配信しました。';
                            break;
                        case 'new_video':
                            nTitle = '新しい動画の公開';
                            nBody  = 'フォローしているユーザーが動画を公開しました。';
                            break;
                        case 'follow':
                            nTitle = '新しい共鳴者';
                            nBody  = '誰かがあなたをフォローしました。';
                            break;
                        case 'mutual':
                            nTitle = '相互フォロー成立';
                            nBody  = '相互フォローが成立しました！';
                            break;
                        case 'event_join':
                            nTitle = 'イベント参加通知';
                            nBody  = '誰かがあなたのイベントに参加しました。';
                            break;
                        case 'new_member':
                            nTitle = '新規乗船者';
                            nBody  = 'あなたの紹介で新しいメンバーが参加しました。';
                            break;
                        default:
                            nTitle = 'NOAH';
                            nBody  = '新しい通知があります';
                    }
                }

                // 15秒以内の新着のみポップアップ（バックログのフラッド防止）
                const createdAtMs = data.createdAt
                    ? (typeof data.createdAt === 'number'
                        ? data.createdAt
                        : data.createdAt.toMillis?.() ?? 0)
                    : 0;

                if (Date.now() - createdAtMs >= 15000) return;

                if (
                    typeof window !== 'undefined' &&
                    'Notification' in window &&
                    Notification.permission === 'granted'
                ) {
                    const n = new Notification(nTitle, {
                        body:  nBody,
                        icon:  '/img/icon.png',
                        badge: '/img/icon.png',
                        tag:   change.doc.id,
                    });

                    n.onclick = () => {
                        window.focus();
                        n.close();
                    };
                }
            });
        });

        return () => unsub();
    }, [user]);

    return null;
}
