import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let pool;

export const getConnection = async () => {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }
    return pool;
};

export const query = async (sql, params) => {
    const db = await getConnection();
    const [results] = await db.execute(sql, params);
    return results;
};
