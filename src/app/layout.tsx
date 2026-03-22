import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import PWASetup from "@/components/PWASetup";
import "./globals.css";

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
      <body className={`antialiased font-serif bg-texture min-h-screen text-brand-800 text-[14px] sm:text-[16px]`}>
        <AuthProvider>
          <PWASetup />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
