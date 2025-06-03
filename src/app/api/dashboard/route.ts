// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from "@/lib/auth";
import { DeliveryMethod, ProgressStatus } from '@prisma/client'; // Import ProgressStatus

// Helper to translate ProgressStatus enum keys to Korean names
const translateProgressStatus = (status: ProgressStatus): string => {
    switch (status) {
        case ProgressStatus.UNCONFIRMED: return '미확인';
        case ProgressStatus.IN_PROGRESS: return '진행 중';
        case ProgressStatus.COMPLETED: return '완료';
        default: return status;
    }
};

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value;
        if (!token || !verifyToken(token)) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        // 1. 매장별 총 수량 집계 (Existing)
        const storeDataAgg = await prisma.item.groupBy({
            by: ['storeName'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } }
        });
        const formattedStoreData = storeDataAgg.map(item => ({
            storeName: item.storeName,
            totalQuantity: item._sum.quantity || 0
        }));

        // 2. 배송방식별 개수 집계 (Existing)
        const deliveryDataAgg = await prisma.item.groupBy({
            by: ['deliveryMethod'],
            _count: { id: true }
        });
        const formattedDeliveryData = deliveryDataAgg.map(item => ({
            name: item.deliveryMethod === DeliveryMethod.DIRECT ? '직접배송' : '택배출고',
            count: item._count.id
        }));

        // 3. 전체 진행 상태별 품목 수 (NEW)
        const progressStatusCountsAgg = await prisma.item.groupBy({
            by: ['progressStatus'],
            _count: { id: true },
            orderBy: { progressStatus: 'asc' }
        });
        const formattedProgressStatusCounts = progressStatusCountsAgg.map(item => ({
            status: item.progressStatus,
            name: translateProgressStatus(item.progressStatus),
            count: item._count.id
        }));

        // 4. 매장별 미확인 품목 수 (NEW)
        const unconfirmedByStoreAgg = await prisma.item.groupBy({
            by: ['storeName'],
            where: { progressStatus: ProgressStatus.UNCONFIRMED },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });
        const formattedUnconfirmedByStore = unconfirmedByStoreAgg.map(item => ({
            storeName: item.storeName,
            count: item._count.id
        }));

        // 5. 매장별 진행 중 품목 수 (NEW)
        const inProgressByStoreAgg = await prisma.item.groupBy({
            by: ['storeName'],
            where: { progressStatus: ProgressStatus.IN_PROGRESS },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });
        const formattedInProgressByStore = inProgressByStoreAgg.map(item => ({
            storeName: item.storeName,
            count: item._count.id
        }));

        // 6. 주요 요약 통계 (NEW)
        const totalItems = await prisma.item.count();
        const totalUnconfirmed = await prisma.item.count({ where: { progressStatus: ProgressStatus.UNCONFIRMED } });
        const totalInProgress = await prisma.item.count({ where: { progressStatus: ProgressStatus.IN_PROGRESS } });
        const totalCompleted = await prisma.item.count({ where: { progressStatus: ProgressStatus.COMPLETED } });

        const overallStats = {
            totalItems,
            totalUnconfirmed,
            totalInProgress,
            totalCompleted
        };

        return NextResponse.json({
            storeData: formattedStoreData,
            deliveryData: formattedDeliveryData,
            progressStatusCounts: formattedProgressStatusCounts,
            unconfirmedByStore: formattedUnconfirmedByStore,
            inProgressByStore: formattedInProgressByStore,
            overallStats: overallStats
        });

    } catch (error) {
        console.error("Dashboard API Error:", error); // Log the actual error on the server
        return NextResponse.json({ error: '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.' }, { status: 500 });
    }
}