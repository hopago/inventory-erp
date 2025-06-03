// scripts/seed.ts
import {
    Role,
    DeliveryMethod,
    ProgressStatus,
    TodoPriority,
} from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * util: 날짜 헬퍼 – 오늘 기준 n일 후를 반환
 */
const daysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
};

async function main() {
    console.log("초기 사용자, 품목, Todo 데이터 시딩을 시작합니다...");

    // 1) User (ADMIN, USER)
    const adminPassword = await hashPassword(
        process.env.ADMIN_PASSWORD || "defaultAdminPassword123!",
    );
    const adminUser = await prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
            username: "admin",
            password: adminPassword,
            role: Role.ADMIN,
        },
    });
    console.log(`관리자(admin) 계정 확인/생성 – ID: ${adminUser.id}`);

    const userPassword = await hashPassword(
        process.env.USER_PASSWORD || "defaultUserPassword456!",
    );
    const normalUser = await prisma.user.upsert({
        where: { username: "user" },
        update: {},
        create: {
            username: "user",
            password: userPassword,
            role: Role.USER,
        },
    });
    console.log(`일반 사용자(user) 계정 확인/생성 – ID: ${normalUser.id}`);

    // 2) Items – 김포 / 동래 / 구월
    const itemsData = [
        {
            storeName: "김포",
            itemName: "드라이버 박스",
            quantity: 100,
            specification: "25개=1묶음",
            deliveryMethod: DeliveryMethod.COURIER,
            progressStatus: ProgressStatus.UNCONFIRMED,
        },
        {
            storeName: "동래",
            itemName: "아이언 박스",
            quantity: 80,
            specification: "25개=1묶음",
            deliveryMethod: DeliveryMethod.DIRECT,
            progressStatus: ProgressStatus.IN_PROGRESS,
        },
        {
            storeName: "구월",
            itemName: "브램튼 19L",
            quantity: 40,
            specification: "ea",
            deliveryMethod: DeliveryMethod.COURIER,
            progressStatus: ProgressStatus.COMPLETED,
        },
    ];

    // 개발 편의: 기존 데이터 초기화 후 삽입
    await prisma.item.deleteMany();
    console.log("기존 품목 데이터 삭제 완료");
    const createdItems = await prisma.item.createMany({ data: itemsData });
    console.log(`${createdItems.count}개의 품목 데이터 생성 완료`);

    // 3) HR‑related Todos
    const todosData = [
        {
            text: "근태 관리 규정 검토 및 개선안 작성",
            completed: false,
            priority: TodoPriority.HIGH,
            deadline: daysFromNow(5),
            userId: adminUser.id,
        },
        {
            text: "2025년 연봉 테이블 업데이트",
            completed: false,
            priority: TodoPriority.MEDIUM,
            deadline: daysFromNow(10),
            userId: adminUser.id,
        },
        {
            text: "하반기 채용 공고 작성 및 게시",
            completed: true,
            priority: TodoPriority.MEDIUM,
            deadline: daysFromNow(-2), // 이미 지난 마감(완료)
            userId: normalUser.id,
        },
        {
            text: "직원 교육 프로그램 일정 수립",
            completed: false,
            priority: TodoPriority.LOW,
            deadline: daysFromNow(20),
            userId: normalUser.id,
        },
        {
            text: "성과 평가 지표(OKR) 최종 검토",
            completed: false,
            priority: TodoPriority.HIGH,
            deadline: daysFromNow(7),
            userId: null, // 공통 작업
        },
        {
            text: "복리후생 설문조사 결과 분석",
            completed: false,
            priority: TodoPriority.LOW,
            deadline: daysFromNow(14),
            userId: null,
        },
    ];

    // 기존 Todo 초기화 후 삽입
    await prisma.todo.deleteMany();
    console.log("기존 Todo 데이터 삭제 완료");

    const todosWithUser = todosData.filter((t) => t.userId !== null);
    const todosNoUser = todosData.filter((t) => t.userId === null);

    let createdCount = 0;

    if (todosWithUser.length) {
        const formatted = todosWithUser.map((t) => ({
            text: t.text,
            completed: t.completed,
            priority: t.priority,
            userId: t.userId as number,
            deadline: t.deadline,
        }));
        const res = await prisma.todo.createMany({ data: formatted });
        createdCount += res.count;
        console.log(`${res.count}개의 사용자 할당 Todo 생성`);
    }

    for (const t of todosNoUser) {
        await prisma.todo.create({
            data: {
                text: t.text,
                completed: t.completed,
                priority: t.priority,
                userId: null,
                deadline: t.deadline,
            },
        });
        createdCount++;
    }
    console.log(`${todosNoUser.length}개의 공통 Todo 생성`);
    console.log(`총 ${createdCount}개의 Todo 데이터 생성 완료`);

    console.log("시딩 작업 완료");
}

main()
    .catch((e) => {
        console.error("시딩 중 오류 발생:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
