'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="card p-8">
          <header className="mb-8 text-center">
            <div className="w-10 h-10 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-sm font-bold mx-auto mb-4">
              S
            </div>
            <h1 className="text-lg font-semibold">SCITO Admin</h1>
            <p className="text-[var(--muted)] text-xs mt-1">Sign in to manage conferences</p>
          </header>

          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input-base w-full"
                placeholder="name@company.com"
              />
              {state?.errors?.email && (
                <p className="text-[#ff3b30] text-[11px] mt-1.5 font-medium">{state.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input-base w-full"
                placeholder="••••••••"
              />
              {state?.errors?.password && (
                <p className="text-[#ff3b30] text-[11px] mt-1.5 font-medium">{state.errors.password}</p>
              )}
            </div>

            {state?.message && (
              <div className="card p-3 text-center" style={{borderColor:'#ff3b30', background:'#fff5f5'}}>
                <p className="text-[#ff3b30] text-[11px] font-medium">{state.message}</p>
              </div>
            )}

            <button
              disabled={pending}
              type="submit"
              className="btn-primary w-full text-center py-2.5 mt-2 disabled:opacity-60"
            >
              {pending ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        </div>
        
        <footer className="mt-6 text-center">
          <p className="text-[var(--muted)] text-[10px] uppercase tracking-widest font-medium">
            &copy; 2026 SCITO Systems
          </p>
        </footer>
      </div>
    </div>
  );
}
