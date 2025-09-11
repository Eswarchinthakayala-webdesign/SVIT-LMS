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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

import {
  BookOpen,
  MessageSquare,
  Search,
  Send,
  Pencil,
  Trash2,
} from "lucide-react";

export default function AdminDiscussionPage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [profile, setProfile] = useState(null);
  const [discussions, setDiscussions] = useState([]);
  const [filteredDiscussions, setFilteredDiscussions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // dialogs
  const [replyOpen, setReplyOpen] = useState(null); // discussion_id
  const [editingReply, setEditingReply] = useState(null);

  // form state
  const [replyContent, setReplyContent] = useState("");

  // load profile
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, []);

  // load courses
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("courses").select("id, title");
      setCourses(data || []);
    })();
  }, []);

  // load discussions
  useEffect(() => {
    if (!selectedCourse) return;
    fetchDiscussions(selectedCourse);
  }, [selectedCourse]);

  // filter discussions
  useEffect(() => {
    const filtered = discussions.filter(
      (d) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDiscussions(filtered);
  }, [searchQuery, discussions]);

  const fetchDiscussions = async (courseId) => {
    const { data } = await supabase
      .from("discussions")
      .select("*, students(full_name), discussion_replies(*, profiles(full_name, role))")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setDiscussions(data || []);
    setFilteredDiscussions(data || []);
  };

  // Post reply
  const handlePostReply = async (discussionId) => {
    if (!replyContent.trim()) return;
    const { error } = await supabase.from("discussion_replies").insert([{
      discussion_id: discussionId,
      user_id: profile.id,
      content: replyContent.trim(),
    }]);
    if (error) {
      toast.error("Failed to post reply");
    } else {
      toast.success("Reply posted");
      setReplyOpen(null);
      setReplyContent("");
      fetchDiscussions(selectedCourse);
    }
  };

  // Edit reply
  const handleEditReply = async () => {
    if (!editingReply) return;
    const { error } = await supabase
      .from("discussion_replies")
      .update({ content: replyContent.trim() })
      .eq("id", editingReply.id);
    if (error) {
      toast.error("Failed to update reply");
    } else {
      toast.success("Reply updated");
      setEditingReply(null);
      setReplyContent("");
      fetchDiscussions(selectedCourse);
    }
  };

  // Delete reply
  const handleDeleteReply = async (replyId) => {
    const { error } = await supabase
      .from("discussion_replies")
      .delete()
      .eq("id", replyId);
    if (error) {
      toast.error("Failed to delete reply");
    } else {
      toast.success("Reply deleted");
      fetchDiscussions(selectedCourse);
    }
  };

  // Delete discussion
  const handleDeleteDiscussion = async (discussionId) => {
    const { error } = await supabase
      .from("discussions")
      .delete()
      .eq("id", discussionId);
    if (error) {
      toast.error("Failed to delete discussion");
    } else {
      toast.success("Discussion deleted");
      fetchDiscussions(selectedCourse);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-20 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-emerald-300">Admin Discussions</h1>
            <p className="text-sm text-zinc-400">
              Manage student questions, reply, edit or delete
            </p>
          </div>
        </div>

        <Input
          placeholder="Search discussions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-900 border-zinc-700 w-full md:w-64"
        />
      </motion.header>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Course Selector */}
        <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
          <CardHeader>
            <CardTitle className="text-emerald-300">Choose Course</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCourse || ""} onValueChange={setSelectedCourse}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 w-full">
                 <SelectValue className="cursor-pointer" placeholder="Select a course">
                <span className="text-emerald-100">
                {selectedCourse
                    ? courses.find((c) => c.id === selectedCourse)?.title
                    : "Select a course"}
                </span>
            </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-slate-100">
                {courses.map((c) => (
                  <SelectItem className="cursor-pointer" key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="public">
          <TabsList className="bg-emerald-500 border border-zinc-800">
            <TabsTrigger className="cursor-pointer" value="public">Public</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="private">Private</TabsTrigger>
          </TabsList>

          {["public", "private"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {filteredDiscussions
                  .filter((d) => d.type === tab)
                  .map((d) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="bg-zinc-900/60 border border-zinc-800 rounded-xl shadow hover:shadow-lg transition">
                        <CardHeader className="pb-2 flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-emerald-200">{d.title}</h3>
                            <p className="text-xs text-zinc-400">
                              {d.students?.full_name || "Unknown"} • {new Date(d.created_at).toLocaleString()}
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="cursor-pointer text-red-500 hover:bg-red-500 hover:text-black">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100 rounded-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-emerald-300">Delete Discussion</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this discussion? All replies will also be removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-zinc-800 cursor-pointer text-slate-200 hover:bg-zinc-700">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDiscussion(d.id)}
                                  className="bg-red-600 cursor-pointer hover:bg-red-500 text-slate-100"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-zinc-300">{d.content}</p>
                          <div className="space-y-2">
                            {d.discussion_replies?.map((r) => (
                              <div key={r.id} className="bg-zinc-800/40 p-2 rounded-md text-sm flex justify-between items-center">
                                <span>
                                  <span className="text-emerald-300 font-medium">{r.profiles?.full_name}</span> <span className="text-gray-300"> : {r.content}</span>
                                </span>
                                {r.profiles?.role === "admin" && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingReply(r);
                                        setReplyContent(r.content);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Pencil className="h-4 w-4 text-zinc-400" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-500 hover:text-black cursor-pointer">
                                          <Trash2 className="h-4 w-4 " />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100 rounded-xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="text-emerald-300">Delete Reply</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete this reply?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="bg-zinc-800 text-slate-200 hover:bg-zinc-700">Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteReply(r.id)}
                                            className="bg-red-600 hover:bg-red-500 text-slate-100"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 cursor-pointer text-slate-100"
                            onClick={() => setReplyOpen(d.id)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" /> Reply
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Reply Dialog */}
      <Dialog open={!!replyOpen} onOpenChange={() => setReplyOpen(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100 rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">Post Reply</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Type your reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="bg-zinc-800 border-zinc-700"
          />
          <DialogFooter>
            <Button
              className="bg-emerald-600 cursor-pointer hover:bg-emerald-500 text-slate-100"
              onClick={() => handlePostReply(replyOpen)}
            >
              <Send className="h-4 w-4 mr-2" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reply Dialog */}
      <Dialog open={!!editingReply} onOpenChange={() => setEditingReply(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-slate-100 rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-300">Edit Reply</DialogTitle>
          </DialogHeader>
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="bg-zinc-800 border-zinc-700"
          />
          <DialogFooter>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-100"
              onClick={handleEditReply}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
