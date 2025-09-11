// src/pages/CourseEditPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export default function CourseEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [course, setCourse] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  // Fetch course by ID
  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast.error(" Failed to load course");
        navigate("/courses");
      } else {
        setCourse(data);
        setTitle(data.title);
        setDescription(data.description);
      }
    };
    fetchCourse();
  }, [id, navigate]);

  const handleUpdateCourse = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({ title, description })
        .eq("id", id);

      if (error) throw error;

      toast.success(" Course updated successfully!");
      navigate("/admin");
    } catch (err) {
      console.error(err);
      toast.error(" Failed to update course");
    } finally {
      setLoading(false);
      setConfirmUpdate(false);
    }
  };

  if (!course) {
    return (
      <div className="min-h-screen bg-black text-zinc-400 flex items-center justify-center">
        Loading course...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-emerald-400">
          <Pencil className="h-6 w-6" /> Edit Course
        </h1>
        <Button
          variant="outline"
          className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 cursor-pointer"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Edit Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-zinc-900 border-zinc-800 shadow-lg max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-emerald-400">
              Update Course Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmUpdate(true);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Course Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter course title"
                  required
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter course description"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 bg-white text-black cursor-pointer  hover:bg-gray-300"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-500 cursor-pointer hover:bg-emerald-600 text-white"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Course"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Confirm Update */}
      <AlertDialog open={confirmUpdate} onOpenChange={setConfirmUpdate}>
        <AlertDialogContent className="bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-400">Confirm Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update this course? Title:{" "}
              <span className="font-semibold">{title}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateCourse}
              className="bg-emerald-500 cursor-pointer hover:bg-emerald-600 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
