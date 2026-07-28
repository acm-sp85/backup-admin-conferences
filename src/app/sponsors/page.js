import DashboardLayout from '@/app/components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCampaigns } from '@/app/actions/sponsors';
import CampaignsList from './CampaignsList';

export const metadata = {
    title: 'Sponsors Campaigns | Smart Conference Admin',
};

export default async function SponsorsPage() {
    const session = await verifySession();
    
    // Only superadmin and admin_sponsors can access this page
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin_sponsors')) {
        redirect('/');
    }

    // Try to get campaigns, if table doesn't exist it will throw
    let campaigns = [];
    let error = null;
    try {
        campaigns = await getCampaigns();
    } catch (e) {
        error = e.message;
        console.error("Error fetching campaigns:", e);
    }

    return (
        <DashboardLayout userRole={session.role} userName={session.email}>
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Sponsors Campaigns</h1>
                    <p className="text-[var(--muted)] text-xs mt-0.5">Manage and dispatch bulk emails to sponsors or leads</p>
                </div>
            </div>

            {error ? (
                <div className="bg-[#fff5f5] text-[#ff3b30] p-4 rounded-xl text-sm border border-[#ff3b30]/20">
                    <p className="font-semibold mb-2">Database Error</p>
                    <p>It looks like the <code>sponsors_campaigns</code> table hasn't been created yet. Please run the SQL command from the implementation plan.</p>
                </div>
            ) : (
                <CampaignsList initialCampaigns={campaigns} />
            )}
            
        </DashboardLayout>
    );
}
