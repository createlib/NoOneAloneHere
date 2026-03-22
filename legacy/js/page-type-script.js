// 【デモ用】ランク切り替えロジック
        document.getElementById('tier-select').addEventListener('change', function(e) {
            document.body.setAttribute('data-tier', e.target.value);
        });

        // スクロールフェードイン
        document.addEventListener("DOMContentLoaded", () => {
            const faders = document.querySelectorAll('.fade-in');
            const appearOptions = { threshold: 0.15, rootMargin: "0px 0px -50px 0px" };
            const appearOnScroll = new IntersectionObserver(function(entries, observer) {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                });
            }, appearOptions);

            faders.forEach(fader => { appearOnScroll.observe(fader); });

            // レーダーチャート
            const ctx = document.getElementById('radarChart').getContext('2d');
            Chart.defaults.color = '#8BA2BC';
            Chart.defaults.font.family = "'Zen Kaku Gothic New', sans-serif";

            new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['推進・行動力', '表現・発信力', '構築・管理力', '知略・分析力', '共感・調和力'],
                    datasets: [{
                        label: '能力パラメータ',
                        data: [30, 15, 100, 90, 65],
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        borderColor: '#C5A880',
                        pointBackgroundColor: '#C5A880',
                        pointBorderColor: '#060913',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#C5A880',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { font: { size: window.innerWidth < 768 ? 11 : 14, weight: '500' }, color: '#E2E8F0' },
                            ticks: { display: false, min: 0, max: 100, stepSize: 20 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(13, 19, 38, 0.95)',
                            titleFont: { size: 14, family: "'Noto Serif JP', serif" },
                            bodyFont: { size: 13 },
                            borderColor: '#C5A880',
                            borderWidth: 1,
                            padding: 15,
                            callbacks: {
                                label: function(context) {
                                    let msg = "";
                                    switch(context.label) {
                                        case '構築・管理力': msg = " [MAX 100] 誰も真似できない絶対的基盤構築"; break;
                                        case '知略・分析力': msg = " [EXCELLENT 90] 長期を見通す深い洞察と濾過力"; break;
                                        case '表現・発信力': msg = " [LOW 15] 自己アピールは他者に任せるのが大正解"; break;
                                        case '推進・行動力': msg = " [30] 軽薄に動かない重厚なポテンシャル"; break;
                                        case '共感・調和力': msg = " [65] 必要な縁だけを静かに守り抜く力"; break;
                                    }
                                    return msg;
                                }
                            }
                        }
                    },
                    animation: { duration: 2500, easing: 'easeOutQuart' }
                }
            });
        });