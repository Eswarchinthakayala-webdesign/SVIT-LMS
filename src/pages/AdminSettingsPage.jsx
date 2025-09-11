// src/pages/AdminSettingsPage.jsx
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

import { Shield, User, Key, LogOut, Check } from "lucide-react";

export default function AdminSettingsPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // name
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
          .select("id, email, full_name, role")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile(data);
          setFullName(data.full_name || "");
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
    if (parts.length === 0) return "A";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile]);

  // update name (admins don’t exist in students table, so only profiles update)
  const saveName = async () => {
    if (!profile) return;
    const trimmed = (fullName || "").trim();
    if (!trimmed) {
      toast.error("Full name cannot be empty");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("id", profile.id);

      if (error) {
        console.error("Save name error:", error);
        toast.error("Failed to update name");
      } else {
        setProfile((p) => ({ ...p, full_name: trimmed }));
        toast.success("Name updated");
        setEditingName(false);
      }
    } catch (err) {
      console.error("Save name exception:", err);
      toast.error("Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  // password change
  const handleChangePassword = async () => {
    if (!profile?.email) return;
    if (!currentPassword) {
      toast.error("Please enter current password");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter and confirm new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setVerifying(true);
    try {
      // verify current password
      const signin = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signin.error) {
        toast.error("Current password incorrect");
        setVerifying(false);
        return;
      }

      setVerifying(false);
      setChangingPassword(true);

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        toast.error("Failed to change password");
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Password change error:", err);
      toast.error("Failed to change password");
    } finally {
      setVerifying(false);
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to logout");
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
    <div className="min-h-screen bg-gradient-to-b from-[#0c1110] via-[#04221f] to-[#071a17] text-slate-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-10">
        {/* Header */}
        <div className="flex items-center gap-6">
          <motion.div
            initial={{ rotate: 0, scale: 0.9, opacity: 0 }}
            animate={{ rotate: 360, scale: 1, opacity: 1 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            className="p-4 rounded-3xl bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 shadow-xl"
            style={{ width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Shield className="h-16 w-16 text-emerald-300" />
          </motion.div>
          <div>
            <h1 className="text-4xl font-extrabold">Admin Settings</h1>
            <p className="text-sm text-zinc-400 mt-2">
              Manage your admin profile, update password, and logout securely.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile */}
          <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <CardHeader className="flex items-center gap-4 px-0">
              <div className="w-14 h-14 rounded-full bg-emerald-700/10 flex items-center justify-center text-emerald-200 font-bold text-lg">
                {initials}
              </div>
              <div>
                <CardTitle className="text-emerald-300 flex items-center gap-2">
                  <User className="h-5 w-5" /> Profile
                </CardTitle>
                <p className="text-xs text-zinc-400">Admin information</p>
              </div>
            </CardHeader>

            <CardContent className="px-0 pt-4 space-y-4">
              {loadingProfile ? (
                <p className="text-zinc-400">Loading...</p>
              ) : profile ? (
                <>
                  <div>
                    <p className="text-xs text-zinc-400">Email</p>
                    <p className="font-medium text-emerald-400">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Full name</p>
                    {!editingName ? (
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400">{profile.full_name || "Not set"}</span>
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setEditingName(true)}>
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="bg-zinc-800 text-emerald-100 border-zinc-700"
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 cursor-pointer text-black">
                              Save
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-emerald-300">Update name</AlertDialogTitle>
                              <AlertDialogDescription>
                                Save your name as <span className="font-semibold text-emerald-400">{fullName}</span>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="text-black cursor-pointer">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer" onClick={saveName}>
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button size="sm" className="cursor-pointer" variant="outline" onClick={() => setEditingName(false)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full bg-red-600 cursor-pointer hover:bg-red-500 mt-4">
                        <LogOut className="h-4 w-4 mr-2" /> Logout
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-emerald-300">Confirm Logout</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to log out?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-black cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-500 hover:bg-red-400 cursor-pointer" onClick={handleLogout}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <p className="text-zinc-400">No profile loaded</p>
              )}
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <Key className="h-5 w-5" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-zinc-800 text-emerald-100 border-zinc-700"
              />
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-zinc-800 text-emerald-100 border-zinc-700"
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-zinc-800 text-emerald-100 border-zinc-700"
              />
              <div className="flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="bg-emerald-500 cursor-pointer hover:bg-emerald-400 text-black"
                      disabled={changePwdDisabled}
                    >
                      <Check className="h-4 w-4 mr-2" /> Change Password
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-emerald-300">
                        Confirm password change
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Verify your current password before changing.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer text-black">Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-emerald-400 text-black cursor-pointer hover:bg-emerald-300" onClick={handleChangePassword}>
                        {verifying || changingPassword ? "Processing..." : "Confirm"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="outline"
                  className="border-zinc-700 cursor-pointer"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
