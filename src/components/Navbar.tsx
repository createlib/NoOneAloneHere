'use client'

import Link from 'next/link'
import { Anchor, Ship, Hourglass, Compass, Film, Podcast, User, Bell } from 'lucide-react'

export default function Navbar() {
  return (
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
        <div className="hidden lg:flex items-center gap-6">
          <Link href="/home" className="text-brand-600 transition-colors flex items-center gap-2 font-bold text-sm tracking-wide">
            <Ship size={16} /> 航海
          </Link>
          <Link href="/events" className="text-brand-400 hover:text-brand-600 transition-colors flex items-center gap-2 font-bold text-sm tracking-wide">
            <Hourglass size={16} /> イベント
          </Link>
          <Link href="/search" className="text-brand-400 hover:text-brand-600 transition-colors flex items-center gap-2 font-bold text-sm tracking-wide">
            <Compass size={16} /> さがす
          </Link>
          
          <div className="relative group h-full flex items-center">
            <button className="text-brand-400 hover:text-brand-600 transition-colors flex items-center gap-2 font-bold text-sm tracking-wide focus:outline-none py-5">
              <Film size={16} /> メディア
            </button>
            <div className="absolute top-[calc(100%-0.5rem)] left-1/2 transform -translate-x-1/2 w-48 bg-brand-50 border border-brand-200 shadow-xl rounded-sm hidden group-hover:block transition-opacity overflow-hidden">
              <Link href="/videos" className="flex items-center px-4 py-3 text-sm font-bold text-brand-800 hover:bg-white border-b border-brand-100 transition-colors tracking-widest group/item">
                <Film size={18} className="text-brand-400 group-hover/item:text-brand-600 mr-2 transition-colors" /> THEATER
              </Link>
              <Link href="/podcasts" className="flex items-center px-4 py-3 text-sm font-bold text-brand-800 hover:bg-white transition-colors tracking-widest group/item">
                <Podcast size={18} className="text-brand-500 mr-2 group-hover/item:scale-110 transition-transform" /> CAST
              </Link>
            </div>
          </div>

          <Link href="/user" className="text-brand-400 hover:text-brand-600 transition-colors flex items-center gap-2 font-bold text-sm tracking-wide">
            <User size={16} /> マイページ
          </Link>
        </div>
        
        {/* Mobile Header Action */}
        <div className="lg:hidden flex items-center">
          <Link href="/notifications" className="p-2 text-brand-400 hover:text-brand-600 transition-colors relative" title="通知">
            <Bell size={20} />
            <span className="hidden absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-brand-500 rounded-full border-2 border-brand-50"></span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
