'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Menu } from 'lucide-react';

export default function MobileNavbar({ onMenuClick }) {
  const pathname = usePathname();
  
  // Determine which scanner to link to based on the current section
  const isSocialDinner = pathname?.startsWith('/social-dinner');
  const scannerHref = isSocialDinner ? '/social-dinner/scanner' : '/participants/scanner';

  return (
    <header className="md:hidden flex items-center justify-between px-4 h-14 bg-[#1d1d1f] border-b border-white/[0.08] fixed top-0 left-0 right-0 z-40">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[#0071e3] rounded-md flex items-center justify-center text-white text-xs font-bold">S</div>
        <span className="text-[13px] font-semibold text-white tracking-tight">Smart Conference</span>
      </Link>
      
      <div className="flex items-center gap-2">
        <Link 
          href={scannerHref}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0071e3] text-white rounded-lg text-[11px] font-bold uppercase tracking-tight hover:bg-[#0077ed] transition-colors"
          aria-label="Launch Scanner"
        >
          <Camera size={16} />
          <span>Scanner</span>
        </Link>
        
        <button 
          onClick={onMenuClick}
          className="p-2 text-[#aeaeb2] hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
