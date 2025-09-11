// src/pages/TaskManagerPage.jsx
// Full-featured Task Manager (Grid + Kanban + Analytics + Inline edit)
// - Uses shadcn/ui components, framer-motion, lucide-react, date-fns, react-markdown, remark-gfm, recharts, supabase
// - Mobile-first, glassmorphic header, FAB, confetti, progress ring, drag/drop Kanban
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

import {
  PlusCircle,
  Edit,
  Trash,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Info,
  Filter,
  X,
  Eye,
  Grid,
  Columns,
  PieChart as PieIcon,
  BarChart2,
  Undo,
} from "lucide-react";

import { format, parseISO, isBefore } from "date-fns";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------------------------- Helpers ---------------------------------------
function toLocalInputValue(dateLike) {
  if (!dateLike) return "";
  try {
    const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
    const tzOffset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffset * 60000);
    return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  } catch {
    return "";
  }
}

function parseLocalInput(value) {
  if (!value) return null;
  return new Date(value);
}

function isOverdue(task) {
  if (!task?.due_date_obj) return false;
  if (task.status === "completed") return false;
  return isBefore(task.due_date_obj, new Date());
}

function weekdayLabel(day) {
  const map = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  return map[day] || day;
}

function recurrenceSummary(t) {
  if (!t || !t.recurrence_type || t.recurrence_type === "none") return "No recurrence";
  if (t.recurrence_type === "daily") return "Daily";
  if (t.recurrence_type === "weekly") {
    if (t.recurrence_days && t.recurrence_days.length) {
      return `Weekly (${t.recurrence_days.map(weekdayLabel).join(", ")})`;
    }
    return "Weekly";
  }
  if (t.recurrence_type === "monthly") return "Monthly";
  return t.recurrence_type;
}

// compute % progress from created_at -> due_date
function computeProgress(task) {
  if (!task) return 0;
  if (task.status === "completed") return 100;
  if (!task.due_date_obj || !task.created_at) return 0;
  try {
    const start = new Date(task.created_at).getTime();
    const end = task.due_date_obj.getTime();
    const now = Date.now();
    if (end <= start) return 0;
    const pct = Math.round(((now - start) / (end - start)) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  } catch {
    return 0;
  }
}

// tiny DOM confetti
function burstConfetti(x = window.innerWidth / 2, y = window.innerHeight / 2) {
  const colors = ["#16A34A", "#059669", "#84CC16", "#F97316", "#EF4444", "#06B6D4"];
  const count = 18;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "99999";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = "8px";
    el.style.height = "12px";
    el.style.background = colors[i % colors.length];
    el.style.opacity = "0.95";
    el.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
    el.style.borderRadius = "1px";
    el.style.willChange = "transform, opacity";
    container.appendChild(el);

    const angle = (Math.random() * Math.PI * 2);
    const dist = 60 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    el.animate([
      { transform: `translate(-50%, -50%)`, opacity: 1 },
      { transform: `translate(${dx - 50}px, ${dy - 50}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: 900 + Math.random() * 700,
      easing: "cubic-bezier(.17,.84,.44,1)",
      fill: "forwards"
    });

    setTimeout(() => el.remove(), 1800);
  }

  setTimeout(() => container.remove(), 2000);
}

// ---------------------------- Component -------------------------------------
export default function TaskManagerPage() {
  // core state
  const [userId, setUserId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("due_asc");
  const [viewMode, setViewMode] = useState("grid"); // grid | kanban | analytics
  const [filtersOpen, setFiltersOpen] = useState(false);

  // modals and edit
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // editing object, includes local datetime strings
  const [previewTask, setPreviewTask] = useState(null);

  // inline edit state
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: "" });

  // draft for add
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    start_date: "",
    due_date: "",
    priority: "medium",
    recurrence_type: "none",
    recurrence_days: [],
    notes: "",
    status: "pending",
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error("getUser", error);
        return;
      }
      const uid = user?.id || null;
      setUserId(uid);
      if (uid) fetchTasks(uid);
    })();
  }, []);

  async function fetchTasks(uid) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_tasks")
        .select("*")
        .eq("created_by", uid)
        .order("due_date", { ascending: true });

      if (error) throw error;

      const normalized = (data || []).map((t) => ({
        ...t,
        start_date_obj: t.start_date ? parseISO(t.start_date) : null,
        due_date_obj: t.due_date ? parseISO(t.due_date) : null,
        recurrence_days: t.recurrence_days || [],
      }));
      setTasks(normalized);
    } catch (err) {
      console.error("fetchTasks", err);
      toast.error("Unable to load tasks");
    } finally {
      setLoading(false);
    }
  }

  // sorting & filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (!q) return true;
      return (
        (t.title || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, filterStatus, filterPriority]);

  const sortedTasks = useMemo(() => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...filtered].sort((a, b) => {
      if (sortBy === "due_asc") {
        const prioDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (prioDiff !== 0) return prioDiff;
        const dateA = a.due_date_obj ? a.due_date_obj.getTime() : Infinity;
        const dateB = b.due_date_obj ? b.due_date_obj.getTime() : Infinity;
        return dateA - dateB;
      }
      if (sortBy === "due_desc") {
        const prioDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (prioDiff !== 0) return prioDiff;
        const dateA = a.due_date_obj ? a.due_date_obj.getTime() : -Infinity;
        const dateB = b.due_date_obj ? b.due_date_obj.getTime() : -Infinity;
        return dateB - dateA;
      }
      // created_desc
      const prioDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (prioDiff !== 0) return prioDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [filtered, sortBy]);

  // quick helpers for CRUD
  async function handleCreate() {
    if (!draft.title.trim()) {
      toast.error("Title required");
      return;
    }
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description || null,
        start_date: draft.start_date ? new Date(draft.start_date).toISOString() : null,
        due_date: draft.due_date ? new Date(draft.due_date).toISOString() : null,
        priority: draft.priority,
        recurrence_type: draft.recurrence_type,
        recurrence_days: draft.recurrence_days && draft.recurrence_days.length ? draft.recurrence_days : null,
        recurrence_meta: null,
        notes: draft.notes || null,
        status: draft.status,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("student_tasks")
        .insert([payload])
        .select("*")
        .single();

      if (error) throw error;

      const added = {
        ...data,
        start_date_obj: data.start_date ? parseISO(data.start_date) : null,
        due_date_obj: data.due_date ? parseISO(data.due_date) : null,
        recurrence_days: data.recurrence_days || [],
      };

      setTasks((p) => [added, ...p]);
      toast.success("Task added");
      setShowAdd(false);
      resetDraft();
    } catch (err) {
      console.error("create err", err);
      toast.error("Failed to add task (check RLS/policies)");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(taskId, changes) {
    setLoading(true);
    try {
      const payload = { ...changes };
      if (payload.start_date && typeof payload.start_date === "string" && payload.start_date.length) {
        const pDate = parseLocalInput(payload.start_date);
        if (pDate) payload.start_date = pDate.toISOString();
      }
      if (payload.due_date && typeof payload.due_date === "string" && payload.due_date.length) {
        const pDate = parseLocalInput(payload.due_date);
        if (pDate) payload.due_date = pDate.toISOString();
      }
      const { data, error } = await supabase
        .from("student_tasks")
        .update(payload)
        .eq("id", taskId)
        .select("*")
        .single();

      if (error) throw error;

      setTasks((p) => p.map((t) => (t.id === taskId ? {
        ...data,
        start_date_obj: data.start_date ? parseISO(data.start_date) : null,
        due_date_obj: data.due_date ? parseISO(data.due_date) : null,
        recurrence_days: data.recurrence_days || [],
      } : t)));
      toast.success("Saved");
      setEditing(null);
      setInlineEdit({ id: null, field: null, value: "" });
    } catch (err) {
      console.error("update err", err);
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(taskId) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("student_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      setTasks((p) => p.filter((t) => t.id !== taskId));
      toast.success("Deleted");
    } catch (err) {
      console.error("delete err", err);
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete(task, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      const next = task.status === "completed" ? "pending" : "completed";
      const { data, error } = await supabase
        .from("student_tasks")
        .update({ status: next })
        .eq("id", task.id)
        .select("*")
        .single();
      if (error) throw error;
      setTasks((p) => p.map((t) => (t.id === task.id ? {
        ...data,
        start_date_obj: data.start_date ? parseISO(data.start_date) : null,
        due_date_obj: data.due_date ? parseISO(data.due_date) : null,
        recurrence_days: data.recurrence_days || [],
      } : t)));
      toast.success(next === "completed" ? "Marked complete" : "Marked pending");
      if (next === "completed") {
        const x = (e && e.clientX) || window.innerWidth / 2;
        const y = (e && e.clientY) || window.innerHeight / 2;
        burstConfetti(x, y);
      }
    } catch (err) {
      console.error("toggleComplete", err);
      toast.error("Failed to update status");
    }
  }

  function resetDraft() {
    setDraft({
      title: "",
      description: "",
      start_date: "",
      due_date: "",
      priority: "medium",
      recurrence_type: "none",
      recurrence_days: [],
      notes: "",
      status: "pending",
    });
  }

  function openEdit(task) {
    setEditing({
      ...task,
      start_date: toLocalInputValue(task.start_date_obj),
      due_date: toLocalInputValue(task.due_date_obj),
      recurrence_days: task.recurrence_days || [],
    });
  }

  // Inline edit handlers
  function startInlineEdit(id, field, currentValue, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    setInlineEdit({ id, field, value: currentValue || "" });
  }
  function applyInlineEdit(task, field) {
    const changes = { [field]: inlineEdit.value };
    // if editing dates in inline mode, convert
    if (field === "due_date" || field === "start_date") {
      changes[field] = inlineEdit.value; // handle conversion on handleUpdate
    }
    handleUpdate(task.id, changes);
  }

  // Kanban drag/drop (native)
  function onDragStart(e, taskId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(taskId));
    // a11y
    if (e.dataTransfer.setDragImage) {
      const img = document.createElement("div");
      img.style.padding = "6px 8px";
      img.style.background = "#0f172a";
      img.style.color = "#e6fffa";
      img.style.borderRadius = "6px";
      img.style.fontSize = "12px";
      img.innerText = "Moving";
      document.body.appendChild(img);
      e.dataTransfer.setDragImage(img, 10, 10);
      setTimeout(() => img.remove(), 0);
    }
  }

  async function onDropToStatus(e, status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const task = tasks.find((t) => String(t.id) === String(id));
    if (!task) return;
    if (task.status === status) return;
    await handleUpdate(task.id, { status });
  }

  // analytics (recharts)
  const analyticsData = useMemo(() => {
    const total = tasks.length || 0;
    const byStatus = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    const pie = [
      { name: "Pending", value: byStatus.pending || 0, color: "#fbbf24" },
      { name: "In Progress", value: byStatus.in_progress || 0, color: "#60a5fa" },
      { name: "Completed", value: byStatus.completed || 0, color: "#34d399" },
      { name: "Snoozed", value: byStatus.snoozed || 0, color: "#94a3b8" },
    ];
    const byPriority = tasks.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    const bar = [
      { name: "High", count: byPriority.high || 0 },
      { name: "Medium", count: byPriority.medium || 0 },
      { name: "Low", count: byPriority.low || 0 },
    ];
    return { total, pie, bar };
  }, [tasks]);

  // UI pieces
  const weekdays = [
    { key: "mon", label: "Mon" },
    { key: "tue", label: "Tue" },
    { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" },
    { key: "fri", label: "Fri" },
    { key: "sat", label: "Sat" },
    { key: "sun", label: "Sun" },
  ];

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071b16] via-[#0b1211] to-[#000000] text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Sticky glass header */}
        <div className="sticky top-3 z-40">
          <div className="backdrop-blur-sm bg-zinc-900/40 border border-zinc-800 rounded-2xl p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start md:items-center gap-3">
              <div className="rounded-2xl p-3 bg-emerald-900/20 flex items-center justify-center">
                <CalendarIcon className="w-7 h-7 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-emerald-300 leading-tight">Task Manager</h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md">Manage tasks, deadlines, Kanban, and analytics — responsive & polished.</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900 border border-zinc-800 w-64 cursor-pointer" />

              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-44 cursor-pointer">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-36 cursor-pointer">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-40 cursor-pointer">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem value="due_asc">High → Soon</SelectItem>
                  <SelectItem value="due_desc">High → Later</SelectItem>
                  <SelectItem value="created_desc">Recently created</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 border border-zinc-800 rounded-md px-2 py-1">
                <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="cursor-pointer" onClick={() => setViewMode("grid")}><Grid className="w-4 h-4" /></Button>
                <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" className="cursor-pointer" onClick={() => setViewMode("kanban")}><Columns className="w-4 h-4" /></Button>
                <Button variant={viewMode === "analytics" ? "secondary" : "ghost"} size="sm" className="cursor-pointer" onClick={() => setViewMode("analytics")}><PieIcon className="w-4 h-4" /></Button>
              </div>

              <Button className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => { resetDraft(); setShowAdd(true); }}>
                <PlusCircle className="w-4 h-4 mr-2 inline" /> New Task
              </Button>
            </div>

            {/* mobile actions */}
            <div className="flex md:hidden items-center gap-2 justify-end">
              <Button variant="ghost" className="p-2 cursor-pointer" onClick={() => setFiltersOpen((v) => !v)} aria-label="Toggle filters">
                {filtersOpen ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
              </Button>
              <div className="flex items-center gap-2 bg-zinc-900/40 px-2 py-1 rounded-md border border-zinc-800">
                <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="cursor-pointer" onClick={() => setViewMode("grid")}><Grid className="w-4 h-4" /></Button>
                <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" className="cursor-pointer" onClick={() => setViewMode("kanban")}><Columns className="w-4 h-4" /></Button>
              </div>
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 cursor-pointer" onClick={() => { resetDraft(); setShowAdd(true); }}>
                <PlusCircle className="w-4 h-4 mr-2 inline" /> New
              </Button>
            </div>
          </div>

          {/* mobile filters */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3">
                <div className="backdrop-blur-sm bg-zinc-900/30 border border-zinc-800 rounded-2xl p-3 flex flex-col gap-3">
                  <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900 border border-zinc-800 cursor-pointer" />
                  <div className="flex gap-2">
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
                      <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full cursor-pointer">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100">
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="snoozed">Snoozed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v)}>
                      <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full cursor-pointer">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100">
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full cursor-pointer">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">
                      <SelectItem value="due_asc">High → Soon</SelectItem>
                      <SelectItem value="due_desc">High → Later</SelectItem>
                      <SelectItem value="created_desc">Recently created</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main content */}
        <div className="mt-6">
          {viewMode === "analytics" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                <h3 className="text-emerald-300 font-semibold mb-2">Overview</h3>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.bar} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ReTooltip
                       contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                      <Legend />
                      <Bar dataKey="count" name="Tasks" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
                    <h4 className="text-zinc-300 text-sm">Total tasks</h4>
                    <div className="text-2xl font-bold text-emerald-300">{analyticsData.total}</div>
                  </div>
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
                    <h4 className="text-zinc-300 text-sm">Completion</h4>
                    <div className="text-2xl font-bold  text-emerald-300">
                      {tasks.length ? Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                <h3 className="text-emerald-300 font-semibold mb-2">Status Distribution</h3>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analyticsData.pie} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8" label>
                        {analyticsData.pie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip
                       contentStyle={{
                          backgroundColor: "#50C878",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : viewMode === "kanban" ? (
            // Kanban view
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["pending", "in_progress", "completed"].map((col) => (
                <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropToStatus(e, col)} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-3 min-h-[300px]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-emerald-300">{col === "pending" ? "Pending" : col === "in_progress" ? "In Progress" : "Completed"}</h4>
                    <span className="text-xs text-zinc-400">{tasks.filter(t => t.status === col).length}</span>
                  </div>
                  <div className="space-y-3">
                    {sortedTasks.filter((t) => t.status === col).map((task) => {
                      const overdue = isOverdue(task);
                      const prioColor = task.priority === "high" ? "border-rose-500" : task.priority === "medium" ? "border-amber-500" : "border-emerald-500";
                      const prioBg = task.priority === "high" ? "bg-red-500/80" : task.priority === "medium" ? "bg-yellow-600/80" : "bg-emerald-400/80";
                      const progress = computeProgress(task);

                      return (
                        <motion.div
                          key={task.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, task.id)}
                          className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 ${prioColor} border-l-4 cursor-pointer`}
                          onClick={() => setPreviewTask(task)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`px-2 py-0.5 rounded text-xs font-semibold ${prioBg} text-slate-200 border border-zinc-700`}>
                                  {task.priority}
                                </div>
                                <h5 className="text-sm font-semibold truncate">{task.title}</h5>
                                {overdue && <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-rose-600 text-white">Overdue</span>}
                              </div>
                              <div className="text-xs text-zinc-400 mt-2 line-clamp-2">{task.description || "No description"}</div>
                              <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                <div>{task.due_date_obj ? format(task.due_date_obj, "PPP") : "No due"}</div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="w-10 h-10">
                                <svg viewBox="0 0 36 36" className="w-10 h-10">
                                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#0f172a" strokeWidth="3" />
                                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={task.status === "completed" ? "#16A34A" : (task.priority === "high" ? "#FB7185" : task.priority === "medium" ? "#F59E0B" : "#34D399")} strokeWidth="3" strokeDasharray={`${progress} ${100 - progress}`} strokeDashoffset="25" />
                                  <text x="50%" y="52%" textAnchor="middle" fontSize="7" fill="#cbd5e1" dy=".3em">{progress}%</text>
                                </svg>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewTask(task); }}><Eye className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="outline" className="text-emerald-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); openEdit(task); }}><Edit className="w-4 h-4" /></Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive" className="cursor-pointer" onClick={(e) => e.stopPropagation()}><Trash className="w-4 h-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-zinc-950 border border-zinc-800">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                        <AlertDialogDescription>Delete <span className="text-emerald-300 font-medium">{task.title}</span>?</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="cursor-pointer text-black">Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600 text-white cursor-pointer hover:bg-red-500" onClick={() => handleDelete(task.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>

                                <Button size="sm" className={`cursor-pointer hover:bg-emerald-400 ${task.status === "completed" ? "bg-zinc-800 border border-zinc-700" : "bg-emerald-500 text-black"}`} onClick={(e) => toggleComplete(task, e)}>
                                    
                                    
                                    {task.status === "completed" ? "Undo" : "Complete"}</Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Grid view
            <div>
              <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                {sortedTasks.map((task) => {
                  const overdue = isOverdue(task);
                  const prioColor = task.priority === "high" ? "border-rose-500" : task.priority === "medium" ? "border-amber-500" : "border-emerald-500";
                  const prioBg = task.priority === "high" ? "bg-red-500/80" : task.priority === "medium" ? "bg-yellow-600/80" : "bg-emerald-400/80";
                  const progress = computeProgress(task);

                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className={`p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between transform transition-transform hover:-translate-y-1 hover:scale-[1.01] cursor-default ${prioColor} border-l-4`} onClick={() => setPreviewTask(task)}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-0.5 rounded text-xs font-semibold ${prioBg} text-slate-200 border border-zinc-700`}>
                              {task.priority}
                            </div>

                            <h3 className={`text-sm font-semibold truncate ${task.status === "completed" ? "text-zinc-400 line-through" : "text-emerald-200"}`}>
                              {task.title}
                            </h3>

                            {overdue && <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-rose-600 text-white">Overdue</span>}
                            {task.status === "completed" && <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-emerald-400 text-black">Done</span>}
                          </div>

                          <div className="text-xs text-zinc-400 mt-2 line-clamp-3 break-words">{task.description || "No description"}</div>

                          <div className="mt-3 text-xs text-zinc-400 space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-zinc-400" />
                              <div>Start: <span className="text-emerald-300 font-medium">{task.start_date_obj ? format(task.start_date_obj, "PPP p") : "—"}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-zinc-400" />
                              <div>Due: <span className={`font-medium ${overdue ? "text-rose-300" : "text-emerald-300"}`}>{task.due_date_obj ? format(task.due_date_obj, "PPP p") : "—"}</span></div>
                            </div>
                            <div>Recurrence: <span className="text-emerald-300 font-medium">{recurrenceSummary(task)}</span></div>
                            <div className="text-xs text-zinc-500 mt-1">Created: {format(new Date(task.created_at), "PPP")}</div>
                          </div>
                        </div>

                        {/* right column */}
                        <div className="flex flex-col items-end gap-3">
                          <div className="w-12 h-12">
                            <svg viewBox="0 0 36 36" className="w-12 h-12">
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#0f172a" strokeWidth="4" />
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={task.status === "completed" ? "#16A34A" : (task.priority === "high" ? "#FB7185" : task.priority === "medium" ? "#F59E0B" : "#34D399")} strokeWidth="4" strokeDasharray={`${progress} ${100 - progress}`} strokeDashoffset="25" />
                              <text x="50%" y="52%" textAnchor="middle" fontSize="8" fill="#cbd5e1" dy=".3em">{progress}%</text>
                            </svg>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewTask(task); }}><Eye className="w-4 h-4" /></Button>

                              <Button size="sm" variant="outline" className="cursor-pointer text-emerald-400 hover:bg-emerald-500 hover:text-black" onClick={(e) => { e.stopPropagation(); openEdit(task); }}>
                                <Edit className="w-4 h-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" className="cursor-pointer" onClick={(e) => e.stopPropagation()}><Trash className="w-4 h-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-zinc-950 border border-zinc-800">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                    <AlertDialogDescription>Delete <span className="text-emerald-300 font-medium">{task.title}</span>?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="cursor-pointer text-black">Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500 cursor-pointer" onClick={() => handleDelete(task.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <Button size="sm" className={`cursor-pointer hover:bg-emerald-400 ${task.status === "completed" ? "bg-zinc-800 border border-zinc-700" : "bg-emerald-500 text-black"}`} onClick={(e) => toggleComplete(task, e)}>
                                <CheckCircle className="w-4 h-4 mr-1 inline" /> {task.status === "completed" ? "Undo" : "Complete"}
                              </Button>
                              <Button size="sm" variant="ghost" className="cursor-pointer text-zinc-300" onClick={(e) => { e.stopPropagation(); setPreviewTask(task); }}>
                                Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-zinc-400">Tip: switch to Kanban for drag & drop. Use inline edit by double-clicking fields in the grid (coming soon).</div>
      </div>

      {/* FAB mobile */}
      <div className="fixed right-4 bottom-6 md:hidden z-50">
        <Button className="rounded-full p-3 hover:bg-emerald-400 bg-emerald-500 text-black shadow-lg cursor-pointer" onClick={() => { resetDraft(); setShowAdd(true); }}>
          <PlusCircle className="w-5 h-5" />
        </Button>
      </div>

      {/* ---------------- Add Modal ---------------- */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-2xl" initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-emerald-300">New Task</h3>
                <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setShowAdd(false)}>Close</Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} className="bg-zinc-900 border border-zinc-800 cursor-text" />
                <Textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))} className="bg-zinc-900 border border-zinc-800" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Start */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Start</Label>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            className="w-full justify-start text-left hover:bg-zinc-500 bg-zinc-900 border border-zinc-800 cursor-pointer"
                            >
                            {draft.start_date ? (
                                <span className="text-slate-200">
                                {format(new Date(draft.start_date), "PPP p")}
                                </span>
                            ) : (
                                <span className="text-slate-400">Pick start date</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 bg-zinc-900 border border-zinc-800">
                            <Calendar
                            mode="single"
                            selected={draft.start_date ? new Date(draft.start_date) : undefined}
                            onSelect={(date) => {
                                if (!date) return
                                const current = draft.start_date
                                ? new Date(draft.start_date)
                                : new Date()
                                date.setHours(current.getHours(), current.getMinutes())
                                setDraft((d) => ({ ...d, start_date: date.toISOString() }))
                            }}
                            className="text-white"
                            classNames={{
                                day: "w-9 h-9 p-0 text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300",
                                day_today:
                                "bg-emerald-600/30 font-semibold",
                                day_selected: "bg-emerald-500 text-black",
                            }}
                            />
                        </PopoverContent>
                        </Popover>
                        <Select
                        value={draft.start_date ? format(new Date(draft.start_date), "HH:mm") : ""}
                        onValueChange={(val) => {
                            const d = draft.start_date ? new Date(draft.start_date) : new Date()
                            const [h, m] = val.split(":").map(Number)
                            d.setHours(h || 0, m || 0)
                            setDraft((prev) => ({ ...prev, start_date: d.toISOString() }))
                        }}
                        >
                        <SelectTrigger className="w-full bg-zinc-900 border border-zinc-800 cursor-pointer text-slate-200">
                            <SelectValue placeholder="Select time">
                            <span
                                className={
                                draft.start_date ? "text-slate-200" : "text-slate-400"
                                }
                            >
                                {draft.start_date
                                ? format(new Date(draft.start_date), "HH:mm")
                                : "Select time"}
                            </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border border-zinc-800">
                            {Array.from({ length: 24 }, (_, h) =>
                            ["00", "30"].map((m) => (
                                <SelectItem className="text-white cursor-pointer" key={`${h}:${m}`} value={`${h}:${m}`}>
                                {`${h.toString().padStart(2, "0")}:${m}`}
                                </SelectItem>
                            ))
                            )}
                        </SelectContent>
                        </Select>
                    </div>

                    {/* Due */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Due</Label>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            className="w-full justify-start text-left bg-zinc-900 border hover:bg-zinc-500 border-zinc-800 cursor-pointer"
                            >
                            {draft.due_date ? (
                                <span className="text-slate-200">
                                {format(new Date(draft.due_date), "PPP p")}
                                </span>
                            ) : (
                                <span className="text-slate-400">Pick due date</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 bg-zinc-900 border border-zinc-800">
                            <Calendar
                            mode="single"
                            selected={draft.due_date ? new Date(draft.due_date) : undefined}
                            onSelect={(date) => {
                                if (!date) return
                                const current = draft.due_date
                                ? new Date(draft.due_date)
                                : new Date()
                                date.setHours(current.getHours(), current.getMinutes())
                                setDraft((d) => ({ ...d, due_date: date.toISOString() }))
                            }}
                            className="text-white"
                            classNames={{
                                day: "w-9 h-9 p-0 text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300",
                                day_today:
                                "bg-emerald-600/30 text-emerald-200 font-semibold",
                                day_selected: "bg-emerald-500 text-black",
                            }}
                            />
                        </PopoverContent>
                        </Popover>
                        <Select
                        value={draft.due_date ? format(new Date(draft.due_date), "HH:mm") : ""}
                        onValueChange={(val) => {
                            const d = draft.due_date ? new Date(draft.due_date) : new Date()
                            const [h, m] = val.split(":").map(Number)
                            d.setHours(h || 0, m || 0)
                            setDraft((prev) => ({ ...prev, due_date: d.toISOString() }))
                        }}
                        >
                        <SelectTrigger className="w-full bg-zinc-900 border border-zinc-800 cursor-pointer text-slate-200">
                            <SelectValue placeholder="Select time">
                            <span
                                className={
                                draft.due_date ? "text-slate-200" : "text-slate-400"
                                }
                            >
                                {draft.due_date
                                ? format(new Date(draft.due_date), "HH:mm")
                                : "Select time"}
                            </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border border-zinc-800">
                            {Array.from({ length: 24 }, (_, h) =>
                            ["00", "30"].map((m) => (
                                <SelectItem className="text-white cursor-pointer" key={`${h}:${m}`} value={`${h}:${m}`}>
                                {`${h.toString().padStart(2, "0")}:${m}`}
                                </SelectItem>
                            ))
                            )}
                        </SelectContent>
                        </Select>
                    </div>
                    </div>


                <div className="grid grid-cols-3 gap-3">
                  <Select value={draft.priority} onValueChange={(v) => setDraft(d => ({ ...d, priority: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>

                  <Select value={draft.recurrence_type} onValueChange={(v) => setDraft(d => ({ ...d, recurrence_type: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="none">No recurrence</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                  </Select>

                  <Select value={draft.status} onValueChange={(v) => setDraft(d => ({ ...d, status: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="snoozed">Snoozed</SelectItem></SelectContent>
                  </Select>
                </div>

                {draft.recurrence_type === "weekly" && (
                  <div className="flex flex-wrap gap-2">
                    <div className="text-xs text-zinc-400 w-full">Choose weekdays</div>
                    {weekdays.map((wd) => {
                      const active = (draft.recurrence_days || []).includes(wd.key);
                      return (<Button key={wd.key} size="sm" className={`cursor-pointer ${active ? "bg-emerald-500 text-black" : "bg-zinc-900 border border-zinc-800"}`} onClick={() => {
                        setDraft(prev => {
                          const arr = prev.recurrence_days || [];
                          if (arr.includes(wd.key)) return { ...prev, recurrence_days: arr.filter(x => x !== wd.key) };
                          return { ...prev, recurrence_days: [...arr, wd.key] };
                        });
                      }}>{wd.label}</Button>);
                    })}
                    <Button size="sm" className="cursor-pointer bg-zinc-900 border border-zinc-800" onClick={() => setDraft(prev => ({ ...prev, recurrence_days: ["sat","sun"] }))}>Weekend</Button>
                  </div>
                )}

                <div>
                  <div className="text-xs text-zinc-400 mb-1">Notes (Markdown supported)</div>
                  <Textarea placeholder="Notes / checklist (Markdown supported)" value={draft.notes} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))} className="bg-zinc-900 border border-zinc-800 h-28" />
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" className="border-zinc-800 text-black cursor-pointer" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button className="bg-emerald-500 text-black cursor-pointer" onClick={handleCreate} disabled={loading}>Save Task</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- Edit Modal ---------------- */}
      <AnimatePresence>
        {editing && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-2xl" initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-emerald-300">Edit Task</h3>
                <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setEditing(null)}>Close</Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Input placeholder="Title" value={editing.title} onChange={(e) => setEditing(prev => ({ ...prev, title: e.target.value }))} className="bg-zinc-900 border border-zinc-800 cursor-text" />
                <Textarea placeholder="Description" value={editing.description || ""} onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} className="bg-zinc-900 border border-zinc-800" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Start Date & Time */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Start</Label>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-zinc-900 border border-zinc-800 cursor-pointer"
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editing.start_date ? format(new Date(editing.start_date), "PPP p") : <span>Pick date & time</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 bg-zinc-900 border border-zinc-800">
                            <Calendar
                            mode="single"
                            selected={editing.start_date ? new Date(editing.start_date) : undefined}
                            onSelect={(date) =>
                                setEditing((prev) => ({ ...prev, start_date: date ? date.toISOString() : "" }))
                            }
                            className="rounded-md border text-white"
                            />
                            <div className="mt-2">
                            <Select
                                onValueChange={(value) =>
                                setEditing((prev) => ({
                                    ...prev,
                                    start_date: prev.start_date
                                    ? new Date(new Date(prev.start_date).setHours(value.split(":")[0], value.split(":")[1])).toISOString()
                                    : new Date().toISOString(),
                                }))
                                }
                            >
                                <SelectTrigger className="w-full bg-zinc-900 border border-zinc-800 cursor-pointer">
                                <Clock className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Select time">
                                <span className={editing.start_date ? "text-slate-200" : "text-slate-400"}>
                                    {editing.start_date
                                    ? format(new Date(editing.start_date), "hh:mm a")
                                    : "Select time"}
                                </span>
                                </SelectValue>

                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border border-zinc-800">
                                {Array.from({ length: 24 }, (_, h) =>
                                    ["00", "30"].map((m) => (
                                    <SelectItem className="text-white cursor-pointer" key={`${h}:${m}`} value={`${h}:${m}`}>
                                        {`${h.toString().padStart(2, "0")}:${m}`}
                                    </SelectItem>
                                    ))
                                )}
                                </SelectContent>
                            </Select>
                            </div>
                        </PopoverContent>
                        </Popover>
                    </div>

                    {/* Due Date & Time */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Due</Label>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-zinc-900 border border-zinc-800 cursor-pointer"
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editing.due_date ? format(new Date(editing.due_date), "PPP p") : <span>Pick date & time</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 bg-zinc-900 border border-zinc-800">
                            <Calendar
                            mode="single"
                            selected={editing.due_date ? new Date(editing.due_date) : undefined}
                            onSelect={(date) =>
                                setEditing((prev) => ({ ...prev, due_date: date ? date.toISOString() : "" }))
                            }
                            className="rounded-md border text-white"
                            />
                            <div className="mt-2">
                            <Select
                                onValueChange={(value) =>
                                setEditing((prev) => ({
                                    ...prev,
                                    due_date: prev.due_date
                                    ? new Date(new Date(prev.due_date).setHours(value.split(":")[0], value.split(":")[1])).toISOString()
                                    : new Date().toISOString(),
                                }))
                                }
                            >
                                <SelectTrigger className="w-full bg-zinc-900 border border-zinc-800 cursor-pointer">
                                <Clock className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Select time">
                                <span className={editing.due_date ? "text-slate-200" : "text-slate-400"}>
                                    {editing.due_date
                                    ? format(new Date(editing.due_date), "hh:mm a")
                                    : "Select time"}
                                </span>
                                </SelectValue>

                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border border-zinc-800">
                                {Array.from({ length: 24 }, (_, h) =>
                                    ["00", "30"].map((m) => (
                                    <SelectItem className="text-white cursor-pointer" key={`${h}:${m}`} value={`${h}:${m}`}>
                                        {`${h.toString().padStart(2, "0")}:${m}`}
                                    </SelectItem>
                                    ))
                                )}
                                </SelectContent>
                            </Select>
                            </div>
                        </PopoverContent>
                        </Popover>
                    </div>
                    </div>


                <div className="grid grid-cols-3 gap-3">
                  <Select value={editing.priority || "medium"} onValueChange={(v) => setEditing(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>

                  <Select value={editing.recurrence_type || "none"} onValueChange={(v) => setEditing(prev => ({ ...prev, recurrence_type: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="none">No recurrence</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                  </Select>

                  <Select value={editing.status || "pending"} onValueChange={(v) => setEditing(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100"><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="snoozed">Snoozed</SelectItem></SelectContent>
                  </Select>
                </div>

                {editing.recurrence_type === "weekly" && (
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map(wd => {
                      const active = (editing.recurrence_days || []).includes(wd.key);
                      return (<Button key={wd.key} size="sm" className={`cursor-pointer ${active ? "bg-emerald-500 text-black" : "bg-zinc-900 border border-zinc-800"}`} onClick={() => {
                        setEditing(prev => {
                          const arr = prev.recurrence_days || [];
                          if (arr.includes(wd.key)) return { ...prev, recurrence_days: arr.filter(x => x !== wd.key) };
                          return { ...prev, recurrence_days: [...arr, wd.key] };
                        });
                      }}>{wd.label}</Button>);
                    })}
                    <Button size="sm" className="cursor-pointer bg-zinc-900 border border-zinc-800" onClick={() => setEditing(prev => ({ ...prev, recurrence_days: ["sat","sun"] }))}>Weekend</Button>
                  </div>
                )}

                <div>
                  <div className="text-xs text-zinc-400 mb-1">Notes (Markdown supported)</div>
                  <Textarea placeholder="Notes" value={editing.notes || ""} onChange={(e) => setEditing(prev => ({ ...prev, notes: e.target.value }))} className="bg-zinc-900 border border-zinc-800 h-28" />
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" className="border-zinc-800 text-black cursor-pointer" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => handleUpdate(editing.id, {
                    title: editing.title,
                    description: editing.description,
                    start_date: editing.start_date,
                    due_date: editing.due_date,
                    priority: editing.priority,
                    recurrence_type: editing.recurrence_type,
                    recurrence_days: editing.recurrence_days,
                    notes: editing.notes,
                    status: editing.status,
                  })}>Save changes</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- Preview Drawer ---------------- */}
      <AnimatePresence>
        {previewTask && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-end p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full md:w-96 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-2xl" initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-emerald-300 truncate">{previewTask.title}</h3>
                  <div className="text-xs text-zinc-400 mt-1 line-clamp-3">{previewTask.description || "No description"}</div>
                </div>
                <div>
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setPreviewTask(null)}>Close</Button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-zinc-400">
                <div>Start: <span className="text-emerald-300 font-medium">{previewTask.start_date_obj ? format(previewTask.start_date_obj, "PPP p") : "—"}</span></div>
                <div>Due: <span className={`font-medium ${isOverdue(previewTask) ? "text-rose-300" : "text-emerald-300"}`}>{previewTask.due_date_obj ? format(previewTask.due_date_obj, "PPP p") : "—"}</span></div>
                <div>Priority: <span className="text-emerald-300 font-medium">{previewTask.priority}</span></div>
                <div>Recurrence: <span className="text-emerald-300 font-medium">{recurrenceSummary(previewTask)}</span></div>
                <div>Status: <span className="text-emerald-300 font-medium">{previewTask.status}</span></div>

                <div className="mt-2">
                  <div className="text-xs text-zinc-400 mb-1">Notes</div>
                  <div className="prose prose-invert max-w-full text-sm bg-zinc-900 border border-zinc-800 p-3 rounded">
                    {previewTask.notes ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewTask.notes}</ReactMarkdown>
                    ) : (
                      <div className="text-zinc-500">—</div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-zinc-500 mt-2">Created: {format(new Date(previewTask.created_at), "PPP p")}</div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => { setPreviewTask(null); openEdit(previewTask); }}>Edit</Button>
                  <Button size="sm" variant="destructive" className="cursor-pointer" onClick={() => { handleDelete(previewTask.id); setPreviewTask(null); }}>Delete</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
