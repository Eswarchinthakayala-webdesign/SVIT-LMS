// src/pages/StudentSettingsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Settings, User, Key, LogOut, Check } from "lucide-react";

/**
 * StudentSettingsPage
 * - Updates full_name in profiles AND students tables
 * - Changes password only after verifying current password
 * - Improved UI, avatar initials, animations, validation & confirm dialogs
 */

export default function StudentSettingsPage() {
  const navigate = useNavigate();

  // profile
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // name edit
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // password change (requires current password)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // page load
  useEffect(() => {
    (async () => {
      setLoadingProfile(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setProfile(null);
          setLoadingProfile(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, created_at")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile(data);
          setFullName(data.full_name || "");
        } else {
          console.error("Profile fetch error:", error);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

  // avatar initials
  const initials = useMemo(() => {
    const name = profile?.full_name || profile?.email || "";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile]);

  // Save name -> update both profiles & students
  const saveName = async () => {
    if (!profile) return;
    const trimmed = (fullName || "").trim();
    if (!trimmed) {
      toast.error("Full name cannot be empty");
      return;
    }

    setSavingName(true);
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("id", profile.id);

      // Update students table (mirror)
      const { error: studentError } = await supabase
        .from("students")
        .update({ full_name: trimmed })
        .eq("id", profile.id);

      if (profileError || studentError) {
        console.error("Save name error:", profileError || studentError);
        toast.error("Failed to update name. Try again.");
      } else {
        setProfile((p) => ({ ...p, full_name: trimmed }));
        toast.success("Name updated (profiles & students)");
        setEditingName(false);
      }
    } catch (err) {
      console.error("Save name exception:", err);
      toast.error("Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  // Change password flow:
  // 1) Verify current password by attempting sign in with email + currentPassword
  // 2) If verified, call supabase.auth.updateUser({ password: newPassword })
  const handleChangePassword = async () => {
    if (!profile?.email) {
      toast.error("Profile not loaded");
      return;
    }
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter new password and confirm it");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setVerifying(true);
    try {
      // Verify by signing in with email + currentPassword
      const signin = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      // If error or no session, fail
      if (signin.error) {
        console.error("Current password verification failed:", signin.error);
        toast.error("Current password is incorrect");
        setVerifying(false);
        return;
      }

      // Verified — now update password
      setVerifying(false);
      setChangingPassword(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        toast.error("Failed to change password");
      } else {
        toast.success("Password changed successfully — you may be signed out of other sessions.");
        // clear fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Change password exception:", err);
      toast.error("Failed to change password");
    } finally {
      setVerifying(false);
      setChangingPassword(false);
    }
  };

  // Logout confirmation
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to sign out");
    }
  };

  const changePwdDisabled =
    !currentPassword ||
    !newPassword ||
    !confirmPassword ||
    newPassword !== confirmPassword ||
    newPassword.length < 8 ||
    verifying ||
    changingPassword;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02120f] via-[#04221f] to-[#071a17] text-slate-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-10">
        {/* Header */}
        <div className="flex items-center gap-6">
          <motion.div
            aria-hidden
            initial={{ rotate: 0, scale: 0.95, opacity: 0 }}
            animate={{ rotate: 360, scale: 1, opacity: 1 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            className="p-4 rounded-3xl bg-gradient-to-br from-emerald-400/6 to-cyan-400/6 shadow-2xl"
            style={{ width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Settings className="h-16 w-16 text-emerald-300" />
          </motion.div>

          <div>
            <motion.h1
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.45 }}
              className="text-4xl font-extrabold tracking-tight"
            >
              Student Settings
            </motion.h1>
            <motion.p
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.45 }}
              className="text-sm text-zinc-400 mt-2 max-w-2xl"
            >
              Manage your profile, keep your account secure, and sign out of sessions.
            </motion.p>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile card */}
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }}>
            <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm hover:shadow-emerald-500/10 transition-all">
              <CardHeader className="flex items-center gap-4 px-0">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-700/10 flex items-center justify-center text-emerald-200 font-semibold text-lg">
                    {initials}
                  </div>
                  <div>
                    <CardTitle className="text-emerald-300 flex items-center gap-2">
                      <User className="h-5 w-5" /> Profile
                    </CardTitle>
                    <p className="text-xs text-zinc-400">Personal information</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-0 pt-4 space-y-5">
                {loadingProfile ? (
                  <p className="text-zinc-400">Loading profile…</p>
                ) : profile ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">Email</label>
                      <div className="text-sm font-medium text-emerald-200">{profile.email}</div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">Full name</label>

                      {!editingName ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-emerald-200">
                            {profile.full_name || "Not set"}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer hover:bg-gray-200" onClick={() => setEditingName(true)}>
                              Edit
                            </Button>

                            {/* Confirm Save (when not editing we still show save button to confirm current displayed value) */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                                  Save
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-emerald-300">Save name</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Do you want to save your current name value?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={saveName} className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer">
                                    Confirm
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-zinc-800 text-emerald-100 border-zinc-700" placeholder="Enter full name" />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black">
                                Save
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-emerald-300">Confirm update</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Update your name to <span className="font-semibold text-emerald-400">{fullName}</span> ?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={saveName}
                                  className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
                                  disabled={savingName}
                                >
                                  {savingName ? "Saving..." : "Confirm"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <Button size="sm" variant="outline" className="border-zinc-700 cursor-pointer" onClick={() => { setEditingName(false); setFullName(profile.full_name || ""); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <Button size="sm" variant="ghost" className="border cursor-pointer text-white hover:text-gray-200 border-zinc-700 hover:bg-zinc-800" onClick={() => {
                        // toggle focus to password area
                        const el = document.getElementById("password-new");
                        if (el) el.focus();
                      }}>
                        <Key className="h-4 w-4 mr-2 text-zinc-200" /> Change password
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="bg-red-600 cursor-pointer hover:bg-red-500 text-black">
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-emerald-300">Sign out</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to sign out? You will need to log in again to access your account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleLogout} className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer">Sign out</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-400">No profile loaded</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Security card */}
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55 }}>
            <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm hover:shadow-emerald-500/10 transition-all">
              <CardHeader className="px-0">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-emerald-300" />
                  <CardTitle className="text-emerald-300">Security</CardTitle>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Change your password (requires current password)</p>
              </CardHeader>

              <CardContent className="px-0 pt-4 space-y-4">
                <div className="space-y-2">
                  <Input
                    id="password-current"
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-zinc-800 text-emerald-100 border-zinc-700"
                    aria-label="Current password"
                  />
                  <Input
                    id="password-new"
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-zinc-800 text-emerald-100 border-zinc-700"
                    aria-label="New password"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-zinc-800 text-emerald-100 border-zinc-700"
                    aria-label="Confirm new password"
                  />

                  <div className="text-xs">
                    {currentPassword && newPassword && (
                      newPassword.length < 8 ? (
                        <span className="text-yellow-300">New password should be at least 8 characters</span>
                      ) : newPassword !== confirmPassword ? (
                        <span className="text-red-400">Passwords do not match</span>
                      ) : (
                        <span className="text-emerald-300">Passwords match</span>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black"
                        disabled={changePwdDisabled}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Change Password
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-emerald-300">Confirm password change</AlertDialogTitle>
                        <AlertDialogDescription>
                          We'll verify your current password before changing it. Continue?
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleChangePassword}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
                          disabled={verifying || changingPassword}
                        >
                          {verifying || changingPassword ? "Processing..." : "Confirm"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" className="border-zinc-700 cursor-pointer" onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}>
                    Reset
                  </Button>
                </div>

                <div className="pt-2 text-xs text-zinc-500">
                  Note: Changing password will update your account credential immediately. You may be logged out of other sessions.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* footer tip */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
          <p className="text-sm text-zinc-400">Tip: Use a unique long password and enable MFA for better security.</p>
        </motion.div>
      </div>
    </div>
  );
}
