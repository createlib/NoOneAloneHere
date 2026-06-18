/**
 * compressImage.ts
 * 画像ファイルを最大 maxPx × maxPx に収め、JPEG 0.85 品質で圧縮する。
 * PC・スマホ両対応の推奨サイズ（1920px / JPEG 0.85）をデフォルト値として採用。
 */

/**
 * @param file     入力ファイル（画像全般対応）
 * @param maxPx    長辺の最大ピクセル数（デフォルト 1920）
 * @param quality  JPEG 品質 0.0–1.0（デフォルト 0.85）
 * @returns        圧縮済み File（JPEG）
 */
export async function compressImage(
    file: File,
    maxPx = 1920,
    quality = 0.85,
): Promise<File> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            const { naturalWidth: nw, naturalHeight: nh } = img;
            const scale = Math.min(maxPx / nw, maxPx / nh, 1); // 縮小のみ（拡大しない）
            const outW = Math.round(nw * scale);
            const outH = Math.round(nh * scale);

            const canvas = document.createElement('canvas');
            canvas.width  = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, outW, outH);

            const baseName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            canvas.toBlob(
                (blob) => {
                    if (!blob) { reject(new Error('toBlob failed')); return; }
                    resolve(new File([blob], baseName, { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality,
            );
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });
}
