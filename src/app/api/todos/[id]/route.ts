import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TodoPriority } from "@prisma/client";
import { z } from "zod";

/* ---------- helpers ---------- */
const isDev = process.env.NODE_ENV === "development";

const successResponse = <T>(data: T, status = 200, meta?: object) => {
    const payload: any = { success: true, data };
    if (meta) payload.meta = meta;
    return NextResponse.json(payload, { status });
};

const errorResponse = (message: string, status = 400) => {
    const payload = {
        success: false,
        error: isDev ? message : "요청 처리 중 오류가 발생했습니다.",
    };
    return NextResponse.json(payload, { status });
};

/* ---------- Zod schema ---------- */
const todoUpdateSchema = z.object({
    text: z.string().trim().min(1).optional(),
    completed: z.boolean().optional(),
    priority: z.nativeEnum(TodoPriority).optional(),
    deadline: z.string().datetime().optional().nullable(),
    userId: z.coerce.number().int().optional().nullable(),
});

/* ---------- type ---------- */
interface RouteParams {
    id: string;
}

/* ---------- GET /api/todos/[id] ---------- */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    const { id } = await params;
    if (!id) return errorResponse("Todo ID가 필요합니다.", 400);

    try {
        const todo = await prisma.todo.findUnique({
            where: { id },
            include: { user: { select: { id: true, username: true, role: true } } },
        });
        if (!todo) return errorResponse("존재하지 않는 Todo입니다.", 404);

        return successResponse(todo);
    } catch (e) {
        console.error("GET /api/todos/[id] 오류:", e);
        return errorResponse("Todo 조회 중 오류가 발생했습니다.", 500);
    }
}

/* ---------- PUT /api/todos/[id] ---------- */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    const { id } = await params;
    if (!id) return errorResponse("Todo ID가 필요합니다.", 400);

    try {
        const body = await req.json();
        const validation = todoUpdateSchema.safeParse(body);
        if (!validation.success) {
            const msg = validation.error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join(", ");
            return errorResponse(msg, 400);
        }
        const data = validation.data;

        const existing = await prisma.todo.findUnique({ where: { id } });
        if (!existing) return errorResponse("존재하지 않는 Todo입니다.", 404);

        if (data.userId !== undefined && data.userId !== null) {
            const userExists = await prisma.user.findUnique({
                where: { id: data.userId },
            });
            if (!userExists) return errorResponse("존재하지 않는 사용자입니다.", 400);
        }

        const updated = await prisma.todo.update({
            where: { id },
            data,
            include: { user: { select: { id: true, username: true, role: true } } },
        });

        return successResponse(updated);
    } catch (e) {
        console.error("PUT /api/todos/[id] 오류:", e);
        if (e instanceof z.ZodError && isDev) {
            return errorResponse(
                e.errors.map((x) => x.message).join(", "),
                400
            );
        }
        const msg =
            e instanceof Error && isDev
                ? e.message
                : "Todo 수정 중 오류가 발생했습니다.";
        return errorResponse(msg, 500);
    }
}

/* ---------- DELETE /api/todos/[id] ---------- */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<RouteParams> }
) {
    const { id } = await params;
    if (!id) return errorResponse("Todo ID가 필요합니다.", 400);

    try {
        const existing = await prisma.todo.findUnique({ where: { id } });
        if (!existing) return errorResponse("존재하지 않는 Todo입니다.", 404);

        await prisma.todo.delete({ where: { id } });
        return successResponse({ deletedId: id });
    } catch (e) {
        console.error("DELETE /api/todos/[id] 오류:", e);
        const msg =
            e instanceof Error && isDev
                ? e.message
                : "Todo 삭제 중 오류가 발생했습니다.";
        return errorResponse(msg, 500);
    }
}