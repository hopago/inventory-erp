// app/table/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
// Assuming your new table components are now the default export from @/components/ui/table
// If they are in a different file, adjust the import path accordingly.
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // These should now refer to your new table components
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
  Filter, // Icon for new filter
  Store, // Icon for store filter
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
const ALL_STATUSES_VALUE = "ALL_STATUSES_FILTER_VALUE"; // Special non-empty value for "all statuses"

const PROGRESS_STATUS_OPTIONS: {
  value: ProgressStatus | typeof ALL_STATUSES_VALUE;
  label: string;
}[] = [
  { value: ALL_STATUSES_VALUE, label: "전체 상태" }, // Changed value from ""
  { value: "UNCONFIRMED", label: translateProgressStatus("UNCONFIRMED") },
  { value: "IN_PROGRESS", label: translateProgressStatus("IN_PROGRESS") },
  { value: "COMPLETED", label: translateProgressStatus("COMPLETED") },
];

interface TableToolbarProps {
  selectedItemIds: number[];
  onBatchDeleteClick: () => void;
  onBatchStatusChangeClick: () => void;
  onSequentialEditClick: () => void;
  uniqueStoreNames: string[];
  selectedStore: string;
  onStoreChange: (value: string) => void;
  selectedStatusState: ProgressStatus | ""; // This is the parent's state value ("" for all)
  onStatusChange: (value: ProgressStatus | "") => void; // This callback expects "" for all
  onExportClick: () => void;
  onAddNewItemClick: () => void;
  currentItemsCount: number;
  totalFilteredItemsCount: number;
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  selectedItemIds,
  onBatchDeleteClick,
  onBatchStatusChangeClick,
  onSequentialEditClick,
  uniqueStoreNames,
  selectedStore,
  onStoreChange,
  selectedStatusState, // Renamed prop to avoid confusion with internal select value
  onStatusChange,
  onExportClick,
  onAddNewItemClick,
  currentItemsCount,
  totalFilteredItemsCount,
}) => {
  return (
    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6 border-b bg-slate-50 rounded-t-lg">
      <div className="flex items-center space-x-3">
        <Package className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            비품 관리 시스템
          </h1>
          <Badge variant="outline" className="mt-1 text-xs text-gray-600">
            {selectedItemIds.length > 0
              ? `${selectedItemIds.length}개 선택됨 / `
              : ""}
            {currentItemsCount}개 표시 (총 {totalFilteredItemsCount}개 일치)
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
              className="h-9 text-sm shadow-sm hover:shadow-md transition-shadow"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              선택 삭제 ({selectedItemIds.length})
            </Button>
            <Button
              onClick={onBatchStatusChangeClick}
              variant="outline"
              size="sm"
              className="h-9 text-sm border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              상태 변경 ({selectedItemIds.length})
            </Button>
            <Button
              onClick={onSequentialEditClick}
              variant="outline"
              size="sm"
              className="h-9 text-sm border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              연속 수정 ({selectedItemIds.length})
            </Button>
          </>
        )}
        <Select
          value={
            selectedStatusState === ""
              ? ALL_STATUSES_VALUE
              : selectedStatusState
          }
          onValueChange={(value) => {
            if (value === ALL_STATUSES_VALUE) {
              onStatusChange(""); // Notify parent with "" for "all statuses"
            } else {
              onStatusChange(value as ProgressStatus);
            }
          }}
        >
          <SelectTrigger className="w-full md:w-[150px] h-9 text-sm rounded-md bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
            <Filter className="h-3 w-3 mr-2 text-gray-500" />
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            {PROGRESS_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedStore || "ALL_STORES"} // "ALL_STORES" is not an empty string, so it's fine
          onValueChange={(value) =>
            onStoreChange(value === "ALL_STORES" ? "" : value)
          }
        >
          <SelectTrigger className="w-full md:w-[180px] h-9 text-sm rounded-md bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
            <Store className="h-3 w-3 mr-2 text-gray-500" />
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
          className="h-9 text-sm border-gray-300 hover:bg-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <Download className="h-4 w-4 mr-2" />
          Excel (현재 페이지)
        </Button>
        <Button
          onClick={onAddNewItemClick}
          className="h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="h-4 w-4 mr-2" />새 비품 추가
        </Button>
      </div>
    </CardHeader>
  );
};

interface ItemsTableProps {
  itemsToDisplay: Item[];
  selectedItemIds: number[];
  selectAllState: boolean | "indeterminate";
  onSelectAll: (checked: boolean | "indeterminate") => void;
  onSelectItem: (itemId: number, checked: boolean | "indeterminate") => void;
  onRequestSort: (key: keyof Item) => void;
  getSortIcon: (columnKey: keyof Item) => React.JSX.Element;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  isLoading: boolean;
  totalDbItems: number; // Renamed from totalFilteredItemsCount for clarity in this component
  selectedStore: string;
  selectedStatus: ProgressStatus | "";
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  itemsToDisplay,
  selectedItemIds,
  selectAllState,
  onSelectAll,
  onSelectItem,
  onRequestSort,
  getSortIcon,
  onEditItem,
  onDeleteItem,
  isLoading,
  totalDbItems, // This now refers to the total items matching the current filters from the server
  selectedStore,
  selectedStatus,
}) => {
  if (isLoading && itemsToDisplay.length === 0) {
    return (
      <div className="text-center p-10 text-gray-500 min-h-[300px] flex items-center justify-center">
        <p>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }
  // This condition uses totalDbItems, which should be the count of items *after* server-side filtering.
  // If filters are applied, totalDbItems should reflect the filtered total.
  if (!isLoading && itemsToDisplay.length === 0) {
    let message = "현재 페이지에 표시할 비품이 없습니다.";
    // This message logic depends on totalDbItems correctly reflecting the server-filtered count.
    // If totalDbItems is 0 because of filters, the messages below are appropriate.
    // If totalDbItems is > 0 but current page is empty (e.g. navigated past last page of filtered results),
    // that's a different scenario, though current pagination logic tries to prevent this.
    if (totalDbItems === 0) {
      // This implies no items match the filters *in the entire database*
      if (selectedStore && selectedStatus) {
        message = `'${selectedStore}' 매장의 '${
          PROGRESS_STATUS_OPTIONS.find((opt) => opt.value === selectedStatus)
            ?.label || selectedStatus
        }' 상태 비품이 없습니다.`;
      } else if (selectedStore) {
        message = `'${selectedStore}' 매장에 해당하는 비품이 없습니다.`;
      } else if (selectedStatus) {
        message = `'${
          PROGRESS_STATUS_OPTIONS.find((opt) => opt.value === selectedStatus)
            ?.label || selectedStatus
        }' 상태의 비품이 없습니다.`;
      } else {
        message = "등록된 비품이 없습니다. 새 비품을 추가해보세요.";
      }
    }
    return (
      <div className="text-center p-10 text-gray-500 min-h-[300px] flex items-center justify-center">
        <p>{message}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              checked={selectAllState}
              onCheckedChange={onSelectAll}
              aria-label="현재 페이지 모든 항목 선택"
            />
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("id")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>ID {getSortIcon("id")}</>
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("storeName")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>매장명 {getSortIcon("storeName")}</>
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("itemName")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>품목명 {getSortIcon("itemName")}</>
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("quantity")}
            className="text-right cursor-pointer hover:bg-muted/50"
          >
            <>수량 {getSortIcon("quantity")}</>
          </TableHead>
          <TableHead>규격</TableHead>
          <TableHead
            onClick={() => onRequestSort("deliveryMethod")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>배송 {getSortIcon("deliveryMethod")}</>
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("progressStatus")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>상태 {getSortIcon("progressStatus")}</>
          </TableHead>
          <TableHead>비고</TableHead>
          <TableHead
            onClick={() => onRequestSort("createdAt")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>등록일 {getSortIcon("createdAt")}</>
          </TableHead>
          <TableHead
            onClick={() => onRequestSort("updatedAt")}
            className="cursor-pointer hover:bg-muted/50"
          >
            <>수정일 {getSortIcon("updatedAt")}</>
          </TableHead>
          <TableHead className="text-center">작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itemsToDisplay.map((item) => (
          <TableRow
            key={item.id}
            data-state={
              selectedItemIds.includes(item.id) ? "selected" : undefined
            }
          >
            <TableCell>
              <Checkbox
                checked={selectedItemIds.includes(item.id)}
                onCheckedChange={(checked) => onSelectItem(item.id, checked)}
                aria-label={`${item.itemName} 선택`}
              />
            </TableCell>
            <TableCell className="font-mono text-gray-700">{item.id}</TableCell>
            <TableCell className="font-medium text-gray-900">
              {item.storeName}
            </TableCell>
            <TableCell>{item.itemName}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="font-normal text-sm">
                {item.quantity}
              </Badge>
            </TableCell>
            <TableCell>{item.specification}</TableCell>
            <TableCell>
              <Badge
                variant={
                  item.deliveryMethod === "DIRECT" ? "default" : "secondary"
                }
                className="capitalize text-xs"
              >
                {item.deliveryMethod === "DIRECT" ? "직접" : "택배"}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={getProgressStatusVariant(item.progressStatus)}
                className="text-xs"
              >
                {translateProgressStatus(item.progressStatus)}
              </Badge>
            </TableCell>
            <TableCell
              className="max-w-[150px] truncate"
              title={item.notes || ""}
            >
              {item.notes || "-"}
            </TableCell>
            <TableCell>
              {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
              })}
            </TableCell>
            <TableCell>
              {new Date(item.updatedAt).toLocaleDateString("ko-KR", {
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
              })}
            </TableCell>
            <TableCell className="text-center">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEditItem(item)}
                className="text-blue-600 hover:bg-blue-100 h-8 w-8 p-0"
                aria-label="Edit item"
              >
                {" "}
                <Edit className="h-4 w-4" />{" "}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDeleteItem(item)}
                className="text-red-600 hover:bg-red-100 h-8 w-8 p-0"
                aria-label="Delete item"
              >
                {" "}
                <Trash2 className="h-4 w-4" />{" "}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  totalDbItems: number; // Total items in DB matching current filters
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalDbItems,
}) => {
  if (totalPages <= 0 && totalDbItems <= 0) return null; // Hide if no items or pages

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
      // Adjust startPage if endPage was capped by totalPages
      if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - maxPagesToShow + 1);
      } else {
        // Adjust endPage if startPage was capped by 1
        if (startPage === 1) {
          endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        }
      }
    }
  }

  if (totalPages > 0) {
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
  } else if (totalDbItems > 0 && totalPages === 0) {
    // This case implies totalPages might not have been calculated correctly if totalDbItems > 0
    // Or it's a single page scenario.
    // For safety, if totalPages is 0 but there are items, assume 1 page.
    // However, serverTotalPages should ideally be at least 1 if totalDbItems > 0.
    // This part of the pagination display might not even show if totalPages is 0 based on the initial null check.
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 p-4 border-t bg-slate-50 rounded-b-lg">
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
          <SelectTrigger className="w-[80px] h-9 text-sm rounded-md bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
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
            className="h-9 w-9 shadow-sm"
          >
            {" "}
            <ChevronsLeft className="h-4 w-4" />{" "}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentPage === 1 || totalPages === 0}
            className="h-9 w-9 shadow-sm"
          >
            {" "}
            <ChevronLeft className="h-4 w-4" />{" "}
          </Button>
          {startPage > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(startPage - 1)} // Or a more sophisticated jump
              className="h-9 w-9 shadow-sm"
            >
              {" "}
              ...{" "}
            </Button>
          )}
          {pageNumbers.map((number) => (
            <Button
              key={number}
              variant={currentPage === number ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(number)}
              className="h-9 w-9 shadow-sm"
            >
              {" "}
              {number}{" "}
            </Button>
          ))}
          {endPage < totalPages && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(endPage + 1)} // Or a more sophisticated jump
              className="h-9 w-9 shadow-sm"
            >
              {" "}
              ...{" "}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9 shadow-sm"
          >
            {" "}
            <ChevronRight className="h-4 w-4" />{" "}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleLast}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 w-9 shadow-sm"
          >
            {" "}
            <ChevronsRight className="h-4 w-4" />{" "}
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
    value: string | number | ProgressStatus | "DIRECT" | "COURIER"
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
              {" "}
              <SelectItem value="DIRECT">직접배송</SelectItem>{" "}
              <SelectItem value="COURIER">택배출고</SelectItem>{" "}
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
              {PROGRESS_STATUS_OPTIONS.filter(
                (opt) => opt.value !== ALL_STATUSES_VALUE
              ).map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={
                    opt.value as ProgressStatus /* Ensure correct type for SelectItem */
                  }
                >
                  {opt.label}
                </SelectItem>
              ))}
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
                {" "}
                <XCircle className="h-4 w-4 mr-2" /> 연속 수정 중단{" "}
              </Button>
              <Button
                variant="outline"
                onClick={onSkipSequential}
                className="rounded-md"
              >
                {" "}
                <SkipForward className="h-4 w-4 mr-2" /> 건너뛰기{" "}
              </Button>
              <Button
                onClick={onSave}
                className="bg-green-600 hover:bg-green-700 text-white rounded-md"
                disabled={isLoading}
              >
                {" "}
                <Save className="h-4 w-4 mr-2" />{" "}
                {isLoading ? "저장 중..." : "저장 후 다음"}{" "}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-md"
              >
                {" "}
                취소{" "}
              </Button>
              <Button
                onClick={onSave}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                disabled={isLoading}
              >
                {" "}
                {isLoading
                  ? "저장 중..."
                  : editingItem
                  ? "변경사항 저장"
                  : "비품 추가"}{" "}
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
            {" "}
            {isLoading ? "처리 중..." : confirmButtonText}{" "}
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
              {PROGRESS_STATUS_OPTIONS.filter(
                (opt) => opt.value !== ALL_STATUSES_VALUE
              ).map((opt) => (
                // Ensure that the value passed to SelectItem is of type ProgressStatus, not the "ALL_STATUSES_VALUE"
                <SelectItem key={opt.value} value={opt.value as ProgressStatus}>
                  {opt.label}
                </SelectItem>
              ))}
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
            {" "}
            {isLoading ? "변경 중..." : "상태 변경"}{" "}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function TablePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [allStoreNames, setAllStoreNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [totalDbItems, setTotalDbItems] = useState(0); // Total items in DB matching current filters
  const [serverTotalPages, setServerTotalPages] = useState(0); // Total pages from server for current filters
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Item | null;
    direction: "ascending" | "descending";
  }>({
    key: "createdAt",
    direction: "descending",
  });
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<ProgressStatus | "">("");

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
      // This correctly adds storeName if a store is selected
      url += `&storeName=${encodeURIComponent(selectedStore)}`;
    }
    if (selectedStatus) {
      // This correctly adds status if a status is selected
      url += `&status=${selectedStatus}`;
    }

    // DEBUGGING TIP FOR FILTERS:
    // 1. Log the final URL to the console:
    //    console.log("Fetching items with URL:", url);
    // 2. Open your browser's Developer Tools (Network tab).
    // 3. Apply a filter on your page.
    // 4. Check the Network tab for the request to the URL logged above.
    // 5. Verify:
    //    a. Are the `storeName` and `status` query parameters present and correct in the request URL?
    //    b. What is the API's response (payload and status code)? Does the response data reflect the applied filters?
    //    c. Does `totalItems` in the response reflect the count *after* filtering?
    // If the URL is correct but the API response isn't filtered, the issue is likely in the backend API logic.

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: response.statusText })); // Provide a fallback error object
        throw new Error(
          errorData.error || `데이터 로드 실패 (${response.status})`
        );
      }
      const data = await response.json();
      setItems(data.items || []);
      setTotalDbItems(data.totalItems || 0); // This should be the total count *after* server-side filtering
      setServerTotalPages(data.totalPages || 0); // This should be total pages *after* server-side filtering
    } catch (error: unknown) {
      const err = error as Error;
      console.error("데이터 로드 실패:", err);
      setGlobalError(err.message || "데이터 로드 중 알 수 없는 오류 발생");
      setItems([]); // Clear items on error
      setTotalDbItems(0);
      setServerTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, sortConfig, selectedStore, selectedStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]); // This effect runs when fetchItems is recreated (i.e., its dependencies change)

  useEffect(() => {
    // This effect fetches all unique store names for the filter dropdown.
    // It runs once on component mount.
    // NOTE: Fetching potentially all items (limit=10000) just for store names can be inefficient
    // if the dataset is very large. Consider a dedicated API endpoint (e.g., /api/stores) if performance becomes an issue.
    // This is unlikely to be the cause of the main data filtering problem.
    const fetchAllStoresForFilter = async () => {
      try {
        // Fetch only the storeName field to reduce data transfer, assuming API supports field selection.
        // If not, the original query is fine but less optimal.
        const response = await fetch("/api/items?limit=10000&fields=storeName");
        if (response.ok) {
          const data = await response.json();
          if (data.items && Array.isArray(data.items)) {
            const uniqueNames = Array.from(
              new Set(
                data.items.map(
                  (
                    item: {
                      storeName: string;
                    } /* Simplified Item for this purpose */
                  ) => item.storeName
                )
              )
            ).sort() as string[]; // Ensure string[] type after Set and sort
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
  }, []); // Empty dependency array ensures this runs only once on mount

  const requestSort = (key: keyof Item) => {
    let newDirection: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      newDirection = "descending";
    }
    setSortConfig({ key, direction: newDirection });
    setCurrentPage(1); // Reset to first page on sort change
  };

  const getSortIcon = (columnKey: keyof Item): React.JSX.Element => {
    if (sortConfig.key !== columnKey)
      return (
        <ChevronsUpDown className="h-4 w-4 ml-1 inline-block text-gray-400" />
      );
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="h-4 w-4 ml-1 inline-block text-blue-600" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1 inline-block text-blue-600" />
    );
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page
  };
  const handleStoreChange = (value: string) => {
    setSelectedStore(value);
    setCurrentPage(1); // Reset to first page
  };
  const handleStatusChange = (value: ProgressStatus | "") => {
    setSelectedStatus(value);
    setCurrentPage(1); // Reset to first page
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
    if (items.length === 0) return false; // No items to select
    return items.every((item) => selectedItemIds.includes(item.id));
  }, [items, selectedItemIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    if (items.length === 0 || isAllCurrentPageSelected) return false;
    return items.some((item) => selectedItemIds.includes(item.id));
  }, [items, selectedItemIds, isAllCurrentPageSelected]);

  const selectAllStateForCurrentPage: boolean | "indeterminate" =
    useMemo(() => {
      if (items.length === 0) return false;
      const allSelected = items.every((item) =>
        selectedItemIds.includes(item.id)
      );
      if (allSelected) return true;
      const someSelected = items.some((item) =>
        selectedItemIds.includes(item.id)
      );
      if (someSelected) return "indeterminate";
      return false;
    }, [items, selectedItemIds]);

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
  }, []);

  const finishSequentialEdit = useCallback(() => {
    setIsSequentialEditMode(false);
    setSequentialEditQueue([]);
    setCurrentSequentialEditIndex(0);
    setIsAddEditDialogOpen(false); // Close dialog
    resetForm();
    setSelectedItemIds([]); // Clear selections after sequential edit is done
  }, [resetForm]);

  const handleOpenAddEditDialog = (item: Item | null) => {
    if (isSequentialEditMode) {
      // If sequential edit is active, opening a dialog for a *different* item (not part of sequence)
      // should arguably stop the sequence. Or, this path shouldn't be reachable if UI disables individual edit during sequence.
      // For now, assume finishSequentialEdit is desired if a new non-sequential edit is initiated.
      finishSequentialEdit();
    }
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
      resetForm(); // For new item
    }
    setIsAddEditDialogOpen(true);
  };

  const handleAddEditDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Dialog is closing
      if (isSequentialEditMode) {
        // If closing during sequential edit (e.g., via Esc key or overlay click),
        // treat it as finishing the sequence.
        finishSequentialEdit();
      } else {
        // Normal dialog close
        setIsAddEditDialogOpen(false);
        resetForm();
      }
    } else {
      // Dialog is opening
      // This 'else' branch for isOpen=true might be redundant if dialog is only opened via handleOpenAddEditDialog
      if (!editingItem && !isSequentialEditMode) {
        // If opening for a new item (not edit, not sequential)
        resetForm();
      }
      setIsAddEditDialogOpen(true);
    }
  };

  const handleFormDataChange = (
    field: keyof typeof formData,
    value: string | number | ProgressStatus | "DIRECT" | "COURIER"
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setGlobalError(null);
    // Use editingItem from state, which is set correctly for both single and sequential edits
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
        // Successfully saved
        if (isSequentialEditMode) {
          // If in sequential mode, advance to the next item or finish
          if (currentSequentialEditIndex < sequentialEditQueue.length - 1) {
            setCurrentSequentialEditIndex((prev) => prev + 1);
            // The useEffect for sequential edit will load the next item's data
          } else {
            finishSequentialEdit(); // Last item in sequence was saved
          }
        } else {
          // Normal add/edit mode
          setIsAddEditDialogOpen(false);
          resetForm();
        }
        await fetchItems(); // Refresh data after successful save
      } else {
        // API returned an error
        const errorData = await response
          .json()
          .catch(() => ({ error: "응답 처리 실패" }));
        console.error("저장 실패:", errorData);
        setGlobalError(`저장 실패: ${errorData.error || "알 수 없는 오류"}`);
        // Do not close dialog automatically on error, allow user to correct
        if (isSequentialEditMode) setIsAddEditDialogOpen(true); // Keep dialog open for sequential
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error("저장 실패:", err);
      setGlobalError(`저장 중 오류 발생: ${err.message}`);
      if (isSequentialEditMode) setIsAddEditDialogOpen(true); // Keep dialog open for sequential
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
        // If the deleted item was the last one on a page > 1, go to previous page
        if (items.length === 1 && totalDbItems > 1 && currentPage > 1) {
          // Check totalDbItems before decrementing page to avoid issues if it was the absolute last item
          if (totalDbItems - 1 > (currentPage - 2) * itemsPerPage) {
            setCurrentPage((prev) => prev - 1);
          } else {
            await fetchItems(); // fetch current page, which might now be empty or have fewer items
          }
        } else {
          await fetchItems(); // Otherwise, just refresh the current page
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "응답 처리 실패" }));
        console.error("삭제 실패:", errorData);
        setGlobalError(`삭제 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error("삭제 실패:", err);
      setGlobalError(`삭제 중 오류 발생: ${err.message}`);
    } finally {
      setIsSingleDeleteConfirmOpen(false);
      setItemToDelete(null);
      setIsLoading(false);
    }
  };

  const confirmBatchDelete = async () => {
    setIsLoading(true);
    setGlobalError(null);
    const currentSelectedItemIds = [...selectedItemIds]; // Copy before clearing

    const results = await Promise.allSettled(
      currentSelectedItemIds.map((id) =>
        fetch(`/api/items/${id}`, { method: "DELETE" })
      )
    );

    setSelectedItemIds([]); // Clear selection after attempts

    const failedDeletes = results.filter(
      (r) =>
        r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );

    if (failedDeletes.length > 0) {
      setGlobalError(
        `${failedDeletes.length}개 항목 삭제 실패. 자세한 내용은 콘솔을 확인하세요.`
      );
      failedDeletes.forEach(async (result, index) => {
        // To get the original ID, map index to currentSelectedItemIds (before it was cleared)
        const originalId =
          currentSelectedItemIds[results.findIndex((r) => r === result)]; // Find original ID
        if (result.status === "fulfilled" && !result.value.ok) {
          try {
            const errorJson = await result.value.json();
            console.error(
              `ID ${originalId} 삭제 실패 응답 (${result.value.status}):`,
              errorJson
            );
          } catch {
            console.error(
              `ID ${originalId} 삭제 실패 응답 (파싱 불가, 상태 ${result.value.status}):`,
              result.value.statusText
            );
          }
        } else if (result.status === "rejected") {
          console.error(`ID ${originalId} 삭제 요청 실패:`, result.reason);
        }
      });
    } else {
      setGlobalError(null); // Clear previous errors if all successful
    }

    // Logic to adjust current page if all items on it were deleted
    const numDeletedSuccessfully =
      currentSelectedItemIds.length - failedDeletes.length;
    if (numDeletedSuccessfully > 0) {
      // If all items on the current page were selected and successfully deleted,
      // and it wasn't the first page, try to go to the previous page.
      const allItemsOnPageSelected =
        items.length > 0 &&
        items.every((item) => currentSelectedItemIds.includes(item.id));
      if (
        allItemsOnPageSelected &&
        numDeletedSuccessfully === items.length &&
        currentPage > 1
      ) {
        // Check if the new total number of items can support the previous page
        if (
          totalDbItems - numDeletedSuccessfully >
          (currentPage - 2) * itemsPerPage
        ) {
          setCurrentPage((prev) => Math.max(1, prev - 1));
        } else {
          await fetchItems(); // Or just refetch the current page (which might become empty or last page)
        }
      } else {
        await fetchItems(); // Refresh current page data
      }
    }

    setIsBatchDeleteConfirmOpen(false);
    setIsLoading(false);
  };

  const handleOpenBatchStatusChangeDialog = () => {
    if (selectedItemIds.length === 0) {
      setGlobalError("상태를 변경할 항목을 먼저 선택해주세요.");
      return;
    }
    // Default to UNCONFIRMED, or consider using the status of the first selected item,
    // or leave it blank for user to pick.
    setTargetBatchStatus("UNCONFIRMED");
    setIsBatchStatusDialogOpen(true);
  };

  const confirmBatchStatusChange = async () => {
    setIsLoading(true);
    setGlobalError(null);
    const currentSelectedItemIds = [...selectedItemIds]; // Copy before clearing

    const results = await Promise.allSettled(
      currentSelectedItemIds.map((id) =>
        fetch(`/api/items/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progressStatus: targetBatchStatus }),
        })
      )
    );

    setSelectedItemIds([]); // Clear selection after attempts

    const failedUpdates = results.filter(
      (r) =>
        r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );

    if (failedUpdates.length > 0) {
      setGlobalError(
        `${failedUpdates.length}개 항목 상태 변경 실패. 자세한 내용은 콘솔을 확인하세요.`
      );
      failedUpdates.forEach(async (result, index) => {
        const originalId =
          currentSelectedItemIds[results.findIndex((r) => r === result)];
        if (result.status === "fulfilled" && !result.value.ok) {
          try {
            const errorJson = await result.value.json();
            console.error(
              `ID ${originalId} 상태변경 실패 응답 (${result.value.status}):`,
              errorJson
            );
          } catch {
            console.error(
              `ID ${originalId} 상태변경 실패 응답 (파싱 불가, 상태 ${result.value.status}):`,
              result.value.statusText
            );
          }
        } else if (result.status === "rejected") {
          console.error(`ID ${originalId} 상태변경 요청 실패:`, result.reason);
        }
      });
    } else {
      setGlobalError(null);
    }

    await fetchItems(); // Refresh data to show updated statuses
    setIsBatchStatusDialogOpen(false);
    setIsLoading(false);
  };

  const startSequentialEdit = () => {
    // Filter selected items from the *currently displayed page*
    const itemsToEdit = items.filter((item) =>
      selectedItemIds.includes(item.id)
    );
    if (itemsToEdit.length === 0) {
      setGlobalError("연속 수정할 항목을 현재 페이지에서 선택해주세요.");
      return;
    }
    // Sort itemsToEdit by their original order in the `items` array (visual order)
    // This ensures the sequential edit follows the table display order if selection was random.
    itemsToEdit.sort((a, b) => items.indexOf(a) - items.indexOf(b));

    setSequentialEditQueue(itemsToEdit);
    setCurrentSequentialEditIndex(0);
    setIsSequentialEditMode(true);
    // The useEffect for sequential edit will handle opening the dialog and setting form data
  };

  const handleSequentialSkip = () => {
    if (currentSequentialEditIndex < sequentialEditQueue.length - 1) {
      setCurrentSequentialEditIndex((prev) => prev + 1);
    } else {
      // Skipped the last item, so finish
      finishSequentialEdit();
    }
  };

  useEffect(() => {
    if (isSequentialEditMode && sequentialEditQueue.length > 0) {
      if (currentSequentialEditIndex < sequentialEditQueue.length) {
        const currentItem = sequentialEditQueue[currentSequentialEditIndex];
        setEditingItem(currentItem); // Set for the dialog title and save logic
        setFormData({
          storeName: currentItem.storeName,
          itemName: currentItem.itemName,
          quantity: currentItem.quantity,
          specification: currentItem.specification,
          deliveryMethod: currentItem.deliveryMethod,
          notes: currentItem.notes || "",
          progressStatus: currentItem.progressStatus,
        });
        setIsAddEditDialogOpen(true); // Open/ensure dialog is open
      } else {
        // Reached end of queue (e.g. after last save or multiple skips)
        finishSequentialEdit();
      }
    }
    // No 'else if' for sequentialEditQueue.length === 0 needed here,
    // as finishSequentialEdit (which sets queue to empty) also sets isSequentialEditMode to false,
    // breaking the outer condition.
  }, [
    isSequentialEditMode,
    sequentialEditQueue,
    currentSequentialEditIndex,
    finishSequentialEdit, // Make sure finishSequentialEdit is stable (useCallback)
    resetForm, // resetForm is also a dependency of finishSequentialEdit
  ]);

  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      <GlobalErrorDisplay
        error={globalError}
        onClose={() => setGlobalError(null)}
      />
      <Card className="shadow-xl rounded-xl border border-gray-200">
        <TableToolbar
          selectedItemIds={selectedItemIds}
          onBatchDeleteClick={() => setIsBatchDeleteConfirmOpen(true)}
          onBatchStatusChangeClick={handleOpenBatchStatusChangeDialog}
          onSequentialEditClick={startSequentialEdit}
          uniqueStoreNames={allStoreNames}
          selectedStore={selectedStore}
          onStoreChange={handleStoreChange}
          selectedStatusState={selectedStatus}
          onStatusChange={handleStatusChange}
          onExportClick={exportToExcel}
          onAddNewItemClick={() => handleOpenAddEditDialog(null)}
          currentItemsCount={items.length} // Items currently displayed on the page
          totalFilteredItemsCount={totalDbItems} // Total items matching filters in DB
        />
        <CardContent className="p-0">
          <ItemsTable
            itemsToDisplay={items}
            selectedItemIds={selectedItemIds}
            selectAllState={selectAllStateForCurrentPage}
            onSelectAll={handleSelectAllCurrentPage}
            onSelectItem={handleSelectItem}
            onRequestSort={requestSort}
            getSortIcon={getSortIcon}
            onEditItem={handleOpenAddEditDialog}
            onDeleteItem={openSingleDeleteConfirmDialog}
            isLoading={isLoading}
            totalDbItems={totalDbItems} // Pass the filtered total from server
            selectedStore={selectedStore}
            selectedStatus={selectedStatus}
          />
        </CardContent>
        {/* Only show pagination if there are pages to paginate */}
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
        editingItem={editingItem} // This will be the current item in sequence or the item being edited
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
            정말로{" "}
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
            <strong className="font-medium">{selectedItemIds.length}개</strong>{" "}
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
