import DashboardLayout from '@/app/components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCampaign } from '@/app/actions/sponsors';
import CampaignDetails from './CampaignDetails';

export const metadata = {
    title: 'Campaign Details | Smart Conference Admin',
};

export default async function CampaignPage({ params }) {
    const session = await verifySession();
    
    // Only superadmin and admin_sponsors can access this page
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin_sponsors')) {
        redirect('/');
    }

    const { id } = await params;
    const campaign = await getCampaign(id);

    if (!campaign) {
        redirect('/sponsors');
    }

    return (
        <DashboardLayout userRole={session.role} userName={session.email}>
            <CampaignDetails campaign={campaign} />
        </DashboardLayout>
    );
}
