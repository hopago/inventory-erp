"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction"; // EventResizeDoneArg comes from here
import listPlugin from "@fullcalendar/list";
import koLocale from "@fullcalendar/core/locales/ko";
import {
  EventInput,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  DatesSetArg,
  EventContentArg,
  EventApi,
} from "@fullcalendar/core";
import { EventResizeDoneArg } from "@fullcalendar/interaction"; // Correct import for EventResizeDoneArg
import { Toaster, toast } from "sonner"; // Import Sonner

// Define your event type
interface CalendarEventType {
  id: string;
  title: string;
  start: string | Date; // A valid event stored in DB should always have a start.
  // For forms, undefined might be an initial state before selection.
  end?: string | Date | null;
  allDay?: boolean;
  color?: string | null;
  description?: string | null;
  extendedProps?: {
    description?: string | null;
  };
}

// EventModal Props
interface EventModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  // eventData.start can be undefined initially for 'create' mode before user selects a date
  eventData: Partial<Omit<CalendarEventType, "start">> & {
    start?: string | Date;
  };
  onClose: () => void;
  onSave: (
    data:
      | (Omit<CalendarEventType, "id" | "start"> & { start: string })
      | CalendarEventType // Ensure start is string for API
  ) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

// EventModal Component (Consider moving to a separate file: components/calendar/EventModal.tsx)
const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  mode,
  eventData,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [palettePreference, setPalettePreference] = useState<"rich" | "simple">(
    "rich"
  );

  const richColors = [
    "#EF4444",
    "#F97316",
    "#EAB308",
    "#22C55E",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
  ];
  const simpleColors = ["#6B7280", "#71717A", "#A1A1AA", "#D4D4D8"];

  const toDatetimeLocalString = (
    dateInput: string | Date | undefined | null
  ): string => {
    if (!dateInput) return "";
    try {
      const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return localDate.toISOString().substring(0, 16);
    } catch {
      return "";
    }
  };

  useEffect(() => {
    setTitle(eventData.title || "");
    setDescription(
      eventData.extendedProps?.description || eventData.description || ""
    );
    setAllDay(eventData.allDay !== undefined ? eventData.allDay : true);
    // Handle potentially undefined eventData.start for new events
    setStartDate(toDatetimeLocalString(eventData.start));
    setEndDate(toDatetimeLocalString(eventData.end));
    setColor(
      eventData.color ||
        (palettePreference === "rich" ? richColors[0] : simpleColors[0])
    );
  }, [eventData, palettePreference]);

  if (!isOpen) return null;

  const generateAutoColor = () => {
    const selectedPalette =
      palettePreference === "rich" ? richColors : simpleColors;
    return selectedPalette[Math.floor(Math.random() * selectedPalette.length)];
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("일정명은 필수 항목입니다.");
      return;
    }
    if (!startDate) {
      toast.error("시작일시는 필수 항목입니다.");
      return;
    }
    if (!allDay && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("종료일시는 시작일시보다 빠를 수 없습니다.");
      return;
    }

    const finalColor = color || generateAutoColor();
    const submissionData: {
      id?: string;
      title: string;
      start: string;
      end?: string | null;
      allDay: boolean;
      color: string;
      description?: string;
    } = {
      title: title.trim(),
      start: new Date(startDate).toISOString(), // Ensure start is an ISO string
      allDay,
      color: finalColor,
      description: description.trim() || undefined,
    };

    if (!allDay && endDate) {
      submissionData.end = new Date(endDate).toISOString();
    } else {
      submissionData.end = null;
    }

    if (mode === "edit" && eventData.id) {
      submissionData.id = eventData.id;
    }
    onSave(
      submissionData as
        | (Omit<CalendarEventType, "id" | "start"> & { start: string })
        | CalendarEventType
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">
          {mode === "create" ? "새 일정 추가" : "일정 수정"}
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="modal-title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              일정명
            </label>
            <input
              type="text"
              id="modal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-sky-600 dark:focus:border-sky-600"
            />
          </div>
          <div
            className={`grid grid-cols-1 ${
              allDay && mode === "create" ? "md:grid-cols-1" : "md:grid-cols-2"
            } gap-4`}
          >
            <div>
              <label
                htmlFor="modal-startDate"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                시작일시
              </label>
              <input
                type="datetime-local"
                id="modal-startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-sky-600 dark:focus:border-sky-600"
              />
            </div>
            {!allDay && (
              <div>
                <label
                  htmlFor="modal-endDate"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  종료일시
                </label>
                <input
                  type="datetime-local"
                  id="modal-endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-sky-600 dark:focus:border-sky-600"
                />
              </div>
            )}
          </div>
          <div className="flex items-center mt-2">
            <input
              type="checkbox"
              id="modal-allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-600"
            />
            <label
              htmlFor="modal-allDay"
              className="ml-2 block text-sm text-slate-900 dark:text-slate-200"
            >
              하루 종일
            </label>
          </div>
          <div>
            <label
              htmlFor="modal-description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              설명 (업무 루틴 상세)
            </label>
            <textarea
              id="modal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-sky-600 dark:focus:border-sky-600"
            ></textarea>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label
              htmlFor="modal-color"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 self-center"
            >
              색상
            </label>
            <input
              type="color"
              id="modal-color"
              value={color || ""}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 border-none p-0 focus:ring-0 rounded"
            />
            <div className="text-sm text-slate-700 dark:text-slate-300 self-center">
              {" "}
              자동 생성 팔레트:{" "}
            </div>
            <select
              value={palettePreference}
              onChange={(e) =>
                setPalettePreference(e.target.value as "rich" | "simple")
              }
              className="px-2 py-1.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50"
            >
              <option value="rich">고급</option>
              <option value="simple">단조로움</option>
            </select>
            <button
              onClick={() => setColor(generateAutoColor())}
              className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200"
            >
              자동색상
            </button>
          </div>
        </div>
        <div className="mt-8 flex justify-end space-x-3">
          {mode === "edit" && onDelete && eventData.id && (
            <button
              onClick={() => onDelete(eventData.id!)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentCalendarViewRange, setCurrentCalendarViewRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const calendarRef = useRef<FullCalendar>(null); // Kept for potential future API usage

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedEventData, setSelectedEventData] =
    useState<Partial<CalendarEventType> | null>(null);

  const fetchEvents = useCallback(
    async (fetchRange: { start: Date; end: Date }) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/events?start=${fetchRange.start.toISOString()}&end=${fetchRange.end.toISOString()}`
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to fetch events: ${response.status} ${response.statusText}`,
            errorText
          );
          toast.error(`일정 로딩 실패: ${response.statusText || "서버 오류"}`);
          setEvents([]);
          return; // Important to return here
        }
        const dataFromApi: CalendarEventType[] = await response.json();
        const formattedEvents: EventInput[] = dataFromApi.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end ?? undefined,
          allDay: event.allDay,
          backgroundColor: event.color || undefined,
          borderColor: event.color || undefined,
          extendedProps: {
            description: event.description,
            ...event.extendedProps,
          },
        }));
        setEvents(formattedEvents);
      } catch (error) {
        console.error("Error processing fetched events:", error);
        toast.error(`일정 처리 중 오류: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleDatesSet = useCallback(
    (dateInfo: DatesSetArg) => {
      const newStart = dateInfo.start;
      const newEnd = dateInfo.end;
      if (
        !currentCalendarViewRange ||
        currentCalendarViewRange.start.getTime() !== newStart.getTime() ||
        currentCalendarViewRange.end.getTime() !== newEnd.getTime()
      ) {
        setCurrentCalendarViewRange({ start: newStart, end: newEnd });
        fetchEvents({ start: newStart, end: newEnd });
      }
    },
    [fetchEvents, currentCalendarViewRange]
  );

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedEventData({
      start: selectInfo.start, // Date object
      end: selectInfo.end, // Date object
      allDay: selectInfo.allDay,
    });
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { event } = clickInfo;
    setSelectedEventData({
      id: event.id,
      title: event.title,
      start: event.start ?? undefined, // Date object from FullCalendar Event API
      end: event.end, // Date object or null
      allDay: event.allDay,
      color: event.backgroundColor || event.borderColor,
      description: event.extendedProps?.description ?? "",
      extendedProps: event.extendedProps,
    });
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const updateEventAfterInteraction = useCallback(
    async (
      eventApi: EventApi,
      revert: () => void,
      interactionType: "drop" | "resize"
    ) => {
      if (!eventApi.start) {
        console.error(
          `Event start date is null in ${interactionType}. Reverting.`
        );
        revert();
        return;
      }
      const updatedEventPayload = {
        start: eventApi.start.toISOString(),
        end: eventApi.end ? eventApi.end.toISOString() : null,
        allDay: eventApi.allDay,
      };

      try {
        const response = await fetch(`/api/events/${eventApi.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEventPayload),
        });
        if (!response.ok) {
          revert();
          const errorData = await response.json();
          toast.error(
            `업데이트 실패: ${
              errorData.error || `일정 업데이트 중 오류 (${interactionType}).`
            }`
          );
          return;
        }
        toast.success("일정이 업데이트되었습니다.");
        if (currentCalendarViewRange) fetchEvents(currentCalendarViewRange);
      } catch (error) {
        revert();
        console.error(
          `Error on event ${interactionType} for event ID ${eventApi.id}:`,
          error
        );
        toast.error(`업데이트 중 오류: ${(error as Error).message}`);
      }
    },
    [fetchEvents, currentCalendarViewRange]
  );

  const handleEventDrop = useCallback(
    (dropInfo: EventDropArg) => {
      updateEventAfterInteraction(dropInfo.event, dropInfo.revert, "drop");
    },
    [updateEventAfterInteraction]
  );

  const handleEventResize = useCallback(
    (resizeInfo: EventResizeDoneArg) => {
      updateEventAfterInteraction(
        resizeInfo.event,
        resizeInfo.revert,
        "resize"
      );
    },
    [updateEventAfterInteraction]
  );

  const handleModalSave = async (
    dataToSave:
      | (Omit<CalendarEventType, "id" | "start"> & { start: string })
      | CalendarEventType
  ) => {
    const isCreating = modalMode === "create";
    const method = isCreating ? "POST" : "PUT";
    const eventPayload = { ...dataToSave };
    const url = isCreating
      ? "/api/events"
      : `/api/events/${(eventPayload as CalendarEventType).id}`;

    if (isCreating && "id" in eventPayload) {
      delete (eventPayload as Partial<CalendarEventType>).id;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(
          `저장 실패: ${errorData.error || `Failed to ${modalMode} event.`}`
        );
        return;
      }
      toast.success(
        isCreating ? "일정이 추가되었습니다." : "일정이 수정되었습니다."
      );
      setIsModalOpen(false);
      setSelectedEventData(null);
      if (currentCalendarViewRange) fetchEvents(currentCalendarViewRange);
    } catch (error) {
      console.error(`Error saving event (${modalMode}):`, error);
      toast.error(`저장 중 오류: ${(error as Error).message}`);
    }
  };

  const handleModalDelete = async (eventId: string) => {
    if (!window.confirm("정말로 이 일정을 삭제하시겠습니까?")) return;
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(
          `삭제 실패: ${errorData.error || "Failed to delete event."}`
        );
        return;
      }
      toast.success("일정이 삭제되었습니다.");
      setIsModalOpen(false);
      setSelectedEventData(null);
      if (currentCalendarViewRange) fetchEvents(currentCalendarViewRange);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error(`삭제 중 오류: ${(error as Error).message}`);
    }
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    return (
      <div className="p-1 overflow-hidden leading-tight h-full flex flex-col justify-center fc-event-main-custom">
        <b
          className="text-xs font-semibold block truncate"
          title={eventInfo.event.title}
        >
          {eventInfo.event.title}
        </b>
        {eventInfo.event.extendedProps?.description && (
          <p
            className="text-[10px] sm:text-xs truncate opacity-80 mt-0.5"
            title={eventInfo.event.extendedProps.description as string}
          >
            {eventInfo.event.extendedProps.description}
          </p>
        )}
      </div>
    );
  };

  const calendarContainerStyle: React.CSSProperties = {
    height: "calc(100vh - 160px)", // Adjust buffer based on actual layout
    position: "relative",
  };

  // This useEffect for the initial fetch can be removed if datesSet reliably fires on mount
  // useEffect(() => {
  //   if (!currentCalendarViewRange && calendarRef.current) {
  //     const calendarApi = calendarRef.current.getApi();
  //     fetchEvents({ start: calendarApi.view.activeStart, end: calendarApi.view.activeEnd });
  //     setCurrentCalendarViewRange({ start: calendarApi.view.activeStart, end: calendarApi.view.activeEnd });
  //   }
  // }, [currentCalendarViewRange, fetchEvents]); // Removed: datesSet should handle initial load

  return (
    <div className="p-4 md:p-6 text-slate-800 dark:text-slate-200 min-h-screen">
      <Toaster position="top-right" richColors /> {/* Sonner Toaster */}
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
        업무 캘린더
      </h1>
      {/* Placeholder for Tailwind CSS for FullCalendar - needs to be in globals.css or similar */}
      {/* <style jsx global>{`
        // Basic Tailwind-like overrides for FullCalendar
        // This is a starting point. More detailed styling is needed.
        .fc .fc-button { @apply bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-3 rounded-md text-sm transition-colors shadow-sm; }
        .fc .fc-button-primary:disabled { @apply bg-slate-300 dark:bg-slate-700; }
        .fc .fc-toolbar-title { @apply text-xl font-bold text-slate-700 dark:text-slate-200; }
        .fc .fc-col-header-cell { @apply bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-2 font-semibold; }
        .fc .fc-daygrid-day { @apply border border-slate-200 dark:border-slate-700 cursor-pointer; }
        .fc .fc-daygrid-day:hover { @apply bg-slate-50 dark:bg-slate-800/50; }
        .fc .fc-day-today { @apply bg-sky-100 dark:bg-sky-900/40 !important; } // Important to override FC's inline style
        .fc .fc-daygrid-day-number { @apply p-1.5 text-sm text-slate-700 dark:text-slate-300; }
        .fc .fc-event { @apply border-none rounded shadow-md text-white text-xs p-0.5 m-px; }
        .fc-event-main-custom { @apply p-1; } // For custom rendered content
        .fc-theme-standard .fc-list-day-cushion { @apply bg-slate-100 dark:bg-slate-800; }
        .fc .fc-list-event:hover td { @apply bg-slate-50 dark:bg-slate-700/30; }

        // Ensure dark mode compatibility for icons and text within FC that might not inherit correctly
        .dark .fc .fc-icon, .dark .fc .fc-list-event-time, .dark .fc .fc-list-event-title {
            @apply text-slate-200;
        }
      `}</style> */}
      <div
        style={calendarContainerStyle}
        className="fc-wrapper bg-white dark:bg-slate-900 p-0 sm:p-2 md:p-4 rounded-lg shadow-lg"
      >
        {isLoading &&
          (!events || events.length === 0) &&
          currentCalendarViewRange && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-[500] rounded-lg">
              <p className="text-lg text-slate-500 dark:text-slate-400 flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-sky-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                캘린더 로딩 중...
              </p>
            </div>
          )}
        <FullCalendar
          key={
            currentCalendarViewRange
              ? `${currentCalendarViewRange.start.getFullYear()}-${currentCalendarViewRange.start.getMonth()}`
              : "initial-calendar"
          }
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          initialView="dayGridMonth"
          locales={[koLocale]}
          locale="ko"
          weekends={true}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          navLinks={true}
          datesSet={handleDatesSet}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={renderEventContent}
          height="100%"
          firstDay={0}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: false,
          }}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: false,
          }}
        />
      </div>
      {isModalOpen && selectedEventData && (
        <EventModal
          isOpen={isModalOpen}
          mode={modalMode}
          eventData={selectedEventData}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEventData(null);
          }}
          onSave={handleModalSave}
          onDelete={
            modalMode === "edit" && selectedEventData.id
              ? handleModalDelete
              : undefined
          }
        />
      )}
    </div>
  );
}
