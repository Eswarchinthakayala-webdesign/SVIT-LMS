// src/pages/CourseCreationPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// shadcn/ui
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  CartesianGrid,
} from "recharts";

// icons
import {
  BookOpen,
  ArrowLeft,
  Pencil,
  Trash2,
  LineChart as LineChartIcon,
  Calendar,
  PlusCircle,
} from "lucide-react";

export default function CourseCreationPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  /* ---------------- Fetch Courses ---------------- */
  useEffect(() => {
    const fetchCourses = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: true });

      if (!error) setCourses(data || []);
    };
    fetchCourses();
  }, []);

  /* ---------------- Create Course ---------------- */
  const handleCreateCourse = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a course");
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .insert([{ title, description, created_by: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Course "${title}" created successfully!`, { position: "top-right" });
      setCourses([...courses, data]);
      setTitle("");
      setDescription("");
    } catch (err) {
      console.error("Error creating course:", err);
      toast.error("Failed to create course", { position: "top-right" });
    } finally {
      setLoading(false);
      setConfirmCreate(false);
    }
  };

  /* ---------------- Delete Course ---------------- */
  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", confirmDeleteId);
    if (error) {
      toast.error("Failed to delete course", { position: "top-right" });
    } else {
      toast.success("Course deleted", { position: "top-right" });
      setCourses(courses.filter((c) => c.id !== confirmDeleteId));
    }
    setConfirmDeleteId(null);
  };

  /* ---------------- Analytics ---------------- */
  const analyticsData = useMemo(() => {
    const grouped = {};
    courses.forEach((c) => {
      const date = new Date(c.created_at).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }, [courses]);

  const stats = useMemo(() => {
    if (courses.length === 0) return null;
    const total = courses.length;
    const latest = new Date(
      Math.max(...courses.map((c) => new Date(c.created_at)))
    ).toLocaleDateString();
    const months =
      new Set(
        courses.map(
          (c) =>
            `${new Date(c.created_at).getFullYear()}-${new Date(
              c.created_at
            ).getMonth()}`
        )
      ).size || 1;
    const avgPerMonth = (total / months).toFixed(1);

    return { total, latest, avgPerMonth };
  }, [courses]);

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010f0d] via-[#031b17] to-[#052b25] text-white">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-300" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-emerald-300">
              Course Management
            </h1>
            <p className="text-xs text-zinc-400 hidden md:block">
              Create, manage and track your courses
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 bg-emerald-500 cursor-pointer text-black hover:bg-emerald-400"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </motion.header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Courses" value={stats.total} icon={<BookOpen className="h-5 w-5" />} />
            <StatCard label="Latest Created" value={stats.latest} icon={<Calendar className="h-5 w-5" />} />
            <StatCard label="Avg / Month" value={stats.avgPerMonth} icon={<LineChartIcon className="h-5 w-5" />} />
          </div>
        )}

        {/* Form + Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <PlusCircle className="h-5 w-5" />
                Create New Course
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setConfirmCreate(true);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-zinc-400 mb-1">Course Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter course title"
                    required
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter course description"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-emerald-500 cursor-pointer hover:bg-emerald-600 text-white w-full"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Course"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card className="bg-zinc-900/60 border border-zinc-800 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-300">
                <LineChartIcon className="h-5 w-5" />
                Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsData.length === 0 ? (
                <p className="text-zinc-500">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#aaa" />
                    <YAxis allowDecimals={false} stroke="#aaa" />
                    <RechartTooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #333",
                        color: "#fff",
                        borderRadius:"10px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#10B981"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Courses Grid */}
        <div>
          <h2 className="text-xl font-semibold text-emerald-400 mb-4">
            Your Courses
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {courses.length === 0 ? (
                <p className="text-zinc-500">No courses created yet.</p>
              ) : (
                courses.map((course) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-zinc-900/60 border border-zinc-800 hover:shadow-md transition-shadow rounded-2xl">
                      <CardHeader>
                        <CardTitle className="text-emerald-100 text-lg flex justify-between items-center">
                          <span className="capitalize">{course.title}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black cursor-pointer"
                              onClick={() =>
                                navigate(`/courses/edit/${course.id}`)
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500 text-red-400 hover:bg-red-500 hover:text-black cursor-pointer"
                              onClick={() => setConfirmDeleteId(course.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-zinc-300">{course.description}</p>
                        <p className="text-xs text-emerald-700 mt-2">
                          Created at:{" "}
                          {new Date(course.created_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Confirm Create */}
      <AlertDialog open={confirmCreate} onOpenChange={setConfirmCreate}>
        <AlertDialogContent className="bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-400">
              Confirm Course Creation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to create this course? <br />
              Title: <span className="font-semibold">{title}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateCourse}
              className="bg-emerald-500 cursor-pointer hover:bg-emerald-600 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
      >
        <AlertDialogContent className="bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">
              Delete Course
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this course? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 cursor-pointer hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Reusable Stat Card ---------------- */
function StatCard({ label, value, icon }) {
  return (
    <Card className="bg-zinc-900/60 border border-zinc-800 p-3 shadow-md hover:shadow-emerald-500/10 transition rounded-2xl">
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-600 text-white text-xs px-2 py-0.5 flex items-center gap-1">
          {icon}
          {label}
        </Badge>
        <div>
          <p className="text-lg font-bold text-emerald-400">{value}</p>
        </div>
      </div>
    </Card>
  );
}
