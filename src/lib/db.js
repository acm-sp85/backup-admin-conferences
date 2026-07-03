import mysql from 'mysql2/promise';

// Prevent multiple pools in development/hot-reload
const globalForDb = global;

export const getConnection = async () => {
    if (!globalForDb.pool) {
        console.log('📦 Creating new DB connection pool...');
        globalForDb.pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 20, // Increased from 5 to handle higher request limits
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            dateStrings: true
        });
    }
    return globalForDb.pool;
};

export const query = async (sql, params) => {
    const db = await getConnection();
    const [results] = await db.execute(sql, params);
    return results;
};

export const hasAccess = async (email) => {
  // Find participant by email
  const participants = await query(`SELECT id FROM participants WHERE email = ?`, [email]);
  if (!participants || participants.length === 0) return false;
  const participantId = participants[0].id;

  // Get all registrations for this participant
  const registrations = await query(`SELECT id FROM registrations WHERE participant_id = ?`, [participantId]);
  if (!registrations || registrations.length === 0) return true; // No registrations means no pending balance

  const regIds = registrations.map((r) => r.id);
  const placeholders = regIds.map(() => '?').join(',');

  // Sum pending amounts across all payments for these registrations
  const rows = await query(
    `SELECT SUM(
        CASE
          WHEN LOWER(status) = 'paid' THEN 0
          WHEN balance IS NOT NULL THEN balance
          WHEN status IS NOT NULL AND LOWER(status) <> 'paid' THEN amount
          ELSE 0
        END
      ) AS pending
     FROM payments
     WHERE registration_id IN (${placeholders})`,
    regIds
  );
  const pending = rows[0]?.pending || 0;
  // Access granted when there is no pending balance
  return Number(pending) <= 0;
};
