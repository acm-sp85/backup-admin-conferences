import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
    HAS_PASSWORD: !!process.env.DB_PASSWORD,
    PASSWORD_LENGTH: process.env.DB_PASSWORD?.length,
    CWD: process.cwd(),
    ENV_PATH: require('path').resolve(process.cwd(), '.env.local')
  });
}
