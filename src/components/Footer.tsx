import Link from 'next/link'
import { Anchor } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-900 text-brand-400 py-12 text-center text-sm border-t border-brand-800">
      <div className="mb-8 flex justify-center">
        <div className="opacity-50 flex items-center justify-center bg-brand-800 rounded-full w-16 h-16">
          <Anchor size={36} className="text-brand-400" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 mb-8 text-xs md:text-sm tracking-widest">
        <Link href="/terms" className="hover:text-brand-50 transition-colors">利用規約</Link>
        <Link href="/privacy" className="hover:text-brand-50 transition-colors">プライバシーポリシー</Link>
        <Link href="/tokusho" className="hover:text-brand-50 transition-colors">特定商取引法に基づく表記</Link>
      </div>

      <p className="mb-2 font-serif tracking-widest text-[#dcd4c6]">NOAH - No One Alone, Here</p>
      <p>&copy; {year} NOAH Community. All rights reserved.</p>
    </footer>
  )
}
