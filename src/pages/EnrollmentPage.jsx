// src/pages/StudentEnrollmentPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // ✅ toast notifications

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

// icons
import {
  BookOpen,
  ArrowLeft,
  PlusCircle,
  CheckCircle2,
  Search,
} from "lucide-react";

export default function StudentEnrollmentPage() {
  const [userId, setUserId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState(new Set());
  const [query, setQuery] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // { courseId, type }
  const navigate = useNavigate();

  /* ---- Fetch user + courses ---- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch courses
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, title, description, created_at, profiles(full_name)")
        .order("created_at", { ascending: false });

      setCourses(courseData || []);

      // Fetch enrollments
      const { data: enrollData } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id);

      setEnrolled(new Set(enrollData?.map((e) => e.course_id) || []));
    })();
  }, []);

  /* ---- Handle Confirmed Action ---- */
  const handleConfirm = async () => {
    if (!confirmAction || !userId) return;
    const { courseId, type } = confirmAction;

    if (type === "enroll") {
      const { error } = await supabase.from("enrollments").insert({
        course_id: courseId,
        student_id: userId,
      });

      if (!error) {
        toast.success("Enrolled successfully!");
        setEnrolled((prev) => new Set(prev).add(courseId));
      } else {
        toast.error("Failed to enroll. Try again.");
      }
    }

    if (type === "unenroll") {
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("course_id", courseId)
        .eq("student_id", userId);

      if (!error) {
        toast.success("Unenrolled successfully!");
        setEnrolled((prev) => {
          const updated = new Set(prev);
          updated.delete(courseId);
          return updated;
        });
      } else {
        toast.error("Failed to unenroll. Try again.");
      }
    }

    setConfirmAction(null);
  };

  /* ---- Filter courses ---- */
  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010f0d] via-[#03211d] to-[#052b25] text-slate-100">
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
              Course Enrollment
            </h1>
            <p className="text-xs text-zinc-400 hidden md:block">
              Browse courses and manage your enrollments
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black"
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

      {/* Course Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.length > 0 ? (
          filteredCourses.map((c) => {
            const isEnrolled = enrolled.has(c.id);
            return (
              <Card
                key={c.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition flex flex-col"
              >
                <CardHeader>
                  <CardTitle className="text-emerald-300">{c.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col justify-between flex-grow space-y-4">
                  <p className="text-sm text-zinc-400">
                    {c.description || "No description available"}
                  </p>
                  <div className="text-xs text-zinc-500">
                    Coordinator: {c.profiles?.full_name || "Unknown"}
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span
                      className={`text-sm ${
                        isEnrolled ? "text-emerald-400" : "text-zinc-400"
                      }`}
                    >
                      {isEnrolled ? "Enrolled" : "Not Enrolled"}
                    </span>
                    <Button
                      size="sm"
                      className={`flex gap-1 ${
                        isEnrolled
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      }`}
                      onClick={() =>
                        setConfirmAction({
                          courseId: c.id,
                          type: isEnrolled ? "unenroll" : "enroll",
                        })
                      }
                    >
                      {isEnrolled ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Unenroll
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" /> Enroll
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <p className="text-zinc-500 text-center col-span-full py-12">
            No courses available
          </p>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent className="bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-400">
              {confirmAction?.type === "enroll"
                ? "Confirm Enrollment"
                : "Confirm Unenrollment"}
            </AlertDialogTitle>
            <AlertDialogDescription >
              {confirmAction?.type === "enroll"
                ? "Do you want to enroll in this course?"
                : "Do you want to unenroll from this course?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer bg-emerald-400 text-black hover:bg-emerald-300" onClick={handleConfirm}>
              {confirmAction?.type === "enroll" ? "Enroll" : "Unenroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
