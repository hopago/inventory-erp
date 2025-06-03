"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  CheckCircle as IconCheckCircle,
  Calendar,
  User,
  PackageOpen,
  Undo,
  Edit3,
  XSquare,
  Clock,
} from "lucide-react"; // All icons seem to be used.
import { Toaster, toast } from "sonner";

//#region Types
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
  deadline: string | null;
}

// This interface defines the expected structure of the API response for fetching todos.
interface FetchTodosApiResponse {
  data: Todo[];
  success: boolean; // Assuming your API always includes this
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Data structure for creating or updating a Todo.
interface UpsertTodoData {
  // Renamed from CreateTodoData for clarity as it's used for update too
  text: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  completed?: boolean;
  userId?: number | null;
  deadline?: string | null;
}

// Type for the priority configuration object to ensure strong typing.
type PriorityKey = "HIGH" | "MEDIUM" | "LOW";

interface PriorityConfigValue {
  label: string;
  badgeVariant:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | null
    | undefined; // More specific badge variant type
  className: string;
}

const priorityConfig: Record<PriorityKey, PriorityConfigValue> = {
  HIGH: {
    label: "높음",
    badgeVariant: "destructive",
    className: "dark:border-red-700/80 dark:bg-red-900/60 dark:text-red-300",
  },
  MEDIUM: {
    label: "보통",
    badgeVariant: "default",
    className:
      "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/40 dark:hover:bg-sky-500/30",
  },
  LOW: {
    label: "낮음",
    badgeVariant: "default", // Assuming 'default' is a valid variant for Badge
    className:
      "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-500/50 dark:hover:bg-slate-700/60",
  },
} as const; // Using 'as const' for stricter typing of priorityConfig

// Constant for items per page, defined outside the component if it's truly static.
const ITEMS_PER_PAGE = 10;
//#endregion

const TodoPage: React.FC = () => {
  //#region State & Consts
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>(""); // Used for displaying error messages in a card

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  // limit is now ITEMS_PER_PAGE constant

  const [filters, setFilters] = useState({
    completed: "all", // Could be 'all' | 'true' | 'false'
    priority: "all", // Could be 'all' | PriorityKey
    search: "",
    userId: "all", // This filter is not currently active via UI elements
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const initialFormData: UpsertTodoData = {
    text: "",
    priority: "MEDIUM",
    completed: false,
    userId: null,
    deadline: null,
  };
  const [formData, setFormData] = useState<UpsertTodoData>(initialFormData);

  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<string>>(
    new Set()
  );
  const [isBatchPriorityDialogOpen, setIsBatchPriorityDialogOpen] =
    useState<boolean>(false);
  const [batchPriorityToSet, setBatchPriorityToSet] =
    useState<PriorityKey>("MEDIUM");
  //#endregion

  //#region API helpers
  const fetchTodos = useCallback(
    async (showToast = false) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        });
        if (filters.completed !== "all") {
          params.append("completed", filters.completed);
        }
        if (filters.priority !== "all") {
          params.append("priority", filters.priority);
        }
        if (filters.search.trim()) {
          params.append("search", filters.search.trim());
        }
        // The userId filter is prepared here, but no UI element currently sets it to a numeric ID.
        // If a user filter UI is added, ensure `filters.userId` can hold a numeric string.
        if (filters.userId !== "all") {
          params.append("userId", filters.userId);
        }

        const response = await fetch(`/api/todos?${params.toString()}`); // Ensure params are stringified
        if (!response.ok) {
          // Attempt to parse error from backend if possible
          let errorMessage = "Todo 목록을 불러오는데 실패했습니다.";
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (parseError) {
            // Ignore if response is not JSON or other parsing error
            console.error("Error parsing response:", parseError);
            // Fallback to generic error message
            errorMessage = "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
          }
          throw new Error(errorMessage);
        }
        const result: FetchTodosApiResponse = await response.json();

        if (result.success && result.data && result.meta) {
          setTodos(result.data);
          setTotalPages(result.meta.totalPages);
          setTotalCount(result.meta.totalCount);
          // Maintain selection for items that are still present in the new data
          setSelectedTodoIds((prevSelectedIds) => {
            const newSelectedIds = new Set<string>();
            const currentTodoIds = new Set(result.data.map((t) => t.id));
            prevSelectedIds.forEach((id) => {
              if (currentTodoIds.has(id)) {
                newSelectedIds.add(id);
              }
            });
            return newSelectedIds;
          });
        } else {
          // Handle cases where result.success is false or data/meta is missing, if applicable
          throw new Error("수신된 데이터 형식이 올바르지 않습니다.");
        }

        if (showToast) {
          toast.success("Todo 목록을 새로고침했습니다.");
        }
      } catch (err) {
        const typedError = err as Error;
        const msg = typedError.message || "알 수 없는 오류가 발생했습니다.";
        setError(msg); // Set error state for display in UI if needed
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, filters] // ITEMS_PER_PAGE is a constant, no need to include
  );

  const createTodo = async (todoData: UpsertTodoData) => {
    const payload: UpsertTodoData = {
      ...todoData,
      deadline: todoData.deadline || null, // Ensure empty string becomes null
    };
    const promise = fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const resJson = await res.json(); // Always try to parse JSON
      if (!res.ok) {
        throw new Error(resJson.error || "Todo 생성에 실패했습니다.");
      }
      return resJson; // Assuming backend returns the created Todo or a success message
    });

    toast.promise(promise, {
      loading: "새로운 Todo를 생성 중입니다...",
      success: () => {
        fetchTodos(); // Re-fetch todos to show the new one
        setIsCreateDialogOpen(false);
        resetForm();
        return "Todo가 성공적으로 생성되었습니다!";
      },
      error: (e: Error) => e.message, // Use Error type for error param
    });
  };

  const updateTodo = async (
    id: string,
    updateData: Partial<UpsertTodoData>, // Use Partial as not all fields are always updated
    successMessage?: string
  ) => {
    const payload: Partial<UpsertTodoData> = {
      ...updateData,
      deadline: updateData.deadline || null, // Ensure empty string becomes null
    };
    const promise = fetch(`/api/todos/${id}`, {
      // Corrected to use path parameter
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Todo 수정에 실패했습니다.");
      }
      return resJson;
    });

    toast.promise(promise, {
      loading: "Todo를 수정 중입니다...",
      success: () => {
        fetchTodos();
        if (isEditDialogOpen && editingTodo?.id === id) {
          setIsEditDialogOpen(false);
          setEditingTodo(null);
          resetForm();
        }
        return successMessage || "Todo가 성공적으로 수정되었습니다!";
      },
      error: (e: Error) => e.message,
    });
  };

  const deleteSingleTodo = async (id: string) => {
    toast("정말로 이 Todo를 삭제하시겠습니까?", {
      action: {
        label: "삭제",
        onClick: async () => {
          const promise = fetch(`/api/todos/${id}`, {
            // Corrected to use path parameter
            method: "DELETE",
          }).then(async (res) => {
            if (!res.ok) {
              const e = await res
                .json()
                .catch(() => ({ error: "알 수 없는 삭제 오류" }));
              throw new Error(e.error || "Todo 삭제 실패");
            }
            // DELETE might not return a body or a specific success message.
            // If it does, like { success: true, message: "..." }, parse it.
            // For now, res.ok is sufficient for success.
            return { success: true }; // Or parse JSON if backend sends meaningful delete response
          });
          toast.promise(promise, {
            loading: "Todo를 삭제 중입니다...",
            success: () => {
              fetchTodos();
              setSelectedTodoIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
              });
              return "Todo가 성공적으로 삭제되었습니다.";
            },
            error: (e: Error) => e.message,
          });
        },
      },
      cancel: {
        label: "취소",
        onClick: () => toast.info("삭제가 취소되었습니다."),
      },
      duration: 5000, // Give user time to react
    });
  };

  const toggleSingleTodoComplete = async (todoItem: Todo) => {
    // Renamed 'todo' to 'todoItem' to avoid conflict if any
    await updateTodo(
      todoItem.id,
      { completed: !todoItem.completed },
      `Todo "${todoItem.text.substring(0, 15)}..." 완료 상태 변경됨`
    );
  };
  //#endregion

  //#region Selection helpers
  const handleToggleSelectTodo = (id: string) => {
    setSelectedTodoIds((prevSelectedIds) => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return newSelectedIds;
    });
  };

  const handleSelectAllTodos = () => {
    if (todos.length === 0) return; // Prevent action if no todos
    setSelectedTodoIds((prevSelectedIds) => {
      if (prevSelectedIds.size === todos.length) {
        return new Set(); // Deselect all
      }
      return new Set(todos.map((t) => t.id)); // Select all
    });
  };
  //#endregion

  //#region Batch actions
  const performBatchUpdate = async (
    ids: string[],
    updatePayload: Partial<UpsertTodoData>,
    actionLoadingText: string,
    actionSuccessText: string,
    actionErrorContextText: string
  ) => {
    const promises = ids.map((id) =>
      fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      }).then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({
            error: `알 수 없는 ${actionErrorContextText} 오류`,
          }));
          throw new Error(e.error || `ID ${id} ${actionErrorContextText} 실패`);
        }
        return res.json(); // Assuming PUT returns updated todo
      })
    );

    toast.promise(Promise.all(promises), {
      loading: actionLoadingText,
      success: () => {
        fetchTodos();
        setSelectedTodoIds(new Set());
        return actionSuccessText;
      },
      error: (e: Error) => {
        fetchTodos(); // Re-fetch to reflect partial successes/failures
        return `일부 Todo ${actionErrorContextText} 중 오류 발생: ${e.message}`;
      },
    });
  };

  const handleBatchDelete = async () => {
    if (selectedTodoIds.size === 0) {
      toast.error("삭제할 항목을 선택해주세요.");
      return;
    }
    toast(`선택된 ${selectedTodoIds.size}개의 Todo를 정말 삭제하시겠습니까?`, {
      action: {
        label: "일괄 삭제",
        onClick: async () => {
          const ids = Array.from(selectedTodoIds);
          const promises = ids.map((id) =>
            fetch(`/api/todos/${id}`, { method: "DELETE" }).then(
              async (res) => {
                if (!res.ok) {
                  const e = await res
                    .json()
                    .catch(() => ({ error: "알 수 없는 삭제 오류" }));
                  throw new Error(e.error || `ID ${id} 삭제 실패`);
                }
                return id; // Return ID for counting successes
              }
            )
          );
          toast.promise(Promise.all(promises), {
            loading: `${ids.length}개 Todo 삭제 중...`,
            success: (results: string[]) => {
              fetchTodos();
              setSelectedTodoIds(new Set());
              return `${results.length}개 Todo가 성공적으로 삭제되었습니다.`;
            },
            error: (e: Error) => {
              fetchTodos();
              return `일부 Todo 삭제 중 오류 발생: ${e.message}`;
            },
          });
        },
      },
      cancel: {
        label: "취소",
        onClick: () => toast.info("일괄 삭제가 취소되었습니다."),
      },
      duration: 5000,
    });
  };

  const handleBatchUpdateCompletion = (completed: boolean) => {
    if (selectedTodoIds.size === 0) {
      toast.error("상태를 변경할 항목을 선택해주세요.");
      return;
    }
    const ids = Array.from(selectedTodoIds);
    const statusText = completed ? "완료" : "미완료";
    performBatchUpdate(
      ids,
      { completed },
      `${ids.length}개 Todo ${statusText} 처리 중...`,
      `${ids.length}개 Todo가 ${statusText} 처리되었습니다.`,
      statusText
    );
  };

  const handleOpenBatchPriorityDialog = () => {
    if (selectedTodoIds.size === 0) {
      toast.error("우선순위를 변경할 항목을 선택해주세요.");
      return;
    }
    setIsBatchPriorityDialogOpen(true);
  };

  const handleBatchUpdatePriority = () => {
    if (selectedTodoIds.size === 0) return; // Should be caught by handleOpenBatchPriorityDialog
    const ids = Array.from(selectedTodoIds);
    performBatchUpdate(
      ids,
      { priority: batchPriorityToSet },
      `${ids.length}개 Todo 우선순위 변경 중...`,
      `${ids.length}개 Todo의 우선순위가 '${priorityConfig[batchPriorityToSet].label}'(으)로 변경되었습니다.`,
      "우선순위 변경"
    );
    setIsBatchPriorityDialogOpen(false); // Close dialog after initiating
  };
  //#endregion

  //#region Form utils
  const resetForm = useCallback(
    () => setFormData(initialFormData),
    [initialFormData] // Ensure initialFormData is stable
  ); // Memoize resetForm

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.text.trim()) {
      toast.error("할 일을 입력해주세요.");
      return;
    }
    createTodo(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo) return;
    if (!formData.text.trim()) {
      toast.error("할 일을 입력해주세요.");
      return;
    }
    updateTodo(editingTodo.id, formData);
  };

  const openEditDialog = (todoToEdit: Todo) => {
    // Renamed 'todo' to 'todoToEdit'
    setEditingTodo(todoToEdit);
    setFormData({
      text: todoToEdit.text,
      priority: todoToEdit.priority,
      completed: todoToEdit.completed,
      userId: todoToEdit.userId,
      deadline: todoToEdit.deadline
        ? todoToEdit.deadline.substring(0, 16)
        : null,
    });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = (
    key: keyof typeof filters, // Stronger type for key
    value: string
  ) => {
    setFilters((prevFilters) => ({ ...prevFilters, [key]: value }));
    setCurrentPage(1); // Reset to page 1 when filters change
  };

  const clearFilters = () => {
    setFilters({
      completed: "all",
      priority: "all",
      search: "",
      userId: "all",
    });
    setCurrentPage(1);
    toast.info("필터가 초기화되었습니다.");
  };
  //#endregion

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]); // fetchTodos is correctly memoized with its dependencies

  const isAllTodosSelected =
    todos.length > 0 && selectedTodoIds.size === todos.length;

  //#region Render
  // JSX remains largely the same as it was focused on UI structure.
  // Minor adjustments for dark mode consistency and accessibility if any were pending.
  // The provided JSX seems quite complete and well-structured.
  // Ensuring all handlers like onClick={clearFilters} are defined and used.
  // All imported icons are used.
  // `error` state is used to display an error card.
  // `loading` state is used for loader display.
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen dark:bg-slate-950">
      <Toaster position="top-center" richColors closeButton />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ListChecks className="h-7 w-7 sm:h-8 sm:w-8 text-slate-700 dark:text-slate-300" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Todo 관리
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchTodos(true)}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 dark:disabled:opacity-50"
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1.5 sm:mr-2 ${
                loading ? "animate-spin" : ""
              }`}
            />
            새로고침
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className="bg-slate-700 hover:bg-slate-600 text-white dark:bg-sky-600 dark:hover:bg-sky-500 dark:text-slate-50"
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-1.5 sm:mr-2" />새 Todo 추가
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <PackageOpen className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  전체 Todo
                </p>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                  {totalCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <IconCheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  완료됨
                </p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-500">
                  {todos.filter((t) => t.completed).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-500" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  높은 우선순위
                </p>
                <p className="text-2xl font-semibold text-rose-600 dark:text-rose-500">
                  {todos.filter((t) => t.priority === "HIGH").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-sky-600 dark:text-sky-500" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  오늘 생성
                </p>
                <p className="text-2xl font-semibold text-sky-600 dark:text-sky-500">
                  {
                    todos.filter(
                      (t) =>
                        new Date(t.createdAt).toDateString() ===
                        new Date().toDateString()
                    ).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-lg">
            <Filter className="h-5 w-5" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
            <div>
              <label
                htmlFor="todoSearchInput"
                className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              >
                내용 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  id="todoSearchInput"
                  placeholder="Todo 검색..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10 border-slate-300 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:focus:border-sky-500 dark:placeholder-slate-400"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="completedFilterSelect"
                className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              >
                완료 상태
              </label>
              <Select
                value={filters.completed}
                onValueChange={(v) =>
                  handleFilterChange("completed", v as string)
                }
              >
                <SelectTrigger
                  id="completedFilterSelect"
                  className="border-slate-300 text-slate-700 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:focus:border-sky-500"
                >
                  <SelectValue placeholder="완료 상태" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:text-slate-200">
                  <SelectItem value="all" className="dark:focus:bg-slate-700">
                    전체
                  </SelectItem>
                  <SelectItem value="true" className="dark:focus:bg-slate-700">
                    완료됨
                  </SelectItem>
                  <SelectItem value="false" className="dark:focus:bg-slate-700">
                    미완료
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="priorityFilterSelect"
                className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
              >
                우선 순위
              </label>
              <Select
                value={filters.priority}
                onValueChange={(v) =>
                  handleFilterChange("priority", v as string)
                }
              >
                <SelectTrigger
                  id="priorityFilterSelect"
                  className="border-slate-300 text-slate-700 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:focus:border-sky-500"
                >
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:text-slate-200">
                  <SelectItem value="all" className="dark:focus:bg-slate-700">
                    전체
                  </SelectItem>
                  <SelectItem value="HIGH" className="dark:focus:bg-slate-700">
                    높음
                  </SelectItem>
                  <SelectItem
                    value="MEDIUM"
                    className="dark:focus:bg-slate-700"
                  >
                    보통
                  </SelectItem>
                  <SelectItem value="LOW" className="dark:focus:bg-slate-700">
                    낮음
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="self-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                필터 초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-rose-300 bg-rose-50 dark:bg-rose-900/30 dark:border-rose-500/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Todo List Table/Card - Enhanced Style */}
      <Card className="bg-gradient-to-br from-white to-slate-50/80 shadow-lg shadow-slate-200/50 border-0 ring-1 ring-slate-200/60 backdrop-blur-sm dark:from-slate-900 dark:to-slate-900/95 dark:shadow-slate-900/50 dark:ring-slate-700/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-800/30">
          <CardTitle className="text-slate-800 text-xl font-semibold tracking-tight dark:text-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-slate-600 to-slate-400 rounded-full dark:from-slate-400 dark:to-slate-600"></div>
              Todo 목록
            </div>
          </CardTitle>
          <div className="flex items-center space-x-3 bg-white/80 dark:bg-slate-800/80 rounded-lg px-3 py-2 ring-1 ring-slate-200/60 dark:ring-slate-600/60">
            <Checkbox
              id="select-all-todos"
              checked={isAllTodosSelected}
              onCheckedChange={handleSelectAllTodos}
              disabled={todos.length === 0 || loading}
              aria-label="모든 항목 선택"
              className="border-slate-400 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-slate-700 data-[state=checked]:to-slate-600 data-[state=checked]:text-white shadow-sm dark:border-slate-500 dark:data-[state=checked]:from-slate-300 dark:data-[state=checked]:to-slate-400 dark:data-[state=checked]:text-slate-900"
            />
            <label
              htmlFor="select-all-todos"
              className="text-sm font-medium text-slate-700 cursor-pointer select-none dark:text-slate-300"
            >
              {isAllTodosSelected ? "전체 해제" : "전체 선택"}
              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                ({selectedTodoIds.size}/{todos.length})
              </span>
            </label>
          </div>
        </CardHeader>

        {selectedTodoIds.size > 0 && (
          <div className="p-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-100/60 via-slate-50/80 to-slate-100/60 backdrop-blur-sm dark:bg-gradient-to-r dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 dark:border-slate-700/80">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-700/90 rounded-lg px-3 py-1.5 ring-1 ring-slate-200/60 dark:ring-slate-600/60">
                <div className="w-2 h-2 bg-gradient-to-br from-slate-600 to-slate-400 rounded-full dark:from-slate-400 dark:to-slate-600"></div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedTodoIds.size}개 선택됨
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTodoIds(new Set())}
                className="bg-white/90 border-slate-300/80 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm transition-all duration-200 dark:bg-slate-700/90 dark:text-slate-200 dark:border-slate-600/80 dark:hover:bg-slate-600"
              >
                <XSquare className="h-3.5 w-3.5 mr-1.5" />
                선택 해제
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchUpdateCompletion(true)}
                className="bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-800 border-emerald-300/80 hover:from-emerald-100 hover:to-emerald-200/80 hover:border-emerald-400 hover:shadow-sm transition-all duration-200 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:text-emerald-300 dark:border-emerald-600/60 dark:hover:from-emerald-800/40 dark:hover:to-emerald-700/40"
              >
                <IconCheckCircle className="h-3.5 w-3.5 mr-1.5" />
                완료 처리
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchUpdateCompletion(false)}
                className="bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-800 border-amber-300/80 hover:from-amber-100 hover:to-amber-200/80 hover:border-amber-400 hover:shadow-sm transition-all duration-200 dark:from-amber-900/30 dark:to-amber-800/30 dark:text-amber-300 dark:border-amber-600/60 dark:hover:from-amber-800/40 dark:hover:to-amber-700/40"
              >
                <Undo className="h-3.5 w-3.5 mr-1.5" />
                미완료 처리
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenBatchPriorityDialog}
                className="bg-white/90 border-slate-300/80 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm transition-all duration-200 dark:bg-slate-700/90 dark:text-slate-200 dark:border-slate-600/80 dark:hover:bg-slate-600"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                우선순위 변경
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-sm hover:shadow-md transition-all duration-200"
                onClick={handleBatchDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                선택 삭제
              </Button>
            </div>
          </div>
        )}

        <CardContent
          className={`${
            selectedTodoIds.size > 0 ? "pt-0" : "pt-2"
          } bg-gradient-to-b from-transparent to-slate-50/30 dark:to-slate-900/30`}
        >
          {loading ? (
            <div className="flex flex-col justify-center items-center py-16 text-slate-500 dark:text-slate-400">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-slate-400 dark:text-slate-500" />
                <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-slate-400/20 dark:bg-slate-500/20"></div>
              </div>
              <span className="mt-4 text-lg font-medium">로딩 중...</span>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <div className="relative inline-block mb-6">
                <PackageOpen className="h-20 w-20 text-slate-300 dark:text-slate-600" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full opacity-20"></div>
              </div>
              <p className="text-xl font-medium text-slate-600 dark:text-slate-300 mb-2">
                표시할 Todo가 없습니다
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                새로운 Todo를 추가해보세요!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {todos.map((todoItem: Todo) => {
                // Calculate remaining time for deadline with improved color system
                let remainingText: string = "마감기한 없음";
                let remainingColor: string =
                  "text-slate-500 dark:text-slate-400";
                let remainingBgColor: string =
                  "bg-slate-100/60 dark:bg-slate-800/40";
                let deadlineStatus:
                  | "none"
                  | "expired"
                  | "urgent"
                  | "warning"
                  | "safe" = "none";

                if (todoItem.deadline) {
                  const now = new Date();
                  const deadlineDate = new Date(todoItem.deadline);
                  const diffMs = deadlineDate.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                  if (diffMs < 0) {
                    remainingText = `${Math.abs(diffDays)}일 경과`;
                    remainingColor = "text-red-700 dark:text-red-400";
                    remainingBgColor =
                      "bg-gradient-to-r from-red-50 to-red-100/80 dark:from-red-900/20 dark:to-red-800/30";
                    deadlineStatus = "expired";
                  } else if (diffDays === 0) {
                    remainingText = "오늘 마감";
                    remainingColor = "text-orange-700 dark:text-orange-400";
                    remainingBgColor =
                      "bg-gradient-to-r from-orange-50 to-orange-100/80 dark:from-orange-900/20 dark:to-orange-800/30";
                    deadlineStatus = "urgent";
                  } else if (diffDays <= 3) {
                    remainingText = `${diffDays}일 남음`;
                    remainingColor = "text-amber-700 dark:text-amber-400";
                    remainingBgColor =
                      "bg-gradient-to-r from-amber-50 to-amber-100/80 dark:from-amber-900/20 dark:to-amber-800/30";
                    deadlineStatus = "warning";
                  } else {
                    remainingText = `${diffDays}일 남음`;
                    remainingColor = "text-emerald-700 dark:text-emerald-400";
                    remainingBgColor =
                      "bg-gradient-to-r from-emerald-50 to-emerald-100/80 dark:from-emerald-900/20 dark:to-emerald-800/30";
                    deadlineStatus = "safe";
                  }
                }

                // Format deadline for display
                const formatDeadlineForDisplay = (deadline: string): string => {
                  const date = new Date(deadline);
                  return date.toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    weekday: "short",
                  });
                };

                return (
                  <div
                    key={todoItem.id}
                    className={`group transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-white hover:shadow-sm dark:hover:from-slate-800/50 dark:hover:to-slate-800/30 ${
                      selectedTodoIds.has(todoItem.id)
                        ? "bg-gradient-to-r from-slate-100/90 to-slate-50/90 shadow-inner dark:from-slate-800/90 dark:to-slate-800/60"
                        : todoItem.completed
                        ? "bg-gradient-to-r from-slate-50/60 to-white/80 opacity-70 dark:from-slate-900/50 dark:to-slate-900/70"
                        : "bg-gradient-to-r from-white to-slate-50/30 dark:from-slate-900 dark:to-slate-900/80"
                    }`}
                  >
                    <div className="flex items-start p-5 gap-4">
                      <Checkbox
                        id={`select-todo-${todoItem.id}`}
                        checked={selectedTodoIds.has(todoItem.id)}
                        onCheckedChange={() =>
                          handleToggleSelectTodo(todoItem.id)
                        }
                        aria-labelledby={`todo-text-${todoItem.id}`}
                        className="border-slate-400 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-slate-700 data-[state=checked]:to-slate-600 data-[state=checked]:text-white shrink-0 shadow-sm dark:border-slate-500 dark:data-[state=checked]:from-slate-300 dark:data-[state=checked]:to-slate-400 dark:data-[state=checked]:text-slate-900 mt-1"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleSingleTodoComplete(todoItem)}
                        className={`h-8 w-8 rounded-full shrink-0 mt-0.5 transition-all duration-200 ${
                          todoItem.completed
                            ? "text-emerald-600 hover:bg-gradient-to-br hover:from-emerald-100 hover:to-emerald-50 hover:shadow-sm dark:text-emerald-400 dark:hover:from-emerald-500/20 dark:hover:to-emerald-600/10"
                            : "text-slate-400 hover:bg-gradient-to-br hover:from-slate-100 hover:to-slate-50 hover:text-slate-600 hover:shadow-sm dark:text-slate-500 dark:hover:from-slate-700 dark:hover:to-slate-600 dark:hover:text-slate-300"
                        }`}
                        aria-label={
                          todoItem.completed ? "미완료로 변경" : "완료로 변경"
                        }
                      >
                        {todoItem.completed ? (
                          <IconCheckCircle className="h-5 w-5" />
                        ) : (
                          <div className="h-5 w-5 border-2 border-current rounded-full group-hover:border-slate-500 transition-colors"></div>
                        )}
                      </Button>

                      <div className="flex-1 min-w-0">
                        <p
                          id={`todo-text-${todoItem.id}`}
                          className={`text-sm font-medium break-all mb-4 leading-relaxed ${
                            selectedTodoIds.has(todoItem.id)
                              ? "text-slate-900 dark:text-slate-100"
                              : todoItem.completed
                              ? "line-through text-slate-500 dark:text-slate-400/70"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {todoItem.text}
                        </p>

                        {/* Priority Badge */}
                        <div className="flex items-center gap-3 mb-4">
                          <Badge
                            variant={
                              priorityConfig[todoItem.priority].badgeVariant
                            }
                            className={`text-xs px-3 py-1.5 border font-semibold shadow-sm ${
                              priorityConfig[todoItem.priority].className
                            }`}
                          >
                            {priorityConfig[todoItem.priority].label}
                          </Badge>
                          {todoItem.user && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-700/60 rounded-md px-2 py-1 ring-1 ring-slate-200/60 dark:ring-slate-600/60">
                              <User className="h-3 w-3" />
                              <span className="font-medium">
                                {todoItem.user.username}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Date Information Section */}
                        <div className="space-y-3">
                          {/* Deadline Information - Most Prominent */}
                          {todoItem.deadline ? (
                            <div
                              className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm ${remainingBgColor} ${
                                deadlineStatus === "expired"
                                  ? "border-red-200/80 shadow-red-100/50 dark:border-red-800/60 dark:shadow-red-900/20"
                                  : deadlineStatus === "urgent"
                                  ? "border-orange-200/80 shadow-orange-100/50 dark:border-orange-800/60 dark:shadow-orange-900/20"
                                  : deadlineStatus === "warning"
                                  ? "border-amber-200/80 shadow-amber-100/50 dark:border-amber-800/60 dark:shadow-amber-900/20"
                                  : "border-emerald-200/80 shadow-emerald-100/50 dark:border-emerald-800/60 dark:shadow-emerald-900/20"
                              }`}
                            >
                              <Clock className={`h-4 w-4 ${remainingColor}`} />
                              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                <span
                                  className={`text-sm font-semibold ${remainingColor}`}
                                >
                                  {formatDeadlineForDisplay(todoItem.deadline)}
                                </span>
                                <span
                                  className={`text-xs ${remainingColor} font-medium opacity-90`}
                                >
                                  ({remainingText})
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-100/60 to-slate-50/80 border border-slate-200/60 shadow-sm dark:from-slate-800/40 dark:to-slate-800/60 dark:border-slate-700/60">
                              <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                마감기한 없음
                              </span>
                            </div>
                          )}

                          {/* Creation Date - Subtle */}
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 rounded-lg px-3 py-1.5 w-fit">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">
                              등록:{" "}
                              {new Date(todoItem.createdAt).toLocaleDateString(
                                "ko-KR",
                                {
                                  year: "2-digit",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditDialog(todoItem)}
                          className="h-9 w-9 border-slate-300/80 text-slate-600 hover:bg-gradient-to-br hover:from-slate-100 hover:to-slate-50 hover:text-slate-800 hover:border-slate-400 hover:shadow-sm transition-all duration-200 dark:border-slate-600/80 dark:text-slate-300 dark:hover:from-slate-700 dark:hover:to-slate-600 dark:hover:text-slate-100"
                          aria-label="수정"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteSingleTodo(todoItem.id)}
                          className="h-9 w-9 border-rose-300/80 text-rose-600 hover:bg-gradient-to-br hover:from-rose-50 hover:to-rose-100/80 hover:text-rose-700 hover:border-rose-400 hover:shadow-sm transition-all duration-200 dark:border-rose-500/70 dark:text-rose-400 dark:hover:from-rose-500/20 dark:hover:to-rose-600/10 dark:hover:text-rose-300"
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          <span className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Dialogs (structure already provided, ensure consistency) */}
      {/* Create Todo Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(isOpen) => {
          setIsCreateDialogOpen(isOpen);
          if (!isOpen) resetForm();
        }}
      >
        <DialogContent className="bg-white dark:bg-slate-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-800 dark:text-slate-200">
              새 Todo 추가
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {/* Text Input */}
            <div>
              <label
                htmlFor="create-text"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                할 일
              </label>
              <Input
                id="create-text"
                value={formData.text}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="할 일을 입력하세요..."
                maxLength={200}
                required
                className="border-slate-300 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:focus:border-sky-500"
              />
            </div>
            {/* Priority Select */}
            <div>
              <label
                htmlFor="create-priority"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                우선순위
              </label>
              <Select
                value={formData.priority}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: v as PriorityKey,
                  }))
                }
              >
                <SelectTrigger
                  id="create-priority"
                  className="border-slate-300 text-slate-700 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:focus:border-sky-500"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:text-slate-200">
                  {(Object.keys(priorityConfig) as PriorityKey[]).map((key) => (
                    <SelectItem
                      key={key}
                      value={key}
                      className="dark:focus:bg-slate-700"
                    >
                      {priorityConfig[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Deadline Input */}
            <div>
              <label
                htmlFor="create-deadline"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                마감 기한 (선택)
              </label>
              <Input
                id="create-deadline"
                type="datetime-local"
                value={formData.deadline || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deadline: e.target.value || null,
                  }))
                }
                className="border-slate-300 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:focus:border-sky-500"
              />
            </div>
            {/* Completed Checkbox */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="create-completed"
                checked={!!formData.completed}
                onCheckedChange={(c) =>
                  setFormData((prev) => ({ ...prev, completed: !!c }))
                }
                className="border-slate-400 data-[state=checked]:bg-slate-700 data-[state=checked]:text-white dark:border-slate-500 dark:data-[state=checked]:bg-slate-300 dark:data-[state=checked]:text-slate-900"
              />
              <label
                htmlFor="create-completed"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                완료된 상태로 생성
              </label>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-slate-700 hover:bg-slate-600 text-white dark:bg-sky-600 dark:hover:bg-sky-700 dark:text-white"
              >
                추가
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Todo Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(isOpen) => {
          setIsEditDialogOpen(isOpen);
          if (!isOpen) {
            setEditingTodo(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="bg-white dark:bg-slate-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-800 dark:text-slate-200">
              Todo 수정
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {/* Text Input */}
            <div>
              <label
                htmlFor="edit-text"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                할 일
              </label>
              <Input
                id="edit-text"
                value={formData.text}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="할 일을 입력하세요..."
                maxLength={200}
                required
                className="border-slate-300 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:focus:border-sky-500"
              />
            </div>
            {/* Priority Select */}
            <div>
              <label
                htmlFor="edit-priority"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                우선순위
              </label>
              <Select
                value={formData.priority}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: v as PriorityKey,
                  }))
                }
              >
                <SelectTrigger
                  id="edit-priority"
                  className="border-slate-300 text-slate-700 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:focus:border-sky-500"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:text-slate-200">
                  {(Object.keys(priorityConfig) as PriorityKey[]).map((key) => (
                    <SelectItem
                      key={key}
                      value={key}
                      className="dark:focus:bg-slate-700"
                    >
                      {priorityConfig[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Deadline Input */}
            <div>
              <label
                htmlFor="edit-deadline"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
              >
                마감 기한 (선택)
              </label>
              <Input
                id="edit-deadline"
                type="datetime-local"
                value={formData.deadline || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deadline: e.target.value || null,
                  }))
                }
                className="border-slate-300 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:focus:border-sky-500"
              />
            </div>
            {/* Completed Checkbox */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="edit-completed"
                checked={!!formData.completed}
                onCheckedChange={(c) =>
                  setFormData((prev) => ({ ...prev, completed: !!c }))
                }
                className="border-slate-400 data-[state=checked]:bg-slate-700 data-[state=checked]:text-white dark:border-slate-500 dark:data-[state=checked]:bg-slate-300 dark:data-[state=checked]:text-slate-900"
              />
              <label
                htmlFor="edit-completed"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                완료 상태
              </label>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingTodo(null);
                  resetForm();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-slate-700 hover:bg-slate-600 text-white dark:bg-sky-600 dark:hover:bg-sky-700 dark:text-white"
              >
                수정
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Batch Priority Dialog */}
      <Dialog
        open={isBatchPriorityDialogOpen}
        onOpenChange={setIsBatchPriorityDialogOpen}
      >
        <DialogContent className="bg-white sm:max-w-md dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-800 dark:text-slate-200">
              선택된 Todo 우선순위 변경
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              선택된 {selectedTodoIds.size}개 항목의 우선순위를 일괄 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label
              htmlFor="batch-priority-select"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5"
            >
              새 우선순위
            </label>
            <Select
              value={batchPriorityToSet}
              onValueChange={(v) => setBatchPriorityToSet(v as PriorityKey)}
            >
              <SelectTrigger
                id="batch-priority-select"
                className="w-full border-slate-300 text-slate-700 focus:border-slate-500 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:focus:border-sky-500"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:text-slate-200">
                {(Object.keys(priorityConfig) as PriorityKey[]).map((key) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className="dark:focus:bg-slate-700"
                  >
                    {priorityConfig[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBatchPriorityDialogOpen(false)}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleBatchUpdatePriority}
              className="bg-slate-700 hover:bg-slate-600 text-white dark:bg-sky-600 dark:hover:bg-sky-700 dark:text-white"
            >
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
  //#endregion
};

export default TodoPage;
