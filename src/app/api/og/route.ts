import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    try {
        const targetUrl = url.startsWith('http') ? url : `https://${url}`;

        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NOAHBot/1.0; +https://noahcommunity.jp/)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.5',
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        const getMeta = (selectors: string[]): string => {
            for (const sel of selectors) {
                const val = $(sel).attr('content') || $(sel).text();
                if (val?.trim()) return val.trim();
            }
            return '';
        };

        const title =
            getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
            $('title').text().trim() ||
            '';

        const description =
            getMeta(['meta[property="og:description"]', 'meta[name="twitter:description"]', 'meta[name="description"]']) ||
            '';

        const image =
            getMeta(['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[name="twitter:image:src"]']) ||
            '';

        // Resolve relative image URL
        const resolvedImage = image
            ? new URL(image, targetUrl).href
            : '';

        // Favicon
        const faviconHref =
            $('link[rel="shortcut icon"]').attr('href') ||
            $('link[rel="icon"]').first().attr('href') ||
            '/favicon.ico';
        const favicon = faviconHref
            ? new URL(faviconHref, targetUrl).href
            : `https://www.google.com/s2/favicons?domain=${new URL(targetUrl).hostname}&sz=32`;

        const siteName =
            getMeta(['meta[property="og:site_name"]']) ||
            new URL(targetUrl).hostname;

        return NextResponse.json(
            { title, description, image: resolvedImage, favicon, siteName, url: targetUrl },
            {
                headers: {
                    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message || 'Failed to fetch OGP', title: '', description: '', image: '', favicon: '', siteName: '', url },
            { status: 200 }
        );
    }
}
