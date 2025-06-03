"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Trash2,
  Filter,
  ListChecks,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  AlertCircle,
  CheckCircle,
  Calendar,
  User,
  PackageOpen,
} from "lucide-react";

// TypeScript 인터페이스 정의
interface TodoUser {
  id: number;
  username: string;
  role: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  user: TodoUser | null;
}

interface TodoResponse {
  data: Todo[];
  success: boolean;
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface CreateTodoData {
  text: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  completed?: boolean;
  userId?: number | null;
}

const TodoPage: React.FC = () => {
  // 상태 관리
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [limit] = useState<number>(10);

  // 필터링 상태 - 빈 문자열 대신 "all" 사용
  const [filters, setFilters] = useState({
    completed: "all",
    priority: "all",
    search: "",
    userId: "all",
  });

  // 다이얼로그 상태
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<CreateTodoData>({
    text: "",
    priority: "MEDIUM",
    completed: false,
    userId: null,
  });

  // 우선순위 색상 및 레이블 매핑
  const priorityConfig = {
    HIGH: {
      label: "높음",
      color: "bg-red-100 text-red-800",
      badgeVariant: "destructive" as const,
    },
    MEDIUM: {
      label: "보통",
      color: "bg-yellow-100 text-yellow-800",
      badgeVariant: "secondary" as const,
    },
    LOW: {
      label: "낮음",
      color: "bg-green-100 text-green-800",
      badgeVariant: "outline" as const,
    },
  };

  // API 호출 함수들
  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });

      // 필터 조건 추가 - "all"이 아닌 경우만 추가
      if (filters.completed !== "all") {
        params.append("completed", filters.completed);
      }
      if (filters.priority !== "all") {
        params.append("priority", filters.priority);
      }
      if (filters.search.trim()) {
        params.append("search", filters.search);
      }
      if (filters.userId !== "all") {
        params.append("userId", filters.userId);
      }

      const response = await fetch(`/api/todos?${params}`);

      if (!response.ok) {
        throw new Error("Todo 목록을 불러오는데 실패했습니다.");
      }

      const result: TodoResponse = await response.json();
      setTodos(result.data);
      setTotalPages(result.meta.totalPages);
      setTotalCount(result.meta.totalCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, filters]);

  const createTodo = async (todoData: CreateTodoData) => {
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(todoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Todo 생성에 실패했습니다.");
      }

      await fetchTodos();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Todo 생성 중 오류가 발생했습니다."
      );
    }
  };

  const updateTodo = async (
    id: string,
    updateData: Partial<CreateTodoData>
  ) => {
    try {
      const response = await fetch(`/api/todos?id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Todo 수정에 실패했습니다.");
      }

      await fetchTodos();
      setIsEditDialogOpen(false);
      setEditingTodo(null);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Todo 수정 중 오류가 발생했습니다."
      );
    }
  };

  const deleteTodo = async (id: string) => {
    if (!confirm("정말로 이 Todo를 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`/api/todos?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Todo 삭제에 실패했습니다.");
      }

      await fetchTodos();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Todo 삭제 중 오류가 발생했습니다."
      );
    }
  };

  const toggleTodoComplete = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed });
  };

  // 유틸리티 함수들
  const resetForm = () => {
    setFormData({
      text: "",
      priority: "MEDIUM",
      completed: false,
      userId: null,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.text.trim()) {
      createTodo(formData);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTodo && formData.text.trim()) {
      updateTodo(editingTodo.id, formData);
    }
  };

  const openEditDialog = (todo: Todo) => {
    setEditingTodo(todo);
    setFormData({
      text: todo.text,
      priority: todo.priority,
      completed: todo.completed,
      userId: todo.userId,
    });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  };

  const clearFilters = () => {
    setFilters({
      completed: "all",
      priority: "all",
      search: "",
      userId: "all",
    });
    setCurrentPage(1);
  };

  // Effect 훅
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // 렌더링
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Todo 관리</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchTodos()}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>

          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <PlusCircle className="h-4 w-4 mr-2" />새 Todo 추가
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">전체 Todo</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">완료됨</p>
                <p className="text-2xl font-bold text-green-600">
                  {todos.filter((todo) => todo.completed).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">높은 우선순위</p>
                <p className="text-2xl font-bold text-red-600">
                  {todos.filter((todo) => todo.priority === "HIGH").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">오늘 생성</p>
                <p className="text-2xl font-bold">
                  {
                    todos.filter(
                      (todo) =>
                        new Date(todo.createdAt).toDateString() ===
                        new Date().toDateString()
                    ).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Todo 검색..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.completed}
              onValueChange={(value) => handleFilterChange("completed", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="완료 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="true">완료됨</SelectItem>
                <SelectItem value="false">미완료</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.priority}
              onValueChange={(value) => handleFilterChange("priority", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="우선순위" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="HIGH">높음</SelectItem>
                <SelectItem value="MEDIUM">보통</SelectItem>
                <SelectItem value="LOW">낮음</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Todo 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>Todo 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">로딩 중...</span>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PackageOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>표시할 Todo가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                    todo.completed
                      ? "bg-gray-50 border-gray-200"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => toggleTodoComplete(todo)}
                        className="mt-1"
                      />

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            todo.completed
                              ? "line-through text-gray-500"
                              : "text-gray-900"
                          }`}
                        >
                          {todo.text}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={priorityConfig[todo.priority].badgeVariant}
                          >
                            {priorityConfig[todo.priority].label}
                          </Badge>

                          {todo.user && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              {todo.user.username}
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(todo.createdAt).toLocaleDateString(
                              "ko-KR"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(todo)}
                      >
                        수정
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTodo(todo.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          <span className="px-4 py-2 text-sm">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Todo 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 Todo 추가</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">할 일</label>
              <Input
                value={formData.text}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="할 일을 입력하세요..."
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                우선순위
              </label>
              <Select
                value={formData.priority}
                onValueChange={(value: "HIGH" | "MEDIUM" | "LOW") =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">높음</SelectItem>
                  <SelectItem value="MEDIUM">보통</SelectItem>
                  <SelectItem value="LOW">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="completed"
                checked={formData.completed}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, completed: !!checked }))
                }
              />
              <label
                htmlFor="completed"
                className="text-sm font-medium text-gray-700"
              >
                완료된 상태로 생성
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit">추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Todo 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Todo 수정</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">할 일</label>
              <Input
                value={formData.text}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="할 일을 입력하세요..."
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                우선순위
              </label>
              <Select
                value={formData.priority}
                onValueChange={(value: "HIGH" | "MEDIUM" | "LOW") =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">높음</SelectItem>
                  <SelectItem value="MEDIUM">보통</SelectItem>
                  <SelectItem value="LOW">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-completed"
                checked={formData.completed}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, completed: !!checked }))
                }
              />
              <label
                htmlFor="edit-completed"
                className="text-sm font-medium text-gray-700"
              >
                완료 상태
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit">수정</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodoPage;
