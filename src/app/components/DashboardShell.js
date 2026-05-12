'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import MobileNavbar from './MobileNavbar';

export default function DashboardShell({ children, userRole, isVoter }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {!isVoter && (
        <>
          <MobileNavbar onMenuClick={() => setIsSidebarOpen(true)} />
          <Sidebar 
            userRole={userRole} 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
          />
        </>
      )}
      
      <main className={`
        flex-1 px-4 py-4 md:px-8 transition-all duration-300
        ${!isVoter ? 'md:ml-[220px] pt-14 md:pt-4' : ''}
      `}>
        <div className={`page-enter ${isVoter ? 'max-w-[500px] mx-auto pt-2 pb-20' : 'max-w-[1200px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
