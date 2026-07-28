import { hasAdminAccess } from '@/lib/roles';
import DashboardLayout from '../../components/DashboardLayout';
import ParticipantQRScanner from '../../components/ParticipantQRScanner';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ParticipantScannerPage() {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) {
        redirect('/login');
    }

    return (
        <DashboardLayout>
            <ParticipantQRScanner />
        </DashboardLayout>
    );
}
