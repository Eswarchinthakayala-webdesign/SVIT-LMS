// src/pages/AdminLinksManager.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Link as LinkIcon,
  Trash,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  User,
  Edit3,
  Copy,
  MoreHorizontal,
  Search as SearchIcon,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Tag as TagIcon,
} from "lucide-react";

import {
  PieChart, Pie, Cell,
  ResponsiveContainer, AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip as ReTooltip,
  BarChart, Bar, Legend
} from "recharts";


/* -----------------------
   Constants / Styles
   ----------------------- */
const LINK_TYPE_COLORS = {
  classroom: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
  meeting: "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40",
  resource: "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40",
  other: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40",
};

const TAG_COLORS = {
  Important: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40",
  Assignment: "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40",
  Reference: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40",
  Default: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-500/40",
};

const CardEnter = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
};

/* -----------------------
   Component
   ----------------------- */
export default function AdminLinksManager() {
  // UI tabs
  const [tab, setTab] = useState("course");

  // data
  const [courses, setCourses] = useState([]);
  const [tags, setTags] = useState([]);

  const [links, setLinks] = useState([]); // from vw_course_links_with_meta
  const [studentLinks, setStudentLinks] = useState([]); // from vw_student_links_with_meta

  // loading
  const [loading, setLoading] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const searchRef = useRef("");
  const [filterCourse, setFilterCourse] = useState(""); // '' means all
  const [filterTags, setFilterTags] = useState([]); // array of tag strings
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, title, most_clicked, most_voted

  // selection for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [dailyClicks, setDailyClicks] = useState([]);
  // form add/edit
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [form, setForm] = useState({
    title: "",
    url: "",
    link_type: "classroom",
    course_id: "",
    expiry_date: null,
    tags: [],
  });

  // analytics
  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks7d: 0,
    activeLinks: 0,
    distribution: [],
    courseCounts: [],
  });
    const topLinksData = useMemo(() => {
    return (links || [])
      .sort((a, b) => (b.click_count || 0) - (a.click_count || 0))
      .slice(0, 5)
      .map((l) => ({
        title: l.title,
        clicks: l.click_count || 0,
        votes: l.votes || 0,
      }));
  }, [links]);

  // user profile (to conditionally show admin actions)
  const [profile, setProfile] = useState(null);

  // pagination
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // delete confirmations
  const [deleteId, setDeleteId] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  /* -----------------------
     Effects
     ----------------------- */

  // debounce search and refresh when filters change
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchRef.current !== search) {
        searchRef.current = search;
        refreshAll();
      }
    }, 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [search]);

  // initial fetch
  useEffect(() => {
    fetchProfile();
    fetchCourses();
    fetchTags();
    refreshAll();
    fetchAnalytics();
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
    // eslint-disable-next-line
  }, []);

  // reload when tab changes
  useEffect(() => {
    refreshAll();
    setSelectedIds(new Set());
    setSelectAll(false);
    // eslint-disable-next-line
  }, [tab]);

  // refresh immediately when other filters change
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line
  }, [filterCourse, filterTags, sortBy]);

  // refresh tag list when links change (crud)
  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line
  }, [links]);

  /* -----------------------
     Data fetching helpers
     ----------------------- */

  // fetch current user's profile using supabase v2 API
  async function fetchProfile() {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.error("auth.getUser error:", userErr);
        return;
      }
      const user = userData?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,role,email")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("fetchProfile error:", error);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error("fetchProfile", err);
    }
  }

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title").order("title", { ascending: true });
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses", err);
    }
  }

  async function fetchTags() {
    try {
      const { data, error } = await supabase.from("link_tags").select("tag").order("tag", { ascending: true }).limit(1000);
      if (error) throw error;
      const uniqueTags = Array.from(new Set((data || []).map((r) => r.tag))).sort();
      setTags(uniqueTags);
    } catch (err) {
      console.error("fetchTags", err);
    }
  }

  // analytics summary
  // analytics summary
async function fetchAnalytics() {
  try {
    // total links (count)
    const { count: totalCount } = await supabase
      .from("course_links")
      .select("*", { count: "exact", head: true });

    // total clicks last 7 days (count)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: clicks7dCount } = await supabase
      .from("link_clicks")
      .select("*", { count: "exact", head: true })
      .gt("clicked_at", sevenDaysAgo);

    // distribution by type using RPC if available
    let distribution = [];
    try {
      const { data: distro, error: distroErr } = await supabase.rpc(
        "get_link_type_distribution"
      );
      if (!distroErr && distro) distribution = distro;
    } catch (e) {
      console.warn("rpc get_link_type_distribution not available");
    }

    // fetch raw clicks for last 7d (for charts)
    const { data: rawClicks, error: clicksErr } = await supabase
      .from("link_clicks")
      .select("clicked_at")
      .gte("clicked_at", sevenDaysAgo);

    if (clicksErr) throw clicksErr;

    // group by day
    const counts = {};
    (rawClicks || []).forEach((row) => {
      const d = new Date(row.clicked_at);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      counts[label] = (counts[label] || 0) + 1;
    });

    // ensure 7 days filled
    const daily = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return { day: label, clicks: counts[label] || 0 };
    });

    // save analytics
  setStats((s) => ({
  ...s,
  totalLinks: totalCount || 0,
  totalClicks7d: clicks7dCount || 0,
  distribution: (distribution || []).map((d, idx) => ({
    name: d.name || d.link_type || "Other",
    value: d.value || d.count || 0,
    color: ["#10b981", "#06b6d4", "#7c3aed", "#f59e0b", "#ef4444"][idx % 5],
  })),
  dailyClicks: daily,
}));

    
  } catch (err) {
    console.error("fetchAnalytics", err);
  }
}

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div
        style={{
          backgroundColor: "#18181b",
          border: "1px solid #333",
          borderRadius: "10px",
          padding: "8px 12px",
          color: "#22c55e",
          fontSize: "14px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontWeight: 600 }}>{data.name}</div>
        <div style={{ color: "#e5e5e5" }}>Links: {data.value}</div>
      </div>
    );
  }
  return null;
};

  /* -----------------------
     Main fetch functions
     ----------------------- */

  // fetch course links (with filters & pagination)
  async function fetchLinks(reset = true) {
    setLoading(true);
    try {
      const fromView = "vw_course_links_with_meta";
      let query = supabase.from(fromView).select("*");

      // search
      if (search) query = query.ilike("title", `%${search}%`);

      // course filter (filterCourse state is '' when "all")
      if (filterCourse) query = query.eq("course_id", filterCourse);

      // tags filter
      if (filterTags && filterTags.length > 0) {
        const { data: lt, error: ltErr } = await supabase.from("link_tags").select("link_id").in("tag", filterTags);
        console.log(lt)
        if (ltErr) throw ltErr;
        const ids = Array.from(new Set((lt || []).map((r) => r.link_id)));
        if (ids.length === 0) {
          setLinks([]);
          setLoading(false);
          return;
        }
        query = query.in("id", ids);
      }

      // sort
      switch (sortBy) {
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "oldest":
          query = query.order("created_at", { ascending: true });
          break;
        case "title":
          query = query.order("title", { ascending: true });
          break;
        case "most_clicked":
          query = query.order("click_count", { ascending: false });
          break;
        case "most_voted":
          query = query.order("votes", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      // pagination
      if (reset) {
        setPage(0);
        query = query.range(0, PAGE_SIZE - 1);
      } else {
        const start = (page + 1) * PAGE_SIZE;
        query = query.range(start, start + PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (reset) setLinks(data || []);
      else setLinks((prev) => [...prev, ...(data || [])]);

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      console.error("fetchLinks", err);
      toast.error("Failed to load links");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStudentLinks() {
    setLoading(true);
    try {
      let query = supabase.from("vw_student_links_with_meta").select("*");
      if (filterCourse) query = query.eq("course_id", filterCourse);
      if (search) query = query.ilike("title", `%${search}%`);
      const { data, error } = await query.order("created_at", { ascending: false }).range(0, 200);
      if (error) throw error;
      setStudentLinks(data || []);
    } catch (err) {
      console.error("fetchStudentLinks", err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    if (tab === "course") await fetchLinks(true);
    else await fetchStudentLinks();
  }

  async function loadMore() {
    if (!hasMore) return;
    setPage((p) => p + 1);
    await fetchLinks(false);
  }

  /* -----------------------
     Keyboard shortcuts
     ----------------------- */
  function handleShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const el = document.getElementById("links-search-input");
      if (el) el.focus();
    }
    if (e.shiftKey && e.key.toLowerCase() === "a") setIsAddOpen(true);
  }

  /* -----------------------
     Selection toggles
     ----------------------- */
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      setSelectAll(false);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(links.map((l) => l.id));
      setSelectedIds(allIds);
      setSelectAll(true);
    }
  }

  /* -----------------------
     Add / Edit handling
     ----------------------- */
  function openEdit(link) {
    setEditingLink(link);
    setForm({
      title: link.title,
      url: link.url,
      link_type: link.link_type || "other",
      course_id: link.course_id,
      expiry_date: link.expiry_date ? new Date(link.expiry_date) : null,
      tags: link.tags || [],
    });
    setIsAddOpen(true);
  }

  function resetForm() {
    setEditingLink(null);
    setForm({
      title: "",
      url: "",
      link_type: "classroom",
      course_id: "",
      expiry_date: null,
      tags: [],
    });
  }

  async function saveForm() {
    if (!form.title || !form.url || !form.course_id) {
      toast.error("Please fill title, url and course");
      return;
    }
    try {
      if (editingLink) {
        const { error } = await supabase
          .from("course_links")
          .update({
            title: form.title,
            url: form.url,
            link_type: form.link_type,
            course_id: form.course_id,
            expiry_date: form.expiry_date ? form.expiry_date.toISOString() : null,
          })
          .eq("id", editingLink.id);
        if (error) throw error;

        // replace tags
        await supabase.from("link_tags").delete().eq("link_id", editingLink.id);
        if (form.tags && form.tags.length > 0) {
          const insertPayload = form.tags.map((t) => ({ link_id: editingLink.id, tag: t }));
          await supabase.from("link_tags").insert(insertPayload);
        }

        toast.success("Link updated");
      } else {
        // find current user id (profile should already be loaded)
        const insertPayload = {
          title: form.title,
          url: form.url,
          link_type: form.link_type,
          course_id: form.course_id,
          expiry_date: form.expiry_date ? form.expiry_date.toISOString() : null,
          created_by: profile?.id || null,
        };
        const { data, error } = await supabase.from("course_links").insert([insertPayload]).select().single();
        if (error) throw error;
        const newId = data.id;
        if (form.tags && form.tags.length > 0) {
          const tagRows = form.tags.map((t) => ({ link_id: newId, tag: t }));
          await supabase.from("link_tags").insert(tagRows);
        }
        toast.success("Link added");
      }

      resetForm();
      setIsAddOpen(false);
      fetchTags();
      refreshAll();
    } catch (err) {
      console.error("saveForm", err);
      toast.error("Save failed");
    }
  }

  /* -----------------------
     Delete handlers (with AlertDialog)
     ----------------------- */
  async function confirmDeleteSingle() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("course_links").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Deleted");
      setDeleteId(null);
      refreshAll();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  }

  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("course_links").delete().in("id", ids);
      if (error) throw error;
      toast.success("Deleted selected");
      setSelectedIds(new Set());
      setSelectAll(false);
      setBulkDeleteOpen(false);
      refreshAll();
    } catch (err) {
      console.error(err);
      toast.error("Bulk delete failed");
    }
  }

  /* -----------------------
     Copy, Open, Vote
     ----------------------- */
  async function handleCopy(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied URL");
    } catch (err) {
      console.error("copy failed", err);
      toast.error("Copy failed");
    }
  }

  async function handleOpen(link) {
    try {
      // open link immediately
      window.open(link.url, "_blank");

      // get user
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      // insert click
      await supabase.from("link_clicks").insert([{ link_id: link.id, user_id: user?.id || null }]);

      // optimistic update
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, click_count: (l.click_count || 0) + 1 } : l)));
    } catch (err) {
      console.error("open/link_click", err);
    }
  }

  async function handleVote(linkId, voteValue) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        toast.error("Please sign in to vote");
        return;
      }
      const payload = { link_id: linkId, user_id: user.id, vote: voteValue };
      const { error } = await supabase.from("link_votes").upsert(payload, { onConflict: ["link_id", "user_id"] });
      if (error) throw error;

      // optimistic update (simple)
      setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, votes: Math.max(0, (l.votes || 0) + voteValue) } : l)));
    } catch (err) {
      console.error("vote", err);
      toast.error("Vote failed");
    }
  }

  /* -----------------------
     Inline edit
     ----------------------- */
  async function saveInlineTitle(linkId, newTitle) {
    try {
      const { error } = await supabase.from("course_links").update({ title: newTitle }).eq("id", linkId);
      if (error) throw error;
      setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, title: newTitle } : l)));
      toast.success("Title saved");
    } catch (err) {
      console.error("saveInline", err);
      toast.error("Save failed");
    }
  }

  /* -----------------------
     Helpers
     ----------------------- */
  function isAdmin() {
    return profile?.role === "admin";
  }

  function badgeForType(type) {
    const t = type || "other";
    const classes = LINK_TYPE_COLORS[t] || LINK_TYPE_COLORS.other;
    const label = t === "classroom" ? "Classroom" : t === "meeting" ? "Meeting" : t === "resource" ? "Resource" : "Other";
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
        {label}
      </span>
    );
  }

  function tagChip(t) {
    const cls = TAG_COLORS[t] || TAG_COLORS.Default;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1 ${cls}`}>
        <TagIcon className="w-3 h-3 opacity-80" />
        {t}
      </span>
    );
  }

  // donut data computed client-side
  const donutData = useMemo(() => {
    const counts = { classroom: 0, meeting: 0, resource: 0, other: 0 };
    links.forEach((l) => (counts[l.link_type || "other"] += 1));
    return [
      { name: "Classroom", value: counts.classroom, color: "#10b981" },
      { name: "Meeting", value: counts.meeting, color: "#0ea5e9" },
      { name: "Resource", value: counts.resource, color: "#7c3aed" },
      { name: "Other", value: counts.other, color: "#94a3b8" },
    ];
  }, [links]);

  /* -----------------------
     UI Render
     ----------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      {/* Header */}
      <header className="w-full bg-zinc-900/60 backdrop-blur border-b border-zinc-800 px-6 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <LinkIcon className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-semibold text-emerald-300">Links Manager</h1>
              <p className="text-sm text-zinc-400">Manage course links, student work and monitor engagement.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 text-sm text-zinc-300">
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">Total links: <strong className="ml-1 text-emerald-300">{links.length}</strong></div>
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">Clicks (7d): <strong className="ml-1 text-emerald-300">{stats.totalClicks7d}</strong></div>
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">Active: <strong className="ml-1 text-emerald-300">{links.filter(l => !l.expiry_date || new Date(l.expiry_date) > new Date()).length}</strong></div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-slate-200 hover:text-emerald-300"
                onClick={() => {
                  refreshAll();
                  fetchAnalytics();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-medium"
                  onClick={() => {
                    setIsAddOpen(true);
                    resetForm();
                  }}
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Add Link
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className=" border bg-emerald-400 border-zinc-700 rounded-xl">
            <TabsTrigger className="cursor-pointer" value="course">Course Links</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="student">Student Links</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Course Links Tab */}
          <TabsContent value="course">
            <div className="grid grid-cols-1  lg:grid-cols-4 gap-6">
              {/* Sidebar */}
             <aside className=" w-full  lg:col-span-1 space-y-4">
  {/* Courses Card */}
  <Card className="bg-zinc-900/60 border  border-zinc-800 shadow-lg rounded-2xl p-4 lg:sticky lg:top-28">
    <div className="flex items-center">
      <CardTitle className="text-emerald-300 text-base">Courses</CardTitle>
      <Tooltip content="Refresh courses">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-200"
          onClick={fetchCourses}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>

    <div className="mt-3 text-sm text-zinc-300 space-y-2 max-h-56 overflow-y-auto">
      <button
        className={`flex items-center justify-between w-full text-left px-2 py-1 rounded ${
          !filterCourse ? "bg-zinc-800/30" : "hover:bg-zinc-800/30"
        }`}
        onClick={() => setFilterCourse("")}
      >
        <span>All courses</span>
        <span className="text-zinc-400 text-xs">{links.length}</span>
      </button>

      {courses.map((c) => {
        const count = links.filter((l) => l.course_id === c.id).length;
        return (
          <button
            key={c.id}
            className={`flex items-center justify-between w-full text-left px-2 py-1 rounded ${
              filterCourse === c.id
                ? "bg-zinc-800/30"
                : "hover:bg-zinc-800/20"
            }`}
            onClick={() => setFilterCourse(c.id)}
          >
            <span className="truncate">{c.title}</span>
            <span className="text-zinc-400 text-xs">{count}</span>
          </button>
        );
      })}
    </div>
  </Card>

  {/* Type Distribution */}
  <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4">
    <CardTitle className="text-emerald-300 text-base">
      Type Distribution
    </CardTitle>
    <div className="h-48 sm:h-56 md:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donutData}
            dataKey="value"
            nameKey="name"
            innerRadius={38}
            outerRadius={56}
          >
            {donutData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  </Card>
</aside>

              {/* Main content */}
              <section className="col-span-3 space-y-4">
                {/* Filters bar - sticky */}
<div className="sticky top-24 z-40 bg-transparent">
  <Card className="bg-zinc-900/60 border border-zinc-800 shadow-md rounded-2xl p-3">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row flex-1 gap-2">
        
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
          <Input
            id="links-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search links by title or URL..."
            className="pl-10 bg-zinc-900 border border-zinc-700 text-slate-100 placeholder:text-zinc-500 w-full"
          />
        </div>

        {/* Course select */}
        <Select
          value={filterCourse || "all"}
          onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}
        >
          <SelectTrigger className="bg-zinc-900 border text-emerald-400 border-zinc-700 w-full sm:w-56 focus:ring-emerald-500 focus:border-emerald-500">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
            <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem className="cursor-pointer" key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort select */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
          <SelectTrigger className="bg-zinc-900 border text-emerald-400 border-zinc-700 w-full sm:w-48 focus:ring-emerald-500 focus:border-emerald-500">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
            <SelectItem className="cursor-pointer" value="newest">Newest</SelectItem>
            <SelectItem className="cursor-pointer" value="oldest">Oldest</SelectItem>
            <SelectItem className="cursor-pointer" value="title">Title (A → Z)</SelectItem>
            <SelectItem className="cursor-pointer" value="most_clicked">Most Clicked</SelectItem>
            <SelectItem className="cursor-pointer" value="most_voted">Most Voted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="ghost"
          className="text-slate-200"
          onClick={() => {
            setSelectedIds(new Set());
            setSelectAll(false);
            refreshAll();
          }}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="border-zinc-700 text-slate-200"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-zinc-900 border border-zinc-700 text-slate-100">
            <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)}>
              Delete selected
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(
                  JSON.stringify(Array.from(selectedIds))
                );
                toast.success("IDs copied");
              }}
            >
              Copy selected ids
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </Card>
</div>


                {/* Cards list */}
<Card className="bg-zinc-900/60 border  border-zinc-800 shadow-lg rounded-2xl p-4">
  <CardHeader>
    <CardTitle className="text-emerald-300">Course Links</CardTitle>
  </CardHeader>

  <CardContent>
    {/* Top bar: select all + bulk delete */}
    <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={selectAll}
          onCheckedChange={toggleSelectAll}
          className="border border-zinc-600 rounded-md
                     data-[state=checked]:bg-emerald-600
                     data-[state=checked]:border-emerald-600
                     data-[state=checked]:text-white
                     transition-colors"
        />
        <div className="text-sm text-zinc-400">Select all</div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="text-zinc-400">
          Selected:
          <strong className="text-slate-100 ml-1">{selectedIds.size}</strong>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setBulkDeleteOpen(true)}
          className="text-rose-400 hover:text-rose-300 cursor-pointer"
        >
          Delete
        </Button>
      </div>
    </div>

    {/* Scrollable links */}
    <ScrollArea className="max-h-[65vh] overflow-auto pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {links.length === 0 && !loading ? (
            <EmptyState
              onAdd={() => {
                setIsAddOpen(true);
                resetForm();
              }}
            />
          ) : (
            links.map((link, idx) => (
              <motion.div
                key={link.id}
                {...CardEnter}
                transition={{ delay: idx * 0.03, duration: 0.28 }}
                className="p-4 bg-zinc-800/40 border border-zinc-700 rounded-xl hover:bg-zinc-800/60 transform hover:-translate-y-0.5 transition cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-1">
                    <Checkbox
                      checked={selectedIds.has(link.id)}
                      onCheckedChange={() => toggleSelect(link.id)}
                      className="border border-zinc-600 rounded-md
                                 data-[state=checked]:bg-emerald-600
                                 data-[state=checked]:border-emerald-600
                                 data-[state=checked]:text-white
                                 transition-colors cursor-pointer"
                    />
                  </div>

                  <div className="flex-1">
                    {/* Title + badges */}
                    <div className="flex flex-col  items-start  justify-between gap-3">
                      <InlineTitle
                        title={link.title}
                        linkId={link.id}
                        onSave={saveInlineTitle}
                      />
                      <div className="flex flex-wrap flex-row items-center gap-2">
                        <div>{badgeForType(link.link_type)}</div>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-700/40 text-slate-200"
                        >
                          {link.course_title}
                        </Badge>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <div className="inline-flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-400" />
                        <span className="truncate">{link.author_name || "—"}</span>
                      </div>

                      <Separator
                        orientation="vertical"
                        className="h-3 w-px bg-zinc-700 mx-1 hidden sm:block"
                      />

                      <span className="whitespace-nowrap">{new Date(link.created_at).toLocaleString()}</span>

                      {link.expiry_date && (() => {
                        const diff = (new Date(link.expiry_date) - new Date()) / (1000 * 3600 * 24);
                        if (diff < 0)
                          return <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-600/20 text-rose-300 ring-1 ring-rose-600/40 text-xs">Expired</span>;
                        if (diff < 7)
                          return <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 text-xs">Expires in {Math.ceil(diff)}d</span>;
                        return (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-zinc-700/40 text-zinc-300 ring-1 ring-zinc-600/40 text-xs">
                            Expires: {new Date(link.expiry_date).toLocaleDateString()}
                          </span>
                        );
                      })()}

                      {/* Tags */}
                      <div className="flex items-center gap-1 ml-auto">
                        {(link.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className="text-xs cursor-pointer">
                            {tagChip(t)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-sm text-zinc-300">
                        <div className="inline-flex items-center gap-1">
                          <Eye className="w-4 h-4" /> <span className="text-xs">{link.click_count || 0}</span>
                        </div>
                        <div className="inline-flex items-center text-emerald-400 hover:text-emerald-400  gap-1">
                          <ThumbsUp className="w-4 h-4  " />{" "}
                          <span className="text-xs">{Math.max(0, link.votes || 0)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4  justify-end items-center gap-1">
                        <Tooltip content="Open">
                          <Button size="sm" variant="ghost" className="text-slate-200 cursor-pointer" onClick={() => handleOpen(link)}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Tooltip>

                        <Tooltip content="Copy URL">
                          <Button size="sm" variant="ghost" className="text-slate-200 cursor-pointer" onClick={() => handleCopy(link.url)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </Tooltip>

                        <Tooltip content="Upvote">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-600/50 text-emerald-300 hover:bg-emerald-600/10 hover:text-emerald-500 cursor-pointer"
                            onClick={() => handleVote(link.id, 1)}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                        </Tooltip>

                        <Tooltip content="Downvote">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-600/50 text-rose-300 hover:bg-rose-600/10 hover:text-red-600 cursor-pointer"
                            onClick={() => handleVote(link.id, -1)}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                        </Tooltip>

                        {/* Admin controls: Edit + Delete (AlertDialog) */}
                        {isAdmin() ? (
                          <>
                            <Tooltip content="Edit">
                              <Button size="sm" variant="ghost" className="text-slate-200 cursor-pointer" onClick={() => openEdit(link)}>
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </Tooltip>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-400 hover:text-rose-300 cursor-pointer"
                                  onClick={() => setDeleteId(link.id)}
                                >
                                  <Trash className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>

                              <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this link?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">
                                    This action cannot be undone. The link will be permanently removed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-900 border border-zinc-700 text-slate-100">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-500 text-slate-100"
                                    onClick={confirmDeleteSingle}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-slate-200 cursor-pointer">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-zinc-900 border border-zinc-700 text-slate-100">
                              <DropdownMenuItem onClick={() => handleCopy(link.url)}>Copy URL</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpen(link)}>Open</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" className="border-zinc-700 text-slate-200 cursor-pointer" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </ScrollArea>
  </CardContent>
</Card>


              </section>
            </div>
          </TabsContent>

          {/* Student Links Tab */}
          <TabsContent value="student">
            <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="text-emerald-300">Student Work Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <Select value={filterCourse || "all"} onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}>
                      <SelectTrigger className="bg-zinc-900 border text-emerald-200 border-zinc-700 w-56 focus:ring-emerald-500 focus:border-emerald-500">
                        <SelectValue placeholder="Filter by course" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                        <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                        {courses.map((c) => (
                          <SelectItem className="cursor-pointer" key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Search by title..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-slate-100 placeholder:text-zinc-500"
                    />
                  </div>
                </div>

                <ScrollArea className="max-h-[70vh] pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentLinks.length === 0 && !loading ? (
                      <EmptyStateStudent onAdd={() => toast("Ask students to share links")} />
                    ) : (
                      studentLinks.map((link) => (
                        <motion.div
                          key={link.id}
                          {...CardEnter}
                          transition={{ duration: 0.2 }}
                          className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:bg-zinc-800/70 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-200">{link.title}</h3>
                              <p className="text-xs text-zinc-400">
                                {link.course_title} • {link.link_type}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-sm text-slate-300">
                                <User className="w-4 h-4 text-emerald-400" /> {link.student_name} ({link.student_id})
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => window.open(link.url, "_blank")}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => handleCopy(link.url)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              {isAdmin() && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteId(link.id)}
                                  className="text-rose-400 hover:text-rose-300"
                                >
                                  <Trash className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
           <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4">
  <CardHeader>
    <CardTitle className="text-emerald-300">Analytics</CardTitle>
  </CardHeader>

  <CardContent>
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* KPI Tiles */}
  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">Total Links</div>
    <div className="text-2xl font-semibold text-slate-100">{links.length}</div>
  </div>

  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">Clicks (7d)</div>
    <div className="text-2xl font-semibold text-slate-100">{stats.totalClicks7d}</div>
  </div>

  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">Active Links</div>
    <div className="text-2xl font-semibold text-slate-100">
      {links.filter((l) => !l.expiry_date || new Date(l.expiry_date) > new Date()).length}
    </div>
  </div>

  {/* Area Chart: Clicks trend */}
  <div className="sm:col-span-2 bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 h-64">
    <div className="text-sm text-zinc-400 mb-2">Clicks Trend (7d)</div>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={stats.dailyClicks || []}>
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
        <ReTooltip
        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
        <Area type="monotone" dataKey="clicks" stroke="#10b981" fill="url(#g2)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>

  {/* Bar Chart: Top 5 Links */}
  <div className="bg-zinc-800/50 p-4 pb-10 rounded-lg border border-zinc-700 h-64">
    <div className="text-sm text-zinc-400 mb-2">Top 5 Links</div>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topLinksData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="title" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <ReTooltip
        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }}
         />
        <Legend />
        <Bar dataKey="clicks" fill="#10b981" />
        <Bar dataKey="votes" fill="#06b6d4" />
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* Pie Chart: Distribution */}
  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400 mb-2">Distribution</div>
    <div className="h-40 sm:h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={stats.distribution || []} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50}>
            {(stats.distribution || []).map((entry, idx) => (
              <Cell key={idx} fill={entry.color || ["#10b981", "#06b6d4", "#7c3aed", "#f59e0b", "#ef4444"][idx % 5]} />
            ))}
          </Pie>
          <ReTooltip
          content={<CustomPieTooltip/>}
           />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
</div>

  </CardContent>
</Card>

          </TabsContent>
        </Tabs>
      </main>

      {/* Add / Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(o) => setIsAddOpen(o)}>
        <DialogTrigger asChild />
        <DialogContent className="max-w-3xl border border-zinc-800 p-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="p-0"
          >
            <div className="p-5 bg-zinc-950 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-emerald-300">
                {editingLink ? "Edit Link" : "Add Link"}
              </h3>
            </div>

            {/* Sections */}
            <div className="p-5 bg-zinc-950 text-slate-100">
              {/* Link Info */}
              <SectionTitle title="Link Info" />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-slate-100 placeholder:text-zinc-500"
                    placeholder="E.g. Figma board for week 2"
                  />
                </motion.div>
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-slate-100 placeholder:text-zinc-500"
                    placeholder="https://"
                  />
                </motion.div>
              </div>

              {/* Classification */}
              <SectionTitle title="Classification" className="mt-6" />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Link Type</Label>
                  <Select value={form.link_type} onValueChange={(v) => setForm((f) => ({ ...f, link_type: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                      <SelectItem value="classroom">Classroom</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Course</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue placeholder="Course" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              </div>

              {/* Expiry + Tags */}
              <SectionTitle title="Expiry & Tags" className="mt-6" />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-zinc-900 border border-zinc-700 text-slate-100"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.expiry_date ? format(form.expiry_date, "PPP") : <span className="text-zinc-500">Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-zinc-900 border border-zinc-700">
                      <Calendar
                        mode="single"
                        selected={form.expiry_date}
                        onSelect={(date) => setForm((f) => ({ ...f, expiry_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Tags</Label>
                  <TagInput
                    value={form.tags || []}
                    onChange={(next) => setForm((f) => ({ ...f, tags: next }))}
                    suggestions={tags}
                  />
                </motion.div>
              </div>

              {/* Footer buttons */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  className="bg-zinc-900 border border-zinc-700 text-slate-100"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={saveForm} className="bg-emerald-600 hover:bg-emerald-500 text-slate-100">
                    {editingLink ? "Update" : "Create"}
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogTrigger asChild />
        <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected links?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This cannot be undone. You are about to delete {selectedIds.size} links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 border border-zinc-700 text-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-500 text-slate-100" onClick={confirmBulkDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -----------------------
   Helper Components
   ----------------------- */

function EmptyState({ onAdd }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
      <div className="p-6 rounded-full bg-zinc-800/30 mb-4">
        <LinkIcon className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">No course links yet</h3>
      <p className="text-sm mb-4">Add your first course link to help students discover resources.</p>
      <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-500 text-slate-100">
        Add course link
      </Button>
    </div>
  );
}

function EmptyStateStudent({ onAdd }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
      <div className="p-6 rounded-full bg-zinc-800/30 mb-4">
        <User className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">No student links</h3>
      <p className="text-sm mb-4">Students haven't submitted work links yet.</p>
      <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-500 text-slate-100">
        Encourage students
      </Button>
    </div>
  );
}

/* InlineTitle component: inline editing of title */
function InlineTitle({ title, linkId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title || "");
  useEffect(() => setValue(title || ""), [title]);

  async function commit() {
    if (!value || value.trim().length === 0) {
      setValue(title);
      setEditing(false);
      return;
    }
    await onSave(linkId, value.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <input
          className="bg-transparent border-b border-zinc-600 px-1 py-0.5 focus:outline-none text-slate-100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setValue(title);
            }
          }}
          onBlur={commit}
          autoFocus
        />
      ) : (
        <h3 className="text-lg font-semibold text-slate-200 cursor-text" onDoubleClick={() => setEditing(true)}>
          {title}
        </h3>
      )}
    </div>
  );
}

/* Section title */
function SectionTitle({ title, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-px flex-1 bg-zinc-800" />
      <div className="text-xs uppercase tracking-wider text-zinc-400">{title}</div>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

/* TagInput - chip entry with suggestions */
function TagInput({ value = [], onChange, suggestions = [] }) {
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState(false);

  function addTag(tag) {
    const t = (tag || "").trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...(value || []), t]);
    setInput("");
  }

  function removeTag(tag) {
    onChange((value || []).filter((x) => x !== tag));
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  const filtered = (suggestions || []).filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  ).slice(0, 6);

  return (
    <div className="w-full">
      <div
        className={`min-h-[42px] w-full rounded-md border ${
          focus ? "border-emerald-600/60 ring-2 ring-emerald-600/20" : "border-zinc-700"
        } bg-zinc-900 px-2 py-1 flex items-center gap-1 flex-wrap`}
        onClick={() => document.getElementById("tag-input-el")?.focus()}
      >
        {(value || []).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-700/50 text-slate-200"
          >
            <TagIcon className="w-3 h-3" />
            {t}
            <button
              className="ml-1 rounded hover:bg-zinc-700/70 px-1 text-zinc-300"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(t);
              }}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="tag-input-el"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={value?.length ? "" : "Add tag and press Enter"}
          className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-zinc-500 py-1"
        />
      </div>
      {filtered.length > 0 && (
        <div className="mt-1 grid grid-cols-3 gap-1">
          {filtered.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => addTag(s)}
              className="text-xs px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 text-slate-200 transition"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
