// src/pages/AdminWorkLinks.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import {
  Link as LinkIcon,
  Trash,
  ExternalLink,
  RefreshCw,
  User,
  GraduationCap,
} from "lucide-react";

export default function AdminWorkLinks() {
  const [links, setLinks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filterCourse, setFilterCourse] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchLinks();
  }, []);

  async function fetchCourses() {
    try {
      const { data, error } = await supabase.from("courses").select("id,title");
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("fetchCourses", err);
    }
  }

  async function fetchLinks() {
    setLoading(true);
    try {
      let query = supabase
        .from("student_links")
        .select(
          "*, courses(id,title), student:profiles(id,full_name,email)"
        )
        .order("created_at", { ascending: false });

      if (filterCourse) {
        query = query.eq("course_id", filterCourse);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      console.error("fetchLinks", err);
      toast.error("Failed to load student links");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(linkId) {
    try {
      const { error } = await supabase
        .from("student_links")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
      toast.success("Link deleted");
      fetchLinks();
    } catch (err) {
      console.error("handleDelete", err);
      toast.error("Delete failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f0f] to-[#000] text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-semibold text-emerald-300">
                Student Work Links
              </h1>
              <p className="text-sm text-zinc-400">
                View GitHub, Colab, Jupyter, and other links submitted by students per course.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Select
              value={filterCourse}
              onValueChange={(v) => setFilterCourse(v)}
            >
              <SelectTrigger className="bg-zinc-900 border border-zinc-800 w-48">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={fetchLinks}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Links List */}
        <ScrollArea className="max-h-[650px] pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="text-zinc-400">Loading...</div>
            ) : links.length === 0 ? (
              <div className="col-span-full text-center text-zinc-500 p-8">
                No student work links found.
              </div>
            ) : (
              links.map((link) => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-semibold">{link.title}</h2>
                      <p className="text-xs text-zinc-400">
                        {link.courses?.title || "—"} • {link.link_type}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-zinc-300">
                        <User className="w-4 h-4" />
                        {link.student?.full_name} ({link.student?.email})
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(link.url, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(link.id)}
                      >
                        <Trash className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
