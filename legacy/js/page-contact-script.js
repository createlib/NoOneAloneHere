// 送信フラグ
        let submitted = false;

        // 送信完了時にフォームを隠して完了メッセージを表示する関数
        function showSuccess() {
            const form = document.getElementById('contact-form');
            const successMsg = document.getElementById('success-message');
            
            // アニメーション的に切り替え
            form.style.display = 'none';
            successMsg.classList.remove('hidden');
            
            // ページ上部へスクロール
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }