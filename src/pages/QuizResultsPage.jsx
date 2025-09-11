// src/pages/QuizResultsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  ArrowLeft,
  Search,
  Filter,
  User,
  Trophy,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
} from "recharts";

export default function QuizResultsPage() {
  const [results, setResults] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 640);
  const navigate = useNavigate();

  // Handle resize (reset mobile toggles on desktop)
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 640;
      setIsDesktop(desktop);
      if (desktop) {
        setShowSearch(false);
        setShowFilter(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      const { data, error } = await supabase
        .from("quiz_scores")
        .select(`
          id,
          score,
          quiz_id,
          student_id,
          quizzes (
            id,
            created_at,
            course_id,
            courses (id, title)
          ),
          students(full_name, email)
        `);

      if (!error) {
        setResults(data || []);
        // Extract unique courses
        const uniqueCourses = [];
        data?.forEach((r) => {
          if (r.quizzes?.courses) {
            const exists = uniqueCourses.find(
              (c) => c.id === r.quizzes.courses.id
            );
            if (!exists) {
              uniqueCourses.push(r.quizzes.courses);
            }
          }
        });
        setCourses(uniqueCourses);
      }
    };
    fetchResults();
  }, []);

  // Parse score like "3/5" → percentage
  const parseScore = (scoreStr) => {
    if (!scoreStr) return 0;
    const [num, den] = scoreStr.split("/").map(Number);
    if (!den || isNaN(num) || isNaN(den)) return 0;
    return (num / den) * 100;
  };

  // Group results by course
  const groupedResults = useMemo(() => {
    const acc = {};
    results.forEach((r) => {
      const courseTitle = r.quizzes?.courses?.title || "Unknown Course";
      if (!acc[courseTitle]) acc[courseTitle] = [];
      acc[courseTitle].push(r);
    });
    return acc;
  }, [results]);

  // Filter by course
  const filteredGroups = Object.entries(groupedResults).filter(([course]) =>
    selectedCourse ? course === selectedCourse : true
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-lg bg-zinc-900/80">
        <div className="px-4 sm:px-6 py-4 flex flex-row gap-4 justify-between items-center">
          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Quiz Results
          </h1>

          {/* Controls */}
          <div className="flex gap-2 items-center">
            {/* Desktop Controls */}
            {isDesktop && (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search student..."
                    className="w-56 bg-zinc-800 pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Course Filter */}
                <Select
                  value={selectedCourse}
                  onValueChange={(v) => setSelectedCourse(v)}
                >
                  <SelectTrigger className="w-56 bg-zinc-900 border border-zinc-700 text-zinc-200">
                    <SelectValue placeholder="Filter by Course" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border border-zinc-700 text-zinc-200">
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.title}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Back Button */}
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-emerald-400 cursor-pointer hover:bg-emerald-500 text-black "
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className=" h-4 w-4" /> Back
                </Button>
              </>
            )}

            {/* Mobile Controls (icons only) */}
            {!isDesktop && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-zinc-800 cursor-pointer text-emerald-400  hover:bg-emerald-400 hover:text-black"
                  onClick={() => setShowSearch((s) => !s)}
                >
                  <Search className="h-5 w-5 " />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-zinc-800 cursor-pointer text-emerald-400  hover:bg-emerald-400 hover:text-black"
                  onClick={() => setShowFilter((f) => !f)}
                >
                  <Filter className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-zinc-800 cursor-pointer text-red-400  hover:bg-red-400 hover:text-black"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-5 w-5 " />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Expanded Controls */}
        {!isDesktop && showSearch && (
          <div className="px-4 pb-3">
            <Input
              placeholder="Search student..."
              className="w-full bg-zinc-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {!isDesktop && showFilter && (
          <div className="px-4 pb-3">
            <Select
              value={selectedCourse}
              onValueChange={(v) => setSelectedCourse(v)}
            >
              <SelectTrigger className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200">
                <SelectValue placeholder="Filter by Course" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border border-zinc-700 text-zinc-200">
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.title}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* Course-wise Results */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid gap-6 md:grid-cols-2">
        {filteredGroups.map(([courseTitle, rows]) => {
          // Sort quizzes by date
          const sortedRows = [...rows].sort(
            (a, b) => new Date(a.quizzes.created_at) - new Date(b.quizzes.created_at)
          );

          // Assign quiz numbers per course
          const quizMap = {};
          let quizCounter = 1;
          sortedRows.forEach((r) => {
            if (!quizMap[r.quizzes.id]) {
              quizMap[r.quizzes.id] = `Quiz ${quizCounter++}`;
            }
          });

          // Search filter
          const filteredRows = sortedRows.filter(
            (r) =>
              r.students?.full_name
                ?.toLowerCase()
                .includes(search.toLowerCase()) ||
              r.students?.email?.toLowerCase().includes(search.toLowerCase())
          );

          // Chart data
          const chartData = filteredRows.map((r, idx) => ({
            name: r.students?.full_name || `Student ${idx + 1}`,
            score: parseScore(r.score),
          }));

          // Average score
          const avgScore =
            filteredRows.length > 0
              ? (
                  filteredRows.reduce((sum, r) => sum + parseScore(r.score), 0) /
                  filteredRows.length
                ).toFixed(1)
              : 0;

          return (
            <Card
              key={courseTitle}
              className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-lg rounded-2xl"
            >
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> {courseTitle}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-600/20 text-emerald-400">
                    {filteredRows.length} Results
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-cyan-600/20 text-cyan-400 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Avg: {avgScore}%
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                {/* Chart */}
                <div className="h-48 mb-4 bg-zinc-800/50 rounded-md p-2">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <RechartTooltip
                            contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #333",
                        color: "#fff",
                        borderRadius:"10px",
                      }}
                        />
                        <Bar
                          dataKey="score"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                      No data
                    </div>
                  )}
                </div>

                {/* Results Table */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-800/70 border-zinc-700">
                      <TableHead className="flex items-center gap-1 text-emerald-400">
                        <User className="h-4 w-4" /> Student
                      </TableHead>
                      <TableHead className="text-zinc-300">Email</TableHead>
                      <TableHead className="text-zinc-300">Quiz</TableHead>
                      <TableHead className="text-right flex gap-1 items-center text-emerald-400">
                        <Trophy className="h-4 w-4" /> Score
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="hover:bg-zinc-800/40 transition"
                      >
                        <TableCell className="font-medium text-emerald-300">
                          {r.students?.full_name}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {r.students?.email}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {quizMap[r.quizzes.id]}
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-400 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${parseScore(r.score)}%`,
                                }}
                              ></div>
                            </div>
                            {r.score}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
