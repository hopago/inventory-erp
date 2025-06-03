// app/api/todos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TodoPriority, Prisma } from '@prisma/client'; // Import Prisma for types
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Creates a standardized error response.
 * @param message The error message.
 * @param status The HTTP status code.
 * @returns A NextResponse JSON object.
 */
// function errorResponse(message: string, status = 400) {
//     const relevantMessage = isDev ? message : "An error occurred while processing your request.";
//     const payload = { error: relevantMessage, success: false }; // Added success: false for consistency
//     return NextResponse.json(payload, { status });
// }

type RouteParams = {
    id: string; // Assuming the ID is a string, adjust if it's a number
};

// Zod schema for pagination and filtering parameters
const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    userId: z.coerce.number().int().optional(), // Assuming userId in DB is Int
    completed: z.enum(['true', 'false']).optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    priority: z.nativeEnum(TodoPriority).optional(),
    search: z.string().trim().optional(),
    // You could add sortBy and sortOrder here for more dynamic sorting
    // sortBy: z.enum(['createdAt', 'priority', 'deadline']).optional().default('priority'),
    // sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Helper for error responses (ensure this is defined or imported)
const isDev = process.env.NODE_ENV === 'development';
function errorResponse(message: string, status = 400) {
    const relevantMessage = isDev ? message : "An error occurred while processing your request.";
    const payload = { error: relevantMessage };
    return NextResponse.json(payload, { status });
}

/**
 * Interface for a standardized success response.
 */
interface SuccessResponseData<T> {
    data: T;
    success: true;
    meta?: object; // Optional meta field
}

/**
 * Creates a standardized success response.
 * @param data The data to be returned.
 * @param status The HTTP status code.
 * @param meta Optional metadata.
 * @returns A NextResponse JSON object.
 */
function successResponse<T>(data: T, status = 200, meta?: object) {
    const responsePayload: SuccessResponseData<T> = { data, success: true };
    if (meta) {
        responsePayload.meta = meta;
    }
    return NextResponse.json(responsePayload, { status });
}
//#endregion

// Zod schema for updating a Todo
const todoUpdateSchema = z.object({
    text: z.string().trim().min(1).optional(),
    completed: z.boolean().optional(),
    priority: z.nativeEnum(TodoPriority).optional(),
    deadline: z.string().datetime().optional().nullable(),
    userId: z.coerce.number().int().optional().nullable(),
});

// GET: Fetch a list of Todos with pagination, filtering, and search
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const paramsToValidate: Record<string, string | undefined> = {};
        searchParams.forEach((value, key) => {
            paramsToValidate[key] = value;
        });

        const validationResult = paginationSchema.safeParse(paramsToValidate);

        if (!validationResult.success) {
            return errorResponse(
                validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
                400
            );
        }

        const { page, limit, userId, completed, priority, search } = validationResult.data;

        // Construct 'where' object for Prisma query
        const where: Prisma.TodoWhereInput = {};
        if (userId !== undefined) {
            where.userId = userId;
        }
        if (completed !== undefined) {
            where.completed = completed;
        }
        if (priority) {
            where.priority = priority;
        }
        if (search) {
            where.text = {
                contains: search,
                mode: 'insensitive', // Case-insensitive search
            };
        }
        // Example: Add deadline-based filtering if needed in the future
        // if (validationResult.data.deadlineBefore) {
        //   where.deadline = { ...where.deadline, lte: validationResult.data.deadlineBefore };
        // }

        // Fetch total count of todos matching the criteria
        const totalCount = await prisma.todo.count({ where });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const skip = (page - 1) * limit;

        // Define sorting order
        const orderBy: Prisma.TodoOrderByWithRelationInput[] = [
            { priority: 'asc' }, // Or based on validationResult.data.sortBy/sortOrder
            { createdAt: 'desc' },
        ];
        // Example: if (validationResult.data.sortByDeadline) orderBy.unshift({ deadline: validationResult.data.sortByDeadline });


        // Fetch todos with pagination, filtering, sorting, and include user details
        const todos = await prisma.todo.findMany({
            where,
            include: {
                user: { // Include related user data
                    select: {
                        id: true,
                        username: true,
                        role: true,
                    },
                },
            },
            orderBy,
            skip,
            take: limit,
        });

        // Construct the meta object for the response
        const meta = {
            currentPage: page,
            totalPages: totalPages,
            totalCount: totalCount,
            limit: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };

        // Return success response with todos and meta
        return NextResponse.json({ data: todos, success: true, meta });

    } catch (error) {
        console.error('GET /api/todos 오류:', error);
        const errorMessage = error instanceof Error && isDev ? error.message : 'Todo 목록을 불러오는 중 오류가 발생했습니다.';
        return errorResponse(errorMessage, 500);
    }
}


/* -------------------------------------------------------------------------- */
/* PUT /api/todos/[id]                                                        */
/* -------------------------------------------------------------------------- */
export async function PUT(
    req: NextRequest,
    // Corrected: params is an object, not a Promise
    { params }: { params: Promise<RouteParams> }
) {
    try {
        // Corrected: Access id directly from params, no await needed
        const { id } = await params;

        if (!id) {
            return errorResponse("Todo ID is required in path.", 400);
        }

        const body: unknown = await req.json();
        const validation = todoUpdateSchema.safeParse(body);

        if (!validation.success) {
            const msg = validation.error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join(", ");
            return errorResponse(msg, 400); // Changed status to 400 for validation errors
        }
        const data = validation.data;

        const existing = await prisma.todo.findUnique({ where: { id } });
        if (!existing) {
            return errorResponse("존재하지 않는 Todo입니다.", 404);
        }

        if (data.userId !== undefined && data.userId !== null) {
            const userExists = await prisma.user.findUnique({ where: { id: data.userId } });
            if (!userExists) {
                return errorResponse("존재하지 않는 사용자입니다.", 400); // Changed status to 400
            }
        }

        const updated = await prisma.todo.update({
            where: { id },
            data,
            include: { user: { select: { id: true, username: true, role: true } } },
        });

        return successResponse(updated);
    } catch (e) {
        console.error("PUT /api/todos/[id] 오류:", e);
        if (e instanceof z.ZodError && isDev) { // Only show detailed Zod errors in dev
            return errorResponse(e.errors.map((x) => x.message).join(", "), 400);
        }
        const errorMessage = e instanceof Error && isDev ? e.message : "Todo 수정 중 오류가 발생했습니다.";
        return errorResponse(errorMessage, 500);
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE /api/todos/[id]                                                     */
/* -------------------------------------------------------------------------- */
export async function DELETE(
    _req: NextRequest,
    // Corrected: params is an object, not a Promise
    { params }: { params: Promise<RouteParams> }
) {
    try {
        // Corrected: Access id directly from params, no await needed
        const { id } = await params;

        if (!id) {
            return errorResponse("Todo ID is required in path.", 400);
        }

        const existing = await prisma.todo.findUnique({ where: { id } });
        if (!existing) {
            return errorResponse("존재하지 않는 Todo입니다.", 404);
        }

        await prisma.todo.delete({ where: { id } });
        return NextResponse.json({ success: true, message: "Todo가 성공적으로 삭제되었습니다." });
    } catch (e) {
        console.error("DELETE /api/todos/[id] 오류:", e);
        const errorMessage = e instanceof Error && isDev ? e.message : "Todo 삭제 중 오류가 발생했습니다.";
        return errorResponse(errorMessage, 500);
    }
}