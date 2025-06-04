// app/api/auth/login/route.ts (or your existing path)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from "@/lib/auth"; // Corrected path if necessary

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: '사용자 이름과 비밀번호를 모두 입력해주세요.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { username } });

        if (!user || !(await verifyPassword(password, user.password))) {
            return NextResponse.json({ error: '잘못된 로그인 정보입니다.' }, { status: 401 });
        }

        const token = await generateToken(user.id); // Await generateToken (user.id is Int)

        const response = NextResponse.json({
            message: '로그인 성공',
            user: { id: user.id, username: user.username, role: user.role },
        });

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7일
            path: '/', // Good practice to set path
        });

        return response;
    } catch (error) { // Added 'error' parameter
        console.error('Login error:', error); // Log the actual error
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}