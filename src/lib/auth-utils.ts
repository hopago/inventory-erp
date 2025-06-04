// lib/authUtils.ts (or similar shared location)
import { NextRequest } from 'next/server';

export async function getAuthenticatedUserId(request: NextRequest): Promise<number | null> {
    // Option 1: If middleware sets a header after verifying token
    const userIdHeader = request.headers.get('x-user-id');
    if (userIdHeader) {
        const id = parseInt(userIdHeader, 10);
        return !isNaN(id) ? id : null;
    }

    // Option 2: Verify token directly from cookie if no middleware header
    // const tokenCookie = request.cookies.get('token');
    // if (tokenCookie?.value) {
    //     const decodedToken = await verifyToken(tokenCookie.value); // Use your jose verifyToken
    //     if (decodedToken?.userId) {
    //         const id = parseInt(decodedToken.userId, 10);
    //         return !isNaN(id) ? id : null;
    //     }
    // }

    return null; // No authenticated user found
}