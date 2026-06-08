/**
 * AI記事更新チェック — 呼び出しモジュール
 *
 * 【現在の状態】
 *   Phase 0: UI のみ実装済み。AI や Web 検索は一切呼び出していない。
 *            ボタンを押すと「提案なし」をそのまま返す（正直な動作）。
 *
 * 【Phase 2 実装時の正しい設計指針】
 *   - 「一般公開されている情報」が対象:
 *       技術ドキュメント、料金ページ、法律・制度、製品仕様 など
 *   - 「独自コンテンツ」は対象外:
 *       自社開発システムの記事、体験記、コラム、個人の考察 など
 *   - AI に記事を渡す前に「更新対象かどうか」を記事カテゴリ/タグで判定する
 *   - 検索結果が0件 or 信頼度が低い場合は「提案なし」を返す
 *   - ハルシネーション防止: 根拠URLなしの提案は出力させない
 */

export type DiffType = 'body_update' | 'new_section' | 'title_update' | 'price_update' | 'link_update';

export interface DiffSuggestion {
    id: string;
    type: DiffType;
    section: string;      // "本文" "タイトル" "新セクション" など
    reason: string;       // AI が提示する変更理由
    sourceUrl?: string;   // 参照元 URL（必須 — なければ提案しない）
    sourceTitle?: string; // 参照元サイト名
    originalText: string; // 変更前テキスト（記事内に実在する文字列）
    proposedText: string; // 変更後テキスト
    approved: boolean | null; // null=未決定 true=承認 false=却下
}

/**
 * AI による記事更新提案を取得する
 *
 * @param articleTitle 記事タイトル
 * @param articleBody  記事本文HTML
 * @param tags         記事タグ配列
 * @returns DiffSuggestion の配列（提案なしの場合は空配列）
 */
export async function fetchAiUpdates(
    articleTitle: string,
    articleBody: string,
    tags: string[]
): Promise<DiffSuggestion[]> {

    // ────────────────────────────────────────────────────────────────
    // TODO (Phase 2): 実装手順
    //
    // Step 0: 更新対象かどうかを判定（独自コンテンツは除外）
    //   const UPDATE_TARGET_CATEGORIES = ['ノウハウ', 'テクノロジー', '料金・費用', '法律・制度'];
    //   const isUpdateCandidate = tags.some(t => UPDATE_TARGET_CATEGORIES.includes(t));
    //   if (!isUpdateCandidate) return []; // 独自コンテンツは提案なしで即返す
    //
    // Step 1: Web 検索 API でキーワード検索
    //   const searchResults = await fetch('https://google.serper.dev/search', {
    //     method: 'POST',
    //     headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_SERPER_API_KEY!, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ q: `${articleTitle} 最新情報 ${new Date().getFullYear()}`, gl:'jp', hl:'ja' })
    //   }).then(r => r.json());
    //   if (!searchResults.organic?.length) return []; // 検索結果なし → 提案なし
    //
    // Step 2: Gemini API で差分を生成（根拠URLなし提案は禁止プロンプト）
    //   const prompt = `
    //     あなたは記事の情報鮮度チェックアシスタントです。
    //     以下の記事の内容と、最新の検索結果を比較してください。
    //
    //     【重要なルール】
    //     - 根拠となるURLが存在しない提案は絶対に出力しないでください
    //     - 記事内に実際に存在する文字列のみ originalText に入れてください
    //     - 独自システム・体験記・個人の意見については提案しないでください
    //     - 比較できる情報がなければ空配列 [] を返してください
    //
    //     記事タイトル: ${articleTitle}
    //     記事本文（テキスト）: ${articleBody.replace(/<[^>]+>/g, '')}
    //     最新の検索結果: ${JSON.stringify(searchResults.organic?.slice(0, 5))}
    //
    //     出力形式（JSON配列のみ、Markdown不要）:
    //     [{ "id": string, "type": DiffType, "section": string, "reason": string,
    //        "sourceUrl": string（必須）, "sourceTitle": string, "originalText": string, "proposedText": string }]
    //   `;
    //   const response = await fetch(
    //     \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${process.env.NEXT_PUBLIC_GEMINI_API_KEY}\`,
    //     { method:'POST', headers:{'Content-Type':'application/json'},
    //       body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] }) }
    //   ).then(r => r.json());
    //   try {
    //     const text = response.candidates[0].content.parts[0].text;
    //     const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    //     return JSON.parse(jsonStr).map((s: any, i: number) => ({ ...s, id: `diff-${i}`, approved: null }));
    //   } catch { return []; }
    // ────────────────────────────────────────────────────────────────

    // Phase 0（現在）: 処理なし → UIの「提案なし」状態を表示
    await new Promise(r => setTimeout(r, 800)); // 実装中であることを示す短い待機
    return [];
}
