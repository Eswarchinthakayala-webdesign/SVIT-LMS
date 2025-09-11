// src/pages/LandingPage.jsx
// SVIT — Upgraded Pro Landing Page (complete, content-rich, 3D background)
// Tech: React + Tailwind + shadcn/ui + Framer Motion + lucide-react + @react-three/fiber + drei
// NOTE: Install dependencies: three, @react-three/fiber, @react-three/drei, lucide-react, framer-motion, and shadcn/ui components.

import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Float, Stars } from "@react-three/drei";
import {
  BookOpen,
  GraduationCap,
  ClipboardList,
  CalendarCheck,
  FileText,
  Link as LinkIcon,
  ListTodo,
  Users2,
  MessageSquare,
  BarChart3,
  Bell,
  Trophy,
  ShieldCheck,
  Database,
  Cloud,
  Sparkles,
  Upload,
  Download,
  Share2,
  Star,
  Gauge,
  Layers,
  FolderOpen,
  FileSpreadsheet,
  Video,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Shield,
  Cpu,
  Rocket,
  Map,
  Ticket,
  BrainCircuit,
  Component,
  GitBranch,
  Building2,
  Workflow,
  Library,
  ChartSpline,
  Mail,
  LogIn,
  UserPlus,
  Moon,
  Sun,
  Github,
  FileCode2,
  User,
  Globe,
  Linkedin,
  Twitter,
  Check,
  ArrowRight,
} from "lucide-react";

// shadcn/ui imports — update paths if your project structure differs
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useNavigate } from "react-router-dom";

// ---------- 3D Scene Components (react-three) ----------
function RotatingTorus({ color = "#10b981", position = [0, 0, 0], speed = 0.45, scale = 1.0 }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed;
    if (ref.current) {
      ref.current.rotation.x = Math.sin(t * 0.6) * 0.6;
      ref.current.rotation.y = Math.cos(t * 0.4) * 0.8;
      ref.current.position.y = Math.sin(t * 0.8) * 0.15 + position[1];
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusKnotGeometry args={[1, 0.22, 180, 32]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} emissive={color} emissiveIntensity={0.06} />
    </mesh>
  );
}

function ParticleCloud({ count = 900 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 20; // x
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;  // y
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20; // z
    }
    return arr;
  }, [count]);

  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color={"#7fffd4"} sizeAttenuation depthWrite={false} transparent opacity={0.75} />
    </points>
  );
}

function Scene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 60 }} className="absolute inset-0">
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 8, 2]} intensity={0.8} />
      <directionalLight position={[-6, -4, -2]} intensity={0.25} />
      <Suspense fallback={null}>
        <Float floatIntensity={0.6} rotationIntensity={0.6}>
          <RotatingTorus color="#06b6d4" position={[1.5, 0.2, -0.2]} scale={1.1} speed={0.35} />
        </Float>
        <Float floatIntensity={0.4} rotationIntensity={0.6}>
          <RotatingTorus color="#10b981" position={[-2.2, -0.5, -1]} scale={0.8} speed={0.25} />
        </Float>
        <ParticleCloud count={1200} />
        <Stars radius={60} depth={30} count={6000} factor={4} saturation={0.6} fade />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.25} />
    </Canvas>
  );
}

// ---------------------- Animations & Helpers ----------------------
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6 } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.06 } },
};

function Section({ id, className = "", children }) {
  return (
    <section id={id} className={`relative py-16 md:py-24 ${className}`}>
      <div className="container mx-auto px-6 max-w-7xl">{children}</div>
    </section>
  );
}

function Kicker({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-emerald-300 text-xs font-medium">
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </div>
  );
}

// Animated stat counter (visual, not actual incremental counting to keep simple)
function StatCard({ label, value, prefix = "", suffix = "" }) {
  return (
    <motion.div variants={fadeScale} className="bg-neutral-900/60 border border-white/6 rounded-xl p-4 text-center">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl md:text-3xl font-bold text-white mt-2">{prefix}{value}{suffix}</div>
    </motion.div>
  );
}

// ---------------------- Main Landing Page ----------------------
export default function LandingPage() {
  // some local UI states for demo interactions
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSent, setNewsletterSent] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  useEffect(() => {
    if (newsletterSent) {
      const t = setTimeout(() => setNewsletterSent(false), 4000);
      return () => clearTimeout(t);
    }
  }, [newsletterSent]);
  const navigate=useNavigate()
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-neutral-950 text-white antialiased">
      {/* 3D background */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        
      </div>

      {/* Top nav */}
      <header className="relative  z-30 border-b border-white/6 backdrop-blur bg-neutral-950/40">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
           <img src="/logo.png" className="w-8 h-8 mb-[-3px]"/>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">SVIT</div>
    
            </div>
           
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#stack" className="hover:text-white">Tech</a>
            <a href="#roadmap" className="hover:text-white">Roadmap</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>

         <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="bg-white hover:bg-gray-200 text-black cursor-pointer"
                    onClick={()=>navigate("/demo")}
                  >
                    <LogIn className="h-4 w-4" /> <p className="hidden sm:flex">Demo</p>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Try Demo</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-emerald-500 cursor-pointer hover:bg-emerald-600"
                    onClick={()=>navigate("/login")}
                  >
                    <UserPlus className="h-4 w-4" /> Start
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a free account</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Hero */}
      <Section id="hero" className="pt-14 md:pt-20">
        <div className="relative z-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
            <motion.div variants={fadeUp}><Kicker icon={Rocket}>Built for internships Teams</Kicker></motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-extrabold leading-tight">
              SVIT — <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">All-in-One</span> LMS for Teams
            </motion.h1>
            <motion.p variants={fadeUp} className="text-neutral-300 text-lg max-w-xl">
              Empower your internship program with structured courses, attendance tracking, assignment workflows, in-course notes, curated links, task management, and analytics — all on a single platform.
            </motion.p>

            <motion.div variants={fadeUp} className="flex gap-3 items-center">
              <Button className="bg-emerald-500 hover:bg-emerald-600 px-5 py-3" onClick={() => navigate("/login")}>
                <GraduationCap className="mr-2 h-4 w-4" /> Explore Courses
              </Button>

              <Button variant="outline" className="px-5 py-3 border-white/10 cursor-pointer text-neutral-600" onClick={() => setShowDemoModal(true)}>
                <Video className="mr-2 h-4 w-4" /> Watch Demo
              </Button>

              <div className="ml-2 text-xs text-neutral-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-300" /> Privacy-first • Secure by design
              </div>
            </motion.div>

           
          </motion.div>

          {/* Right card preview: Mentor vs Student quick switch */}
          <motion.div variants={fadeScale} initial="hidden" animate="show" className="relative">
            <Card className="bg-neutral-900/70 border border-white/8 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-neutral-900/60 to-neutral-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Library className="w-5 h-5 text-emerald-300" />
                  <div>
                    <div className="text-white font-semibold">SVIT Course Workspace</div>
                    <div className="text-xs text-neutral-400">Switch between Mentor & Student preview</div>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300">Preview</Badge>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                 
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-emerald-200">Active Module</div>
                      <div className="text-xs text-neutral-400">Module 3</div>
                    </div>
                    <div className="w-full bg-white/6 h-2 rounded-full mt-2 overflow-hidden">
                      <div style={{ width: "68%" }} className="h-full bg-emerald-400" />
                    </div>
                    <div className="text-xs text-neutral-400 mt-2">Completion: 68%</div>
                    <Separator className="my-3" />
                    <div className="text-sm text-neutral-400">Next session</div>
                    <div className="font-medium text-emerald-200">Sept 5 • Live Q&A</div>
                    <div className="text-xs text-neutral-400">10:00 IST — Online</div>
                  </div>
                </div>

                <div>
                 
                  <div className="mt-2 text-neutral-300">
                    <div>- Task: Implement UI polish (Due Sept 7)</div>
                    <div className="mt-2">- Notes: 12 saved</div>
                    <div className="mt-2">- Links: 8 bookmarked</div>
                    <div className="mt-3"><Button className="bg-emerald-500 cursor-pointer hover:bg-emerald-400" onClick={() => navigate("/login")}>Open Course</Button></div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/6 text-sm text-neutral-400">
                Recent: Assignment 2 graded — average 86% • 4 comments flagged for review
              </div>
            </Card>
          </motion.div>
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Features grid with hover animations */}
      <Section id="features">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <Kicker icon={Component}>Feature-rich & Extensible</Kicker>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">Comprehensive features built for learning</h2>
            <p className="text-neutral-400 max-w-2xl mt-2">From course authoring to certificates — SVIT bundles everything a small-to-medium internship program needs.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-neutral-400">
            <Search className="w-4 h-4" /> Quick find
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: BookOpen, title: "Course Builder", text: "Module authoring, versioning, scheduling and resource attachments." },
            { icon: ClipboardList, title: "Assignments", text: "Multiple submission types, rubrics, batch grading and feedback." },
            { icon: CalendarCheck, title: "Attendance", text: "Session builder, barcode/QR check-in (optional), reports & exports." },
            { icon: FileText, title: "Notes", text: "Markdown editor, attachments, sharing and export ." },
            { icon: LinkIcon, title: "Link Saver", text: "Per-course link bookmarks, tags, and favicon previews." },
            { icon: ListTodo, title: "Task Manager", text: "Kanban & list views, due dates, reminders & group tasks." },
            { icon: MessageSquare, title: "Discussions", text: "Threaded discussions with mentions, moderation & pinned posts." },
            { icon: BarChart3, title: "Analytics", text: "Engagement metrics, attendance trends and grade distributions." },
            { icon: ShieldCheck, title: "Security", text: "RLS, OAuth integrations, MFA-ready configuration." },
           
          ].map((f, i) => (
            <motion.div key={i} whileHover={{ scale: 1.03 }} variants={fadeUp} initial="hidden" whileInView="show" className="rounded-2xl">
              <Card className="bg-neutral-900/70 border border-white/8 p-4">
                <CardHeader className="flex items-center gap-3">
                  <f.icon className="w-6 h-6 text-emerald-300" />
                  <div>
                    <CardTitle className="text-lg text-emerald-200">{f.title}</CardTitle>
                    <CardDescription className="text-neutral-400">{f.text}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">Core</Badge>
                    <div className="text-xs text-neutral-400">Works out-of-the-box</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Product deep dive tabs with Mentor vs Student examples and screenshots placeholders */}
      <Section id="product" className="pt-4">
        <Kicker icon={Layers}>Product Tour</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Inside a Course — Deep Dive</h2>
        <p className="text-neutral-400 max-w-2xl mt-2">We designed SVIT around per-course workspaces: content, communication, assessment, and productivity tools that live together.</p>

        <Tabs defaultValue="courses" className="mt-8">
          <TabsList className="bg-emerald-400 border border-white/10  rounded-xl p-1 grid grid-cols-2 md:grid-cols-5 gap-2">
            <TabsTrigger className="cursor-pointer data-[state=active]:bg-black data-[state=active]:text-white" value="courses">Courses</TabsTrigger>
            <TabsTrigger className="cursor-pointer data-[state=active]:bg-black data-[state=active]:text-white"  value="assignments">Assignments</TabsTrigger>
            <TabsTrigger className="cursor-pointer data-[state=active]:bg-black data-[state=active]:text-white" value="attendance">Attendance</TabsTrigger>
            <TabsTrigger className="cursor-pointer data-[state=active]:bg-black data-[state=active]:text-white" value="productivity">Notes & Links</TabsTrigger>
            <TabsTrigger className="cursor-pointer data-[state=active]:bg-black data-[state=active]:text-white" value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-200">Course Workspace</CardTitle>
                  <CardDescription className="text-neutral-400">Overview, modules, and instructor notes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-neutral-300 space-y-2">
                    <li>Course landing: description, learning outcome, prerequisites</li>
                    <li>Module builder: add text, video, attachments, and code samples</li>
                    <li>Per-module resources and recommended reading lists</li>
                    <li>Mentor pins and announcement banners</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-300">Mentor vs Student Views</CardTitle>
                  <CardDescription className="text-neutral-400">Role-based UI and actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Admin</Badge>
                      <div>
                        <div className="font-semibold text-gray-200">Create assignments, grade, and message students.</div>
                        <div className="text-sm text-neutral-400">Quick actions: bulk grade,  set rubrics.</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">Student</Badge>
                      <div>
                        <div className="font-semibold text-gray-200">Submit assignments, take notes, join discussions.</div>
                        <div className="text-sm text-neutral-400">Progress bar, next steps, and calendar integration.</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        
           
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-200">Assignment Lifecycle</CardTitle>
                  <CardDescription className="text-neutral-400">Create → Submit → Grade → Feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-neutral-300 space-y-2">
                    <li>Flexible types: file upload, text, link, repo link</li>
                    <li>Rubric support for consistent grading</li>
                    <li>Anonymous peer-review option (configurable)</li>
                    <li>Late submission settings and grace periods</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-200">Feedback & Reviews</CardTitle>
                  <CardDescription className="text-neutral-400">Inline comments, version history, and resubmission queues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-neutral-300">
                    Provide granular feedback with inline comments and suggested edits. Track resubmissions and maintain a revision history per submission to avoid confusion.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-200">Session Builder</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-neutral-300 space-y-2">
                    <li>Create session slots, add topics, and attach resources</li>
                    <li>Mark present / late / absent with timestamps</li>
                    <li>Take bulk attendance and export CSV for reporting</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader>
                  <CardTitle className="text-emerald-200">Proctoring & Integrity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-neutral-300">Optional integrations for proctoring, strict time windows for quizzes, and audit logs for grading changes ensure integrity and transparency.</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="productivity" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader><CardTitle className="text-emerald-200"> Notes</CardTitle><CardDescription className="text-neutral-400">Rich text & markdown</CardDescription></CardHeader>
                <CardContent><div className="text-neutral-300">Create private or shared notes inside a course. Attach files, export to PDF, and search across all notes.</div></CardContent>
              </Card>
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader><CardTitle className="text-emerald-200">Links</CardTitle></CardHeader>
                <CardContent><div className="text-neutral-300">Save web resources with tags, description, and favicon preview. Quickly re-open important references.</div></CardContent>
              </Card>
              <Card className="bg-neutral-900/60 p-4 rounded-xl">
                <CardHeader><CardTitle className="text-emerald-200">Tasks</CardTitle></CardHeader>
                <CardContent><div className="text-neutral-300">Task lists, priorities, and reminders mapped to course milestones and personal checklists.</div></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card className="bg-neutral-900/60 p-4 rounded-xl">
              <CardHeader>
                <CardTitle className="text-emerald-200">Analytics & Insights</CardTitle>
                <CardDescription className="text-neutral-400">Actionable dashboards for mentors and admins</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-neutral-300 space-y-2">
                  <li>Attendance trends and cohort comparisons</li>
                  <li>Engagement heatmaps by module and student</li>
                  <li>Grade distributions and at-risk student detection</li>
                  <li>Export CSV, JSON, or integrate via API</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>

      <Separator className="bg-white/6" />

      {/* Tech stack & Security (expanded) */}
      <Section id="stack" className="pt-6">
        <Kicker icon={GitBranch}>Tech & Integrations</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Modern, open, and secure</h2>
        <p className="text-neutral-400 max-w-2xl mt-2">SVIT is built with developer ergonomics and security in mind — React + shadcn UI + Framer Motion, with Supabase powering auth, Postgres and realtime capabilities. Storage adapters (R2/Drive/S3) are supported for large files.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Database, title: "Supabase Postgres", text: "Auth, RLS, SQL, triggers & realtime" },
            { icon: FileCode2, title: "Developer Friendly", text: "Type-safe APIs, SDK examples and webhooks" },
            { icon: Github, title: "CI/CD", text: "Preview deployments and automated tests" },
            { icon: Cpu, title: "Edge Ready", text: "Serverless endpoints and low-latency responses" },
            { icon: ShieldCheck, title: "Security", text: "OAuth, MFA-ready, audit logs, and encryption" },
          ].map((f, i) => (
            <Card key={i} className="bg-neutral-900/60 border border-white/8 rounded-2xl p-4">
              <CardHeader className="flex items-center gap-3">
                <f.icon className="w-5 h-5 text-emerald-300" />
                <div>
                  <CardTitle className="text-lg text-emerald-200">{f.title}</CardTitle>
                  <CardDescription className="text-neutral-400">{f.text}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-200">Security & Compliance</CardTitle>
              <CardDescription className="text-neutral-400">Built with secure-by-default controls</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-neutral-300 space-y-2 list-disc pl-5">
                <li>Row Level Security (RLS) per tenant — enforce permissions at the DB level.</li>
                <li>OAuth providers + JWT sessions, with optional MFA for admins.</li>
                <li>Encrypted backups and regular snapshot retention strategies.</li>
                <li>Audit logs for grading and attendance changes to ensure accountability.</li>
                <li>GDPR-aware data handling and export/delete workflows.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-200">Integrations & extensibility</CardTitle>
              <CardDescription className="text-neutral-400">Plug into your current tools</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-neutral-300 space-y-2 list-disc pl-5">
                <li>Storage adapters: Cloudflare R2, Google Drive, S3-compatible</li>
                <li>Authentication: Supabase, OAuth providers, SAML for enterprise</li>
                <li>CI & content: GitHub for code assignments and preview pipelines</li>
                <li>Calendar sync: iCal / Google Calendar export & integrations</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Roadmap / Vision expanded */}
      <Section id="roadmap">
        <Kicker icon={Map}>Roadmap</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Where we’re headed</h2>
        <p className="text-neutral-400 max-w-3xl">We prioritize features that improve learning outcomes and mentor efficiency. Below is a high-level timeline of planned improvements and milestones.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Short Term ",
              items: [
                "Improved mobile experience and PWA support",
                "Shared real-time notes and collaborative editing",
                "Group task assignments and improved reminders",
              ],
            },
            {
              title: "Medium Term ",
              items: [
                "AI-driven study recommendations & task summarization",
                "Auto-tagger for resources and notes",
                "Advanced analytics & cohort benchmarking",
              ],
            },
            {
              title: "Long Term ",
              items: [
                "SSO / SAML & enterprise management",
                "Offline-first mobile sync and push notifications",
                "Pluggable plugin system & community marketplace",
              ],
            },
          ].map((r, i) => (
            <Card key={i} className="bg-neutral-900/60 p-4 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-emerald-200">{r.title}</CardTitle>
                <CardDescription className="text-neutral-400">{r.items.length} initiatives</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-neutral-300 list-disc pl-5 space-y-2">
                  {r.items.map((it, idx) => (<li key={idx}>{it}</li>))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Testimonials & Social Proof (expanded) */}
      <Section id="testimonials">
        <Kicker icon={Users2}>Social Proof</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Trusted by mentors & admin</h2>
        <p className="text-neutral-400 max-w-2xl">Examples from programs using SVIT for their internship tracks and project-based learning.</p>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Vinay",
              title: "Lead Mentor,  Internship",
              org: "SVIT",
              quote: "SVIT streamlined our mentorship process; analytics highlighted students needing help early.",
            },
            {
              name: "Vyshanavi",
              title: "Trainer of Internship",
              org: "SVIT",
              quote: "I used SVIT's task manager and notes to stay on track. The link saver kept all resources handy.",
            },
            {
              name: "Sushma",
              title: "Moderator",
              org: "SVIT",
              quote: "Certificates and exportable transcripts made evaluation transparent for students and employers.",
            },
          ].map((t, i) => (
            <Card key={i} className="bg-neutral-900/60 p-6 rounded-2xl">
              <div className="text-neutral-300 italic">“{t.quote}”</div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-bold">{t.name.split(" ")[0][0]}</div>
                <div>
                  <div className="font-semibold text-emerald-200">{t.name}</div>
                  <div className="text-sm text-neutral-400">{t.title} — {t.org}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader><CardTitle className="text-emerald-200">Impact snapshot</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-neutral-300 list-disc pl-5">
                <li>30% faster onboarding</li>
                <li>25% fewer missed deadlines</li>
                <li>Better mentor-to-intern communication</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader><CardTitle className="text-emerald-200">Academic partners</CardTitle></CardHeader>
            <CardContent>
              <div className="text-neutral-300">Collaboration with universities for capstone projects and internship credit tracking.</div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader><CardTitle className="text-emerald-200">Community</CardTitle></CardHeader>
            <CardContent>
              <div className="text-neutral-300">Open dev community on GitHub — contribute templates and share course blueprints.</div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* FAQ (expanded) */}
      <Section id="faq">
        <Kicker icon={HelpCircle}>FAQ</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Frequently asked questions</h2>
        <p className="text-neutral-400 max-w-3xl">Detailed answers to common questions. If you need more, contact support or open an issue on GitHub.</p>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Accordion type="single" collapsible className="bg-neutral-900/60 rounded-2xl p-4">
            <AccordionItem value="q1">
              <AccordionTrigger>Is SVIT really free?</AccordionTrigger>
              <AccordionContent>Yes — the core SVIT platform is free to use for internship teams. Additional paid services (e.g., enterprise onboarding, hosted backups) may be available later, but the core features remain free.</AccordionContent>
            </AccordionItem>

           

            <AccordionItem value="q3">
              <AccordionTrigger>How does authentication work?</AccordionTrigger>
              <AccordionContent>SVIT uses Supabase for authentication (OAuth + email/password). Enterprise customers can enable SAML/SSO. Sessions are JWT-based and can be integrated with your identity provider.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q4">
              <AccordionTrigger>Can I export data?</AccordionTrigger>
              <AccordionContent>Yes. Export attendance, grades, and activity logs in CSV/JSON. GDPR/Right-to-erase workflows are supported for users who request data removal.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q5">
              <AccordionTrigger>Are there integrations with GitHub?</AccordionTrigger>
              <AccordionContent>We integrate with GitHub to support repo-linked assignments, automated test feedback, and preview deployments for code submissions.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q6">
              <AccordionTrigger>How do I onboard mentors?</AccordionTrigger>
              <AccordionContent>Mentor onboarding is walkthrough-driven: create an account, invite mentors, and assign admin/mentor roles. We provide templates to speed course creation.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q7">
              <AccordionTrigger>What accessibility support exists?</AccordionTrigger>
              <AccordionContent>We follow ARIA best practices, use semantic HTML, and provide keyboard navigation. Accessibility improvements are ongoing and prioritized.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q8">
              <AccordionTrigger>What are the API options?</AccordionTrigger>
              <AccordionContent>We provide REST endpoints, and plan to add a TypeScript-friendly SDK and webhooks. Primary integrations are documented in the developer docs.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q9">
              <AccordionTrigger>Can students share notes?</AccordionTrigger>
              <AccordionContent>Yes — notes can be private, shared with course groups, or exported. Shared notes support comments and version history.</AccordionContent>
            </AccordionItem>

            <AccordionItem value="q10">
              <AccordionTrigger>How are quizzes graded?</AccordionTrigger>
              <AccordionContent>MCQs can be auto-graded; subjective answers go to a review queue for manual grading with rubrics. Time-limited quizzes are supported per course settings.</AccordionContent>
            </AccordionItem>
          </Accordion>

          <Card className="bg-neutral-900/60 p-4 rounded-xl">
            <CardHeader><CardTitle className="text-emerald-200">Still have questions?</CardTitle><CardDescription className="text-neutral-400">Contact us or open a discussion on GitHub.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); alert("Thank You, Use SVIT-LMS"); }}>
                <div className="grid gap-3">
                  <Input placeholder="Your name" />
                  <Input placeholder="Email" />
                  <Textarea placeholder="How can we help?" />
                  <Button className="bg-emerald-500">Send Message</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Team & Open Source */}
      <Section id="team">
        <Kicker icon={Users2}>Team & Community</Kicker>
        <h2 className="text-3xl md:text-4xl font-bold mt-2">Built by a small, focused team</h2>
        <p className="text-neutral-400 max-w-3xl">We believe in open collaboration. SVIT is built with contribution-friendly patterns and welcomes community templates and course blueprints.</p>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            { name: "Eswar Chinthakayala", role: "Full-stack Engineer", bio: "Leads backend systems,DB design and Builds UI" },
            { 
              name: "Krishna Chaintanya", 
              role: "Design Reviewer", 
              bio: "Helps drive design improvement  & user-focused refinements." 
            },

          
          ].map((p, i) => (
            <Card key={i} className="bg-neutral-900/60 p-6 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-300">{p.name.split(" ")[0][0]}</div>
                <div>
                  <div className="font-semibold text-emerald-200">{p.name}</div>
                  <div className="text-sm text-neutral-400">{p.role}</div>
                  <div className="mt-2 text-neutral-300 text-sm">{p.bio}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-neutral-300">Open source contributions welcome — check our GitHub repo for issues and contribution guidelines.</div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Newsletter and call to action (since we removed pricing) */}
      <Section id="signup" className="bg-gradient-to-b from-neutral-900/30 to-neutral-900/10">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Kicker icon={Mail}>Stay updated</Kicker>
            <h2 className="text-3xl font-bold mt-2">Join the SVIT community</h2>
            <p className="text-neutral-400 mt-2 max-w-xl">Sign up to receive updates about new features, guides, and best practices for using SVIT in your internship program.</p>
          </div>

          <div>
            <form onSubmit={(e) => { e.preventDefault(); setNewsletterSent(true); setNewsletterEmail(""); }}>
              <div className="flex gap-3">
                <Input placeholder="Your work email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} />
                <Button className="bg-emerald-500" type="submit">Subscribe</Button>
              </div>
              <AnimatePresence>
                {newsletterSent && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-emerald-300">
                    Thanks — check your inbox for confirmation (demo).
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </Section>

      <Separator className="bg-white/6" />

      {/* Footer expanded */}
      <footer className="relative z-20 border-t border-white/8 bg-neutral-950/70">
        <div className="mx-auto max-w-7xl px-6 py-12 grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-emerald-300" />
              <div>
                <div className="text-lg font-bold">SVIT</div>
                <div className="text-xs text-neutral-400">LMS for internships</div>
              </div>
            </div>
            <p className="text-neutral-400 mt-4 text-sm max-w-sm">SVIT is focused on practical learning and mentor workflows. Free for internship teams — extensible and secure by design.</p>
            <div className="mt-4 flex gap-3 text-neutral-300">
              <a href="#" aria-label="GitHub"><Github className="w-5 h-5" /></a>
              <a href="#" aria-label="LinkedIn"><Linkedin className="w-5 h-5" /></a>
              <a href="#" aria-label="Twitter"><Twitter className="w-5 h-5" /></a>
              <a href="#" aria-label="Website"><Globe className="w-5 h-5" /></a>
            </div>
          </div>

          <div>
            <div className="font-semibold">Product</div>
            <ul className="mt-3 text-neutral-400 space-y-1 text-sm">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#product" className="hover:text-white">Product Tour</a></li>
              <li><a href="#roadmap" className="hover:text-white">Roadmap</a></li>
              <li><a href="#signup" className="hover:text-white">Newsletter</a></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold">Community & Docs</div>
            <ul className="mt-3 text-neutral-400 space-y-1 text-sm">
              <li><a href="#" className="hover:text-white">Docs</a></li>
              <li><a href="#" className="hover:text-white">API Reference</a></li>
              <li><a href="#" className="hover:text-white">GitHub</a></li>
              <li><a href="#" className="hover:text-white">Discussion</a></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold">Legal</div>
            <ul className="mt-3 text-neutral-400 space-y-1 text-sm">
              <li><a href="#" className="hover:text-white">Privacy</a></li>
              <li><a href="#" className="hover:text-white">Terms</a></li>
              <li><a href="#" className="hover:text-white">Security</a></li>
            </ul>
            <div className="mt-4 text-sm text-neutral-400">Contact: <a href="mailto:hello@svit.example" className="hover:text-white">hello@svit.example</a></div>
          </div>
        </div>

        <div className="border-t border-white/8 py-4 text-center text-xs text-neutral-500">© {new Date().getFullYear()} SVIT. All rights reserved.</div>
      </footer>

      {/* Demo modal (simple) */}
      <AnimatePresence>
        {showDemoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowDemoModal(false)} />
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.25 }} className="relative z-50 w-[92%] md:w-3/4 lg:w-2/3 bg-neutral-900/80 border border-white/8 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold">SVIT Demo Walkthrough</div>
                  <div className="text-sm text-neutral-400">A short tour of the student & mentor experience (demo content).</div>
                </div>
                <div><Button variant="ghost" className="bg-white text-black cursor-pointer" onClick={() => setShowDemoModal(false)}>Close</Button></div>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className="bg-neutral-800/30 rounded-lg p-4 min-h-[220px] flex items-center justify-center text-neutral-300">Demo video / interactive preview placeholder</div>
                <div className="space-y-3">
                  <div className="text-neutral-300">Highlights:</div>
                  <ul className="list-disc pl-5 text-neutral-300">
                    <li>Course workspace & modules</li>
                    <li>Assignments & grading workflow</li>
                    <li>Attendance tools and analytics</li>
                    <li>Notes & link saver integration</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <Button variant="ghost" className="bg-white text-black cursor-pointer" onClick={() => setShowDemoModal(false)}>Close</Button>
                <Button className="bg-emerald-500 cursor-pointer hover:bg-emerald-400">Open Demo Course</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- DeepDiveCard component (kept at bottom for reuse) ----------
function DeepDiveCard({ icon: Icon, title, points = [] }) {
  return (
    <Card className="bg-neutral-900/70 border-white/10 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-300" />{title}</CardTitle>
        <CardDescription>What’s included</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 md:grid-cols-2">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Small fallback icons already available (if missing) ----------
function HelpCircle(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* End of file: SVIT Landing Page — upgraded pro design with extended content */
