// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const response = NextResponse.json({ message: '로그아웃 성공' }, { status: 200 });
        // Clear the cookie
        response.cookies.set('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 0, // Expire immediately
            path: '/', // Ensure path matches the one used for setting
        });
        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}