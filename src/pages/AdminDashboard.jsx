// src/pages/AdminDashboardPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
  TableHead as TableHeadCell,
  // Note: keep names consistent with your UI library. Adjust imports if required.
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  Users,
  BookOpen,
  GraduationCap,
  UserCheck,
  ClipboardList,
  FileQuestion,
  Trophy,
  CheckSquare,
  BarChart3,
  Search,
  Menu,
  Link2,
  MessageCircle,
  ChevronLeft,
  LogOut,
  Settings,
  Calendar,
  StickyNote,
  Route,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Admin Dashboard Page
 *
 * Improvements:
 * - Responsive DataTable: shows classic table at md+ and stacked cards on small screens.
 * - Prevents overflow: uses overflow-auto for wide content and truncation/wrapping rules.
 * - Safe date formatting.
 */

export default function AdminDashboardPage() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [roleDist, setRoleDist] = useState([]);
  const [courseAnalytics, setCourseAnalytics] = useState([]);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      // Students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*");
      if (studentsError) {
        console.error("Error fetching students:", studentsError);
      } else {
        setStudents(studentsData || []);
      }

      // Courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, created_at");
      if (coursesError) {
        console.error("Error fetching courses:", coursesError);
      } else {
        setCourses(coursesData || []);
      }

      // Roles distribution (profiles table)
      const { data: rolesData } = await supabase.from("profiles").select("role");
      if (rolesData) {
        const dist = rolesData.reduce((acc, row) => {
          acc[row.role] = (acc[row.role] || 0) + 1;
          return acc;
        }, {});
        setRoleDist(Object.entries(dist).map(([role, count]) => ({ role, count })));
      } else {
        setRoleDist([]);
      }

      // Course analytics from enrollments
      const { data: enrollData } = await supabase.from("enrollments").select("course_id");
      if (enrollData && coursesData) {
        const enrollCounts = enrollData.reduce((acc, row) => {
          acc[row.course_id] = (acc[row.course_id] || 0) + 1;
          return acc;
        }, {});
        setCourseAnalytics(
          coursesData.map((c) => ({
            title: c.title,
            enrollments: enrollCounts[c.id] || 0,
          }))
        );
      } else {
        setCourseAnalytics([]);
      }
    };

    fetchData();
  }, []);

  // Helpers
  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return String(d);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCourses = courses.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010e0c] via-[#031815] to-[#051f1b] text-slate-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 bg-zinc-900/60 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-emerald-400" />
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block w-[360px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-5 w-5" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students or courses..."
                className="pl-10 pr-3 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* small-screen search icon */}
              <button
                onClick={() => {
                  // focus the search input on md+; for small devices, toggle a quick prompt
                  if (searchRef.current) searchRef.current.focus();
                }}
                className="p-2 rounded-md hover:bg-zinc-800/40"
                aria-label="Focus search"
              >
                <Search className="h-5 w-5 text-zinc-400" />
              </button>

              <button
                onClick={() => setMobileNavOpen(true)}
                className="md:hidden p-2 rounded-md hover:bg-zinc-800/40"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6 text-emerald-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex gap-6">
          {/* ===== Sidebar (Desktop) ===== */}
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
                <div className="sticky top-6 space-y-6">
                  <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-inner flex items-center gap-3">
                    <GraduationCap className="h-6 w-6 text-emerald-300" />
                    <div>
                      <h3 className="text-lg font-semibold">SVIT Admin</h3>
                      <p className="text-xs text-zinc-400">Manage system</p>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="ml-auto text-zinc-400 hover:text-emerald-300"
                      aria-label="Collapse sidebar"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="bg-zinc-900/40 border overflow-auto border-zinc-800 rounded-2xl p-2 divide-y divide-zinc-800">
                    <ul className="p-2 space-y-1">
                      <SidebarLink icon={<BookOpen />} label="Courses" onClick={() => navigate("/admin/create-course")} />
                      <SidebarLink icon={<CheckSquare />} label="Attendance" onClick={() => navigate("/admin/attendance")} />
                      <SidebarLink icon={<Route />} label="Make RoadMap" onClick={() => navigate("/admin/roadmaps")} />
                      <SidebarLink icon={<ClipboardList />} label="Assignments" onClick={() => navigate("/admin/assignments")} />
                      <SidebarLink icon={<FileQuestion />} label="Make Quiz" onClick={() => navigate("/admin/generate-quiz")} />
                      <SidebarLink icon={<Trophy />} label="Quiz Results" onClick={() => navigate("/admin/quiz-results")} />
                      <SidebarLink icon={<MessageCircle />} label="Discussions" onClick={() => navigate("/admin/discussions")} />
                      <SidebarLink icon={<Calendar />} label="Calendar" onClick={() => navigate("/admin/calendar")} />
                      <SidebarLink icon={<StickyNote />} label="Notes" onClick={() => navigate("/admin/notes")} />
                      <SidebarLink icon={<Link2 />} label="Course Links" onClick={() => navigate("/admin/course-links")} />
                      <SidebarLink icon={<Settings />} label="Settings" onClick={() => navigate("/admin/settings")} />
                    </ul>
                  </nav>
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

          {/* ===== Main content ===== */}
          <main className="flex-1 space-y-8 min-w-0">
            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Students" value={students.length} icon={<Users className="h-6 w-6 text-emerald-300" />} />
              <StatCard title="Total Courses" value={courses.length} icon={<BookOpen className="h-6 w-6 text-emerald-300" />} />
              <StatCard
                title="Active Roles"
                customChart={
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={roleDist}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="role" stroke="#aaa" />
                      <YAxis stroke="#aaa" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                        }}
                        labelStyle={{ color: "#22c55e" }}
                      />
                      <Bar dataKey="count" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                }
              />
            </div>

            {/* Course Analytics */}
            <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-md">
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-emerald-300">
                  <BarChart3 className="h-6 w-6" /> Course Analytics
                </CardTitle>
                <Button onClick={() => navigate("/admin/create-course")} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                  + Add Course
                </Button>
              </CardHeader>
              <CardContent>
                {courseAnalytics.length > 0 ? (
                  <div style={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={courseAnalytics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="title" stroke="#aaa" />
                        <YAxis stroke="#aaa" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #333" }}
                          labelStyle={{ color: "#22c55e" }}
                        />
                        <Bar dataKey="enrollments" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center">No analytics available</p>
                )}
              </CardContent>
            </Card>

            {/* Students Table */}
            <DataTable
              title="Students"
              icon={<Users className="h-6 w-6 text-emerald-300" />}
              headers={["Name", "Email", "Joined"]}
              rows={filteredStudents.map((s) => ([
                s.full_name || "—",
                s.email || "—",
                formatDate(s.created_at),
              ]))}
              emptyMessage="No students found"
            />

            {/* Courses Table */}
            <DataTable
              title="Courses"
              icon={<BookOpen className="h-6 w-6 text-emerald-300" />}
              headers={["Title", "Created At"]}
              rows={filteredCourses.map((c) => ([c.title || "—", formatDate(c.created_at)]))}
              emptyMessage="No courses found"
            />
          </main>
        </div>
      </div>

      {/* ===== Mobile Sidebar (overlay) ===== */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="w-72 h-full bg-zinc-900/95 overflow-auto backdrop-blur-lg border-r border-zinc-800 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <GraduationCap className="h-6 w-6 text-emerald-300" />
                <h4 className="text-lg font-semibold">SVIT Admin</h4>
                <button className="ml-auto text-zinc-400 hover:text-emerald-300" onClick={() => setMobileNavOpen(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-2">
                <SidebarLink icon={<BookOpen />} label="Courses" onClick={() => { navigate("/admin/create-course"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<Route />} label="Make RoadMap" onClick={() => { navigate("/admin/roadmaps"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<CheckSquare />} label="Attendance" onClick={() => { navigate("/admin/attendance"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<ClipboardList />} label="Assignments" onClick={() => { navigate("/admin/assignments"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<FileQuestion />} label="Make Quiz" onClick={() => { navigate("/admin/generate-quiz"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<Trophy />} label="Quiz Results" onClick={() => { navigate("/admin/quiz-results"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<MessageCircle />} label="Discussions" onClick={() => { navigate("/admin/discussions"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<Calendar />} label="Calendar" onClick={() => { navigate("/admin/calendar"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<StickyNote />} label="Notes" onClick={() => { navigate("/admin/notes"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<Link2 />} label="Course Links" onClick={() => { navigate("/admin/course-links"); setMobileNavOpen(false); }} />
                <SidebarLink icon={<Settings />} label="Settings" onClick={() => { navigate("/admin/settings"); setMobileNavOpen(false); }} />
              </nav>
              <Separator className="my-4" />
              <Button className="w-full bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black" onClick={() => setMobileNavOpen(false)}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Mobile Bottom Nav ===== */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 md:hidden">
        <div className="bg-zinc-900/70 backdrop-blur rounded-full px-3 py-2 flex items-center gap-3 border border-zinc-800">
          <button onClick={() => setMobileNavOpen(true)} className="p-2 rounded-md cursor-pointer hover:bg-zinc-800/40" aria-label="Open menu">
            <Menu className="h-6 w-6 text-emerald-300" />
          </button>
          <button onClick={() => navigate("/admin/create-course")} className="p-2 rounded-md cursor-pointer hover:bg-zinc-800/40" aria-label="Courses">
            <BookOpen className="h-6 w-6 text-emerald-300" />
          </button>
          <button onClick={() => navigate("/admin/attendance")} className="p-2 rounded-md cursor-pointer hover:bg-zinc-800/40" aria-label="Attendance">
            <CheckSquare className="h-6 w-6 text-emerald-300" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------
   Small Components
   ---------------- */
function StatCard({ title, value, icon, customChart }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/30 border border-zinc-800 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-300">{icon} {title}</CardTitle>
        </CardHeader>
        <CardContent>
          {customChart ? (
            customChart
          ) : (
            <div className="text-3xl md:text-4xl font-extrabold text-slate-100">{value}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * DataTable:
 * - Renders as a table on md+ screens (responsive horizontal scroll if needed)
 * - Renders as stacked cards on small screens (no overflow)
 *
 * Props:
 * - title, icon, headers (array), rows (array of arrays), emptyMessage
 */
function DataTable({ title, icon, headers, rows, emptyMessage }) {
  // rows is expected to be Array<Array<string|JSX>>
  return (
    <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-300">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Table for md+ */}
        <div className="hidden md:block">
          <div className="overflow-auto rounded-lg border border-zinc-800">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="border-zinc-800 cursor-default hover:bg-transparent bg-gray-950/40">
                  {headers.map((h, i) => (
                    <TableHead key={i} className="text-zinc-400 whitespace-nowrap px-4 py-3 text-sm">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((r, i) => (
                    <TableRow key={i} className="border-zinc-800 hover:bg-zinc-800/40">
                      {r.map((cell, j) => (
                        <TableCell key={j} className="text-zinc-300 px-4 py-3 align-top">
                          <div className="max-w-[360px] truncate">{cell}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="text-center text-zinc-500 p-6">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Card-list for small screens */}
        <div className="md:hidden space-y-3">
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Render each header+value pair vertically */}
                    {r.map((cell, j) => (
                      <div key={j} className="flex items-start gap-2 py-1">
                        <div className="w-28 text-zinc-400 text-xs font-medium">{headers[j]}</div>
                        <div className="flex-1 text-sm text-zinc-200 min-w-0 break-words">
                          <span className="block truncate">{cell}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-zinc-500 p-6">
              {emptyMessage}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarLink({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full gap-3 p-3 rounded-lg hover:bg-emerald-800/40 text-slate-100 text-sm"
    >
      <span className="text-emerald-300 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
