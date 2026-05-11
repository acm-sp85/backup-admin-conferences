import DashboardLayout from '../../components/DashboardLayout';
import ParticipantQRScanner from '../../components/ParticipantQRScanner';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ParticipantScannerPage() {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        redirect('/login');
    }

    return (
        <DashboardLayout>
            <ParticipantQRScanner />
        </DashboardLayout>
    );
}
