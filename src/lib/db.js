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
