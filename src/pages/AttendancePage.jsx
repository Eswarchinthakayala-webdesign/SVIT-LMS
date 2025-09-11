// src/pages/AttendancePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

// shadcn/ui
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// icons
import {
  Users,
  BookOpen,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";

export default function AttendancePage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0 });
  const [attendanceMarked, setAttendanceMarked] = useState({});

  /* ---- Load localStorage ---- */
  useEffect(() => {
    const stored = localStorage.getItem("attendanceMarked");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const converted = Object.fromEntries(
          Object.entries(parsed).map(([key, ts]) => [key, new Date(Number(ts))])
        );
        setAttendanceMarked(converted);
      } catch (e) {
        console.error("Failed to parse attendanceMarked", e);
      }
    }
  }, []);

  /* ---- Save localStorage ---- */
  useEffect(() => {
    if (Object.keys(attendanceMarked).length > 0) {
      const serializable = Object.fromEntries(
        Object.entries(attendanceMarked).map(([key, date]) => [
          key,
          date.getTime(),
        ])
      );
      localStorage.setItem("attendanceMarked", JSON.stringify(serializable));
    }
  }, [attendanceMarked]);

  /* ---- Fetch courses ---- */
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase.from("courses").select("id, title");
      if (!error) {
        setCourses(data || []);
        setStats((prev) => ({ ...prev, totalCourses: data?.length || 0 }));
      }
    };
    fetchCourses();
  }, []);

  /* ---- Fetch students ---- */
  useEffect(() => {
    if (!selectedCourse) return;
    const fetchStudents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("enrollments")
        .select(
          `
          id,
          student_id,
          students (
            full_name,
            email
          )
        `
        )
        .eq("course_id", selectedCourse);
      if (error) {
        console.error("Error fetching students", error);
        setStudents([]);
      } else {
        const formatted = data.map((e) => ({
          id: e.student_id,
          full_name: e.students?.full_name || "Unknown",
          email: e.students?.email || "N/A",
        }));
        setStudents(formatted);
        setStats((prev) => ({ ...prev, totalStudents: formatted.length }));
      }
      setLoading(false);
    };
    fetchStudents();
  }, [selectedCourse]);

  /* ---- Helpers ---- */
  const getKey = (courseId, studentId) => `${courseId}-${studentId}`;
  const isDisabled = (studentId) => {
    const key = getKey(selectedCourse, studentId);
    const lastMarked = attendanceMarked[key];
    return lastMarked && new Date() - lastMarked < 60 * 60 * 1000;
  };
  const getResetTime = (studentId) => {
    const key = getKey(selectedCourse, studentId);
    const lastMarked = attendanceMarked[key];
    if (!lastMarked) return null;
    const resetAt = new Date(lastMarked.getTime() + 60 * 60 * 1000);
    return resetAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /* ---- Mark attendance ---- */
  const markAttendance = async (studentId, status) => {
    const now = new Date();
    const key = getKey(selectedCourse, studentId);
    if (isDisabled(studentId)) {
      toast.error("Attendance already marked within the last hour!");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("attendance").insert([
      {
        course_id: selectedCourse,
        student_id: studentId,
        status,
        marked_by: user?.id,
        date: now.toISOString().slice(0, 10),
      },
    ]);

    if (error) {
      console.error("Error marking attendance", error);
      toast.error("Failed to mark attendance");
    } else {
      toast.success(`Marked ${status}`, { position: "top-right" });
      setAttendanceMarked((prev) => ({ ...prev, [key]: now }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010f0d] via-[#031b17] to-[#052b25] text-slate-100">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-emerald-300" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-emerald-300">
              Attendance Management
            </h1>
            <p className="text-xs text-zinc-400 hidden md:block">
              Monitor, manage and confirm student attendance
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-black"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </motion.header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, color: "text-emerald-400", value: stats.totalCourses, label: "Courses" },
            { icon: Users, color: "text-cyan-400", value: stats.totalStudents, label: "Students" },
            { icon: Timer, color: "text-purple-400", value: "1 Hour", label: "Reset Time" },
          ].map((s, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Card className="bg-zinc-900/60 border border-zinc-800 p-5 flex items-center gap-4 rounded-2xl shadow-md hover:shadow-emerald-500/10 transition">
                <s.icon className={`h-7 w-7 ${s.color}`} />
                <div>
                  <p className={`font-bold text-xl ${s.color}`}>{s.value}</p>
                  <p className="text-zinc-400 text-sm">{s.label}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Course Selector */}
        <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-emerald-300">Select a Course</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCourse || ""} onValueChange={setSelectedCourse}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 w-full hover:border-emerald-500/50 transition">
                <SelectValue placeholder="Select a course">
                  <span className="text-emerald-100">
                    {selectedCourse
                      ? courses.find((c) => c.id === selectedCourse)?.title
                      : "Select a course"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                {courses.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="cursor-pointer hover:bg-emerald-500/20 transition"
                  >
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-emerald-300">Students</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-zinc-400">Loading students...</p>
            ) : students.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-950/60 border-zinc-800">
                        <TableHead className="text-emerald-400">Name</TableHead>
                        <TableHead className="text-emerald-400">Email</TableHead>
                        <TableHead className="text-emerald-400">Attendance</TableHead>
                        <TableHead className="text-emerald-400">Reset At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => (
                        <motion.tr
                          key={s.id}
                          whileHover={{ backgroundColor: "rgba(16,185,129,0.08)" }}
                          className="border-zinc-800"
                        >
                          <TableCell className="text-zinc-200 font-medium">
                            {s.full_name}
                          </TableCell>
                          <TableCell className="text-zinc-300">{s.email}</TableCell>
                          <TableCell className="flex gap-2">
                            {["present", "absent", "late"].map((status) => (
                              <AttendanceButton
                                key={status}
                                student={s}
                                status={status}
                                disabled={isDisabled(s.id)}
                                onConfirm={() => markAttendance(s.id, status)}
                              />
                            ))}
                          </TableCell>
                          <TableCell>
                            {getResetTime(s.id) ? (
                              <span className="text-sm text-emerald-400">
                                {getResetTime(s.id)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {students.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/80 shadow hover:shadow-emerald-500/10 transition"
                    >
                      <p className="font-semibold text-emerald-400">{s.full_name}</p>
                      <p className="text-sm text-zinc-400 mb-3">{s.email}</p>
                      <div className="flex flex-wrap gap-2">
                        {["present", "absent", "late"].map((status) => (
                          <AttendanceButton
                            key={status}
                            student={s}
                            status={status}
                            disabled={isDisabled(s.id)}
                            onConfirm={() => markAttendance(s.id, status)}
                            compact
                          />
                        ))}
                      </div>
                      {getResetTime(s.id) && (
                        <p className="text-xs text-zinc-400 mt-2">
                          Reset at {getResetTime(s.id)}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-zinc-500">No students enrolled</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Reusable Attendance Button with Dialog --- */
function AttendanceButton({ student, status, onConfirm, disabled, compact }) {
  const colors =
    status === "present"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : status === "absent"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-yellow-600 hover:bg-yellow-500";

  const Icon =
    status === "present" ? CheckCircle2 : status === "absent" ? XCircle : Clock;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size={compact ? "sm" : "default"}
          disabled={disabled}
          className={`cursor-pointer flex items-center gap-1 ${colors}`}
        >
          <Icon className="h-4 w-4" />
          {status}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-emerald-300">
            Confirm Attendance
          </AlertDialogTitle>
          <AlertDialogDescription>
            Mark{" "}
            <span className="font-semibold text-emerald-400">
              {student.full_name}
            </span>{" "}
            as <span className="font-semibold">{status}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
