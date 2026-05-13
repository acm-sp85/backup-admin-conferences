'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/app/actions/auth';

export default function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider ml-1">
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
        <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider ml-1">
          Confirm New Password
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

      {state?.success && (
        <div className="text-[13px] text-[#34c759] font-medium text-center p-2 bg-[#34c759]/10 rounded-md">
          {state.message}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full h-9 text-[13px] disabled:opacity-70 transition-all"
        >
          {isPending ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </form>
  );
}
