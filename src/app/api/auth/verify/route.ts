// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const tokenCookie = request.cookies.get('token');

        if (!tokenCookie) {
            return NextResponse.json({ isAuthenticated: false, user: null }, { status: 200 }); // Or 401 if preferred
        }

        const token = tokenCookie.value;
        const decodedToken = await verifyToken(token); // Await verifyToken

        if (!decodedToken || !decodedToken.userId) {
            // Clear invalid cookie if desired
            const response = NextResponse.json({ isAuthenticated: false, user: null }, { status: 200 }); // Or 401
            response.cookies.set('token', '', { httpOnly: true, maxAge: 0 });
            return response;
        }

        const user = await prisma.user.findUnique({
            where: { id: parseInt(decodedToken.userId, 10) },
            select: {
                id: true,
                username: true,
                role: true,
                // Add any other non-sensitive fields you need on the client
            },
        });

        if (!user) {
            // User associated with token not found (e.g., deleted)
            const response = NextResponse.json({ isAuthenticated: false, user: null }, { status: 200 }); // Or 401
            response.cookies.set('token', '', { httpOnly: true, maxAge: 0 });
            return response;
        }

        return NextResponse.json({ isAuthenticated: true, user }, { status: 200 });

    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        // Avoid sending detailed error to client for this sensitive endpoint
        return NextResponse.json(
            { isAuthenticated: false, user: null, error: 'Server error during authentication check.' },
            { status: 500 }
        );
    }
}