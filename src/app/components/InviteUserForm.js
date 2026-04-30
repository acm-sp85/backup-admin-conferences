'use client';

import { useActionState } from 'react';
import { inviteUser } from '../actions/users';

export default function InviteUserForm() {
    const [state, action, isPending] = useActionState(inviteUser, null);

    return (
        <form action={action} className="flex flex-col gap-2">
            <div className="flex gap-2">
                <input 
                    name="email" 
                    type="email" 
                    placeholder="Enter email address" 
                    required 
                    className="input-base min-w-[220px]"
                />
                <select 
                    name="role" 
                    className="input-base"
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                </select>
                <button 
                    type="submit" 
                    disabled={isPending}
                    className="btn-primary disabled:opacity-50"
                >
                    {isPending ? 'Sending...' : 'Invite'}
                </button>
            </div>
            
            {state?.error && (
                <p className="text-[11px] text-[#ff3b30] font-medium">⚠️ {state.error}</p>
            )}
            {state?.success && (
                <p className="text-[11px] text-[#34c759] font-medium">✓ Invitation sent!</p>
            )}
        </form>
    );
}
