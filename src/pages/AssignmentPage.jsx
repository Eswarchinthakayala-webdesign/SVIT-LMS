// src/pages/AssignmentPage.jsx
// -----------------------------------------------------------------------------
// AssignmentManagementPage (Refined + PDF upload support)
// - Full page: create/edit assignments, grade submissions, analytics, responsive
// - Added: PDF upload field for admins (uploads to 'assignment-pdfs' Supabase bucket)
// - Saves `file_url` in `assignments` table and shows "View PDF" where available
// - Preserves original behavior; minimal changes limited to upload handling and UI
// -----------------------------------------------------------------------------


import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";

// shadcn/ui
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select as ShadcnSelect,
  SelectTrigger as ShadcnSelectTrigger,
  SelectContent as ShadcnSelectContent,
  SelectItem as ShadcnSelectItem,
  SelectValue as ShadcnSelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// icons
import {
  Calendar as CalendarIcon,
  FileText,
  PlusCircle,
  Edit,
  Trash,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

// charts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// -----------------------------------------------------------------------------
// Theme & helpers
// -----------------------------------------------------------------------------

const COLORS = ["#10B981", "#34D399", "#059669", "#047857", "#065F46", "#06b6d4", "#8b5cf6"];

function formatDateDisplay(d) {
  try {
    if (!d) return "N/A";
    return new Date(d).toLocaleString();
  } catch {
    return "N/A";
  }
}

// -----------------------------------------------------------------------------
// ThemedSelect (wraps shadcn Select with dark/emerald styling)
// -----------------------------------------------------------------------------

function ThemedSelectRoot({ children, ...props }) {
  return <ShadcnSelect {...props}>{children}</ShadcnSelect>;
}
function ThemedSelectTrigger({ className = "", ...props }) {
  return (
    <ShadcnSelectTrigger
      {...props}
      className={[
        "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2",
        "text-zinc-200 placeholder:text-zinc-500",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40",
        "hover:border-emerald-600/30 transition-colors",
        "cursor-pointer",
        className,
      ].join(" ")}
    />
  );
}
function ThemedSelectContent({ className = "", ...props }) {
  return (
    <ShadcnSelectContent
      {...props}
      className={[
        "bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl overflow-hidden",
        "text-zinc-200",
        className,
      ].join(" ")}
    />
  );
}
function ThemedSelectItem({ className = "", ...props }) {
  return (
    <ShadcnSelectItem
      {...props}
      className={[
        "cursor-pointer text-zinc-200",
        "focus:bg-emerald-500/15 focus:text-emerald-200",
        "data-[state=checked]:bg-emerald-600/20 data-[state=checked]:text-emerald-200",
        "data-[highlighted]:bg-emerald-600/20 data-[highlighted]:text-emerald-100 outline-none",
        className,
      ].join(" ")}
    />
  );
}
function ThemedSelectValue(props) {
  return <ShadcnSelectValue {...props} />;
}
export const ThemedSelect = Object.assign(ThemedSelectRoot, {
  Trigger: ThemedSelectTrigger,
  Content: ThemedSelectContent,
  Item: ThemedSelectItem,
  Value: ThemedSelectValue,
});

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function AssignmentPage() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  // Data
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Form
  const [newAssignment, setNewAssignment] = useState({
    course_id: "",
    title: "",
    description: "",
    due_date: "",
  });
  const [editingAssignment, setEditingAssignment] = useState(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Mobile UI toggles
  const [mobileAssignmentsOpen, setMobileAssignmentsOpen] = useState({});
  const [mobileSubmissionsOpen, setMobileSubmissionsOpen] = useState({});

  // Submission counts per course (client-side aggregation)
  const [submissionCountsByCourse, setSubmissionCountsByCourse] = useState({});

  // PDF upload state (new)
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // ---------------------------------------------------------------------------
  // Initial load: courses + assignments (joined with profiles to get creator name)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      await fetchCourses();
      await fetchAssignments();
    })();
  }, []);

  // fetch courses
  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase.from("courses").select("id, title");
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses error", err);
      toast.error("Failed to load courses");
    }
  };

  // fetch assignments and join profiles to get creator name
  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, course_id, title, description, due_date, created_at, created_by, file_url, profiles!created_by(full_name, id)"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row) => ({
        ...row,
        created_by_name: row?.profiles?.full_name || null,
      }));

      setAssignments(normalized);
    } catch (err) {
      console.error("fetchAssignments error", err);
      toast.error("Failed to load assignments");
    }
  };

  // ---------------------------------------------------------------------------
  // When assignments change, update submission counts per course
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("submissions").select("id, assignment_id");
        if (error) throw error;
        const map = {};
        data?.forEach((s) => {
          const a = assignments.find((x) => x.id === s.assignment_id);
          if (a) map[a.course_id] = (map[a.course_id] || 0) + 1;
        });
        setSubmissionCountsByCourse(map);
      } catch (err) {
        console.error("submissionCounts fetch err", err);
      }
    })();
  }, [assignments]);

  // ---------------------------------------------------------------------------
  // Fetch submissions for currently selected assignment
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedAssignment) {
      setSubmissions([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("submissions")
          .select("*, students(id, full_name, email)")
          .eq("assignment_id", selectedAssignment.id)
          .order("submitted_at", { ascending: true });

        if (error) {
          console.error("fetchSubmissions error", error);
          toast.error("Failed to fetch submissions");
        } else if (mounted) {
          setSubmissions(data || []);
        }
      } catch (err) {
        console.error("fetchSubmissions error", err);
        toast.error("Failed to fetch submissions");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedAssignment]);

  // ---------------------------------------------------------------------------
  // Utilities: scroll-to-top when editing
  // ---------------------------------------------------------------------------
  const startEdit = useCallback((assignment) => {
    setEditingAssignment(assignment);
    setNewAssignment({
      course_id: assignment.course_id || "",
      title: assignment.title || "",
      description: assignment.description || "",
      due_date: assignment.due_date || "",
    });

    try {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        const el = document.querySelector('input[name="assignment-title"]');
        el?.focus();
      }, 400);
    } catch {}
  }, []);

  // ---------------------------------------------------------------------------
  // Upload helper: upload PDF to 'assignment-pdfs' bucket and return public URL
  // ---------------------------------------------------------------------------
  async function uploadPdfToBucket(file) {
    if (!file) return null;
    try {
      setUploadingPdf(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `assignments/${fileName}`;

      // upload
      const { error: uploadError } = await supabase.storage
        .from("assignment-pdfs")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error("PDF upload error", uploadError);
        throw uploadError;
      }

      // get public url
      const { data: publicUrlData } = supabase.storage
        .from("assignment-pdfs")
        .getPublicUrl(filePath);

      setUploadingPdf(false);
      return publicUrlData.publicUrl;
    } catch (err) {
      setUploadingPdf(false);
      console.error("uploadPdfToBucket", err);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Create / Update assignment (with PDF upload)
  // - On insert, set created_by to current user id
  // - On update, avoid changing created_by (preserve original creator)
  // ---------------------------------------------------------------------------
  const handleSaveAssignment = async (e) => {
    e?.preventDefault?.();
    if (!newAssignment.course_id || !newAssignment.title) {
      toast.error("Please select a course and provide a title.");
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If a PDF file selected, upload first and get URL
      let file_url = editingAssignment?.file_url || null;
      if (pdfFile) {
        try {
          const uploadedUrl = await uploadPdfToBucket(pdfFile);
          if (uploadedUrl) file_url = uploadedUrl;
          else {
            toast.error("PDF upload returned no URL");
            setLoading(false);
            return;
          }
        } catch (err) {
          toast.error("Failed to upload PDF");
          setLoading(false);
          return;
        }
      }

      if (editingAssignment) {
        const updates = {
          course_id: newAssignment.course_id,
          title: newAssignment.title,
          description: newAssignment.description,
          due_date: newAssignment.due_date || null,
          file_url: file_url || null,
        };

        const { error } = await supabase
          .from("assignments")
          .update(updates)
          .eq("id", editingAssignment.id);

        if (error) {
          console.error("update error", error);
          toast.error("Failed to update assignment");
        } else {
          toast.success("Assignment updated");
          await fetchAssignments();

          if (selectedAssignment?.id === editingAssignment.id) {
            const { data: fresh } = await supabase
              .from("assignments")
              .select("*, profiles!created_by(full_name, id)")
              .eq("id", editingAssignment.id)
              .single();

            if (fresh) {
              setSelectedAssignment({
                ...fresh,
                created_by_name: fresh?.profiles?.full_name || null,
              });
            }
          }
        }
      } else {
        const payload = {
          course_id: newAssignment.course_id,
          title: newAssignment.title,
          description: newAssignment.description,
          due_date: newAssignment.due_date || null,
          created_by: user?.id ?? null,
          file_url: file_url || null,
        };

        const { data, error } = await supabase
          .from("assignments")
          .insert([payload])
          .select("*, profiles!created_by(full_name, id)")
          .single();

        if (error) {
          console.error("insert error", error);
          toast.error("Failed to create assignment");
        } else {
          toast.success("Assignment created");
          const normalized = { ...data, created_by_name: data?.profiles?.full_name || null };
          setAssignments((p) => [normalized, ...(p || [])]);
        }
      }

      setNewAssignment({ course_id: "", title: "", description: "", due_date: "" });
      setEditingAssignment(null);
      setPdfFile(null);
    } catch (err) {
      console.error("handleSaveAssignment err", err);
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete assignment (confirm)
  // ---------------------------------------------------------------------------
  const handleConfirmDelete = (assignment) => {
    setDeleteTarget(assignment);
    setShowConfirmDelete(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("assignments").delete().eq("id", deleteTarget.id);
      if (error) {
        console.error("delete error", error);
        toast.error("Failed to delete assignment");
      } else {
        toast.success("Assignment deleted");
        setAssignments((p) => p.filter((a) => a.id !== deleteTarget.id));
        if (selectedAssignment?.id === deleteTarget.id) setSelectedAssignment(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete assignment");
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
      setDeleteTarget(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Grade submission (persist only on Save)
  // ---------------------------------------------------------------------------
  const persistGradeFeedback = useCallback(async (submissionId, grade, feedback) => {
    setLoading(true);
    try {
      const parsedGrade =
        grade === "" || grade === null || grade === undefined
          ? null
          : Number.isNaN(Number(grade))
          ? null
          : Number(grade);

      const { error } = await supabase
        .from("submissions")
        .update({ grade: parsedGrade, feedback })
        .eq("id", submissionId);

      if (error) {
        console.error("grade update error", error);
        toast.error("Failed to update grade/feedback");
      } else {
        toast.success("Saved");
        // Optimistic patch in parent cache (without replacing objects to avoid remounting)
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, grade: parsedGrade, feedback } : s
          )
        );
      }
    } catch (err) {
      console.error("grade update err", err);
      toast.error("Failed to update grade/feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Analytics per course (assignments count, submission counts)
  // ---------------------------------------------------------------------------
  const analyticsPerCourse = useMemo(() => {
    return courses.map((c, i) => {
      const courseAssignments = assignments.filter((a) => a.course_id === c.id);
      const assignmentsCount = courseAssignments.length;
      const submissionsCount = submissionCountsByCourse[c.id] || 0;
      return {
        course_id: c.id,
        course_title: c.title,
        assignmentsCount,
        submissionsCount,
        color: COLORS[i % COLORS.length],
      };
    });
  }, [courses, assignments, submissionCountsByCourse]);

  // ---------------------------------------------------------------------------
  // Filters / derived data
  // ---------------------------------------------------------------------------
  const filteredAssignments = assignments.filter((a) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedByCourse = useMemo(() => {
    const out = {};
    assignments.forEach((a) => {
      out[a.course_id] = out[a.course_id] || [];
      out[a.course_id].push(a);
    });
    return out;
  }, [assignments]);

  // ---------------------------------------------------------------------------
  // Mobile toggles
  // ---------------------------------------------------------------------------
  const toggleMobileAssignment = (id) =>
    setMobileAssignmentsOpen((p) => ({ ...(p || {}), [id]: !p?.[id] }));
  const toggleMobileSubmissions = (id) =>
    setMobileSubmissionsOpen((p) => ({ ...(p || {}), [id]: !p?.[id] }));

  // ---------------------------------------------------------------------------
  // Submission Rows with local buffers (prevents keyboard lift/remount)
  // ---------------------------------------------------------------------------
  const DesktopSubmissionRow = memo(function DesktopSubmissionRowInner({ s, onSave }) {
    const [localGrade, setLocalGrade] = useState(s.grade ?? "");
    const [localFeedback, setLocalFeedback] = useState(s.feedback ?? "");

    // Keep local state in sync if parent refreshes from server (id-stable; avoid remount)
    useEffect(() => {
      setLocalGrade(s.grade ?? "");
    }, [s.grade]);
    useEffect(() => {
      setLocalFeedback(s.feedback ?? "");
    }, [s.feedback]);

    return (
      <TableRow key={s.id} className="hover:bg-zinc-800/20">
        <TableCell className="font-medium text-emerald-300">
          {s.students?.full_name || "Unknown"}
        </TableCell>
        <TableCell className="text-zinc-300">{s.students?.email}</TableCell>
        <TableCell className="text-zinc-300">{formatDateDisplay(s.submitted_at)}</TableCell>
        <TableCell>
          {s.file_url ? (
            <a
              href={s.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline"
            >
              View
            </a>
          ) : (
            "N/A"
          )}
        </TableCell>
        <TableCell>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Grade"
            value={localGrade}
            onChange={(e) => setLocalGrade(e.target.value)}
            className="w-24 bg-zinc-800 text-emerald-100 border-zinc-700"
          />
        </TableCell>
        <TableCell>
          <Textarea
            value={localFeedback}
            onChange={(e) => setLocalFeedback(e.target.value)}
            placeholder="Feedback..."
            className="bg-zinc-800 text-emerald-100 border-zinc-700"
          />
        </TableCell>
        <TableCell>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-black cursor-pointer"
            onClick={() => onSave(s.id, localGrade, localFeedback)}
          >
            Save
          </Button>
        </TableCell>
      </TableRow>
    );
  });

  const MobileSubmissionCard = memo(function MobileSubmissionCardInner({ s, onSave }) {
    const [localGrade, setLocalGrade] = useState(s.grade ?? "");
    const [localFeedback, setLocalFeedback] = useState(s.feedback ?? "");

    useEffect(() => {
      setLocalGrade(s.grade ?? "");
    }, [s.grade]);
    useEffect(() => {
      setLocalFeedback(s.feedback ?? "");
    }, [s.feedback]);

    return (
      <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-emerald-300 font-medium">
              {s.students?.full_name || "Unknown"}
            </div>
            <div className="text-xs text-zinc-400">{s.students?.email || "—"}</div>
            <div className="text-xs text-zinc-500 mt-2">
              Submitted: {formatDateDisplay(s.submitted_at)}
            </div>
          </div>

          <div className="text-xs text-zinc-400">Status</div>
        </div>

        <div className="mt-3 space-y-2">
          <div>
            {s.file_url ? (
              <a
                href={s.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline"
              >
                View File
              </a>
            ) : (
              <div className="text-zinc-400">No file attached</div>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Grade"
              value={localGrade}
              onChange={(e) => setLocalGrade(e.target.value)}
              className="w-28 bg-zinc-800 text-emerald-100 border-zinc-700"
            />
            <Button
              size="sm"
              className="bg-emerald-600 cursor-pointer hover:bg-emerald-500 text-black"
              onClick={() => onSave(s.id, localGrade, localFeedback)}
            >
              Save
            </Button>
          </div>

          <div>
            <Textarea
              value={localFeedback}
              placeholder="Feedback..."
              onChange={(e) => setLocalFeedback(e.target.value)}
              className="bg-zinc-800 text-emerald-100 border-zinc-700"
            />
          </div>
        </div>
      </div>
    );
  });

  // ---------------------------------------------------------------------------
  // Assignment Cards/Rows
  // ---------------------------------------------------------------------------
  const MobileAssignmentCard = memo(function MobileAssignmentCardInner({ a }) {
    const open = !!mobileAssignmentsOpen[a.id];
    const due = a.due_date ? new Date(a.due_date).toLocaleDateString() : "—";
    const creatorName =
      a.created_by_name || (a.created_by ? a.created_by.slice(0, 7) : "Unknown");

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-emerald-300 font-semibold">{a.title}</div>
            <div className="text-xs text-zinc-400 mt-1">
              Course: {courses.find((c) => c.id === a.course_id)?.title || "N/A"}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Due: {due}</div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEdit(a)}
                className="border-zinc-700 cursor-pointer text-emerald-200"
              >
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="cursor-pointer"
                onClick={() => handleConfirmDelete(a)}
              >
                <Trash className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-300 cursor-pointer hover:text-black"
              onClick={() => toggleMobileAssignment(a.id)}
            >
              {open ? (
                <>
                  Collapse <ChevronUp className="w-4 h-4 inline-block ml-1" />
                </>
              ) : (
                <>
                  Details <ChevronRight className="w-4 h-4 inline-block ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {open && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-zinc-200">{a.description || "No description"}</div>
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600/20 text-emerald-300 px-2 py-0.5">
                Created: {formatDateDisplay(a.created_at)}
              </Badge>
              <Badge className="bg-zinc-700/40 text-zinc-300 px-2 py-0.5">
                By: {creatorName}
              </Badge>
            </div>

            <div className="pt-2 border-t border-zinc-700/40 mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedAssignment(a);
                  toggleMobileSubmissions(a.id);
                }}
                className="flex-1 bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
              >
                View Submissions
              </Button>

              {/* View PDF if exists */}
              <div>
                {a.file_url ? (
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 underline text-sm"
                  >
                    View PDF
                  </a>
                ) : (
                  <div className="text-xs text-zinc-400">No PDF</div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  });

  const DesktopAssignmentRow = memo(function DesktopAssignmentRowInner({ a }) {
    return (
      <TableRow key={a.id} className="hover:bg-zinc-800/30">
        <TableCell className="font-medium text-emerald-300">{a.title}</TableCell>
        <TableCell className="text-zinc-300">
          {courses.find((c) => c.id === a.course_id)?.title || "N/A"}
        </TableCell>
        <TableCell className="text-zinc-300">
          {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
        </TableCell>
        <TableCell className="text-zinc-300">{formatDateDisplay(a.created_at)}</TableCell>
        <TableCell className="text-zinc-300">
          {a.created_by_name || (a.created_by ? a.created_by.slice(0, 7) : "Unknown")}
        </TableCell>
        <TableCell className="text-zinc-300">
          {a.file_url ? (
            <a href={a.file_url} target="_blank" rel="noreferrer" className="text-emerald-400 underline mr-3">View PDF</a>
          ) : (
            <span className="text-zinc-500 mr-3">No PDF</span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => startEdit(a)}
            className="border-zinc-700 cursor-pointer"
          >
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleConfirmDelete(a)}
            className="ml-2 cursor-pointer"
          >
            <Trash className="w-4 h-4 mr-1" /> Delete
          </Button>
          <Button
            size="sm"
            onClick={() => setSelectedAssignment(a)}
            className="ml-2 cursor-pointer"
          >
            View Submissions
          </Button>
        </TableCell>
      </TableRow>
    );
  });

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------
  const totalAssignments = assignments.length;
  const totalCourses = courses.length;
  const totalSubmissions = Object.values(submissionCountsByCourse || {}).reduce(
    (s, v) => s + v,
    0
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      <Toaster position="top-right" richColors />
      <div ref={topRef}>
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-emerald-300" />
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-emerald-300">
                Assignment Management
              </h1>
              <p className="text-xs text-zinc-400 hidden md:block">
                Create, grade, and analyze assignments across courses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-xs text-zinc-400">
                <div>Total courses</div>
                <div className="text-emerald-300 font-bold">{totalCourses}</div>
              </div>
              <div className="text-xs text-zinc-400">
                <div>Total assignments</div>
                <div className="text-emerald-300 font-bold">{totalAssignments}</div>
              </div>
              <div className="text-xs text-zinc-400">
                <div>Submissions</div>
                <div className="text-emerald-300 font-bold">{totalSubmissions}</div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        </motion.header>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Top: Create/Edit + Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                {editingAssignment ? "Edit Assignment" : "Create Assignment"}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 mb-1">Course</label>

                  <ThemedSelect
                    value={newAssignment.course_id}
                    onValueChange={(v) =>
                      setNewAssignment((p) => ({ ...p, course_id: v }))
                    }
                  >
                    <ThemedSelect.Trigger>
                      <ThemedSelect.Value placeholder="Select a course" />
                    </ThemedSelect.Trigger>

                    <ThemedSelect.Content>
                      {courses.map((c) => (
                        <ThemedSelect.Item key={c.id} value={c.id}>
                          {c.title}
                        </ThemedSelect.Item>
                      ))}
                    </ThemedSelect.Content>
                  </ThemedSelect>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Title</label>
                  <Input
                    name="assignment-title"
                    placeholder="Assignment title"
                    value={newAssignment.title}
                    onChange={(e) =>
                      setNewAssignment((p) => ({ ...p, title: e.target.value }))
                    }
                    className="bg-zinc-800 text-emerald-100 border-zinc-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Description</label>
                  <Textarea
                    placeholder="Assignment description"
                    value={newAssignment.description}
                    onChange={(e) =>
                      setNewAssignment((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="bg-zinc-800 text-emerald-100 border-zinc-700"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-1 text-zinc-400">
                    <CalendarIcon className="w-4 h-4 text-emerald-400" /> Due Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full text-left justify-start text-white bg-zinc-900 border border-zinc-800 cursor-pointer"
                      >
                        {newAssignment.due_date ? (
                          format(new Date(newAssignment.due_date), "PPP")
                        ) : (
                          <span className="text-zinc-500">Pick due date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <Calendar
                        mode="single"
                        selected={
                          newAssignment.due_date
                            ? new Date(newAssignment.due_date)
                            : undefined
                        }
                        onSelect={(date) =>
                          setNewAssignment((p) => ({
                            ...p,
                            due_date: date ? format(date, "yyyy-MM-dd") : "",
                          }))
                        }
                        className="bg-zinc-900 text-zinc-200"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* PDF upload UI */}
<div>
  <label className="block text-zinc-400 mb-1">Attach PDF</label>

  <div className="relative">
    {/* Hidden real input */}
    <input
      id="pdf-upload"
      type="file"
      accept="application/pdf"
      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
      className="hidden"
    />

    {/* Styled trigger */}
    <label
      htmlFor="pdf-upload"
      className="inline-flex items-center w-full justify-center px-4 py-1 bg-emerald-600 hover:bg-emerald-500
                 text-black font-medium rounded-lg cursor-pointer transition-colors"
    >
      Upload PDF
    </label>
  </div>

  {/* Show selected file */}
  {pdfFile && (
    <p className="text-xs text-emerald-300 mt-1">Selected: {pdfFile.name}</p>
  )}

  {/* Existing file if editing */}
  {editingAssignment?.file_url && !pdfFile && (
    <div className="mt-2 text-xs">
      Existing PDF:{" "}
      <a
        href={editingAssignment.file_url}
        target="_blank"
        rel="noreferrer"
        className="text-emerald-300 underline"
      >
        View current file
      </a>
    </div>
  )}

  {/* Uploading indicator */}
  {uploadingPdf && (
    <div className="text-xs text-zinc-400 mt-2">Uploading PDF…</div>
  )}
</div>


                <div className="flex gap-3 items-center">
                  <Button
                    type="submit"
                    className="bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
                    disabled={loading}
                  >
                    {editingAssignment ? "Update Assignment" : "Create Assignment"}
                  </Button>
                  {editingAssignment && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingAssignment(null);
                        setNewAssignment({
                          course_id: "",
                          title: "",
                          description: "",
                          due_date: "",
                        });
                        setPdfFile(null);
                      }}
                      className="cursor-pointer bg-white text-black "
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Course Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {analyticsPerCourse.map((c, i) => (
                  <div
                    key={c.course_id}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-emerald-300 font-semibold">
                        {c.course_title}
                      </div>
                      <div className="text-xs text-zinc-400">
                        Assignments:{" "}
                        <span className="text-emerald-200 font-medium">
                          {c.assignmentsCount}
                        </span>{" "}
                        • Submissions:{" "}
                        <span className="text-emerald-200 font-medium">
                          {c.submissionsCount}
                        </span>
                      </div>
                    </div>
                    <div className="w-48 h-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: c.course_title,
                              assignments: c.assignmentsCount,
                              submissions: c.submissionsCount,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#202020" />
                          <XAxis dataKey="name" hide />
                          <YAxis
                            hide
                            domain={[
                              0,
                              Math.max(c.assignmentsCount, c.submissionsCount) + 1,
                            ]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #333",
                              color: "#fff",
                              borderRadius: "10px",
                            }}
                          />
                          <Bar
                            dataKey="assignments"
                            fill={c.color}
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="submissions"
                            fill={COLORS[(i + 1) % COLORS.length]}
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignments list */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-1 sm:gap-4">
            <h2 className="text-lg font-semibold text-emerald-300">Assignments</h2>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-800 w-64"
              />
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl">
              <CardContent>
                <ScrollArea className="max-h-[420px]">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="bg-zinc-900/80 border-b border-zinc-800">
                        <TableHead className="text-emerald-300">Title</TableHead>
                        <TableHead className="text-emerald-300">Course</TableHead>
                        <TableHead className="text-emerald-300">Due</TableHead>
                        <TableHead className="text-emerald-300">Created</TableHead>
                        <TableHead className="text-emerald-300">Created By</TableHead>
                        <TableHead className="text-emerald-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((a) => (
                        <DesktopAssignmentRow key={a.id} a={a} />
                      ))}
                      {filteredAssignments.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-zinc-400 py-8"
                          >
                            No assignments
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredAssignments.length > 0 ? (
              filteredAssignments.map((a) => (
                <MobileAssignmentCard key={a.id} a={a} />
              ))
            ) : (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center text-zinc-400">
                No assignments yet
              </div>
            )}
          </div>
        </section>

        {/* Submissions & Grading */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-emerald-300">
              Grade Submissions
            </h2>
            <div className="flex items-center gap-2">
              <ThemedSelect
                value={selectedAssignment?.id || ""}
                onValueChange={(v) =>
                  setSelectedAssignment(
                    assignments.find((a) => a.id === v) || null
                  )
                }
              >
                <ThemedSelect.Trigger>
                  <ThemedSelect.Value placeholder="Select assignment" />
                </ThemedSelect.Trigger>

                <ThemedSelect.Content>
                  {assignments.map((a) => (
                    <ThemedSelect.Item key={a.id} value={a.id}>
                      {a.title} •{" "}
                      {courses.find((c) => c.id === a.course_id)?.title || "N/A"}
                    </ThemedSelect.Item>
                  ))}
                </ThemedSelect.Content>
              </ThemedSelect>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl">
              <CardContent>
                {!selectedAssignment ? (
                  <div className="text-zinc-400">
                    Select an assignment to view submissions
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-emerald-300 font-semibold">
                          {selectedAssignment.title}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {courses.find((c) => c.id === selectedAssignment.course_id)
                            ?.title || "N/A"}{" "}
                          • Created: {formatDateDisplay(selectedAssignment.created_at)}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Submissions:{" "}
                        <span className="text-emerald-300 font-medium">
                          {submissions.length}
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="max-h-[420px]">
                      <Table className="min-w-[1000px]">
                        <TableHeader>
                          <TableRow className="bg-zinc-900/80 border-zinc-800">
                            <TableHead className="text-emerald-300">Student</TableHead>
                            <TableHead className="text-emerald-300">Email</TableHead>
                            <TableHead className="text-emerald-300">Submitted At</TableHead>
                            <TableHead className="text-emerald-300">File</TableHead>
                            <TableHead className="text-emerald-300">Grade</TableHead>
                            <TableHead className="text-emerald-300">Feedback</TableHead>
                            <TableHead className="text-emerald-300">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.map((s) => (
                            <DesktopSubmissionRow
                              key={s.id}
                              s={s}
                              onSave={persistGradeFeedback}
                            />
                          ))}
                          {submissions.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center text-zinc-400 py-8"
                              >
                                No submissions yet
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mobile submissions cards */}
          <div className="md:hidden space-y-3">
            {!selectedAssignment ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-zinc-400">
                Select an assignment above to view submissions (mobile view uses
                cards)
              </div>
            ) : (
              <>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-emerald-300 font-semibold">
                        {selectedAssignment.title}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {courses.find((c) => c.id === selectedAssignment.course_id)
                          ?.title || "N/A"}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Submissions:{" "}
                      <span className="text-emerald-300 font-medium">
                        {submissions.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {submissions.length > 0 ? (
                    submissions.map((s) => (
                      <MobileSubmissionCard
                        key={s.id}
                        s={s}
                        onSave={persistGradeFeedback}
                      />
                    ))
                  ) : (
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center text-zinc-400">
                      No submissions yet
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent className="bg-zinc-950 border border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-300">
              Delete assignment?
            </AlertDialogTitle>
            <div className="text-zinc-400 mt-2">
              {deleteTarget
                ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
                : "Confirm delete."}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-zinc-200 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-black cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
