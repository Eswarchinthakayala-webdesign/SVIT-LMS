// src/pages/Quizzes.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
} from "recharts";

export default function Quizzes() {
  const { id } = useParams(); // quiz id
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, course_id, questions, courses(title)")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        toast.error("Failed to load quiz.");
      } else {
        setQuiz({
          ...data,
          questions: Array.isArray(data.questions)
            ? data.questions
            : JSON.parse(data.questions || "[]"),
        });
      }
      setLoading(false);
    };
    fetchQuiz();
  }, [id]);

  const handleChange = (qIndex, choice) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: choice }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setSubmitting(true);

    let correct = 0;
    const analytics = quiz.questions.map((q, idx) => {
      const isCorrect = answers[idx] === q.answer;
      if (isCorrect) correct++;
      return {
        question: `Q${idx + 1}`,
        correct: isCorrect ? 1 : 0,
        wrong: !isCorrect ? 1 : 0,
      };
    });

    const scoreText = `${correct}/${quiz.questions.length}`;
    setScore(scoreText);
    setSubmitted(true);
    setChartData(analytics);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("quiz_scores").insert([
      {
        quiz_id: quiz.id,
        student_id: user.id,
        score: scoreText,
      },
    ]);

    if (error) {
      console.error(error);
      toast.error("Failed to save quiz.");
    } else {
      toast.success("Quiz submitted!");
    }

    setSubmitting(false);
  };

  if (loading) return <div className="text-zinc-400">Loading quiz…</div>;
  if (!quiz) return <div className="text-zinc-400">Quiz not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-emerald-400">
            {quiz.courses?.title} — Quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <div key={idx} className="space-y-2 bg-black/50 p-4 rounded-2xl">
              <p className="font-semibold text-lg text-emerald-100">
                {idx + 1}. {q.question}
              </p>
              <div className="ml-4 flex flex-col gap-2">
                {q.options.map((opt, i) => {
                  const isSelected = answers[idx] === opt;
                  const isCorrect = opt === q.answer;
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        submitted
                          ? isCorrect
                            ? "bg-emerald-600 text-white"
                            : isSelected
                            ? "bg-red-600 text-white"
                            : "bg-zinc-800 text-zinc-200"
                          : isSelected
                          ? "bg-emerald-700/50 text-white"
                          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${idx}`}
                        value={opt}
                        checked={isSelected}
                        onChange={() => handleChange(idx, opt)}
                        disabled={submitted}
                        className="hidden"
                      />
                      <span className="flex-1">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {!submitted && (
            <Button
              className="bg-emerald-500 hover:bg-emerald-400 text-black mt-4"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Quiz"}
            </Button>
          )}

          {submitted && (
            <div className="space-y-6 mt-6">
              <p className="text-lg font-semibold text-emerald-400">
               Your Score: {score}
              </p>

              {/* Analytics Chart */}
              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Result Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="question" stroke="#DDE6ED" />
                      <YAxis allowDecimals={false} stroke="#DDE6ED" />
                      <RechartTooltip />
                      <Bar dataKey="correct" fill="#10B981" />
                      <Bar dataKey="wrong" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 cursor-pointer hover:bg-emerald-500"
                  onClick={() => navigate(`/courses/${quiz.course_id}`)}
                >
                  Back to Course
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
