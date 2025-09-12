// src/pages/StudentRoadmap.jsx
// Student Roadmap — full file (responsive, original logic preserved, circular progress inside module,
// themed icons, inputs styled, cursor-pointer everywhere, inline QR previews, QR modal with PNG download,
// AnalyticsPage restored with Area, Line, Bar, Pie charts)
// NOTE: This file preserves the original DB logic (start/complete upserts, submissions, badges, etc.)
// and only adjusts UI/UX as requested.
//
// Paste this entire file to replace your existing StudentRoadmap.jsx.
//
// Dependencies assumed: react, supabase client at ./lib/supabaseClient, framer-motion, dompurify,
// date-fns, sonner (toast), react-qr-code, lucide-react, @dnd-kit/core, @dnd-kit/sortable, recharts,
// and your ui components under "@/components/ui/*".
/* eslint-disable react/no-danger */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "dompurify";
import { format, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";
import QRCode from "react-qr-code";

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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

import {
  Users,
  Award,
  CheckCircle,
  Play,
  ExternalLink,
  BarChart2,
  X,
  Trophy,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Download,
  FileText,
  Calendar,
  Clock,
  Info,
  AlertTriangle,
  ChartPie,
  ChartBar,
  Activity,
  DownloadCloud,
  Eye,
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
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  BarChart,
  Bar,
} from "recharts";

/* ---------------- Utilities ---------------- */
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

/* Convert rendered QR (SVG) to PNG and download */
function downloadQrPng(svgElementId, filename = "submission_qr.png") {
  try {
    const svg = document.getElementById(svgElementId);
    if (!svg) {
      toast.error("QR not found");
      return;
    }
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = function () {
      const w = img.width || 400;
      const h = img.height || 400;
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob2) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob2);
        a.download = filename;
        a.click();
      }, "image/png");
    };
    img.onerror = function (e) {
      console.error("QR image load error", e);
      URL.revokeObjectURL(url);
      toast.error("Failed to generate QR image");
    };
    img.src = url;
  } catch (err) {
    console.error("downloadQrPng", err);
    toast.error("QR download failed");
  }
}

/* ---------------- Small UI components ---------------- */

/* Circular progress used inside module card */
function CircularProgress({ size = 56, stroke = 6, value = 0 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.08)" strokeWidth={stroke} fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#gradProgress)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} fill="transparent" />
        <defs>
          <linearGradient id="gradProgress" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-xs font-semibold text-slate-100">{Math.round(pct)}%</div>
    </div>
  );
}

/* Completion burst animation (confetti-like) */
function CompletionBurst({ open, badges = [] }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-4xl h-80 flex items-center justify-center p-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 0, rotate: 0, scale: 0.6 }}
                animate={{
                  opacity: [0, 1, 0],
                  y: -160 - Math.random() * 220,
                  x: (Math.random() - 0.5) * 700,
                  rotate: Math.random() * 360,
                  scale: [0.6, 1, 0.7],
                }}
                transition={{ duration: 1.6 + Math.random() * 0.8, delay: Math.random() * 0.3 }}
                className="w-8 h-10 bg-white/95 rounded-sm shadow-md flex items-center justify-center text-xs"
                style={{ position: "absolute", left: `${20 + Math.random() * 60}%`, top: `${55 + Math.random() * 20}%` }}
              >
                <span className="text-[12px]">📄</span>
              </motion.div>
            ))}

            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="z-20 text-center">
              <div className="text-3xl md:text-4xl font-bold text-emerald-300 drop-shadow-lg">Module Complete</div>
              <div className="text-sm text-zinc-300 mt-2">Nice work — you finished this module!</div>

              <div className="mt-4 flex items-center justify-center gap-3">
                {badges.map((b) => (
                  <motion.div key={b.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-xl bg-zinc-900/60 border border-zinc-700 flex items-center justify-center">
                      {b.icon_url ? <img src={b.icon_url} alt={b.title} className="w-12 h-12 rounded" onError={(e) => (e.currentTarget.style.display = "none")} /> : <Trophy className="w-6 h-6 text-amber-400" />}
                    </div>
                    <div className="text-xs text-slate-100">{b.title}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Sortable module card — DnD-able */
function SortableModule({
  id,
  module,
  studentProgressForModule,
  studentBadgesSet,
  onStart,
  onComplete,
  onOpenAssignments,
  onMoveUp,
  onMoveDown,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 60 : "auto" };

  const locked = module.unlock_date && isAfter(new Date(module.unlock_date), new Date());
  const overdue = module.due_date && isBefore(new Date(module.due_date), new Date());

  const prog = studentProgressForModule || { progress_percent: 0, status: "not_started" };
  const earned = (module.badges || []).filter(b => studentBadgesSet.has(b.id));

  return (
    <motion.div ref={setNodeRef} style={style} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`p-4 rounded-2xl bg-zinc-800/60 border ${locked ? "border-zinc-700/30" : overdue ? "border-rose-700/30" : "border-zinc-700"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div {...attributes} {...listeners} className="p-2 rounded-md bg-zinc-900/30 cursor-grab">
            <ClipboardList className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-100 truncate">{module.title}</div>
            <div className="text-xs text-zinc-400 mt-2 line-clamp-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(module.description || "") }} />
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
              {module.unlock_date && <div>Unlock: <span className="text-emerald-300 ml-1">{shortDate(module.unlock_date)}</span></div>}
              {module.due_date && <div>Due: <span className={`${overdue ? "text-rose-300" : "text-emerald-300"} ml-1`}>{shortDate(module.due_date)}</span></div>}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <CircularProgress value={prog.progress_percent || 0} />

          <div className="flex items-center gap-2 mt-2">
            {prog.status === "not_started" && <Button size="sm" className="bg-sky-500 text-white cursor-pointer" onClick={() => onStart(module)}><Play className="w-4 h-4 mr-1" /> Start</Button>}
            {prog.status === "in_progress" && <Button size="sm" className="bg-emerald-500 text-white cursor-pointer" onClick={() => onComplete(module)}><CheckCircle className="w-4 h-4 mr-1" /> Complete</Button>}
            {prog.status === "completed" && <div className="text-xs text-emerald-300 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Completed</div>}
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 bg-zinc-900/30 border border-zinc-800 rounded cursor-pointer" title="Move up" onClick={() => onMoveUp(module)}><ArrowUp className="w-4 h-4 text-slate-200" /></button>
            <button className="p-2 bg-zinc-900/30 border border-zinc-800 rounded cursor-pointer" title="Move down" onClick={() => onMoveDown(module)}><ArrowDown className="w-4 h-4 text-slate-200" /></button>
            <button className="p-2 bg-zinc-900/30 border border-zinc-800 rounded cursor-pointer" title="Open assignments" onClick={() => onOpenAssignments(module)}><ClipboardList className="w-4 h-4 text-emerald-300" /></button>
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {earned.map(b => (
            <div key={b.id} className="flex items-center gap-2 px-2 py-1 bg-emerald-900/20 rounded-md border border-emerald-700 text-xs">
              {b.icon_url ? <img src={b.icon_url} alt={b.title} className="w-5 h-5 rounded" /> : <Award className="w-4 h-4 text-amber-400" />}
              <div className="text-emerald-300">{b.title}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* AssignmentCard displays inline QR preview + open/QR/download actions */
function AssignmentCard({ assignment, mySubmission, onOpenSubmit, onOpenQr }) {
  return (
    <div className="p-3 rounded-md bg-zinc-900/40 border border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm text-slate-100 font-medium truncate">{assignment.title}</div>
          <div className="text-xs text-zinc-400 truncate">{assignment.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onOpenSubmit(assignment)}><FileText className="w-4 h-4" /></Button>

          {assignment.link_url && (
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer flex items-center gap-1"
              onClick={() => window.open(assignment.link_url, "_blank")}
            >
              <Eye className="w-4 h-4" /> View
            </Button>
          )}

          {assignment.file_url && (
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer flex items-center gap-1"
              onClick={() => window.open(assignment.file_url, "_blank")}
            >
              <Download className="w-4 h-4" /> Download
            </Button>
          )}
        </div>
      </div>

     {mySubmission && (
  <div className="mt-3 space-y-3">
    {/* Existing link + QR + button */}
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <a
        className="text-emerald-300 underline cursor-pointer flex items-center gap-1"
        href={mySubmission.file_url}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink className="w-4 h-4" />
        Open link
      </a>

      <div className="p-1 bg-white rounded" aria-hidden>
        <QRCode
          id={`qr-inline-${mySubmission.id}`}
          value={mySubmission.file_url}
          size={80}
        />
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer flex items-center gap-1"
        onClick={() => onOpenQr(mySubmission, assignment)}
      >
        <Download className="w-4 h-4" /> QR
      </Button>
    </div>

    {/* ✅ Grade & Feedback Section */}
    <div className="text-sm text-zinc-300 space-y-1">
      {mySubmission.grade != null || mySubmission.feedback ? (
        <>
          {mySubmission.grade != null && (
            <div>
              <span className="font-semibold text-emerald-400">Grade:</span>{" "}
              {mySubmission.grade}
            </div>
          )}
          {mySubmission.feedback && (
            <div>
              <span className="font-semibold text-emerald-400">Feedback:</span>{" "}
              {mySubmission.feedback}
            </div>
          )}
        </>
      ) : (
        <p className="text-zinc-500 italic">
          Grade and feedback not yet provided by admin.
        </p>
      )}
    </div>
  </div>
)}

    </div>
  );
}


/* ---------------- Main StudentRoadmap component ---------------- */
export default function StudentRoadmap() {
  // user & course
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");

  // data
  const [modules, setModules] = useState([]);
  const [moduleAssignments, setModuleAssignments] = useState({}); // module_id -> assignments[]
  const [studentProgressMap, setStudentProgressMap] = useState({}); // module_id -> progress row
  const [studentBadgesSet, setStudentBadgesSet] = useState(new Set()); // badge ids for current student
  const [moduleSubmissionsByAssignment, setModuleSubmissionsByAssignment] = useState({}); // assignment_id -> submissions[]
  const [submissionsCountByModule, setSubmissionsCountByModule] = useState({}); // module_id -> count

  // UI state
  const STORAGE_KEY = "student_personal_module_order_v6";
  const [personalOrder, setPersonalOrder] = useState([]);
  const [dragActiveId, setDragActiveId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrSubmission, setQrSubmission] = useState(null); // { submission, assignment }
  const [showAnalyticsPage, setShowAnalyticsPage] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [burstBadges, setBurstBadges] = useState([]);
  const [loading, setLoading] = useState(false);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /* ---------------- Lifecycle & data fetching ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user || null);
      } catch (e) {
        console.error("auth.getUser", e);
      }
      await fetchCourses();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (courseId) fetchCourseData(courseId);
    else {
      setModules([]);
      setModuleAssignments({});
      setStudentProgressMap({});
      setStudentBadgesSet(new Set());
      setPersonalOrder([]);
      setModuleSubmissionsByAssignment({});
      setSubmissionsCountByModule({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user]);

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses", err);
      toast.error("Could not load courses");
    }
  }

  async function fetchCourseData(cid) {
    if (!cid) return;
    setLoading(true);
    try {
      // modules + badges
      const { data: mods, error: modsErr } = await supabase
        .from("modules")
        .select("*, badges(id,title,text,icon_url,module_id)")
        .eq("course_id", cid)
        .order("order_number", { ascending: true });
      if (modsErr) throw modsErr;
      const normalized = (mods || []).map(m => ({ ...m, badges: m.badges || [] }));
      setModules(normalized);

      const modIds = normalized.map(m => m.id).filter(Boolean);

      // assignments
      if (modIds.length > 0) {
        const { data: assigns, error: assignsErr } = await supabase
          .from("module_assignments")
          .select("*")
          .in("module_id", modIds)
          .order("created_at", { ascending: true });
        if (!assignsErr) {
          const map = {};
          assigns.forEach(a => {
            if (!map[a.module_id]) map[a.module_id] = [];
            map[a.module_id].push(a);
          });
          setModuleAssignments(map);

          // fetch submissions for these assignments
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
              setModuleSubmissionsByAssignment(sMap);
            } else {
              setModuleSubmissionsByAssignment({});
            }
          } else {
            setModuleSubmissionsByAssignment({});
          }
        } else {
          setModuleAssignments({});
          setModuleSubmissionsByAssignment({});
        }
      } else {
        setModuleAssignments({});
        setModuleSubmissionsByAssignment({});
      }

      // progress rows (student_progress)
      if (modIds.length > 0) {
        const { data: progRows, error: progErr } = await supabase
          .from("student_progress")
          .select("*")
          .in("module_id", modIds);
        if (!progErr) {
          const agg = {};
          progRows.forEach(r => {
            // keep last row per module by default but prefer the current user's row if present
            if (!agg[r.module_id]) agg[r.module_id] = r;
            if (r.student_id === user?.id) agg[r.module_id] = r;
          });
          setStudentProgressMap(agg);
        } else {
          setStudentProgressMap({});
        }
      } else {
        setStudentProgressMap({});
      }

      // submissions count per module (aggregate across assignments)
      if (modIds.length > 0) {
        // derive assignment->module map
        const assignRecords = Object.values(moduleAssignments).flat();
        // fallback: if moduleAssignments is empty because we just fetched them above, rebuild from assigns
        const allAssigns = Object.values(moduleAssignments).flat();
        const assignToModule = {};
        const allAssignIds = [];
        allAssigns.forEach(a => {
          assignToModule[a.id] = a.module_id;
          allAssignIds.push(a.id);
        });

        if (allAssignIds.length > 0) {
          const { data: allSubs, error: allSubsErr } = await supabase
            .from("module_submissions")
            .select("id,assignment_id")
            .in("assignment_id", allAssignIds);
          if (!allSubsErr && allSubs) {
            const scm = {};
            allSubs.forEach(s => {
              const mid = assignToModule[s.assignment_id];
              if (!mid) return;
              scm[mid] = (scm[mid] || 0) + 1;
            });
            setSubmissionsCountByModule(scm);
          } else {
            setSubmissionsCountByModule({});
          }
        } else {
          setSubmissionsCountByModule({});
        }
      } else {
        setSubmissionsCountByModule({});
      }

      // personal order from localStorage (preserve original behavior)
      const stored = localStorage.getItem(STORAGE_KEY);
      const modIdSet = new Set(modIds);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const filtered = parsed.filter(id => modIdSet.has(id));
          const missing = modIds.filter(id => !filtered.includes(id));
          const merged = [...filtered, ...missing];
          setPersonalOrder(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          setPersonalOrder(modIds);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(modIds));
        }
      } else {
        setPersonalOrder(modIds);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(modIds));
      }

      // student badges
      try {
        const { data: sb, error: sberr } = await supabase.from("student_badges").select("badge_id").eq("student_id", user?.id || -1);
        if (!sberr) {
          const set = new Set((sb || []).map(x => x.badge_id));
          setStudentBadgesSet(set);
        }
      } catch (err) {
        console.warn("student badges fetch error", err);
      }
    } catch (err) {
      console.error("fetchCourseData", err);
      toast.error("Failed to load roadmap data");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- DnD handlers ---------------- */
  function handleDragStart(e) {
    setDragActiveId(e.active.id);
    setDragging(true);
  }
  function handleDragEnd(e) {
    setDragging(false);
    const { active, over } = e;
    setDragActiveId(null);
    if (!over) return;
    if (active.id === over.id) return;
    const oldIndex = personalOrder.indexOf(active.id);
    const newIndex = personalOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(personalOrder, oldIndex, newIndex);
    setPersonalOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    toast.success("Order updated");
  }
  function handleDragCancel() {
    setDragging(false);
    setDragActiveId(null);
  }

  /* ---------------- Student actions: START & COMPLETE (original logic preserved) ---------------- */
  async function startModule(mod) {
    if (!user) { toast.error("Sign in to start"); return; }
    if (mod.unlock_date && isAfter(new Date(mod.unlock_date), new Date())) { toast.error("Module locked until " + shortDate(mod.unlock_date)); return; }

    // optimistic update
    setStudentProgressMap(prev => ({ ...prev, [mod.id]: { ...(prev[mod.id] || {}), student_id: user.id, module_id: mod.id, status: "in_progress", progress_percent: 0, updated_at: new Date().toISOString() } }));
    try {
      const payload = { student_id: user.id, module_id: mod.id, status: "in_progress", progress_percent: 0, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("student_progress").upsert(payload, { onConflict: ["student_id", "module_id"], ignoreDuplicates: false });
      if (error) throw error;
      toast.success("Module started");
    } catch (err) {
      console.error("startModule", err);
      toast.error("Could not start module");
      await fetchCourseData(courseId);
    }
  }

  async function completeModule(mod) {
    if (!user) { toast.error("Sign in to complete"); return; }
    if (mod.unlock_date && isAfter(new Date(mod.unlock_date), new Date())) { toast.error("Module locked until " + shortDate(mod.unlock_date)); return; }

    // optimistic + burst
    setStudentProgressMap(prev => ({ ...prev, [mod.id]: { ...(prev[mod.id] || {}), student_id: user.id, module_id: mod.id, status: "completed", progress_percent: 100, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } }));
    setBurstBadges(mod.badges || []);
    setShowBurst(true);
    setTimeout(() => setShowBurst(false), 1600);

    try {
      const payload = { student_id: user.id, module_id: mod.id, status: "completed", progress_percent: 100, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { error } = await supabase.from("student_progress").upsert(payload, { onConflict: ["student_id", "module_id"], ignoreDuplicates: false });
      if (error) throw error;

      // award badges if present and not already awarded
      if (mod.badges && mod.badges.length > 0) {
        for (const badge of mod.badges) {
          try {
            const { data: exists, error: checkErr } = await supabase.from("student_badges").select("*").eq("student_id", user.id).eq("badge_id", badge.id).limit(1);
            if (checkErr) throw checkErr;
            if (!exists || exists.length === 0) {
              const { error: insErr } = await supabase.from("student_badges").insert([{ student_id: user.id, badge_id: badge.id }]);
              if (insErr) console.warn("award badge failed", insErr);
              else setStudentBadgesSet(prev => new Set(prev).add(badge.id));
            }
          } catch (err) {
            console.error("awardBadge", err);
          }
        }
      }

      toast.success("Module completed");
      await fetchCourseData(courseId);
    } catch (err) {
      console.error("completeModule", err);
      toast.error("Complete failed");
      await fetchCourseData(courseId);
    }
  }

  /* ---------------- Assignment submission flow ---------------- */
  function openSubmitModalForAssignment(assignment) {
    setActiveAssignment(assignment);
    setSubmitUrl("");
    setShowSubmitModal(true);
  }
  function closeSubmitModal() {
    setShowSubmitModal(false);
    setActiveAssignment(null);
    setSubmitUrl("");
  }

  async function submitAssignment() {
    if (!activeAssignment) return;
    if (!submitUrl || !submitUrl.trim()) {
      toast.error("Please enter a link to submit");
      return;
    }
    setSubmitting(true);
    // ⛔ Due date lock: prevent submissions after assignment due_date
    if (activeAssignment && activeAssignment.due_date && new Date() > new Date(activeAssignment.due_date)) {
      toast.error("Deadline has passed. You cannot submit.");
      setSubmitting(false);
      return;
    }
    try {
      const payload = {
        assignment_id: activeAssignment.id,
        student_id: user?.id || null,
        file_url: submitUrl.trim(),
        submitted_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("module_submissions").insert([payload]);
      if (error) throw error;
      toast.success("Submission saved");
      await fetchCourseData(courseId);
      setShowSubmitModal(false);
    } catch (err) {
      console.error("submitAssignment", err);
      toast.error("Could not submit");
    } finally {
      setSubmitting(false);
      setSubmitUrl("");
    }
  }

  /* ---------------- QR modal flow ---------------- */
  function openQrModalForSubmission(submission, assignment) {
    setQrSubmission({ submission, assignment });
    setShowQrModal(true);
  }
  function closeQrModal() {
    setShowQrModal(false);
    setQrSubmission(null);
  }

  /* ---------------- Move up/down helpers (local only) ---------------- */
  function moveUp(mod) {
    const i = modules.findIndex(m => m.id === mod.id);
    if (i > 0) {
      const newArr = arrayMove(modules, i, i - 1);
      setModules(newArr);
    }
  }
  function moveDown(mod) {
    const i = modules.findIndex(m => m.id === mod.id);
    if (i < modules.length - 1) {
      const newArr = arrayMove(modules, i, i + 1);
      setModules(newArr);
    }
  }

  /* ---------------- Computed & analytics data ---------------- */
  const personalModules = useMemo(() => {
    if (!personalOrder || personalOrder.length === 0) return modules;
    const map = new Map(modules.map(m => [m.id, m]));
    return personalOrder.map(id => map.get(id)).filter(Boolean);
  }, [modules, personalOrder]);

  const overallStats = useMemo(() => {
    const totals = modules.length || 0;
    const completed = modules.filter(m => (studentProgressMap[m.id]?.progress_percent || 0) >= 100).length;
    const percent = totals ? Math.round((completed / totals) * 100) : 0;
    return { total: totals, completed, percent };
  }, [modules, studentProgressMap]);

  // Build analytics datasets (area/line/bar/pie) using available data.
  const analyticsData = useMemo(() => {
    // per-module series: name, percent, started, completed, submissionsCount
    const arr = modules.map(m => {
      const prog = studentProgressMap[m.id] || { progress_percent: 0 };
      const submissionsCount = submissionsCountByModule[m.id] || 0;
      return {
        id: m.id,
        name: m.title.length > 18 ? m.title.slice(0, 16) + "…" : m.title,
        percent: prog.progress_percent || 0,
        started: prog.status === "in_progress" ? 1 : 0,
        completed: prog.status === "completed" ? 1 : 0,
        submissions: submissionsCount,
      };
    });
    // area chart needs a time axis in original system; if not available, use modules sequence as x
    return arr;
  }, [modules, studentProgressMap, submissionsCountByModule]);

  /* ---------------- AnalyticsPage — restored with multiple charts ---------------- */
  function AnalyticsPage() {
    // build additional aggregation: submissions per assignment over time (if timestamps exist)
    // Create a simple synthetic time series if original data lacks temporal aggregation; otherwise, use module_submissions dates.
    // For safety, we'll show:
    // - Area chart (module progress distribution)
    // - Line chart (module progress percent)
    // - Bar chart (submissions per module)
    // - Pie chart (completion mix)
    const areaData = analyticsData.map((d, idx) => ({ name: d.name, value: d.percent, index: idx }));
    const lineData = analyticsData.map(d => ({ name: d.name, percent: d.percent }));
    const barData = analyticsData.map(d => ({ name: d.name, submissions: d.submissions }));
    const completedCount = analyticsData.filter(d => d.percent >= 100).length;
    const inProgressCount = analyticsData.filter(d => d.percent > 0 && d.percent < 100).length;
    const notStartedCount = analyticsData.length - completedCount - inProgressCount;
    const pieData = [
      { name: "Completed", value: completedCount, color: "#10B981" },
      { name: "In progress", value: inProgressCount, color: "#F59E0B" },
      { name: "Not started", value: notStartedCount, color: "#64748B" },
    ];

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-emerald-300">Course Analytics</h2>
            <div className="text-xs text-zinc-400">Multiple views: area, line, bar, and pie charts</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="cursor-pointer" onClick={() => setShowAnalyticsPage(false)}>Back</Button>
            <Button variant="outline" className="cursor-pointer text-black" onClick={() => fetchCourseData(courseId)}>Refresh</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 col-span-2">
            <CardHeader><CardTitle className="text-emerald-300">Module progress (area)</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: 260 }} >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="value" stroke="#60A5FA" fill="url(#areaGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Completion mix</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} label>
                      {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <ReTooltip
                    contentStyle={{
                          backgroundColor: "#58585b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Progress by module (line)</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: 260 }} >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <ReTooltip 
                    contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #333",
                          borderRadius:"10px",
                        }}
                        labelStyle={{ color: "#22c55e" }}/>
                    <Legend />
                    <Line type="monotone" dataKey="percent" stroke="#10B981" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border overflow-auto border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Submissions per module (bar)</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: 260 }} >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
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
                    <Bar dataKey="submissions" fill="#60A5FA" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Per-module details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-400">
                    <tr><th className="p-2">Module</th><th className="p-2">Progress%</th><th className="p-2">Submissions</th></tr>
                  </thead>
                  <tbody>
                    {analyticsData.map(m => (
                      <tr key={m.id} className="border-t border-zinc-800">
                        <td className="p-2 text-slate-100">{m.name}</td>
                        <td className="p-2 text-emerald-200">{m.percent}%</td>
                        <td className="p-2 text-gray-200">{m.submissions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ---------------- Render main UI ---------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071b16] via-[#0b1211] to-[#000] text-slate-100 p-6">
      <CompletionBurst open={showBurst} badges={burstBadges} />
      <div className="max-w-7xl mx-auto">
        {showAnalyticsPage ? (
<AnalyticsPage />):(<>
        {/* header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-900/20">
              <Users className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-emerald-300">Student Roadmap</h1>
              <p className="text-xs text-zinc-400">Work through modules, submit assignments, and earn badges.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-64">
              <Select value={courseId} onValueChange={(v) => setCourseId(v)} className="w-full">
                <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-full">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" className="cursor-pointer" onClick={() => setShowAnalyticsPage(true)} title="Open analytics"><BarChart2 className="w-5 h-5 text-emerald-300" /></Button>

            <div className="text-right">
              <div className="text-xs text-zinc-400">Overall progress</div>
              <div className="text-sm font-medium text-slate-100">{overallStats.percent}% • {overallStats.completed}/{overallStats.total} modules</div>
            </div>
          </div>
        </div>
       

        {/* summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-400 mb-3">Your course completion</div>
              <div className="w-full bg-zinc-800 h-3 rounded overflow-hidden">
                <div style={{ width: `${overallStats.percent}%`, background: "linear-gradient(90deg,#10B981,#34D399)" }} className="h-3" />
              </div>
              <div className="mt-3 text-xs text-zinc-400">Completed: <span className="text-slate-100 ml-1">{overallStats.completed}</span> / <span className="text-slate-100 ml-1">{overallStats.total}</span></div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Badges</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-400 mb-3">Earned badges</div>
              <div className="flex gap-2 flex-wrap">
                {modules.flatMap(m => (m.badges || [])).length === 0 ? <div className="text-xs text-zinc-500">No badges</div> : modules.flatMap(m => (m.badges || [])).map(b => {
                  const earned = studentBadgesSet.has(b.id);
                  return (
                    <div key={b.id} className={`p-2 rounded-md ${earned ? "bg-emerald-800/20 border border-emerald-700" : "bg-zinc-800/40 border border-zinc-700"} flex items-center gap-2`}>
                      {b.icon_url ? <img src={b.icon_url} alt={b.title} className="w-8 h-8 rounded" /> : <Award className="w-6 h-6 text-amber-400" />}
                      <div className={`text-xs ${earned ? "text-emerald-300" : "text-zinc-300"}`}>{b.title}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <CardHeader><CardTitle className="text-emerald-300">Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" className="cursor-pointer bg-emerald-400" onClick={() => { setPersonalOrder([]); localStorage.removeItem(STORAGE_KEY); toast.success("Reset personal order"); fetchCourseData(courseId); }}>Reset order</Button>
                <Button variant="ghost" className="cursor-pointer bg-emerald-400" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }}>Share roadmap</Button>
                <Button variant="ghost" className="cursor-pointer bg-emerald-400" onClick={() => toast.info("Drag modules (hold & move) or use arrows to reorder")}>How to use</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* modules list with DnD */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={personalOrder} strategy={rectSortingStrategy}>
            <div className="space-y-4">
              {personalModules.length === 0 ? (
                <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
                  <div className="text-zinc-400">No modules found for this course.</div>
                </Card>
              ) : (
                personalModules.map((mod) => (
                  <div key={mod.id} id={mod.id}>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1">
                        <SortableModule
                          id={mod.id}
                          module={mod}
                          studentProgressForModule={studentProgressMap[mod.id]}
                          studentBadgesSet={studentBadgesSet}
                          onStart={startModule}
                          onComplete={completeModule}
                          onOpenAssignments={(m) => {
                            const el = document.getElementById(`assignments-${m.id}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          onMoveUp={moveUp}
                          onMoveDown={moveDown}
                        />

                        {/* assignments */}
                        <div id={`assignments-${mod.id}`} className="mt-3">
                          <div className="text-sm font-medium text-slate-100 mb-2">Assignments</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(moduleAssignments[mod.id] || []).length === 0 ? (
                              <div className="text-xs text-zinc-500">No assignments in this module.</div>
                            ) : (
                              (moduleAssignments[mod.id] || []).map(a => {
                                const subs = moduleSubmissionsByAssignment[a.id] || [];
                                const mySub = subs.find(s => s.student_id === user?.id) || null;
                                return (
                                  <AssignmentCard
                                    key={a.id}
                                    assignment={a}
                                    mySubmission={mySub}
                                    onOpenSubmit={(ass) => openSubmitModalForAssignment(ass)}
                                    onOpenQr={(sub, ass) => openQrModalForSubmission(sub, ass)}
                                  />
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {dragActiveId ? (
              <div className="p-4 rounded-2xl bg-zinc-800/70 border border-zinc-700 w-[420px]">
                <div className="text-slate-100">Moving…</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* submit modal */}
        <AnimatePresence>
          {showSubmitModal && activeAssignment && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={closeSubmitModal} />
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-emerald-300">Submit: <span className="text-slate-100 ml-2">{activeAssignment.title}</span></div>
                    <div className="text-xs text-zinc-400 mt-1">Paste a link to your work (Drive, Doc, Video, etc.)</div>
                  </div>
                  <button className="p-2 rounded-md bg-zinc-900/30 cursor-pointer" onClick={closeSubmitModal}><X className="w-5 h-5" /></button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Label className="text-zinc-400 text-xs">Link</Label>
                  <Input placeholder="https://example.com/..." value={submitUrl} onChange={(e) => setSubmitUrl(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-emerald-100" />

                  {/* QR preview */}
                  <div className="mt-2">
                    {submitUrl && submitUrl.trim() ? (
                      <div className="p-2 bg-white inline-block rounded">
                        <QRCode id="qr-preview-submit" value={submitUrl.trim()} size={140} />
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900 rounded text-zinc-500">Paste link to preview QR</div>
                    )}
                    <div className="text-xs text-zinc-400 mt-2">Scan with a phone to verify the link before submitting.</div>
                  </div>

                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" className="cursor-pointer" onClick={closeSubmitModal}>Cancel</Button>
                    <Button className="bg-emerald-500 text-slate-900 cursor-pointer" onClick={submitAssignment} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR modal */}
        <AnimatePresence>
          {showQrModal && qrSubmission && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={closeQrModal} />
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-emerald-300">Submission</div>
                    <div className="text-xs text-zinc-400">QR & actions for your submission</div>
                  </div>
                  <button className="p-2 rounded-md bg-zinc-900/30 cursor-pointer" onClick={closeQrModal}><X className="w-5 h-5" /></button>
                </div>

                <div className="mt-4 flex flex-col md:flex-row gap-4 items-start">
                  <div className="p-2 bg-zinc-900 rounded">
                    <div style={{ background: "white", padding: 8, borderRadius: 6 }}>
                      <QRCode id="qr-modal-download" value={qrSubmission.submission.file_url} size={160} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-100 mb-2">{qrSubmission.assignment.title}</div>
                    <div className="text-xs text-zinc-400 mb-3">Submitted: {qrSubmission.submission.submitted_at ? shortDate(qrSubmission.submission.submitted_at) : "—"}</div>
                    <div className="flex gap-2 flex-col">
                      <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 cursor-pointer" onClick={() => window.open(qrSubmission.submission.file_url, "_blank")}><ExternalLink className="w-4 h-4 mr-2" />Visit</Button>
                      <Button variant="outline" className=" text-black cursor-pointer" onClick={() => downloadQrPng("qr-modal-download", `submission-${qrSubmission.submission.id}_qr.png`)}><Download className="w-4 h-4 mr-2" />Download QR</Button>
                    </div>
                    <div className="text-xs text-zinc-400 mt-3">If the file is a share link, Visit will open it. Download QR saves the QR image (PNG).</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-20" />
        </>)}
      </div>
       
    </div>
    
  );
}
