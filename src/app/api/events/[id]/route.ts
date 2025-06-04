// app/api/calendar-events/[eventId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-utils'; // Adjust path

interface RouteParams {
    params: Promise<{ eventId: string }>;
}

/**
 * GET /api/calendar-events/[eventId]
 * Fetches a single calendar event by its ID for the authenticated user.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { eventId } = await params;

    try {
        const event = await prisma.calendarEvent.findUnique({
            where: { id: eventId },
        });

        if (!event) {
            return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (event.userId !== authenticatedUserId) {
            return NextResponse.json({ error: '이 일정에 접근할 권한이 없습니다.' }, { status: 403 });
        }

        return NextResponse.json(event);
    } catch (error) {
        console.error(`Error fetching event ${eventId}:`, error);
        return NextResponse.json({ error: '일정 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

/**
 * PUT /api/calendar-events/[eventId]
 * Updates an existing calendar event for the authenticated user.
 * Behaves like PATCH; only updates provided fields.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { eventId } = await params;

    try {
        const body = await request.json();
        const { title, start, end, allDay, color, description } = body;

        // Fetch the event first to ensure it exists and belongs to the user
        const existingEvent = await prisma.calendarEvent.findUnique({
            where: { id: eventId },
        });

        if (!existingEvent) {
            return NextResponse.json({ error: '수정할 일정을 찾을 수 없습니다.' }, { status: 404 });
        }
        if (existingEvent.userId !== authenticatedUserId) {
            return NextResponse.json({ error: '이 일정을 수정할 권한이 없습니다.' }, { status: 403 });
        }

        // Prepare data for update (only include fields that are actually provided)
        const updateData: {
            title?: string;
            start?: Date;
            end?: Date | null; // Allow end to be null
            allDay?: boolean;
            color?: string | null; // Allow color to be null or a string
            description?: string | null; // Allow description to be null or a string
        } = {};
        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim() === '') return NextResponse.json({ error: '일정 제목은 비워둘 수 없습니다.' }, { status: 400 });
            updateData.title = title.trim();
        }
        if (start !== undefined) {
            if (isNaN(new Date(start).getTime())) return NextResponse.json({ error: '유효한 시작일이 필요합니다.' }, { status: 400 });
            updateData.start = new Date(start);
        }
        if (end !== undefined) { // Allow setting end to null
            updateData.end = end ? new Date(end) : null;
            if (end && updateData.end !== null && isNaN(updateData.end.getTime())) return NextResponse.json({ error: '종료일이 제공된 경우 유효한 날짜여야 합니다.' }, { status: 400 });
        }
        if (allDay !== undefined) {
            if (typeof allDay !== 'boolean') return NextResponse.json({ error: 'allDay 값은 boolean이어야 합니다.' }, { status: 400 });
            updateData.allDay = allDay;
        }
        if (color !== undefined) { // Allow setting color to null or a string
            updateData.color = color;
        }
        if (description !== undefined) { // Allow setting description to null or a string
            updateData.description = description;
        }

        if (updateData.start && updateData.end && new Date(updateData.start) > new Date(updateData.end)) {
            return NextResponse.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
        }
        // If only start is updated, and there's an existing end, ensure start <= end
        if (updateData.start && !updateData.end && existingEvent.end && new Date(updateData.start) > existingEvent.end) {
            return NextResponse.json({ error: '시작일은 기존 종료일보다 빠를 수 없습니다.' }, { status: 400 });
        }
        // If only end is updated, ensure start <= new end
        if (updateData.end && !updateData.start && new Date(existingEvent.start) > new Date(updateData.end)) {
            return NextResponse.json({ error: '종료일은 기존 시작일보다 빠를 수 없습니다.' }, { status: 400 });
        }


        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
        }

        const updatedEvent = await prisma.calendarEvent.update({
            where: { id: eventId }, // Ownership already checked
            data: updateData,
        });

        return NextResponse.json(updatedEvent);
    } catch (error: unknown) {
        const err = error as {
            name?: string;
            message?: string;
            stack?: string;
            code?: string;
            meta?: unknown;
        }
        console.error(`Error updating event ${eventId}:`, error);
        if (err.name === 'SyntaxError') {
            return NextResponse.json({ error: '잘못된 요청 데이터 형식입니다.' }, { status: 400 });
        }
        return NextResponse.json({ error: '일정 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

/**
 * PATCH /api/calendar-events/[eventId]
 * Partially updates an existing calendar event. Same implementation as PUT for this case.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    // The PUT implementation already handles partial updates by only changing provided fields.
    // So, we can effectively call the PUT handler or duplicate its logic.
    return PUT(request, { params });
}


/**
 * DELETE /api/calendar-events/[eventId]
 * Deletes a calendar event for the authenticated user.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { eventId } = await params;

    try {
        // Fetch the event first to ensure it exists and belongs to the user
        const existingEvent = await prisma.calendarEvent.findUnique({
            where: { id: eventId },
        });

        if (!existingEvent) {
            return NextResponse.json({ error: '삭제할 일정을 찾을 수 없습니다.' }, { status: 404 });
        }
        if (existingEvent.userId !== authenticatedUserId) {
            return NextResponse.json({ error: '이 일정을 삭제할 권한이 없습니다.' }, { status: 403 });
        }

        await prisma.calendarEvent.delete({
            where: { id: eventId }, // Ownership already checked
        });

        return NextResponse.json({ message: '일정이 성공적으로 삭제되었습니다.' }, { status: 200 });
        // OR return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting event ${eventId}:`, error);
        return NextResponse.json({ error: '일정 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}