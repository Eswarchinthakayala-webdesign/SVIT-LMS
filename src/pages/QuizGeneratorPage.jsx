// src/pages/QuizManagerPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  BookOpen,
  ListChecks,
  PlusCircle,
  FileText,
  ArrowLeft,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

// 🎨 Badge Colors
const badgeColors = [
  "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
  "bg-blue-600/20 text-blue-300 border-blue-600/40",
  "bg-orange-600/20 text-orange-300 border-orange-600/40",
  "bg-pink-600/20 text-pink-300 border-pink-600/40",
  "bg-purple-600/20 text-purple-300 border-purple-600/40",
];

export default function QuizGeneratorPage() {
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const navigate = useNavigate();

  // ✅ Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title");
      if (error) console.error("Error fetching courses:", error);
      setCourses(data || []);
    };
    fetchCourses();
  }, []);

  // ✅ Fetch quizzes
  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, course_id, questions, created_at")
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching quizzes:", error);
    setQuizzes(data || []);
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // ✅ Generate Quiz
  const generateQuiz = async () => {
    if (!selectedCourse) {
      toast.error("Please select a course");
      return;
    }
    if (!topicDescription.trim()) {
      toast.error("Please enter a topic description");
      return;
    }
    setLoading(true);
    try {
      const course = courses.find((c) => c.id === selectedCourse);

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${
          import.meta.env.VITE_GEMINI_API_KEY
        }`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate ${questionCount} multiple choice quiz questions with 4 options each and the correct answer. 
        The course is: ${course?.title}. 
        Topic description: ${topicDescription}.
        Format the output as a raw JSON array only, like this:

        [
          {"question":"...", "options":["(A)...","(B)...","(C)...","(D)..."], "answer":"(A)..."}
        ]`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);

      const result = await resp.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

      let quizData;
      try {
        const cleanText = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        quizData = JSON.parse(cleanText);
      } catch (err) {
        console.error("Failed to parse Gemini response:", text);
        toast.error("Quiz format invalid, check console.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("quizzes").insert([
        {
          course_id: selectedCourse,
          questions: quizData,
        },
      ]);

      if (error) {
        console.error("Error saving quiz:", error);
        toast.error("Failed to save quiz.");
      } else {
        toast.success("Quiz generated successfully!");
        fetchQuizzes();
        setTopicDescription("");
      }
    } catch (err) {
      console.error("Error generating quiz:", err);
      toast.error("Gemini API request failed. Check API key/quota.");
    }
    setLoading(false);
  };

  // ✅ Delete Quiz
  const confirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    const { error } = await supabase
      .from("quizzes")
      .delete()
      .eq("id", quizToDelete.id);
    if (error) {
      console.error("Error deleting quiz:", error);
      toast.error("Failed to delete quiz.");
    } else {
      setQuizzes((prev) => prev.filter((q) => q.id !== quizToDelete.id));
      toast.success("Quiz deleted successfully!");
    }
    setQuizToDelete(null);
  };

  // ✅ Analytics Data
  const quizAnalytics = useMemo(() => {
    return courses.map((course) => {
      const count = quizzes.filter((q) => q.course_id === course.id).length;
      return { name: course.title, quizzes: count };
    });
  }, [courses, quizzes]);

  // ✅ Group quizzes by course
  const groupedQuizzes = useMemo(() => {
    return courses.map((course) => ({
      ...course,
      quizzes: quizzes.filter((q) => q.course_id === course.id),
    }));
  }, [courses, quizzes]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 ">
    {/* {header} */}
    <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-300" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-emerald-300">
              Quiz Manager
            </h1>
            <p className="text-xs text-zinc-400 hidden md:block">
             Generate, organize, and analyze quizzes for each course
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-black"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </motion.header>
  
     
      {/* Quiz Generator + Analytics */}
      <div className="flex flex-col max-w-7xl mx-auto p-6 md:p-8 md:flex-row gap-6">
        {/* Quiz Generation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex-1"
        >
          <Card className="bg-zinc-900 border-zinc-800 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-emerald-400 gap-2 text-xl">
                <PlusCircle className="w-6 h-6" /> Generate New Quiz
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Select a course, describe the topic, and choose number of
                questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm mb-1 text-zinc-300">Course</label>
                <Select
                  value={selectedCourse}
                  onValueChange={(value) => setSelectedCourse(value)}
                >
                  <SelectTrigger className="bg-zinc-800 border border-zinc-700 w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 text-white border-zinc-700">
                    {courses.map((c) => (
                      <SelectItem
                        className="cursor-pointer"
                        key={c.id}
                        value={c.id}
                      >
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1 text-zinc-300">
                  Topic Description
                </label>
                <Input
                  type="text"
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="e.g. Data Types in Python"
                  className="bg-zinc-800 text-emerald-100 border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-zinc-300">
                  Question Count
                </label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  className="bg-zinc-800 text-emerald-100 border-zinc-700"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="bg-emerald-500 text-black cursor-pointer hover:bg-emerald-400"
                onClick={generateQuiz}
                disabled={loading}
              >
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {loading ? "Generating..." : "Generate Quiz"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex-1 bg-zinc-900 p-4 border border-zinc-800 rounded-lg shadow-lg"
        >
          <h2 className="text-lg font-semibold text-emerald-400 mb-4">
            Quiz Analytics
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quizAnalytics}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "#D1FAE5" }} />
              <YAxis tick={{ fill: "#D1FAE5" }} allowDecimals={false} />
              <Tooltip
                 contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #333",
                        color: "#fff",
                        borderRadius:"10px",
                      }}
              />
              <Legend wrapperStyle={{ color: "#D1FAE5" }} />
              <Bar dataKey="quizzes" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Quizzes Grouped by Course */}
      <div className="mt-10 space-y-8 max-w-7xl mx-auto p-6 md:p-8">
        {groupedQuizzes.map((course, idx) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <h3 className="text-xl font-semibold text-emerald-400 mb-4">
              {course.title}
            </h3>
            {course.quizzes.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {course.quizzes.map((quiz, qIdx) => {
                  const badgeStyle = badgeColors[qIdx % badgeColors.length];
                  return (
                    <Card
                      key={quiz.id}
                      className="bg-zinc-900 border-zinc-800 hover:border-emerald-400 transition"
                    >
                      <CardHeader className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center text-emerald-400 gap-2 text-lg">
                            <FileText className="w-5 h-5" />
                            Quiz
                          </CardTitle>
                          <CardDescription className="text-zinc-400">
                            {new Date(quiz.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Badge className={badgeStyle}>
                          {quiz.questions.length} Qs
                        </Badge>
                      </CardHeader>
                      <CardFooter className="flex gap-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedQuiz(quiz);
                            setShowDetails(true);
                          }}
                          className="cursor-pointer"
                        >
                          <ListChecks className="mr-2 h-4 w-4" /> View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setQuizToDelete(quiz)}
                          className="cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-zinc-500">No quizzes available</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quiz Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl bg-zinc-900 text-white border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center text-emerald-400 gap-2">
              <FileText className="w-5 h-5" /> Quiz Details
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Questions and correct answers
            </DialogDescription>
          </DialogHeader>
          {selectedQuiz && (
            <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-2">
              {selectedQuiz.questions.map((q, idx) => (
                <Card
                  key={idx}
                  className="bg-zinc-800/70 border border-zinc-700 shadow-sm"
                >
                  <CardHeader>
                    <CardTitle className="text-base text-emerald-100 font-medium">
                      {idx + 1}. {q.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ul className="space-y-2">
                      {q.options.map((opt, i) => {
                        const isAnswer = opt === q.answer;
                        return (
                          <li
                            key={i}
                            className={`flex items-center gap-2 p-2 rounded-md ${
                              isAnswer
                                ? "bg-emerald-600/50 text-white"
                                : "bg-zinc-900/50 text-zinc-200"
                            }`}
                          >
                            <span
                              className={`w-6 font-semibold ${
                                isAnswer
                                  ? "text-white"
                                  : "text-emerald-400"
                              }`}
                            >
                              {String.fromCharCode(65 + i)}.
                            </span>
                            {opt}
                            {isAnswer && (
                              <Badge className="ml-auto bg-white/20 text-white">
                                Correct
                              </Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!quizToDelete}
        onOpenChange={() => setQuizToDelete(null)}
      >
        <AlertDialogContent className="bg-zinc-900 border border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-100">
              Delete Quiz
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete this quiz? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-200 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 cursor-pointer hover:bg-red-700"
              onClick={confirmDeleteQuiz}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
