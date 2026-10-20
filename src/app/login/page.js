'use client';

import { useActionState, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { requestMagicLink, requestPasswordReset } from '@/app/actions/auth';

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [loginState, loginAction, loginPending] = useActionState(requestMagicLink, undefined);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, undefined);

  const [mode, setMode] = useState('login'); // 'login' | 'forgot-password'
  const [email, setEmail] = useState('');
  const [hasPassword, setHasPassword] = useState(false);

  // Success view for Magic Link login
  if (mode === 'login' && loginState?.success) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="max-w-sm w-full">
          <div className="card p-8 text-center">
            <div className="w-12 h-12 bg-[#34c759] rounded-full flex items-center justify-center text-white mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h1 className="text-lg font-semibold mb-2">Check your email</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
              We've sent a login link to your email address. It will expire in 15 minutes.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="text-[var(--accent)] text-xs font-semibold hover:underline cursor-pointer"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success view for Password Reset request
  if (mode === 'forgot-password' && resetState?.success) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="max-w-sm w-full">
          <div className="card p-8 text-center">
            <div className="w-12 h-12 bg-[#34c759] rounded-full flex items-center justify-center text-white mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h1 className="text-lg font-semibold mb-2">Check your email</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
              We've sent a password reset link to <strong className="text-[var(--text)] font-medium">{email}</strong>. It will expire in 15 minutes.
            </p>
            <button 
              onClick={() => {
                setMode('login');
              }}
              className="text-[var(--accent)] text-xs font-semibold hover:underline cursor-pointer"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="card p-8">
          <header className="mb-8 text-center">
            <div className="w-10 h-10 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-sm font-bold mx-auto mb-4">
              S
            </div>
            <h1 className="text-lg font-semibold">
              {mode === 'forgot-password' ? 'Reset Admin Password' : 'Smart Conference Admin'}
            </h1>
            <p className="text-[var(--muted)] text-xs mt-1">
              {mode === 'forgot-password' 
                ? 'Enter your email to receive a password reset link' 
                : 'Sign in to manage conferences'}
            </p>
          </header>

          {/* URL Error notices if user was redirected from auth callback */}
          {urlError && mode === 'login' && !loginState?.message && (
            <div className="card p-3 text-center mb-6" style={{ borderColor: '#ff3b30', background: '#fff5f5' }}>
              <p className="text-[#ff3b30] text-[11px] font-medium">
                {urlError === 'invalid_token' 
                  ? 'The login or reset link is invalid or has expired. Please request a new one.' 
                  : 'Missing authentication token. Please use the link sent to your email.'}
              </p>
            </div>
          )}

          {mode === 'forgot-password' ? (
            /* Forgot Password Form */
            <form action={resetAction} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base w-full"
                  placeholder="name@company.com"
                  autoFocus
                />
                {resetState?.errors?.email && (
                  <p className="text-[#ff3b30] text-[11px] mt-1.5 font-medium">{resetState.errors.email}</p>
                )}
              </div>

              {resetState?.message && (
                <div className="card p-3 text-center" style={{ borderColor: '#ff3b30', background: '#fff5f5' }}>
                  <p className="text-[#ff3b30] text-[11px] font-medium">{resetState.message}</p>
                </div>
              )}

              <button
                disabled={resetPending}
                type="submit"
                className="btn-primary w-full text-center py-2.5 mt-2 disabled:opacity-60 transition-all cursor-pointer"
              >
                {resetPending ? 'Sending Reset Link...' : 'Send Password Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors pt-2 block cursor-pointer"
              >
                &larr; Back to login
              </button>
            </form>
          ) : (
            /* Regular Login Form */
            <form action={loginAction} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base w-full"
                  placeholder="name@company.com"
                />
                {loginState?.errors?.email && (
                  <p className="text-[#ff3b30] text-[11px] mt-1.5 font-medium">{loginState.errors.email}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#aeaeb2] font-normal lowercase tracking-normal">Optional (Admins)</span>
                    <span className="text-[#d1d1d6]">•</span>
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-[10px] text-[var(--accent)] font-semibold hover:underline cursor-pointer lowercase tracking-normal"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  onChange={(e) => setHasPassword(e.target.value.length > 0)}
                  className="input-base w-full"
                  placeholder="••••••••"
                />
                {loginState?.errors?.password && (
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[#ff3b30] text-[11px] font-medium">{loginState.errors.password}</p>
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-[var(--accent)] text-[11px] font-semibold hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {loginState?.message && (
                <div className="card p-3 text-center" style={{ borderColor: '#ff3b30', background: '#fff5f5' }}>
                  <p className="text-[#ff3b30] text-[11px] font-medium">{loginState.message}</p>
                  {loginState.message.includes('No password set') && (
                    <button
                      type="button"
                      onClick={() => {
                        const passInput = document.getElementById('password');
                        if (passInput) passInput.value = '';
                        setHasPassword(false);
                      }}
                      className="text-[var(--accent)] text-[11px] font-semibold hover:underline mt-1.5 block mx-auto cursor-pointer"
                    >
                      Clear password &amp; send login link
                    </button>
                  )}
                </div>
              )}

              <button
                disabled={loginPending}
                type="submit"
                className="btn-primary w-full text-center py-2.5 mt-2 disabled:opacity-60 transition-all cursor-pointer"
              >
                {loginPending 
                  ? (hasPassword ? 'Logging in...' : 'Sending Link...') 
                  : (hasPassword ? 'Login' : 'Send Login Link')}
              </button>
            </form>
          )}
        </div>
        
        <footer className="mt-6 text-center">
          <p className="text-[var(--muted)] text-[10px] uppercase tracking-widest font-medium">
            &copy; 2026 Smart Conference
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="text-[var(--muted)] text-sm">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
