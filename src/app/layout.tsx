import type { Metadata, Viewport } from "next";
import { Noto_Serif_JP, Cinzel } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import PWASetup from "@/components/PWASetup";
import "./globals.css";

const notoSerifJP = Noto_Serif_JP({
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-serif-jp",
  display: 'swap',
  preload: false,
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-cinzel",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "NOAH",
  description: "No One Alone, Here",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NOAH",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a110f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSerifJP.variable} ${cinzel.variable} antialiased font-serif bg-texture min-h-screen text-brand-800`}>
        <AuthProvider>
          <PWASetup />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
