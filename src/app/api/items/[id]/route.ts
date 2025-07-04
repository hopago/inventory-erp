// src/app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust path to your Prisma client
import { verifyToken } from '@/lib/auth'; // Adjust path to your token verification utility

// Define ProgressStatus type based on your Prisma schema (enum keys)
type ProgressStatus = "UNCONFIRMED" | "IN_PROGRESS" | "COMPLETED";
type DeliveryMethod = "DIRECT" | "COURIER";

// Interface for the expected data in the PUT request body
interface UpdateItemData {
    storeName?: string;
    itemName?: string;
    quantity?: number | string;
    specification?: string;
    deliveryMethod?: DeliveryMethod;
    progressStatus?: ProgressStatus;
    notes?: string;
}

// Interface for the route parameters (shape of the resolved params)
interface RouteParams {
    id: string;
}

/**
 * Handles PUT requests to update an existing item.
 * @param request - The incoming NextRequest.
 * @param paramsPromise - A promise that resolves to the route parameters.
 * @returns A NextResponse with the updated item or an error message.
 */
export async function PUT(
    request: NextRequest,
    { params: paramsPromise }: { params: Promise<RouteParams> } // params is a Promise
) {
    let idForLogging: string = "[id_unresolved_or_lookup_failed]"; // For logging in catch block

    try {
        const params = await paramsPromise; // Resolve the promise to get actual params
        const { id } = params; // Destructure id from resolved params
        idForLogging = id; // Set for logging in case of subsequent errors

        // 1. Authenticate the request
        const token = request.cookies.get('token')?.value;
        if (!token || !verifyToken(token)) { // Assuming verifyToken returns a boolean or relevant user payload
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        // 2. Parse the item ID from route parameters
        const itemId = parseInt(id, 10); // Using destructured id
        if (isNaN(itemId)) {
            return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
        }

        // 3. Parse the request body
        const data: UpdateItemData = await request.json();

        // 4. Construct the payload for Prisma update, only including fields present in the request
        const updatePayload: { [key: string]: string | number | Date | null | ProgressStatus | DeliveryMethod } = {
            updatedAt: new Date(), // Always update the updatedAt timestamp
        };

        if (data.storeName !== undefined) updatePayload.storeName = data.storeName;
        if (data.itemName !== undefined) updatePayload.itemName = data.itemName;
        if (data.quantity !== undefined) {
            const quantity = parseInt(String(data.quantity), 10);
            if (isNaN(quantity) || quantity < 0) {
                return NextResponse.json({ error: '수량은 0 이상의 유효한 숫자여야 합니다.' }, { status: 400 });
            }
            updatePayload.quantity = quantity;
        }
        if (data.specification !== undefined) updatePayload.specification = data.specification;
        if (data.deliveryMethod !== undefined) updatePayload.deliveryMethod = data.deliveryMethod;
        if (data.progressStatus !== undefined) updatePayload.progressStatus = data.progressStatus;
        if (data.notes !== undefined) updatePayload.notes = data.notes === '' ? null : data.notes;


        if (Object.keys(updatePayload).length <= 1) {
            return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
        }

        // 5. Update the item in the database
        const updatedItem = await prisma.item.update({
            where: { id: itemId },
            data: updatePayload,
        });

        return NextResponse.json(updatedItem);

    } catch (e: unknown) {
        const error = e;
        console.error(`PUT /api/items/${idForLogging} Error:`, error);

        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2025') {
            return NextResponse.json({ error: '해당 ID의 비품을 찾을 수 없습니다.' }, { status: 404 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: '잘못된 요청 본문 형식입니다.' }, { status: 400 });
        }
        let message = '서버 오류가 발생했습니다.';
        if (error instanceof Error) {
            message = error.message;
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * Handles DELETE requests to remove an item.
 * @param request - The incoming NextRequest.
 * @param paramsPromise - A promise that resolves to the route parameters.
 * @returns A NextResponse with a success message or an error message.
 */
export async function DELETE(
    request: NextRequest,
    { params: paramsPromise }: { params: Promise<RouteParams> } // params is a Promise
) {
    let idForLogging: string = "[id_unresolved_or_lookup_failed]"; // For logging in catch block

    try {
        const params = await paramsPromise; // Resolve the promise to get actual params
        const { id } = params; // Destructure id from resolved params
        idForLogging = id; // Set for logging

        // 1. Authenticate the request
        const token = request.cookies.get('token')?.value;
        if (!token || !verifyToken(token)) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        // 2. Parse the item ID from route parameters
        const itemId = parseInt(id, 10); // Using destructured id
        if (isNaN(itemId)) {
            return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
        }

        // 3. Delete the item from the database
        await prisma.item.delete({
            where: { id: itemId },
        });

        // 4. Return a success response
        return NextResponse.json({ message: `ID ${itemId} 비품이 성공적으로 삭제되었습니다.` }, { status: 200 });

    } catch (e: unknown) {
        const error = e;
        console.error(`DELETE /api/items/${idForLogging} Error:`, error);

        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2025') {
            return NextResponse.json({ error: '삭제할 ID의 비품을 찾을 수 없습니다.' }, { status: 404 });
        }
        let message = '서버 오류가 발생했습니다.';
        if (error instanceof Error) {
            message = error.message;
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// You can also add a GET handler here if needed, for fetching a single item by ID.
// For example:
/*
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<RouteParams> } // params is a Promise
) {
  let idForLogging: string = "[id_unresolved_or_lookup_failed]"; // For logging in catch block

  try {
    const params = await paramsPromise; // Resolve the promise
    const { id } = params; // Destructure id
    idForLogging = id; // Set for logging

    // Optional: Token verification
    // const token = request.cookies.get('token')?.value;
    // if (!token || !verifyToken(token)) {
    //   return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    // }

    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: '해당 ID의 비품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (e: unknown) { 
    const error = e;
    console.error(`GET /api/items/${idForLogging} Error:`, error); 
    let message = '서버 오류가 발생했습니다.';
    if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
*/
