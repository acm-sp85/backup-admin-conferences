'use client';

import { deleteUser, updateUserRole } from '../actions/users';
import { useState } from 'react';

export default function UserActions({ user }) {
    const [isPending, setIsPending] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${user.email}?`)) return;
        
        setIsPending(true);
        const res = await deleteUser(user.id);
        if (res?.error) alert(res.error);
        setIsPending(false);
    };

    const handleRoleChange = async (newRole) => {
        if (!confirm(`Change ${user.email} role to ${newRole.toUpperCase()}?`)) return;

        setIsPending(true);
        try {
            const res = await updateUserRole(user.id, newRole);
            if (res?.error) {
                alert(res.error);
            }
        } catch (e) {
            console.error('Role update error:', e);
            alert('Error: ' + (e.message || 'Server connection failed'));
        }
        setIsPending(false);
    };

    return (
        <div className="flex items-center gap-2 group">
            <div className="relative flex-1">
                <select 
                    value={user.role || 'user'}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    disabled={isPending}
                    className="input-base w-full pr-8 appearance-none text-[11px] font-semibold bg-white cursor-pointer"
                    style={{
                        color: user.role === 'superadmin' ? '#af52de' : user.role === 'admin' ? '#0071e3' : '#8e8e93',
                        borderColor: user.role === 'superadmin' ? '#e9d5ff' : user.role === 'admin' ? '#d0e7ff' : '#e5e5ea',
                        background: user.role === 'superadmin' ? '#f5e6ff' : user.role === 'admin' ? '#f0f7ff' : '#f2f2f7'
                    }}
                >
                    <option value="user">USER</option>
                    <option value="admin">ADMIN</option>
                    <option value="superadmin">SUPERADMIN</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>
            
            <button 
                onClick={handleDelete}
                disabled={isPending}
                className="p-1.5 text-[var(--muted)] hover:text-[#ff3b30] hover:bg-[#fff5f5] rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Delete User"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
    );
}
