import { Suspense } from 'react';
import SetupPasswordForm from './SetupPasswordForm';

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="max-w-sm w-full">
        <div className="card p-8">
          <Suspense fallback={<div className="text-center text-[var(--muted)] text-sm py-8">Loading...</div>}>
            <SetupPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
