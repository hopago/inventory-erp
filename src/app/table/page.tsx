// app/table/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Plus,
  Edit,
  Trash2,
  Package,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  PlayCircle,
  SkipForward,
  Save,
  XCircle,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { GlobalErrorDisplay } from "../components/global-error-display";

// Define ProgressStatus type based on your Prisma schema (enum keys)
type ProgressStatus = "UNCONFIRMED" | "IN_PROGRESS" | "COMPLETED";

interface Item {
  id: number;
  storeName: string;
  itemName: string;
  quantity: number;
  specification: string;
  deliveryMethod: "DIRECT" | "COURIER";
  notes: string | null;
  progressStatus: ProgressStatus;
  createdAt: string; // Assuming ISO date string
  updatedAt: string; // Assuming ISO date string
}

// Helper to translate status keys to Korean
const translateProgressStatus = (status: ProgressStatus): string => {
  switch (status) {
    case "UNCONFIRMED":
      return "미확인";
    case "IN_PROGRESS":
      return "진행 중";
    case "COMPLETED":
      return "완료";
    default:
      return status;
  }
};

// Helper to get badge variant based on status
const getProgressStatusVariant = (
  status: ProgressStatus
): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "UNCONFIRMED":
      return "outline";
    case "IN_PROGRESS":
      return "default";
    case "COMPLETED":
      return "secondary";
    default:
      return "outline";
  }
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// --- Sub-Components (Interfaces remain the same, implementations might need minor adjustments if props change significantly) ---

interface TableToolbarProps {
  selectedItemIds: number[];
  onBatchDeleteClick: () => void;
  onBatchStatusChangeClick: () => void;
  onSequentialEditClick: () => void;
  uniqueStoreNames: string[]; // This will be populated from all items initially, or a dedicated API
  selectedStore: string;
  onStoreChange: (value: string) => void;
  onExportClick: () => void;
  onAddNewItemClick: () => void;
  currentItemsCount: number; // items on current page
  totalFilteredItemsCount: number; // total items matching server filter
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  selectedItemIds,
  onBatchDeleteClick,
  onBatchStatusChangeClick,
  onSequentialEditClick,
  uniqueStoreNames,
  selectedStore,
  onStoreChange,
  onExportClick,
  onAddNewItemClick,
  currentItemsCount,
  totalFilteredItemsCount,
}) => {
  return (
    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6 border-b">
      <div className="flex items-center space-x-3">
        <Package className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            비품 관리 시스템
          </h1>
          <Badge variant="secondary" className="mt-1">
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length}개 선택됨 / `
              : ""}
            {currentItemsCount}개 표시 (총 {totalFilteredItemsCount}개)
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {selectedItemIds.length > 0 && (
          <>
            <Button
              onClick={onBatchDeleteClick}
              variant="destructive"
              size="sm"
              className="h-9 text-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              선택 삭제 ({selectedItemIds.length})
            </Button>
            <Button
              onClick={onBatchStatusChangeClick}
              variant="outline"
              size="sm"
              className="h-9 text-sm border-purple-500 text-purple-500 hover:bg-purple-50"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              상태 변경 ({selectedItemIds.length})
            </Button>
            <Button
              onClick={onSequentialEditClick}
              variant="outline"
              size="sm"
              className="h-9 text-sm border-green-500 text-green-500 hover:bg-green-50"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              연속 수정 ({selectedItemIds.length})
            </Button>
          </>
        )}
        <Select
          value={selectedStore || "ALL_STORES"}
          onValueChange={(value) =>
            onStoreChange(value === "ALL_STORES" ? "" : value)
          }
        >
          <SelectTrigger className="w-full md:w-[180px] h-9 text-sm rounded-md bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500">
            <SelectValue placeholder="매장 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL_STORES">전체 매장</SelectItem>
            {uniqueStoreNames.map((store) => (
              <SelectItem key={store} value={store}>
                {store}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={onExportClick}
          variant="outline"
          className="h-9 text-sm border-gray-300 hover:bg-gray-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Excel (현재 페이지)
        </Button>
        <Button
          onClick={onAddNewItemClick}
          className="h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />새 비품 추가
        </Button>
      </div>
    </CardHeader>
  );
};

interface ItemsTableProps {
  itemsToDisplay: Item[]; // Paginated items from server
  selectedItemIds: number[];
  // sortConfig: { key: keyof Item | null; direction: "ascending" | "descending" }; // Removed: Handled by parent
  selectAllState: boolean | "indeterminate";
  onSelectAll: (checked: boolean | "indeterminate") => void;
  onSelectItem: (itemId: number, checked: boolean | "indeterminate") => void;
  onRequestSort: (key: keyof Item) => void;
  getSortIcon: (columnKey: keyof Item) => JSX.Element;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  isLoading: boolean;
  totalDbItems: number;
  selectedStore: string;
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  itemsToDisplay,
  selectedItemIds,
  // sortConfig, // Removed
  selectAllState,
  onSelectAll,
  onSelectItem,
  onRequestSort,
  getSortIcon,
  onEditItem,
  onDeleteItem,
  isLoading,
  totalDbItems,
  selectedStore,
}) => {
  if (isLoading && itemsToDisplay.length === 0) {
    return (
      <div className="text-center p-10 text-gray-500">
        데이터를 불러오는 중입니다...
      </div>
    );
  }
  if (!isLoading && itemsToDisplay.length === 0) {
    return (
      <div className="text-center p-10 text-gray-500">
        {totalDbItems === 0 && selectedStore
          ? `'${selectedStore}' 매장에 해당하는 비품이 없습니다.`
          : totalDbItems === 0 && !selectedStore
          ? "등록된 비품이 없습니다."
          : "현재 페이지에 표시할 비품이 없습니다."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="px-2 py-3 w-12 text-center">
              <Checkbox
                checked={selectAllState}
                onCheckedChange={onSelectAll}
                aria-label="현재 페이지 모든 항목 선택"
              />
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("id")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>ID {getSortIcon("id")}</>
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("storeName")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>매장명 {getSortIcon("storeName")}</>
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("itemName")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>품목명 {getSortIcon("itemName")}</>
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("quantity")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100"
            >
              <>수량 {getSortIcon("quantity")}</>
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              규격
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("deliveryMethod")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>배송 {getSortIcon("deliveryMethod")}</>
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("progressStatus")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>상태 {getSortIcon("progressStatus")}</>
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              비고
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("createdAt")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>등록일 {getSortIcon("createdAt")}</>
            </TableHead>
            <TableHead
              onClick={() => onRequestSort("updatedAt")}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <>수정일 {getSortIcon("updatedAt")}</>
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
              작업
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {itemsToDisplay.map((item) => (
            <TableRow
              key={item.id}
              className={`hover:bg-gray-50 transition-colors ${
                selectedItemIds.includes(item.id) ? "bg-blue-50" : ""
              }`}
            >
              <TableCell className="px-2 py-3 text-center">
                <Checkbox
                  checked={selectedItemIds.includes(item.id)}
                  onCheckedChange={(checked) => onSelectItem(item.id, checked)}
                  aria-label={`${item.itemName} 선택`}
                />
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                {item.id}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                {item.storeName}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {item.itemName}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                <Badge variant="outline" className="font-normal">
                  {item.quantity}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {item.specification}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                <Badge
                  variant={
                    item.deliveryMethod === "DIRECT" ? "default" : "secondary"
                  }
                  className="capitalize"
                >
                  {item.deliveryMethod === "DIRECT" ? "직접" : "택배"}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                <Badge
                  variant={getProgressStatusVariant(item.progressStatus)}
                  className="text-xs"
                >
                  {translateProgressStatus(item.progressStatus)}
                </Badge>
              </TableCell>
              <TableCell
                className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate"
                title={item.notes || ""}
              >
                {item.notes || "-"}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {new Date(item.updatedAt).toLocaleDateString("ko-KR", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm space-x-1 text-center">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEditItem(item)}
                  className="text-blue-600 hover:bg-blue-100 h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteItem(item)}
                  className="text-red-600 hover:bg-red-100 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  totalDbItems: number;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalDbItems,
}) => {
  if (totalPages <= 0) return null;

  const handlePrevious = () => onPageChange(Math.max(1, currentPage - 1));
  const handleNext = () => onPageChange(Math.min(totalPages, currentPage + 1));
  const handleFirst = () => onPageChange(1);
  const handleLast = () => onPageChange(totalPages);

  const pageNumbers = [];
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (totalPages > 0 && endPage - startPage + 1 < maxPagesToShow) {
    if (currentPage < maxPagesToShow / 2) {
      endPage = Math.min(totalPages, maxPagesToShow);
    } else if (currentPage > totalPages - maxPagesToShow / 2) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    } else {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
  }

  if (totalPages > 0) {
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 p-4 border-t">
      <div className="text-sm text-gray-700 mb-2 sm:mb-0">
        총 {totalDbItems}개 중{" "}
        {totalDbItems > 0
          ? Math.min((currentPage - 1) * itemsPerPage + 1, totalDbItems)
          : 0}{" "}
        - {Math.min(currentPage * itemsPerPage, totalDbItems)} 표시
      </div>
      <div className="flex items-center space-x-2">
        <Select
          value={String(itemsPerPage)}
          onValueChange={(value) => onItemsPerPageChange(Number(value))}
        >
          <SelectTrigger className="w-[80px] h-9 text-sm">
            <SelectValue placeholder="개수" />
          </SelectTrigger>
          <SelectContent>
            {ITEMS_PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-700">페이지 당</span>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleFirst}
            disabled={currentPage === 1 || totalPages === 0}
            className="h-9 w-9"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentPage === 1 || totalPages === 0}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {startPage > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(startPage - 1)}
              className="h-9 w-9"
            >
              ...
            </Button>
          )}
          {pageNumbers.map((number) => (
            <Button
              key={number}
              variant={currentPage === number ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(number)}
              className="h-9 w-9"
            >
              {number}
            </Button>
          ))}
          {endPage < totalPages && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(endPage + 1)}
              className="h-9 w-9"
            >
              ...
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleLast}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface AddEditItemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isSequentialEditMode: boolean;
  currentSequentialEditIndex?: number;
  sequentialEditQueueLength?: number;
  editingItem: Item | null;
  formData: {
    storeName: string;
    itemName: string;
    quantity: number;
    specification: string;
    deliveryMethod: "DIRECT" | "COURIER";
    notes: string;
    progressStatus: ProgressStatus;
  };
  onFormDataChange: (
    field: keyof AddEditItemDialogProps["formData"],
    value: string | number | ProgressStatus | "DIRECT" | "COURIER" // Corrected type
  ) => void;
  onSave: () => Promise<void>;
  onSkipSequential?: () => void;
  onFinishSequential?: () => void;
  isLoading: boolean;
}

const AddEditItemDialog: React.FC<AddEditItemDialogProps> = ({
  isOpen,
  onOpenChange,
  isSequentialEditMode,
  currentSequentialEditIndex,
  sequentialEditQueueLength,
  editingItem,
  formData,
  onFormDataChange,
  onSave,
  onSkipSequential,
  onFinishSequential,
  isLoading,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-800">
            {isSequentialEditMode
              ? `연속 수정 (${(currentSequentialEditIndex ?? 0) + 1}/${
                  sequentialEditQueueLength ?? 0
                }): ${editingItem?.itemName}`
              : editingItem
              ? "비품 수정"
              : "새 비품 추가"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="매장명"
            value={formData.storeName}
            onChange={(e) => onFormDataChange("storeName", e.target.value)}
            className="rounded-md"
          />
          <Input
            placeholder="품목명"
            value={formData.itemName}
            onChange={(e) => onFormDataChange("itemName", e.target.value)}
            className="rounded-md"
          />
          <Input
            type="number"
            placeholder="수량"
            value={formData.quantity}
            onChange={(e) =>
              onFormDataChange("quantity", parseInt(e.target.value) || 0)
            }
            min="0"
            className="rounded-md"
          />
          <Input
            placeholder="규격"
            value={formData.specification}
            onChange={(e) => onFormDataChange("specification", e.target.value)}
            className="rounded-md"
          />
          <Select
            value={formData.deliveryMethod}
            onValueChange={(value: "DIRECT" | "COURIER") =>
              onFormDataChange("deliveryMethod", value)
            }
          >
            <SelectTrigger className="rounded-md">
              <SelectValue placeholder="배송 방식" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT">직접배송</SelectItem>
              <SelectItem value="COURIER">택배출고</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={formData.progressStatus}
            onValueChange={(value: ProgressStatus) =>
              onFormDataChange("progressStatus", value)
            }
          >
            <SelectTrigger className="rounded-md">
              <SelectValue placeholder="진행 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNCONFIRMED">
                {translateProgressStatus("UNCONFIRMED")}
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                {translateProgressStatus("IN_PROGRESS")}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {translateProgressStatus("COMPLETED")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="비고 (선택 사항)"
            value={formData.notes || ""}
            onChange={(e) => onFormDataChange("notes", e.target.value)}
            className="rounded-md"
          />
        </div>
        <DialogFooter className="mt-2 gap-2">
          {isSequentialEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={onFinishSequential}
                className="rounded-md"
              >
                <XCircle className="h-4 w-4 mr-2" />
                연속 수정 중단
              </Button>
              <Button
                variant="outline"
                onClick={onSkipSequential}
                className="rounded-md"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                건너뛰기
              </Button>
              <Button
                onClick={onSave}
                className="bg-green-600 hover:bg-green-700 text-white rounded-md"
                disabled={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "저장 중..." : "저장 후 다음"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-md"
              >
                취소
              </Button>
              <Button
                onClick={onSave}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                disabled={isLoading}
              >
                {isLoading
                  ? "저장 중..."
                  : editingItem
                  ? "변경사항 저장"
                  : "비품 추가"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  confirmButtonText?: string;
  confirmButtonVariant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | null
    | undefined;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading,
  confirmButtonText = "확인",
  confirmButtonVariant = "destructive",
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">{description}</div>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-md"
          >
            취소
          </Button>
          <Button
            variant={confirmButtonVariant}
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md"
          >
            {isLoading ? "처리 중..." : confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface BatchStatusChangeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedItemIdsCount: number;
  targetBatchStatus: ProgressStatus;
  onTargetBatchStatusChange: (status: ProgressStatus) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

const BatchStatusChangeDialog: React.FC<BatchStatusChangeDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedItemIdsCount,
  targetBatchStatus,
  onTargetBatchStatusChange,
  onConfirm,
  isLoading,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            선택 항목 상태 일괄 변경
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p>
            선택된{" "}
            <strong className="font-medium">{selectedItemIdsCount}개</strong>{" "}
            항목의 진행 상태를 변경합니다.
          </p>
          <Select
            value={targetBatchStatus}
            onValueChange={onTargetBatchStatusChange}
          >
            <SelectTrigger className="rounded-md">
              <SelectValue placeholder="변경할 상태 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNCONFIRMED">
                {translateProgressStatus("UNCONFIRMED")}
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                {translateProgressStatus("IN_PROGRESS")}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {translateProgressStatus("COMPLETED")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-md"
          >
            취소
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-md"
          >
            {isLoading ? "변경 중..." : "상태 변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- Main Page Component ---
export default function TablePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [allStoreNames, setAllStoreNames] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [totalDbItems, setTotalDbItems] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Item | null;
    direction: "ascending" | "descending";
  }>({
    key: "createdAt",
    direction: "descending",
  });
  const [selectedStore, setSelectedStore] = useState<string>("");

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    storeName: "",
    itemName: "",
    quantity: 0,
    specification: "",
    deliveryMethod: "DIRECT" as "DIRECT" | "COURIER",
    notes: "",
    progressStatus: "UNCONFIRMED" as ProgressStatus,
  });
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [isSingleDeleteConfirmOpen, setIsSingleDeleteConfirmOpen] =
    useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] =
    useState(false);
  const [isBatchStatusDialogOpen, setIsBatchStatusDialogOpen] = useState(false);
  const [targetBatchStatus, setTargetBatchStatus] =
    useState<ProgressStatus>("UNCONFIRMED");

  const [isSequentialEditMode, setIsSequentialEditMode] = useState(false);
  const [sequentialEditQueue, setSequentialEditQueue] = useState<Item[]>([]);
  const [currentSequentialEditIndex, setCurrentSequentialEditIndex] =
    useState(0);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setGlobalError(null);

    let url = `/api/items?page=${currentPage}&limit=${itemsPerPage}`;
    if (sortConfig.key) {
      url += `&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`;
    }
    if (selectedStore) {
      url += `&storeName=${encodeURIComponent(selectedStore)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          errorData.error || `데이터 로드 실패 (${response.status})`
        );
      }
      const data = await response.json();
      setItems(data.items || []);
      setTotalDbItems(data.totalItems || 0);
      setServerTotalPages(data.totalPages || 0);
    } catch (e: unknown) {
      const error = e as Error;
      // Corrected type
      console.error("데이터 로드 실패:", error);
      setGlobalError(error.message || "데이터 로드 중 알 수 없는 오류 발생");
      setItems([]);
      setTotalDbItems(0);
      setServerTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, sortConfig, selectedStore]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const fetchAllStoresForFilter = async () => {
      try {
        const response = await fetch("/api/items?limit=10000");
        if (response.ok) {
          const data = await response.json();
          if (data.items && Array.isArray(data.items)) {
            const uniqueNames = Array.from(
              new Set((data.items as Item[]).map((item) => item.storeName))
            ).sort();
            setAllStoreNames(uniqueNames);
          }
        } else {
          console.warn(
            "매장 목록 일부 로드 실패 (필터용):",
            response.statusText
          );
        }
      } catch (error) {
        console.error("매장 목록 전체 로드 중 오류 발생 (필터용):", error);
      }
    };
    fetchAllStoresForFilter();
  }, []);

  const requestSort = (key: keyof Item) => {
    let newDirection: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      newDirection = "descending";
    }
    setSortConfig({ key, direction: newDirection });
    setCurrentPage(1);
  };

  const getSortIcon = (columnKey: keyof Item) => {
    if (sortConfig.key !== columnKey)
      return (
        <ChevronsUpDown className="h-4 w-4 ml-1 inline-block text-gray-400" />
      );
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="h-4 w-4 ml-1 inline-block" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1 inline-block" />
    );
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleStoreChange = (value: string) => {
    setSelectedStore(value);
    setCurrentPage(1);
  };

  const handleSelectAllCurrentPage = (checked: boolean | "indeterminate") => {
    if (checked === true) setSelectedItemIds(items.map((item) => item.id));
    else setSelectedItemIds([]);
  };

  const handleSelectItem = (
    itemId: number,
    checked: boolean | "indeterminate"
  ) => {
    if (checked === true) setSelectedItemIds((prev) => [...prev, itemId]);
    else setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  const isAllCurrentPageSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedItemIds.includes(item.id));
  }, [items, selectedItemIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    if (items.length === 0 || isAllCurrentPageSelected) return false;
    return items.some((item) => selectedItemIds.includes(item.id));
  }, [items, selectedItemIds, isAllCurrentPageSelected]);

  const selectAllStateForCurrentPage = isAllCurrentPageSelected
    ? true
    : isSomeCurrentPageSelected
    ? "indeterminate"
    : false;

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      items.map((item) => ({
        ID: item.id,
        매장명: item.storeName,
        품목명: item.itemName,
        수량: item.quantity,
        규격: item.specification,
        배송방식: item.deliveryMethod === "DIRECT" ? "직접배송" : "택배출고",
        진행상태: translateProgressStatus(item.progressStatus),
        비고: item.notes || "",
        등록일: new Date(item.createdAt).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        수정일: new Date(item.updatedAt).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "비품목록_현재페이지");
    XLSX.writeFile(
      workbook,
      `비품목록_현재페이지_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const resetForm = useCallback(() => {
    setFormData({
      storeName: "",
      itemName: "",
      quantity: 0,
      specification: "",
      deliveryMethod: "DIRECT",
      notes: "",
      progressStatus: "UNCONFIRMED",
    });
    setEditingItem(null);
  }, []); // setFormData and setEditingItem are stable

  const finishSequentialEdit = useCallback(() => {
    setIsSequentialEditMode(false);
    setSequentialEditQueue([]);
    setCurrentSequentialEditIndex(0);
    setIsAddEditDialogOpen(false);
    resetForm();
  }, [resetForm]); // Dependencies: resetForm, other setters are stable

  const handleOpenAddEditDialog = (item: Item | null) => {
    if (isSequentialEditMode) finishSequentialEdit();
    if (item) {
      setEditingItem(item);
      setFormData({
        storeName: item.storeName,
        itemName: item.itemName,
        quantity: item.quantity,
        specification: item.specification,
        deliveryMethod: item.deliveryMethod,
        notes: item.notes || "",
        progressStatus: item.progressStatus,
      });
    } else {
      resetForm();
    }
    setIsAddEditDialogOpen(true);
  };

  const handleAddEditDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (isSequentialEditMode) finishSequentialEdit();
      else {
        setIsAddEditDialogOpen(false);
        resetForm();
      }
    } else {
      if (!editingItem && !isSequentialEditMode) resetForm();
      setIsAddEditDialogOpen(true);
    }
  };

  const handleFormDataChange = (
    field: keyof typeof formData,
    value: string | number | ProgressStatus | "DIRECT" | "COURIER" // Corrected type
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setGlobalError(null);
    const itemToSave = editingItem;
    const saveData = { ...formData, quantity: Number(formData.quantity) };

    try {
      const url = itemToSave ? `/api/items/${itemToSave.id}` : "/api/items";
      const method = itemToSave ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveData),
      });

      if (response.ok) {
        if (!itemToSave && !isSequentialEditMode) {
          await fetchItems();
        } else {
          await fetchItems();
        }

        if (isSequentialEditMode) {
          setCurrentSequentialEditIndex((prev) => prev + 1);
        } else {
          setIsAddEditDialogOpen(false);
          resetForm();
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "응답 처리 실패" }));
        console.error("저장 실패:", errorData);
        setGlobalError(`저장 실패: ${errorData.error || "알 수 없는 오류"}`);
        if (isSequentialEditMode) setIsAddEditDialogOpen(true);
      }
    } catch (error: unknown) {
      const e = error as {
        message?: string;
        status?: number;
        statusText?: string;
      }; // Corrected type
      // Corrected type
      console.error("저장 실패:", error);
      setGlobalError(`저장 중 오류 발생: ${e.message}`);
      if (isSequentialEditMode) setIsAddEditDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const openSingleDeleteConfirmDialog = (item: Item) => {
    setItemToDelete(item);
    setIsSingleDeleteConfirmOpen(true);
  };

  const confirmSingleDelete = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    setGlobalError(null);
    try {
      const response = await fetch(`/api/items/${itemToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSelectedItemIds((prev) =>
          prev.filter((id) => id !== itemToDelete.id)
        );
        if (items.length === 1 && currentPage > 1) {
          setCurrentPage((prev) => prev - 1);
        } else {
          await fetchItems();
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "응답 처리 실패" }));
        console.error("삭제 실패:", errorData);
        setGlobalError(`삭제 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (e: unknown) {
      // Corrected type
      const error = e as Error;
      console.error("삭제 실패:", error);
      setGlobalError(`삭제 중 오류 발생: ${error.message}`);
    } finally {
      setIsSingleDeleteConfirmOpen(false);
      setItemToDelete(null);
      setIsLoading(false);
    }
  };

  const confirmBatchDelete = async () => {
    setIsLoading(true);
    setGlobalError(null);
    const currentSelectedItemIds = [...selectedItemIds];

    const results = await Promise.allSettled(
      currentSelectedItemIds.map((id) =>
        fetch(`/api/items/${id}`, { method: "DELETE" })
      )
    );

    setSelectedItemIds([]);

    const failedDeletes = results.filter(
      (r) =>
        r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );
    if (failedDeletes.length > 0) {
      setGlobalError(
        `${failedDeletes.length}개 항목 삭제 실패. 자세한 내용은 콘솔을 확인하세요.`
      );
      failedDeletes.forEach(async (fail, index) => {
        const originalId = currentSelectedItemIds[index];
        if (fail.status === "fulfilled" && !fail.value.ok) {
          try {
            const errorJson = await fail.value.json();
            console.error(`ID ${originalId} 삭제 실패 응답:`, errorJson);
          } catch {
            console.error(
              `ID ${originalId} 삭제 실패 응답 (파싱 불가):`,
              fail.value.statusText
            );
          }
        } else if (fail.status === "rejected") {
          console.error(`ID ${originalId} 삭제 요청 실패:`, fail.reason);
        }
      });
    } else {
      setGlobalError(null);
    }

    if (
      currentSelectedItemIds.length === items.length &&
      currentPage > 1 &&
      items.every((item) => currentSelectedItemIds.includes(item.id))
    ) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    } else {
      await fetchItems();
    }
    setIsBatchDeleteConfirmOpen(false);
    setIsLoading(false);
  };

  const handleOpenBatchStatusChangeDialog = () => {
    if (selectedItemIds.length === 0) {
      setGlobalError("상태를 변경할 항목을 먼저 선택해주세요.");
      return;
    }
    setTargetBatchStatus("UNCONFIRMED");
    setIsBatchStatusDialogOpen(true);
  };

  const confirmBatchStatusChange = async () => {
    setIsLoading(true);
    setGlobalError(null);
    const currentSelectedItemIds = [...selectedItemIds];

    const results = await Promise.allSettled(
      currentSelectedItemIds.map((id) =>
        fetch(`/api/items/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progressStatus: targetBatchStatus }),
        })
      )
    );
    setSelectedItemIds([]);

    const failedUpdates = results.filter(
      (r) =>
        r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );
    if (failedUpdates.length > 0) {
      setGlobalError(
        `${failedUpdates.length}개 항목 상태 변경 실패. 자세한 내용은 콘솔을 확인하세요.`
      );
      failedUpdates.forEach(async (fail, index) => {
        const originalId = currentSelectedItemIds[index];
        if (fail.status === "fulfilled" && !fail.value.ok) {
          try {
            const errorJson = await fail.value.json();
            console.error(`ID ${originalId} 상태변경 실패 응답:`, errorJson);
          } catch {
            console.error(
              `ID ${originalId} 상태변경 실패 응답 (파싱 불가):`,
              fail.value.statusText
            );
          }
        } else if (fail.status === "rejected") {
          console.error(`ID ${originalId} 상태변경 요청 실패:`, fail.reason);
        }
      });
    } else {
      setGlobalError(null);
    }
    await fetchItems();
    setIsBatchStatusDialogOpen(false);
    setIsLoading(false);
  };

  const startSequentialEdit = () => {
    const itemsToEdit = items.filter((item) =>
      selectedItemIds.includes(item.id)
    );
    if (itemsToEdit.length === 0) {
      setGlobalError("연속 수정할 항목을 현재 페이지에서 선택해주세요.");
      return;
    }
    setSequentialEditQueue(itemsToEdit);
    setCurrentSequentialEditIndex(0);
    setIsSequentialEditMode(true);
  };

  const handleSequentialSkip = () => {
    setCurrentSequentialEditIndex((prev) => prev + 1);
  };

  useEffect(() => {
    if (isSequentialEditMode && sequentialEditQueue.length > 0) {
      if (currentSequentialEditIndex < sequentialEditQueue.length) {
        const currentItem = sequentialEditQueue[currentSequentialEditIndex];
        setEditingItem(currentItem);
        setFormData({
          storeName: currentItem.storeName,
          itemName: currentItem.itemName,
          quantity: currentItem.quantity,
          specification: currentItem.specification,
          deliveryMethod: currentItem.deliveryMethod,
          notes: currentItem.notes || "",
          progressStatus: currentItem.progressStatus,
        });
        setIsAddEditDialogOpen(true);
      } else {
        finishSequentialEdit();
      }
    } else if (isSequentialEditMode && sequentialEditQueue.length === 0) {
      finishSequentialEdit();
    }
  }, [
    isSequentialEditMode,
    sequentialEditQueue,
    currentSequentialEditIndex,
    finishSequentialEdit,
  ]); // Added finishSequentialEdit

  return (
    <div className="container mx-auto p-4 md:p-6">
      <GlobalErrorDisplay
        error={globalError}
        onClose={() => setGlobalError(null)}
      />
      <Card className="shadow-lg rounded-lg">
        <TableToolbar
          selectedItemIds={selectedItemIds}
          onBatchDeleteClick={() => setIsBatchDeleteConfirmOpen(true)}
          onBatchStatusChangeClick={handleOpenBatchStatusChangeDialog}
          onSequentialEditClick={startSequentialEdit}
          uniqueStoreNames={allStoreNames}
          selectedStore={selectedStore}
          onStoreChange={handleStoreChange}
          onExportClick={exportToExcel}
          onAddNewItemClick={() => handleOpenAddEditDialog(null)}
          currentItemsCount={items.length}
          totalFilteredItemsCount={totalDbItems}
        />
        <CardContent className="p-0">
          <ItemsTable
            itemsToDisplay={items}
            selectedItemIds={selectedItemIds}
            // sortConfig={sortConfig} // Removed
            selectAllState={selectAllStateForCurrentPage}
            onSelectAll={handleSelectAllCurrentPage}
            onSelectItem={handleSelectItem}
            onRequestSort={requestSort}
            getSortIcon={getSortIcon}
            onEditItem={handleOpenAddEditDialog}
            onDeleteItem={openSingleDeleteConfirmDialog}
            isLoading={isLoading}
            totalDbItems={totalDbItems}
            selectedStore={selectedStore}
          />
        </CardContent>
        {serverTotalPages > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={serverTotalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalDbItems={totalDbItems}
          />
        )}
      </Card>

      <AddEditItemDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={handleAddEditDialogClose}
        isSequentialEditMode={isSequentialEditMode}
        currentSequentialEditIndex={currentSequentialEditIndex}
        sequentialEditQueueLength={sequentialEditQueue.length}
        editingItem={editingItem}
        formData={formData}
        onFormDataChange={handleFormDataChange}
        onSave={handleSave}
        onSkipSequential={handleSequentialSkip}
        onFinishSequential={finishSequentialEdit}
        isLoading={isLoading}
      />

      <ConfirmationDialog
        isOpen={isSingleDeleteConfirmOpen}
        onOpenChange={setIsSingleDeleteConfirmOpen}
        title="삭제 확인"
        description={
          <p>
            정말로 {/* Corrected unescaped entities */}
            <strong className="font-medium">
              &lsquo;{itemToDelete?.itemName}&rsquo;
            </strong>{" "}
            (ID: {itemToDelete?.id}) 비품을 삭제하시겠습니까?
            <br />이 작업은 되돌릴 수 없습니다.
          </p>
        }
        onConfirm={confirmSingleDelete}
        isLoading={isLoading}
        confirmButtonText="삭제"
      />

      <ConfirmationDialog
        isOpen={isBatchDeleteConfirmOpen}
        onOpenChange={setIsBatchDeleteConfirmOpen}
        title="선택 항목 삭제 확인"
        description={
          <p>
            선택된{" "}
            <strong className="font-medium">{selectedItemIds.length}개</strong>
            의 비품을 정말로 삭제하시겠습니까?
            <br />이 작업은 되돌릴 수 없습니다.
          </p>
        }
        onConfirm={confirmBatchDelete}
        isLoading={isLoading}
        confirmButtonText="삭제"
      />

      <BatchStatusChangeDialog
        isOpen={isBatchStatusDialogOpen}
        onOpenChange={setIsBatchStatusDialogOpen}
        selectedItemIdsCount={selectedItemIds.length}
        targetBatchStatus={targetBatchStatus}
        onTargetBatchStatusChange={setTargetBatchStatus}
        onConfirm={confirmBatchStatusChange}
        isLoading={isLoading}
      />
    </div>
  );
}
