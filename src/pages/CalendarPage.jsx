// src/pages/CalendarPage.jsx
// -----------------------------------------------------------------------------
// Student Calendar Page (Google Calendar–like)
// - Month / Week views
// - Left: calendar grid with events & tasks (tasks span start->due)
// - Right: agenda list + task summary
// - Recurrence: none | daily | weekly | monthly | weekdays | weekends
// - Overdue tasks highlighted in red (bg-red/ text-red)
// - Theming: emerald / zinc / black, animated, responsive
// -----------------------------------------------------------------------------


import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Calendar as CalendarIcon,
  BookOpen,
  ListTodo,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit,
  Trash,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
  isBefore,
  isAfter,
  differenceInCalendarDays,
} from "date-fns";

// -----------------------------------------------------------------------------
// Helpers & Theme
// -----------------------------------------------------------------------------
const EVENT_COLORS = {
  assignment: { bg: "bg-emerald-600/20", text: "text-emerald-300", border: "border-emerald-600" },
  task: { bg: "bg-sky-600/20", text: "text-sky-300", border: "border-sky-600" },
  exam: { bg: "bg-rose-600/20", text: "text-rose-300", border: "border-rose-600" },
  meeting: { bg: "bg-violet-600/20", text: "text-violet-300", border: "border-violet-600" },
  reminder: { bg: "bg-yellow-600/20", text: "text-yellow-300", border: "border-yellow-600" },
  default: { bg: "bg-zinc-700/20", text: "text-zinc-200", border: "border-zinc-700" },
  overdue: { bg: "bg-red-600/20", text: "text-red-400", border: "border-red-600" },
};

function eventStyle(e, isOverdue = false) {
  if (isOverdue) return EVENT_COLORS.overdue;
  return EVENT_COLORS[e?.event_type] || EVENT_COLORS.default;
}

function safeParseDate(d) {
  if (!d) return null;
  try {
    return typeof d === "string" ? parseISO(d) : new Date(d);
  } catch (err) {
    return new Date(d);
  }
}

function truncate(s, n = 60) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// For recurrence weekly matching: map weekdays
const WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function asISODateString(d) {
  if (!d) return null;
  return new Date(d).toISOString();
}

// Given a date-like, return midnight start of day Date object
function startOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// -----------------------------------------------------------------------------
// Expand student tasks into occurrences within a window (start..end)
// Supports recurrence_type: none|daily|weekly|monthly|weekdays|weekends
// recurrence_days (optional): array of weekday strings e.g. ['mon','wed']
// -----------------------------------------------------------------------------
function expandTaskOccurrences(task, windowStart, windowEnd) {
  // returns array of objects: { ...task, occurrence_date: Date, isOverdue }
  // if task has start_date and due_date, include all days between inclusive
  const occurrences = [];
  const now = new Date();

  const tStart = task.start_date ? safeParseDate(task.start_date) : null;
  const tDue = task.due_date ? safeParseDate(task.due_date) : null;

  // Helper to push a given date (occurrence)
  function pushIfInWindow(date) {
    const d = startOfDayLocal(date);
    if ((isBefore(d, startOfDayLocal(windowStart)) && !isSameDay(d, windowStart)) ) return;
    if (isAfter(d, endOfDayLocal(windowEnd))) return;
    const isOverdue = tDue ? (isBefore(tDue, now) && task.status !== "completed") : false;
    occurrences.push({
      ...task,
      occurrence_date: d,
      isOverdue,
    });
  }

  // If both start and due exist and recurrence is none: span each date
  if ((tStart || tDue) && (!task.recurrence_type || task.recurrence_type === "none")) {
    // if only due present, treat start as due (single day)
    const s = tStart ? startOfDayLocal(tStart) : tDue ? startOfDayLocal(tDue) : null;
    const e = tDue ? startOfDayLocal(tDue) : s;
    if (!s || !e) return occurrences;
    const totalDays = differenceInCalendarDays(e, s);
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(s, i);
      if (!isBefore(d, startOfDayLocal(windowStart)) || isSameDay(d, windowStart)) {
        if (!isAfter(d, endOfDayLocal(windowEnd))) pushIfInWindow(d);
      }
    }
    return occurrences;
  }

  // With recurrence
  const recType = (task.recurrence_type || "none").toLowerCase();

  // If recurrence_days provided use it (text array), convert to lowercase weekday names
  const recDays = (task.recurrence_days || []).map((r) => String(r).toLowerCase());

  // Choose a start scanning date: earliest of task.start_date or windowStart
  const scanStart = tStart ? startOfDayLocal(tStart) : startOfDayLocal(windowStart);
  const scanFrom = isBefore(scanStart, startOfDayLocal(windowStart)) ? startOfDayLocal(windowStart) : scanStart;
  const scanEnd = endOfDayLocal(windowEnd);

  // We will limit scanning to reasonable amount: up to 365 days from scanFrom (prevent runaway)
  const MAX_DAYS = 365;

  for (let i = 0; i <= MAX_DAYS; i++) {
    const d = addDays(scanFrom, i);
    if (isAfter(d, scanEnd)) break;

    // Now decide if d is an occurrence for this recurrence pattern
    let include = false;
    if (recType === "daily") {
      include = true;
    } else if (recType === "weekly") {
      // If recurrence_days specified, use that to include only those weekdays; otherwise include same weekday as start_date (or today if none)
      if (recDays.length > 0) {
        include = recDays.includes(WEEKDAY_ORDER[d.getDay()]);
      } else if (tStart) {
        include = d.getDay() === startOfDayLocal(tStart).getDay();
      } else {
        include = true; // fallback
      }
    } else if (recType === "monthly") {
      // include if day-of-month matches start_date.day
      if (tStart) {
        include = d.getDate() === startOfDayLocal(tStart).getDate();
      } else {
        include = d.getDate() === (new Date()).getDate();
      }
    } else if (recType === "weekdays") {
      include = d.getDay() >= 1 && d.getDay() <= 5;
    } else if (recType === "weekends") {
      include = d.getDay() === 0 || d.getDay() === 6;
    } else {
      // none / unknown
      include = false;
    }

    // if include, push (but if the task also has a due_date window, ensure we respect that)
    if (include) {
      // If task has a due_date range (start->due), ensure d falls between start and due if both present
      if (tStart && tDue) {
        if (isBefore(d, startOfDayLocal(tStart)) || isAfter(d, startOfDayLocal(tDue))) {
          // skip - out of task window
        } else {
          pushIfInWindow(d);
        }
      } else {
        // no range to check, just push
        pushIfInWindow(d);
      }
    }
  }

  return occurrences;
}

// Returns endOfDay local
function endOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Given tasks array and window: expand each task into occurrences (task occurrences might be many)
function expandTasksForWindow(tasksArr, windowStart, windowEnd) {
  const all = [];
  for (const t of tasksArr) {
    const occ = expandTaskOccurrences(t, windowStart, windowEnd);
    for (const o of occ) all.push(o);
  }
  return all;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function CalendarPage() {
  // Data
  const [courses, setCourses] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandedTaskOccurrences, setExpandedTaskOccurrences] = useState([]);
  const [userId, setUserId] = useState(null);

  // UI state
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialogs / forms
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    event_type: "reminder",
    start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    all_day: false,
    visibility: "private",
    course_id: "private",
  });

  const topRef = useRef(null);

  // Load initial data
  useEffect(() => {
    fetchUser();
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchWindowData(currentDate);
  }, [currentDate, view]);

  async function fetchUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error(error);
    } else {
      setUserId(data?.user?.id || null);
    }
  }

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id, title");
      if (error) throw error;
      setCourses(data?.map((c) => ({ ...c, id: String(c.id) })) || []);
    } catch (err) {
      console.error("fetchCourses", err);
      toast.error("Failed to load courses");
    }
  }

  async function fetchWindowData(dateRef) {
    setLoading(true);
    try {
      let start, end;
      if (view === "month") {
        start = startOfWeek(startOfMonth(dateRef), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(dateRef), { weekStartsOn: 0 });
      } else {
        start = startOfWeek(dateRef, { weekStartsOn: 0 });
        end = endOfWeek(dateRef, { weekStartsOn: 0 });
      }

      // Fetch events
      const { data: ev, error: evErr } = await supabase
        .from("calendar_events")
        .select("*, courses(title)")
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: true });

      if (evErr) throw evErr;

      // Fetch tasks in a slightly wider window to catch recurring that started earlier
      const windowStartForTasks = addDays(start, -7);
      const windowEndForTasks = addDays(end, 7);

      const { data: ts, error: tsErr } = await supabase
        .from("student_tasks")
        .select("*")
        .gte("due_date", windowStartForTasks.toISOString())
        .lte("due_date", windowEndForTasks.toISOString())
        .order("due_date", { ascending: true });

      if (tsErr) throw tsErr;

      const normalizedEvents = (ev || []).map((e) => ({
        ...e,
        course_id: e.course_id ? String(e.course_id) : "private",
        start_date_obj: safeParseDate(e.start_date),
        end_date_obj: safeParseDate(e.end_date) || safeParseDate(e.start_date),
      }));

      const normalizedTasks = (ts || []).map((t) => ({
        ...t,
        start_date_obj: t.start_date ? safeParseDate(t.start_date) : null,
        due_date_obj: t.due_date ? safeParseDate(t.due_date) : null,
      }));

      setEvents(normalizedEvents);
      setTasks(normalizedTasks);

      // Expand tasks into occurrences within visible window (start..end)
      const occs = expandTasksForWindow(normalizedTasks, start, end);
      setExpandedTaskOccurrences(occs);
    } catch (err) {
      console.error("fetchWindowData", err);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  const refresh = async () => {
    await fetchWindowData(currentDate);
  };

  // Derived: days grid
  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, view]);

  // Filters
  const filteredEvents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return events.filter((e) => {
      if (selectedCourse && selectedCourse !== "all") {
        if (String(e.course_id) !== String(selectedCourse)) return false;
      }
      if (!q) return true;
      return (e.title || "").toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q);
    });
  }, [events, selectedCourse, search]);

  // For tasks we filter on expandedTaskOccurrences (occurrences), not original tasks
  const filteredTaskOccurrences = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return expandedTaskOccurrences.filter((occ) => {
      if (!q) return true;
      return (occ.title || "").toLowerCase().includes(q) || (occ.description || "").toLowerCase().includes(q);
    });
  }, [expandedTaskOccurrences, search]);

  // Agenda for selected date: merge events (that fall on that day) + task occurrences on that day
  function onSelectDay(day) {
    setSelectedDate(day);
    setTimeout(() => topRef.current?.scrollIntoView?.({ behavior: "smooth" }), 120);
  }

  const agendaItems = useMemo(() => {
    const dayEvents = filteredEvents.filter((e) => isSameDay(e.start_date_obj, selectedDate) || isSameDay(e.end_date_obj, selectedDate));
    const dayTasks = filteredTaskOccurrences.filter((t) => isSameDay(t.occurrence_date, selectedDate));
    const evs = dayEvents.map((e) => ({ ...e, _kind: "event" }));
    const tsk = dayTasks.map((t) => ({ ...t, _kind: "task" }));
    // Sort events by start time, tasks after events
    return [...evs.sort((a, b) => a.start_date_obj - b.start_date_obj), ...tsk];
  }, [filteredEvents, filteredTaskOccurrences, selectedDate]);

  // Create / Update / Delete event functions (unchanged behavior, but we ensure created_by included)
  async function handleCreateEvent() {
    if (!draft.title?.trim()) {
      toast.error("Please add a title");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        event_type: draft.event_type || "reminder",
        start_date: draft.start_date ? new Date(draft.start_date).toISOString() : new Date().toISOString(),
        end_date: draft.end_date ? new Date(draft.end_date).toISOString() : new Date(draft.start_date || new Date()).toISOString(),
        all_day: !!draft.all_day,
        visibility: draft.visibility || "private",
        course_id: draft.course_id && draft.course_id !== "private" ? draft.course_id : null,
        created_by: userId,
      };
      const { data, error } = await supabase.from("calendar_events").insert([payload]).select("*").single();
      if (error) throw error;
      const added = {
        ...data,
        course_id: data.course_id ? String(data.course_id) : "private",
        start_date_obj: safeParseDate(data.start_date),
        end_date_obj: safeParseDate(data.end_date),
      };
      setEvents((p) => [added, ...p]);
      toast.success("Event created");
      setShowAdd(false);
      resetDraft();
    } catch (err) {
      console.error("create event err", err);
      // If row-level security prevents insert you'll see 42501; surface a friendly message
      if (err?.message?.includes("row-level security")) {
        toast.error("Unable to create event due to database permissions (RLS).");
      } else {
        toast.error("Failed to create event");
      }
    } finally {
      setLoading(false);
    }
  }

  function resetDraft() {
    setDraft({
      title: "",
      description: "",
      event_type: "reminder",
      start_date: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
      end_date: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
      all_day: false,
      visibility: "private",
      course_id: "private",
    });
  }

  async function handleDeleteEvent(ev) {
    if (!ev?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", ev.id);

      if (error) throw error;

      setEvents((p) => p.filter((x) => x.id !== ev.id));
      setShowDetail(false);
      toast.success("Event deleted");
    } catch (err) {
      console.error("delete event err", err);
      if (err?.message?.includes("row-level security")) {
        toast.error("Unable to delete event due to database permissions (RLS).");
      } else {
        toast.error("Failed to delete event");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateEvent(evId, changes) {
    setLoading(true);
    try {
      const payload = { ...changes };
      if (payload.start_date) payload.start_date = new Date(payload.start_date).toISOString();
      if (payload.end_date) payload.end_date = new Date(payload.end_date).toISOString();
      const { data, error } = await supabase.from("calendar_events").update(payload).eq("id", evId).select("*").single();
      if (error) throw error;
      setEvents((p) => p.map((x) => (x.id === evId ? { ...data, start_date_obj: safeParseDate(data.start_date), end_date_obj: safeParseDate(data.end_date) } : x)));
      toast.success("Event updated");
      setShowDetail(false);
    } catch (err) {
      console.error("update event err", err);
      if (err?.message?.includes("row-level security")) {
        toast.error("Unable to update event due to database permissions (RLS).");
      } else {
        toast.error("Failed to update event");
      }
    } finally {
      setLoading(false);
    }
  }

  // Navigation helpers
  const goPrev = () => setCurrentDate((d) => (view === "month" ? subMonths(d, 1) : addDays(d, -7)));
  const goNext = () => setCurrentDate((d) => (view === "month" ? addMonths(d, 1) : addDays(d, 7)));
  const goToday = () => {
    setSelectedDate(new Date());
    setCurrentDate(new Date());
  };

  // UI helpers
  const dayHasEvents = (day) => filteredEvents.some((e) => isSameDay(e.start_date_obj, day) || isSameDay(e.end_date_obj, day));
  const dayHasTasks = (day) => filteredTaskOccurrences.some((t) => isSameDay(t.occurrence_date, day));

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1B1E] via-[#1a1a1a] to-[#000000] text-slate-100">
      {/* Header */}
      <motion.header initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-40 bg-black/40 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="rounded-full bg-emerald-900/40 p-2">
              <CalendarIcon className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-emerald-300">Calendar</h1>
              <div className="text-xs text-zinc-400">Assignments • Tasks • private events</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <div className="hidden md:flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-2 py-1">
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goToday}>Today</Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
              <Separator orientation="vertical" className="mx-2 bg-zinc-700" />
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v || "all")}>
                <SelectTrigger className="w-48 bg-zinc-900/60 border border-zinc-700 cursor-pointer">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                  <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                  {courses.map((c) => (
                    <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile toolbar (visible on small screens) */}
            <div className="flex md:hidden items-center gap-2 w-full">
              <div className="flex gap-1 items-center">
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goToday}>Today</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v || "all")}>
                <SelectTrigger className="ml-2 bg-zinc-900/60 border border-zinc-700 cursor-pointer w-full">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                  <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                  {courses.map((c) => (
                    <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-0 sm:ml-2 flex items-center gap-2 w-full sm:w-96 mt-2 sm:mt-0">
              <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900/60 border border-zinc-700" />
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => setShowAdd(true)}>
                <PlusCircle className="w-4 h-4 mr-2 inline-block" /> Add Event
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Calendar grid */}
        <section className="md:col-span-2">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
                <CardTitle className="text-emerald-300">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">
                      {view === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
                    </div>
                    <div className="text-xs text-zinc-400">• {view === "month" ? "Month view" : "Week view"}</div>
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={view === "month" ? "default" : "outline"} className={`cursor-pointer hover:bg-emerald-400 ${view === "month" ? "bg-emerald-500 text-black" : "border-zinc-700"}`} onClick={() => setView("month")}>Month</Button>
                  <Button size="sm" variant={view === "week" ? "default" : "outline"} className={`cursor-pointer ${view === "week" ? "bg-emerald-500 text-black" : "border-zinc-700"}`} onClick={() => setView("week")}>Week</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-400 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
              </div>

              {/* Make the grid horizontally scrollable on small screens; on larger screens it will fit */}
              <div className="overflow-x-auto -mx-4 px-4">
                {/* Provide a min width so columns align as a 7-column month grid; small screens can horizontally scroll */}
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => {
                      // Count events and task occurrences for this day
                      const dayEventCount = filteredEvents.filter((e) => isSameDay(e.start_date_obj, day) || isSameDay(e.end_date_obj, day)).length;
                      const dayTaskOccs = filteredTaskOccurrences.filter((t) => isSameDay(t.occurrence_date, day));
                      const dayTaskCount = dayTaskOccs.length;
                      const todayFlag = isToday(day);
                      const selectedFlag = isSameDay(day, selectedDate);

                      return (
                        <motion.div key={day.toISOString()}
                          layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.01 }}
                          onClick={() => onSelectDay(day)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedFlag ? "bg-emerald-900/60 border-emerald-600" : todayFlag ? "bg-emerald-600/20 border-emerald-400" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"}`}>
                          <div className="flex items-start justify-between">
                            <div className={`text-base font-semibold ${todayFlag ? "text-emerald-300" : "text-slate-100"}`}>{format(day, "d")}</div>
                            {todayFlag && <Badge className="bg-emerald-400 text-black px-2">Today</Badge>}
                          </div>

                          <div className="mt-3 space-y-1">
                            {/* Events (same as before) */}
                            {filteredEvents.filter((e) => isSameDay(e.start_date_obj, day) || isSameDay(e.end_date_obj, day)).slice(0, 3).map((e) => {
                              const st = eventStyle(e);
                              return (
                                <div key={e.id} className={`rounded px-2 py-0.5 text-xs truncate ${st.bg} ${st.text} border ${st.border}`} title={e.title}>
                                  <div className="flex items-center gap-2">
                                    <Circle className="w-3 h-3" />
                                    <div className="truncate">{truncate(e.title, 28)}</div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Tasks: render occurrences for this day. overdue tasks get red style */}
                            {dayTaskOccs.slice(0, 3).map((t) => {
                              const st = eventStyle({ event_type: "task" }, !!t.isOverdue);
                              return (
                                <div key={`${t.id}-${format(t.occurrence_date, "yyyyMMdd")}`} className={`rounded px-2 py-0.5 text-xs truncate ${st.bg} ${st.text} border ${st.border}`} title={t.title}>
                                  <div className="flex items-center gap-2">
                                    <ListTodo className="w-3 h-3" />
                                    <div className="truncate">{truncate(t.title, 28)}</div>
                                  </div>
                                </div>
                              );
                            })}

                            {(dayEventCount + dayTaskCount) > 3 && <div className="text-xs text-zinc-400">+{(dayEventCount + dayTaskCount) - 3} more</div>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-400">Click a day to view agenda on right. Assignments auto-appear.</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer" onClick={refresh}>Refresh</Button>
                <Button size="sm" variant="ghost" className="cursor-pointer bg-emerald-500 hover:bg-emerald-400" onClick={() => setCurrentDate(new Date())}>Today</Button>
              </div>
            </CardFooter>
          </Card>
        </section>

        {/* Right: Agenda + Tasks */}
        <aside ref={topRef} className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">Agenda</div>
              <div className="text-lg font-semibold text-emerald-300">{format(selectedDate, "EEEE, MMM d")}</div>
              <div className="text-xs text-zinc-400 mt-1">{agendaItems.length} items</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => setShowAdd(true)}>
                  <PlusCircle className="w-4 h-4 mr-1" /> Add
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={() => { setSelectedDate(new Date()); setCurrentDate(new Date()); }}>
                  Today
                </Button>
              </div>
              <div className="text-xs text-zinc-400">Filters: <span className="text-emerald-300 font-medium">{selectedCourse === "all" ? "All courses" : selectedCourse === "private" ? "Private" : (courses.find(c => c.id === selectedCourse)?.title || "Course")}</span></div>
            </div>
          </div>

          {/* Agenda List */}
          <Card className="bg-zinc-900/60 border  overflow-auto  border-zinc-800 rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Events & Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[360px]  pr-2">
                <div className="space-y-3">
                  {loading && <div className="text-zinc-400 text-sm">Loading...</div>}
                  {!loading && agendaItems.length === 0 && <div className="text-zinc-500 text-sm">No items for this date</div>}
                  {!loading && agendaItems.map((it) => {
                    if (it._kind === "task") {
                      // it is an occurrence object (has occurrence_date and isOverdue)
                      const overdueStyle = it.isOverdue;
                      const st = eventStyle({ event_type: "task" }, overdueStyle);
                      return (
                        <motion.div key={`task-${it.id}-${format(it.occurrence_date, "yyyyMMdd")}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`p-3 rounded-md border ${st.border} ${st.bg}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className={`text-sm font-semibold ${st.text}`}>{it.title}</div>
                              <div className="text-xs text-zinc-400">{it.description ? truncate(it.description, 80) : "No description"}</div>
                              <div className="text-xs text-zinc-500 mt-1">Due: {it.due_date ? format(safeParseDate(it.due_date), "PPP p") : "No due date"}</div>
                              <div className="text-xs text-zinc-500 mt-1">Occurrence: {format(it.occurrence_date, "PPP")}</div>
                              {it.recurrence_type && it.recurrence_type !== "none" && <div className="text-xs text-zinc-400 mt-1">Repeats: <span className="text-emerald-300">{it.recurrence_type}</span></div>}
                            </div>
                            <div className="text-xs text-zinc-400">{it.status}</div>
                          </div>
                        </motion.div>
                      );
                    } else {
                      const st = eventStyle(it);
                      return (
                        <motion.div key={`ev-${it.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-zinc-800/60 rounded-md border border-zinc-700">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`rounded px-2 py-0.5 text-xs ${st.bg} ${st.text} border ${st.border}`}>{it.event_type}</div>
                                <div className="text-sm font-semibold text-emerald-200 truncate">{it.title}</div>
                              </div>
                              <div className="text-xs text-zinc-400 mt-1">{it.description ? truncate(it.description, 120) : "No description"}</div>
                              <div className="text-xs text-zinc-500 mt-2">When: {it.start_date_obj ? format(it.start_date_obj, "PPP p") : "—"} {it.all_day ? "• All day" : ""}</div>
                              <div className="text-xs text-zinc-500 mt-1">Course: <span className="text-emerald-300 font-medium">{it.courses?.title || "Private"}</span></div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex gap-2">
                                {it.created_by === userId && (
                                  <>
                                    <Button size="sm" className="cursor-pointer border border-zinc-700" onClick={() => { setDetailEvent(it); setShowDetail(true); }}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="cursor-pointer"
                                        >
                                          <Trash className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete <span className="text-emerald-300 font-medium">{it.title}</span>?
                                            This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="bg-zinc-800 border border-zinc-700 text-slate-200 cursor-pointer">
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteEvent(it)}
                                            className="bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                              <div className="text-xs text-zinc-400">{it.visibility}</div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Tasks summary */}
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2"><ListTodo className="w-4 h-4" /> Tasks (this range)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredTaskOccurrences.length === 0 && <div className="text-zinc-500 text-sm">No tasks in range</div>}
                {filteredTaskOccurrences.slice(0, 6).map((t) => {
                  const overdueStyle = t.isOverdue;
                  const st = eventStyle({ event_type: "task" }, overdueStyle);
                  return (
                    <div key={`${t.id}-${format(t.occurrence_date, "yyyyMMdd")}`} className={`flex items-center justify-between p-2 rounded-md border ${st.border} ${st.bg}`}>
                      <div>
                        <div className={`text-sm font-semibold ${st.text}`}>{t.title}</div>
                        <div className="text-xs text-zinc-400">{t.description ? truncate(t.description, 80) : "No description"}</div>
                      </div>
                      <div className="text-xs text-zinc-400">{t.due_date ? format(safeParseDate(t.due_date), "MMM d") : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="w-full max-w-2xl bg-black border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-300">Add Private Event</h3>
                  <div className="text-xs text-zinc-400">Events you create are private by default.</div>
                </div>
                <div>
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setShowAdd(false)}>Close</Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} className="bg-zinc-900 border border-zinc-700" />
                <Textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))} className="bg-zinc-900 border border-zinc-700" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={draft.event_type} onValueChange={(v) => setDraft(d => ({ ...d, event_type: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700 cursor-pointer">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">
                      <SelectItem className="cursor-pointer" value="reminder">Reminder</SelectItem>
                      <SelectItem className="cursor-pointer" value="task">Task</SelectItem>
                      <SelectItem className="cursor-pointer" value="assignment">Assignment</SelectItem>
                      <SelectItem className="cursor-pointer" value="exam">Exam</SelectItem>
                      <SelectItem className="cursor-pointer" value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draft.course_id || "private"} onValueChange={(v) => setDraft(d => ({ ...d, course_id: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700 cursor-pointer">
                      <SelectValue placeholder="Course (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">
                      <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                      {courses.map((c) => <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

               <div className="grid grid-cols-2 gap-4">
                {/* Start Date & Time */}
                <div className="space-y-2">
                    <Label className="text-slate-300">Start</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-zinc-900 border-zinc-700 cursor-pointer"
                        >
                        {draft.start_date
                            ? format(new Date(draft.start_date), "PPP")
                            : "Pick start date"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 bg-zinc-900 border border-zinc-700">
                        <Calendar
                        mode="single"
                        selected={draft.start_date ? new Date(draft.start_date) : undefined}
                        onSelect={(date) => {
                            if (date) {
                            // Preserve existing time
                            const old = draft.start_date ? new Date(draft.start_date) : new Date();
                            date.setHours(old.getHours(), old.getMinutes());
                            setDraft((d) => ({ ...d, start_date: date.toISOString() }));
                            }
                        }}
                        className="text-slate-200"
                        classNames={{
                            day: "w-9 h-9 p-0 text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300",
                            day_today: "bg-emerald-600/30 text-emerald-200 font-semibold",
                            day_selected: "bg-emerald-500 text-black",
                        }}
                        />
                    </PopoverContent>
                    </Popover>
                    <Input
                    type="time"
                    value={draft.start_date ? format(new Date(draft.start_date), "HH:mm") : ""}
                    onChange={(e) => {
                        const d = draft.start_date ? new Date(draft.start_date) : new Date();
                        const [h, m] = e.target.value.split(":").map(Number);
                        d.setHours(h, m);
                        setDraft((prev) => ({ ...prev, start_date: d.toISOString() }));
                    }}
                    className="bg-zinc-900 border-zinc-700 text-slate-200"
                    />
                </div>

                {/* End Date & Time */}
                <div className="space-y-2">
                    <Label className="text-slate-300">End</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-zinc-900 border-zinc-700 cursor-pointer"
                        >
                        {draft.end_date
                            ? format(new Date(draft.end_date), "PPP")
                            : "Pick end date"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 bg-zinc-900 border border-zinc-700">
                        <Calendar
                        mode="single"
                        selected={draft.end_date ? new Date(draft.end_date) : undefined}
                        onSelect={(date) => {
                            if (date) {
                            const old = draft.end_date ? new Date(draft.end_date) : new Date();
                            date.setHours(old.getHours(), old.getMinutes());
                            setDraft((d) => ({ ...d, end_date: date.toISOString() }));
                            }
                        }}
                        className="text-slate-200"
                        classNames={{
                            day: "w-9 h-9 p-0 text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300",
                            day_today: "bg-emerald-600/30 text-emerald-200 font-semibold",
                            day_selected: "bg-emerald-500 text-black",
                        }}
                        />
                    </PopoverContent>
                    </Popover>
                    <Input
                    type="time"
                    value={draft.end_date ? format(new Date(draft.end_date), "HH:mm") : ""}
                    onChange={(e) => {
                        const d = draft.end_date ? new Date(draft.end_date) : new Date();
                        const [h, m] = e.target.value.split(":").map(Number);
                        d.setHours(h, m);
                        setDraft((prev) => ({ ...prev, end_date: d.toISOString() }));
                    }}
                    className="bg-zinc-900 border-zinc-700 text-slate-200"
                    />
                </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2">
                  <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={handleCreateEvent} disabled={loading}>Save Event</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Dialog */}
      <AnimatePresence>
        {showDetail && detailEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="w-full max-w-2xl bg-black border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-300">{detailEvent.title}</h3>
                  <div className="text-xs text-zinc-400 mt-1">{detailEvent.courses?.title ? `Course: ${detailEvent.courses.title}` : "Private event"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="cursor-pointer border border-zinc-700" onClick={() => setShowDetail(false)}>Close</Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="text-sm text-zinc-200">{detailEvent.description || "No description"}</div>
                <div className="text-xs text-zinc-400">Type: <span className="text-emerald-300 font-medium">{detailEvent.event_type}</span></div>
                <div className="text-xs text-zinc-400">When: <span className="text-emerald-300 font-medium">{detailEvent.start_date_obj ? format(detailEvent.start_date_obj, "PPP p") : "—"}</span></div>
                <div className="text-xs text-zinc-400">Visibility: <span className="text-emerald-300 font-medium">{detailEvent.visibility}</span></div>
              </div>

              {/* Editable form */}
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <EditSection
                  event={detailEvent}
                  userId={userId}
                  courses={courses}
                  onClose={() => setShowDetail(false)}
                  onSave={async (changes) => {
                    await handleUpdateEvent(detailEvent.id, changes);
                  }}
                  onDelete={async () => {
                    await handleDeleteEvent(detailEvent);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -----------------------------------------------------------------------------
// EditSection component - inline editable form inside Detail Dialog
// -----------------------------------------------------------------------------
function EditSection({ event, userId, courses, onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: event.title || "",
    description: event.description || "",
    event_type: event.event_type || "reminder",
    start_date: event.start_date ? toDatetimeLocal(event.start_date) : toDatetimeLocal(new Date()),
    end_date: event.end_date ? toDatetimeLocal(event.end_date) : toDatetimeLocal(new Date()),
    visibility: event.visibility || "private",
    course_id: event.course_id && event.course_id !== "private" ? String(event.course_id) : "private",
    all_day: !!event.all_day,
  });
  const [saving, setSaving] = useState(false);

  // update local form if event changes (when dialog opens)
  useEffect(() => {
    setForm({
      title: event.title || "",
      description: event.description || "",
      event_type: event.event_type || "reminder",
      start_date: event.start_date ? toDatetimeLocal(event.start_date) : toDatetimeLocal(new Date()),
      end_date: event.end_date ? toDatetimeLocal(event.end_date) : toDatetimeLocal(new Date()),
      visibility: event.visibility || "private",
      course_id: event.course_id && event.course_id !== "private" ? String(event.course_id) : "private",
      all_day: !!event.all_day,
    });
    setEditing(false);
  }, [event]);

  const isOwner = event.created_by === userId;

  async function handleSave() {
    if (!isOwner) {
      toast.error("You can only edit events you created.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        event_type: form.event_type,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        visibility: form.visibility,
        all_day: !!form.all_day,
        course_id: form.course_id && form.course_id !== "private" ? form.course_id : null,
      };
      await onSave(payload);
      setEditing(false);
    } catch (err) {
      console.error("save edit err", err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isOwner) {
      toast.error("You can only delete events you created.");
      return;
    }
    const ok = confirm(`Delete "${event.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await onDelete();
    } catch (err) {
      console.error("delete err", err);
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      {!editing ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-300">View mode — switch to edit to modify fields.</div>
          <div className="flex items-center gap-2">
            {isOwner && <Button size="sm" onClick={() => setEditing(true)} className="cursor-pointer border border-zinc-700">Edit</Button>}
            <Button size="sm" variant="ghost" onClick={onClose} className="cursor-pointer">Close</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="bg-zinc-900 border border-zinc-700" placeholder="Title" />
          <Textarea value={form.description || ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="bg-zinc-900 border border-zinc-700" placeholder="Description" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.event_type} onValueChange={(v) => setForm(f => ({ ...f, event_type: v }))}>
              <SelectTrigger className="bg-zinc-900 border border-zinc-700 cursor-pointer">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                <SelectItem className="cursor-pointer" value="reminder">Reminder</SelectItem>
                <SelectItem className="cursor-pointer" value="task">Task</SelectItem>
                <SelectItem className="cursor-pointer" value="assignment">Assignment</SelectItem>
                <SelectItem className="cursor-pointer" value="exam">Exam</SelectItem>
                <SelectItem className="cursor-pointer" value="meeting">Meeting</SelectItem>
              </SelectContent>
            </Select>

            <Select value={form.course_id || "private"} onValueChange={(v) => setForm(f => ({ ...f, course_id: v }))}>
              <SelectTrigger className="bg-zinc-900 border border-zinc-700 cursor-pointer">
                <SelectValue placeholder="Course (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                {courses.map((c) => <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-zinc-900 border border-zinc-700" />
            <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-zinc-900 border border-zinc-700" />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" className="cursor-pointer text-black border border-zinc-700" onClick={() => { setEditing(false); }}>
              Cancel
            </Button>
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="destructive" className="cursor-pointer" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers: convert ISO to input-local datetime value
// -----------------------------------------------------------------------------
function toDatetimeLocal(dateLike) {
  try {
    const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().slice(0, 16);
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}
