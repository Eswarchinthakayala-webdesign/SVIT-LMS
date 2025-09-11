// src/pages/CoursePage.jsx
/**
 * CoursePage.jsx
 *
 * Extended features:
 *  - AI generation modal with prompt input and streaming + stop (AbortController)
 *  - Theme-matching markdown text (no black text)
 *  - Chart color theme updated
 *  - Responsive adjustments and scrollbar tweaks
 *
 * Note: This file assumes the same project dependencies (shadcn components, sonner, lucide-react, recharts, react-markdown, highlight.js, qrcode.react).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// shadcn/ui components (assumes these exist)
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";

// sonner
import { Toaster, toast } from "sonner";

// icons
import {
  GraduationCap,
  FileText,
  Link as LinkIcon,
  ClipboardList,
  Sparkles,
  Download,
  Plus,
  Edit3,
  Save,
  X,
  QrCode,
  CheckCircle2,
  Loader2,
  BookOpenCheck,
  BarChart3,
  Trash2,
  Search,
  StopCircle,
} from "lucide-react";

// markdown
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

// QR
import { QRCodeCanvas } from "qrcode.react";

// recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";

// framer motion
import { motion, AnimatePresence } from "framer-motion";

/* -----------------------------
   Helpers
   -----------------------------*/

const cn = (...args) => args.filter(Boolean).join(" ");

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
  import.meta.env.VITE_GEMINI_API_KEYY;

// quick url validation
const isValidUrl = (url) => {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
};

function useQrSize({ small = 92, medium = 140, large = 180 } = {}) {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return medium;
    const w = window.innerWidth;
    if (w < 640) return small;
    if (w < 1024) return medium;
    return large;
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 640) setSize(small);
      else if (w < 1024) setSize(medium);
      else setSize(large);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [small, medium, large]);
  return size;
}

/* -----------------------------
   Component
   -----------------------------*/

export default function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // page & user
  const [course, setCourse] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

  // notes
  const [noteTitle, setNoteTitle] = useState("");
  const [noteMd, setNoteMd] = useState("");
  const [noteTags, setNoteTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // links
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [links, setLinks] = useState([]);
  const [linkSearch, setLinkSearch] = useState("");
  const linkQRRef = useRef(null);

  // assignments / submissions
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const subQRRef = useRef(null);
  const [savingSubmission, setSavingSubmission] = useState(false);

  // attendance & quizzes
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(false);

  // theme/qr
  const qrSize = useQrSize({ small: 92, medium: 140, large: 180 });

  // derived
  const attendanceSummary = useMemo(() => {
    const present = attendanceRows.filter((r) => r.status === "present").length;
    const absent = attendanceRows.filter((r) => r.status === "absent").length;
    const late = attendanceRows.filter((r) => r.status === "late").length;
    const total = attendanceRows.length;
    return { present, absent, late, total };
  }, [attendanceRows]);

  const presentPct = useMemo(() => {
    if (attendanceSummary.total === 0) return 0;
    return Math.round((attendanceSummary.present / attendanceSummary.total) * 100);
  }, [attendanceSummary]);

// helper to parse a score value (handles numbers, "85", "85%", "85/100", "1,000", etc.)
const parseScoreFraction = (raw) => {
  if (!raw) return NaN;
  if (typeof raw !== "string") return NaN;
  const [numStr, denomStr] = raw.split("/");
  const num = Number(numStr);
  const denom = Number(denomStr);
  if (!denom || isNaN(num) || isNaN(denom)) return NaN;
  return (num / denom) * 100; // convert fraction into percentage
};

const quizStats = useMemo(() => {
  const parseScoreFraction = (raw) => {
    if (!raw) return NaN;
    if (typeof raw !== "string") return NaN;
    const [numStr, denomStr] = raw.split("/");
    const num = Number(numStr);
    const denom = Number(denomStr);
    if (!denom || isNaN(num) || isNaN(denom)) return NaN;
    return (num / denom) * 100;
  };

  const parsed = (quizAttempts || []).map((a) => parseScoreFraction(a?.score));
  const validScores = parsed.filter((s) => !Number.isNaN(s));
  const attended = validScores.length;

  const average =
    attended === 0
      ? 0
      : (validScores.reduce((sum, s) => sum + s, 0) / attended).toFixed(1);

  return { attended, average };
}, [quizAttempts]);


  const summaryBarData = useMemo(
    () => [
      { label: "Quizzes", value: quizStats.attended },
      { label: "Classes Present", value: attendanceSummary.present },
    ],
    [quizStats, attendanceSummary]
  );

  /* -----------------------------
     Fetch initial data
     -----------------------------*/
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoadingPage(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(user || null);

        const { data: courseData, error: courseErr } = await supabase
          .from("courses")
          .select("*")
          .eq("id", id)
          .single();

        if (courseErr) {
          console.error("Course fetch error:", courseErr);
          toast.error("Failed to load course.");
        }
        if (!mounted) return;
        setCourse(courseData || null);

        const tasks = [];
        if (user) {
          tasks.push(
            supabase
              .from("notes")
              .select("*")
              .eq("course_id", id)
              .eq("student_id", user.id)
              .order("created_at", { ascending: false })
          );
          tasks.push(
            supabase
              .from("links")
              .select("*")
              .eq("course_id", id)
              .eq("added_by", user.id)
              .order("created_at", { ascending: false })
          );
          tasks.push(
            supabase
              .from("submissions")
              .select(
                "id, assignment_id, student_id, submitted_at, file_url, grade, feedback, assignments(title)"
              )
              .eq("student_id", user.id)
          );
        }

        tasks.push(
          supabase
            .from("assignments")
            .select("*")
            .eq("course_id", id)
            .order("due_date", { ascending: true })
        );

        tasks.push(
          supabase
            .from("quizzes")
            .select("id, course_id, questions, created_at, courses(title)")
            .eq("course_id", id)
            .order("created_at", { ascending: true })
        );

        const results = await Promise.all(tasks);
        let rIdx = 0;
        if (user) {
          const notesRes = results[rIdx++] || { data: null };
          const linksRes = results[rIdx++] || { data: null };
          const subsRes = results[rIdx++] || { data: null };
          if (notesRes?.data) setNotes(notesRes.data || []);
          if (linksRes?.data) setLinks(linksRes.data || []);
          if (subsRes?.data) setSubmissions(subsRes.data || []);
        }
        const assignmentsRes = results[rIdx++] || { data: null };
        if (assignmentsRes?.data) setAssignments(assignmentsRes.data || []);

        const quizzesRes = results[rIdx] || { data: null };
        if (quizzesRes?.data) setQuizzes(quizzesRes.data || []);

        setLoadingCharts(true);
        if (user) {
          const [{ data: att }, { data: qa }] = await Promise.all([
            supabase
              .from("attendance")
              .select("*")
              .eq("course_id", id)
              .eq("student_id", user.id),
            supabase
              .from("quiz_scores")
              .select(`
                id,
                student_id,
                quiz_id,
                score,
                created_at,
                quizzes (
                  id,
                  course_id
                )
              `)
              .eq("student_id", user.id)
          ]);
          if (!mounted) return;
          setAttendanceRows(att || []);
          setQuizAttempts((qa || []).filter((s) => s.quizzes?.course_id === id));
        }
      } catch (err) {
        console.error("FetchData error", err);
        toast.error("Something went wrong while loading the page.");
      } finally {
        if (mounted) {
          setLoadingCharts(false);
          setLoadingPage(false);
        }
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [id]);

  /* -----------------------------
     Notes CRUD (unchanged semantics)
     -----------------------------*/

  const saveNote = useCallback(async () => {
    if (!user || !noteTitle.trim() || !noteMd.trim()) {
      toast.error("Please add a title and content for your note.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert([
          {
            course_id: id,
            student_id: user.id,
            title: noteTitle.trim(),
            content: noteMd,
            tags: noteTags,
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("Save note error:", error);
        toast.error("Failed to save note.");
        return;
      }

      setNotes((prev) => [data, ...prev]);
      setNoteTitle("");
      setNoteMd("");
      setNoteTags([]);
      toast.success("Note saved.");
    } catch (err) {
      console.error("Save note unexpected error:", err);
      toast.error("Failed to save note.");
    }
  }, [user, noteTitle, noteMd, noteTags, id]);

  const updateNote = useCallback(
    async (noteId) => {
      if (!user) {
        toast.error("You must be signed in to update notes.");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("notes")
          .update({ title: editTitle, content: editContent })
          .eq("id", noteId)
          .eq("student_id", user.id)
          .select("*")
          .single();

        if (error) {
          console.error("Update note error:", error);
          toast.error("Failed to update note.");
          return;
        }

        setNotes((prev) => prev.map((n) => (n.id === noteId ? data : n)));
        setEditingNoteId(null);
        toast.success("Note updated.");
      } catch (err) {
        console.error("Update note unexpected error:", err);
        toast.error("Failed to update note.");
      }
    },
    [user, editTitle, editContent]
  );

  const deleteNote = useCallback(
    async (noteId) => {
      if (!user) {
        toast.error("You must be signed in to delete notes.");
        return;
      }
      const prev = notes;
      setNotes((p) => p.filter((n) => n.id !== noteId));
      try {
        const { error } = await supabase.from("notes").delete().eq("id", noteId).eq("student_id", user.id);
        if (error) {
          console.error("Delete note error:", error);
          setNotes(prev);
          toast.error("Failed to delete note.");
          return;
        }
        toast.success("Note deleted.");
      } catch (err) {
        console.error("Delete note unexpected error:", err);
        setNotes(prev);
        toast.error("Failed to delete note.");
      }
    },
    [user, notes]
  );

  /* -----------------------------
     Links CRUD
     -----------------------------*/
  const saveLink = useCallback(async () => {
    if (!user) {
      toast.error("You must be signed in to save links.");
      return;
    }
    if (!linkTitle.trim() || !isValidUrl(linkUrl)) {
      toast.error("Please provide a valid title and URL.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("links")
        .insert([{ course_id: id, added_by: user.id, title: linkTitle.trim(), url: linkUrl }])
        .select("*")
        .single();

      if (error) {
        console.error("Save link error:", error);
        toast.error("Failed to save link.");
        return;
      }

      setLinks((prev) => [data, ...prev]);
      setLinkTitle("");
      setLinkUrl("");
      toast.success("Link saved.");
    } catch (err) {
      console.error("Save link unexpected error:", err);
      toast.error("Failed to save link.");
    }
  }, [user, linkTitle, linkUrl, id]);

  /* -----------------------------
     Assignments & Submissions
     -----------------------------*/
  const openSubmission = (a) => {
    setActiveAssignment(a);
    setSubmissionLink("");
  };

  const saveSubmission = useCallback(async () => {
    if (!user || !activeAssignment || !isValidUrl(submissionLink)) {
      toast.error("Please provide a valid file URL for submission.");
      return;
    }
    setSavingSubmission(true);
    try {
      const { error } = await supabase.from("submissions").insert([
        {
          assignment_id: activeAssignment.id,
          student_id: user.id,
          file_url: submissionLink,
        },
      ]);
      if (error) {
        console.error("Save submission error:", error);
        toast.error("Failed to save submission.");
        return;
      }

      const { data: subsData } = await supabase
        .from("submissions")
        .select("id, assignment_id, student_id, submitted_at, file_url, grade, feedback, assignments(title)")
        .eq("student_id", user.id);

      setSubmissions(subsData || []);
      setActiveAssignment(null);
      toast.success("Submission saved.");
    } catch (err) {
      console.error("Save submission unexpected error:", err);
      toast.error("Failed to save submission.");
    } finally {
      setSavingSubmission(false);
    }
  }, [user, activeAssignment, submissionLink]);

  /* -----------------------------
     AI generation: modal + streaming control
     -----------------------------*/
  // UI state for AI modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("concise"); // small control
  const [aiMaxTokens, setAiMaxTokens] = useState(512);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiSourceLabel, setAiSourceLabel] = useState("Gemini");
  const aiAbortRef = useRef(null);

  // live text preview + small visual animation states
  const [aiLiveText, setAiLiveText] = useState("");
  const [aiStatus, setAiStatus] = useState("idle"); // 'idle' | 'starting' | 'streaming' | 'typing' | 'done' | 'stopped' | 'error'

  // helper: typewriter fallback animation
  const typewriteIntoEditor = useCallback(async (text) => {
    if (!text) return;
    setAiStatus("typing");
    // If there is existing content, prefix with double newline once.
    let prefix = "";
    setNoteMd((prev) => {
      prefix = prev ? "\n\n" : "";
      return prev; // unchanged now, we'll append progressively below
    });

    const full = prefix + text.trim();
    const step = 12; // chunk size for smoothness
    for (let i = 0; i < full.length; i += step) {
      const chunk = full.slice(i, i + step);
      // Append chunk to live preview and editor
      setAiLiveText((prev) => prev + chunk);
      setNoteMd((prev) => prev + chunk);
      // small delay for typewriter feel
      await new Promise((r) => setTimeout(r, 12));
      // if user aborted mid-typing, break
      if (aiAbortRef.current === null && (aiStreaming === false && aiLoading === false)) {
        break;
      }
    }
  }, [aiStreaming, aiLoading]);

  // Start streaming generation
  const startAiGeneration = useCallback(async () => {
    if (!course) {
      toast.error("Course not loaded.");
      return;
    }
    if (!aiPrompt.trim()) {
      toast.error("Please enter a short description/prompt for the AI note.");
      return;
    }

    // Keep modal OPEN for live generation experience
    setAiStreaming(true);
    setAiLoading(true);
    setAiStatus("starting");
    setAiLiveText("");

    // Create abort controller
    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const bodyPayload = {
        contents: [
          {
            parts: [
              {
                text: `${aiPrompt}

Context: Course title - "${course.title}". 
Tone: ${aiTone}. 
Max tokens: ${aiMaxTokens}. 
Please produce Markdown-formatted study notes. Provide headings, bullets, callouts, examples, and code blocks where helpful. Output only the Markdown content (no extra commentary).`,
              },
            ],
          },
        ],
      };

      const res = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errText = `${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          errText = errJson?.error?.message || JSON.stringify(errJson);
        } catch {}
        toast.error(`AI request failed: ${errText}`);
        setAiStreaming(false);
        setAiLoading(false);
        setAiStatus("error");
        return;
      }

      // If no body streaming support, fallback to full JSON + typewriter
      if (!res.body || !res.body.getReader) {
        // parse as json
        const j = await res.json();
        const text =
          (j?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n\n") || "").trim();

        if (text) {
          if (!noteTitle) setNoteTitle(`${course.title} — AI Note`);
          // animate typing progressively
          await typewriteIntoEditor(text);
          setAiStatus("done");
          toast.success("AI note generated.");
        } else {
          toast.error("AI returned no text.");
          setAiStatus("error");
        }
        setAiStreaming(false);
        setAiLoading(false);
        return;
      }

      // Attempt to stream chunks progressively (best-effort; many APIs still return a single JSON)
      setAiStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      // Ensure title set once
      if (!noteTitle) setNoteTitle(`${course.title} — AI Note`);

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) {
          done = true;
          if (buffer.trim()) {
            setAiLiveText((prev) => prev + buffer);
            setNoteMd((prev) => prev + buffer);
            buffer = "";
          }
          break;
        }
        const chunkText = decoder.decode(value || new Uint8Array(), { stream: true });

        // Many providers send JSON lines; we’ll try to extract raw text if it looks like JSON
        // Heuristic: if it looks like a JSON blob, try parse and pull text fields; else treat as raw markdown text.
        let appended = "";
        try {
          const maybeJson = JSON.parse(chunkText);
          const candidate =
            maybeJson?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n\n") || "";
          appended = candidate;
        } catch {
          // not JSON; treat as raw text
          appended = chunkText;
        }

        if (appended) {
          buffer += appended;
          // flush frequently to feel progressive
          if (buffer.length > 80) {
            const out = buffer;
            setAiLiveText((prev) => prev + out);
            setNoteMd((prev) => prev + out);
            buffer = "";
          }
        }

        if (controller.signal.aborted) {
          break;
        }
      }

      // Final flush
      if (buffer.trim()) {
        setAiLiveText((prev) => prev + buffer);
        setNoteMd((prev) => prev + buffer);
        buffer = "";
      }

      setAiStatus("done");
      toast.success("AI generation complete.");
    } catch (err) {
      if (err && err.name === "AbortError") {
        setAiStatus("stopped");
        toast.success("AI generation stopped.");
      } else {
        console.error("AI streaming error:", err);
        setAiStatus("error");
        toast.error("AI generation failed.");
      }
    } finally {
      setAiStreaming(false);
      setAiLoading(false);
      aiAbortRef.current = null;
    }
  }, [aiPrompt, aiTone, aiMaxTokens, course, noteTitle, typewriteIntoEditor]);

  const stopAiGeneration = useCallback(() => {
    try {
      if (aiAbortRef.current) {
        aiAbortRef.current.abort();
        aiAbortRef.current = null;
      }
      setAiStreaming(false);
      setAiLoading(false);
      setAiStatus("stopped");
    } catch (err) {
      console.error("stopAiGeneration error", err);
    }
  }, []);

  /* -----------------------------
     QR helper
     -----------------------------*/
  const downloadCanvasQR = (canvasRef, filename = "qr.png") => {
    try {
      const canvas = canvasRef.current?.querySelector("canvas");
      if (!canvas) {
        toast.error("QR image not available.");
        return;
      }
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("QR downloaded.");
    } catch (err) {
      console.error("Download QR error:", err);
      toast.error("Failed to download QR.");
    }
  };

  /* -----------------------------
     Small util
     -----------------------------*/
  const fmtDateTime = (d) => {
    try {
      if (!d) return "-";
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  /* -----------------------------
     Skeleton component for overview
     -----------------------------*/
const OverviewSkeleton = () => (
  <Card className="bg-zinc-900 border border-zinc-800 rounded-2xl">
    <CardHeader>
      <CardTitle className="text-emerald-400 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Overview
      </CardTitle>
    </CardHeader>
    <CardContent>
      {/* Top stats skeletons */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-14 rounded-md bg-zinc-800/60 animate-pulse" />
        <div className="h-14 rounded-md bg-zinc-800/60 animate-pulse" />
        <div className="h-14 rounded-md bg-zinc-800/60 animate-pulse" />
        <div className="h-14 rounded-md bg-zinc-800/60 animate-pulse" />
      </div>

      <Separator className="my-4 bg-zinc-800" />

      {/* Chart area skeleton */}
      <div className="h-40 w-full rounded-2xl bg-zinc-800/60 animate-pulse" />
    </CardContent>
  </Card>
);


  /* -----------------------------
     Render
     -----------------------------*/

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-5xl w-full animate-fade-in space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 bg-zinc-900 border-zinc-800 rounded-full" />
              <div>
                <Skeleton className="h-6 w-64 bg-zinc-900 border-zinc-800 rounded-md mb-2" />
                <Skeleton className="h-4 w-48 bg-zinc-900 border-zinc-800 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 bg-zinc-900 border-zinc-800 w-24 rounded-lg" />
              <Skeleton className="h-10 bg-zinc-900 border-zinc-800 w-10 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <OverviewSkeleton />
            <div className="bg-zinc-900 border-zinc-800 rounded-2xl p-4">
              <Skeleton className="h-48 bg-zinc-900 border-zinc-800 w-full rounded-2xl" />
            </div>
            <div className="bg-zinc-900 border-zinc-800 rounded-2xl p-4">
              <Skeleton className="h-48 w-full bg-zinc-900 border-zinc-800 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
        <div className="max-w-xl w-full text-center space-y-4">
          <div className="text-2xl font-semibold">Course not found</div>
          <div className="text-zinc-400">We couldn't load that course. It may have been removed or you don't have access.</div>
          <div className="flex justify-center">
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }

  /* Chart theme colors (emerald shades) */
  const chartFill = "#06d6a0"; // primary
  const chartFill2 = "#04b485"; // secondary
  const chartStroke = "#064e3b";

  /* -----------------------------
     Main JSX
     -----------------------------*/
  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:px-8 lg:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6 max-w-7xl mx-auto"
        >
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="bg-emerald-700/10 rounded-full p-2">
                <GraduationCap className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{course.title}</h1>
                <div className="text-sm text-emerald-200/70 mt-1 truncate">
                  {course.short_description || "Course dashboard"}
                </div>
                <div className="mt-2 text-xs text-zinc-500 flex items-center gap-3">
                  <BookOpenCheck className="h-4 w-4" />
                  <span>Course ID: {course.id?.slice(0, 8)}…</span>
                  {course.instructor && <span className="hidden sm:inline">• Instructor: {course.instructor}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
                <span>Signed in as</span>
                <span className="font-medium text-zinc-200">{user?.email?.split("@")?.[0] || "Student"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="bg-emerald-500 cursor-pointer text-black hover:bg-emerald-400" size="sm" onClick={() => setAiModalOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Note
                </Button>
               
              </div>
            </div>
          </div>
        </motion.div>

        {/* Overview + Attendance + Quizzes */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-zinc-900 border-zinc-800 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-zinc-800/60">
                  <div className="text-sm text-emerald-200/70">Quizzes Attended</div>
                  <div className="text-2xl font-semibold text-emerald-100">{quizStats.attended}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/60">
                  <div className="text-sm text-emerald-200/70">Avg Quiz Score</div>
                  <div className="text-2xl font-semibold text-emerald-100">{quizStats.average}%</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/60">
                  <div className="text-sm text-emerald-200/70">Classes Present</div>
                  <div className="text-2xl font-semibold text-emerald-100">{attendanceSummary.present}</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/60">
                  <div className="text-sm text-emerald-200/70">Attendance</div>
                  <div className="text-2xl font-semibold text-emerald-100">{presentPct}%</div>
                </div>
              </div>

              <Separator className="my-4 bg-zinc-800" />

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryBarData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0b1220" />
                    <XAxis dataKey="label" stroke="#9be6c9" />
                    <YAxis allowDecimals={false} stroke="#9be6c9" />
                    <ReTooltip
                      contentStyle={{ background: "#061018", border: `1px solid ${chartStroke}`, borderRadius: 8 }}
                      labelStyle={{ color: "#dfffe8" }}
                      itemStyle={{ color: "#dfffe8" }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={chartFill} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card className="bg-zinc-900 border-zinc-800 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCharts ? (
                <div className="text-zinc-400 text-sm">Loading…</div>
              ) : attendanceRows.length === 0 ? (
                <div className="text-zinc-500 text-sm">No attendance records yet.</div>
              ) : (
                <div className="max-h-56 overflow-auto pr-1 custom-scroll">
                  <ul className="space-y-2 text-sm">
                    <AnimatePresence initial={false}>
                      {attendanceRows
                        .slice()
                        .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
                        .map((r) => (
                          <motion.li
                            key={r.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
                          >
                            <span className="text-emerald-100 text-sm">
                            {new Date(r.date || r.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            })}
                            </span>


                            <span
                              className={
                                r.status === "present"
                                  ? "text-emerald-400"
                                  : r.status === "late"
                                  ? "text-yellow-400"
                                  : "text-rose-400"
                              }
                            >
                              {r.status}
                            </span>
                          </motion.li>
                        ))}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quizzes */}
{/* Quizzes */}
<Card className="bg-zinc-900 border-zinc-800 rounded-2xl">
  <CardHeader>
    <CardTitle className="text-emerald-400 flex items-center gap-2">
      <ClipboardList className="h-5 w-5" />
      Quizzes
    </CardTitle>
  </CardHeader>
  <CardContent>
    {loadingCharts ? (
      <div className="text-zinc-400 text-sm">Loading…</div>
    ) : quizzes.length === 0 ? (
      <div className="text-zinc-500 text-sm">No quizzes available yet.</div>
    ) : (
      <div className="max-h-56 overflow-auto pr-1 custom-scroll">
        <ul className="space-y-2 text-sm">
          <AnimatePresence initial={false}>
          
            {quizzes.map((quiz) => {

                const attempt = quizAttempts.find((qa) => qa.quiz_id === quiz.id);
                const attempted = !!attempt;

                return (
                  <motion.li
                    key={quiz.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-emerald-100 truncate">{quiz.courses?.title || "Quiz"}</span>
                      <span className="text-zinc-500 text-xs">
                        {attempted
                          ? `Attempted on ${fmtDateTime(attempt.created_at)}`
                          : `Available now`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {attempted ? (
                        <Badge className="bg-emerald-600 text-black px-2 py-1 text-xs rounded-md">
                          Score: {attempt.score ?? 0}
                        </Badge>
                      ) : (
                        <Button
                          size="xs"
                          variant="emerald"
                  
                          className="px-2 py-1 text-emerald-100 text-xs"
                          onClick={() => navigate(`/student/quiz/${quiz.id}`)}
                        >
                          Attempt
                        </Button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
          </AnimatePresence>
        </ul>
      </div>
    )}
  </CardContent>
</Card>

        </div>

        {/* Two-column main: Notes | Links */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* NOTES */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="w-full"
          >
            <Card className="bg-zinc-900 border-zinc-800 rounded-2xl w-full overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <FileText className="h-5 w-5 shrink-0" />
                  <span className="truncate">Notes (Markdown)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {/* Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Input
                      placeholder="Note title"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="col-span-1 text-emerald-100 sm:col-span-2 min-w-0"
                    />
                    <Input
                      placeholder="Add a tag and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          setNoteTags((prev) => [...prev, e.currentTarget.value.trim()]);
                          e.currentTarget.value = "";
                        }
                      }}
                      className="min-w-0 text-emerald-100"
                    />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {noteTags.map((tag, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-emerald-500/15 text-emerald-400 cursor-pointer"
                        onClick={() =>
                          setNoteTags((prev) => prev.filter((t, idx) => idx !== i))
                        }
                      >
                        {tag} <span className="ml-2 text-xs">✕</span>
                      </Badge>
                    ))}
                  </div>

                  {/* Tabs */}
                  <Tabs defaultValue="write" className="w-full">
                    <TabsList className="grid grid-cols-2 bg-emerald-400 w-full">
                      <TabsTrigger className="cursor-pointer data-[state=active]:text-white data-[state=active]:bg-black" value="write">Write</TabsTrigger>
                      <TabsTrigger className="cursor-pointer data-[state=active]:text-white data-[state=active]:bg-black" value="preview">Preview</TabsTrigger>
                    </TabsList>

                    <TabsContent value="write" className="space-y-2">
                      <Textarea
                        rows={8}
                        className="font-mono text-emerald-100 resize-y min-h-[160px]"
                        placeholder="Write your note in Markdown…"
                        value={noteMd}
                        onChange={(e) => setNoteMd(e.target.value)}
                      />
                      <div className="flex flex-wrap  gap-2">
                        <Button className="bg-white cursor-pointer hover:bg-emerald-100 text-black" onClick={saveNote} disabled={!noteTitle.trim() || !noteMd.trim()}>
                          <Save className="h-4 w-4 mr-2" /> Save Note
                        </Button>
                        <Button variant="secondary" className="bg-emerald-500 cursor-pointer hover:bg-emerald-400" onClick={() => setAiModalOpen(true)} disabled={aiStreaming || aiLoading}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          {aiStreaming ? "Generating…" : "Add Note with AI"}
                        </Button>
                        <Button  className="bg-red-500 text-white cursor-pointer hover:bg-red-600" onClick={() => { setNoteTitle(""); setNoteMd(""); setNoteTags([]); toast("Cleared editor."); }}>
                          Clear
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="preview">
                      {/* UPDATED: theme matching text color (no black text), and smaller max height on mobile */}
                      <div
                        className="prose prose-invert max-w-full bg-zinc-800/50 rounded-xl p-4 overflow-auto break-words"
                        style={{
                          maxHeight: 300,
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        <style>{`
                          /* Theme-matching markdown text - avoid pure black text */
                          .prose { color: #c7ffe0; }
                          .prose a { color: #7af3b0; }
                          .prose strong { color: #eafff3; }
                          .prose em { color: #bfffe0; }
                          .prose blockquote { border-left-color: rgba(6, 214, 160, 0.2); color: #bfffe0; }
            
                         
                          .prose table { background: transparent; color: #c7ffe0; }
                        `}</style>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                          {noteMd || "_Nothing to preview yet…_"}
                        </ReactMarkdown>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Separator className="my-4 bg-zinc-800" />

                  {/* Saved notes */}
                  <div className="space-y-3">
                    {notes.length === 0 ? (
                      <div className="text-sm text-zinc-500">No notes yet.</div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {notes.map((n) => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-zinc-800/50 rounded-xl"
                          >
                            {editingNoteId === n.id ? (
                              <>
                                <Input className="mb-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                <Textarea rows={6} className="font-mono resize-y min-h-[120px]" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Button size="sm" className="cursor-pointer bg-white hover:bg-emerald-100" onClick={() => updateNote(n.id)}>
                                    <Save className="h-4 w-4 mr-2" /> Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="bg-red cursor-pointer hover:bg-red-600 text-white" onClick={() => setEditingNoteId(null)}>
                                    <X className="h-4 w-4 mr-2" /> Cancel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="min-w-0">
                                    <div className="font-semibold truncate text-emerald-100">{n.title || "Untitled"}</div>
                                    <div className="text-xs text-zinc-400">{fmtDateTime(n.created_at)}</div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" className="bg-amber-600 text-white cursor-pointer hover:bg-amber-700" size="sm" onClick={() => { setEditingNoteId(n.id); setEditTitle(n.title || ""); setEditContent(n.content || ""); }}>
                                      <Edit3 className="h-4 w-4 mr-1" /> Edit
                                    </Button>
                                    <Button className="bg-red-500 cursor-pointer  hover:bg-red-600 text-white" size="sm" onClick={() => deleteNote(n.id)}>
                                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                                    </Button>
                                  </div>
                                </div>

                                <div className="prose prose-invert max-w-full bg-zinc-900/40 rounded-lg p-3 mt-3 overflow-auto break-words" style={{ maxHeight: 220 }}>
                                  <style>{`
                                    .prose { color: #c7ffe0; }
                              
                                  `}</style>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                                    {n.content || ""}
                                  </ReactMarkdown>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* LINKS + QR */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            <Card className="bg-zinc-900 border-zinc-800 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <LinkIcon className="h-5 w-5" />
                  Links & QR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input  placeholder="Link title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="md:col-span-2 text-emerald-100" />
                    <Input className="text-emerald-100" placeholder="Paste or type URL (shows live QR)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={saveLink} className="bg-white text-black cursor-pointer hover:bg-emerald-100" disabled={!linkTitle.trim() || !isValidUrl(linkUrl)}>
                      <Plus className="h-4 w-4" />
                      Save Link
                    </Button>

                    {isValidUrl(linkUrl) && (
                      <>
                        <div className="text-sm text-emerald-200/70">Live QR preview:</div>
                        <div ref={linkQRRef} className="p-2 bg-zinc-800 rounded-xl">
                          <QRCodeCanvas value={linkUrl} size={qrSize} />
                        </div>
                        <Button variant="secondary" className="cursor-pointer" onClick={() => downloadCanvasQR(linkQRRef, "link-qr.png")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download QR
                        </Button>
                      </>
                    )}
                  </div>

                  <Separator className="my-4 bg-zinc-800" />

                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Input placeholder="Search your links…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} className="pr-10 text-emerald-100" />
                      <div className="absolute right-3 top-3 text-zinc-500">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="hidden sm:block text-sm text-zinc-400">{links.length} saved</div>
                  </div>

                  <div className="space-y-3 mt-2">
                    {links
                      .filter(
                        (l) =>
                          l.title?.toLowerCase().includes(linkSearch.toLowerCase()) ||
                          l.url?.toLowerCase().includes(linkSearch.toLowerCase())
                      )
                      .map((l) => (
                        <motion.div
                          key={l.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="p-4 bg-zinc-800/50 rounded-xl flex sm:items-center items-start flex-col sm:flex-row justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate text-emerald-100">{l.title}</div>
                            <a href={l.url} target="_blank" rel="noreferrer" className="text-emerald-400 text-sm break-words">{l.url}</a>
                            <div className="text-xs text-zinc-500 mt-1">{fmtDateTime(l.created_at)}</div>
                          </div>
                          <div className="shrink-0 p-2 bg-zinc-900 rounded-xl">
                            <QRCodeCanvas value={l.url} size={qrSize} />
                          </div>
                        </motion.div>
                      ))}
                    {links.length === 0 && <div className="text-sm text-zinc-500">No links saved yet.</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Assignments */}
        <div className="max-w-7xl mx-auto mt-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-zinc-900 border-zinc-800 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <ClipboardList className="h-5 w-5" />
                  Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <div className="text-sm text-zinc-500">No assignments yet.</div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence initial={false}>
                      {assignments.map((a) => (
                        <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 bg-zinc-800/50 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="font-semibold text-emerald-100">{a.title}</div>
                            <div className="text-sm text-zinc-400">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</div>
                            <div className="text-xs text-zinc-500 mt-2 line-clamp-3">{a.description}</div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" className="bg-emerald-500 cursor-pointer hover:bg-emerald-400" onClick={() => openSubmission(a)}>Submit</Button>
                            <Button size="sm" className="bg-white cursor-pointer text-black hover:bg-emerald-100" onClick={() => { navigator.clipboard?.writeText(a.id?.toString() || ""); toast.success("Assignment ID copied"); }}>
                              Copy ID
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <Separator className="my-6 bg-zinc-800" />

                <div>
                  <div className="text-emerald-400 font-semibold mb-3">Your Submissions</div>
                  {submissions.length === 0 ? (
                    <div className="text-sm text-zinc-500">No submissions yet.</div>
                  ) : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      <AnimatePresence initial={false}>
                        {submissions
                          .filter((s) => assignments.find((a) => a.id === s.assignment_id))
                          .slice()
                          .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                          .map((s) => (
                            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 bg-zinc-800/50 rounded-xl flex sm:items-center items-start flex-col sm:flex-row gap-3 justify-between">
                              <div className="min-w-0">
                                <div className="font-medium truncate text-emerald-100">{s.assignments?.title || "Submission"}</div>
                                <a className="text-emerald-400 text-sm break-words" href={s.file_url} target="_blank" rel="noreferrer">{s.file_url}</a>
                                <div className="text-xs text-zinc-500 mt-1">{fmtDateTime(s.submitted_at)}</div>

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge className="bg-emerald-500/15 text-emerald-400">Grade: {typeof s.grade === "number" ? s.grade : "—"}</Badge>
                                  {s.feedback && <span className="text-xs text-zinc-300 bg-zinc-900/60 px-2 py-1 rounded">{s.feedback}</span>}
                                </div>
                              </div>

                              <div className="shrink-0 p-2 bg-zinc-900 rounded-xl">
                                <QRCodeCanvas value={s.file_url || ""} size={qrSize} />
                              </div>
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Submission dialog */}
        <Dialog open={!!activeAssignment} onOpenChange={() => setActiveAssignment(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-emerald-300">Submit for {activeAssignment?.title || "Assignment"}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <Input className="text-emerald-100 placeholder:text-zinc-400" placeholder="Paste submission file URL (live QR will appear)" value={submissionLink} onChange={(e) => setSubmissionLink(e.target.value)} />
              {isValidUrl(submissionLink) && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-sm text-emerald-200/70">Live QR preview:</div>
                  <div ref={subQRRef} className="p-2 bg-zinc-800 rounded-xl">
                    <QRCodeCanvas value={submissionLink} size={Math.max(qrSize, 140)} />
                  </div>
                  <Button className="cursor-pointer" variant="secondary" onClick={() => downloadCanvasQR(subQRRef, "assignment-submission-qr.png")}>
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex items-center gap-2">
                <Button className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer" onClick={saveSubmission} disabled={!isValidUrl(submissionLink) || savingSubmission}>
                  {savingSubmission ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>Save</>
                  )}
                </Button>
                <Button className="bg-white cursor-pointer hover:bg-emerald-100 text-black" onClick={() => setActiveAssignment(null)}>Cancel</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Modal - prompt + controls + LIVE PREVIEW */}
    <Dialog
  open={aiModalOpen}
  onOpenChange={(v) => {
    if (!aiStreaming && !aiLoading) setAiModalOpen(v);
    else if (v === false && (aiStreaming || aiLoading)) {
      toast("Stop generation before closing.");
    }
  }}
>
  <DialogContent className="bg-zinc-900 border-zinc-800 w-full max-w-2xl">
    <DialogHeader>
      <DialogTitle className="bg-emerald-300">Generate Note with AI</DialogTitle>
    </DialogHeader>

    <div className="grid gap-4">
      <div className="text-sm text-zinc-300">
        Provide a short description of what you want the AI to generate. The AI will produce
        Markdown-formatted study notes for the current course. Use the "Stop" button to cancel streaming at any time.
      </div>

      {/* Prompt and options */}
      <div className="grid gap-3">
        <Input
          placeholder="One-line description / prompt"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          disabled={aiStreaming || aiLoading}
          className="w-full text-emerald-100"
          
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Tone (concise/verbose)"
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value)}
            disabled={aiStreaming || aiLoading}
            className="w-full text-zinc-400"
          />
          <Input
            placeholder="Max tokens"
            value={aiMaxTokens}
            onChange={(e) => setAiMaxTokens(Number(e.target.value || 512))}
            disabled={aiStreaming || aiLoading}
            className="w-full text-zinc-400"
          />
        </div>
      </div>

      {/* Live Generation Area */}
      {(aiStreaming || aiLoading || aiLiveText || aiStatus === "typing" || aiStatus === "done") && (
        <div className="rounded-xl border border-emerald-900/40 bg-zinc-900/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-emerald-300 text-sm">
            {aiStatus === "starting" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Starting…</span>
              </>
            )}
            {aiStatus === "streaming" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="flex items-center gap-1">
                  Generating<span className="inline-block animate-pulse">…</span>
                </span>
              </>
            )}
            {aiStatus === "typing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Typing out the note…</span>
              </>
            )}
            {aiStatus === "done" && (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Done</span>
              </>
            )}
            {aiStatus === "stopped" && (
              <>
                <StopCircle className="h-4 w-4" />
                <span>Stopped</span>
              </>
            )}
            {aiStatus === "error" && (
              <>
                <X className="h-4 w-4" />
                <span className="text-rose-300">Error</span>
              </>
            )}
            <span className="ml-auto text-xs text-zinc-500">Provider: {aiSourceLabel}</span>
          </div>
          <div
            className="prose prose-invert max-w-full p-3 pt-0 overflow-auto break-words"
            style={{ maxHeight: 260 }}
          >
            <style>{`
              .prose { color: #c7ffe0; }
              .typing-cursor::after {
                content: "▍";
                display: inline-block;
                margin-left: 2px;
                animation: blink 1s steps(1) infinite;
              }
              @keyframes blink {
                50% { opacity: 0; }
              }
            `}</style>
            <div className="bg-zinc-950/50 rounded-lg px-3 py-2 max-w-full">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {aiLiveText || "_Nothing yet. Click Start Generation to begin…_"}
              </ReactMarkdown>
              {(aiStreaming || aiStatus === "typing") && <span className="typing-cursor" />}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button className="bg-emerald-500 cursor-pointer hover:bg-emerald-400" onClick={() => startAiGeneration()} disabled={aiStreaming || aiLoading}>
          {aiStreaming || aiLoading ? "Generating…" : "Start Generation"}
        </Button>
        {!aiStreaming && !aiLoading && (
          <Button className="bg-white text-black cursor-pointer hover:bg-emerald-100" onClick={() => setAiModalOpen(false)}>
            Close
          </Button>
        )}
        {(aiStreaming || aiLoading) && (
          <Button variant="destructive" onClick={stopAiGeneration} className="ml-auto">
            <StopCircle className="h-4 w-4 mr-2" /> Stop
          </Button>
        )}
      </div>
    </div>

    <DialogFooter>
      {!aiStreaming && !aiLoading && (
        <Button className="bg-white cursor-pointer" variant="ghost" onClick={() => setAiModalOpen(false)}>Close</Button>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>

        <div className="h-8" />
      </div>

      
    </>
  );
}
