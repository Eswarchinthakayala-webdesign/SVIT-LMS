// src/pages/AdminCalendarPage.jsx
// -----------------------------------------------------------------------------
// Admin Calendar Page (Google Calendar–like)
// - Month / Week views
// - Left: calendar grid with events & assignments
// - Right: agenda list
// - Supports: create, edit, delete events
// - Public events are visible to all students
// - Theming: emerald / zinc / black, animated, responsive
// - Uses the same design & responsive behavior as the student CalendarPage
//   (mobile toolbar, responsive grid, cursor-pointer on all interactive buttons)
// -----------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Calendar as CalendarIcon,
  BookOpen,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit,
  Trash,
  ClipboardList,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
} from "date-fns";

// -----------------------------------------------------------------------------
// Helpers & Theme
// -----------------------------------------------------------------------------
const EVENT_COLORS = {
  assignment: { bg: "bg-emerald-600/20", text: "text-emerald-300", border: "border-emerald-600" },
  exam: { bg: "bg-rose-600/20", text: "text-rose-300", border: "border-rose-600" },
  meeting: { bg: "bg-violet-600/20", text: "text-violet-300", border: "border-violet-600" },
  reminder: { bg: "bg-yellow-600/20", text: "text-yellow-300", border: "border-yellow-600" },
  default: { bg: "bg-zinc-700/20", text: "text-zinc-200", border: "border-zinc-700" },
};
function eventStyle(e) {
  return EVENT_COLORS[e?.event_type] || EVENT_COLORS.default;
}
function safeParseDate(d) {
  if (!d) return null;
  try {
    return typeof d === "string" ? parseISO(d) : new Date(d);
  } catch {
    return new Date(d);
  }
}
function truncate(s, n = 60) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function AdminCalendarPage() {
  const [courses, setCourses] = useState([]);
  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    event_type: "reminder",
    start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    visibility: "public",
    course_id: "private",
  });

  const topRef = useRef(null);

  // Load courses + initial data
  useEffect(() => {
    fetchCourses();
  }, []);
  useEffect(() => {
    fetchWindowData(currentDate);
  }, [currentDate, view]);

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id, title");
      if (error) throw error;
      setCourses((data || []).map((c) => ({ ...c, id: String(c.id) })));
    } catch (err) {
      console.error("fetchCourses", err);
      toast.error("Failed to load courses");
    }
  }

  async function fetchWindowData(dateRef) {
    setLoading(true);
    try {
      let start, end;
      if (view === "month") {
        start = startOfMonth(dateRef);
        end = endOfMonth(dateRef);
      } else {
        start = startOfWeek(dateRef, { weekStartsOn: 0 });
        end = endOfWeek(dateRef, { weekStartsOn: 0 });
      }

     const { data: ev, error: evErr } = await supabase
        .from("calendar_events")
        .select("*, courses(title)")
        .eq("visibility", "public")  
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: true });

      if (evErr) throw evErr;

      const { data: asg, error: asgErr } = await supabase
        .from("assignments")
        .select("id, title, description, due_date, course_id, courses(title)")
        .gte("due_date", start.toISOString())
        .lte("due_date", end.toISOString())
        .order("due_date", { ascending: true });
      if (asgErr) throw asgErr;

      setEvents((ev || []).map((e) => ({
        ...e,
        course_id: e.course_id ? String(e.course_id) : "private",
        start_date_obj: safeParseDate(e.start_date),
        end_date_obj: safeParseDate(e.end_date),
      })));

      setAssignments((asg || []).map((a) => ({
        ...a,
        due_date_obj: safeParseDate(a.due_date),
      })));
    } catch (err) {
      console.error("fetchWindowData", err);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  // CRUD
  async function handleCreateEvent() {
    if (!draft.title?.trim()) {
      toast.error("Please add a title");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        event_type: draft.event_type,
        start_date: new Date(draft.start_date).toISOString(),
        end_date: new Date(draft.end_date).toISOString(),
        visibility: draft.visibility,
        course_id: draft.course_id !== "private" ? draft.course_id : null,
      };
      const { data, error } = await supabase.from("calendar_events").insert([payload]).select("*").single();
      if (error) throw error;
      setEvents((p) => [...p, { ...data, start_date_obj: safeParseDate(data.start_date), end_date_obj: safeParseDate(data.end_date) }]);
      toast.success("Event created");
      setShowAdd(false);
    } catch (err) {
      console.error("create event err", err);
      toast.error("Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateEvent(evId, changes) {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("calendar_events").update(changes).eq("id", evId).select("*").single();
      if (error) throw error;
      setEvents((p) => p.map((x) => (x.id === evId ? { ...data, start_date_obj: safeParseDate(data.start_date), end_date_obj: safeParseDate(data.end_date) } : x)));
      toast.success("Event updated");
      setShowDetail(false);
    } catch (err) {
      console.error("update event err", err);
      toast.error("Failed to update event");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEvent(ev) {
    if (!ev?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("calendar_events").delete().eq("id", ev.id);
      if (error) throw error;
      setEvents((p) => p.filter((x) => x.id !== ev.id));
      toast.success("Event deleted");
      setShowDetail(false);
    } catch (err) {
      console.error("delete event err", err);
      toast.error("Failed to delete event");
    } finally {
      setLoading(false);
    }
  }

  // Derived
  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, view]);

  const filteredEvents = useMemo(() => {
    const q = (search || "").toLowerCase();
    return events.filter((e) => {
      if (selectedCourse !== "all" && String(e.course_id) !== selectedCourse) return false;
      if (!q) return true;
      return (e.title || "").toLowerCase().includes(q);
    });
  }, [events, selectedCourse, search]);

  const agendaItems = useMemo(() => {
    const evs = filteredEvents.filter((e) => isSameDay(e.start_date_obj, selectedDate)).map((e) => ({ ...e, _kind: "event" }));
    const asg = assignments.filter((a) => a.due_date_obj && isSameDay(a.due_date_obj, selectedDate)).map((a) => ({ ...a, _kind: "assignment" }));
    return [...evs, ...asg];
  }, [filteredEvents, assignments, selectedDate]);

  const goPrev = () => setCurrentDate((d) => (view === "month" ? subMonths(d, 1) : addDays(d, -7)));
  const goNext = () => setCurrentDate((d) => (view === "month" ? addMonths(d, 1) : addDays(d, 7)));
  const goToday = () => {
    setSelectedDate(new Date());
    setCurrentDate(new Date());
  };

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1B1E] via-[#1a1a1a] to-[#000000] text-slate-100">
      {/* Header */}
      <motion.header initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-40 bg-black/40 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="rounded-full bg-emerald-900/40 p-2">
              <CalendarIcon className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-emerald-300">Admin Calendar</h1>
              <div className="text-xs text-zinc-400">Manage events & assignments</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <div className="hidden md:flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-2 py-1">
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goToday}>Today</Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
              <Separator orientation="vertical" className="mx-2 bg-zinc-700" />
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v || "all")}>
                <SelectTrigger className="w-48 bg-zinc-900/60 border border-zinc-700 cursor-pointer">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                  <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                  {courses.map((c) => (
                    <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile toolbar */}
            <div className="flex md:hidden items-center gap-2 w-full">
              <div className="flex gap-1 items-center">
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goToday}>Today</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v || "all")}>
                <SelectTrigger className="ml-2 bg-zinc-900/60 border border-zinc-700 cursor-pointer w-full">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-slate-100">
                  <SelectItem className="cursor-pointer" value="all">All courses</SelectItem>
                  <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                  {courses.map((c) => (
                    <SelectItem className="cursor-pointer" key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-0 sm:ml-2 flex items-center gap-2 w-full sm:w-96 mt-2 sm:mt-0">
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900/60 border border-zinc-700" />
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer" onClick={() => setShowAdd(true)}>
                <PlusCircle className="w-4 h-4 mr-2 inline-block" /> Add Event
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Calendar grid */}
        <section className="md:col-span-2">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
                <CardTitle className="text-emerald-300">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold">
                      {view === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
                    </div>
                    <div className="text-xs text-zinc-400">• {view === "month" ? "Month view" : "Week view"}</div>
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={view === "month" ? "default" : "outline"} className={`cursor-pointer hover:bg-emerald-400 ${view === "month" ? "bg-emerald-500 text-black" : "border-zinc-700"}`} onClick={() => setView("month")}>Month</Button>
                  <Button size="sm" variant={view === "week" ? "default" : "outline"} className={`cursor-pointer ${view === "week" ? "bg-emerald-500 text-black" : "border-zinc-700"}`} onClick={() => setView("week")}>Week</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-400 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => {
                      const dayEvents = filteredEvents.filter((e) => isSameDay(e.start_date_obj, day));
                      const dayAssignments = assignments.filter((a) => a.due_date_obj && isSameDay(a.due_date_obj, day));
                      const todayFlag = isToday(day);
                      const selectedFlag = isSameDay(day, selectedDate);
                      return (
                        <motion.div key={day.toISOString()} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.01 }} onClick={() => setSelectedDate(day)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedFlag ? "bg-emerald-900/60 border-emerald-600" : todayFlag ? "bg-emerald-600/20 border-emerald-400" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"}`}>
                          <div className="flex items-start justify-between">
                            <div className={`text-base font-semibold ${todayFlag ? "text-emerald-300" : "text-slate-100"}`}>{format(day, "d")}</div>
                            {todayFlag && <Badge className="bg-emerald-400 text-black px-2">Today</Badge>}
                          </div>
                          <div className="mt-3 space-y-1">
                            {dayEvents.slice(0, 3).map((e) => {
                              const st = eventStyle(e);
                              return (
                                <div key={e.id} className={`rounded px-2 py-0.5 text-xs truncate ${st.bg} ${st.text} border ${st.border}`} title={e.title}>
                                  <div className="flex items-center gap-2">
                                    <Circle className="w-3 h-3" />
                                    <div className="truncate">{truncate(e.title, 28)}</div>
                                  </div>
                                </div>
                              );
                            })}
                            {dayAssignments.slice(0, 2).map((a) => (
                              <div key={a.id} className="rounded px-2 py-0.5 text-xs truncate bg-emerald-700/30 text-emerald-200 border border-emerald-700">
                                <div className="flex items-center gap-2">
                                  <ClipboardList className="w-3 h-3" />
                                  <div className="truncate">{truncate(a.title, 28)}</div>
                                </div>
                              </div>
                            ))}
                            {(dayEvents.length + dayAssignments.length) > 3 && <div className="text-xs text-zinc-400">+{(dayEvents.length + dayAssignments.length) - 3} more</div>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-400">Click a day to view agenda on right. Assignments and events.</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer" onClick={() => fetchWindowData(currentDate)}>Refresh</Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goToday}>Today</Button>
                  <Button size="sm" variant="outline" className="border-zinc-700 text-black cursor-pointer" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </section>

        {/* Agenda */}
        <aside ref={topRef} className="space-y-6">
          <Card className="bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[360px] pr-2">
                {loading && <div className="text-zinc-400 text-sm">Loading...</div>}
                {!loading && agendaItems.length === 0 && <div className="text-zinc-500 text-sm">No items for this date</div>}
                {!loading && agendaItems.map((it) => {
                  if (it._kind === "assignment") {
                    return (
                      <div key={`a-${it.id}`} className="p-3 mb-2 bg-zinc-800/60 rounded border border-zinc-700">
                        <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {it.title}</div>
                        <div className="text-xs text-zinc-400 mt-1">{truncate(it.description,80)}</div>
                        <div className="text-xs text-zinc-500 mt-1">Due: {it.due_date_obj ? format(it.due_date_obj,"PPP p") : "—"}</div>
                        <div className="text-xs text-zinc-500">Course: {it.courses?.title || "—"}</div>
                      </div>
                    );
                  } else {
                    const st = eventStyle(it);
                    return (
                      <div key={`e-${it.id}`} className="p-3 mb-2 bg-zinc-800/60 rounded border border-zinc-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded ${st.bg} ${st.text} border ${st.border}`}>{it.event_type}</span>
                              <span className="font-semibold text-emerald-200">{it.title}</span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">{truncate(it.description,100)}</div>
                            <div className="text-xs text-zinc-500 mt-1">When: {it.start_date_obj ? format(it.start_date_obj,"PPP p") : "—"}</div>
                            <div className="text-xs text-zinc-500">Visibility: {it.visibility}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="cursor-pointer border border-zinc-700" onClick={() => { setDetailEvent(it); setShowDetail(true); }}><Edit className="w-4 h-4"/></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="cursor-pointer"><Trash className="w-4 h-4"/></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure you want to delete "{it.title}"?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="cursor-pointer text-black">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteEvent(it)} className="bg-red-600 cursor-pointer">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </main>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y:20 }} animate={{ y:0 }} exit={{ y:20 }} className="w-full max-w-2xl bg-black border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-emerald-300 mb-4">Add Event</h3>
              <Input placeholder="Title" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} className="bg-zinc-900 border-zinc-700 mb-2" />
              <Textarea placeholder="Description" value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} className="bg-zinc-900 border-zinc-700 mb-2" />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Select value={draft.event_type} onValueChange={(v)=>setDraft({...draft,event_type:v})}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 cursor-pointer"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-zinc-900 text-slate-200">
                    <SelectItem className="cursor-pointer" value="reminder">Reminder</SelectItem>
                    <SelectItem className="cursor-pointer" value="assignment">Assignment</SelectItem>
                    <SelectItem className="cursor-pointer" value="exam">Exam</SelectItem>
                    <SelectItem className="cursor-pointer" value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={draft.visibility} onValueChange={(v)=>setDraft({...draft,visibility:v})}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 cursor-pointer"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-zinc-900 text-slate-200">
                    <SelectItem className="cursor-pointer" value="public">Public</SelectItem>
                    <SelectItem className="cursor-pointer" value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Input type="datetime-local" value={draft.start_date} onChange={(e)=>setDraft({...draft,start_date:e.target.value})} className="bg-zinc-900 border-zinc-700" />
                <Input type="datetime-local" value={draft.end_date} onChange={(e)=>setDraft({...draft,end_date:e.target.value})} className="bg-zinc-900 border-zinc-700" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="cursor-pointer text-black" onClick={()=>setShowAdd(false)}>Cancel</Button>
                <Button className="bg-emerald-500 text-black cursor-pointer" onClick={handleCreateEvent}>Save</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && detailEvent && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y:20 }} animate={{ y:0 }} exit={{ y:20 }} className="w-full max-w-2xl bg-black border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-emerald-300 mb-2">{detailEvent.title}</h3>
              <p className="text-sm text-zinc-400 mb-2">{detailEvent.description}</p>
              <p className="text-xs text-zinc-500">When: {detailEvent.start_date_obj ? format(detailEvent.start_date_obj,"PPP p") : "—"}</p>
              <p className="text-xs text-zinc-500">Visibility: {detailEvent.visibility}</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" className="cursor-pointer text-black" onClick={()=>setShowDetail(false)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
