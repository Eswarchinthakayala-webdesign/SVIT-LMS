// src/pages/StudentQuizPage.jsx
// -----------------------------------------------------------------------------
// StudentQuizPage (Pro single-file, verbose, self-contained)
// - Keeps your original theme, UI, and cursors intact
// - Robust score parsing (JSON-first, fallback to text)
// - One attempt enforced per quiz (student)
// - Grouped by course, quizzes labeled Quiz 1/2/3 by created_at ascending
// - Take quiz modal (records JSON payload {score, answers})
// - Attempt review modal with user answers vs correct answers highlighted
// - KPIs, progress bars and attempted grid unchanged visually
// - Accessibility improvements and additional error handling
// - Everything is in one file (helpers, small components, styles) as requested
// -----------------------------------------------------------------------------


import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// shadcn/ui components (project-specific imports)
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// icons
import {
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Play,
  Eye,
  Calendar,
  ArrowLeft,
} from "lucide-react";

/* =============================================================================
   Constants & Small Utilities
   ============================================================================= */

/** Sleep helper for lightweight simulated delay (useful for UX) */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Safely parse a stored score field coming from DB.
 * We expect either:
 *  - A JSON string containing { score: "X/Y", answers: [...] }
 *  - A plain string like "X/Y" (legacy)
 *  - Or something else (we gracefully fallback)
 *
 * Returns { display: string, parsed: object|null }
 */
function safeParseScoreField(scoreField) {
  if (scoreField == null) return { display: "—", parsed: null };
  // If it's already an object, assume it matches our shape
  if (typeof scoreField === "object") {
    try {
      if (scoreField.score) return { display: String(scoreField.score), parsed: scoreField };
      return { display: JSON.stringify(scoreField), parsed: scoreField };
    } catch {
      return { display: "—", parsed: null };
    }
  }
  // If string, try JSON.parse first
  if (typeof scoreField === "string") {
    const trimmed = scoreField.trim();
    if (!trimmed) return { display: "—", parsed: null };
    // Heuristic: JSON strings start with { or [
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.score) return { display: String(parsed.score), parsed };
        // If parsed but no score key, show pretty string
        return { display: JSON.stringify(parsed), parsed };
      } catch {
        // fallthrough to plain string display
      }
    }
    // fallback: treat as legacy plain text
    return { display: trimmed, parsed: null };
  }
  // final fallback: stringified
  try {
    return { display: String(scoreField), parsed: null };
  } catch {
    return { display: "—", parsed: null };
  }
}

/** Format a date/time nicely */
function fmtDateTime(dt) {
  try {
    if (!dt) return "—";
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

/** Extract user id from supabase auth response safely */
async function getCurrentUserId() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/* =============================================================================
   Main Page Component
   ============================================================================= */

export default function QuizPage() {
  const navigate = useNavigate();

  // Data state
  const [userId, setUserId] = useState(null);
  const [allQuizzes, setAllQuizzes] = useState([]); // flat quiz list
  const [coursesMap, setCoursesMap] = useState({}); // { courseId: { id, title, quizzes: [] } }
  const [quizScores, setQuizScores] = useState([]); // student's quiz_scores rows

  // UI state
  const [search, setSearch] = useState("");
  const [leftOpenCourses, setLeftOpenCourses] = useState({}); // expand/collapse
  const [activeQuiz, setActiveQuiz] = useState(null); // object of quiz being taken
  const [answers, setAnswers] = useState({}); // { index: optionString }
  const [submitting, setSubmitting] = useState(false);

  const [viewDetail, setViewDetail] = useState(null); // { quiz, scoreRow }
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // refs
  const firstOptionRef = useRef(null);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Fetch data: enrolled courses -> quizzes -> quiz_scores for current user
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        // 1) ensure auth user
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid) {
          setErrorMessage("Not authenticated.");
          setLoading(false);
          return;
        }
        setUserId(uid);

        // 2) fetch enrollments for the student to limit quizzes
        const { data: enrolledData, error: enrollErr } = await supabase
          .from("enrollments")
          .select("course_id, courses(id, title)")
          .eq("student_id", uid);

        if (enrollErr) {
          console.error("enrollErr:", enrollErr);
          setErrorMessage("Failed to fetch your enrolled courses.");
          setLoading(false);
          return;
        }

        const courseIds = (enrolledData || []).map((r) => r.course_id);
        if (!courseIds.length) {
          // no enrolled courses -> no quizzes
          setAllQuizzes([]);
          setCoursesMap({});
          setQuizScores([]);
          setLoading(false);
          return;
        }

        // 3) fetch quizzes for these course ids with course metadata
        const { data: quizzesData, error: quizzesErr } = await supabase
          .from("quizzes")
          .select("id, course_id, questions, created_at, courses(id, title)")
          .in("course_id", courseIds)
          .order("created_at", { ascending: true }); // earliest => Quiz 1

        if (quizzesErr) {
          console.error("quizzesErr:", quizzesErr);
        }

        // 4) fetch existing quiz_scores for this student
        const { data: scoresData, error: scoresErr } = await supabase
          .from("quiz_scores")
          .select("*")
          .eq("student_id", uid);

        if (scoresErr) {
          console.error("scoresErr:", scoresErr);
        }

        // Prepare grouping by course
        const quizzes = quizzesData || [];
        const scores = scoresData || [];

        const map = {};
        for (const q of quizzes) {
          const course = q.courses || { id: q.course_id, title: "Course" };
          if (!map[course.id]) map[course.id] = { id: course.id, title: course.title, quizzes: [] };
          map[course.id].quizzes.push(q);
        }
        // Sort each course's quizzes by created_at ascending
        for (const cid of Object.keys(map)) {
          map[cid].quizzes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        if (!mountedRef.current) return;
        setAllQuizzes(quizzes);
        setCoursesMap(map);
        setQuizScores(scores);

        // open all by default (you can change behavior later)
        const open = {};
        Object.keys(map).forEach((cid) => (open[cid] = true));
        setLeftOpenCourses(open);
      } catch (err) {
        console.error("Unexpected error loading quizzes:", err);
        setErrorMessage("Unexpected error while loading quizzes.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------
  const attemptedSet = useMemo(() => new Set((quizScores || []).map((r) => r.quiz_id)), [quizScores]);

  const labelForQuiz = (quiz) => {
    if (!quiz) return "Quiz";
    const courseQuizzes =
      (coursesMap[quiz.course_id] && coursesMap[quiz.course_id].quizzes) ||
      allQuizzes.filter((q) => q.course_id === quiz.course_id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const idx = courseQuizzes.findIndex((q) => q.id === quiz.id);
    return idx >= 0 ? `Quiz ${idx + 1}` : "Quiz";
  };

  // Filtered map according to search string
  const filteredCoursesMap = useMemo(() => {
    if (!search) return coursesMap;
    const out = {};
    for (const [cid, courseObj] of Object.entries(coursesMap)) {
      const titleLower = (courseObj.title || "").toLowerCase();
      const matched = courseObj.quizzes.filter((q) => {
        const qtext = (q.questions || []).map((qq) => qq.question).join(" ").toLowerCase();
        return titleLower.includes(search.toLowerCase()) || qtext.includes(search.toLowerCase()) || labelForQuiz(q).toLowerCase().includes(search.toLowerCase());
      });
      if (matched.length > 0) out[cid] = { ...courseObj, quizzes: matched };
    }
    return out;
  }, [coursesMap, search, allQuizzes]);

  // ---------------------------------------------------------------------------
  // Handlers: open quiz / pick answer / submit / open review
  // ---------------------------------------------------------------------------
  function openQuizForTaking(quiz) {
    // If attempted already, open review instead of taking
    if (attemptedSet.has(quiz.id)) {
      const scoreRow = quizScores.find((s) => s.quiz_id === quiz.id);
      setViewDetail({ quiz, scoreRow });
      return;
    }
    setActiveQuiz(quiz);
    setAnswers({});
    // small UX: focus first option after a tick so dialog content renders
    setTimeout(() => {
      try {
        if (firstOptionRef.current) firstOptionRef.current.focus?.();
      } catch {}
    }, 180);
  }

  function handlePick(qIndex, opt) {
    setAnswers((prev) => ({ ...prev, [qIndex]: opt }));
  }

async function handleSubmitQuiz() {
  if (!activeQuiz) return;
  setSubmitting(true);
  try {
    let uid = userId;
    if (!uid) {
      uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      setUserId(uid);
    }

    const questions = activeQuiz.questions || [];
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const selected = answers[i];
      if (selected && selected === q.answer) correctCount++;
    }

    const scoreText = `${correctCount}/${questions.length}`;

    // ✅ Insert only score (string), no JSON payload
    const { data: inserted, error: insertErr } = await supabase
      .from("quiz_scores")
      .insert({
        quiz_id: activeQuiz.id,
        student_id: uid,
        score: scoreText, // <-- plain text only
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert quiz score error:", insertErr);
      throw insertErr;
    }

    setQuizScores((prev) => [inserted, ...(prev || [])]);

    setActiveQuiz(null);
    setAnswers({});
  } catch (err) {
    console.error("Submit quiz failed:", err);
    setErrorMessage("Failed to submit quiz. Please try again.");
  } finally {
    setSubmitting(false);
  }
}


  function openReview(quizId) {
    const quiz = allQuizzes.find((q) => q.id === quizId) || null;
    const scoreRow = (quizScores || []).find((s) => s.quiz_id === quizId) || null;
    if (!quiz || !scoreRow) return;
    setViewDetail({ quiz, scoreRow });
  }

  function closeViewDetail() {
    setViewDetail(null);
  }

  // ---------------------------------------------------------------------------
  // Small presentational components inside same file (single-file delivery)
  // ---------------------------------------------------------------------------
  function Header() {
    return (
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-emerald-300" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-emerald-300">Quizzes</h1>
            <p className="text-xs text-zinc-400 hidden md:block">Take quizzes assigned to your courses</p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 cursor-pointer bg-emerald-400 text-black hover:bg-emerald-300"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </motion.header>
    );
  }

  function LoadingSkeleton() {
    return (
      <div className="space-y-2 animate-pulse p-4">
        <div className="h-6 bg-black/40 rounded w-3/5" />
        <div className="h-4 bg-black/40 rounded w-1/2" />
        <div className="h-28 bg-black/40 rounded" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --------------------------------------------------------------------- */}
        {/* LEFT: Courses & Quizzes (sidebar) */}
        {/* --------------------------------------------------------------------- */}
        <aside className="lg:col-span-1">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-md">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-emerald-300" />
                <CardTitle className="text-emerald-300">Quizzes by Course</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-3">
              <div className="mb-3">
                <Input
                  placeholder="Search courses, quizzes, or questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-900/50 text-emerald-100 text-sm"
                />
              </div>

              {loading ? (
                <>
                  <LoadingSkeleton />
                  <Separator className="my-3" />
                  <LoadingSkeleton />
                </>
              ) : (
                <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-2">
                  {Object.keys(filteredCoursesMap).length === 0 ? (
                    <div className="p-6 text-center text-zinc-500">No quizzes available</div>
                  ) : (
                    Object.values(filteredCoursesMap).map((course) => (
                      <div key={course.id}>
                        <div
                          className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-zinc-900/30"
                          onClick={() => setLeftOpenCourses((prev) => ({ ...prev, [course.id]: !prev[course.id] }))}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setLeftOpenCourses((prev) => ({ ...prev, [course.id]: !prev[course.id] }));
                            }
                          }}
                        >
                          <div>
                            <div className="font-medium text-emerald-400">{course.title}</div>
                            <div className="text-xs text-zinc-400">{course.quizzes.length} quizzes</div>
                          </div>
                          <div className="text-zinc-400">
                            {leftOpenCourses[course.id] ? <ChevronUp className="h-4 w-4 cursor-pointer" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {leftOpenCourses[course.id] && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="mt-2 space-y-2"
                            >
                              {course.quizzes.map((q, idx) => {
                                const label = `Quiz ${idx + 1}`;
                                const attempted = attemptedSet.has(q.id);
                                return (
                                  <li key={q.id}>
                                    <div className="flex items-center justify-between p-2 rounded-md bg-zinc-900/20 hover:bg-zinc-900/30">
                                      <div>
                                        <div className="text-sm font-medium text-emerald-100">{label}</div>
                                        <div className="text-xs text-zinc-400 flex items-center gap-2">
                                          <Calendar className="h-3 w-3" />
                                          <span>{new Date(q.created_at).toLocaleDateString()}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <div className={`text-xs px-2 py-1 rounded ${attempted ? "bg-emerald-900/20 text-emerald-300" : "bg-zinc-900/10 text-zinc-400"}`}>
                                          {attempted ? "Attempted" : "Not attempted"}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-zinc-700 cursor-pointer hover:bg-zinc-800/40"
                                            onClick={() => openQuizForTaking(q)}
                                            aria-label={attempted ? `View ${label}` : `Take ${label}`}
                                          >
                                            {attempted ? <Eye className="h-4 w-4 text-amber-500" /> : <Play className="h-4 w-4 text-emerald-500" />}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* --------------------------------------------------------------------- */}
        {/* RIGHT: Analytics + Attempted Grid */}
        {/* --------------------------------------------------------------------- */}
        <main className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Total Quizzes</div>
                  <div className="text-2xl text-emerald-200 font-bold">{allQuizzes.length}</div>
                </div>
                <div className="text-emerald-300">
                  <ClipboardList className="h-7 w-7" />
                </div>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div>
                <div className="text-xs text-zinc-400">Attempted</div>
                <div className="text-2xl text-emerald-200 font-bold">{quizScores.length}</div>
                <div className="mt-2 text-xs text-zinc-400">View details in Attempted list</div>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div>
                <div className="text-xs text-zinc-400">Not Attempted</div>
                <div className="text-2xl text-emerald-200 font-bold">{Math.max(0, allQuizzes.length - quizScores.length)}</div>
                <div className="mt-2 text-xs text-zinc-400">Use the left panel to start</div>
              </div>
            </Card>
          </div>

          {/* Attempt overview bars */}
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-emerald-300">Attempt Overview</CardTitle>
              <div className="text-xs text-zinc-400">Summary</div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="text-xs text-zinc-400">Attempted</div>
              <div className="flex items-center gap-4">
                <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full  bg-emerald-500"
                    style={{ width: `${allQuizzes.length === 0 ? 0 : (quizScores.length / allQuizzes.length) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right text-emerald-500 text-sm font-semibold">
                  {allQuizzes.length === 0 ? "0%" : `${Math.round((quizScores.length / allQuizzes.length) * 100)}%`}
                </div>
              </div>

              <div className="text-xs text-zinc-400">Not Attempted</div>
              <div className="flex items-center gap-4">
                <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-red-400"
                    style={{ width: `${allQuizzes.length === 0 ? 0 : ((allQuizzes.length - quizScores.length) / allQuizzes.length) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right text-red-500 text-sm font-semibold">
                  {allQuizzes.length === 0 ? "0%" : `${Math.round(((allQuizzes.length - quizScores.length) / allQuizzes.length) * 100)}%`}
                </div>
              </div>
            </div>
          </Card>

          {/* Attempted quizzes grid */}
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-emerald-300">Attempted Quizzes</CardTitle>
              <div className="text-xs text-zinc-400">Review your attempts</div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizScores.length === 0 ? (
                <div className="col-span-full text-zinc-400 text-center p-6">No attempted quizzes yet</div>
              ) : (
                quizScores.map((scoreRow) => {
                  const quiz = allQuizzes.find((q) => q.id === scoreRow.quiz_id) || { course_id: scoreRow.quiz_id };
                  const parsed = safeParseScoreField(scoreRow.score);
                  // compute percent if possible
                  let percent = null;
                  if (parsed.parsed && parsed.parsed.score) {
                    const [num, den] = String(parsed.parsed.score).split("/").map((x) => Number(x));
                    if (!Number.isNaN(num) && !Number.isNaN(den) && den > 0) {
                      percent = Math.round((num / den) * 100);
                    }
                  }

                  return (
                    <motion.div key={scoreRow.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-emerald-300">{quiz.courses?.title || "Course"}</div>
                          <div className="font-semibold text-gray-200 mt-1">{labelForQuiz(quiz)}</div>
                          <div className="text-xs text-zinc-400 mt-1">Submitted: {fmtDateTime(scoreRow.created_at)}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-300">{parsed.display}</div>
                          {percent != null && (
                            <div className="mt-2 flex items-center gap-2 justify-end">
                              <div className="w-28 bg-zinc-800 h-2 rounded overflow-hidden">
                                <div className="h-2 bg-emerald-500" style={{ width: `${percent}%` }} />
                              </div>
                              <div className="text-sm text-zinc-300 font-medium">{percent}%</div>
                            </div>
                          )}
                          <div className="mt-2 flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer hover:bg-zinc-800/40" onClick={() => openReview(quiz.id)}>
                              <Eye className="h-4 w-4 text-amber-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </main>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Active Quiz Modal (Take quiz) */}
      {/* --------------------------------------------------------------------- */}
      <Dialog
        open={!!activeQuiz}
        onOpenChange={(open) => {
          if (!open) {
            setActiveQuiz(null);
            setAnswers({});
          }
        }}
      >
        <DialogContent className="max-w-3xl bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">{activeQuiz?.courses?.title || "Quiz"}</DialogTitle>
            <DialogDescription className="text-zinc-400">Only one attempt allowed. Answer all questions and submit to record your score.</DialogDescription>
          </DialogHeader>

          <div className="py-4 px-2 max-h-[60vh] overflow-y-auto space-y-4">
            {(activeQuiz?.questions || []).map((q, i) => (
              <div key={i} className="bg-zinc-900/40 p-4 rounded-md">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">Q{i + 1}. {q.question}</div>
                    <div className="text-xs text-zinc-500 mt-1">Select one option</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(q.options || []).map((opt, oi) => {
                    const selected = answers[i] === opt;
                    return (
                      <button
                        key={oi}
                        onClick={() => handlePick(i, opt)}
                        ref={i === 0 && oi === 0 ? firstOptionRef : undefined}
                        className={`text-left px-3 py-2 rounded-lg border w-full ${selected ? "bg-emerald-500 text-black border-emerald-600" : "bg-zinc-900/20 border-zinc-800 hover:bg-zinc-900/30"}`}
                        aria-pressed={selected}
                      >
                        <div className="text-sm">{opt}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {errorMessage && (
              <div className="text-sm text-red-400 p-2 rounded bg-red-900/10">{errorMessage}</div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 p-4">
            <Button variant="outline" onClick={() => { setActiveQuiz(null); setAnswers({}); }} className="border-zinc-700 text-black cursor-pointer">Cancel</Button>
            <Button onClick={handleSubmitQuiz} className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* Review Modal (view attempt details) */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={!!viewDetail} onOpenChange={() => setViewDetail(null)}>
        <DialogContent className="max-w-4xl bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">{viewDetail?.quiz?.courses?.title || "Quiz"} - Attempt Review</DialogTitle>
            <DialogDescription className="text-zinc-400">Your selected answers are shown and the correct answer is highlighted.</DialogDescription>
          </DialogHeader>

          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
            {viewDetail?.quiz?.questions?.map((q, i) => {
              const row = viewDetail.scoreRow;
              let parsed = null;
              try {
                parsed = row && row.score ? JSON.parse(row.score) : null;
              } catch {
                parsed = null;
              }
              const userChoice = parsed?.answers ? parsed.answers[i] : null;

              return (
                <div key={i} className="bg-zinc-900/40 p-4 rounded-md">
                  <div className="font-medium">Q{i + 1}. {q.question}</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt, oi) => {
                      const isCorrect = opt === q.answer;
                      const isUser = opt === userChoice;
                      const base = isCorrect ? "border-emerald-500 text-emerald-300 bg-emerald-900/10" : "border-zinc-700 text-zinc-300";
                      const userBg = isUser && !isCorrect ? "bg-red-900/10 border-red-600 text-red-300" : "";
                      return (
                        <div key={oi} className={`px-3 py-2 rounded-lg border ${base} ${isUser && !isCorrect ? userBg : ""}`}>
                          <div className="flex items-center justify-between">
                            <div>{opt}</div>
                            <div className="ml-2">
                              {isCorrect && <CheckCircle className="h-4 w-4 text-emerald-300" />}
                              {isUser && !isCorrect && <XCircle className="h-4 w-4 text-red-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="p-4">
            <Button onClick={() => setViewDetail(null)} className="bg-zinc-800 cursor-pointer hover:bg-zinc-700">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
