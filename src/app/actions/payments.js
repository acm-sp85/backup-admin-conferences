'use server';

import { query } from '../../lib/db';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';

export async function addManualPayment(registrationId, data) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    let { amount = 0, balance = 0, status = 'Pending', payment_method = 'Manual', invoice_code = null } = data;
    if (status.toLowerCase() === 'paid') balance = 0;

    await query(
        `INSERT INTO payments (registration_id, amount, balance, status, payment_method, invoice_code, is_manual)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [registrationId, amount, balance, status, payment_method, invoice_code]
    );

    revalidatePath('/participants');
    return { success: true };
}

export async function updatePayment(paymentId, data) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    let { amount = 0, balance = 0, status = 'Pending', payment_method = 'Manual', invoice_code = null } = data;
    if (status.toLowerCase() === 'paid') balance = 0;

    // We set is_manual = 1 so that it won't be overwritten by future syncs
    await query(
        `UPDATE payments 
         SET amount = ?, balance = ?, status = ?, payment_method = ?, invoice_code = ?, is_manual = 1
         WHERE id = ?`,
        [amount, balance, status, payment_method, invoice_code, paymentId]
    );

    revalidatePath('/participants');
    return { success: true };
}

export async function deletePayment(paymentId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Usually, we only want to allow deleting manual payments, but if they want to delete a synced payment,
    // they can (though it might just get re-synced if it still exists in SCITO, unless they delete it in SCITO).
    // Let's just delete it.
    await query('DELETE FROM payments WHERE id = ?', [paymentId]);

    revalidatePath('/participants');
    return { success: true };
}
