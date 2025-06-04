// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth'; // Assuming 'jose' is used and verifyToken is async

const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export async function middleware(request: NextRequest) {
    const { pathname, origin } = request.nextUrl;

    // Define public paths or paths handled differently
    const publicPaths = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/internal/user-data'];
    if (publicPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
        const tokenCookie = request.cookies.get('token');
        if (!tokenCookie?.value) {
            return NextResponse.json({ error: '인증되지 않았습니다. 로그인이 필요합니다.' }, { status: 401 });
        }

        const decodedToken = await verifyToken(tokenCookie.value);
        if (!decodedToken?.userId) {
            const res = NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
            res.cookies.set('token', '', { maxAge: 0, path: '/' }); // Clear invalid token
            return res;
        }

        // Fetch user role via internal API call
        let userRole: string | null = null;
        try {
            const internalApiUrl = new URL(`/api/internal/user-data?userId=${decodedToken.userId}`, origin);
            const roleResponse = await fetch(internalApiUrl.toString());

            if (!roleResponse.ok) {
                console.error(`Internal API error (${internalApiUrl}): ${roleResponse.status}`);
                return NextResponse.json({ error: '사용자 정보를 확인하는데 실패했습니다.' }, { status: 500 });
            }
            const userData = await roleResponse.json();
            userRole = userData.role;

            if (!userRole) {
                return NextResponse.json({ error: '사용자 역할을 확인할 수 없습니다.' }, { status: 403 });
            }

        } catch (error) {
            console.error('Error calling internal API for user role:', error);
            return NextResponse.json({ error: '내부 서버 오류로 사용자 정보를 확인할 수 없습니다.' }, { status: 500 });
        }

        // Now, use userRole for authorization
        if (PROTECTED_METHODS.includes(request.method.toUpperCase()) && userRole === 'USER') {
            return NextResponse.json({ error: '권한이 없습니다. 이 작업을 수행할 수 없습니다.' }, { status: 403 });
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', decodedToken.userId);
        requestHeaders.set('x-user-role', userRole);

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*'],
    // runtime: 'edge', // This is the default, keep it for this approach
};