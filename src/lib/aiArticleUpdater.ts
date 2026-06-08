/**
 * AI記事更新チェック — 呼び出しモジュール
 *
 * Phase 1: モックデータを返すスタブ実装
 * Phase 2: 下の TODO コメント箇所に Gemini API 呼び出しを追加するだけで移行可能
 */

export type DiffType = 'body_update' | 'new_section' | 'title_update' | 'price_update' | 'link_update';

export interface DiffSuggestion {
    id: string;
    type: DiffType;
    section: string;      // "本文" "タイトル" "新セクション" など
    reason: string;       // AI が提示する変更理由
    sourceUrl?: string;   // 参照元 URL（あれば）
    sourceTitle?: string; // 参照元サイト名
    originalText: string; // 変更前テキスト
    proposedText: string; // 変更後テキスト（HTML可）
    approved: boolean | null; // null=未決定 true=承認 false=却下
}

/**
 * AI による記事更新提案を取得する
 *
 * @param articleTitle 記事タイトル
 * @param articleBody  記事本文HTML
 * @param tags         記事タグ配列
 * @returns DiffSuggestion の配列
 */
export async function fetchAiUpdates(
    articleTitle: string,
    articleBody: string,
    tags: string[]
): Promise<DiffSuggestion[]> {

    // ────────────────────────────────────────────────────────────────
    // TODO (Phase 2): 以下を実装すると本番 AI 更新が動く
    //
    // Step 1: Web 検索 API（Serper/Google）でキーワード検索
    //   const searchResults = await fetch('https://google.serper.dev/search', {
    //     method: 'POST',
    //     headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_SERPER_API_KEY, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ q: `${articleTitle} 最新情報 ${new Date().getFullYear()}`, gl:'jp', hl:'ja' })
    //   }).then(r => r.json());
    //
    // Step 2: Gemini API で差分生成
    //   const prompt = `
    //     あなたは記事更新アシスタントです。
    //     以下の記事と最新の検索結果を比較し、更新が必要な箇所を JSON 配列として返してください。
    //     記事タイトル: ${articleTitle}
    //     記事本文（HTML）: ${articleBody}
    //     最新情報: ${JSON.stringify(searchResults.organic?.slice(0,5))}
    //     出力形式: DiffSuggestion[] (id/type/section/reason/sourceUrl/originalText/proposedText)
    //   `;
    //   const response = await fetch(
    //     `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
    //     { method:'POST', headers:{'Content-Type':'application/json'},
    //       body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] }) }
    //   ).then(r => r.json());
    //   return JSON.parse(response.candidates[0].content.parts[0].text);
    // ────────────────────────────────────────────────────────────────

    // Phase 1: 動作確認用のモックデータ（記事のタイトルとタグに応じてサンプル提案を返す）
    await new Promise(r => setTimeout(r, 2000)); // API呼び出しをシミュレート

    const topicHint = tags[0] || 'テクノロジー';

    const mockSuggestions: DiffSuggestion[] = [
        {
            id: 'diff-1',
            type: 'body_update',
            section: '本文の修正',
            reason: `「${topicHint}」に関する情報が最新でない可能性があります。2025年以降の更新情報が確認されました。`,
            sourceUrl: 'https://example.com/latest',
            sourceTitle: '公式ドキュメント',
            originalText: `この記事で紹介している情報は現時点での最新仕様に基づいています。`,
            proposedText: `この記事で紹介している情報は現時点での最新仕様に基づいています（2026年6月時点）。最新の公式ドキュメントも併せてご確認ください。`,
            approved: null,
        },
        {
            id: 'diff-2',
            type: 'price_update',
            section: '料金・費用情報',
            reason: '記事内の料金情報が変更されている可能性があります。',
            sourceUrl: 'https://example.com/pricing',
            sourceTitle: '公式料金ページ',
            originalText: `プランA: 月額 ¥3,000`,
            proposedText: `プランA: 月額 ¥3,500（2025年10月より改定）`,
            approved: null,
        },
        {
            id: 'diff-3',
            type: 'new_section',
            section: '新セクションの追加提案',
            reason: '関連する新しいトピックが登場しているため、補足セクションの追加を提案します。',
            sourceUrl: 'https://example.com/new-topic',
            sourceTitle: '業界ニュース',
            originalText: '（新規追加 — 現在の記事には該当箇所なし）',
            proposedText: `## 最近の動向\n\n${topicHint}に関して、2025年以降に大きなアップデートがありました。特に注目すべきは〇〇の機能追加で、従来の方法より効率的に実現できるようになりました。`,
            approved: null,
        },
    ];

    return mockSuggestions;
}
