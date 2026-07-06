import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MigratePage() {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return <div>Unauthorized. Only superadmins can run migrations.</div>;
    }

    const results = [];
    
    try {
        await query(`ALTER TABLE participant_qr_tokens ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to participant_qr_tokens');
    } catch (e) {
        results.push(`ℹ️ participant_qr_tokens: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE social_dinner_tickets ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to social_dinner_tickets');
    } catch (e) {
        results.push(`ℹ️ social_dinner_tickets: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE registrations ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT 0`);
        results.push('✅ Added is_guest to registrations');
    } catch (e) {
        results.push(`ℹ️ registrations.is_guest: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE extra_activities ADD COLUMN email_subject VARCHAR(255) DEFAULT NULL`);
        results.push('✅ Added email_subject to extra_activities');
    } catch (e) {
        results.push(`ℹ️ extra_activities.email_subject: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE extra_activities ADD COLUMN email_body_template TEXT DEFAULT NULL`);
        results.push('✅ Added email_body_template to extra_activities');
    } catch (e) {
        results.push(`ℹ️ extra_activities.email_body_template: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE extra_activities ADD COLUMN include_qr BOOLEAN NOT NULL DEFAULT 1`);
        results.push('✅ Added include_qr to extra_activities');
    } catch (e) {
        results.push(`ℹ️ extra_activities.include_qr: ${e.message}`);
    }

    try {
        await query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_email VARCHAR(255) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(255) NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_email (admin_email),
                INDEX idx_action_type (action_type),
                INDEX idx_entity_type (entity_type)
            );
        `);
        results.push('✅ Created audit_logs table');
    } catch (e) {
        results.push(`ℹ️ audit_logs: ${e.message}`);
    }

    // ---- Program Manual Override Feature ----
    try {
        await query(`ALTER TABLE program_sessions ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to program_sessions');
    } catch (e) {
        results.push(`ℹ️ program_sessions.is_manual: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE program_slots ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to program_slots');
    } catch (e) {
        results.push(`ℹ️ program_slots.is_manual: ${e.message}`);
    }

    // ---- Custom Voting Feature ----
    try {
        await query(`CREATE TABLE IF NOT EXISTS custom_voting_groups (
            id int NOT NULL AUTO_INCREMENT,
            conference_id int NOT NULL,
            name varchar(255) NOT NULL,
            color varchar(7) DEFAULT '#7c3aed',
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY conference_id (conference_id),
            CONSTRAINT cvg_conf_fk FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        results.push('✅ Created custom_voting_groups table');
    } catch (e) {
        results.push(`ℹ️ custom_voting_groups: ${e.message}`);
    }

    try {
        await query(`CREATE TABLE IF NOT EXISTS custom_voting_items (
            id int NOT NULL AUTO_INCREMENT,
            group_id int NOT NULL,
            slot_id int NOT NULL,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY group_slot_unique (group_id, slot_id),
            KEY group_id (group_id),
            KEY slot_id (slot_id),
            CONSTRAINT cvi_group_fk FOREIGN KEY (group_id) REFERENCES custom_voting_groups(id) ON DELETE CASCADE,
            CONSTRAINT cvi_slot_fk FOREIGN KEY (slot_id) REFERENCES program_slots(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        results.push('✅ Created custom_voting_items table');
    } catch (e) {
        results.push(`ℹ️ custom_voting_items: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE registrations ADD COLUMN custom_voting_group text DEFAULT NULL`);
        results.push('✅ Added custom_voting_group to registrations');
    } catch (e) {
        results.push(`ℹ️ registrations.custom_voting_group: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE registrations ADD COLUMN custom_votes text DEFAULT NULL`);
        results.push('✅ Added custom_votes to registrations');
    } catch (e) {
        results.push(`ℹ️ registrations.custom_votes: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE registrations ADD COLUMN has_custom_voted tinyint(1) DEFAULT 0`);
        results.push('✅ Added has_custom_voted to registrations');
    } catch (e) {
        results.push(`ℹ️ registrations.has_custom_voted: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN custom_voting_instructions text DEFAULT NULL`);
        results.push('✅ Added custom_voting_instructions to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.custom_voting_instructions: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN email_custom_voting_invite_body text DEFAULT NULL`);
        results.push('✅ Added email_custom_voting_invite_body to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.email_custom_voting_invite_body: ${e.message}`);
    }

    // ---- Certificate of Participation Feature ----
    try {
        await query(`ALTER TABLE participant_qr_tokens ADD COLUMN cert_sent_at DATETIME DEFAULT NULL`);
        results.push('✅ Added cert_sent_at to participant_qr_tokens');
    } catch (e) {
        results.push(`ℹ️ participant_qr_tokens.cert_sent_at: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN email_certificate_body text DEFAULT NULL`);
        results.push('✅ Added email_certificate_body to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.email_certificate_body: ${e.message}`);
    }

    // ---- Conference Form Extensions Feature ----
    try {
        await query(`ALTER TABLE conferences ADD COLUMN start_date DATE DEFAULT NULL`);
        results.push('✅ Added start_date to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.start_date: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN end_date DATE DEFAULT NULL`);
        results.push('✅ Added end_date to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.end_date: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN sponsor_list TEXT DEFAULT NULL`);
        results.push('✅ Added sponsor_list to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.sponsor_list: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN conference_address TEXT DEFAULT NULL`);
        results.push('✅ Added conference_address to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.conference_address: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN signature_image TEXT DEFAULT NULL`);
        results.push('✅ Added signature_image to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.signature_image: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN text_under_signature TEXT DEFAULT NULL`);
        results.push('✅ Added text_under_signature to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.text_under_signature: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN conference_full_name TEXT DEFAULT NULL`);
        results.push('✅ Added conference_full_name to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.conference_full_name: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN social_dinner_date VARCHAR(255) DEFAULT NULL`);
        results.push('✅ Added social_dinner_date to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.social_dinner_date: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN social_dinner_location TEXT DEFAULT NULL`);
        results.push('✅ Added social_dinner_location to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.social_dinner_location: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN social_dinner_time VARCHAR(50) DEFAULT NULL`);
        results.push('✅ Added social_dinner_time to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.social_dinner_time: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN social_dinner_timezone VARCHAR(100) DEFAULT NULL`);
        results.push('✅ Added social_dinner_timezone to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.social_dinner_timezone: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN social_dinner_maps_url TEXT DEFAULT NULL`);
        results.push('✅ Added social_dinner_maps_url to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.social_dinner_maps_url: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN registration_venue TEXT DEFAULT NULL`);
        results.push('✅ Added registration_venue to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.registration_venue: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN registration_starts_at DATETIME DEFAULT NULL`);
        results.push('✅ Added registration_starts_at to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.registration_starts_at: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN registration_notes TEXT DEFAULT NULL`);
        results.push('✅ Added registration_notes to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.registration_notes: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE conferences ADD COLUMN registration_maps_url TEXT DEFAULT NULL`);
        results.push('✅ Added registration_maps_url to conferences');
    } catch (e) {
        results.push(`ℹ️ conferences.registration_maps_url: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE participants ADD COLUMN entity_address TEXT DEFAULT NULL`);
        results.push('✅ Added entity_address to participants');
    } catch (e) {
        results.push(`ℹ️ participants.entity_address: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE participants ADD COLUMN entity_zip VARCHAR(50) DEFAULT NULL`);
        results.push('✅ Added entity_zip to participants');
    } catch (e) {
        results.push(`ℹ️ participants.entity_zip: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE participants ADD COLUMN entity_city VARCHAR(100) DEFAULT NULL`);
        results.push('✅ Added entity_city to participants');
    } catch (e) {
        results.push(`ℹ️ participants.entity_city: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE participants ADD COLUMN entity_country VARCHAR(255) DEFAULT NULL`);
        results.push('✅ Added entity_country to participants');
    } catch (e) {
        results.push(`ℹ️ participants.entity_country: ${e.message}`);
    }

    return (
        <div className="p-10 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">Database Migration</h1>
            <ul className="space-y-2">
                {results.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="mt-8">
                <a href="/participants" className="text-blue-600 underline">Go back to Participants</a>
            </div>
        </div>
    );
}
