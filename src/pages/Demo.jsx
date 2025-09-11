// src/pages/Demo.jsx
// Full LMS Portal - single-file
// Theme: Emerald + Black
// Plain JavaScript (JSX). Uses react, framer-motion, lucide-react, recharts, react-markdown, shadcn/ui components.
// If shadcn components import paths differ in your project, update imports accordingly.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  CheckSquare,
  Calendar as CalendarIcon,
  FolderOpen,
  MessageSquare,
  FileText,
  Link as LinkIcon,
  StickyNote,
  Paperclip,
  Trophy,
  BarChart3,
  Users,
  User,
  Bell,
  Search,
  Filter,
  Menu,
  X,
  ChevronRight,
  Upload,
  Plus,
  Trash2,
  MoreHorizontal,
  Globe,
  ChevronLeft,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

import ReactMarkdown from "react-markdown";

// shadcn/ui components (adjust paths if needed)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip as UiTooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";

// --------------------------- Demo data ---------------------------
// Replace with real API calls as needed.

const demoCourses = [
  { id: "cs101", name: "CS101 — Intro to Programming", code: "CS101", progress: 72, stats: { assignments: 12, pending: 2, attendance: 90 }, description: "Introductory programming course. Covers fundamentals of algorithms and JavaScript.", modules: ["Intro", "Variables & Types", "Control Flow", "Functions", "Projects"] },
  { id: "math201", name: "MATH201 — Linear Algebra", code: "MATH201", progress: 58, stats: { assignments: 9, pending: 1, attendance: 96 }, description: "Matrices, vectors, eigenvalues, and practical numerical methods.", modules: ["Vectors", "Matrices", "Determinants", "Eigenvalues", "Applications"] },
  { id: "phy150", name: "PHY150 — Mechanics", code: "PHY150", progress: 81, stats: { assignments: 7, pending: 0, attendance: 88 }, description: "Classical mechanics focusing on Newtonian physics.", modules: ["Kinematics", "Dynamics", "Energy & Work", "Rotational Motion"] },
  { id: "eng100", name: "ENG100 — Academic Writing", code: "ENG100", progress: 64, stats: { assignments: 8, pending: 1, attendance: 92 }, description: "Techniques for effective academic writing.", modules: ["Essay Structure", "Research", "Citations", "Editing"] },
  { id: "hist210", name: "HIST210 — World History", code: "HIST210", progress: 49, stats: { assignments: 10, pending: 3, attendance: 85 }, description: "Global historical survey from ancient to modern times.", modules: ["Ancient Civilizations", "Middle Ages", "Modern Era"] },
];

const demoAssignments = Array.from({ length: 16 }).map((_, i) => {
  const status = i % 3 === 0 ? "Submitted" : i % 3 === 1 ? "Pending" : "Overdue";
  return {
    id: `asg-${i + 1}`,
    title: `Assignment ${i + 1}`,
    course: demoCourses[i % demoCourses.length].code,
    due: `2025-09-${(5 + i).toString().padStart(2, "0")}`,
    dueDisplay: `Sep ${5 + i}, 11:59 PM`,
    status,
    score: status === "Submitted" ? 88 - i : null,
    tags: i % 2 === 0 ? ["lab"] : ["homework"],
    description: `This is the description for assignment ${i + 1}.`,
  };
});

const demoNotes = Array.from({ length: 12 }).map((_, i) => ({
  id: `note-${i + 1}`,
  title: `Week ${i + 1} Notes`,
  course: demoCourses[i % demoCourses.length].code,
  content: `# Week ${i + 1}\n\nNotes for week ${i + 1}.\n\n- Key point A\n- Key point B\n\n**Example**: \`console.log("LMS")\``,
  createdAt: `2025-08-${(1 + i).toString().padStart(2, "0")}`,
}));

const demoFiles = [
  { id: "f1", name: "Lecture1.pdf", size: "2.4 MB", type: "pdf", course: "CS101" },
  { id: "f2", name: "Demo.mp4", size: "35 MB", type: "video", course: "MATH201" },
  { id: "f3", name: "Syllabus.pdf", size: "120 KB", type: "pdf", course: "PHY150" },
  { id: "f4", name: "ReadingList.docx", size: "80 KB", type: "docx", course: "ENG100" },
];

const demoLinks = [
  { id: "l1", title: "Course Syllabus", url: "https://example.com/syllabus", course: "CS101" },
  { id: "l2", title: "Matrix Notes", url: "https://example.com/matrix", course: "MATH201" },
  { id: "l3", title: "Mechanics Video", url: "https://example.com/mech", course: "PHY150" },
];

const demoDiscussions = [
  { id: "d1", title: "Lab 2 Help", content: "Can someone explain the time complexity?", author: "Alice", preview: "Can someone explain the time complexity? I'm stuck on the nested loops part." },
  { id: "d2", title: "Project Groups", content: "Looking for team members for final project.", author: "Bob", preview: "Looking for team members to join my group for the final project." },
  { id: "d3", title: "Exam Prep", content: "Share tips for the midterm.", author: "Carol", preview: "Share tips for the midterm, especially the MCQ section." },
];

const demoTasks = [
  { id: "t1", title: "Study Chapter 3", due: "2025-09-10", status: "Pending" },
  { id: "t2", title: "Group meeting", due: "2025-09-12", status: "Completed" },
  { id: "t3", title: "Submit lab", due: "2025-09-14", status: "Pending" },
];

const demoQuizzes = [
  { id: "q1", title: "Quiz 1", course: "CS101", questions: 10 },
  { id: "q2", title: "Midterm", course: "MATH201", questions: 40 },
];

const demoCalendar = [
  { id: "ev1", title: "CS101 Lab", date: "2025-09-05", type: "Lab" },
  { id: "ev2", title: "MATH201 Quiz", date: "2025-09-06", type: "Quiz" },
  { id: "ev3", title: "PHY150 Exam", date: "2025-09-18", type: "Exam" },
];

const demoCertificates = [
  { id: "c1", title: "CS101 Completion", date: "2025-06-25" },
  { id: "c2", title: "MATH201 Honor", date: "2025-07-30" },
];

const progressSeries = [
  { day: "Mon", tasks: 2, assignments: 1 },
  { day: "Tue", tasks: 3, assignments: 0 },
  { day: "Wed", tasks: 4, assignments: 2 },
  { day: "Thu", tasks: 1, assignments: 1 },
  { day: "Fri", tasks: 3, assignments: 2 },
  { day: "Sat", tasks: 2, assignments: 1 },
  { day: "Sun", tasks: 0, assignments: 0 },
];

const attendanceSeries = [
  { name: "Present", value: 86 },
  { name: "Absent", value: 8 },
  { name: "Late", value: 6 },
];

const analyticsTasks = [
  { name: "CS101", value: 78 },
  { name: "MATH201", value: 62 },
  { name: "PHY150", value: 85 },
];

const analyticsAttendance = [
  { name: "Week 1", value: 88 },
  { name: "Week 2", value: 86 },
  { name: "Week 3", value: 90 },
];

// --------------------------- utilities ---------------------------
function cn(...parts) { return parts.filter(Boolean).join(" "); }

function IconButton({ children, ...props }) {
  return <button {...props} className="rounded-md p-2 hover:bg-black/20">{children}</button>;
}

function TooltipWrapper({ tip, children }) {
  return (
    <TooltipProvider>
      <UiTooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  );
}

// --------------------------- TopBar ---------------------------
function TopBar({ globalSearch, setGlobalSearch, onOpenFilters, onToggleSidebar }) {
  return (
    <div className="sticky top-0 z-40 bg-black/60 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto flex items-center gap-3 p-3">
        <div className="flex items-center gap-3 md:hidden">
          <button onClick={onToggleSidebar} className="p-2 rounded-md bg-black/20">
            <Menu className="w-5 h-5 text-emerald-300" />
          </button>
          <Link to="/">
          <div className="text-emerald-300 font-semibold">LMS</div>
          </Link>
        </div>

        <div className="hidden md:block text-emerald-300 font-semibold">LMS Portal</div>

        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search courses, notes, assignments, files, links..."
              className="w-full rounded-lg bg-black/50 border border-zinc-800 px-10 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipWrapper tip="Notifications">
            <IconButton>
              <Bell className="w-5 h-5 text-zinc-200" />
            </IconButton>
          </TooltipWrapper>

          <Button variant="ghost" onClick={onOpenFilters} className="hidden sm:inline-flex border border-zinc-800 bg-black/30 text-emerald-200">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>

          <Avatar className="h-8 w-8">
            <AvatarImage src="https://i.pravatar.cc/100?img=32" />
            <AvatarFallback>EC</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

// --------------------------- Sidebar ---------------------------
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "courses", label: "Courses", icon: <GraduationCap className="w-4 h-4" /> },
  { key: "assignments", label: "Assignments", icon: <ClipboardList className="w-4 h-4" /> },
  { key: "attendance", label: "Attendance", icon: <CheckSquare className="w-4 h-4" /> },
  { key: "resources", label: "Resources", icon: <FolderOpen className="w-4 h-4" /> },
  { key: "discussions", label: "Discussions", icon: <MessageSquare className="w-4 h-4" /> },
  { key: "quizzes", label: "Quizzes & Tests", icon: <FileText className="w-4 h-4" /> },
  { key: "calendar", label: "Calendar", icon: <CalendarIcon className="w-4 h-4" /> },
  { key: "notes", label: "Notes (All)", icon: <StickyNote className="w-4 h-4" /> },
  { key: "links", label: "Saved Links", icon: <LinkIcon className="w-4 h-4" /> },
  { key: "tasks", label: "Task Manager", icon: <CheckSquare className="w-4 h-4" /> },
  { key: "files", label: "Files & Media", icon: <Paperclip className="w-4 h-4" /> },
  { key: "certs", label: "Certificates", icon: <Trophy className="w-4 h-4" /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
];

function Sidebar({ active, setActive, mobileOpen, setMobileOpen }) {
  return (
    <>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild><span /></SheetTrigger>
        {mobileOpen && (
          <SheetContent side="left" className="p-0 bg-zinc-950 overflow-auto">
            <SheetHeader>
              <SheetTitle className="text-emerald-400">Menu</SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setActive(item.key); setMobileOpen(false); }}
                    className={cn("flex items-center gap-3 cursor-pointer w-full px-3 py-2 rounded-lg text-left", active === item.key ? "bg-emerald-800/25 text-emerald-200" : "text-zinc-300 hover:bg-zinc-400/20")}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </SheetContent>
        )}
      </Sheet>

      <aside className="hidden md:flex md:flex-col w-64 bg-black/60 border-r border-zinc-800">
        <div className="p-4 text-emerald-300 font-semibold flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1">
          <BookOpen className="w-6 h-6" />
          <span>LMS Portal</span>
          </Link>
        </div>

        <Separator className="bg-zinc-800" />

        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {NAV_ITEMS.map((n) => (
              <button
                key={n.key}
                onClick={() => setActive(n.key)}
                className={cn("flex items-center gap-3 w-full px-3 py-2 cursor-pointer rounded-lg hover:bg-zinc-500/75 transition", active === n.key ? "bg-emerald-900/25 text-emerald-200" : "text-zinc-300 hover:bg-black/20")}
              >
                {n.icon}
                <span className="truncate">{n.label}</span>
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-3">
          <Card className="bg-black/60 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-emerald-200">Support</CardTitle>
              <CardDescription className="text-xs text-zinc-400">Docs & help</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full border border-zinc-800 text-emerald-200 cursor-pointer hover:bg-emerald-500" variant="ghost">
                <Globe className="mr-2 w-4 h-4" />
                Open Docs
              </Button>
            </CardContent>
          </Card>
        </div>
      </aside>
    </>
  );
}

// --------------------------- Search results panel ---------------------------
function SearchResultsPanel({ query, onClose }) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return null;

  const courseMatches = demoCourses.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  const assignmentMatches = demoAssignments.filter((a) => a.title.toLowerCase().includes(q) || a.course.toLowerCase().includes(q));
  const noteMatches = demoNotes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  const fileMatches = demoFiles.filter((f) => f.name.toLowerCase().includes(q));
  const linkMatches = demoLinks.filter((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));

  return (
    <div className="fixed right-4 top-20 z-50 w-[min(560px,95%)] bg-black/85 border border-zinc-800 rounded-md p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-emerald-200">Results for “{query}”</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="mt-3 space-y-3 max-h-64 overflow-auto">
        {courseMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-400 mb-1">Courses</div>
            {courseMatches.map((c) => (
              <div key={c.id} className="py-1 text-sm text-zinc-100">
                {c.name} <Badge className="ml-2 bg-emerald-800 text-white">{c.code}</Badge>
              </div>
            ))}
          </div>
        )}

        {assignmentMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-400 mt-2 mb-1">Assignments</div>
            {assignmentMatches.map((a) => (
              <div key={a.id} className="py-1 text-sm text-zinc-100">{a.title} <span className="text-xs text-zinc-400">({a.course})</span></div>
            ))}
          </div>
        )}

        {noteMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-400 mt-2 mb-1">Notes</div>
            {noteMatches.map((n) => (
              <div key={n.id} className="py-1 text-sm text-zinc-100">{n.title} <span className="text-xs text-zinc-400">({n.course})</span></div>
            ))}
          </div>
        )}

        {fileMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-400 mt-2 mb-1">Files</div>
            {fileMatches.map((f) => (
              <div key={f.id} className="py-1 text-sm text-zinc-100">{f.name} <span className="text-xs text-zinc-400">({f.type})</span></div>
            ))}
          </div>
        )}

        {linkMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-400 mt-2 mb-1">Links</div>
            {linkMatches.map((l) => (
              <div key={l.id} className="py-1 text-sm text-zinc-100">{l.title} <span className="text-xs text-zinc-400">({l.course})</span></div>
            ))}
          </div>
        )}

        {courseMatches.length + assignmentMatches.length + noteMatches.length + fileMatches.length + linkMatches.length === 0 && (
          <div className="text-sm text-zinc-400">No results</div>
        )}
      </div>
    </div>
  );
}

// --------------------------- Views ---------------------------

// Dashboard view
function DashboardView({ navigate }) {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-200">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Progress summary, upcoming tasks, attendance, deadlines.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-emerald-600 cursor-pointer hover:bg-emerald-500" onClick={() => navigate("calendar")}>Open Calendar</Button>
          <Button variant="outline" onClick={() => navigate("tasks")} className="border-emerald-600 cursor-pointer text-black">Tasks</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {demoCourses.map((c) => (
          <motion.div key={c.id} whileHover={{ scale: 1.02 }} className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-black to-emerald-900/5 p-0">
            <Card className="bg-transparent border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-emerald-200 truncate">{c.name}</CardTitle>
                  <Badge className="bg-emerald-800 text-white border-0">{c.code}</Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400">Assignments {c.stats.assignments} · Pending {c.stats.pending} · Attendance {c.stats.attendance}%</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="text-zinc-200">{c.progress}%</span>
                </div>
                <Progress value={c.progress} className="h-2 bg-zinc-800" />
                <div className="mt-4">
                  <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-500" onClick={() => navigate("courseDetail", { id: c.id })}>
                    Open Course <ChevronRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-black/60 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-200">This Week</CardTitle>
            <CardDescription className="text-xs text-zinc-400">Tasks vs Assignments</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressSeries}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <ReTooltip />
                <Area type="monotone" dataKey="tasks" stroke="#10b981" fill="url(#g1)" />
                <Area type="monotone" dataKey="assignments" stroke="#06b6d4" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-black/60 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-200">Attendance Snapshot</CardTitle>
            <CardDescription className="text-xs text-zinc-400">Across all courses</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendanceSeries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {attendanceSeries.map((_, idx) => <Cell key={idx} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/60 border border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-200">Upcoming</CardTitle>
          <CardDescription className="text-xs text-zinc-400">Due dates & events</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {demoAssignments.slice(0, 3).map((u) => (
            <div key={u.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{u.status}</span>
                <span>{u.dueDisplay}</span>
              </div>
              <div className="mt-1 font-medium text-zinc-100">{u.title}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-400" onClick={() => navigate("calendar")}>Calendar</Button>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => navigate("assignments")}>Open</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// CoursesView
function CoursesView({ openCourse }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const filtered = useMemo(() => {
    let arr = demoCourses.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()));
    if (sortBy === "progress") arr = arr.sort((a, b) => b.progress - a.progress);
    else arr = arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [query, sortBy]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emerald-200">Courses</h2>
          <div className="text-zinc-400 text-sm">Enrolled courses with quick stats</div>
        </div>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search courses..." className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:ring-2 focus:ring-emerald-500" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
            <SelectTrigger className="w-40 bg-black/40 border border-zinc-800 text-zinc-100"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(c => (
          <Card key={c.id} className="bg-black/40 border border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-emerald-200 truncate">{c.name}</CardTitle>
                <Badge className="bg-emerald-800 text-white border-0">{c.code}</Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400">Assignments {c.stats.assignments} · Pending {c.stats.pending}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>Progress</div>
                <div className="text-zinc-100">{c.progress}%</div>
              </div>
              <Progress value={c.progress} className="h-2 mt-2 bg-zinc-800" />
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-500" onClick={() => openCourse(c.id)}>Open</Button>
                <Button size="sm" className="cursor-pointer" variant="outline">Resources</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Assignments view
function AssignmentsView({ globalFilters }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(globalFilters.status || "all");
  const [courseFilter, setCourseFilter] = useState(globalFilters.course || "all");
  const [sortBy, setSortBy] = useState("due");

  useEffect(() => {
    setStatusFilter(globalFilters.status || "all");
    setCourseFilter(globalFilters.course || "all");
  }, [globalFilters]);

  const filtered = useMemo(() => {
    let arr = demoAssignments.filter(a => {
      if (statusFilter !== "all" && statusFilter !== "any" && a.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (courseFilter !== "all" && a.course !== courseFilter) return false;
      if (query && !(a.title.toLowerCase().includes(query.toLowerCase()) || a.course.toLowerCase().includes(query.toLowerCase()))) return false;
      return true;
    });
    if (sortBy === "due") arr = arr.sort((a, b) => a.due.localeCompare(b.due));
    if (sortBy === "title") arr = arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [query, statusFilter, courseFilter, sortBy]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-emerald-200">Assignments</h2>
        <div className="ml-auto flex items-center gap-2">
          <input placeholder="Search assignments..." value={query} onChange={e => setQuery(e.target.value)} className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger className="w-40 bg-black/40 border border-zinc-800"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={(v) => setCourseFilter(v)}>
            <SelectTrigger className="w-40 bg-black/40 border border-zinc-800"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {demoCourses.map(c => <SelectItem key={c.id} value={c.code}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
            <SelectTrigger className="w-36 bg-black/40 border border-zinc-800"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due">Due Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-black/40 border border-zinc-800">
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Course</th>
                  <th className="p-2 text-left">Due</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-t border-zinc-800">
                    <td className="p-2">{a.title}</td>
                    <td className="p-2">{a.course}</td>
                    <td className="p-2">{a.dueDisplay}</td>
                    <td className="p-2"><Badge className={cn(a.status === "Submitted" ? "bg-emerald-600" : a.status === "Overdue" ? "bg-red-600" : "bg-zinc-700", "text-white")}>{a.status}</Badge></td>
                    <td className="p-2 text-right">{a.score ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Attendance view
function AttendanceView() {
  return (
    <div className="p-4 md:p-6">
      <Card className="bg-black/40 border border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-200">Attendance Trends</CardTitle>
          <CardDescription className="text-zinc-400">Daily attendance and activity</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressSeries}>
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <CartesianGrid stroke="#264653" />
              <ReTooltip />
              <Line type="monotone" dataKey="tasks" stroke="#10b981" />
              <Line type="monotone" dataKey="assignments" stroke="#06b6d4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// Resources view
function ResourcesView() {
  return (
    <div className="p-4 md:p-6">
      <Card className="bg-black/40 border border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-200">Resources</CardTitle>
          <CardDescription className="text-zinc-400">Shared study materials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {demoFiles.map((f) => (
              <div key={f.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-emerald-200">{f.name}</div>
                    <div className="text-xs text-zinc-400">{f.size}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Preview</Button>
                    <Button size="sm" className="bg-emerald-600">Download</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Discussions view
function DiscussionsView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return demoDiscussions.filter(d =>
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      (d.author || "").toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-200">Discussions</h2>
        <input
          placeholder="Search discussions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(d => (
          <Card key={d.id} className="bg-black/40 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-emerald-200">{d.title}</CardTitle>
              <CardDescription className="text-xs text-zinc-400">By {d.author}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300">{d.preview || d.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Quizzes view
function QuizzesView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return demoQuizzes.filter(q =>
      q.title.toLowerCase().includes(query.toLowerCase()) ||
      q.course.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-200">Quizzes & Tests</h2>
        <input
          placeholder="Search quizzes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(q => (
          <Card key={q.id} className="bg-black/40 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-emerald-200">{q.title}</CardTitle>
              <CardDescription className="text-xs text-zinc-400">{q.course}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-zinc-300">Questions: {q.questions}</div>
                <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-500">Start</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Calendar view
function CalendarView() {
  return (
    <div className="p-4 md:p-6">
      <Card className="bg-black/40 border border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-200">Calendar</CardTitle>
          <CardDescription className="text-zinc-400">Tasks, assignments, exams, and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {demoCalendar.map(ev => (
              <div key={ev.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                <div className="text-xs text-zinc-400">{ev.date}</div>
                <div className="font-medium text-emerald-200">{ev.title}</div>
                <div className="text-sm text-zinc-300">{ev.type}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Notes view
function NotesView({ globalFilters, onAddNote }) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState("# New note\n\nWrite markdown here...");
  const [notes, setNotes] = useState(demoNotes);

  useEffect(() => {
    // start with demoNotes - already done
  }, []);

  const filtered = useMemo(() => {
    return notes.filter(n =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.content.toLowerCase().includes(query.toLowerCase())
    );
  }, [notes, query]);

  function saveNote() {
    const id = `note-${Date.now()}`;
    const newNote = { id, title: (editor.split("\n")[0] || "Untitled").replace(/^#+\s*/, ""), course: "CS101", content: editor, createdAt: new Date().toISOString() };
    setNotes(prev => [newNote, ...prev]);
    if (onAddNote) onAddNote(newNote);
    setEditor("# New note\n\nWrite markdown here...");
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-emerald-200">Notes</h2>
          <div className="text-zinc-400 text-sm">Add rich notes with Markdown and attachments</div>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes..." className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100" />
          <Select>
            <SelectTrigger className="w-40 bg-black/40 border border-zinc-800"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {demoCourses.map(c => <SelectItem key={c.id} value={c.code}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-sm">Editor</Label>
          <Textarea value={editor} onChange={e => setEditor(e.target.value)} className="min-h-[260px] bg-black/40 border border-zinc-800 text-zinc-100" />
          <div className="flex gap-2 mt-2">
            <Button className="bg-emerald-600 cursor-pointer hover:bg-emerald-500" onClick={saveNote}><Plus className="w-4 h-4 mr-2" />Save</Button>
            <Button variant="outline" className="bg-white text-black cursor-pointer">Attach</Button>
          </div>
        </div>
        <div>
          <div className="text-sm text-zinc-300 mb-2">Preview</div>
          <div className="prose prose-invert max-w-none bg-black/40 border border-zinc-800 p-4 rounded-md">
            <ReactMarkdown>{editor}</ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(n => (
          <Card key={n.id} className="bg-black/40 border border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-emerald-200">{n.title}</CardTitle>
                <Badge className="bg-emerald-700 text-white">{n.course}</Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400">{n.createdAt}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-200 line-clamp-3">
                <ReactMarkdown>{n.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Links view
function LinksView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return demoLinks.filter(l =>
      l.title.toLowerCase().includes(query.toLowerCase()) ||
      l.url.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-200">Saved Links</h2>
        <input
          placeholder="Search links..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(l => (
          <div key={l.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
            <div className="font-medium text-emerald-200">{l.title}</div>
            <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 underline">
              {l.url}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tasks view
function TasksView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return demoTasks.filter(t => {
      if (status !== "all" && t.status.toLowerCase() !== status.toLowerCase()) return false;
      if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [query, status]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold text-emerald-200">Tasks</h2>
        <div className="ml-auto flex gap-2">
          <input
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100"
          />
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger className="w-40 bg-black/40 border border-zinc-800 text-zinc-100">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(t => (
          <div key={t.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-emerald-200">{t.title}</div>
                <div className="text-xs text-zinc-400">{t.due}</div>
              </div>
              <Badge className={cn(t.status === "Completed" ? "bg-emerald-600" : "bg-zinc-700", "text-white")}>
                {t.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Files view
function FilesView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return demoFiles.filter(f =>
      f.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-200">Files & Media</h2>
        <input
          placeholder="Search files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(f => (
          <div key={f.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-emerald-200">{f.name}</div>
              <div className="text-xs text-zinc-400">{f.size}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="bg-white text-black cursor-pointer">Preview</Button>
              <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-500">Download</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Certificates view
function CertificatesView() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold text-emerald-200">Certificates & Achievements</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {demoCertificates.map(c => (
          <Card key={c.id} className="bg-black/40 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-emerald-200">{c.title}</CardTitle>
              <CardDescription className="text-xs text-zinc-400">{c.date}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="bg-emerald-600 cursor-pointer hover:bg-emerald-500">Download PDF</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Analytics view
function AnalyticsView() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold text-emerald-200">Analytics Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-black/40 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-200">Task Completion %</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsTasks}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <ReTooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-200">Attendance Progress</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsAttendance}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <CartesianGrid stroke="#334155" />
                <ReTooltip />
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Profile view
function ProfileView() {
  return (
    <div className="p-4 md:p-6">
      <Card className="bg-black/40 border border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-200">Profile & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-zinc-400">Name</div>
            <div className="text-zinc-100">John Doe</div>
          </div>
          <div>
            <div className="text-zinc-400">Email</div>
            <div className="text-zinc-100">john@example.com</div>
          </div>
          <div>
            <div className="text-zinc-400">Role</div>
            <div className="text-zinc-100">Student</div>
          </div>
          <Button className="bg-emerald-600 cursor-pointer hover:bg-emerald-500">Edit Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------- Course Detail View ---------------------------
function CourseDetailView({ courseId, onBack, onNavigateInner }) {
  // courseId is an ID from demoCourses
  const course = demoCourses.find(c => c.id === courseId);
  const [activeTab, setActiveTab] = useState("overview");

  if (!course) {
    return (
      <div className="p-6">
        <p className="text-red-400">Course not found.</p>
        <Button className="mt-4 bg-emerald-600" onClick={onBack}>Back</Button>
      </div>
    );
  }

  // Pull course-specific data
  const courseAssignments = demoAssignments.filter(a => a.course === course.code);
  const courseNotes = demoNotes.filter(n => n.course === course.code);
  const courseFiles = demoFiles.filter(f => f.course === course.code);
  const courseLinks = demoLinks.filter(l => l.course === course.code);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-emerald-200">{course.name}</h2>
          <div className="text-zinc-400 text-sm">{course.code} · {course.progress}% complete</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} className="text-zinc-300"><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
          <Button className="bg-emerald-600" onClick={() => setActiveTab("overview")}>Overview</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Course Overview</CardTitle>
                <CardDescription className="text-zinc-400">{course.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-black/30 p-4 border border-zinc-800">
                    <div className="text-sm text-zinc-400">Assignments</div>
                    <div className="text-emerald-200 font-semibold">{course.stats.assignments}</div>
                  </div>
                  <div className="rounded-xl bg-black/30 p-4 border border-zinc-800">
                    <div className="text-sm text-zinc-400">Attendance</div>
                    <div className="text-emerald-200 font-semibold">{course.stats.attendance}%</div>
                  </div>
                  <div className="rounded-xl bg-black/30 p-4 border border-zinc-800">
                    <div className="text-sm text-zinc-400">Progress</div>
                    <div className="text-emerald-200 font-semibold">{course.progress}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-6 text-zinc-200">
                  {(course.modules || []).map((m, idx) => <li key={idx}>{m}</li>)}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-zinc-400">
                      <tr>
                        <th className="p-2 text-left">Title</th>
                        <th className="p-2 text-left">Due</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseAssignments.map(a => (
                        <tr key={a.id} className="border-t border-zinc-800">
                          <td className="p-2">{a.title}</td>
                          <td className="p-2">{a.dueDisplay}</td>
                          <td className="p-2"><Badge className={cn(a.status === "Submitted" ? "bg-emerald-600" : a.status === "Overdue" ? "bg-red-600" : "bg-zinc-700", "text-white")}>{a.status}</Badge></td>
                          <td className="p-2 text-right">{a.score ?? "-"}</td>
                        </tr>
                      ))}
                      {courseAssignments.length === 0 && <tr><td colSpan="4" className="p-4 text-zinc-400">No assignments for this course.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-zinc-300">Attendance chart and records would display here.</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {courseFiles.map(f => (
                    <div key={f.id} className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                      <div className="font-medium text-emerald-200">{f.name}</div>
                      <div className="text-xs text-zinc-400">{f.size}</div>
                    </div>
                  ))}
                  {courseLinks.map(l => (
                    <div key={l.id} className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                      <div className="font-medium text-emerald-200">{l.title}</div>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 underline">{l.url}</a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {courseNotes.map(n => (
                    <Card key={n.id} className="bg-black/30 border border-zinc-800">
                      <CardHeader>
                        <CardTitle className="text-emerald-200">{n.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReactMarkdown>{n.content}</ReactMarkdown>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {courseLinks.map(l => (
                    <div key={l.id} className="rounded-md p-2 bg-black/30 border border-zinc-800">
                      <a className="text-emerald-300 underline" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
                    </div>
                  ))}
                  {courseLinks.length === 0 && <div className="text-zinc-400">No links yet.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Group Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-zinc-300">Group tasks UI goes here (create/assign/complete).</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discussions">
            <Card className="bg-black/40 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-emerald-200">Discussions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {demoDiscussions.map(d => (
                    <div key={d.id} className="rounded-md p-3 bg-black/30 border border-zinc-800">
                      <div className="font-medium text-emerald-200">{d.title}</div>
                      <div className="text-xs text-zinc-400">By {d.author}</div>
                      <div className="text-zinc-300 mt-2">{d.preview}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --------------------------- App Shell ---------------------------
export default function Demo() {
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({ course: "all", status: "all", date: null });
  const [routeParams, setRouteParams] = useState({}); // store route parameters like { id: 'cs101' }

  // aggregated global search
  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return { courses: [], assignments: [], notes: [], files: [], links: [] };
    const courses = demoCourses.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    const assignments = demoAssignments.filter(a => a.title.toLowerCase().includes(q) || a.course.toLowerCase().includes(q));
    const notes = demoNotes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    const files = demoFiles.filter(f => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q));
    const links = demoLinks.filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    return { courses, assignments, notes, files, links };
  }, [globalSearch]);

  // navigate helper to support params
  function navigate(route, params = {}) {
    setActive(route);
    setRouteParams(params || {});
    // close mobile nav if open
    setMobileOpen(false);
  }

  function applyGlobalFilters(filters) {
    setGlobalFilters(prev => ({ ...prev, ...filters }));
    setFiltersOpen(false);
  }

  // search results panel close
  function closeSearchPanel() { setGlobalSearch(""); }

  // ActiveView renderer
  function ActiveView() {
    switch (active) {
      case "dashboard": return <DashboardView navigate={navigate} />;
      case "courses": return <CoursesView openCourse={(id) => navigate("courseDetail", { id })} />;
      case "assignments": return <AssignmentsView globalFilters={globalFilters} />;
      case "notes": return <NotesView globalFilters={globalFilters} onAddNote={() => {}} />;
      case "files": return <FilesView />;
      case "calendar": return <CalendarView />;
      case "analytics": return <AnalyticsView />;
      case "discussions": return <DiscussionsView />;
      case "quizzes": return <QuizzesView />;
      case "tasks": return <TasksView />;
      case "links": return <LinksView />;
      case "certs": return <CertificatesView />;
      case "profile": return <ProfileView />;
      case "courseDetail": return <CourseDetailView courseId={routeParams?.id} onBack={() => navigate("courses")} />;
      default: return <DashboardView navigate={navigate} />;
    }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="flex">
        <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} onOpenFilters={() => setFiltersOpen(true)} onToggleSidebar={() => setMobileOpen(true)} />
          <main className="max-w-7xl mx-auto w-full p-3 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div key={active + JSON.stringify(routeParams)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                <ActiveView />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <SearchResultsPanel query={globalSearch} onClose={closeSearchPanel} />

      {/* Filters dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="bg-black/80 border border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-emerald-200">Global Filters</DialogTitle>
            <DialogDescription className="text-zinc-400">Filter lists site-wide</DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Course</Label>
              <Select value={globalFilters.course} onValueChange={(v) => setGlobalFilters(prev => ({ ...prev, course: v }))}>
                <SelectTrigger className="bg-black/40 border border-zinc-800"><SelectValue placeholder="All courses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {demoCourses.map(c => <SelectItem key={c.id} value={c.code}>{c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={globalFilters.status} onValueChange={(v) => setGlobalFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="bg-black/40 border border-zinc-800"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" className="bg-black/40 border border-zinc-800 rounded-md px-3 py-2 w-full text-zinc-100" onChange={(e) => setGlobalFilters(prev => ({ ...prev, date: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600" onClick={() => { applyGlobalFilters(globalFilters); }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

