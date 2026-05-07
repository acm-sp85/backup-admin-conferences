import DashboardLayout from '../../components/DashboardLayout';
import ScannerClient from './ScannerClient';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SocialDinnerScannerPage() {
    const session = await verifySession();
    if (!session || session.role === 'user') {
        redirect(session ? '/voting' : '/login');
    }

    return (
        <DashboardLayout>
            <ScannerClient />
        </DashboardLayout>
    );
}
