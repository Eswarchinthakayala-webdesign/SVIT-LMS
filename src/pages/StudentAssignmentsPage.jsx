
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

// shadcn/ui components
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
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton"; // shimmer loading

// recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// icons (lucide-react)
import {
  ClipboardList,
  BookOpen,
  Search,
  Upload,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  QrCode,
  Download,
} from "lucide-react";

import QRCode from "react-qr-code";
import * as htmlToImage from "html-to-image";

/* ----------------------------------------------------
   Utility Hooks
---------------------------------------------------- */

// Responsive hook (detects device size)
function useResponsive() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return { isMobile };
}

// Toast hook placeholder (could integrate with shadcn/ui Toast)
function useToast() {
  const [messages, setMessages] = useState([]);
  const push = (msg) => setMessages((m) => [...m, msg]);
  const clear = () => setMessages([]);
  return { messages, push, clear };
}

/* ----------------------------------------------------
   Main Page Component
---------------------------------------------------- */
export default function StudentAssignmentsPage() {
  // ------------------- State -------------------
  const [userId, setUserId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  // submit/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAssignment, setModalAssignment] = useState(null);
  const [submissionLink, setSubmissionLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // QR modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLink, setQrLink] = useState("");
  const qrRef = useRef(null);

  // notice
  const [notice, setNotice] = useState("");

  const { isMobile } = useResponsive();
  const toast = useToast();
  const navigate = useNavigate();

  // ------------------- Fetch Data -------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        // Enrolled courses
        const { data: enrolledCourses, error: cErr } = await supabase
          .from("enrollments")
          .select("course_id, courses(id, title)")
          .eq("student_id", user.id);

        if (cErr || !enrolledCourses?.length) {
          setAssignments([]);
          setSubmissions([]);
          return;
        }

        const courseIds = enrolledCourses.map((e) => e.course_id);

        // Assignments
        const { data: assignmentsData } = await supabase
          .from("assignments")
          .select("id, title, description, due_date, course_id, courses(title)")
          .in("course_id", courseIds)
          .order("due_date", { ascending: true });

        setAssignments(assignmentsData || []);

        // Submissions
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user.id);

        setSubmissions(submissionsData || []);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ------------------- Derived -------------------
  const merged = useMemo(() => {
    const byAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));
    return (assignments || []).map((a) => ({
      ...a,
      submission: byAssignment.get(a.id) || null,
    }));
  }, [assignments, submissions]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return merged;
    return merged.filter((a) => {
      const t = (a.title || "").toLowerCase();
      const c = (a.courses?.title || "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [merged, q]);

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const isBeforeDue = (due) => {
    if (!due) return true;
    return new Date() < new Date(due);
  };

  const submittedRows = filtered.filter((a) => a.submission);
  const pendingRows = filtered.filter((a) => !a.submission);

  // ------------------- Analytics -------------------
  const analyticsData = useMemo(() => {
    const m = new Map();
    for (const a of merged) {
      const key = a.due_date ? new Date(a.due_date) : null;
      const day =
        key ? new Date(key.getFullYear(), key.getMonth(), key.getDate()) : null;
      const label = day ? day.toISOString().slice(0, 10) : "No Due";
      if (!m.has(label)) m.set(label, { date: label, total: 0, submitted: 0 });
      const row = m.get(label);
      row.total += 1;
      if (a.submission) row.submitted += 1;
    }
    return Array.from(m.values()).map((r) => ({
      ...r,
      notSubmitted: Math.max(0, r.total - r.submitted),
    }));
  }, [merged]);

  // ------------------- Handlers -------------------
  const openSubmitModal = (assignment) => {
    setModalAssignment(assignment);
    setSubmissionLink(assignment?.submission?.file_url || "");
    setModalOpen(true);
    setNotice("");
  };

  const handleSaveSubmission = async () => {
    if (!userId || !modalAssignment) return;
    if (!submissionLink) {
      setNotice("Please paste a valid link to your work.");
      return;
    }
    if (!isBeforeDue(modalAssignment.due_date)) {
      setNotice("The due date has passed.");
      return;
    }
    setSubmitting(true);
    try {
      const existing = modalAssignment.submission;
      if (existing) {
        await supabase
          .from("submissions")
          .update({ file_url: submissionLink })
          .eq("id", existing.id)
          .eq("student_id", userId);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === existing.id ? { ...s, file_url: submissionLink } : s
          )
        );
      } else {
        const { data } = await supabase
          .from("submissions")
          .insert({
            assignment_id: modalAssignment.id,
            student_id: userId,
            file_url: submissionLink,
          })
          .select()
          .single();
        setSubmissions((prev) => [data, ...prev]);
      }
      toast.push("Submission saved.");
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setNotice("Error saving submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmission = async (assignment) => {
    if (!assignment?.submission) return;
    if (!isBeforeDue(assignment.due_date)) {
      setNotice("Due passed.");
      return;
    }
    try {
      await supabase
        .from("submissions")
        .delete()
        .eq("id", assignment.submission.id)
        .eq("student_id", userId);
      setSubmissions((prev) =>
        prev.filter((s) => s.id !== assignment.submission.id)
      );
    } catch (err) {
      console.error(err);
      setNotice("Delete failed.");
    }
  };

  const openQrModal = (link) => {
    setQrLink(link);
    setQrModalOpen(true);
  };

  const handleDownloadQr = async () => {
    if (!qrRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(qrRef.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "assignment-qr.png";
      a.click();
    } catch (err) {
      console.error("QR download error:", err);
    }
  };

  // ------------------- Render -------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <Header query={query} setQuery={setQuery} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* All Assignments */}
          <AssignmentsCard
            filtered={filtered}
            fmtDate={fmtDate}
            openSubmitModal={openSubmitModal}
            handleDeleteSubmission={handleDeleteSubmission}
            isBeforeDue={isBeforeDue}
          />

          {/* Analytics */}
          <AnalyticsCard analyticsData={analyticsData} />

          {/* Submitted */}
          <SubmittedCard
            submittedRows={submittedRows}
            fmtDate={fmtDate}
            isBeforeDue={isBeforeDue}
            openSubmitModal={openSubmitModal}
            handleDeleteSubmission={handleDeleteSubmission}
            openQrModal={openQrModal}
          />
        </div>
      </div>

      {/* QR Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">QR Code</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Scan or download this QR to access your submission link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div ref={qrRef} className="bg-white p-4 rounded-lg">
              {qrLink && <QRCode value={qrLink} size={200} />}
            </div>
            <Button
              onClick={handleDownloadQr}
              className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer text-black flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Download QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Modal */}
      <SubmitModal
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        modalAssignment={modalAssignment}
        submissionLink={submissionLink}
        setSubmissionLink={setSubmissionLink}
        notice={notice}
        handleSaveSubmission={handleSaveSubmission}
        submitting={submitting}
      />
    </div>
  );
}

/* ----------------------------------------------------
   Header Component
---------------------------------------------------- */
function Header({ query, setQuery }) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-emerald-400/10 to-cyan-400/6 p-2 rounded"
        >
          <ClipboardList className="h-7 w-7 text-emerald-300" />
        </motion.div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Assignments</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Submit your work, track status, and view analytics
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="w-full md:w-96">
        <div className="flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2 border border-zinc-800">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assignments or courses..."
            className="bg-transparent grow outline-none text-sm placeholder:text-zinc-500 text-zinc-100"
            aria-label="Search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-zinc-400 text-sm p-1"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------
   Assignments Card
---------------------------------------------------- */
function AssignmentsCard({
  filtered,
  fmtDate,
  openSubmitModal,
  handleDeleteSubmission,
  isBeforeDue,
}) {
  return (
    <Card className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <CardHeader className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-emerald-300" />
          <CardTitle className="text-emerald-300 text-lg">
            All Assignments
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveTable
          headers={["Title", "Course", "Due Date", "Status", "Action"]}
          rows={filtered.map((a) => ({
            key: a.id,
            cells: [
              <div className="font-medium">{a.title}</div>,
              <div>{a.courses?.title || "—"}</div>,
              <div>{fmtDate(a.due_date)}</div>,
              a.submission ? (
                <span className="flex items-center gap-1 text-emerald-400 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </span>
              ) : (
                <span className="flex items-center gap-1 text-zinc-400 text-sm">
                  <XCircle className="h-4 w-4" />
                  Pending
                </span>
              ),
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black"
                  onClick={() => openSubmitModal(a)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {a.submission ? "Edit" : "Submit"}
                </Button>
                {a.submission && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700 cursor-pointer hover:bg-red-800/50"
                    onClick={() => handleDeleteSubmission(a)}
                    disabled={!isBeforeDue(a.due_date)}
                    title={
                      isBeforeDue(a.due_date)
                        ? "Delete submission"
                        : "Due passed – cannot delete"
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>,
            ],
            labels: ["Title", "Course", "Due", "Status", "Action"],
          }))}
          emptyMessage="No assignments found"
        />
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------
   Analytics Card
---------------------------------------------------- */
function AnalyticsCard({ analyticsData }) {
  return (
    <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <CardHeader className="p-6">
        <CardTitle className="text-emerald-300 text-lg">
          Submission Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-6">
        {analyticsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={analyticsData}
              margin={{ left: 10, right: 20, top: 10 }}
            >
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
              <Legend />
              <Line
                type="monotone"
                dataKey="submitted"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="notSubmitted"
                stroke="#7dd3fc"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-500 text-center">No analytics available</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------
   Submitted Card
---------------------------------------------------- */
function SubmittedCard({
  submittedRows,
  fmtDate,
  isBeforeDue,
  openSubmitModal,
  handleDeleteSubmission,
  openQrModal,
}) {
  return (
    <Card className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <CardHeader className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <QrCode className="h-5 w-5 text-emerald-300" />
          <CardTitle className="text-emerald-300 text-lg">
            Submitted Assignments
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveTable
          headers={[
            "Title",
            "Course",
            "Link",
            "QR",
            "Submitted At",
            "Grade / Feedback",
            "Action",
          ]}
          rows={submittedRows.map((a) => ({
            key: `sub-${a.id}`,
            cells: [
              <div className="font-medium">{a.title}</div>,
              <div>{a.courses?.title || "—"}</div>,
              a.submission?.file_url ? (
                <a
                  href={a.submission.file_url}
                  className="text-emerald-300 underline inline-flex items-center gap-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                "—"
              ),
              a.submission?.file_url ? (
                <div
                  className="bg-white p-1 rounded-md inline-flex cursor-pointer"
                  onClick={() => openQrModal(a.submission.file_url)}
                >
                  <QRCode value={a.submission.file_url} size={64} />
                </div>
              ) : (
                "—"
              ),
              <div>
                {a.submission?.submitted_at
                  ? new Date(a.submission.submitted_at).toLocaleString()
                  : "—"}
              </div>,
              <div className="text-sm text-zinc-300">
                {a.submission?.grade != null ? (
                  <>
                    <span className="font-semibold">Grade:</span>{" "}
                    {a.submission.grade}
                    {a.submission.feedback && (
                      <>
                        {" "}
                        <span className="font-semibold">· Feedback:</span>{" "}
                        {a.submission.feedback}
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-400">
                    Awaiting grading by admin
                  </span>
                )}
              </div>,
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 cursor-pointer hover:bg-emerald-800/50"
                  onClick={() => openSubmitModal(a)}
                  disabled={!isBeforeDue(a.due_date)}
                  title={
                    isBeforeDue(a.due_date)
                      ? "Edit link"
                      : "Due passed – cannot edit"
                  }
                >
                  <Edit className="h-4 w-4 text-emerald-400" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 cursor-pointer hover:bg-red-800/50"
                  onClick={() => handleDeleteSubmission(a)}
                  disabled={!isBeforeDue(a.due_date)}
                  title={
                    isBeforeDue(a.due_date)
                      ? "Delete submission"
                      : "Due passed – cannot delete"
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>,
            ],
            labels: [
              "Title",
              "Course",
              "Link",
              "QR",
              "Submitted",
              "Grade / Feedback",
              "Action",
            ],
          }))}
          emptyMessage="No submissions yet"
        />
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------
   Submit Modal
---------------------------------------------------- */
function SubmitModal({
  modalOpen,
  setModalOpen,
  modalAssignment,
  submissionLink,
  setSubmissionLink,
  notice,
  handleSaveSubmission,
  submitting,
}) {
  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-300">
            {modalAssignment?.submission ? "Edit Submission" : "Submit Assignment"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Paste the URL to your work. Grades are provided by admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-300">Assignment:</span>{" "}
            {modalAssignment?.title}{" "}
            {modalAssignment?.courses?.title
              ? `· ${modalAssignment.courses.title}`
              : ""}
          </div>

          <Input
            placeholder="https://..."
            value={submissionLink}
            onChange={(e) => setSubmissionLink(e.target.value)}
            className="bg-zinc-900/70 border-zinc-800"
          />
          {notice && <p className="text-sm text-emerald-300">{notice}</p>}
          <p className="text-xs text-zinc-500">
            You can edit or delete your submission until the due date.
          </p>
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button
            variant="outline"
            className="border-zinc-700 text-black cursor-pointer"
            onClick={() => setModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSubmission}
            className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black"
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------
   Responsive Table
---------------------------------------------------- */
function ResponsiveTable({ headers, rows, emptyMessage }) {
  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 cursor-pointer hover:bg-emerald-600/10 bg-gray-950/60">
              {headers.map((h, i) => (
                <TableHead key={i} className="text-zinc-400">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r) => (
                <TableRow
                  key={r.key}
                  className="border-zinc-800 cursor-pointer hover:bg-zinc-800/40"
                >
                  {r.cells.map((c, i) => (
                    <TableCell key={i} className="text-zinc-300">
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="text-center text-zinc-500 p-6"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-zinc-800">
        {rows.length ? (
          rows.map((r) => (
            <div
              key={r.key}
              className="grid grid-cols-1 gap-3 p-4 bg-zinc-900/40"
            >
              {r.cells.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-xs uppercase tracking-wide text-zinc-500">
                    {r.labels?.[i] || headers[i]}
                  </span>
                  <div className="text-sm text-zinc-200 text-right">{c}</div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-zinc-500">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}
