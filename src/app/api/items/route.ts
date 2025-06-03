// app/api/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define ProgressStatus enum for Prisma (if not already in your schema.prisma, this is for type safety here)
enum ProgressStatus {
    UNCONFIRMED = 'UNCONFIRMED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
}

// Define DeliveryMethod enum for Prisma (if not already in your schema.prisma)
enum DeliveryMethod {
    DIRECT = 'DIRECT',
    COURIER = 'COURIER',
}

export async function GET(request: NextRequest) {
    try {
        // --- Authentication (example) ---
        // const token = request.cookies.get('token')?.value;
        // if (!token || !verifyToken(token)) { // Replace verifyToken with your actual sync verification
        //     return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        // }
        // For now, bypassing auth for easier testing of pagination logic
        // Ensure you re-enable and test your authentication thoroughly

        const { searchParams } = request.nextUrl;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
        const storeName = searchParams.get('storeName');
        const itemName = searchParams.get('itemName'); // Example: if you add item name search

        const skip = (page - 1) * limit;

        const whereClause: {
            storeName?: string;
            itemName?: { contains: string; mode: 'insensitive' }; // For case-insensitive search
        } = {};
        if (storeName) {
            whereClause.storeName = storeName;
        }
        if (itemName) {
            whereClause.itemName = { contains: itemName, mode: 'insensitive' }; // Example for partial search
        }

        const items = await prisma.item.findMany({
            where: whereClause,
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: skip,
            take: limit,
        });

        const totalItems = await prisma.item.count({
            where: whereClause,
        });

        return NextResponse.json({
            items,
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        });

    } catch (error) {
        console.error("Error fetching items:", error);
        // Type guard for error
        let errorMessage = '서버 오류가 발생했습니다.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: "데이터 조회 중 오류 발생: " + errorMessage }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // --- Authentication ---
        // const token = request.cookies.get('token')?.value;
        // if (!token || !verifyToken(token)) {
        //     return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        // }

        const data = await request.json();

        // Validate enums
        if (!Object.values(DeliveryMethod).includes(data.deliveryMethod)) {
            return NextResponse.json({ error: '유효하지 않은 배송 방식입니다.' }, { status: 400 });
        }
        if (data.progressStatus && !Object.values(ProgressStatus).includes(data.progressStatus)) {
            return NextResponse.json({ error: '유효하지 않은 진행 상태입니다.' }, { status: 400 });
        }


        const item = await prisma.item.create({
            data: {
                storeName: data.storeName,
                itemName: data.itemName,
                quantity: parseInt(data.quantity, 10), // Ensure quantity is an integer
                specification: data.specification,
                deliveryMethod: data.deliveryMethod, // Already validated
                notes: data.notes || null, // Prisma expects null for optional empty strings if defined as String?
                progressStatus: data.progressStatus || ProgressStatus.UNCONFIRMED, // Add progressStatus, default if not provided
            },
        });

        return NextResponse.json(item, { status: 201 }); // Return 201 for created resource
    } catch (error) {
        console.error("Error creating item:", error);
        // Type guard for error
        let errorMessage = '서버 오류가 발생했습니다.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        // Check for Prisma-specific errors if needed, e.g., unique constraint violation
        if ((error as {
            code: string;
            meta?: { target?: string[] };
        }).code === 'P2002') { // Example for unique constraint
            return NextResponse.json({
                error: '이미 존재하는 항목입니다.', details: (error as {
                    code: string;
                    meta?: { target?: string[] };
                }).meta?.target
            }, { status: 409 });
        }
        return NextResponse.json({ error: "항목 생성 중 오류 발생: " + errorMessage }, { status: 500 });
    }
}