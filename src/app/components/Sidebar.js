'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';

const NAV = [
  { name: 'Conferences', href: '/', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { name: 'Participants', href: '/participants', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { name: 'Posters', href: '/posters', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
  { name: 'Program', href: '/program', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { name: 'Social Dinner', href: '/social-dinner', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
];

const ADMIN_NAV = [
  { name: 'Users', href: '/users', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
];

export default function Sidebar({ userRole }) {
  const pathname = usePathname();
  const items = userRole === 'superadmin' ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside className="hidden md:flex w-[220px] flex-col fixed inset-y-0 left-0 bg-[#1d1d1f] z-50">
      {/* Brand */}
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#0071e3] rounded-md flex items-center justify-center text-white text-xs font-bold">S</div>
          <span className="text-[13px] font-semibold text-white tracking-tight">Smart Conference Admin</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-[2px]">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[12px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-[#aeaeb2] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className={`opacity-${isActive ? '100' : '60'}`}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-[#aeaeb2] uppercase">
            {userRole?.charAt(0)}
          </div>
          <span className="text-[11px] font-medium text-[#aeaeb2] capitalize">{userRole}</span>
        </div>
        <form action={logout}>
          <button className="w-full flex items-center gap-2 px-3 py-[7px] rounded-md text-[11px] font-medium text-[#ff6b6b] hover:bg-[#ff6b6b]/10 transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
