// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            return NextResponse.json({ error: '이미 존재하는 사용자명입니다.' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        });

        return NextResponse.json({
            message: '회원가입 성공',
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}