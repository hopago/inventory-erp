// app/api/calendar-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-utils'; // Adjust path as needed

/**
 * POST /api/calendar-events
 * Creates a new calendar event for the authenticated user.
 */
export async function POST(request: NextRequest) {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { title, start, end, allDay, color, description } = body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return NextResponse.json({ error: '일정 제목(title)은 필수입니다.' }, { status: 400 });
        }
        if (!start || isNaN(new Date(start).getTime())) {
            return NextResponse.json({ error: '유효한 시작일(start)은 필수입니다.' }, { status: 400 });
        }
        if (end && isNaN(new Date(end).getTime())) {
            return NextResponse.json({ error: '종료일(end)이 제공된 경우 유효한 날짜여야 합니다.' }, { status: 400 });
        }
        if (allDay !== undefined && typeof allDay !== 'boolean') {
            return NextResponse.json({ error: '하루 종일(allDay) 값은 boolean이어야 합니다.' }, { status: 400 });
        }
        // Optional: Add color format validation (e.g., hex code) if needed

        const startDate = new Date(start);
        const endDate = end ? new Date(end) : null;

        if (endDate && startDate > endDate) {
            return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
        }

        const newEvent = await prisma.calendarEvent.create({
            data: {
                title: title.trim(),
                description: description || null,
                start: startDate,
                end: endDate,
                allDay: typeof allDay === 'boolean' ? allDay : true, // Default to true if not provided
                color: color || null,
                userId: authenticatedUserId,
            },
        });

        return NextResponse.json(newEvent, { status: 201 });
    } catch (error: unknown) {
        const err = error as {
            name?: string;
            message?: string;
            stack?: string;
            code?: string;
            meta?: any;  // Prisma error metadata
        }
        console.error('Error creating calendar event:', err);
        if (err.name === 'SyntaxError') { // Malformed JSON
            return NextResponse.json({ error: '잘못된 요청 데이터 형식입니다.' }, { status: 400 });
        }
        return NextResponse.json({ error: '일정 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

/**
 * GET /api/calendar-events
 * Fetches calendar events for the authenticated user within a given date range.
 * Query params: ?start=YYYY-MM-DDTHH:mm:ssZ&end=YYYY-MM-DDTHH:mm:ssZ
 */
export async function GET(request: NextRequest) {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryViewStartStr = searchParams.get('start');
    const queryViewEndStr = searchParams.get('end');

    if (!queryViewStartStr || !queryViewEndStr) {
        return NextResponse.json({ error: 'start 와 end 쿼리 파라미터는 필수입니다.' }, { status: 400 });
    }

    const viewStart = new Date(queryViewStartStr);
    const viewEnd = new Date(queryViewEndStr);

    if (isNaN(viewStart.getTime()) || isNaN(viewEnd.getTime())) {
        return NextResponse.json({ error: '유효하지 않은 start 또는 end 날짜 형식입니다.' }, { status: 400 });
    }

    try {
        const events = await prisma.calendarEvent.findMany({
            where: {
                userId: authenticatedUserId,
                // Fetch events that overlap with the [viewStart, viewEnd) interval
                // An event overlaps if: event.start < viewEnd AND event.end > viewStart
                // For events where 'end' might be null (e.g. all-day single day event),
                // we treat its effective end as start + 1 day for comparison.
                AND: [
                    { start: { lt: viewEnd } }, // Event starts before the query window ends
                    {
                        OR: [
                            { end: { gt: viewStart } }, // Event with an end date that ends after the query window starts
                            {
                                // For events with no end date, assume they are for a single day (start date)
                                // and should be included if that day falls within the query window.
                                end: null,
                                start: { gte: viewStart } // (and start < viewEnd is already covered)
                            },
                        ]
                    }
                ]
            },
            orderBy: {
                start: 'asc',
            },
        });
        return NextResponse.json(events);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return NextResponse.json({ error: '일정 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}