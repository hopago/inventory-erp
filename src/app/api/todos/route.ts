// app/api/todos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, TodoPriority } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Todo 생성/수정을 위한 스키마 정의
const todoSchema = z.object({
    text: z.string().min(1, '할 일 내용을 입력해주세요.').max(200, '할 일 내용은 200자 이하로 입력해주세요.'),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
    completed: z.boolean().optional().default(false),
    userId: z.number().optional().nullable(),
});

const todoUpdateSchema = z.object({
    text: z.string().min(1).max(200).optional(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    completed: z.boolean().optional(),
    userId: z.number().optional().nullable(),
});

// 페이지네이션 스키마
const paginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    userId: z.coerce.number().optional(),
    completed: z.enum(['true', 'false']).optional(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    search: z.string().optional(),
});

// 에러 응답 헬퍼 함수
function errorResponse(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status });
}

// 성공 응답 헬퍼 함수
function successResponse(data: any, status: number = 200, meta?: any) {
    return NextResponse.json({
        data,
        success: true,
        ...(meta && { meta })
    }, { status });
}

// GET: 페이지네이션이 적용된 Todo 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Prepare parameters for validation
        const paramsToValidate: {
            page?: string | null;
            limit?: string | null;
            userId?: string | null;
            completed?: string | null;
            priority?: string | null;
            search?: string | null;
        } = {
            page: searchParams.get('page'),
            limit: searchParams.get('limit'),
        };

        const userIdParam = searchParams.get('userId');
        if (userIdParam !== null) {
            paramsToValidate.userId = userIdParam;
        }

        const completedParam = searchParams.get('completed');
        if (completedParam !== null) {
            paramsToValidate.completed = completedParam;
        }

        const priorityParam = searchParams.get('priority');
        if (priorityParam !== null) {
            paramsToValidate.priority = priorityParam;
        }

        const searchParam = searchParams.get('search');
        if (searchParam !== null) {
            paramsToValidate.search = searchParam;
        }

        // 페이지네이션 파라미터 검증
        const validationResult = paginationSchema.safeParse(paramsToValidate);

        if (!validationResult.success) {
            return errorResponse(
                validationResult.error.errors.map(err => err.message).join(', ')
            );
        }

        const { page, limit, userId, completed, priority, search } = validationResult.data;

        // ... rest of your GET handler logic remains the same

        // 필터 조건 구성
        const where: any = {};

        if (userId) { // userId here would be number | undefined after validation
            where.userId = userId;
        }

        if (completed !== undefined) { // completed here would be 'true' | 'false' | undefined
            where.completed = completed === 'true';
        }

        if (priority && ['HIGH', 'MEDIUM', 'LOW'].includes(priority)) { // priority here would be 'HIGH' | 'MEDIUM' | 'LOW' | undefined
            where.priority = priority as TodoPriority;
        }

        if (search) { // search here would be string | undefined
            where.text = {
                contains: search,
                mode: 'insensitive'
            };
        }

        // 전체 개수 조회
        const totalCount = await prisma.todo.count({ where });

        // 페이지네이션 계산
        const totalPages = Math.ceil(totalCount / limit); // limit will have its default from schema if not provided
        const skip = (page - 1) * limit; // page will have its default from schema if not provided

        // Todo 조회
        const todos = await prisma.todo.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                    }
                }
            },
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'desc' },
            ],
            skip,
            take: limit,
        });

        const meta = {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
        };

        return successResponse(todos, 200, meta);
    } catch (error) {
        console.error('GET /api/todos 오류:', error);
        return errorResponse('Todo 목록을 불러오는 중 오류가 발생했습니다.', 500);
    }
}

// POST: 새 Todo 생성
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 요청 데이터 유효성 검사
        const validationResult = todoSchema.safeParse(body);
        if (!validationResult.success) {
            return errorResponse(
                validationResult.error.errors.map(err => err.message).join(', ')
            );
        }

        const { text, priority, completed, userId } = validationResult.data;

        // 사용자 ID가 제공된 경우 해당 사용자가 존재하는지 확인
        if (userId) {
            const userExists = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!userExists) {
                return errorResponse('존재하지 않는 사용자입니다.');
            }
        }

        // Todo 생성
        const newTodo = await prisma.todo.create({
            data: {
                text,
                priority: priority as TodoPriority,
                completed,
                userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                    }
                }
            }
        });

        return successResponse(newTodo, 201);
    } catch (error) {
        console.error('POST /api/todos 오류:', error);
        return errorResponse('Todo 생성 중 오류가 발생했습니다.', 500);
    }
}

// PUT: Todo 수정
export async function PUT(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return errorResponse('Todo ID가 필요합니다.');
        }

        const body = await request.json();

        // 요청 데이터 유효성 검사
        const validationResult = todoUpdateSchema.safeParse(body);
        if (!validationResult.success) {
            return errorResponse(
                validationResult.error.errors.map(err => err.message).join(', ')
            );
        }

        const updateData = validationResult.data;

        // 기존 Todo 존재 여부 확인
        const existingTodo = await prisma.todo.findUnique({
            where: { id }
        });

        if (!existingTodo) {
            return errorResponse('존재하지 않는 Todo입니다.', 404);
        }

        // 사용자 ID가 변경되는 경우 해당 사용자 존재 여부 확인
        if (updateData.userId !== undefined && updateData.userId !== null) {
            const userExists = await prisma.user.findUnique({
                where: { id: updateData.userId }
            });

            if (!userExists) {
                return errorResponse('존재하지 않는 사용자입니다.');
            }
        }

        // Todo 업데이트
        const updatedTodo = await prisma.todo.update({
            where: { id },
            data: {
                ...updateData,
                priority: updateData.priority as TodoPriority | undefined,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                    }
                }
            }
        });

        return successResponse(updatedTodo);
    } catch (error) {
        console.error('PUT /api/todos 오류:', error);
        return errorResponse('Todo 수정 중 오류가 발생했습니다.', 500);
    }
}

// DELETE: Todo 삭제
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return errorResponse('Todo ID가 필요합니다.');
        }

        // 기존 Todo 존재 여부 확인
        const existingTodo = await prisma.todo.findUnique({
            where: { id }
        });

        if (!existingTodo) {
            return errorResponse('존재하지 않는 Todo입니다.', 404);
        }

        // Todo 삭제
        await prisma.todo.delete({
            where: { id }
        });

        return successResponse({ message: 'Todo가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('DELETE /api/todos 오류:', error);
        return errorResponse('Todo 삭제 중 오류가 발생했습니다.', 500);
    }
}