// src/pages/StudentWorkLinksPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Github,
  FileSpreadsheet,
  GraduationCap,
} from "lucide-react";

import { 
    
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,

 } from "recharts";

/* -----------------------
   Styles / constants
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

/* =======================
   StudentWorkLinksPage
   ======================= */
export default function StudentWorkLinksPage() {
  const [tab, setTab] = useState("browse");

  // auth/profile
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);

  // data
  const [enrolledCourses, setEnrolledCourses] = useState([]); // [{id,title}]
  const [adminLinks, setAdminLinks] = useState([]); // vw_course_links_with_meta for enrolled courses
  const [studentLinks, setStudentLinks] = useState([]); // vw_student_links_with_meta for current student

  // filters
  const [search, setSearch] = useState("");
  const searchRef = useRef("");
  const [filterCourse, setFilterCourse] = useState(""); // '' => all
  const [sortBy, setSortBy] = useState("newest");
  const [filterTags, setFilterTags] = useState([]);
  const [allTags, setAllTags] = useState([]);

  // ui
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [myClicks, setMyClicks] = useState([]); // store raw clicks

  // forms
  const [form, setForm] = useState({
    title: "",
    url: "",
    link_type: "other",
    course_id: "",
    expiry_date: null,
    tags: [], // only for admin links; we ignore on student_links but keep in UI for consistency (not persisted)
  });

  // analytics
  const [clicks30d, setClicks30d] = useState(0);
  const [courseClickBreakdown, setCourseClickBreakdown] = useState([]); // [{course_title, value}]
  const [topClicked, setTopClicked] = useState([]); // [{id,title,click_count} subset of adminLinks filtered by user's clicks]

  // pagination for admin links (optional)
  const PAGE_SIZE = 36;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  /* -----------------------
     Effects
     ----------------------- */
  // initial
  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line
  }, []);
  // after your useEffect([...], [])
useEffect(() => {
  if (enrolledCourses.length > 0) {
    fetchAdminLinks(true);
  }
}, [enrolledCourses]);


  // refresh when tab or filters change
  useEffect(() => {
    refreshVisible();
    // eslint-disable-next-line
  }, [tab, filterCourse, sortBy]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchRef.current !== search) {
        searchRef.current = search;
        refreshVisible();
      }
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  /* -----------------------
     Init / Fetchers
     ----------------------- */
  async function bootstrap() {
    try {
      // auth
      const { data: ud, error: ue } = await supabase.auth.getUser();
      if (ue) throw ue;
      const u = ud?.user;
      setUserId(u?.id || null);

      if (u?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role, email")
          .eq("id", u.id)
          .single();
        setProfile(prof || null);
      }

      await Promise.all([fetchEnrollments(), fetchAllTags()]);
      await refreshAll();
      await computeMyAnalytics();
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchEnrollments() {
    try {
      // courses student is enrolled in
      // enrollments: (course_id, student_id)
      const { data: rows, error } = await supabase
        .from("enrollments")
        .select("course_id, courses!inner(id,title)")
        .eq("student_id", (await supabase.auth.getUser()).data?.user?.id || "");
      if (error) throw error;
      const unique = new Map();
      (rows || []).forEach((r) => {
        if (r.courses) unique.set(r.courses.id, { id: r.courses.id, title: r.courses.title });
      });
      setEnrolledCourses(Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title)));
    } catch (e) {
      console.error("fetchEnrollments", e);
    }
  }

  async function fetchAllTags() {
    try {
      const { data, error } = await supabase.from("link_tags").select("tag").order("tag", { ascending: true }).limit(1000);
      if (error) throw error;
      const uniq = Array.from(new Set((data || []).map((x) => x.tag))).sort();
      setAllTags(uniq);
    } catch (e) {
      console.error("fetchAllTags", e);
    }
  }

  async function refreshAll() {
    if (tab === "browse") {
      await fetchAdminLinks(true);
    } else if (tab === "mywork") {
      await fetchStudentLinks();
    } else if (tab === "analytics") {
      await computeMyAnalytics();
    }
  }

  async function refreshVisible() {
    if (tab === "browse") await fetchAdminLinks(true);
    if (tab === "mywork") await fetchStudentLinks();
  }

  /* -----------------------
     Admin links (browse)
     ----------------------- */
  async function fetchAdminLinks(reset = true) {
    setLoading(true);
    try {
      // set of enrolled course IDs
      const courseIds = enrolledCourses.map((c) => c.id);
      if (courseIds.length === 0) {
        setAdminLinks([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      let query = supabase.from("vw_course_links_with_meta").select("*");

      // only enrolled
      query = query.in("course_id", filterCourse ? [filterCourse] : courseIds);

      // search title or url
      if (search) {
        query = query.or(`title.ilike.%${search}%,url.ilike.%${search}%`);
      }

      // tags
      if (filterTags.length > 0) {
        // look up link_ids that have *all* selected tags; simplify to "any" for performance
        const { data: lt } = await supabase.from("link_tags").select("link_id").in("tag", filterTags);
        const ids = Array.from(new Set((lt || []).map((r) => r.link_id)));
        if (ids.length === 0) {
          setAdminLinks([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        query = query.in("id", ids);
      }

      // sort
      switch (sortBy) {
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

      if (reset) setAdminLinks(data || []);
      else setAdminLinks((prev) => [...prev, ...(data || [])]);

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error("fetchAdminLinks", e);
      toast.error("Failed to load links");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore) return;
    setPage((p) => p + 1);
    await fetchAdminLinks(false);
  }

  async function handleOpenAdminLink(link) {
    try {
      // always open
      window.open(link.url, "_blank", "noopener,noreferrer");

      // only insert click if signed in (RLS requires auth.uid() = user_id)
      const { data: ud } = await supabase.auth.getUser();
      const u = ud?.user;
      if (!u?.id) return;

      await supabase.from("link_clicks").insert([{ link_id: link.id, user_id: u.id }]);

      // optimistic local bump
      setAdminLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, click_count: (l.click_count || 0) + 1 } : l)));
    } catch (e) {
      console.error("open/click", e);
    }
  }

  async function handleVote(linkId, value) {
    try {
      const { data: ud } = await supabase.auth.getUser();
      const u = ud?.user;
      if (!u?.id) {
        toast.error("Please sign in to vote");
        return;
      }
      const payload = { link_id: linkId, user_id: u.id, vote: value };
      const { error } = await supabase.from("link_votes").upsert(payload, { onConflict: ["link_id", "user_id"] });
      if (error) throw error;

      // optimistic (sum of votes, clamped to >= 0 in UI)
      setAdminLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, votes: Math.max(0, (l.votes || 0) + value) } : l)));
    } catch (e) {
      console.error("vote", e);
      toast.error("Vote failed");
    }
  }

  /* -----------------------
     Student links (my work)
     ----------------------- */
  function resetForm() {
    setEditRow(null);
    setForm({
      title: "",
      url: "",
      link_type: "other",
      course_id: "",
      expiry_date: null,
      tags: [],
    });
  }

  async function fetchStudentLinks() {
    setLoading(true);
    try {
      let q = supabase.from("vw_student_links_with_meta").select("*").eq("student_id", userId || "");
      if (filterCourse) q = q.eq("course_id", filterCourse);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, error } = await q.order("created_at", { ascending: false }).range(0, 300);
      if (error) throw error;
      setStudentLinks(data || []);
    } catch (e) {
      console.error("fetchStudentLinks", e);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row) {
    setEditRow(row);
    setForm({
      title: row.title || "",
      url: row.url || "",
      link_type: row.link_type || "other",
      course_id: row.course_id || "",
      expiry_date: row.expiry_date ? new Date(row.expiry_date) : null,
      tags: [], // not persisted for student_links
    });
    setIsAddOpen(true);
  }

  async function saveStudentLink() {
    if (!form.title || !form.url || !form.course_id) {
      toast.error("Please fill title, url and course");
      return;
    }
    try {
      if (!userId) {
        toast.error("Sign in required");
        return;
      }
      if (editRow) {
        const { error } = await supabase
          .from("student_links")
          .update({
            title: form.title,
            url: form.url,
            link_type: form.link_type,
            course_id: form.course_id,
            expiry_date: form.expiry_date ? form.expiry_date.toISOString() : null,
          })
          .eq("id", editRow.id)
          .eq("student_id", userId);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("student_links").insert([
          {
            title: form.title,
            url: form.url,
            link_type: form.link_type,
            course_id: form.course_id,
            expiry_date: form.expiry_date ? form.expiry_date.toISOString() : null,
            student_id: userId,
          },
        ]);
        if (error) throw error;
        toast.success("Created");
      }

      setIsAddOpen(false);
      resetForm();
      fetchStudentLinks();
    } catch (e) {
      console.error("saveStudentLink", e);
      toast.error("Save failed");
    }
  }

  async function deleteStudentLink(id) {
    try {
      const { error } = await supabase.from("student_links").delete().eq("id", id).eq("student_id", userId);
      if (error) throw error;
      toast.success("Deleted");
      fetchStudentLinks();
    } catch (e) {
      console.error("deleteStudentLink", e);
      toast.error("Delete failed");
    }
  }

  /* -----------------------
     Analytics (for the student)
     ----------------------- */
async function computeMyAnalytics() {
  try {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud?.user?.id;
    if (!uid) {
      setClicks30d(0);
      setCourseClickBreakdown([]);
      setTopClicked([]);
      setMyClicks([]);
      return;
    }

    // Build map: link_id -> {course_id, course_title, title}
    let linkQuery = supabase
      .from("vw_course_links_with_meta")
      .select("id, course_id, course_title, title");

    if (enrolledCourses.length > 0) {
      linkQuery = linkQuery.in(
        "course_id",
        filterCourse ? [filterCourse] : enrolledCourses.map((c) => c.id)
      );
    }

    const { data: linkRows } = await linkQuery.range(0, 10000);
    const idToMeta = new Map();
    (linkRows || []).forEach((r) => idToMeta.set(r.id, r));

    // last 30 days clicks
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: clicks } = await supabase
      .from("link_clicks")
      .select("link_id, clicked_at")
      .eq("user_id", uid)
      .gt("clicked_at", since)
      .order("clicked_at", { ascending: false })
      .limit(20000);

    // store raw clicks for charts
    setMyClicks(clicks || []);

    // total
    const total = (clicks || []).length;
    setClicks30d(total);

    // per-course breakdown
    const cMap = new Map();
    (clicks || []).forEach((c) => {
      const meta = idToMeta.get(c.link_id);
      if (!meta) return;
      const k = meta.course_title || "Course";
      cMap.set(k, (cMap.get(k) || 0) + 1);
    });
    const distro = Array.from(cMap.entries()).map(([course_title, value]) => ({ course_title, value }));
    setCourseClickBreakdown(distro);

    // top clicked
    const clickedIds = new Set((clicks || []).map((x) => x.link_id));
    const subset = (linkRows || [])
      .filter((l) => clickedIds.has(l.id))
      .map((l) => ({ id: l.id, title: l.title, click_count: 0 }));
    const byId = new Map(linkRows.map((l) => [l.id, l]));
    subset.forEach((s) => {
      s.click_count = byId.get(s.id)?.click_count ?? 0;
    });
    subset.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
    setTopClicked(subset.slice(0, 6));
  } catch (e) {
    console.error("computeMyAnalytics", e);
  }
}


  /* -----------------------
     Helpers
     ----------------------- */
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

  const donutData = useMemo(() => {
    const counts = { classroom: 0, meeting: 0, resource: 0, other: 0 };
    adminLinks.forEach((l) => (counts[l.link_type || "other"] += 1));
    return [
      { name: "Classroom", value: counts.classroom, color: "#10b981" },
      { name: "Meeting", value: counts.meeting, color: "#0ea5e9" },
      { name: "Resource", value: counts.resource, color: "#7c3aed" },
      { name: "Other", value: counts.other, color: "#94a3b8" },
    ];
  }, [adminLinks]);

// Example transformation (if you have raw clicks with clicked_at)
const dailyClicksSeries = useMemo(() => {
  const counts = {};
  (myClicks || []).forEach((c) => {
    const d = new Date(c.clicked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    counts[d] = (counts[d] || 0) + 1;
  });
  return Object.entries(counts).map(([day, clicks]) => ({ day, clicks }));
}, [myClicks]);


// Example for time-series: you might fetch clicks grouped by day from Supabase
// For now, fake daily series from last 7 days (replace with real aggregation)
const progressSeries = [
  { day: "Mon", tasks: 3, assignments: 1 },
  { day: "Tue", tasks: 4, assignments: 2 },
  { day: "Wed", tasks: 2, assignments: 1 },
  { day: "Thu", tasks: 5, assignments: 3 },
  { day: "Fri", tasks: 1, assignments: 0 },
  { day: "Sat", tasks: 2, assignments: 1 },
  { day: "Sun", tasks: 6, assignments: 4 },
];
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
        <div style={{ color: "#e5e5e5" }}>Clicks: {data.value}</div>
      </div>
    );
  }
  return null;
};


  /* -----------------------
     UI
     ----------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      {/* Header */}
      <header className="w-full bg-zinc-900/60 backdrop-blur border-b border-zinc-800 px-6 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <GraduationCap className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-semibold text-emerald-300">Student Work & Links</h1>
              <p className="text-sm text-zinc-400">Browse course links, submit your work, and track your activity.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 text-sm text-zinc-300">
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">Courses: <strong className="ml-1 text-emerald-300">{enrolledCourses.length}</strong></div>
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">My links: <strong className="ml-1 text-emerald-300">{studentLinks.length}</strong></div>
              <div className="px-3 py-1 rounded-md bg-zinc-800/40">My clicks (30d): <strong className="ml-1 text-emerald-300">{clicks30d}</strong></div>
            </div>

            <Button
              variant="ghost"
              className="text-slate-200 hover:text-emerald-300"
              onClick={() => {
                refreshAll();
                computeMyAnalytics();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="border bg-emerald-400 border-zinc-700 rounded-xl">
            <TabsTrigger className="cursor-pointer" value="browse">Browse</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="mywork">My Work</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Browse (admin links for enrolled courses) */}
          <TabsContent value="browse">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <aside className="w-full lg:col-span-1 space-y-4">
                {/* Courses */}
                <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4 lg:sticky lg:top-28">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-emerald-300 text-base">My Courses</CardTitle>
                    <Button variant="ghost" size="sm" className="text-slate-200" onClick={fetchEnrollments}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mt-3 text-sm text-zinc-300 space-y-2 max-h-56 overflow-y-auto">
                    <button
                      className={`flex items-center justify-between w-full text-left px-2 py-1 rounded ${!filterCourse ? "bg-zinc-800/30" : "hover:bg-zinc-800/30"}`}
                      onClick={() => setFilterCourse("")}
                    >
                      <span>All courses</span>
                      <span className="text-zinc-400 text-xs">{adminLinks.length}</span>
                    </button>

                    {enrolledCourses.map((c) => {
                      const count = adminLinks.filter((l) => l.course_id === c.id).length;
                      return (
                        <button
                          key={c.id}
                          className={`flex items-center justify-between w-full text-left px-2 py-1 rounded ${filterCourse === c.id ? "bg-zinc-800/30" : "hover:bg-zinc-800/20"}`}
                          onClick={() => setFilterCourse(c.id)}
                        >
                          <span className="truncate">{c.title}</span>
                          <span className="text-zinc-400 text-xs">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* Type distribution */}
                <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4">
                  <CardTitle className="text-emerald-300 text-base">Type Distribution</CardTitle>
                  <div className="h-48 sm:h-56 md:h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={56}>
                          {donutData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </aside>

              {/* Main pane */}
              <section className="col-span-3 space-y-4">
                {/* Filters */}
                <div className="sticky top-24 z-40 bg-transparent">
                  <Card className="bg-zinc-900/60 border border-zinc-800 shadow-md rounded-2xl p-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex flex-col sm:flex-row flex-1 gap-2">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                          <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                          <Input
                            id="browse-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title or URL…"
                            className="pl-10 bg-zinc-900 border border-zinc-700 text-slate-100 placeholder:text-zinc-500 w-full"
                          />
                        </div>

                        {/* Course select */}
                        <Select value={filterCourse || "all"} onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}>
                          <SelectTrigger className="bg-zinc-900 border text-emerald-400 border-zinc-700 w-full sm:w-56">
                            <SelectValue placeholder="Filter by course" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                            <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                            {enrolledCourses.map((c) => (
                              <SelectItem className="cursor-pointer" key={c.id} value={c.id}>
                                {c.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Sort */}
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="bg-zinc-900 border text-emerald-400 border-zinc-700 w-full sm:w-48">
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

                      {/* Tag filter (optional) */}
                      <TagPicker value={filterTags} onChange={setFilterTags} suggestions={allTags} />
                    </div>
                  </Card>
                </div>

                {/* Cards grid */}
                <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Course Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[70vh] overflow-auto pr-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                          {adminLinks.length === 0 && !loading ? (
                            <EmptyState
                              icon={<LinkIcon className="w-10 h-10 text-emerald-400" />}
                              title="No links to show"
                              subtitle="No active course links match your filters."
                            />
                          ) : (
                            adminLinks.map((link, idx) => (
                              <motion.div
                                key={link.id}
                                {...CardEnter}
                                transition={{ delay: idx * 0.02, duration: 0.24 }}
                                className="p-4 bg-zinc-800/40 border border-zinc-700 rounded-xl hover:bg-zinc-800/60 transform hover:-translate-y-0.5 transition"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    {/* Title + badges */}
                                    <div className="flex flex-col items-start justify-between gap-2">
                                      <h3 className="text-lg font-semibold text-slate-200">{link.title}</h3>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {badgeForType(link.link_type)}
                                        <Badge variant="secondary" className="bg-zinc-700/40 text-slate-200">
                                          {link.course_title}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                      <div className="inline-flex items-center gap-2">
                                        <User className="w-4 h-4 text-emerald-400" />
                                        <span className="truncate">{link.author_name || "—"}</span>
                                      </div>
                                      <Separator orientation="vertical" className="h-3 w-px bg-zinc-700 mx-1 hidden sm:block" />
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

                                      {/* Tags (first 3) */}
                                      <div className="flex items-center gap-1 ml-auto">
                                        {(link.tags || []).slice(0, 3).map((t) => (
                                          <span key={t} className="text-xs">{tagChip(t)}</span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-3 text-sm text-zinc-300">
                                        <div className="inline-flex items-center gap-1">
                                          <Eye className="w-4 h-4" /> <span className="text-xs">{link.click_count || 0}</span>
                                        </div>
                                        <div className="inline-flex items-center gap-1">
                                          <ThumbsUp className="w-4 h-4 text-emerald-400" />{" "}
                                          <span className="text-xs">{Math.max(0, link.votes || 0)}</span>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                                        <Tooltip content="Open">
                                          <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => handleOpenAdminLink(link)}>
                                            <ExternalLink className="w-4 h-4" />
                                          </Button>
                                        </Tooltip>
                                        <Tooltip content="Copy URL">
                                          <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => copy(link.url)}>
                                            <Copy className="w-4 h-4" />
                                          </Button>
                                        </Tooltip>
                                        <Tooltip content="Upvote">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-emerald-600/50 text-emerald-300 hover:text--emerald-400 cursor-pointer hover:bg-emerald-600/10"
                                            onClick={() => handleVote(link.id, 1)}
                                          >
                                            <ThumbsUp className="w-4 h-4" />
                                          </Button>
                                        </Tooltip>
                                        <Tooltip content="Downvote">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-rose-600/50 cursor-pointer hover:text-red-500 text-rose-300 hover:bg-rose-600/10"
                                            onClick={() => handleVote(link.id, -1)}
                                          >
                                            <ThumbsDown className="w-4 h-4" />
                                          </Button>
                                        </Tooltip>
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
                          <Button variant="outline" className="border-zinc-700 text-slate-200" onClick={loadMore}>
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

          {/* My Work (student_links CRUD) */}
          <TabsContent value="mywork">
            <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-emerald-300">My Work Links</CardTitle>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-100"
                    onClick={() => {
                      resetForm();
                      setIsAddOpen(true);
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Work Link
                  </Button>
                </motion.div>
              </CardHeader>

              <CardContent>
                {/* Filters */}
                <div className="mb-4 flex items-center gap-3">
                  <Select value={filterCourse || "all"} onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}>
                    <SelectTrigger className="bg-zinc-900 border text-emerald-200 border-zinc-700 w-56">
                      <SelectValue placeholder="Filter by course" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                      <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                      {enrolledCourses.map((c) => (
                        <SelectItem className="cursor-pointer" key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Search by title…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 text-slate-100 placeholder:text-zinc-500"
                  />
                </div>

                {/* List */}
                <ScrollArea className="max-h-[70vh] pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentLinks.length === 0 && !loading ? (
                      <EmptyState
                        icon={<User className="w-10 h-10 text-emerald-400" />}
                        title="No work links yet"
                        subtitle="Add your GitHub repo, Colab notebook, report, or any external link."
                      />
                    ) : (
                      studentLinks.map((link) => (
                        <motion.div
                          key={link.id}
                          {...CardEnter}
                          transition={{ duration: 0.2 }}
                          className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:bg-zinc-800/70 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {renderWorkIcon(link)}
                                <h3 className="text-lg font-semibold text-slate-200 truncate">{link.title}</h3>
                              </div>
                              <p className="text-xs text-zinc-400">
                                {link.course_title} • {link.link_type || "other"}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-sm text-slate-300">
                                <User className="w-4 h-4 text-emerald-400" /> You ({link.student_id.slice(0, 8)}…)
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => window.open(link.url, "_blank")}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => copy(link.url)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-200" onClick={() => openEdit(link)}>
                                <Edit3 className="w-4 h-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300">
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this work link?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-zinc-400">
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-zinc-900 border border-zinc-700 text-slate-100">Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-rose-600 hover:bg-rose-500 text-slate-100" onClick={() => deleteStudentLink(link.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

          {/* Analytics */}
          <TabsContent value="analytics">
            <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl p-4">
              <CardHeader>
                <CardTitle className="text-emerald-300">My Analytics</CardTitle>
              </CardHeader>
              <CardContent>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* KPI tiles */}
  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">Clicks (30d)</div>
    <div className="text-2xl font-semibold text-slate-100">{clicks30d}</div>
  </div>

  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">My Work Links</div>
    <div className="text-2xl font-semibold text-slate-100">{studentLinks.length}</div>
  </div>

  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400">Courses Enrolled</div>
    <div className="text-2xl font-semibold text-slate-100">{enrolledCourses.length}</div>
  </div>

  {/* Area chart: clicks per day */}
  <div className="sm:col-span-2 bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 h-64">
    <div className="text-sm text-zinc-400 mb-2">Clicks per Day (30d)</div>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dailyClicksSeries}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
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
                        labelStyle={{ color: "#22c55e" }}
        />
        <Area type="monotone" dataKey="clicks" stroke="#10b981" fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>

  {/* Pie chart: distribution by course */}
  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 h-64">
    <div className="text-sm text-zinc-400 mb-2">Clicks by Course</div>
    {courseClickBreakdown.length === 0 ? (
      <div className="text-zinc-400 text-sm">No clicks recorded</div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={courseClickBreakdown}
            dataKey="value"
            nameKey="course_title"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {courseClickBreakdown.map((_, i) => (
              <Cell
                key={i}
                fill={["#10b981", "#06b6d4", "#7c3aed", "#f59e0b", "#ef4444"][i % 5]}
              />
            ))}
          </Pie>
          <ReTooltip
          content={<CustomPieTooltip />}  />
        </PieChart>
      </ResponsiveContainer>
    )}
  </div>

  {/* Top clicked list */}
  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
    <div className="text-sm text-zinc-400 mb-2">Your Top Clicked</div>
    {topClicked.length === 0 ? (
      <div className="text-zinc-400 text-sm">—</div>
    ) : (
      <ul className="text-sm text-zinc-200 space-y-1">
        {topClicked.map((l) => (
          <li key={l.id} className="truncate">
            {l.title}{" "}
            <span className="text-zinc-400 text-xs">(total {l.click_count || 0})</span>
          </li>
        ))}
      </ul>
    )}
  </div>
</div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add / Edit (My Work) */}
      <Dialog open={isAddOpen} onOpenChange={(o) => setIsAddOpen(o)}>
        <DialogTrigger asChild />
        <DialogContent className="max-w-3xl border border-zinc-800 p-0 overflow-hidden">
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }} className="p-0">
            <div className="p-5 bg-zinc-950 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-emerald-300">
                {editRow ? "Edit Work Link" : "Add Work Link"}
              </h3>
            </div>

            <div className="p-5 bg-zinc-950 text-slate-100">
              <SectionTitle title="Details" />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-slate-100 placeholder:text-zinc-500"
                    placeholder="E.g. ML Assignment — Colab"
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

              <SectionTitle title="Classification" className="mt-6" />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Type</Label>
                  <Select value={form.link_type} onValueChange={(v) => setForm((f) => ({ ...f, link_type: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="colab">Colab</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }} className="space-y-1">
                  <Label className="text-slate-300">Course</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-700">
                      <SelectValue placeholder="Choose course" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100 border-zinc-700">
                      {enrolledCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              </div>

              <SectionTitle title="Expiry (optional)" className="mt-6" />
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
                        className="text-white"
                      />
                    </PopoverContent>
                  </Popover>
                </motion.div>

                {/* empty cell for grid symmetry */}
                <div />
              </div>

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
                  <Button onClick={saveStudentLink} className="bg-emerald-600 hover:bg-emerald-500 text-slate-100">
                    {editRow ? "Update" : "Create"}
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -----------------------
   Small helpers & pieces
   ----------------------- */
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
      <div className="p-6 rounded-full bg-zinc-800/30 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-sm">{subtitle}</p>
    </div>
  );
}

function SectionTitle({ title, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-px flex-1 bg-zinc-800" />
      <div className="text-xs uppercase tracking-wider text-zinc-400">{title}</div>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

function TagPicker({ value = [], onChange, suggestions = [] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const filtered = (suggestions || []).filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  ).slice(0, 6);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-zinc-700 text-slate-200">
          <TagIcon className="w-4 h-4 mr-2" />
          {value.length > 0 ? `${value.length} tag${value.length > 1 ? "s" : ""}` : "Filter tags"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-zinc-900 border border-zinc-700">
        <div className="space-y-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search tags…"
            className="bg-zinc-900 border border-zinc-700 text-slate-100 placeholder:text-zinc-500"
          />
          <div className="flex flex-wrap gap-1">
            {value.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-700/50 text-slate-200">
                <TagIcon className="w-3 h-3" />
                {t}
                <button
                  className="ml-1 rounded hover:bg-zinc-700/70 px-1 text-zinc-300"
                  onClick={() => onChange(value.filter((x) => x !== t))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-zinc-500">No tags</div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange([...value, s])}
                  className="text-xs px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 text-slate-200 transition"
                >
                  + {s}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function copy(text) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied URL"),
    () => toast.error("Copy failed")
  );
}

function renderWorkIcon(link) {
  const t = (link.link_type || "").toLowerCase();
  if (t.includes("github")) return <Github className="w-5 h-5 text-slate-300" />;
  if (t.includes("colab")) return <FileSpreadsheet className="w-5 h-5 text-slate-300" />;
  return <LinkIcon className="w-5 h-5 text-slate-300" />;
}
