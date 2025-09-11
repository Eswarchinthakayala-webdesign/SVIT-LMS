// src/pages/StudentDashboardPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  GraduationCap,
  BookOpen,
  ClipboardList,
  FileText,
  Calendar,
  FileQuestion,
  ArrowRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  Home,
  Link2,
  Search,
  MessageCircle,
  Bell,
  Settings,
  CalendarDays,
  ListTodo,
  StickyNote,
  Route,
} from "lucide-react";

/**
 * Futuristic, responsive Student Dashboard
 * - Glassy sidebar (collapsible)
 * - Animated counters
 * - Search that filters courses, assignments, resources in real-time
 * - Framer Motion micro-interactions
 * - Improved contrast (no black text on dark bg)
 *
 * Requires TailwindCSS + framer-motion + lucide-react + your shared UI components
 */

export default function StudentDashboardPage() {
  const navigate = useNavigate();

  // data
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [resources, setResources] = useState([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop collapsible
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // mobile slide-over
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  // animated numbers
  const [countCourses, setCountCourses] = useState(0);
  const [countAssignments, setCountAssignments] = useState(0);
  const [countAttendancePct, setCountAttendancePct] = useState(0);

  const searchRef = useRef(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      navigate("/login");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // enrollments
        const { data: enrolledCourses, error: cErr } = await supabase
          .from("enrollments")
          .select("course_id, courses(id, title, created_at)")
          .eq("student_id", user.id);

        if (cErr) {
          console.error("Error fetching courses", cErr);
          setCourses([]);
        } else {
          setCourses((enrolledCourses || []).map((e) => e.courses || {}));
        }

        const courseIds = (enrolledCourses || []).map((e) => e.course_id);

        if (courseIds.length > 0) {
          const [{ data: assignmentsData, error: aErr }, { data: resData, error: rErr }] =
            await Promise.all([
              supabase
                .from("assignments")
                .select("id, title, due_date, course_id, courses(title)")
                .in("course_id", courseIds)
                .order("due_date", { ascending: true }),
              supabase
                .from("resources")
                .select("id, title, file_url, created_at, courses(title)")
                .in("course_id", courseIds)
                .order("created_at", { ascending: false })
                .limit(6),
            ]);

          if (aErr) console.error("Assignments fetch error", aErr);
          if (rErr) console.error("Resources fetch error", rErr);

          setAssignments(assignmentsData || []);
          setResources(resData || []);
        } else {
          setAssignments([]);
          setResources([]);
        }

        // attendance
        const { data: attendanceData, error: attErr } = await supabase
          .from("attendance")
          .select("course_id, status, courses(title)")
          .eq("student_id", user.id);

        if (attErr) console.error("Attendance fetch error", attErr);
        setAttendance(attendanceData || []);
      } catch (err) {
        console.error("Dashboard fetch error", err);
      }
    };

    fetchData();
  }, []);

  // animate counters when data changes
  useEffect(() => {
    animateNumber(countCourses, courses.length, setCountCourses, 600);
  }, [courses]);

  useEffect(() => {
    animateNumber(countAssignments, assignments.length, setCountAssignments, 600);
  }, [assignments]);

  useEffect(() => {
    const pct = computeAttendancePct(attendance);
    animateNumber(countAttendancePct, pct, setCountAttendancePct, 700);
  }, [attendance]);

  // helper for number animation
  function animateNumber(from, to, setter, duration = 500) {
    const start = Date.now();
    const diff = to - from;
    if (diff === 0) {
      setter(to);
      return;
    }
    const raf = () => {
      const now = Date.now();
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setter(Math.round(from + diff * eased));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function computeAttendancePct(att) {
    const total = att.length;
    if (!total) return 0;
    const present = att.filter((a) => a.status === "present").length;
    return Math.round((present / total) * 100);
  }

  // derived search results (filtering across datasets)
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = useMemo(() => {
    if (!normalizedQuery) return courses;
    return courses.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(normalizedQuery) ||
        (c.id || "").toString().toLowerCase().includes(normalizedQuery)
    );
  }, [courses, normalizedQuery]);

  const filteredAssignments = useMemo(() => {
    if (!normalizedQuery) return assignments;
    return assignments.filter((a) => {
      const title = (a.title || "").toLowerCase();
      const course = (a.courses?.title || "").toLowerCase();
      return title.includes(normalizedQuery) || course.includes(normalizedQuery);
    });
  }, [assignments, normalizedQuery]);

  const filteredResources = useMemo(() => {
    if (!normalizedQuery) return resources;
    return resources.filter((r) => {
      const title = (r.title || "").toLowerCase();
      const course = (r.courses?.title || "").toLowerCase();
      return title.includes(normalizedQuery) || course.includes(normalizedQuery);
    });
  }, [resources, normalizedQuery]);

  // attendance summary map
  const attendanceSummary = useMemo(() => {
    return attendance.reduce((acc, row) => {
      const key = row.courses?.title ?? "Unknown Course";
      if (!acc[key]) acc[key] = { present: 0, absent: 0, late: 0 };
      if (row.status && acc[key][row.status] !== undefined) acc[key][row.status] += 1;
      return acc;
    }, {});
  }, [attendance]);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  // accessibility: focus search when activated
  useEffect(() => {
    if (searchActive && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchActive]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      {/* ===== Top mobile header (fixed) ===== */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900/60 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 rounded-md hover:bg-zinc-800/40"
            >
              <Menu className="h-6 w-6 text-emerald-300" />
            </button>

            <div className="flex items-center gap-2">
              <div className="bg-emerald-600/10 text-emerald-300 rounded p-1.5">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">SVIT Student</div>
                <div className="text-xs text-zinc-400">Overview</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-md cursor-pointer bg-emerald-500 hover:bg-emerald-400 "
              onClick={() => setSearchActive((s) => !s)}
              aria-label="Open search"
            >
              <Search className="h-5 w-5 text-black" />
            </button>
            <button className="p-2 rounded-md cursor-pointer  bg-emerald-500 hover:bg-emerald-400" onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-black" />
            </button>
          </div> 
        </div>

        <AnimatePresence>
          {searchActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-zinc-900/60 border-b border-zinc-800"
            >
              <div className="max-w-7xl mx-auto p-3 px-4">
                <div className="flex gap-2 items-center bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-700">
                  <Search className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search assignments, courses..."
                    className="bg-transparent outline-none text-sm grow text-zinc-100 placeholder:text-zinc-500"
                    aria-label="Search"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="text-zinc-400 text-sm p-1"
                      aria-label="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-16 md:pt-8 pb-12">
        <div className="flex gap-6">
          {/* ===== Sidebar (desktop) ===== */}
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.aside
                key="sidebar"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="hidden md:flex flex-col w-72 shrink-0"
              >
                {/* glassy card */}
                <div className="sticky top-6 space-y-6">
                  <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-inner">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-emerald-500/12 to-cyan-400/6 rounded p-2">
                        <GraduationCap className="h-6 w-6 text-emerald-200" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">SVIT Student</h3>
                        <p className="text-xs text-zinc-400">Overview & progress</p>
                      </div>
                      <button
                        aria-label="Collapse sidebar"
                        onClick={() => setSidebarOpen(false)}
                        className="ml-auto text-zinc-400 hover:text-emerald-300"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <nav className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-2 divide-y divide-zinc-800">
                    <ul className="p-2 space-y-1">
                      
                      <li>
                        <Link
                          to="/student/enrollments"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <BookOpen className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Enrollments</span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          to="/student/assignments"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <ClipboardList className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Assignments</span>
                        </Link>
                      </li>
                       <li>
                        <Link
                          to="/student/roadmaps"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <Route className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Roadmaps</span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          to="/student/quiz"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <FileQuestion className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Quizzes</span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          to="/student/attendance"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <Calendar className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Attendance</span>
                        </Link>
                      </li>

                       <li>
                        <Link
                          to="/student/discussions"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <MessageCircle  className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Discussions</span>
                        </Link>
                      </li>
                       <li>
                        <Link
                          to="/student/calendar"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <CalendarDays  className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Calendar</span>
                        </Link>
                      </li>
                        <li>
                        <Link
                          to="/student/tasks"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <ListTodo  className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Task Manager</span>
                        </Link>
                      </li>
                        <li>
                        <Link
                          to="/student/notes"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <StickyNote  className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Notes</span>
                        </Link>
                      </li>
                       <li>
                        <Link
                          to="/student/course-links"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <Link2  className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Course Links</span>
                        </Link>
                      </li>
                        <li>
                        <Link
                          to="/student/settings"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
                        >
                          <Settings className="h-5 w-5 text-emerald-300" />
                          <span className="text-sm font-medium text-slate-100">Settings</span>
                        </Link>
                      </li>
                     
                    </ul>
                  </nav>

                  <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-100">Signed in as</p>
                        <p className="text-xs text-zinc-400">Student</p>
                      </div>
                      <Button variant="ghost" onClick={handleLogout} className="text-emerald-300">
                        <LogOut className="h-4 w-4 mr-2 inline" /> Logout
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.aside>
            ) : (
              <div className="hidden md:flex items-start pr-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mt-6 p-2 rounded-md bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-800/50"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5 text-emerald-300" />
                </button>
              </div>
            )}
          </AnimatePresence>

          {/* ===== Main content area ===== */}
          <main className="flex-1">
            {/* header + search */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.32 }}
                    className="bg-gradient-to-br from-emerald-400/10 to-cyan-400/6 p-2 rounded"
                  >
                    <GraduationCap className="h-7 w-7 text-emerald-300" />
                  </motion.div>

                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Student Dashboard</h1>
                    <p className="text-sm text-zinc-400 mt-1">
                      Welcome back  — a clear  view of your courses, assignments and attendance.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2 border border-zinc-800">
                  <Search className="h-4 w-4 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search assignments, courses..."
                    className="bg-transparent grow outline-none text-sm placeholder:text-zinc-500 text-zinc-100"
                    aria-label="Search"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-zinc-400 text-sm p-1">
                      Clear
                    </button>
                  )}
                </div>

                <button
                  title="Notifications"
                  className="p-2 rounded-md hover:bg-zinc-800/40 hidden sm:inline"
                >
                  <Bell className="h-5 w-5 text-zinc-300" />
                </button>

               
              </div>
            </div>

            {/* summary metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <AnimatedStatCard
                title="My Courses"
                subtitle="Active enrollments"
                value={countCourses}
                icon={<BookOpen className="h-5 w-5 text-emerald-300" />}
              />
              <AnimatedStatCard
                title="Upcoming Assignments"
                subtitle="Due soon"
                value={countAssignments}
                icon={<ClipboardList className="h-5 w-5 text-emerald-300" />}
              />
              <AnimatedStatCard
                title="Attendance"
                subtitle="Overall presence"
                value={`${countAttendancePct}%`}
                icon={<Calendar className="h-5 w-5 text-emerald-300" />}
              />
            </div>

            {/* main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* left column */}
              <div className="space-y-6">
                {/* Enrolled Courses */}
                <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <CardHeader className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-emerald-300" />
                      <CardTitle className="text-emerald-300 text-lg">Enrolled Courses</CardTitle>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/student/enrollments")} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                      View all <ArrowRight className="h-4 w-4 " />
                    </Button>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader >
                        <TableRow className="border-zinc-800 hover:bg-emerald-500/10 bg-gray-950 cursor-pointer">
                          <TableHead className="text-zinc-400">Course</TableHead>
                          <TableHead className="text-zinc-400">Enrolled On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCourses.length > 0 ? (
                          filteredCourses.map((c) => (
                            <TableRow key={c.id} className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                              <TableCell>
                                <Link to={`/courses/${c.id}`} className="text-emerald-300 hover:underline font-medium">
                                  {c.title}
                                </Link>
                              </TableCell>
                              <TableCell className="text-zinc-300">{fmtDate(c.created_at)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-zinc-500 p-6">
                              No enrolled courses
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Assignments */}
                <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <CardHeader className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-5 w-5 text-emerald-300" />
                      <CardTitle className="text-emerald-300 text-lg">Upcoming Assignments</CardTitle>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/student/assignments")} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                      View all <ArrowRight className="h-4 w-4 " />
                    </Button>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-emerald-500/10 bg-gray-950 cursor-pointer">
                          <TableHead className="text-zinc-400">Title</TableHead>
                          <TableHead className="text-zinc-400">Course</TableHead>
                          <TableHead className="text-zinc-400">Due Date</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredAssignments.length > 0 ? (
                          filteredAssignments.map((a) => (
                            <TableRow key={a.id} className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                              <TableCell className="font-medium text-zinc-100">{a.title}</TableCell>
                              <TableCell className="text-zinc-300">{a.courses?.title || "—"}</TableCell>
                              <TableCell className="text-zinc-300">{fmtDate(a.due_date)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-zinc-500 p-6">
                              No upcoming assignments
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* right column */}
              <div className="space-y-6">
                {/* Attendance */}
                <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <CardHeader className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-emerald-300" />
                      <CardTitle className="text-emerald-300 text-lg">Attendance Summary</CardTitle>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/student/attendance")} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                      Details <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardHeader>

                  <CardContent>
                    {Object.keys(attendanceSummary).length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-emerald-500/10 bg-gray-950 cursor-pointer">
                            <TableHead className="text-zinc-400">Course</TableHead>
                            <TableHead className="text-zinc-400">Present</TableHead>
                            <TableHead className="text-zinc-400">Absent</TableHead>
                            <TableHead className="text-zinc-400">Late</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(attendanceSummary).map(([course, stats]) => (
                            <TableRow key={course} className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40">
                              <TableCell className="font-medium text-zinc-100">{course}</TableCell>
                              <TableCell className="text-zinc-300">{stats.present}</TableCell>
                              <TableCell className="text-zinc-300">{stats.absent}</TableCell>
                              <TableCell className="text-zinc-300">{stats.late}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-6 text-center text-zinc-500">No attendance records</div>
                    )}
                  </CardContent>
                </Card>

                {/* Resources */}
                <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <CardHeader className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-emerald-300" />
                      <CardTitle className="text-emerald-300 text-lg">Course Links</CardTitle>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/student/course-links")} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                      Browse <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardHeader>

                  <CardContent>
                    {filteredResources.length > 0 ? (
                      <ul className="space-y-3">
                        {filteredResources.map((r) => (
                          <li
                            key={r.id}
                            className="p-3 bg-zinc-800/30 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                          >
                            <div>
                              <p className="font-medium text-zinc-100">{r.title || "Untitled"}</p>
                              <p className="text-sm text-zinc-400">
                                {r.courses?.title || "—"} • {fmtDate(r.created_at)}
                              </p>
                            </div>

                            <div className="mt-2 sm:mt-0">
                              {r.file_url ? (
                                <a
                                  href={r.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800/60 text-emerald-300"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-6 text-center text-zinc-500">Link on the Browse to see the Course Links</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ===== Mobile slide-over nav ===== */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="w-72 h-full bg-zinc-900/95 backdrop-blur p-4 border-r border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-600/10 text-emerald-300 p-2 rounded">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-100">SVIT Student</h4>
                  <p className="text-xs text-zinc-400">Overview & progress</p>
                </div>
                <button className="ml-auto cursor-pointer hover:text-emerald-300 text-zinc-400" onClick={() => setMobileNavOpen(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1">
                <ul className="space-y-1">
                 
                  <li>
                    <Link to="/student/enrollments" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <BookOpen className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Enrollments</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/student/assignments" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <ClipboardList className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Assignments</span>
                    </Link>
                  </li>
                   <li>
                    <Link to="/student/roadmaps" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <Route className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Roadmaps</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/student/quiz" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <FileQuestion className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Quizzes</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/student/attendance" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <Calendar className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Attendance</span>
                    </Link>
                  </li>
                   <li>
                    <Link to="/student/discussions" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <MessageCircle className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Discussions</span>
                    </Link>
                  </li>
                   <li>
                    <Link to="/student/calendar" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <CalendarDays className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Calendar</span>
                    </Link>
                  </li>
                    <li>
                    <Link to="/student/tasks" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <ListTodo className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Task Manager</span>
                    </Link>
                  </li>
                    <li>
                    <Link to="/student/notes" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <StickyNote className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Notes</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/student/course-links" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <Link2 className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Course Links</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/student/settings" className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-800/40">
                      <Settings className="h-5 w-5 text-emerald-300" /> <span className="font-medium text-slate-100">Settings</span>
                    </Link>
                  </li>
                  
                </ul>
              </nav>

              <div className="mt-6">
                <Separator className="mb-4" />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-100">Signed in as</p>
                    <p className="text-xs text-zinc-400">Student</p>
                  </div>
                  <Button variant="ghost"  onClick={handleLogout} className=" cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400">
                    <LogOut className="h-4 w-4  inline" /> Logout
                  </Button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Mobile bottom navigation (floating) ===== */}
      <div className="fixed left-1/2 transform -translate-x-1/2 bottom-4 z-50 md:hidden">
        <div className="bg-zinc-900/70 backdrop-blur rounded-full px-3 py-2 flex items-center gap-3 border border-zinc-800">
          <button className="p-2 cursor-pointer rounded-md hover:bg-zinc-800/40" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-emerald-300" />
          </button>
         
          <button className="p-2 cursor-pointer rounded-md hover:bg-zinc-800/40" onClick={() => setSearchActive((s) => !s)} aria-label="Search">
            <Search className="h-6 w-6 text-emerald-300" />
          </button>
          <button className="p-2 cursor-pointer rounded-md hover:bg-zinc-800/40" onClick={handleLogout} aria-label="Logout">
            <LogOut className="h-6 w-6 text-emerald-300" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   Small reusable components
   ----------------------- */

function AnimatedStatCard({ title, subtitle, value, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/30 border border-zinc-800 shadow-md">
        <CardHeader>
          <CardTitle className="text-emerald-300">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-slate-100">{value}</div>
              <p className="text-zinc-400 mt-1 text-sm">{subtitle}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700">{icon}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
