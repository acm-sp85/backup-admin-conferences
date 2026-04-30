import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { setupPassword } from '../actions/users';

export default async function SetupPasswordPage({ searchParams }) {
    const { token } = await searchParams;

    if (!token) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">Invalid or missing token.</div>;
    }

    // Verify token
    const [user] = await query(
        'SELECT id, email FROM users WHERE invitation_token = ? AND token_expires > NOW()',
        [token]
    );

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">Invitation expired or invalid.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-10">
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900">Create Password</h2>
                    <p className="text-slate-500 mt-2">Setting up account for <span className="font-semibold">{user.email}</span></p>
                </div>

                <form action={setupPassword} className="space-y-6">
                    <input type="hidden" name="token" value={token} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                            <input 
                                name="firstName" 
                                type="text" 
                                required 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                            <input 
                                name="lastName" 
                                type="text" 
                                required 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                        <input 
                            name="password" 
                            type="password" 
                            required 
                            minLength={8}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="At least 8 characters"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
                        <input 
                            name="confirmPassword" 
                            type="password" 
                            required 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="Repeat password"
                        />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]">
                        Complete Setup
                    </button>
                </form>
            </div>
        </div>
    );
}
