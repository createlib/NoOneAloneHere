'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Anchor, Ship, Hourglass, Compass, Film, Podcast, User, Bell, X, LogOut } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isTheaterOpen, setIsTheaterOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <nav className="glass-header border-b border-brand-200 fixed w-full z-50 top-0 h-16 shadow-sm bg-texture backdrop-blur-md bg-opacity-90 bg-brand-50/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <Link href="/home" className="text-xl font-black text-brand-900 tracking-widest flex items-center gap-2 font-serif">
              <span className="bg-brand-900 text-brand-50 w-8 h-8 flex items-center justify-center rounded-sm text-sm">
                <Anchor size={16} />
              </span>
              <span className="hidden sm:inline">NOAH</span>
            </Link>
          </div>

          {/* PC Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 h-full">
            <Link href="/home" className={`transition-colors flex items-center h-full gap-2 font-bold text-sm tracking-wide border-b-[3px] ${pathname === '/home' ? 'text-brand-600 border-brand-500' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
              <Ship size={16} /> 航海
            </Link>
            <Link href="/events" className={`transition-colors flex items-center h-full gap-2 font-bold text-sm tracking-wide border-b-[3px] ${pathname === '/events' ? 'text-brand-600 border-brand-500' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
              <Hourglass size={16} /> イベント
            </Link>
            <Link href="/search" className={`transition-colors flex items-center h-full gap-2 font-bold text-sm tracking-wide border-b-[3px] ${pathname === '/search' ? 'text-brand-600 border-brand-500' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
              <Compass size={16} /> さがす
            </Link>
            
            <div className="relative group h-full flex items-center">
              <button className={`transition-colors flex items-center h-full gap-2 font-bold text-sm tracking-wide focus:outline-none border-b-[3px] ${pathname.includes('/media') ? 'text-brand-600 border-brand-500' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
                <Film size={16} /> メディア
              </button>
              <div className="absolute top-[calc(100%-0.5rem)] left-1/2 transform -translate-x-1/2 w-48 bg-brand-50 border border-brand-200 shadow-xl rounded-sm hidden group-hover:block transition-opacity overflow-hidden">
                <Link href="/media/videos" className="flex items-center px-4 py-3 text-sm font-bold text-brand-800 hover:bg-white border-b border-brand-100 transition-colors tracking-widest group/item">
                  <Film size={18} className="text-brand-400 group-hover/item:text-brand-600 mr-2 transition-colors" /> THEATER
                </Link>
                <Link href="/media/podcasts" className="flex items-center px-4 py-3 text-sm font-bold text-brand-800 hover:bg-white transition-colors tracking-widest group/item">
                  <Podcast size={18} className="text-[#b8860b] mr-2 group-hover/item:scale-110 transition-transform" /> CAST
                </Link>
              </div>
            </div>

            <Link href="/user" className={`transition-colors flex items-center h-full gap-2 font-bold text-sm tracking-wide border-b-[3px] ${pathname === '/user' ? 'text-brand-600 border-brand-500' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
              <User size={16} /> マイページ
            </Link>
            {pathname === '/user' && (
              <>
                <div className="h-6 w-px bg-brand-200 mx-1"></div>
                <button onClick={handleLogout} className="text-sm font-bold text-brand-400 hover:text-brand-800 transition-colors flex items-center gap-2">
                    <span className="tracking-widest">下船する</span>
                    <LogOut size={16} />
                </button>
              </>
            )}
          </div>
          
          {/* Mobile Header Action */}
          <div className="lg:hidden flex items-center gap-1">
            <Link href="/notifications" className="p-2 text-brand-400 hover:text-brand-600 transition-colors relative" title="通知">
              <Bell size={20} />
              <span className="hidden absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-brand-500 rounded-full border-2 border-brand-50"></span>
            </Link>
            {pathname === '/user' && (
              <button onClick={handleLogout} className="p-2 text-brand-400 hover:text-brand-600 transition-colors" title="下船する">
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="fixed bottom-0 w-full bg-[#fffdf9] border-t border-brand-200 lg:hidden z-[1900] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <Link href="/home" className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/home' ? 'text-brand-600 border-t-2 border-brand-500 pt-[2px]' : 'text-brand-400 hover:text-brand-600'}`}>
            <Ship size={20} className="mb-1" />
            <span className={`text-[10px] tracking-widest ${pathname === '/home' ? 'font-bold' : 'font-medium'}`}>航海</span>
          </Link>
          <Link href="/events" className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/events' ? 'text-brand-600 border-t-2 border-brand-500 pt-[2px]' : 'text-brand-400 hover:text-brand-600'}`}>
            <Hourglass size={20} className="mb-1" />
            <span className={`text-[10px] tracking-widest ${pathname === '/events' ? 'font-bold' : 'font-medium'}`}>イベント</span>
          </Link>
          <Link href="/search" className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/search' ? 'text-brand-600 border-t-2 border-brand-500 pt-[2px]' : 'text-brand-400 hover:text-brand-600'}`}>
            <Compass size={20} className="mb-1" />
            <span className={`text-[10px] tracking-widest ${pathname === '/search' ? 'font-bold' : 'font-medium'}`}>さがす</span>
          </Link>
          <button onClick={() => setIsTheaterOpen(true)} className={`flex flex-col items-center justify-center w-full h-full transition-colors focus:outline-none ${pathname.includes('/media') ? 'text-brand-600 border-t-2 border-brand-500 pt-[2px]' : 'text-brand-400 hover:text-brand-600'}`}>
            <Film size={20} className="mb-1" />
            <span className={`text-[10px] tracking-widest ${pathname.includes('/media') ? 'font-bold' : 'font-medium'}`}>メディア</span>
          </button>
          <Link href="/user" className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/user' ? 'text-brand-600 border-t-2 border-brand-500 pt-[2px]' : 'text-brand-400 hover:text-brand-600'}`}>
            <User size={20} className="mb-1" />
            <span className={`text-[10px] tracking-widest ${pathname === '/user' ? 'font-bold' : 'font-medium'}`}>マイページ</span>
          </Link>
        </div>
      </nav>

      {/* SP Media Selection Popup */}
      {isTheaterOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setIsTheaterOpen(false)}></div>
          <div className="bg-[#fffdf9] bg-texture w-full rounded-t-xl p-6 transform transition-transform translate-y-0 relative shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center mb-4 border-b border-brand-200 pb-3">
              <h3 className="font-bold text-brand-900 font-serif tracking-widest flex items-center">
                <Film className="text-brand-500 mr-2" size={20} />メディアを選択
              </h3>
              <button onClick={() => setIsTheaterOpen(false)} className="text-brand-400 hover:text-brand-700 bg-brand-50 rounded-sm w-8 h-8 flex items-center justify-center transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <Link href="/media/videos" onClick={() => setIsTheaterOpen(false)} className="flex items-center gap-4 p-4 border border-brand-400 bg-brand-50 rounded-sm shadow-sm group">
                <div className="w-12 h-12 bg-[#3e2723] text-[#f7f5f0] rounded-full flex items-center justify-center text-lg transform group-hover:scale-105 transition-transform"><Film size={20} /></div>
                <div>
                  <h4 className="font-bold text-brand-900 tracking-widest text-base font-serif">NOAH THEATER</h4>
                  <p className="text-[10px] text-brand-600 mt-1 font-bold">動画で想いや活動の軌跡を共有</p>
                </div>
              </Link>
              <Link href="/media/podcasts" onClick={() => setIsTheaterOpen(false)} className="flex items-center gap-4 p-4 border border-brand-200 rounded-sm hover:bg-brand-50 transition-colors shadow-sm bg-white group">
                <div className="w-12 h-12 bg-brand-100 text-[#b8860b] rounded-full flex items-center justify-center text-lg transform group-hover:scale-105 transition-transform"><Podcast size={20} /></div>
                <div>
                  <h4 className="font-bold text-brand-900 tracking-widest text-base font-serif">NOAH CAST</h4>
                  <p className="text-[10px] text-brand-500 mt-1 font-bold">音声で深い考えや対話を配信</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
