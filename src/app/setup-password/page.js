import { Suspense } from 'react';
import SetupPasswordForm from './SetupPasswordForm';

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="login-card max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[var(--accent)] rounded-xl mx-auto mb-4 flex items-center justify-center shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Setup Your Password</h1>
          <p className="text-[var(--muted)] text-[13px]">
            Please create a password to complete your admin registration.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-[var(--muted)] text-sm py-8">Loading...</div>}>
          <SetupPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
