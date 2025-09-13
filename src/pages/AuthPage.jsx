// src/pages/AuthPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import emailjs from "emailjs-com";

import {
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  GraduationCap,
  UserPlus,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  BookOpen,
  LifeBuoy,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ---------- 3D Background ---------- //
function Background3D() {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          inset: 0,
          background: "#000",
        }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#22c55e" />
        <pointLight position={[-10, -10, -5]} intensity={0.7} color="#064e3b" />

        <Stars
          radius={80}
          depth={60}
          count={8000}
          factor={10}
          saturation={0}
          fade
          speed={1.2}
        />

        <OrbitControls
          enablePan={false}
          enableRotate={false}
          enableZoom={false}
        />
      </Canvas>

      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 400px at 20% 30%, rgba(16,185,129,0.06), transparent), radial-gradient(800px 500px at 80% 70%, rgba(6,95,70,0.05), transparent)",
          mixBlendMode: "screen",
        }}
      />

      <div className="absolute inset-0 backdrop-blur-[2px] opacity-30 pointer-events-none" />
    </div>
  );
}

// ---------- Helpers ---------- //
const fade = {
  initial: { opacity: 0, y: 10, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(6px)" },
  transition: { duration: 0.28, ease: "easeOut" },
};

function Field({ id, label, type = "text", icon: Icon, value, onChange, autoComplete }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-zinc-300 text-sm">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="pl-10 bg-black/40 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500"
          required
        />
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        )}
      </div>
    </div>
  );
}

// ---------- Main AuthPage ---------- //
export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const initialView = params.get("view") || "student-login";
  const initialTab = initialView.startsWith("student") ? "student" : "admin";
  const initialStudentView =
    initialView === "student-signup" ? "signup" : "login";

  const [tab, setTab] = useState(initialTab);
  const [studentView, setStudentView] = useState(initialStudentView);

  const syncUrl = (v) => {
    const sp = new URLSearchParams(location.search);
    sp.set("view", v);
    navigate({ pathname: "/login", search: sp.toString() }, { replace: true });
  };

  const setTabAndSync = (t) => {
    setTab(t);
    if (t === "admin") {
      syncUrl("admin");
    } else {
      syncUrl(studentView === "signup" ? "student-signup" : "student-login");
    }
  };

  const setStudentViewAndSync = (sv) => {
    setStudentView(sv);
    syncUrl(sv === "signup" ? "student-signup" : "student-login");
  };

  return (
    <div className="relative min-h-screen bg-[#05070a] text-white overflow-hidden">
      <Background3D />

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -25, scale: 0.88 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 120 }}
              className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-800/20 to-black/30 border border-emerald-600/20 grid place-items-center"
            >
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </motion.div>
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight">SVIT</div>
              <div className="text-[11px] text-zinc-400 -mt-0.5">
                All-in-One LMS for Teams
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Auth Card */}
            <Card className="bg-zinc-900/80 border-zinc-800 shadow-2xl backdrop-blur-md p-0 overflow-hidden">
              <div className="p-6">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center text-emerald-400 gap-3 text-xl">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    Secure sign in
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="grid gap-4">
                    {/* Student/Admin Toggle */}
                    <div className="grid grid-cols-2 bg-zinc-900/40 rounded-md p-1">
                      <button
                        className={`flex items-center cursor-pointer justify-center gap-2 py-2 rounded-md text-sm font-medium ${
                          tab === "student"
                            ? "bg-emerald-700/50 text-emerald-300"
                            : "text-zinc-300 bg-zinc-500/20"
                        }`}
                        onClick={() => setTabAndSync("student")}
                      >
                        <GraduationCap className="h-4 w-4" />
                        Student
                      </button>
                      <button
                        className={`flex items-center cursor-pointer justify-center gap-2 py-2 rounded-md text-sm font-medium ${
                          tab === "admin"
                            ? "bg-emerald-700/50 text-emerald-300"
                            : "text-zinc-300 bg-zinc-500/20"
                        }`}
                        onClick={() => setTabAndSync("admin")}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin
                      </button>
                    </div>

                    {/* Student sub-toggle */}
                    {tab === "student" && (
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant={studentView === "login" ? "secondary" : "ghost"}
                          onClick={() => setStudentViewAndSync("login")}
                          className="rounded cursor-pointer bg-zinc-400"
                        >
                          Login
                        </Button>
                        <Button
                          size="sm"
                          variant={studentView === "signup" ? "secondary" : "ghost"}
                          onClick={() => setStudentViewAndSync("signup")}
                          className="rounded cursor-pointer bg-zinc-400"
                        >
                          Sign up
                        </Button>
                      </div>
                    )}

                    <Separator className="my-4 bg-zinc-800" />

                    <AnimatePresence mode="wait">
                      {tab === "admin" ? (
                        <motion.div key="admin" {...fade}>
                          <AdminLogin onSuccess={navigate} />
                        </motion.div>
                      ) : studentView === "login" ? (
                        <motion.div key="student-login" {...fade}>
                          <StudentLogin onSuccess={navigate} />
                        </motion.div>
                      ) : (
                        <motion.div key="student-signup" {...fade}>
                          <StudentSignup onSuccess={navigate} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Right Info */}
            <motion.div
              initial={fade.initial}
              animate={fade.animate}
              transition={{ ...fade.transition, delay: 0.06 }}
              className="space-y-6"
            >
              <Card className="bg-gradient-to-br from-emerald-950/30 to-black/20 border-zinc-800/60 backdrop-blur-md">
                <CardContent className="relative overflow-hidden">
                  <div className="flex whitespace-nowrap animate-scroll space-x-16">
                    <span className="px-6 py-2 rounded-xl text-gray-300 bg-zinc-800/50 border border-zinc-700/40">
                      Fast and secure course access
                    </span>
                    <span className="px-6 py-2 rounded-xl text-gray-300 bg-zinc-800/50 border border-zinc-700/40">
                      Immersive galaxy-inspired interface
                    </span>
                    <span className="px-6 py-2 rounded-xl text-gray-300 bg-zinc-800/50 border border-zinc-700/40">
                      Personalized learning dashboard
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------- Forms ---------- //
function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const signIn = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const user = data.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,email,full_name")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") throw new Error("Not an admin account.");

      localStorage.setItem(
        "user",
        JSON.stringify({
          id: user.id,
          email: profile?.email || user.email,
          role: profile?.role,
        })
      );

      onSuccess?.("/admin");
    } catch (e2) {
      setErr(e2?.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={signIn} className="space-y-4">
      {err && (
        <Alert
          variant="destructive"
          className="bg-red-900/20 border-red-800 text-red-200"
        >
          <AlertTitle>Login error</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <Field
        id="admin-email"
        label="Admin Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        id="admin-password"
        label="Password"
        type="password"
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        type="submit"
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500"
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ShieldCheck className="h-4 w-4 mr-2" />
        )}
        Login as Admin
      </Button>
    </form>
  );
}

function StudentLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const signIn = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const user = data.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,email,full_name")
        .eq("id", user.id)
        .single();

      localStorage.setItem(
        "user",
        JSON.stringify({
          id: user.id,
          email: profile?.email || user.email,
          role: profile?.role,
        })
      );

      if (profile?.role === "admin") return onSuccess?.("/admin");
      onSuccess?.("/student");
    } catch (e2) {
      setErr(e2?.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={signIn} className="space-y-4">
      {err && (
        <Alert
          variant="destructive"
          className="bg-red-900/20 border-red-800 text-red-200"
        >
          <AlertTitle>Login error</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <Field
        id="student-email"
        label="Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        id="student-password"
        label="Password"
        type="password"
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        type="submit"
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500"
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ArrowRight className="h-4 w-4 mr-2" />
        )}
        Login
      </Button>
    </form>
  );
}

function StudentSignup({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const signUp = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    setOk("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      const user = data?.user;
      if (user?.id) {
        const { error: upsertErr } = await supabase.from("profiles").upsert(
          { id: user.id, email, full_name: fullName, role: "student" },
          { onConflict: "id" }
        );
        if (upsertErr) throw upsertErr;

        // store user for route guards
        try {
          localStorage.setItem(
            "user",
            JSON.stringify({
              id: user.id,
              email,
              role: "student",
              full_name: fullName,
            })
          );
        } catch (storageErr) {
          console.warn("localStorage set failed", storageErr);
        }

        // ✅ Send welcome email via EmailJS
        try {
          await emailjs.send(
            "service_lt59oyh",         // your service ID
            "template_iumjr6l",       // your template ID
            {
              name: fullName,
              email: email,
            },
            "5eg-iecaygcZvXtx5"       // your public key
          );
        } catch (mailErr) {
          console.warn("EmailJS error:", mailErr);
        }
      }

      setOk("Account created successfully! Redirecting to your dashboard...");

      setTimeout(() => {
        onSuccess?.("/student");
      }, 1400);
    } catch (e2) {
      setErr(e2?.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={signUp} className="space-y-4">
      {err && (
        <Alert
          variant="destructive"
          className="bg-red-900/20 border-red-800 text-red-200"
        >
          <AlertTitle>Signup error</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {ok && (
        <Alert className="bg-emerald-900/20 border-emerald-800 text-emerald-200">
          <AlertTitle>All set</AlertTitle>
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      )}

      <Field
        id="signup-name"
        label="Full name"
        type="text"
        icon={UserPlus}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
      />
      <Field
        id="signup-email"
        label="Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Field
        id="signup-password"
        label="Password"
        type="password"
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>By continuing you agree to our terms.</span>
        <Button
          type="submit"
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Create account
        </Button>
      </div>
    </form>
  );
}
