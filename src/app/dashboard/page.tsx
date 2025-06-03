// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, PackageSearch, Store, TrendingUp } from 'lucide-react';

// Define ProgressStatus type based on your Prisma schema (enum keys)
type ProgressStatusType = 'UNCONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';

// Interface for data from API (adjust based on your actual API response)
interface StoreQuantity {
  storeName: string;
  totalQuantity: number;
}

interface DeliveryDistribution {
  name: string; // e.g., '직접배송', '택배출고'
  count: number;
}

interface ProgressStatusCount {
  status: ProgressStatusType;
  name: string; // Korean name for status
  count: number;
}

interface StatusByStore {
  storeName: string;
  count: number;
}

interface OverallStats {
  totalItems: number;
  totalUnconfirmed: number;
  totalInProgress: number;
  totalCompleted: number;
}

interface DashboardData {
  storeData: StoreQuantity[];
  deliveryData: DeliveryDistribution[];
  progressStatusCounts: ProgressStatusCount[];
  unconfirmedByStore: StatusByStore[];
  inProgressByStore: StatusByStore[];
  overallStats: OverallStats;
}

// Helper to translate status keys to Korean (consistent with TablePage)
const translateProgressStatus = (status: ProgressStatusType): string => {
  switch (status) {
    case 'UNCONFIRMED': return '미확인';
    case 'IN_PROGRESS': return '진행 중';
    case 'COMPLETED': return '완료';
    default: return status;
  }
};

const KPI_COLORS = {
  UNCONFIRMED: 'text-orange-500',
  IN_PROGRESS: 'text-blue-500',
  COMPLETED: 'text-green-500',
  TOTAL: 'text-gray-700',
};

const CHART_COLORS = {
  UNCONFIRMED: '#FFBB28', // Yellow/Orange
  IN_PROGRESS: '#0088FE', // Blue
  COMPLETED: '#00C49F',   // Green
  DIRECT_DELIVERY: '#8884d8', // Purple (example)
  COURIER_DELIVERY: '#82ca9d', // Greenish (example)
  STORE_QUANTITY: '#8884d8', // Default bar color
};


export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard'); // Ensure this API provides the new data structure
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`API 요청 실패: ${errorData.error || response.statusText}`);
      }
      const data = await response.json();
      // Basic validation of received data structure (optional but recommended)
      if (typeof data === 'object' && data !== null && 
          Array.isArray(data.unconfirmedByStore) && 
          Array.isArray(data.inProgressByStore)) {
        setDashboardData(data);
      } else {
        console.error("API로부터 받은 데이터 형식이 올바르지 않습니다.", data);
        throw new Error("API로부터 받은 데이터 형식이 올바르지 않습니다.");
      }
    } catch (err: any) {
      console.error("대시보드 데이터 로드 실패:", err);
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
      setDashboardData(null); // Ensure dashboardData is null on error
    } finally {
      setIsLoading(false);
    }
  };

  const storesWithMostPendingItems = useMemo(() => {
    // Ensure dashboardData and its necessary properties are available and are arrays
    if (!dashboardData || 
        !Array.isArray(dashboardData.unconfirmedByStore) || 
        !Array.isArray(dashboardData.inProgressByStore)) {
      return [];
    }

    const pendingCounts: { storeName: string; pendingCount: number }[] = [];

    dashboardData.unconfirmedByStore.forEach(ucs => {
      const existing = pendingCounts.find(pc => pc.storeName === ucs.storeName);
      if (existing) {
        existing.pendingCount += ucs.count;
      } else {
        pendingCounts.push({ storeName: ucs.storeName, pendingCount: ucs.count });
      }
    });

    dashboardData.inProgressByStore.forEach(ips => {
      const existing = pendingCounts.find(pc => pc.storeName === ips.storeName);
      if (existing) {
        existing.pendingCount += ips.count;
      } else {
        pendingCounts.push({ storeName: ips.storeName, pendingCount: ips.count });
      }
    });
    
    if (pendingCounts.length === 0) return [];

    pendingCounts.sort((a, b) => b.pendingCount - a.pendingCount);
    
    // Check if there are any items after sorting to prevent accessing pendingCounts[0] on an empty array
    if (pendingCounts.length === 0) return [];
    const maxPending = pendingCounts[0].pendingCount;
    
    // Ensure maxPending is a positive number before filtering
    if (maxPending <= 0) return [];

    return pendingCounts.filter(store => store.pendingCount === maxPending);

  }, [dashboardData]);


  if (isLoading) {
    return <div className="container mx-auto p-6 text-center">대시보드 데이터를 불러오는 중입니다...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-6 text-center text-red-500">오류: {error} <button onClick={fetchDashboardData} className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">재시도</button></div>;
  }

  if (!dashboardData) {
    return <div className="container mx-auto p-6 text-center">대시보드 데이터를 표시할 수 없습니다. API 응답을 확인해주세요.</div>;
  }

  const { 
    storeData, 
    deliveryData, 
    progressStatusCounts, 
    unconfirmedByStore, 
    inProgressByStore,
    overallStats 
  } = dashboardData;

  // Prepare data for Progress Status Pie Chart
  const pieChartProgressData = progressStatusCounts.map(item => ({
    name: item.name, // Already translated by API or use translateProgressStatus(item.status)
    value: item.count,
    fill: CHART_COLORS[item.status as ProgressStatusType] || '#CCCCCC' // Fallback color
  }));
  
  // Prepare data for Delivery Method Pie Chart
   const pieChartDeliveryData = deliveryData.map(item => ({
    name: item.name,
    value: item.count,
    // Assign specific colors if desired, or use a COLORS array
    fill: item.name === '직접배송' ? CHART_COLORS.DIRECT_DELIVERY : CHART_COLORS.COURIER_DELIVERY
  }));


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">종합 대시보드</h1>
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 비품 수</CardTitle>
            <PackageSearch className={`h-5 w-5 ${KPI_COLORS.TOTAL}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${KPI_COLORS.TOTAL}`}>{overallStats?.totalItems ?? 0}개</div>
            <p className="text-xs text-gray-500 pt-1">시스템에 등록된 전체 비품</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">미확인</CardTitle>
            <AlertTriangle className={`h-5 w-5 ${KPI_COLORS.UNCONFIRMED}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${KPI_COLORS.UNCONFIRMED}`}>{overallStats?.totalUnconfirmed ?? 0}개</div>
            <p className="text-xs text-gray-500 pt-1">확인/처리 대기 중인 비품</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">진행 중</CardTitle>
            <Clock className={`h-5 w-5 ${KPI_COLORS.IN_PROGRESS}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${KPI_COLORS.IN_PROGRESS}`}>{overallStats?.totalInProgress ?? 0}개</div>
            <p className="text-xs text-gray-500 pt-1">현재 처리/배송 진행 중인 비품</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">완료</CardTitle>
            <CheckCircle2 className={`h-5 w-5 ${KPI_COLORS.COMPLETED}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${KPI_COLORS.COMPLETED}`}>{overallStats?.totalCompleted ?? 0}개</div>
            <p className="text-xs text-gray-500 pt-1">처리가 완료된 비품</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">전체 진행 상태 분포</CardTitle>
            <CardDescription>모든 비품의 현재 상태별 비율</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieChartProgressData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                     label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieChartProgressData.map((entry, index) => (
                    <Cell key={`cell-progress-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}개`, name]}/>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">매장별 총 비품 수량</CardTitle>
            <CardDescription>각 매장이 보유하고 있는 전체 비품의 양</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={storeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="storeName" tick={{fontSize: 12}}/>
                <YAxis allowDecimals={false} tick={{fontSize: 12}}/>
                <Tooltip formatter={(value) => [`${value}개`, "총 수량"]}/>
                <Bar dataKey="totalQuantity" fill={CHART_COLORS.STORE_QUANTITY} radius={[4, 4, 0, 0]} barSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Status by Store */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">매장별 미확인 품목 수</CardTitle>
            <CardDescription>주의가 필요한 '미확인' 상태의 품목이 많은 매장</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={unconfirmedByStore} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="storeName" tick={{fontSize: 12}}/>
                <YAxis allowDecimals={false} tick={{fontSize: 12}}/>
                <Tooltip formatter={(value) => [`${value}개`, "미확인 수량"]}/>
                <Bar dataKey="count" fill={CHART_COLORS.UNCONFIRMED} radius={[4, 4, 0, 0]} barSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">매장별 진행 중 품목 수</CardTitle>
            <CardDescription>현재 활발하게 처리 중인 품목이 많은 매장</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={inProgressByStore} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="storeName" tick={{fontSize: 12}}/>
                <YAxis allowDecimals={false} tick={{fontSize: 12}}/>
                <Tooltip formatter={(value) => [`${value}개`, "진행 중 수량"]}/>
                <Bar dataKey="count" fill={CHART_COLORS.IN_PROGRESS} radius={[4, 4, 0, 0]} barSize={40}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row 3: Delivery and Top Pending Store */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">배송 방식별 분포</CardTitle>
            <CardDescription>비품이 배송되는 주요 방식의 비율</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieChartDeliveryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                     label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieChartDeliveryData.map((entry, index) => (
                    <Cell key={`cell-delivery-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}건`, name]}/>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">최다 대기 품목 보유 매장</CardTitle>
            <CardDescription>'미확인' 및 '진행 중' 상태의 품목이 가장 많은 매장</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[300px]">
            {storesWithMostPendingItems.length > 0 ? (
                storesWithMostPendingItems.map(store => (
                    <div key={store.storeName} className="text-center p-4">
                        <Store className="h-12 w-12 text-red-500 mx-auto mb-2" />
                        <p className="text-xl font-bold text-red-600">{store.storeName}</p>
                        <p className="text-2xl font-semibold text-gray-700">{store.pendingCount}개 대기 중</p>
                        <p className="text-sm text-gray-500">(미확인 + 진행 중)</p>
                    </div>
                ))
            ) : (
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-lg text-gray-600">모든 매장의 대기 품목이 없거나<br/>데이터를 분석 중입니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
