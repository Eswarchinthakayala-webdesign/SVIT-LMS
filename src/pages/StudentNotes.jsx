// src/pages/StudentNotes.jsx
// Student-facing Notes browser (overlay mobile menu + badge tags + analytics + QR + preview)
// - Full-width responsive header (desktop + mobile)
// - Mobile menu is an absolute dropdown overlay under the header (doesn't push content)
// - Stable local search/filtering with debounce (prevents layout "lifting")
// - Analytics panel (recharts) toggled by icon, responsive (stacks on small screens)
// - Note preview drawer with Details / Meta tabs
// - Resource QR popup (react-qr-code) with Download QR and Visit URL
// - Colored tag badges using shadcn/ui Badge component, deterministic colors
// - Skeleton loader, animations (framer-motion), interactive styles (cursor-pointer, hover)
// - Uses shadcn/ui components, lucide-react, date-fns, recharts, react-qr-code, supabase
/* eslint-disable react/no-danger */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  BookOpen,
  FileText,
  ExternalLink,
  Search,
  Menu,
  X,
  List,
  Info,
  BarChart3,
  Download,
  Eye,
  ChevronDown,
  MoreHorizontal,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";

import { format, parseISO } from "date-fns";

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
 * StudentNotes.jsx (overlay mobile menu + badge tags)
 *
 * Important notes:
 * - Make sure shadcn/ui components exist at the import paths used.
 * - Ensure react-qr-code, framer-motion, recharts, sonner are installed.
 * - This file intentionally focuses on UX stability (debounced search) and mobile overlay behavior.
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

// Deterministic tag color class selection, used with Badge variants
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
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

// Skeleton card for loading placeholder
function SkeletonNoteCard() {
  return (
    <div className="animate-pulse p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
      <div className="h-4 w-2/5 bg-zinc-700 rounded" />
      <div className="mt-3 h-3 w-full bg-zinc-700 rounded" />
      <div className="mt-2 h-3 w-5/6 bg-zinc-700 rounded" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 bg-zinc-700 rounded" />
        <div className="h-6 w-12 bg-zinc-700 rounded" />
      </div>
    </div>
  );
}

// -------------------- Main Component --------------------
export default function StudentNotes() {
  // Data
  const [notes, setNotes] = useState([]);
  const [courses, setCourses] = useState([]);

  // UI state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(false);

  // Header/mobile menu overlay
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileOverlayRef = useRef(null);

  // Preview drawer + tabs
  const [preview, setPreview] = useState(null);
  const [previewTab, setPreviewTab] = useState("details");

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);

  // QR dialog
  const [qrUrl, setQrUrl] = useState(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const qrSvgRef = useRef(null);

  // refs
  const searchRef = useRef(search);

  // Effects: initial fetch
  useEffect(() => {
    fetchCourses();
    fetchNotes();
    // close overlay when route changes or unmount
    return () => {
      setMobileOpen(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search to prevent layout lifting on keystrokes (keeps stable)
  useEffect(() => {
    searchRef.current = search;
    const id = setTimeout(() => {
      setDebouncedSearch(searchRef.current.trim().toLowerCase());
    }, 260);
    return () => clearTimeout(id);
  }, [search]);

  // -------------------- Fetchers --------------------
  async function fetchNotes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("teacher_notes")
        .select("*, courses(id,title), author:profiles!teacher_notes_author_id_fkey(id,full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((n) => ({
        ...n,
        created_at_obj: n.created_at ? parseISO(n.created_at) : null,
        updated_at_obj: n.updated_at ? parseISO(n.updated_at) : null,
        tags: n.tags || [],
        file_url: n.file_url || null,
      }));

      setNotes(normalized);
    } catch (err) {
      console.error("fetchNotes", err);
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses", err);
      toast.error("Failed to load courses");
    }
  }

  // -------------------- Derived Data --------------------
  const filteredNotes = useMemo(() => {
    const q = debouncedSearch || "";
    let arr = notes.slice();

    // Only public or course-level notes for students
    arr = arr.filter((n) => n.visibility === "public" || n.visibility === "course");

    if (selectedCourse !== "all") {
      arr = arr.filter((n) => String(n.course_id) === String(selectedCourse));
    }
    if (selectedVisibility !== "all") {
      arr = arr.filter((n) => n.visibility === selectedVisibility);
    }
    if (q) {
      arr = arr.filter((n) => {
        const title = (n.title || "").toLowerCase();
        const desc = (n.description || "").toLowerCase();
        const tags = (n.tags || []).join(" ").toLowerCase();
        return title.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }

    if (sortBy === "newest") {
      arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === "oldest") {
      arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === "title_asc") {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "pinned") {
      arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    }

    return arr;
  }, [notes, debouncedSearch, selectedCourse, selectedVisibility, sortBy]);

  const analyticsData = useMemo(() => {
    const total = notes.length;
    const byVisibility = notes.reduce((acc, n) => {
      acc[n.visibility] = (acc[n.visibility] || 0) + 1;
      return acc;
    }, {});
    const pie = [
      { name: "Public", value: byVisibility.public || 0, color: "#34d399" },
      { name: "Course", value: byVisibility.course || 0, color: "#60a5fa" },
      { name: "Other", value: byVisibility.other || 0, color: "#f97316" },
    ];
    const byCourse = courses.map((c) => ({
      name: c.title,
      count: notes.filter((n) => String(n.course_id) === String(c.id)).length,
    }));
    return { total, pie, byCourse };
  }, [notes, courses]);

  // -------------------- UI Handlers --------------------
  function openPreview(note) {
    setPreview(note);
    setPreviewTab("details");
  }

  function closePreview() {
    setPreview(null);
  }

  function openQrPopup(url) {
    if (!url) {
      toast.error("No resource URL available");
      return;
    }
    setQrUrl(url);
    setShowQrDialog(true);
  }

  function closeQrPopup() {
    setShowQrDialog(false);
    setQrUrl(null);
  }

  function downloadQrSvg() {
    try {
      const svgEl = document.querySelector("#student-qr-svg svg");
      if (!svgEl) {
        toast.error("QR not available");
        return;
      }
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svgEl);
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

  // toggle mobile overlay; clicking open sets focus / scroll lock
  useEffect(() => {
    function handleClickOutside(e) {
      if (!mobileOpen) return;
      if (!mobileOverlayRef.current) return;
      if (!mobileOverlayRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden"; // lock scroll while overlay open
    } else {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileOpen]);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  // -------------------- Subcomponents --------------------

  function Header() {
    return (
      <header className="sticky top-0 z-50 w-full bg-gradient-to-br from-[#071b16] via-[#0b1211] to-[#000000] border-b border-zinc-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* left */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen((s) => !s)}
                className="p-2 rounded-md md:hidden hover:bg-zinc-900/30 cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={20} className="text-slate-200" /> : <Menu size={20} className="text-slate-200" />}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 shadow">
                  <BookOpen className="w-5 h-5 text-black" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-emerald-300 truncate">Student Notes</h1>
                  <p className="text-xs text-zinc-400 truncate">Browse teacher-provided notes & resources</p>
                </div>
              </div>
            </div>

            {/* center: desktop controls */}
            <div className="hidden md:flex md:items-center md:gap-3 flex-1 justify-center">
              <div className="w-full max-w-2xl flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-md mx-2 px-2 py-1 w-full">
                  <Search className="text-zinc-400" size={16} />
                  <input
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search notes, tags, titles..."
                    className="bg-transparent text-slate-200 placeholder-zinc-500 focus:outline-none w-full"
                    aria-label="Search notes"
                  />
                </div>
              </div>
            </div>

            {/* right: controls */}
            <div className="hidden md:flex md:items-center md:gap-3">
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-44 cursor-pointer text-slate-200">
                  <SelectValue placeholder="All courses">
                    <span className="text-slate-400">{selectedCourse === "all" ? "All courses" : (courses.find((c) => c.id === selectedCourse)?.title || "Course")}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedVisibility} onValueChange={(v) => setSelectedVisibility(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-36 cursor-pointer text-slate-200">
                  <SelectValue placeholder="Visibility">
                    <span className="text-slate-400">{selectedVisibility === "all" ? "All visibility" : selectedVisibility}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer"  value="all">All visibility</SelectItem>
                  <SelectItem className="cursor-pointer"  value="public">Public</SelectItem>
                  <SelectItem className="cursor-pointer"  value="course">Course</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-40 cursor-pointer text-slate-200">
                  <SelectValue placeholder="Sort">
                    <span className="text-slate-400">{sortBy === "newest" ? "Newest" : sortBy}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer"  value="newest">Newest</SelectItem>
                  <SelectItem className="cursor-pointer"  value="oldest">Oldest</SelectItem>
                  <SelectItem className="cursor-pointer"  value="title_asc">Title A–Z</SelectItem>
                  <SelectItem className="cursor-pointer"  value="pinned">Pinned first</SelectItem>
                </SelectContent>
              </Select>

              <Button size="sm" variant={showAnalytics ? "secondary" : "ghost"} onClick={() => setShowAnalytics((v) => !v)} className="cursor-pointer" title="Toggle analytics">
                <BarChart3 className={`w-4 h-4 ${showAnalytics ? "text-emerald-300" : "text-zinc-300"}`} />
              </Button>
            </div>

            {/* small screens: icons right */}
            <div className="md:hidden flex items-center gap-2">
              <button className="p-2 rounded-md bg-zinc-900/50 cursor-pointer" onClick={() => setMobileOpen((v) => !v)} aria-label="Open filters">
                <Search size={18} className="text-slate-200" />
              </button>
              <button className="p-2 rounded-md bg-emerald-500 cursor-pointer" onClick={() => setShowAnalytics((v) => !v)} title="Analytics">
                <BarChart3 size={18} className="text-black" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile overlay dropdown (absolute positioned under header) */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <div
                ref={mobileOverlayRef}
                className="absolute left-0 right-0 top-full mt-1 z-40 bg-[#071b16] border-b border-zinc-800 shadow-lg md:hidden"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-md px-2 py-1">
                    <Search className="text-zinc-400" size={16} />
                    <input
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search notes..."
                      className="bg-transparent text-slate-200 placeholder-zinc-500 focus:outline-none w-full"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v)}>
                      <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200">
                        <SelectValue placeholder="All courses" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100">
                        <SelectItem className="cursor-pointer"  value="all">All</SelectItem>
                        {courses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      <Select value={selectedVisibility} onValueChange={(v) => setSelectedVisibility(v)}>
                        <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200">
                          <SelectValue placeholder="Visibility" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 text-slate-100">
                          <SelectItem className="cursor-pointer"  value="all">All</SelectItem>
                          <SelectItem className="cursor-pointer"  value="public">Public</SelectItem>
                          <SelectItem className="cursor-pointer"  value="course">Course</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                        <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full text-slate-200">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 text-slate-100">
                          <SelectItem className="cursor-pointer"  value="newest">Newest</SelectItem>
                          <SelectItem className="cursor-pointer"  value="oldest">Oldest</SelectItem>
                          <SelectItem className="cursor-pointer"  value="title_asc">Title A–Z</SelectItem>
                          <SelectItem className="cursor-pointer"  value="pinned">Pinned first</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col  gap-2 pt-1">
                      <Button className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-400" onClick={() => { setSelectedVisibility("public"); setSelectedCourse("all"); setMobileOpen(false); }}>
                        Show Public
                      </Button>
                      <Button className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-400" onClick={() => { setSelectedVisibility("course"); setMobileOpen(false); }}>
                        Show Course
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    );
  }

  function NoteCard({ note }) {
    return (
      <motion.div
        key={note.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        whileHover={{ scale: 1.01 }}
        className={`p-4 rounded-lg bg-zinc-800/60 border ${note.pinned ? "border-emerald-500/40 shadow-md" : "border-zinc-700"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <div className="text-lg font-semibold text-slate-100 truncate">{note.title}</div>
            </div>
            <div className="text-xs text-zinc-400 mt-1">{note.author?.full_name || "—"} • {shortDate(note.created_at)}</div>
          </div>

          <div className="flex items-center gap-2">
            {note.file_url && (
              <button
                onClick={() => openQrPopup(note.file_url)}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-emerald-300 hover:underline text-sm flex items-center gap-1 cursor-pointer"
                title="Open resource QR & actions"
              >
                <ExternalLink className="w-4 h-4" /> Resource
              </button>
            )}
            <button
              onClick={() => openPreview(note)}
              className="p-2 rounded-md bg-zinc-900/40 hover:bg-zinc-900/60 cursor-pointer"
              title="Preview note"
            >
              <Eye className="w-4 h-4 text-yellow-200" />
            </button>
            
          </div>
        </div>

        {note.description && (
          <div className="mt-3 text-sm text-zinc-300 line-clamp-4" dangerouslySetInnerHTML={{ __html: safeHtml(note.description) }} />
        )}

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
            {note.course_id && <div className="text-xs text-zinc-400">Course: <span className="text-emerald-300 font-medium">{note.courses?.title || "—"}</span></div>}
          </div>

          <div className="text-xs text-zinc-400">{note.view_count ? `${note.view_count} views` : ""}</div>
        </div>
      </motion.div>
    );
  }

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1B1E] via-[#1a1a1a] to-[#000000] text-slate-100">
      <Header />

      <main className="max-w-7xl mx-auto p-6">
        {/* Analytics (responsive stacking on small screens) */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-zinc-900/60 border border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-zinc-400">Total notes: <span className="font-semibold text-slate-100">{analyticsData.total}</span></div>
                    <div className="mt-3 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.byCourse} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/60 border border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">By Visibility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-3 h-48 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analyticsData.pie} dataKey="value" nameKey="name" outerRadius={80} label>
                            {analyticsData.pie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <ReTooltip
                              contentStyle={{
                          backgroundColor: "#508678",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/60 border border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-3 space-y-2">
                      <Button size="sm" className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-600" onClick={() => { setSelectedVisibility("public"); setSelectedCourse("all"); }}>Show Public</Button>
                      <Button size="sm" className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-600" onClick={() => { setSelectedVisibility("course"); }}>Show Course Notes</Button>
                      <Button size="sm" className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-600" onClick={() => { setSearch(""); setSelectedCourse("all"); setSelectedVisibility("all"); setSortBy("newest"); }}>Reset Filters</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes grid */}
        <Card className="bg-zinc-900/60 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-300">Available Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-full pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonNoteCard key={i} />)
                ) : filteredNotes.length === 0 ? (
                  <div className="col-span-full text-center text-zinc-500 p-8 rounded-xl bg-zinc-900/40 border border-zinc-800">
                    <div className="text-xl font-semibold text-slate-100 mb-2">No notes found</div>
                    <p className="text-sm text-zinc-400">Try adjusting filters or come back later.</p>
                  </div>
                ) : (
                  filteredNotes.map((note) => <NoteCard key={note.id} note={note} />)
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      {/* Preview Drawer */}
      <AnimatePresence>
        {preview && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-end p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full md:w-96 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-auto" initial={{ x: 60 }} animate={{ x: 0 }} exit={{ x: 60 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-emerald-300">{preview.title}</h3>
                  <div className="text-xs text-zinc-400 mt-1">{preview.author?.full_name || "—"} • {humanDate(preview.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {preview.file_url && (
                    <button onClick={() => openQrPopup(preview.file_url)} className="p-2 rounded hover:bg-zinc-800/40 text-emerald-300 cursor-pointer" title="Resource QR & actions">
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  )}
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => closePreview()}>Close</Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => setPreviewTab("details")} className={`flex items-center gap-2 px-3 py-1 rounded ${previewTab === "details" ? "bg-emerald-500 text-black" : "bg-zinc-900/40 text-slate-200"} cursor-pointer`}>
                  <List className="w-4 h-4" /> Details
                </button>
                <button onClick={() => setPreviewTab("meta")} className={`flex items-center gap-2 px-3 py-1  rounded ${previewTab === "meta" ? "bg-emerald-500 text-black" : "bg-emerald-300/30 text-slate-200"} cursor-pointer`}>
                  <Info className="w-4 h-4" /> Meta
                </button>
                {preview.file_url && (
                  <a href={preview.file_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-emerald-300 flex items-center gap-1 cursor-pointer">
                    Open resource <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              <div className="mt-4">
                {previewTab === "details" ? (
                  <div className="prose prose-invert text-sm max-w-full" dangerouslySetInnerHTML={{ __html: safeHtml(preview.description) }} />
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
                        <div className="flex items-center gap-2 mt-1">
                          <a href={preview.file_url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline flex items-center gap-2 cursor-pointer">
                            <LinkIcon className="w-4 h-4" /> Visit
                          </a>
                          <button onClick={() => openQrPopup(preview.file_url)} className="text-sm text-zinc-200 px-2 py-1 rounded bg-zinc-900/40 cursor-pointer">QR</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-zinc-400">Visibility: <span className="text-emerald-300 font-medium">{preview.visibility}</span></div>
                <div className="flex gap-2">
                  <Button size="sm" className="cursor-pointer" onClick={() => closePreview()}>Close</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Dialog */}
      <AnimatePresence>
        {showQrDialog && qrUrl && (
          <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-emerald-300">Resource QR & Actions</h3>
                <button className="p-2 rounded hover:bg-zinc-900/30 cursor-pointer" onClick={closeQrPopup} aria-label="Close QR popup">
                  <X className="text-slate-200" />
                </button>
              </div>

              <div className="mt-4 flex flex-col items-center gap-4">
                <div id="student-qr-svg" ref={qrSvgRef} className="bg-white p-4 rounded">
                  <QRCode value={qrUrl} size={160} />
                </div>

                <div className="text-sm text-zinc-400 break-all text-center">{qrUrl}</div>

                <div className="w-full flex gap-2">
                  <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button className="w-full flex items-center justify-center gap-2 cursor-pointer"><ExternalLink className="w-4 h-4" /> Visit URL</Button>
                  </a>
                  <Button className="flex items-center gap-2 cursor-pointer" onClick={() => downloadQrSvg()}><Download className="w-4 h-4" /> Download QR</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
