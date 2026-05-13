'use client';

import { useActionState } from 'react';
import { setupAdminPassword } from '@/app/actions/auth';
import { useSearchParams } from 'next/navigation';

export default function SetupPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  // Create a bound action that passes the token
  const actionWithToken = async (prevState, formData) => {
    return await setupAdminPassword(token, formData);
  };

  const [state, formAction, isPending] = useActionState(actionWithToken, null);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
        <div className="login-card max-w-sm w-full p-8 text-center">
          <div className="text-[#ff3b30] mb-2 font-medium">Missing Token</div>
          <p className="text-[var(--muted)] text-sm">Please use the link provided in your invitation email.</p>
        </div>
      </div>
    );
  }

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

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider ml-1">
              New Password
            </label>
            <input
              type="password"
              name="password"
              className="input-base w-full"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider ml-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              className="input-base w-full"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {state?.error && (
            <div className="text-[13px] text-[#ff3b30] font-medium text-center p-2 bg-[#ff3b30]/10 rounded-md">
              {state.error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isPending}
            className="btn-primary w-full h-11 text-[15px] mt-2 relative overflow-hidden transition-all duration-300 disabled:opacity-70"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
