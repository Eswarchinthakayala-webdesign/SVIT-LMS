// src/pages/StudentAttendancePage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// shadcn/ui
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

// icons
import {
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

export default function StudentAttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [userId, setUserId] = useState(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // 1. Fetch attendance
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("id, date, status, courses(title), marked_by, created_at")
        .eq("student_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Attendance fetch error:", error.message);
        return;
      }

      // 2. Fetch coordinator names
      const coordinatorIds = [
        ...new Set(attendanceData.map((a) => String(a.marked_by)).filter(Boolean)),
      ];

      let coordinatorMap = {};
      if (coordinatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", coordinatorIds);

        if (profilesData) {
          coordinatorMap = profilesData.reduce((acc, p) => {
            acc[p.id] = p.full_name;
            return acc;
          }, {});
        }
      }

      // 3. Attach coordinator_name
      const withNames = attendanceData.map((a) => ({
        ...a,
        coordinator_name: a.marked_by
          ? coordinatorMap[a.marked_by] || "Unknown"
          : "—",
      }));

      setAttendance(withNames);
    })();
  }, []);

  /* ---- Group by course ---- */
  const coursesGrouped = useMemo(() => {
    const grouped = {};
    attendance.forEach((a) => {
      const course = a.courses?.title || "Unknown Course";
      if (!grouped[course]) grouped[course] = [];
      grouped[course].push(a);
    });
    return grouped;
  }, [attendance]);

  /* ---- Filter courses by search ---- */
  const filteredCourses = Object.entries(coursesGrouped).filter(([course]) =>
    course.toLowerCase().includes(query.toLowerCase())
  );

  /* ---- Toggle expand/collapse ---- */
  const toggleExpand = (course) => {
    setExpanded((prev) => ({ ...prev, [course]: !prev[course] }));
  };


    const summary = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((a) => a.status === "present").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const late = attendance.filter((a) => a.status === "late").length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, percentage };
  }, [attendance]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010f0d] via-[#03211d] to-[#052b25] text-slate-100">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-emerald-300" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-emerald-300">
              Attendance
            </h1>
            <p className="text-xs text-zinc-400 hidden md:block">
              Track your attendance per course
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 bg-emerald-600 cursor-pointer hover:bg-emerald-400 text-black"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </motion.header>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 mb-4">
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 w-full md:w-96 shadow-sm hover:shadow-emerald-500/10 transition">
          <Search className="h-4 w-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses..."
            className="bg-transparent border-0 focus-visible:ring-0 text-sm text-zinc-100"
          />
        </div>
      </div>
      
          <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            icon={<CalendarDays className="h-5 w-5 text-emerald-300" />}
            label="Total"
            value={summary.total}
          />
          <SummaryCard
            icon={<CheckCircle className="h-5 w-5 text-green-400" />}
            label="Present"
            value={summary.present}
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-red-400" />}
            label="Absent"
            value={summary.absent}
          />
          <SummaryCard
            icon={<Clock className="h-5 w-5 text-yellow-400" />}
            label="Late"
            value={summary.late}
          />
          <SummaryCard
            icon={<CheckCircle className="h-5 w-5 text-emerald-300" />}
            label="Percentage"
            value={`${summary.percentage}%`}
          />
        </div>
      {/* Course-wise Attendance */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-6">
        {filteredCourses.length > 0 ? (
          filteredCourses.map(([course, records]) => {
            const present = records.filter((r) => r.status === "present").length;
            const absent = records.filter((r) => r.status === "absent").length;
            const late = records.filter((r) => r.status === "late").length;
            const total = records.length;

            const chartData = records
              .slice()
              .reverse()
              .map((r) => ({
                date: new Date(r.date).toLocaleDateString(),
                present: r.status === "present" ? 1 : 0,
                absent: r.status === "absent" ? 1 : 0,
                late: r.status === "late" ? 1 : 0,
              }));

            return (
              <Card
                key={course}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition"
              >
                <CardHeader
                  onClick={() => toggleExpand(course)}
                  className="flex items-center justify-between cursor-pointer p-6"
                >
                  <div className="flex items-center gap-2">
                    {expanded[course] ? (
                      <ChevronDown className="h-5 w-5 text-emerald-300" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-emerald-300" />
                    )}
                    <CardTitle className="text-emerald-300 text-lg">
                      {course}
                    </CardTitle>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-400 font-medium">
                      Present: {present}/{total}
                    </span>
                    <span className="text-red-400 font-medium">Absent: {absent}</span>
                    <span className="text-yellow-400 font-medium">Late: {late}</span>
                  </div>
                </CardHeader>

                {expanded[course] && (
                  <CardContent className="space-y-6 p-6">
                    {/* Mini Chart */}
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#aaa" />
                          <YAxis stroke="#aaa" allowDecimals={false} />
                          <RTooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #333",
                              color: "#fff",
                              borderRadius:"10px",
                            }}
                            labelStyle={{ color: "#22c55e" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="present"
                            stroke="#22c55e"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="absent"
                            stroke="#f87171"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="late"
                            stroke="#facc15"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-zinc-500 text-center py-6">
                        No records yet
                      </p>
                    )}

                    {/* Attendance Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-800 hover:bg-emerald-700/10 cursor-pointer">
                            <TableHead className="text-zinc-400">Date</TableHead>
                            <TableHead className="text-zinc-400">Status</TableHead>
                            <TableHead className="text-zinc-400">
                              Marked by
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map((a) => (
                            <TableRow
                              key={a.id}
                              className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40"
                            >
                              <TableCell className="text-emerald-100">
                                {new Date(a.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {a.status === "present" && (
                                  <span className="text-green-400 font-medium">
                                    Present
                                  </span>
                                )}
                                {a.status === "absent" && (
                                  <span className="text-red-400 font-medium">
                                    Absent
                                  </span>
                                )}
                                {a.status === "late" && (
                                  <span className="text-yellow-400 font-medium">
                                    Late
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-emerald-400">{a.coordinator_name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        ) : (
          <p className="text-zinc-500 text-center py-12">No courses found</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow hover:shadow-emerald-500/10 transition">
      <CardHeader className="flex flex-col items-center justify-center py-4">
        {icon}
        <CardTitle className="text-sm text-zinc-400 mt-2">{label}</CardTitle>
        <CardContent className="text-2xl font-bold text-emerald-300">
          {value}
        </CardContent>
      </CardHeader>
    </Card>
  );
}