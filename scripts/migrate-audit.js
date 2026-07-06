import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/franciscoacontellmonje/Desktop/SCITO/SCITO_webdev/Admin_Conferencias/.env.local' });

async function migrate() {
    console.log('Connecting to DB...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 1
    });

    try {
        await pool.execute(`
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
        console.log('Created audit_logs table');
    } catch (e) {
        console.log('Error creating audit_logs table:', e.message);
    }

    await pool.end();
    console.log('Done.');
}

migrate();
