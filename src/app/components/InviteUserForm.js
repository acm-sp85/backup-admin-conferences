'use client';

import { useActionState } from 'react';
import { inviteUser } from '../actions/users';

export default function InviteUserForm() {
    const [state, action, isPending] = useActionState(inviteUser, null);

    return (
        <form action={action} className="flex flex-col gap-1.5 items-end">
            <div className="flex gap-2">
                <input 
                    name="firstName" 
                    type="text" 
                    placeholder="First Name" 
                    className="input-base w-[100px]"
                />
                <input 
                    name="lastName" 
                    type="text" 
                    placeholder="Last Name" 
                    className="input-base w-[100px]"
                />
                <input 
                    name="email" 
                    type="email" 
                    placeholder="Email address" 
                    required 
                    className="input-base min-w-[180px]"
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
                    className="btn-primary disabled:opacity-50 min-w-[70px]"
                >
                    {isPending ? 'Wait...' : 'Invite'}
                </button>
            </div>
            
            {state?.error && (
                <p className="text-[10px] text-[#ff3b30] font-medium mr-2">⚠️ {state.error}</p>
            )}
            {state?.success && (
                <p className="text-[10px] text-[#34c759] font-medium mr-2">✓ Invitation sent!</p>
            )}
        </form>
    );
}
