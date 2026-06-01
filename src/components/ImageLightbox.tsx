'use client';

import React, { useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────── */
const BG = '#f8f6f3';

/* ══════════════════════════════════════════════════════════
 *  PostImageGrid — compact, SNS-style image grid
 *  Max height capped so images don't dominate the feed.
 *  Click opens lightbox.
 * ══════════════════════════════════════════════════════════ */
export function PostImageGrid({ images }: { images: string[] }) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (!images || images.length === 0) return null;

    const count = images.length;

    return (
        <>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: count === 1 ? '1fr' : 'repeat(2, 1fr)',
                    gridTemplateRows: count <= 2 ? '1fr' : 'repeat(2, 1fr)',
                    gap: 3,
                    marginTop: 10,
                    borderRadius: 14,
                    overflow: 'hidden',
                    maxHeight: 280,
                    cursor: 'pointer',
                }}
            >
                {images.slice(0, 4).map((url, i) => {
                    const style: React.CSSProperties = {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    };

                    // For 3 images: first image spans 2 rows
                    const containerStyle: React.CSSProperties = {
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: 0, // allow shrinking in grid
                    };
                    if (count === 1) {
                        containerStyle.maxHeight = 280;
                    }
                    if (count === 3 && i === 0) {
                        containerStyle.gridRow = 'span 2';
                    }

                    return (
                        <div
                            key={i}
                            style={containerStyle}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); setLightboxIndex(i); }}
                        >
                            <img
                                src={url}
                                alt=""
                                style={style}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            {/* "more" indicator for 4+ images on the 4th slot */}
                            {count > 4 && i === 3 && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(0,0,0,.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 18, fontWeight: 800,
                                }}>
                                    +{count - 4}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && (
                <ImageLightbox
                    images={images}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
        </>
    );
}

/* ══════════════════════════════════════════════════════════
 *  ImageLightbox — fullscreen image viewer with swipe
 * ══════════════════════════════════════════════════════════ */
function ImageLightbox({
    images,
    initialIndex,
    onClose,
}: {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}) {
    const [index, setIndex] = useState(initialIndex);

    const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: 16, right: 16,
                    width: 40, height: 40, borderRadius: '50%',
                    border: 'none', background: 'rgba(255,255,255,.15)',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10,
                }}
            >
                <X size={20} />
            </button>

            {/* Counter */}
            {images.length > 1 && (
                <div style={{
                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                    color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600,
                    background: 'rgba(0,0,0,.4)', padding: '4px 14px', borderRadius: 100,
                }}>
                    {index + 1} / {images.length}
                </div>
            )}

            {/* Prev */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); prev(); }}
                    style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        width: 44, height: 44, borderRadius: '50%',
                        border: 'none', background: 'rgba(255,255,255,.12)',
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    <ChevronLeft size={24} />
                </button>
            )}

            {/* Image */}
            <img
                src={images[index]}
                alt=""
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '90vw', maxHeight: '85vh',
                    objectFit: 'contain', borderRadius: 8,
                    boxShadow: '0 8px 40px rgba(0,0,0,.5)',
                }}
            />

            {/* Next */}
            {images.length > 1 && (
                <button
                    onClick={e => { e.stopPropagation(); next(); }}
                    style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        width: 44, height: 44, borderRadius: '50%',
                        border: 'none', background: 'rgba(255,255,255,.12)',
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    <ChevronRight size={24} />
                </button>
            )}
        </div>
    );
}

export default ImageLightbox;
