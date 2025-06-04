// app/api/internal/user-data/route.ts (Example path)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Your Prisma client instance

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Add authentication/authorization for this internal endpoint if necessary
    // For example, check a secret header or ensure it's a trusted call

    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId, 10) },
            select: { role: true /* other fields if needed */ },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json(user);
    } catch (error) {
        console.error('Error fetching user data (internal API):', error);
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}