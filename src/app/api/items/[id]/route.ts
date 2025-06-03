// app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from "@/lib/auth"
import { Cabin_Sketch } from 'next/font/google';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const token = request.cookies.get('token')?.value;
        if (!token || !verifyToken(token)) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const data = await request.json();
        const itemId = parseInt(params.id);

        const item = await prisma.item.update({
            where: { id: itemId },
            data: {
                storeName: data.storeName,
                itemName: data.itemName,
                quantity: parseInt(data.quantity),
                specification: data.specification,
                deliveryMethod: data.deliveryMethod,
                notes: data.notes || '',
                updatedAt: new Date()
            }
        });

        return NextResponse.json(item);
    } catch {
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const token = request.cookies.get('token')?.value;
        if (!token || !verifyToken(token)) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const itemId = parseInt(params.id);

        await prisma.item.delete({
            where: { id: itemId }
        });

        return NextResponse.json({ message: '삭제되었습니다.' });
    } catch {
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}