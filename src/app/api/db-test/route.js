import { query } from '@/lib/db';

export async function GET() {
    try {
        // Simple query to test connection
        const results = await query('SELECT 1 + 1 AS result');
        const tablesResult = await query('SHOW TABLES');
        const tables = tablesResult.map(row => Object.values(row)[0]);
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Database connected successfully',
            data: results[0].result,
            tables: tables
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database connection error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: 'Database connection failed',
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
