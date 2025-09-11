// src/pages/AdminRoadmap.jsx
// Admin Roadmap — responsive & UI polish version with QR preview & download
// - Preserves all original logic & functionality
// - Responsive dialogs, cards, charts, and tables
// - cursor-pointer added to interactive controls
// - QR generation (preview + download) for submission links
/* eslint-disable react/no-danger */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "dompurify";
import { format, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import {
  List as ListIcon,
  PlusCircle,
  Edit,
  Trash,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Move,
  FileText,
  BarChart2,
  Download,
  ExternalLink,
  Info,
  AlertTriangle,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import QRCode from "qrcode"; // for QR generation

// -------------- Utilities --------------
function shortDate(d) {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}
function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html);
}

// Small reusable spinner fallback
function SmallLoading() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="rgba(148,163,184,0.12)" strokeWidth="4" fill="none" />
        <path d="M22 12a10 10 0 00-10-10" stroke="#10B981" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      Loading...
    </div>
  );
}

// -------------- Confirm Dialog (replace window.confirm) --------------
function ConfirmDialog({ open, title, description, onClose, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-full sm:max-w-md md:max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <DialogTitle className="text-emerald-300">{title}</DialogTitle>
          </div>
          <div className="text-xs text-zinc-400 mt-2">{description}</div>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="outline" className="cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button className="bg-rose-600 text-slate-100 cursor-pointer" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------- Sortable module card (dnd-kit) --------------
function AdminSortableModule({ module, stats = {}, assignments = [], onEdit, onDelete, onOpenAssignments, onMoveUp, onMoveDown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 60 : "auto",
  };

  const locked = module.unlock_date && isAfter(new Date(module.unlock_date), new Date());
  const overdue = module.due_date && isBefore(new Date(module.due_date), new Date());

  return (
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 w-full">
          <div {...attributes} {...listeners} className="p-2 rounded-md bg-zinc-800/40 cursor-grab">
            <Move className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`text-lg font-semibold ${stats.percent === 100 ? "text-emerald-300" : "text-slate-100"} truncate`}>{module.title}</div>
              {locked && <Badge className="bg-zinc-700 text-zinc-100">Locked</Badge>}
              {overdue && <Badge className="bg-rose-700 text-rose-100">Overdue</Badge>}
            </div>
            <div className="text-xs text-zinc-400 mt-2 line-clamp-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(module.description || "") }} />
            <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
              <div>Started: <span className="text-slate-100 ml-1">{stats.started ?? 0}</span></div>
              <div>Completed: <span className="text-slate-100 ml-1">{stats.completed ?? 0}</span></div>
              <div>Assignments: <span className="text-slate-100 ml-1">{assignments?.length ?? 0}</span></div>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onOpenAssignments(module)}><FileText className="w-4 h-4 text-emerald-300" /></Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onEdit(module)}><Edit className="w-4 h-4 text-amber-400" /></Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onDelete(module.id)}><Trash className="w-4 h-4 text-rose-400" /></Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onMoveUp(module)}><ArrowUp className="w-4 h-4 text-black" /></Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onMoveDown(module)}><ArrowDown className="w-4 h-4 text-black" /></Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -------------- Main AdminRoadmap --------------
export default function AdminRoadmap() {
  // data
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(""); // do not auto-select
  const [modules, setModules] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({}); // module_id -> assignments[]
  const [submissionsMap, setSubmissionsMap] = useState({}); // assignment_id -> submissions[]
  const [progressMap, setProgressMap] = useState({}); // module_id -> { started, completed, percent, total }
  const [badges, setBadges] = useState([]);

  // qr cache
  const [qrCache, setQrCache] = useState({}); // url -> dataUrl

  // UI
  const [loading, setLoading] = useState(false);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", unlock_date: "", due_date: "", order_number: 0, prerequisite_module_id: null, badge_text: "" });

  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", link_url: "", module_id: "" });

  // submissions reviewer (dialog with form for grading)
  const [showSubmissionsDrawer, setShowSubmissionsDrawer] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [gradingForm, setGradingForm] = useState({ grade: "", feedback: "", awardBadgeToStudent: false, badgeIdToAward: "" });

  // analytics page view (rendered as page view)
  const [showAnalyticsPage, setShowAnalyticsPage] = useState(false);

  // confirm dialogs state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMeta, setConfirmMeta] = useState({ title: "", desc: "", onConfirm: null });

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragActiveId, setDragActiveId] = useState(null);

  // lifecycle
  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => { if (courseId) fetchAllForCourse(courseId); else { /* clear views */ setModules([]); setAssignmentsMap({}); setSubmissionsMap({}); setProgressMap({}); setBadges([]); } }, [courseId]);

  // -------------- Fetchers --------------
  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      setCourses(data || []);
      // IMPORTANT: do NOT auto-select the first course. Leave courseId empty to force selection.
    } catch (err) {
      console.error("fetchCourses", err);
      toast.error("Could not load courses");
    }
  }

  async function fetchAllForCourse(cid) {
    if (!cid) return;
    setLoading(true);
    try {
      // Fetch modules + badges
      const { data: mods, error: modsErr } = await supabase
        .from("modules")
        .select("*, badges(id,title,text,icon_url,module_id)")
        .eq("course_id", cid)
        .order("order_number", { ascending: true });
      if (modsErr) throw modsErr;
      const normalized = (mods || []).map(m => ({ ...m, badges: m.badges || [] }));
      setModules(normalized);

      const moduleIds = normalized.map(m => m.id).filter(Boolean);

      // Fetch module_assignments
      if (moduleIds.length > 0) {
        const { data: assigns, error: assignsErr } = await supabase
          .from("module_assignments")
          .select("*")
          .in("module_id", moduleIds)
          .order("created_at", { ascending: true });
        if (!assignsErr) {
          const map = {};
          assigns.forEach(a => {
            if (!map[a.module_id]) map[a.module_id] = [];
            map[a.module_id].push(a);
          });
          setAssignmentsMap(map);

          // fetch module_submissions for these assignment ids (aggregate)
          const assignIds = assigns.map(a => a.id);
          if (assignIds.length > 0) {
            const { data: subs, error: subsErr } = await supabase
              .from("module_submissions")
              .select("*")
              .in("assignment_id", assignIds)
              .order("submitted_at", { ascending: false });
            if (!subsErr) {
              const sMap = {};
              subs.forEach(s => {
                if (!sMap[s.assignment_id]) sMap[s.assignment_id] = [];
                sMap[s.assignment_id].push(s);
              });
              setSubmissionsMap(sMap);
            } else {
              setSubmissionsMap({});
            }
          } else {
            setSubmissionsMap({});
          }
        } else {
          setAssignmentsMap({});
          setSubmissionsMap({});
        }
      } else {
        setAssignmentsMap({});
        setSubmissionsMap({});
      }

      // fetch aggregated student_progress for modules
      if (moduleIds.length > 0) {
        const { data: progRows, error: progErr } = await supabase
          .from("student_progress")
          .select("*")
          .in("module_id", moduleIds);
        if (!progErr) {
          const agg = {};
          progRows.forEach(r => {
            const mid = r.module_id;
            if (!agg[mid]) agg[mid] = { started: 0, completed: 0, totals: new Set() };
            agg[mid].totals.add(r.student_id);
            if (r.status !== "not_started") agg[mid].started++;
            if (r.status === "completed") agg[mid].completed++;
          });
          const final = {};
          Object.keys(agg).forEach(mid => {
            const started = agg[mid].started || 0;
            const completed = agg[mid].completed || 0;
            const total = agg[mid].totals ? agg[mid].totals.size : 0;
            const percent = total ? Math.round((completed / total) * 100) : 0;
            final[mid] = { started, completed, percent, total };
          });
          setProgressMap(final);
        } else {
          setProgressMap({});
        }
      } else {
        setProgressMap({});
      }

      // badges flattened (text-based preferred)
      const allB = normalized.flatMap(m => (m.badges || []));
      setBadges(allB);
    } catch (err) {
      console.error("fetchAllForCourse", err);
      toast.error("Load failed");
    } finally {
      setLoading(false);
    }
  }

  // -------------- Module CRUD --------------
  function openNewModule() {
    if (!courseId) { toast.info("Please select a course first"); return; }
    setEditingModule(null);
    setModuleForm({
      title: "",
      description: "",
      unlock_date: "",
      due_date: "",
      order_number: modules?.length ? Math.max(...modules.map(m => m.order_number || 0)) + 1 : 1,
      prerequisite_module_id: null,
      badge_text: "",
    });
    setShowModuleDialog(true);
  }
  function openEditModule(mod) {
    setEditingModule(mod);
    setModuleForm({
      title: mod.title || "",
      description: mod.description || "",
      unlock_date: mod.unlock_date ? mod.unlock_date.slice(0, 16) : "",
      due_date: mod.due_date ? mod.due_date.slice(0, 16) : "",
      order_number: mod.order_number || 0,
      prerequisite_module_id: mod.prerequisite_module_id || null,
      badge_text: "", // keep blank for adding new text-badge
    });
    setShowModuleDialog(true);
  }

  async function saveModule() {
    if (!moduleForm.title || !moduleForm.title.trim()) { toast.error("Title required"); return; }
    if (!courseId) { toast.error("No course selected"); return; }
    setLoading(true);
    try {
      const payload = {
        title: moduleForm.title.trim(),
        description: moduleForm.description || null,
        unlock_date: moduleForm.unlock_date ? new Date(moduleForm.unlock_date).toISOString() : null,
        due_date: moduleForm.due_date ? new Date(moduleForm.due_date).toISOString() : null,
        order_number: moduleForm.order_number || 0,
        prerequisite_module_id: moduleForm.prerequisite_module_id || null,
        course_id: courseId,
      };
      if (editingModule) {
        const { error } = await supabase.from("modules").update(payload).eq("id", editingModule.id);
        if (error) throw error;
        toast.success("Module updated");
      } else {
        const { error } = await supabase.from("modules").insert([payload]);
        if (error) throw error;
        toast.success("Module created");
      }

      // If user added a badge_text, create a text badge linked to this module
      if (moduleForm.badge_text && moduleForm.badge_text.trim()) {
        try {
          // Find module id (if editingModule use that, otherwise fetch latest module by title & course)
          let moduleIdToUse = editingModule ? editingModule.id : null;
          if (!moduleIdToUse) {
            const { data: mdata, error: merr } = await supabase.from("modules").select("id").eq("course_id", courseId).eq("title", payload.title).limit(1).order("created_at", { ascending: false });
            if (merr) throw merr;
            moduleIdToUse = mdata && mdata[0] && mdata[0].id;
          }
          if (moduleIdToUse) {
            const badgePayload = {
              title: moduleForm.badge_text.trim(),
              text: moduleForm.badge_text.trim(),
              module_id: moduleIdToUse,
            };
            const { error: berr } = await supabase.from("badges").insert([badgePayload]);
            if (berr) {
              console.warn("badge create failed", berr);
            } else {
              toast.success("Badge created for module");
            }
          }
        } catch (err) {
          console.error("createBadge", err);
        }
      }

      setShowModuleDialog(false);
      await fetchAllForCourse(courseId);
    } catch (err) {
      console.error("saveModule", err);
      toast.error("Could not save module");
    } finally {
      setLoading(false);
    }
  }

  function requestDeleteModule(id) {
    setConfirmMeta({
      title: "Delete module?",
      desc: "Delete module and all child assignments & submissions. This action cannot be undone.",
      onConfirm: () => deleteModule(id),
    });
    setConfirmOpen(true);
  }

  async function deleteModule(id) {
    try {
      setLoading(true);
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
      toast.success("Module deleted");
      fetchAllForCourse(courseId);
    } catch (err) {
      console.error("deleteModule", err);
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  }

  // -------------- Assignment CRUD --------------
  function openNewAssignment(moduleId) {
    if (!courseId) { toast.info("Please select a course first"); return; }
    setEditingAssignment(null);
    setAssignmentForm({ title: "", description: "", link_url: "", module_id: moduleId || "" });
    setShowAssignmentDialog(true);
  }
  function openEditAssignment(assign) {
    setEditingAssignment(assign);
    setAssignmentForm({ title: assign.title || "", description: assign.description || "", link_url: assign.link_url || "", module_id: assign.module_id });
    setShowAssignmentDialog(true);
  }

  async function saveAssignment() {
    if (!assignmentForm.title || !assignmentForm.module_id) { toast.error("Title & module required"); return; }
    setLoading(true);
    try {
      const payload = { title: assignmentForm.title.trim(), description: assignmentForm.description || null, link_url: assignmentForm.link_url || null, module_id: assignmentForm.module_id };
      if (editingAssignment) {
        const { error } = await supabase.from("module_assignments").update(payload).eq("id", editingAssignment.id);
        if (error) throw error;
        toast.success("Assignment updated");
      } else {
        const { error } = await supabase.from("module_assignments").insert([payload]);
        if (error) throw error;
        toast.success("Assignment created");
      }
      setShowAssignmentDialog(false);
      await fetchAllForCourse(courseId);
    } catch (err) {
      console.error("saveAssignment", err);
      toast.error("Could not save assignment");
    } finally {
      setLoading(false);
    }
  }

  function requestDeleteAssignment(id) {
    setConfirmMeta({
      title: "Delete assignment?",
      desc: "This will remove the assignment and its submissions.",
      onConfirm: () => deleteAssignment(id),
    });
    setConfirmOpen(true);
  }

  async function deleteAssignment(id) {
    try {
      const { error } = await supabase.from("module_assignments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Assignment removed");
      await fetchAllForCourse(courseId);
    } catch (err) {
      console.error("deleteAssignment", err);
      toast.error("Delete failed");
    }
  }

  // -------------- Submissions & Grading --------------
  function openSubmissionPanel(assignment) {
    setActiveAssignment(assignment);
    setShowSubmissionsDrawer(true);
  }

  function openGradeDialog(submission) {
    setActiveSubmission(submission);
    setGradingForm({
      grade: submission.grade ?? "",
      feedback: submission.feedback ?? "",
      awardBadgeToStudent: false,
      badgeIdToAward: badges.length ? badges[0].id : "",
    });
  }

  async function submitGrade() {
    if (!activeSubmission) return;
    // validation
    const gradeVal = gradingForm.grade === "" ? null : Number(gradingForm.grade);
    if (gradingForm.grade !== "" && (isNaN(gradeVal) || gradeVal < 0)) {
      toast.error("Enter a valid numeric grade");
      return;
    }
    try {
      const { error } = await supabase.from("module_submissions").update({ grade: gradeVal, feedback: gradingForm.feedback }).eq("id", activeSubmission.id);
      if (error) throw error;

      // optionally award badge to that student
      if (gradingForm.awardBadgeToStudent && gradingForm.badgeIdToAward) {
        // insert student_badges if not present
        try {
          const { data: exists, error: checkErr } = await supabase.from("student_badges").select("*").eq("student_id", activeSubmission.student_id).eq("badge_id", gradingForm.badgeIdToAward).limit(1);
          if (checkErr) throw checkErr;
          if (!exists || exists.length === 0) {
            const { error: insErr } = await supabase.from("student_badges").insert([{ student_id: activeSubmission.student_id, badge_id: gradingForm.badgeIdToAward }]);
            if (insErr) {
              console.warn("award badge failed", insErr);
            } else {
              toast.success("Badge awarded to student");
            }
          } else {
            toast.info("Student already has this badge");
          }
        } catch (err) {
          console.error("awardBadge", err);
          toast.error("Could not award badge");
        }
      }

      toast.success("Graded successfully");
      // refresh submissions & progress
      await fetchAllForCourse(courseId);
      setActiveSubmission(null);
      setShowSubmissionsDrawer(false);
    } catch (err) {
      console.error("submitGrade", err);
      toast.error("Grading failed");
    }
  }

  // -------------- QR helpers --------------
  async function getQrForLink(url) {
    if (!url) return null;
    if (qrCache[url]) return qrCache[url];
    try {
      const qrDataUrl = await QRCode.toDataURL(url);
      setQrCache((prev) => ({ ...prev, [url]: qrDataUrl }));
      return qrDataUrl;
    } catch (err) {
      console.error("QR generation failed", err);
      toast.error("QR generation failed");
      return null;
    }
  }

  async function downloadQrForLink(url) {
    try {
      const qrDataUrl = await getQrForLink(url);
      if (!qrDataUrl) return;
      const a = document.createElement("a");
      a.href = qrDataUrl;
      a.download = "submission_qr.png";
      a.click();
    } catch (err) {
      console.error("QR download failed", err);
      toast.error("QR generation failed");
    }
  }

  // -------------- Ordering (drag & drop) --------------
  async function persistOrder(newArr) {
    try {
      for (let i = 0; i < newArr.length; i++) {
        const id = newArr[i].id;
        await supabase.from("modules").update({ order_number: i + 1 }).eq("id", id);
      }
      toast.success("Order saved");
      await fetchAllForCourse(courseId);
    } catch (err) {
      console.error("persistOrder", err);
      toast.error("Could not save order");
    }
  }

  function handleDragStart(e) { setDragActiveId(e.active.id); }
  function handleDragEnd(e) {
    setDragActiveId(null);
    const { active, over } = e;
    if (!over) return;
    if (active.id === over.id) return;
    const oldIndex = modules.findIndex(m => m.id === active.id);
    const newIndex = modules.findIndex(m => m.id === over.id);
    const newArr = arrayMove(modules, oldIndex, newIndex);
    persistOrder(newArr);
  }
  function handleDragCancel() { setDragActiveId(null); }

  // -------------- Analytics Data --------------
  const chartData = useMemo(() => {
    return modules.map(m => ({
      name: m.title.length > 12 ? m.title.slice(0, 12) + "…" : m.title,
      started: progressMap[m.id]?.started ?? 0,
      completed: progressMap[m.id]?.completed ?? 0,
      percent: progressMap[m.id]?.percent ?? 0,
    }));
  }, [modules, progressMap]);

  const pieData = useMemo(() => {
    const totalModules = modules.length || 1;
    const completed = modules.filter(m => (progressMap[m.id]?.percent || 0) === 100).length;
    const inProgress = modules.filter(m => (progressMap[m.id]?.percent || 0) > 0 && (progressMap[m.id]?.percent || 0) < 100).length;
    const notStarted = totalModules - completed - inProgress;
    return [
      { name: "Completed", value: completed, color: "#10B981" },
      { name: "In progress", value: inProgress, color: "#F59E0B" },
      { name: "Not started", value: notStarted, color: "#64748B" },
    ];
  }, [modules, progressMap]);

  // -------------- Helpers for UI --------------
  function openAssignmentSubmissions(a) {
    setActiveAssignment(a);
    setShowSubmissionsDrawer(true);
  }

  function openSubmissionReview(sub) {
    setActiveSubmission(sub);
    setGradingForm({
      grade: sub.grade ?? "",
      feedback: sub.feedback ?? "",
      awardBadgeToStudent: false,
      badgeIdToAward: badges.length ? badges[0].id : "",
    });
  }

  // -------------- Helper: Download file safely (kept for direct open) --------------
  async function downloadFileSafely(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // -------------- Render --------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071b16] via-[#0b1211] to-[#000] text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-900/20">
              <ListIcon className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-emerald-300">Admin Roadmap</h1>
              <p className="text-xs text-zinc-400">Manage modules, assignments, review submissions and award badges.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-64">
              <Select value={courseId} onValueChange={(v) => setCourseId(v)} className="w-full">
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full">
                  <SelectValue placeholder="Choose course" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  {courses.map(c => <SelectItem className="cursor-pointer" key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {!courseId && (
                <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>Please select a course — use the dropdown above. Tip: create a course first if none exist.</span>
                </div>
              )}
            </div>

            <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-100 cursor-pointer" onClick={openNewModule}><PlusCircle className="w-4 h-4 mr-2 text-slate-100" /> New module</Button>
            <Button variant="outline" className="cursor-pointer text-black" onClick={() => setShowAnalyticsPage(true)}><BarChart2 className="w-4 h-4 mr-2 text-amber-400" /> Analytics</Button>
            <Button variant="ghost" className="cursor-pointer hover:text-black" onClick={() => { if (!courseId) { fetchCourses(); toast.info("Select a course to refresh course data"); } else fetchAllForCourse(courseId); }} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* main layout */}
        {!showAnalyticsPage ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* modules area */}
            <div className="lg:col-span-3">
              <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                <CardHeader className="flex items-center justify-between px-4 py-3">
                  <CardTitle className="text-emerald-300">Modules</CardTitle>
                  <div className="text-xs text-zinc-400 hidden sm:block">Drag to reorder • Click assignment icon to view submissions</div>
                </CardHeader>

                <CardContent className="p-4">
                  {loading ? <SmallLoading /> : (
                    courseId ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                        <SortableContext items={modules.map(m => m.id)} strategy={rectSortingStrategy}>
                          <div className="flex flex-col gap-4">
                            {modules.length === 0 ? (
                              <div className="p-6 text-center text-zinc-400">No modules — create one to get started</div>
                            ) : modules.map((m) => (
                              <div key={m.id} className="grid grid-cols-1 gap-4">
                                <AdminSortableModule
                                  module={m}
                                  stats={progressMap[m.id] || {}}
                                  assignments={assignmentsMap[m.id] || []}
                                  onEdit={(mod) => openEditModule(mod)}
                                  onDelete={(id) => requestDeleteModule(id)}
                                  onOpenAssignments={(mod) => {
                                    const el = document.getElementById(`assignments-${mod.id}`);
                                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }}
                                  onMoveUp={async (mod) => {
                                    const i = modules.findIndex(x => x.id === mod.id);
                                    if (i > 0) {
                                      const newArr = arrayMove(modules, i, i - 1);
                                      await persistOrder(newArr);
                                    }
                                  }}
                                  onMoveDown={async (mod) => {
                                    const i = modules.findIndex(x => x.id === mod.id);
                                    if (i < modules.length - 1) {
                                      const newArr = arrayMove(modules, i, i + 1);
                                      await persistOrder(newArr);
                                    }
                                  }}
                                />
                                {/* assignments list */}
                                <div id={`assignments-${m.id}`} className="mt-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm text-slate-100 font-medium">Assignments ({(assignmentsMap[m.id] || []).length})</div>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => openNewAssignment(m.id)}>Add assignment</Button>
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(assignmentsMap[m.id] || []).length === 0 ? (
                                      <div className="text-xs text-zinc-400">No assignments yet</div>
                                    ) : (assignmentsMap[m.id] || []).map(a => (
                                      <div key={a.id} className="p-3 rounded-md bg-zinc-900/40 border border-zinc-800 flex items-center justify-between">
                                        <div className="min-w-0">
                                          <div className="text-sm text-slate-100 font-medium truncate">{a.title}</div>
                                          <div className="text-xs text-zinc-400 truncate">{a.description}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openAssignmentSubmissions(a)}><FileText className="w-4 h-4 text-emerald-300" /></Button>
                                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEditAssignment(a)}><Edit className="w-4 h-4 text-amber-400" /></Button>
                                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => requestDeleteAssignment(a.id)}><Trash className="w-4 h-4 text-rose-400" /></Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {dragActiveId ? <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700 w-80 text-slate-100">Moving…</div> : null}
                        </DragOverlay>
                      </DndContext>
                    ) : (
                      <div className="p-6 text-center text-zinc-400">
                        <Info className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                        <div className="font-medium text-slate-100">No course selected</div>
                        <div className="text-xs mt-1">Choose a course from the dropdown to view and manage modules. Tip: Create a course first if none exist.</div>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>

            {/* sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                <CardHeader><CardTitle className="text-emerald-300">Overview</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xs text-zinc-400">Modules</div>
                  <div className="text-xl font-semibold text-slate-100 mt-1">{modules.length}</div>
                  <div className="text-xs text-zinc-400 mt-3">Assignments</div>
                  <div className="text-xl font-semibold text-slate-100 mt-1">{Object.values(assignmentsMap).flat().length}</div>
                  <div className="mt-4">
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => { if (!courseId) { toast.info("Select course to refresh data"); } else fetchAllForCourse(courseId); }}>Refresh</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                <CardHeader><CardTitle className="text-emerald-300">Recent assignments</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-56">
                    <div className="space-y-2">
                      {Object.values(assignmentsMap).flat().slice(0, 8).map(a => (
                        <div key={a.id} className="p-2 rounded-md bg-zinc-900/40 border border-zinc-800 flex items-center justify-between">
                          <div className="text-xs text-slate-100 truncate">{a.title}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="cursor-pointer text-emerald-400" onClick={() => openAssignmentSubmissions(a)}>View</Button>
                          </div>
                        </div>
                      ))}
                      {Object.values(assignmentsMap).flat().length === 0 && <div className="text-xs text-zinc-500">No assignments</div>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                <CardHeader><CardTitle className="text-emerald-300">Badges</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {badges.length === 0 ? (
                      <div className="text-xs text-zinc-400">No badges created on modules</div>
                    ) : badges.map(b => (
                      <div key={b.id} className="p-2 rounded-md bg-zinc-900/40 border border-zinc-800 flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-amber-600 flex items-center justify-center text-xs font-semibold text-slate-100">{(b.text || b.title || "").slice(0, 2).toUpperCase()}</div>
                        <div className="text-xs text-slate-100">{b.title || b.text}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Analytics page view (full page) */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-emerald-300">Course Analytics</h2>
                <p className="text-xs text-zinc-400">Interactive charts showing module starts, completions and progress</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="cursor-pointer" onClick={() => setShowAnalyticsPage(false)}>Back</Button>
                <Button variant="outline" className="cursor-pointer text-black" onClick={() => { if (courseId) fetchAllForCourse(courseId); else toast.info("Select a course to refresh analytics"); }}>Refresh</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-zinc-900/50 border border-zinc-800 p-4">
                <CardHeader><CardTitle className="text-emerald-300">Overview</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xs text-zinc-400">Modules</div>
                  <div className="text-2xl font-semibold text-slate-100 mt-1">{modules.length}</div>
                  <div className="text-xs text-zinc-400 mt-2">Assigned badges</div>
                  <div className="text-xl font-semibold text-slate-100 mt-1">{badges.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border border-zinc-800 p-4 lg:col-span-2">
                <CardHeader><CardTitle className="text-emerald-300">Module Starts vs Completions (area)</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ height: 260 }} className="overflow-x-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradStarted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <ReTooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                        <Area type="monotone" dataKey="started" stroke="#60A5FA" fill="url(#gradStarted)" />
                        <Area type="monotone" dataKey="completed" stroke="#10B981" fill="url(#gradCompleted)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-zinc-900/50 border border-zinc-800 p-4">
                <CardHeader><CardTitle className="text-emerald-300">Completion mix (pie)</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ height: 240 }} className="overflow-x-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} label>
                          {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                        </Pie>
                        <Legend />
                        <ReTooltip
                        contentStyle={{
                          backgroundColor: "#58585b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border border-zinc-800 p-4">
                <CardHeader><CardTitle className="text-emerald-300">Progress vs assignments (line)</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ height: 240 }} className="overflow-x-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <ReTooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                        <Legend />
                        <Line type="monotone" dataKey="percent" stroke="#F59E0B" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4">
              <div className="text-sm text-zinc-400 mb-2">Per-module stats</div>
              <div className="max-h-60 overflow-auto bg-zinc-900/40 p-3 rounded border border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-zinc-400">
                      <tr><th className="p-2">Module</th><th className="p-2">Started</th><th className="p-2">Completed</th><th className="p-2">Percent</th></tr>
                    </thead>
                    <tbody>
                      {modules.map(m => (
                        <tr key={m.id} className="border-t border-zinc-800">
                          <td className="p-2 text-slate-100">{m.title}</td>
                          <td className="p-2">{progressMap[m.id]?.started ?? 0}</td>
                          <td className="p-2">{progressMap[m.id]?.completed ?? 0}</td>
                          <td className="p-2">{progressMap[m.id]?.percent ?? 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* submissions drawer / panel (dialog) */}
        <Dialog open={showSubmissionsDrawer} onOpenChange={(open) => { if (!open) { setShowSubmissionsDrawer(false); setActiveAssignment(null); setActiveSubmission(null); } }}>
          <DialogContent className="w-full sm:max-w-xl md:max-w-3xl lg:max-w-6xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-emerald-300">{activeAssignment ? `Submissions — ${activeAssignment.title}` : "Submissions"}</DialogTitle>
                  <div className="text-xs text-zinc-400 mt-1">Review student work and grade</div>
                </div>
                <div>
                  <Button variant="ghost" className="cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-black" onClick={() => { setShowSubmissionsDrawer(false); setActiveAssignment(null); setActiveSubmission(null); }}>Close</Button>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3 max-h-[60vh] overflow-auto">
                {(activeAssignment && submissionsMap[activeAssignment.id] && submissionsMap[activeAssignment.id].length) ? (
                  submissionsMap[activeAssignment.id].map(s => (
                    <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-md bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-100 font-medium">Student: <span className="text-slate-200">{s.student_id}</span></div>
                        <div className="text-xs text-zinc-400">Submitted: {shortDate(s.submitted_at)}</div>

                        <div className="text-xs mt-2 flex items-center gap-2">
                          <span className="text-emerald-300">Resource:</span>
                          <a className="text-emerald-300 underline cursor-pointer flex items-center gap-1" href={s.file_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3" />
                            Open link
                          </a>
                        </div>

                        <div className="mt-2">
                          {qrCache[s.file_url] ? (
                            <img src={qrCache[s.file_url]} alt="QR preview" className="w-24 h-24 border border-zinc-700 rounded" />
                          ) : (
                            <Button size="sm" variant="outline" className="cursor-pointer text-xs" onClick={() => getQrForLink(s.file_url)}>Generate QR</Button>
                          )}
                        </div>

                        <div className="text-xs text-gray-400 mt-2">Grade: <span className="text-slate-100">{s.grade ?? "—"}</span> • Feedback: <span className="text-zinc-300">{s.feedback ?? "—"}</span></div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => { openSubmissionReview(s); }}><Edit className="w-4 h-4 text-amber-400" /></Button>
                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => downloadQrForLink(s.file_url)}><Download className="w-4 h-4 text-emerald-300" /></Button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400 p-3">No submissions yet for this assignment.</div>
                )}
              </div>

              {/* grading panel */}
              <div className="md:col-span-1 p-3 rounded-md bg-zinc-900/30 border border-zinc-800">
                <div className="text-sm text-slate-100 font-medium mb-2">Grading</div>
                {activeSubmission ? (
                  <>
                    <div className="text-xs text-zinc-400">Student: <span className="text-slate-200">{activeSubmission.student_id}</span></div>
                    <div className="mt-2">
                      <Label className="text-zinc-400 text-xs">Grade (numeric)</Label>
                      <Input value={gradingForm.grade} onChange={(e) => setGradingForm(s => ({ ...s, grade: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                    </div>
                    <div className="mt-2">
                      <Label className="text-zinc-400 text-xs">Feedback</Label>
                      <Textarea value={gradingForm.feedback} onChange={(e) => setGradingForm(s => ({ ...s, feedback: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                    </div>

                    <div className="mt-3">
                      <Label className="text-zinc-400 text-xs">Award badge to student</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Switch checked={gradingForm.awardBadgeToStudent} onCheckedChange={(v) => setGradingForm(s => ({ ...s, awardBadgeToStudent: v }))} />
                        <Select value={gradingForm.badgeIdToAward} onValueChange={(v) => setGradingForm(s => ({ ...s, badgeIdToAward: v }))} className="w-full">
                          <SelectTrigger className="bg-zinc-900 text-emerald-300 border border-zinc-800 w-full"><SelectValue placeholder="Select badge" /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 text-slate-100">
                            {badges.map(b => <SelectItem className="cursor-pointer" key={b.id} value={b.id}>{b.title || b.text}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" className="cursor-pointer" onClick={() => { setActiveSubmission(null); setGradingForm({ grade: "", feedback: "", awardBadgeToStudent: false, badgeIdToAward: badges.length ? badges[0].id : "" }); }}>Reset</Button>
                      <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-100 cursor-pointer" onClick={submitGrade}>Submit grade</Button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400">Select a submission to review and grade it.</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm dialog instance */}
        <ConfirmDialog open={confirmOpen} title={confirmMeta.title} description={confirmMeta.desc} onClose={() => setConfirmOpen(false)} onConfirm={() => { if (confirmMeta.onConfirm) confirmMeta.onConfirm(); }} />

        {/* assignment dialog */}
        <AnimatePresence>
          {showAssignmentDialog && (
            <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowAssignmentDialog(false)} />
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="relative w-full max-w-2xl sm:max-w-2xl md:max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-300">{editingAssignment ? "Edit assignment" : "New assignment"}</h3>
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setShowAssignmentDialog(false)}>Close</Button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Input placeholder="Title" value={assignmentForm.title} onChange={(e) => setAssignmentForm(s => ({ ...s, title: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                  <Textarea placeholder="Description" value={assignmentForm.description} onChange={(e) => setAssignmentForm(s => ({ ...s, description: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                  <Input placeholder="Resource link (optional)" value={assignmentForm.link_url} onChange={(e) => setAssignmentForm(s => ({ ...s, link_url: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                  <Select value={assignmentForm.module_id} onValueChange={(v) => setAssignmentForm(s => ({ ...s, module_id: v }))}>
                    <SelectTrigger className="bg-zinc-900 border border-zinc-800"><SelectValue placeholder="Module" /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 text-slate-100">{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent>
                  </Select>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="cursor-pointer" onClick={() => setShowAssignmentDialog(false)}>Cancel</Button>
                    <Button className="bg-emerald-500 text-slate-100 cursor-pointer" onClick={saveAssignment}>{editingAssignment ? "Save" : "Create"}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* module dialog */}
        <AnimatePresence>
          {showModuleDialog && (
            <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowModuleDialog(false)} />
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-300">{editingModule ? "Edit module" : "New module"}</h3>
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setShowModuleDialog(false)}>Close</Button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Input placeholder="Title" value={moduleForm.title} onChange={(e) => setModuleForm(s => ({ ...s, title: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                  <div>
                    <Label className="text-zinc-400 text-xs">Description (rich)</Label>
                    <div className="mt-2 bg-zinc-800 rounded p-1">
                      <ReactQuill theme="snow" value={moduleForm.description || ""} onChange={(val) => setModuleForm(s => ({ ...s, description: val }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-zinc-400 text-xs">Unlock (optional)</Label>
                      <Input type="datetime-local" value={moduleForm.unlock_date} onChange={(e) => setModuleForm(s => ({ ...s, unlock_date: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Due (optional)</Label>
                      <Input type="datetime-local" value={moduleForm.due_date} onChange={(e) => setModuleForm(s => ({ ...s, due_date: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input type="number" placeholder="Order number" value={moduleForm.order_number} onChange={(e) => setModuleForm(s => ({ ...s, order_number: Number(e.target.value) }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                    <Select value={moduleForm.prerequisite_module_id || "none"} onValueChange={(v) => setModuleForm(s => ({ ...s, prerequisite_module_id: v === "none" ? null : v }))}>
                      <SelectTrigger className="bg-zinc-900 border border-zinc-800"><SelectValue placeholder="Prerequisite" /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 text-slate-100">
                        <SelectItem value="none">None</SelectItem>
                        {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* badge creation (text based) */}
                  <div>
                    <Label className="text-zinc-400 text-xs">Create a text badge for this module (optional)</Label>
                    <div className="flex gap-2 mt-2 items-center">
                      <Input placeholder="Badge text (e.g. 'Completed Module 1')" value={moduleForm.badge_text} onChange={(e) => setModuleForm(s => ({ ...s, badge_text: e.target.value }))} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-10 rounded bg-amber-600 flex items-center justify-center text-xs font-semibold text-slate-100">{(moduleForm.badge_text || "").slice(0, 2).toUpperCase() || "TB"}</div>
                        <div className="text-xs text-zinc-400">Preview</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="cursor-pointer" onClick={() => setShowModuleDialog(false)}>Cancel</Button>
                    <Button className="bg-emerald-500 text-slate-100 cursor-pointer" onClick={saveModule}>{editingModule ? "Save" : "Create"}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
