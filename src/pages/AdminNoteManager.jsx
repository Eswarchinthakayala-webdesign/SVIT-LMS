// src/pages/AdminNoteManager.jsx
// Pro-level Admin Note Manager (final enhanced version)
// - Rich text editor (react-quill)
// - Version history/audit trail (teacher_note_versions table)
// - Search, filters, sorting, pagination
// - Pin/favorite, tagging (colored), bulk actions
// - Preview drawer, QR popup for resource links (react-qr-code), download QR, visit URL
// - Undo snackbar, skeleton loaders
// - Analytics (recharts) with icon toggle (lucide-react)
// - Uses shadcn/ui components, lucide-react, framer-motion, date-fns, react-quill, recharts, supabase
/* eslint-disable react/no-danger */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PlusCircle,
  Edit,
  Trash,
  BookOpen,
  ExternalLink,
  MoreHorizontal,
  Pin,
  Star,
  Eye,
  ChevronDown,
  Archive,
  RefreshCw,
  Link as LinkIcon,
  Info,
  List,
  X,
  Menu,
  Search,
  BarChart3,
  Download,
} from "lucide-react";

import { format, parseISO } from "date-fns";

import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css"; // ✅ GitHub-like styling

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

import QRCode from "react-qr-code";

/**
 * Final enhanced AdminNoteManager:
 *  - Adds colored tag badges
 *  - Adds QR popup for resource links (show QR, download SVG, visit URL)
 *  - Analytics toggle uses lucide icon (BarChart3)
 *  - Search filters locally (avoids fetch per keystroke) to prevent layout jumps
 *  - Add/Edit dialog improved: fixed max height, inner scrolling, sticky action footer
 *  - All features preserved (versions, analytics, bulk actions, undo)
 *
 * Note: Keep theme & Tailwind classes as used previously.
 */

// -------------------- Helpers --------------------
function humanDate(d) {
  if (!d) return "—";
  try {
    return format(new Date(d), "PPP p");
  } catch {
    return d;
  }
}
function shortDate(d) {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}
function safeHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");
}

// Deterministic color for tag name
const TAG_COLORS = [
  "bg-emerald-800/40 text-emerald-300 border border-emerald-700",
  "bg-indigo-800/40 text-indigo-300 border border-indigo-700",
  "bg-rose-800/40 text-rose-300 border border-rose-700",
  "bg-yellow-800/40 text-yellow-300 border border-yellow-700",
  "bg-fuchsia-800/40 text-fuchsia-300 border border-fuchsia-700",
  "bg-sky-800/40 text-sky-300 border border-sky-700",
  "bg-lime-800/40 text-lime-300 border border-lime-700",
  "bg-red-800/40 text-red-300 border border-red-700",
];

function tagColorClass(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash << 5) - hash + tag.charCodeAt(i);
  const idx = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

// Skeleton for notes list
function SkeletonNote() {
  return (
    <div className="animate-pulse p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
      <div className="h-4 w-3/5 bg-zinc-700 rounded" />
      <div className="mt-3 h-3 w-full bg-zinc-700 rounded" />
      <div className="mt-2 h-3 w-5/6 bg-zinc-700 rounded" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 bg-zinc-700 rounded" />
        <div className="h-6 w-12 bg-zinc-700 rounded" />
      </div>
    </div>
  );
}

// -------------------- Main Component --------------------
export default function AdminNoteManager() {
  // Data & user
  const [notes, setNotes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);

  // UI state
  const [query, setQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Dialog & form
  const [showDialog, setShowDialog] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    visibility: "course",
    course_id: "",
    tags: [],
    pinned: false,
    file_url: "",
  });

  // Preview/QR
  const [preview, setPreview] = useState(null);
  const [previewTab, setPreviewTab] = useState("details");
  const [qrUrl, setQrUrl] = useState(null); // url to show in QR popup
  const [showQrDialog, setShowQrDialog] = useState(false);
  const qrSvgRef = useRef(null);

  // Mobile header
  const [mobileOpen, setMobileOpen] = useState(false);

  // Versions
  const [versions, setVersions] = useState([]);
  const [showVersionsFor, setShowVersionsFor] = useState(null);

  // Undo
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = useRef(null);

  // Analytics toggle
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Tags (could be fetched)
  const [tags, setTags] = useState(["Important", "Exam", "Revision", "Lecture", "Resource", "Solution"]);

  // Editor
  const quillRef = useRef(null);

  // -------------------- Init --------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) console.error("getUserErr", userErr);
        if (user && mounted) {
          setUserId(user.id);
          const { data: profile, error: profileErr } = await supabase.from("profiles").select("role").eq("id", user.id).single();
          if (!profileErr && profile) setRole(profile.role);
        }
      } catch (err) {
        console.error("init user err", err);
      } finally {
        fetchCourses();
        fetchNotes(true);
      }
    })();

    return () => {
      mounted = false;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- Fetch logic (optimized) --------------------
  // fetchNotes(reset = true): if reset -> replace notes; otherwise append unique
  async function fetchNotes(reset = true) {
    if (reset) setLoading(true);
    try {
      let builder = supabase
        .from("teacher_notes")
        .select(`
          *,
          courses ( id, title ),
          author:profiles!teacher_notes_author_id_fkey ( id, full_name ),
          updated_by_user:profiles!teacher_notes_updated_by_fkey ( id, full_name )
        `)
        .order("created_at", { ascending: false });

      if (role !== "admin") {
        if (userId) builder = builder.or(`visibility.eq.public,visibility.eq.course,author_id.eq.${userId}`);
        else builder = builder.or(`visibility.eq.public,visibility.eq.course`);
      }

      const from = 0;
      const to = (page + 1) * pageSize - 1;
      const { data, error } = await builder.range(from, to);
      if (error) throw error;

      const normalized = (data || []).map((n) => ({
        ...n,
        created_at_obj: n.created_at ? parseISO(n.created_at) : null,
        updated_at_obj: n.updated_at ? parseISO(n.updated_at) : null,
        tags: n.tags || [],
        file_url: n.file_url || null,
      }));

      if (reset) {
        setNotes(normalized);
      } else {
        // append without duplicates
        setNotes((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          normalized.forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error("fetchNotes", err);
      toast.error("Unable to load notes");
    } finally {
      if (reset) setLoading(false);
    }
  }

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses", err);
    }
  }

  // load more
  async function loadMore() {
    setPage((p) => p + 1);
    await fetchNotes(false);
  }

  // note: do NOT fetch on query changes. Filtering is local via `filtered` memo.

  // -------------------- Derived lists --------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = notes.slice();
    if (filterCourse !== "all") arr = arr.filter((n) => String(n.course_id) === String(filterCourse));
    if (filterVisibility !== "all") arr = arr.filter((n) => n.visibility === filterVisibility);
    if (q) {
      arr = arr.filter((n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.description || "").toLowerCase().includes(q) ||
        (n.tags || []).join(" ").toLowerCase().includes(q)
      );
    }
    if (sortBy === "newest") arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortBy === "oldest") arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortBy === "title_asc") arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sortBy === "pinned") arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return arr;
  }, [notes, query, filterCourse, filterVisibility, sortBy]);

  const analyticsData = useMemo(() => {
    const total = notes.length;
    const byVisibility = notes.reduce((acc, n) => { acc[n.visibility] = (acc[n.visibility] || 0) + 1; return acc; }, {});
    const pie = [
      { name: "Public", value: byVisibility.public || 0, color: "#34d399" },
      { name: "Course", value: byVisibility.course || 0, color: "#60a5fa" },
      { name: "Other", value: byVisibility.other || 0, color: "#f97316" },
    ];
    const byCourse = courses.map((c) => ({ name: c.title, count: notes.filter((n) => String(n.course_id) === String(c.id)).length }));
    return { total, pie, byCourse };
  }, [notes, courses]);

  // -------------------- CRUD & actions --------------------
  async function openNewDialog() {
    setEditingNote(null);
    setForm({
      title: "",
      description: "",
      visibility: "course",
      course_id: "",
      tags: [],
      pinned: false,
      file_url: "",
    });
    setShowDialog(true);
    setTimeout(() => quillRef.current?.focus?.(), 200);
  }

  async function openEditDialog(note) {
    setEditingNote(note);
    setForm({
      title: note.title || "",
      description: note.description || "",
      visibility: note.visibility || "course",
      course_id: note.course_id || "",
      tags: note.tags || [],
      pinned: note.pinned || false,
      file_url: note.file_url || "",
    });
    setShowDialog(true);
    setTimeout(() => quillRef.current?.focus?.(), 200);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");

      if (editingNote) {
        try {
          await supabase.from("teacher_note_versions").insert([{
            note_id: editingNote.id,
            title: editingNote.title,
            description: editingNote.description,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }]);
        } catch (verErr) {
          console.warn("version insert failed", verErr);
        }

        const { error } = await supabase.from("teacher_notes").update({
          title: form.title,
          description: form.description,
          visibility: form.visibility,
          course_id: form.visibility === "course" ? form.course_id : null,
          tags: form.tags,
          pinned: form.pinned,
          file_url: form.file_url || null,
          updated_by: user.id,
        }).eq("id", editingNote.id);
        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase.from("teacher_notes").insert([{
          title: form.title,
          description: form.description,
          visibility: form.visibility,
          course_id: form.visibility === "course" ? form.course_id : null,
          tags: form.tags,
          pinned: form.pinned,
          file_url: form.file_url || null,
          author_id: user.id,
        }]);
        if (error) throw error;
        toast.success("Note created");
      }
      setShowDialog(false);
      fetchNotes(true);
    } catch (err) {
      console.error("save note", err);
      toast.error("Failed to save note");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(note) {
    setLastDeleted(note);
    try {
      const { error } = await supabase.from("teacher_notes").delete().eq("id", note.id);
      if (error) throw error;
      setNotes((p) => p.filter((n) => n.id !== note.id));
      toast.success("Note deleted — undo available");
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 5000);
    } catch (err) {
      console.error("delete note", err);
      toast.error("Delete failed");
    }
  }

  async function undoDelete() {
    if (!lastDeleted) return;
    try {
      const payload = { ...lastDeleted };
      delete payload.id;
      const { error } = await supabase.from("teacher_notes").insert([payload]);
      if (error) throw error;
      toast.success("Delete undone");
      fetchNotes(true);
      setLastDeleted(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    } catch (err) {
      console.error("undo delete", err);
      toast.error("Undo failed");
    }
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase.from("teacher_notes").delete().in("id", ids);
      if (error) throw error;
      setNotes((p) => p.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
      setBulkMode(false);
      toast.success("Bulk delete successful");
    } catch (err) {
      console.error("bulk delete", err);
      toast.error("Bulk delete failed");
    }
  }

  async function bulkTogglePinned(value) {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase.from("teacher_notes").update({ pinned: value }).in("id", ids);
      if (error) throw error;
      setNotes((p) => p.map((n) => selectedIds.has(n.id) ? { ...n, pinned: value } : n));
      setSelectedIds(new Set());
      setBulkMode(false);
      toast.success("Bulk update saved");
    } catch (err) {
      console.error("bulk pin", err);
      toast.error("Bulk pin failed");
    }
  }

  async function 
  loadVersions(noteId) {
    try {
      const { data, error } = await supabase.from("teacher_note_versions").select("*").eq("note_id", noteId).order("updated_at", { ascending: false });
      if (error) throw error;
      setVersions(data || []);
      setShowVersionsFor(noteId);
    } catch (err) {
      console.error("load versions", err);
      toast.error("Failed to load versions");
    }
  }

  async function openPreview(note) {
    setPreview(note);
    setPreviewTab("details");
    try {
      await supabase.from("teacher_notes").update({ view_count: (note.view_count || 0) + 1 }).eq("id", note.id);
      setNotes((p) => p.map((n) => n.id === note.id ? { ...n, view_count: (n.view_count || 0) + 1 } : n));
    } catch {
      // ignore
    }
  }

  async function togglePin(note) {
    try {
      const { error } = await supabase.from("teacher_notes").update({ pinned: !note.pinned }).eq("id", note.id);
      if (error) throw error;
      setNotes((p) => p.map((n) => n.id === note.id ? { ...n, pinned: !n.pinned } : n));
      toast.success(note.pinned ? "Unpinned" : "Pinned");
    } catch (err) {
      console.error("toggle pin", err);
      toast.error("Pin failed");
    }
  }

  // -------------------- QR popup handling --------------------
  function openQrPopup(url) {
    if (!url) {
      toast.error("No resource URL available");
      return;
    }
    setQrUrl(url);
    setShowQrDialog(true);
  }

  // download QR as SVG file
  function downloadQrSvg() {
    try {
      const svg = document.querySelector("#qr-svg");
      if (!svg) {
        toast.error("QR not available");
        return;
      }
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svg);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resource-qr.svg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("QR downloaded");
    } catch (err) {
      console.error("downloadQrSvg", err);
      toast.error("Download failed");
    }
  }

  // -------------------- UI Subcomponents --------------------
  // Professional header (improved)
// -------------------- UI Subcomponents --------------------
function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-br from-[#071b16] via-[#0b1211] to-[#000000] border-b border-zinc-800/40">
      {/* Top row */}
      <div className="flex items-center justify-between h-16 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            className="p-2 rounded-md md:hidden hover:bg-zinc-900/30 cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X size={20} className="text-slate-200" />
            ) : (
              <Menu size={20} className="text-slate-200" />
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 shadow">
              <BookOpen className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-emerald-300 leading-tight">
                Admin Note Manager
              </h1>
              <div className="text-xs text-zinc-400">
                Manage course & public notes — version history, analytics, bulk
                tools
              </div>
            </div>
          </div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-md px-2 py-1">
            <Search className="text-zinc-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, tags, titles..."
              className="bg-transparent text-slate-200 placeholder-zinc-500 focus:outline-none w-64"
            />
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <Select value={filterCourse} onValueChange={(v) => setFilterCourse(v)}>
              <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-44 text-slate-200">
                <SelectValue placeholder="All courses">
                  <span className="text-slate-400">
                    {filterCourse === "all"
                      ? "All courses"
                      : courses.find((c) => c.id === filterCourse)?.title ||
                        "Course"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterVisibility}
              onValueChange={(v) => setFilterVisibility(v)}
            >
              <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-36 text-slate-200">
                <SelectValue placeholder="Visibility">
                  <span className="text-slate-400">
                    {filterVisibility === "all"
                      ? "All visibility"
                      : filterVisibility}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="course">Course</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-40 text-slate-200">
                <SelectValue placeholder="Sort">
                  <span className="text-slate-400">
                    {sortBy === "newest" ? "Newest" : sortBy}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="title_asc">Title A–Z</SelectItem>
                <SelectItem value="pinned">Pinned first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* Analytics toggle uses icon only */}
            <Button
              size="sm"
              variant={showAnalytics ? "secondary" : "ghost"}
              onClick={() => setShowAnalytics((v) => !v)}
              aria-pressed={showAnalytics}
              title="Toggle analytics"
              className="cursor-pointer"
            >
              <BarChart3
                className={`w-4 h-4 ${
                  showAnalytics ? "text-emerald-300" : "text-zinc-300"
                }`}
              />
            </Button>

            <div>
              {role === "admin" ? (
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={openNewDialog}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 mr-2" /> Add Note
                    </Button>
                  </DialogTrigger>
                </Dialog>
              ) : (
                <Button variant="ghost" className="cursor-pointer">
                  Request Access
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          <button
            className="p-2 rounded-md bg-zinc-900/50 cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Search size={18} className="text-slate-200" />
          </button>
          <button
            className="p-2 rounded-md bg-emerald-500 cursor-pointer"
            onClick={openNewDialog}
          >
            <PlusCircle size={18} className="text-black" />
          </button>
        </div>
      </div>

      {/* Second row: large screens quick info */}
      <div className="hidden lg:flex items-center justify-between gap-4 py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div>
            Showing{" "}
            <span className="text-slate-100 font-semibold ml-1">
              {filtered.length}
            </span>{" "}
            notes
          </div>
          <Separator orientation="vertical" className="h-6 bg-zinc-800" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchNotes(true)}
            className="cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={bulkMode ? "secondary" : "ghost"}
            onClick={() => {
              setBulkMode((b) => !b);
              if (!bulkMode) setSelectedIds(new Set());
            }}
            className="cursor-pointer"
          >
            {bulkMode ? "Exit bulk" : "Bulk actions"}
          </Button>
          {bulkMode && (
            <>
              <Button
                size="sm"
                onClick={() => bulkDelete()}
                className="cursor-pointer"
              >
                Delete selected
              </Button>
              <Button
                size="sm"
                onClick={() => bulkTogglePinned(true)}
                className="cursor-pointer"
              >
                Pin selected
              </Button>
              <Button
                size="sm"
                onClick={() => bulkTogglePinned(false)}
                className="cursor-pointer"
              >
                Unpin selected
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-zinc-800 bg-[#071b16] px-4 py-3"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-md px-2 py-1">
                <Search className="text-zinc-400" size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="bg-transparent text-slate-200 placeholder-zinc-500 focus:outline-none w-full"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={filterCourse}
                  onValueChange={(v) => setFilterCourse(v)}
                >
                  <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200 cursor-pointer">
                    <SelectValue placeholder="All courses">
                      <span className="text-slate-400">
                        {filterCourse === "all"
                          ? "All courses"
                          : courses.find((c) => c.id === filterCourse)?.title ||
                            "Course"}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 text-slate-100">
                    <SelectItem value="all">All courses</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Select
                    value={filterVisibility}
                    onValueChange={(v) => setFilterVisibility(v)}
                  >
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200 cursor-pointer">
                      <SelectValue placeholder="Visibility">
                        <span className="text-slate-400">
                          {filterVisibility === "all"
                            ? "All visibility"
                            : filterVisibility}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">
                      <SelectItem value="all">All visibility</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="course">Course</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200 cursor-pointer">
                      <SelectValue placeholder="Sort">
                        <span className="text-slate-400">
                          {sortBy === "newest" ? "Newest" : sortBy}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="title_asc">Title A–Z</SelectItem>
                      <SelectItem value="pinned">Pinned first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-400"
                    onClick={() => setShowAnalytics((v) => !v)}
                  >
                    {showAnalytics ? "Hide Analytics" : "Analytics"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}


  // tag toggle helper
function toggleTagInForm(tag) {
  setForm((prev) => {
    const arr = prev.tags || [];
    if (arr.includes(tag)) {
      return { ...prev, tags: arr.filter((t) => t !== tag) };
    }
    return { ...prev, tags: [...arr, tag] };
  });
}


  // Note card with colored tags and resource QR opener
  function NoteCard({ note }) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} layout className={`p-4 rounded-lg bg-zinc-800/60 border ${note.pinned ? "border-emerald-500/40 shadow-md" : "border-zinc-700"} transition-transform hover:scale-[1.01]`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-100 truncate">{note.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{note.author?.full_name || "—"} • {shortDate(note.created_at)}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* clicking the icon opens QR popup instead of immediate navigation */}
            {note.file_url && (
              <button onClick={(e) => { e.stopPropagation(); openQrPopup(note.file_url); }} className="p-1 rounded cursor-pointer text-emerald-500 hover:bg-zinc-700/50 " title="Resource QR & actions">
                <ExternalLink className="w-5 h-5" />
              </button>
            )}

            <button onClick={(e) => { e.stopPropagation(); togglePin(note); }} className="cursor-pointer p-1 rounded hover:bg-zinc-700">
              <Pin className={`w-5 h-5 ${note.pinned ? "text-emerald-300" : "text-zinc-400"}`} />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1 rounded hover:bg-zinc-700 cursor-pointer"><MoreHorizontal className="w-5 h-5 text-zinc-300" /></button>
              </PopoverTrigger>
              <PopoverContent className="bg-zinc-900 border border-zinc-800">
                <div className="flex flex-col min-w-[180px]">
                  <button onClick={() => openPreview(note)} className="text-left px-3 py-2 hover:bg-zinc-800 cursor-pointer text-emerald-400"><Eye className="inline w-4 h-4 mr-2" /> Preview</button>
                  {role === "admin" && <button onClick={() => { openEditDialog(note); setShowDialog(true); }} className="text-left px-3 py-2 hover:bg-zinc-800 text-emerald-400 cursor-pointer"><Edit className="inline w-4 h-4 mr-2" /> Edit</button>}
                  {role === "admin" && <button onClick={() => { loadVersions(note.id); }} className="text-left px-3 py-2 hover:bg-zinc-800 text-emerald-400 cursor-pointer"><Archive className="inline w-4 h-4 mr-2" /> Versions</button>}
                  {role === "admin" && <button onClick={() => handleDelete(note)} className="text-left px-3 py-2 hover:bg-zinc-800 cursor-pointer text-red-400"><Trash className="inline w-4 h-4 mr-2" /> Delete</button>}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-3 text-sm text-zinc-300 line-clamp-4" dangerouslySetInnerHTML={{ __html: (note.description || "").replace(/<[^>]+>/g, " ").slice(0, 400) + ((note.description || "").length > 400 ? "..." : "") }} />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
          {note.tags && note.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {note.tags.map((tag, i) => (
              <Badge
                key={i}
                className={TAG_COLORS[i % TAG_COLORS.length]}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

            <div className="text-xs text-zinc-400">Visibility: <span className="text-emerald-300 font-medium">{note.visibility}</span></div>
          </div>

          <div className="flex items-center gap-2">
            {bulkMode && (
              <input type="checkbox" checked={selectedIds.has(note.id)} onChange={(e) => {
                const s = new Set(selectedIds);
                if (e.target.checked) s.add(note.id); else s.delete(note.id);
                setSelectedIds(s);
              }} className="cursor-pointer" />
            )}
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openPreview(note)}>Open</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071b16] via-[#0b1211] to-[#000000] text-slate-100">
       <Header />
      <div className="max-w-7xl mt-6 mx-auto px-6 mb-4">
        {/* Header */}
       

        {/* Analytics panel */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6 ">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                  <h3 className="text-emerald-300 font-semibold">Overview</h3>
                  <div className="text-sm text-zinc-400 mt-2">Total notes: <span className="font-semibold text-slate-100">{analyticsData.total}</span></div>
                  <div className="mt-3 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.byCourse.slice(0, 6)} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ReTooltip 
                            contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }}
                        />
                        <Bar dataKey="count" fill="#34D399" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                  <h3 className="text-emerald-300 font-semibold">By Visibility</h3>
                  <div className="h-40 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={analyticsData.pie} dataKey="value" nameKey="name" outerRadius={60} label>
                          {analyticsData.pie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <ReTooltip 
                          contentStyle={{
                          backgroundColor: "#50C878",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }}
                        
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                  <h3 className="text-emerald-300 font-semibold">Quick Actions</h3>
                  <div className="mt-3 space-y-2">
                    <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => { setFilterVisibility("public"); setFilterCourse("all"); }}>Show Public</Button>
                    <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => { setFilterVisibility("course"); }}>Show Course Notes</Button>
                    <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => { setQuery(""); setFilterCourse("all"); setFilterVisibility("all"); setSortBy("newest"); }}>Reset Filters</Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes list + toolbar */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center mb-4  justify-between ">
            <div className="flex items-center gap-3">
              <div className="text-sm text-zinc-400">Showing</div>
              <div className="text-sm font-semibold text-slate-100">{filtered.length} notes</div>
              <Separator orientation="vertical" className="h-6 bg-zinc-800" />
              <Button size="sm" variant="ghost" className="cursor-pointer mr-2" onClick={() => fetchNotes(true)}><RefreshCw className="w-4 h-4 mr-" /> Refresh</Button>
            </div>

            <div className="flex items-center flex-col sm:flex-row gap-2">
              <Button className="cursor-pointer" size="sm" variant={bulkMode ? "secondary" : "ghost"} onClick={() => { setBulkMode((b) => !b); if (!bulkMode) setSelectedIds(new Set()); }}>
                {bulkMode ? "Exit bulk" : "Bulk actions"}
              </Button>
              {bulkMode && (
                <div className="flex flex-col sm:flex-row gap-2 ">
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => bulkDelete()}>Delete selected</Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => bulkTogglePinned(true)}>Pin selected</Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => bulkTogglePinned(false)}>Unpin selected</Button>
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[650px] overflow-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonNote key={i} />)
                : filtered.length === 0 ? (
                  <div className="col-span-full text-center text-zinc-500 p-8 rounded-xl bg-zinc-900/40 border border-zinc-800">
                    <div className="text-xl font-semibold text-slate-100 mb-2">No notes found</div>
                    <p className="text-sm text-zinc-400 mb-4">Try adjusting filters or add a new note.</p>
                    {role === "admin" && <Button className="bg-emerald-500 text-black" onClick={openNewDialog}><PlusCircle className="w-4 h-4 mr-2" /> Add First Note</Button>}
                  </div>
                ) : filtered.map((note) => <NoteCard key={note.id} note={note} />)
              }
            </div>

            <div className="mt-6 flex justify-center ">
              <Button className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={loadMore}>Load more</Button>
            </div>
          </ScrollArea>
        </div>

        {/* Versions Drawer */}
        <AnimatePresence>
          {showVersionsFor && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-end p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="w-full md:w-96 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl" initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-300">Version History</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowVersionsFor(null)}>Close</Button>
                </div>
                <div className="mt-4 space-y-3 max-h-[60vh] overflow-auto">
                  {versions.length === 0 ? <div className="text-xs text-zinc-400">No versions</div> : versions.map((v) => (
                    <div key={v.id} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded">
                      <div className="text-sm text-slate-100 font-medium">{v.title}</div>
                      <div className="text-xs text-zinc-400">Updated by {v.updated_by || "—"} • {shortDate(v.updated_at)}</div>
                      <div className="mt-2 text-sm text-zinc-300 line-clamp-6" dangerouslySetInnerHTML={{ __html: safeHtml(v.description) }} />
                      <div className="mt-2 flex gap-2 justify-end">
                        <Button size="sm" onClick={() => {
                          setShowVersionsFor(null);
                          setEditingNote({ id: showVersionsFor });
                          setForm({
                            title: v.title,
                            description: v.description,
                            visibility: "course",
                            course_id: "",
                            tags: [],
                            pinned: false,
                            file_url: "",
                          });
                          setShowDialog(true);
                        }}>Restore</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Drawer */}
        <AnimatePresence>
          {preview && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-end p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="w-full md:w-96 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-6 shadow-2xl" initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-emerald-300">{preview.title}</h3>
                    <div className="text-xs text-zinc-400 mt-1">{preview.author?.full_name || "—"} • {humanDate(preview.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {preview.file_url && (
                      <button onClick={() => openQrPopup(preview.file_url)} className="p-2 rounded cursor-pointer hover:bg-zinc-800/40 text-emerald-300" title="Resource QR & actions">
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                    <Button size="sm" className="cursor-pointer" variant="ghost" onClick={() => setPreview(null)}>Close</Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-4 flex items-center gap-2">
                  <button onClick={() => setPreviewTab("details")} aria-selected={previewTab === "details"} className={`flex cursor-pointer items-center gap-2 px-3 py-1 rounded ${previewTab === "details" ? "bg-emerald-500 text-black" : "bg-zinc-900/40 text-slate-200"}`}>
                    <List className="w-4 h-4" /> Details
                  </button>
                  <button onClick={() => setPreviewTab("meta")} aria-selected={previewTab === "meta"} className={`flex items-center cursor-pointer gap-2 px-3 py-1 rounded ${previewTab === "meta" ? "bg-emerald-500 text-black" : "bg-zinc-900/40 text-slate-200"}`}>
                    <Info className="w-4 h-4" /> Meta
                  </button>

                  {preview.file_url && (
                    <button onClick={() => openQrPopup(preview.file_url)} className="ml-auto cursor-pointer text-sm text-emerald-300 flex items-center gap-1">
                      Open resource <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 ">
                 {previewTab === "details" ? (
 <div className="prose prose-invert prose-pre:bg-zinc-900 prose-pre:text-slate-100 text-sm max-w-full break-words whitespace-pre-wrap overflow-y-auto max-h-60 pr-2 rounded-md">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw, rehypeHighlight]}
    components={{
      code({ node, inline, className, children, ...props }) {
        return !inline ? (
          <pre className={`hljs ${className || ""}`}>
            <code {...props}>{children}</code>
          </pre>
        ) : (
          <code className={`hljs ${className || ""}`} {...props}>
            {children}
          </code>
        );
      },
    }}
  >
    {preview.description || "*No description available*"}
  </ReactMarkdown>
</div>

) : (
                    <div className="text-sm text-zinc-300">
                      <div><span className="text-zinc-400">Visibility:</span> <span className="text-emerald-300 font-medium">{preview.visibility}</span></div>
                      <div className="mt-2"><span className="text-zinc-400">Course:</span> <span className="text-slate-100">{preview.courses?.title || "—"}</span></div>
                      <div className="mt-2"><span className="text-zinc-400">Tags:</span> <span className="text-slate-100">{(preview.tags || []).join(", ") || "—"}</span></div>
                      <div className="mt-2"><span className="text-zinc-400">Views:</span> <span className="text-slate-100">{preview.view_count || 0}</span></div>
                      <div className="mt-2"><span className="text-zinc-400">Created:</span> <span className="text-slate-100">{humanDate(preview.created_at)}</span></div>
                      <div className="mt-2"><span className="text-zinc-400">Last updated:</span> <span className="text-slate-100">{humanDate(preview.updated_at)}</span></div>

                      {preview.file_url && (
                        <div className="mt-3">
                          <div className="text-zinc-400 text-xs">Resource link</div>
                          <button onClick={() => openQrPopup(preview.file_url)} className="text-emerald-300 cursor-pointer underline flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" /> Open resource
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-zinc-400">Visibility: <span className="text-emerald-300 font-medium">{preview.visibility}</span></div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={() => { setPreview(null); openEditDialog(preview); }}>Edit</Button>
                    <Button size="sm" className="cursor-pointer" variant="destructive" onClick={() => { handleDelete(preview); setPreview(null); }}>Delete</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Dialog */}
        <AnimatePresence>
          {showQrDialog && qrUrl && (
            <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-300">Resource QR & Actions</h3>
                  <button className="p-2 rounded hover:bg-zinc-900/30" onClick={() => setShowQrDialog(false)}><X className="text-slate-200" /></button>
                </div>

                <div className="mt-4 flex flex-col items-center gap-4">
                  <div id="qr-svg" ref={qrSvgRef} className="bg-white p-4 rounded">
                    {/* react-qr-code renders an SVG; styling kept white for contrast */}
                    <QRCode value={qrUrl} size={160} />
                  </div>

                  <div className="text-sm text-zinc-400 break-all text-center">{qrUrl}</div>

                  <div className="w-full flex gap-2">
                    <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Visit URL</Button>
                    </a>
                    <Button className="flex items-center gap-2" onClick={() => downloadQrSvg()}><Download className="w-4 h-4" /> Download QR</Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo snackbar */}
        <AnimatePresence>
          {lastDeleted && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="fixed left-1/2 -translate-x-1/2 bottom-8 z-50">
              <div className="bg-zinc-900/95 border border-zinc-800 text-slate-100 px-4 py-3 rounded-lg shadow-lg flex items-center gap-4">
                <div>Note deleted</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={undoDelete}>Undo</Button>
                  <Button size="sm" variant="outline" onClick={() => { setLastDeleted(null); }}>Dismiss</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add/Edit Dialog (pro-level) */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100 max-w-4xl w-full mx-auto max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-emerald-300">{editingNote ? "Edit Note" : "Add New Note"}</DialogTitle>
            </DialogHeader>

            {/* Inner content scrolls */}
            <div className="flex-1 overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 pb-4">
                {/* Left/main column */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <Label className="text-slate-300 pb-3">Title</Label>
                    <Input placeholder="Enter a concise title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="bg-zinc-900 border border-zinc-800" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-400 mb-2">Content (Rich text)</div>
                      <div className="text-xs text-zinc-500">Tip: use headings & lists for clarity</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded min-h-[300px]">
                      <ReactQuill ref={quillRef} theme="snow" value={form.description} onChange={(val) => setForm((f) => ({ ...f, description: val }))} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300 pb-2">Resource URL (optional)</Label>
                    <Input placeholder="https://example.com/resource" value={form.file_url} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} className="bg-zinc-900 border border-zinc-800" />
                    <div className="text-xs text-zinc-500 mt-1">Add a resource link (PDF, site, doc). Users can open QR actions instead of direct navigation.</div>
                  </div>

                  <div>
                    <Label className="text-slate-300 pb-2">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((t) => {
                        const active = (form.tags || []).includes(t);
                        return (
                          <button key={t} onClick={() => toggleTagInForm(t)} className={`px-3 py-1 cursor-pointer rounded-md text-sm focus:outline-none border ${active ? `${tagColorClass(t)} border-zinc-800` : "bg-zinc-900 border border-zinc-800 text-slate-200"}`}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300 pb-2">Visibility</Label>
                    <Select value={form.visibility} onValueChange={(v) => setForm((f) => ({ ...f, visibility: v }))}>
                      <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer">
                        <SelectValue placeholder="Visibility" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100">
                        <SelectItem className='cursor-pointer' value="public">Public</SelectItem>
                        <SelectItem className="cursor-pointer" value="course">Course</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.visibility === "course" && (
                    <div>
                      <Label className="text-slate-300 pb-2">Course</Label>
                      <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                        <SelectTrigger className="bg-zinc-900 border border-zinc-800 cursor-pointer">
                          <SelectValue placeholder="Select Course" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 text-slate-100">
                          {courses.map((c) => <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-slate-300">Pinned</Label>
                    <div className="mt-2">
                      <Button size="sm" onClick={() => setForm((f) => ({ ...f, pinned: !f.pinned }))} className={`${form.pinned ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer text-black" : "bg-zinc-900 hover:bg-emerald-400 border cursor-pointer border-zinc-800"}`}><Pin className="w-4 h-4 " /> {form.pinned ? "Pinned" : "Pin"}</Button>
                    </div>
                  </div>

                  {/* Sticky bottom actions appear within right column for mobile friendliness */}
                  <div className="pt-4 mt-auto">
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="border-zinc-800 text-black cursor-pointer" onClick={() => setShowDialog(false)}>Cancel</Button>
                      <Button className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black" onClick={handleSave} disabled={loading}>{editingNote ? "Update Note" : "Save Note"}</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
