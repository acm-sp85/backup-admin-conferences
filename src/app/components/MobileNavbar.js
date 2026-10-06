'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Menu, X, UtensilsCrossed, Users } from 'lucide-react';
import { useState } from 'react';

export default function MobileNavbar({ onMenuClick }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-[#1d1d1f] border-b border-white/[0.08] fixed top-0 left-0 right-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#0071e3] rounded-md flex items-center justify-center text-white text-xs font-bold">S</div>
          <span className="text-[13px] font-semibold text-white tracking-tight">Smart Conference</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0071e3] text-white rounded-lg text-[11px] font-bold uppercase tracking-tight hover:bg-[#0077ed] transition-colors"
            aria-label="Launch Scanner"
          >
            <Camera size={16} />
            <span>Scanner</span>
          </button>
          
          <button 
            onClick={onMenuClick}
            className="p-2 text-[#aeaeb2] hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1d1d1f] rounded-2xl p-5 w-full max-w-sm border border-white/[0.08] shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Camera className="text-[#0071e3]" size={20} />
              Select Scanner
            </h3>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  router.push('/participants/scanner');
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">REGISTRO</div>

                </div>
              </button>
              
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  router.push('/social-dinner/scanner');
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                  <UtensilsCrossed size={20} />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">SOCIAL DINNER</div>

                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
