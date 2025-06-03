// scripts/seed.ts
import { PrismaClient, Role, DeliveryMethod, ProgressStatus, TodoPriority } from '@prisma/client';
import { hashPassword } from "@/lib/auth"; // Assuming this path is correct for your project structure

const prisma = new PrismaClient();

async function main() {
    console.log('초기 사용자, 품목, Todo 데이터 시딩을 시작합니다...');

    // --- 사용자(User) 데이터 시딩 ---
    const adminPassword = await hashPassword(process.env.ADMIN_PASSWORD || "defaultAdminPassword123!");

    const adminUser = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: adminPassword,
            role: Role.ADMIN,
        },
    });
    console.log(`관리자(admin) 계정이 생성 또는 확인되었습니다. ID: ${adminUser.id}`);

    const userPassword = await hashPassword(process.env.USER_PASSWORD || "defaultUserPassword456!");

    const normalUser = await prisma.user.upsert({
        where: { username: 'user' },
        update: {},
        create: {
            username: 'user',
            password: userPassword,
            role: Role.USER,
        },
    });
    console.log(`일반 사용자(user) 계정이 생성 또는 확인되었습니다. ID: ${normalUser.id}`);

    // --- 품목(Item) 데이터 시딩 ---
    const itemsData = [
        {
            storeName: '본사 물류센터',
            itemName: '프리미엄 기계식 키보드 (갈축)',
            quantity: 75,
            specification: 'RGB 백라이트, PBT 키캡, USB-C 타입',
            deliveryMethod: DeliveryMethod.COURIER,
            notes: '키보드 루프 포함',
            progressStatus: ProgressStatus.UNCONFIRMED,
        },
        {
            storeName: '강남 직영점',
            itemName: '27인치 게이밍 모니터 (144Hz)',
            quantity: 30,
            specification: 'QHD 해상도, 1ms 응답속도, G-Sync 호환',
            deliveryMethod: DeliveryMethod.DIRECT,
            progressStatus: ProgressStatus.IN_PROGRESS,
        },
        {
            storeName: '온라인 쇼핑몰 창고',
            itemName: '무선 블루투스 이어폰 Pro',
            quantity: 250,
            specification: '액티브 노이즈 캔슬링, IPX7 방수',
            deliveryMethod: DeliveryMethod.COURIER,
            notes: '색상: 스페이스 블랙',
            progressStatus: ProgressStatus.COMPLETED,
        },
        {
            storeName: '본사 물류센터',
            itemName: 'ERP 시스템 연동 바코드 스캐너',
            quantity: 50,
            specification: '2D QR코드 지원, USB 연결',
            deliveryMethod: DeliveryMethod.COURIER,
            progressStatus: ProgressStatus.UNCONFIRMED,
        },
        {
            storeName: '부산 지점',
            itemName: '경량 노트북 (14인치)',
            quantity: 20,
            specification: 'Intel i5, 16GB RAM, 512GB SSD, Windows 11 Pro',
            deliveryMethod: DeliveryMethod.DIRECT,
            notes: '무게: 1.2kg, 색상: 실버',
            progressStatus: ProgressStatus.IN_PROGRESS,
        },
    ];

    // 기존 Items 데이터 삭제 후 재생성 (개발 환경에서만)
    // Consider if this is always desired, or only in dev
    await prisma.item.deleteMany({});
    console.log('기존 품목 데이터가 삭제되었습니다.');

    const createdItems = await prisma.item.createMany({
        data: itemsData,
    });

    console.log(`${createdItems.count}개의 품목 데이터가 생성되었습니다.`);

    // --- Todo 데이터 시딩 ---
    // Ensure adminUser.id and normalUser.id are available
    if (!adminUser || !normalUser) {
        console.error("사용자 정보가 올바르게 로드되지 않아 Todo 시딩을 중단합니다.");
        return;
    }

    const todosData = [
        {
            text: '프로젝트 기획서 작성',
            completed: false,
            priority: TodoPriority.HIGH,
            userId: adminUser.id, // 관리자에게 할당
        },
        {
            text: 'API 문서 검토',
            completed: true,
            priority: TodoPriority.MEDIUM,
            userId: adminUser.id,
        },
        {
            text: '데이터베이스 스키마 설계',
            completed: false,
            priority: TodoPriority.HIGH,
            userId: normalUser.id, // 일반 사용자에게 할당
        },
        {
            text: '프론트엔드 컴포넌트 개발',
            completed: false,
            priority: TodoPriority.MEDIUM,
            userId: normalUser.id,
        },
        {
            text: '테스트 코드 작성',
            completed: false,
            priority: TodoPriority.LOW,
            userId: adminUser.id,
        },
        {
            text: '배포 환경 구성',
            completed: true,
            priority: TodoPriority.HIGH,
            userId: normalUser.id,
        },
        {
            text: '사용자 가이드 작성',
            completed: false,
            priority: TodoPriority.LOW,
            userId: null, // 할당되지 않은 Todo (공통 작업)
        },
        {
            text: '보안 점검',
            completed: false,
            priority: TodoPriority.HIGH,
            userId: null,
        }
    ];

    // 기존 Todo 데이터 삭제 후 재생성 (개발 환경에서만)
    await prisma.todo.deleteMany({});
    console.log('기존 Todo 데이터가 삭제되었습니다.');

    const todosWithUserId = todosData.filter(todo => todo.userId !== null);
    const todosWithoutUserId = todosData.filter(todo => todo.userId === null);

    let createdCount = 0;

    // Create todos with userId using createMany
    if (todosWithUserId.length > 0) {
        // Ensure userId is not undefined before passing to createMany
        const validTodosWithUserId = todosWithUserId.map(todo => ({
            text: todo.text,
            completed: todo.completed,
            priority: todo.priority,
            userId: todo.userId as number, // Assert userId is number here as we filtered out nulls
        }));
        const result = await prisma.todo.createMany({
            data: validTodosWithUserId,
        });
        console.log(`${result.count}개의 (사용자 할당) Todo 데이터가 생성되었습니다.`);
        createdCount += result.count;
    }

    // Create todos without userId (userId is null) using a loop of prisma.todo.create
    for (const todo of todosWithoutUserId) {
        await prisma.todo.create({
            data: {
                text: todo.text,
                completed: todo.completed,
                priority: todo.priority,
                userId: null, // Explicitly set userId to null
            },
        });
        createdCount++;
    }
    console.log(`${todosWithoutUserId.length}개의 (사용자 미할당) Todo 데이터가 생성되었습니다.`);
    console.log(`총 ${createdCount}개의 Todo 데이터가 생성되었습니다.`);

    console.log('초기 사용자, 품목, Todo 데이터 시딩이 완료되었습니다.');
}

main()
    .catch((e) => {
        console.error('시딩 중 오류 발생:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
