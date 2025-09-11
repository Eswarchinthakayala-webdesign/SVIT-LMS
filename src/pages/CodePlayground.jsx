import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Play,
  Save,
  Sun,
  Moon,
  Code,
  Terminal,
  FileText,
  Download,
  Trash2,
  Plus,
  X,
  Search,
  Settings,
  Maximize,
  Minimize,
  Copy,
  AlertCircle,
} from "lucide-react";

/* ---------------------------------------
   TEMPLATES & UTILITIES
   --------------------------------------- */

const TEMPLATES = {
  "index.html": {
    name: "index.html",
    language: "html",
    content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root">Hello Frontend (Edit index.html, styles.css, script.js)</div>
  </body>
</html>`,
  },
  "styles.css": {
    name: "styles.css",
    language: "css",
    content:
      `:root{--bg:#0b1220;--muted:#94a3b8;--accent:#10b981;--card:#0f1724}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:#fff;margin:0;padding:14px}`,
  },
  "script.js": {
    name: "script.js",
    language: "javascript",
    content:
      `console.log("Hello from script.js");document.getElementById('root').innerText = 'Hello from script.js';`,
  },
  "main.py": {
    name: "main.py",
    language: "python",
    content:
      `print("Hello from Python")\nfor i in range(3):\n    print("Line", i+1)\n`,
  },
  "README.md": {
    name: "README.md",
    language: "markdown",
    content:
      `# Sample Project\n\nThis README is styled like GitHub's README. Code blocks have a copy button. You can edit this file and preview it here.\n\n\`\`\`js\n// Example code block\nconsole.log("Hello world");\n\`\`\`\n`,
  },
};

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function detectLanguageFromName(name) {
  const ext = (name || "").split(".").pop();
  if (ext === "py") return "python";
  if (ext === "html") return "html";
  if (ext === "css") return "css";
  if (ext === "md") return "markdown";
  if (ext === "js") return "javascript";
  return "plaintext";
}

function safeLocalGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function safeLocalSet(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
}

/* ---------------------------------------
   Component
   --------------------------------------- */

export default function CodePlayground() {
  // --- Files/data ---
  const [files, setFiles] = useState(() => safeLocalGet("cp2_files_v1", TEMPLATES));

  // open tabs — keep list but default to the language primary file
  const [openTabs, setOpenTabs] = useState(() => safeLocalGet("cp2_tabs_v1", ["main.py"]));
  const [activeFile, setActiveFile] = useState(() => safeLocalGet("cp2_active_v1", "main.py"));

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => safeLocalGet("cp2_sidebar_collapsed_v1", false));
  const [theme, setTheme] = useState(() => safeLocalGet("cp2_theme_v1", "dark"));
  const [fontSize, setFontSize] = useState(() => safeLocalGet("cp2_font_v1", 14));
  const [showSettings, setShowSettings] = useState(false);

  // Output / console
  const [consoleLines, setConsoleLines] = useState(() => safeLocalGet("cp2_console_v1", []));
  const [errors, setErrors] = useState([]); // errors from runs
  const [outputTab, setOutputTab] = useState("console"); // console | output | errors
  const [isRunning, setIsRunning] = useState(false);

  // right preview panel
  const [rightPanelOpen, setRightPanelOpen] = useState(() => rightPanelOpenDefault());

  // refs
  const editorRef = useRef(null);
  const iframeRef = useRef(null);
  const pyodideRef = useRef(null); // store pyodide instance
  const pyLoadingRef = useRef(false);

  // persist
  useEffect(() => safeLocalSet("cp2_files_v1", files), [files]);
  useEffect(() => safeLocalSet("cp2_tabs_v1", openTabs), [openTabs]);
  useEffect(() => safeLocalSet("cp2_active_v1", activeFile), [activeFile]);
  useEffect(() => safeLocalSet("cp2_sidebar_collapsed_v1", sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => safeLocalSet("cp2_theme_v1", theme), [theme]);
  useEffect(() => safeLocalSet("cp2_font_v1", fontSize), [fontSize]);
  useEffect(() => safeLocalSet("cp2_console_v1", consoleLines), [consoleLines]);

  /* -------------------------
     Languages list behavior
     ------------------------- */
  const LANGUAGES = [
    { id: "javascript", label: "JavaScript", files: ["script.js"] },
    { id: "python", label: "Python", files: ["main.py"] },
    { id: "html", label: "HTML/CSS", files: ["index.html", "styles.css", "script.js"] },
    { id: "markdown", label: "Markdown", files: ["README.md"] },
  ];

  // Open a language — open its primary files (first one becomes active)
  function openLanguage(langId) {
    const lang = LANGUAGES.find((l) => l.id === langId);
    if (!lang) return;
    // add those files to files if missing (create from templates)
    const newFiles = { ...files };
    lang.files.forEach((fname) => {
      if (!newFiles[fname]) {
        const langFromName = detectLanguageFromName(fname);
        newFiles[fname] = {
          name: fname,
          language: langFromName,
          content: TEMPLATES[fname]?.content || "",
        };
      }
    });
    setFiles(newFiles);
    // set open tabs (bring requested files to front, keep others)
    setOpenTabs((prev) => {
      const added = lang.files.filter((f) => !prev.includes(f));
      return [...added, ...prev];
    });
    setActiveFile(lang.files[0]);
  }

  /* -------------------------
     Console helpers
     ------------------------- */
  const pushConsole = useCallback((type, text) => {
    setConsoleLines((s) => [...s, { id: uid("c"), t: Date.now(), type, text }]);
  }, []);
  const clearConsole = useCallback(() => setConsoleLines([]), []);

  /* -------------------------
     Run JS (sandboxed in hidden iframe) & capture logs
     ------------------------- */
  async function runJS(code) {
    clearConsole();
    setErrors([]);
    pushConsole("info", "Running JavaScript...");
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      // patch console inside iframe
      if (win) {
        win.console.log = function (...args) {
          pushConsole("log", args.map(String).join(" "));
        };
        win.console.error = function (...args) {
          pushConsole("error", args.map(String).join(" "));
        };
        win.console.info = function (...args) {
          pushConsole("info", args.map(String).join(" "));
        };
        try {
          const fn = new win.Function(code);
          fn();
          pushConsole("info", "JS finished.");
        } catch (err) {
          pushConsole("error", String(err));
          setErrors((e) => [...e, { id: uid("err"), when: Date.now(), message: String(err) }]);
        }
      } else {
        pushConsole("error", "Failed to create iframe sandbox");
      }
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 50);
    } catch (err) {
      pushConsole("error", String(err));
      setErrors((e) => [...e, { id: uid("err"), when: Date.now(), message: String(err) }]);
    }
  }

  /* -------------------------
     Pyodide integration (python)
     ------------------------- */
  async function ensurePyodide() {
    if (pyodideRef.current) return pyodideRef.current;
    if (pyLoadingRef.current) return null;
    pyLoadingRef.current = true;
    pushConsole("info", "Loading Pyodide...");
    try {
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js";
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      // eslint-disable-next-line no-undef
      const py = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/" });
      pyodideRef.current = py;
      pushConsole("info", "Pyodide ready");
      return py;
    } catch (err) {
      pushConsole("error", "Pyodide failed: " + String(err));
      setErrors((e) => [...e, { id: uid("err"), when: Date.now(), message: String(err) }]);
      return null;
    } finally {
      pyLoadingRef.current = false;
    }
  }

  async function runPython(code) {
    clearConsole();
    setErrors([]);
    pushConsole("info", "Running Python...");
    try {
      const py = await ensurePyodide();
      if (!py) {
        pushConsole("error", "Pyodide not available");
        return;
      }
      py.setStdout({ batched: (s) => pushConsole("log", s) });
      py.setStderr({ batched: (s) => pushConsole("error", s) });
      await py.runPythonAsync(code);
      pushConsole("info", "Python finished");
    } catch (err) {
      pushConsole("error", String(err));
      setErrors((e) => [...e, { id: uid("err"), when: Date.now(), message: String(err) }]);
    }
  }

  /* -------------------------
     Frontend preview (index.html + styles.css + script.js)
     ------------------------- */
  function runFrontend() {
    clearConsole();
    pushConsole("info", "Updating preview...");
    const html = files["index.html"]?.content || "";
    const css = files["styles.css"]?.content || "";
    const js = files["script.js"]?.content || "";
    // build srcdoc
    const srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html,body{height:100%;margin:0;padding:0;box-sizing:border-box;overflow:auto}
  ${css}
  /* ensure images and content scale and don't overflow */
  img{max-width:100%;height:auto;display:block}
  pre,code{white-space:pre-wrap;word-break:break-word}
</style>
</head>
<body>
<div id="__playground_root" style="min-height:100%;box-sizing:border-box">${html}</div>
<script>
window.addEventListener('error', function(e) {
  parent.postMessage({ __cp_preview_error: String(e.error || e.message) }, '*');
});
try {
  ${js}
} catch (e) {
  parent.postMessage({ __cp_preview_error: String(e) }, '*');
}
</script>
</body>
</html>`;
    if (iframeRef.current) {
      iframeRef.current.srcdoc = srcdoc;
      pushConsole("info", "Preview updated");
    } else {
      pushConsole("error", "Preview frame missing");
    }
  }

  useEffect(() => {
    function onMsg(e) {
      if (e.data && e.data.__cp_preview_error) {
        pushConsole("error", String(e.data.__cp_preview_error));
        setErrors((prev) => [...prev, { id: uid("err"), when: Date.now(), message: String(e.data.__cp_preview_error) }]);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [pushConsole]);

  /* -------------------------
     Run dispatcher for active file
     ------------------------- */
  async function runActive() {
    if (!activeFile) {
      toast.error("No active file selected");
      return;
    }
    setIsRunning(true);
    try {
      const doc = files[activeFile];
      if (!doc) {
        toast.error("File not found");
        return;
      }
      if (doc.language === "javascript") {
        await runJS(doc.content);
      } else if (doc.language === "python") {
        await runPython(doc.content);
      } else if (activeFile === "index.html" || doc.language === "html") {
        runFrontend();
      } else if (doc.language === "markdown") {
        // nothing to run, but update preview
        pushConsole("info", "Markdown preview refreshed");
      } else {
        pushConsole("info", "File type not runnable");
      }
    } finally {
      setIsRunning(false);
    }
  }

  /* -------------------------
     Files helpers
     ------------------------- */
  function createFile(name, content = "") {
    if (!name) return;
    if (files[name]) {
      toast.error("File exists");
      return;
    }
    const lang = detectLanguageFromName(name);
    const clone = { ...files, [name]: { name, language: lang, content } };
    setFiles(clone);
    setOpenTabs((t) => [name, ...t]);
    setActiveFile(name);
    toast.success("File created");
  }

  function deleteFile(name) {
    if (!files[name]) return;
    const clone = { ...files };
    delete clone[name];
    setFiles(clone);
    setOpenTabs((t) => t.filter((x) => x !== name));
    if (activeFile === name) setActiveFile(Object.keys(clone)[0] || "");
    toast.success("File deleted");
  }

  function renameFile(oldName, newName) {
    if (!files[oldName] || files[newName]) {
      toast.error("Invalid rename");
      return;
    }
    const clone = { ...files };
    clone[newName] = { ...clone[oldName], name: newName, language: detectLanguageFromName(newName) };
    delete clone[oldName];
    setFiles(clone);
    setOpenTabs((t) => t.map((x) => (x === oldName ? newName : x)));
    if (activeFile === oldName) setActiveFile(newName);
    toast.success("Renamed");
  }

  function updateActiveContent(value) {
    if (!activeFile) return;
    setFiles((prev) => ({ ...prev, [activeFile]: { ...prev[activeFile], content: value } }));
  }

  /* -------------------------
     Export / download logs / project
     ------------------------- */
  function exportProjectJSON() {
    const payload = { files, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    a.click();
  }

  function downloadLogs() {
    const text = consoleLines.map(l => `[${new Date(l.t).toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.text}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `console-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.log`;
    a.click();
  }

  /* -------------------------
     Keyboard Shortcuts
     ------------------------- */
  useEffect(() => {
    function onKey(e) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        // Save (local autosave already occurs)
        toast.success("Saved (local)");
      }
      if (meta && e.key === "Enter") {
        e.preventDefault();
        runActive();
      }
      if (meta && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runActive]);

  /* -------------------------
     Markdown renderer with copyable code blocks and GitHub-like styling
     ------------------------- */

  function CodeBlockRenderer({ node, inline, className, children, ...props }) {
    const lang = (className || "").replace("language-", "") || "code";
    const text = String(children).replace(/\n$/, "");

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Code copied");
      } catch {
        toast.error("Copy failed");
      }
    };

    return (
      <div style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: theme === "dark" ? "#0b1220" : "#f6f8fa", borderBottom: theme === "dark" ? "1px solid #071019" : "1px solid rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 12, color: theme === "dark" ? "#94a3b8" : "#6b7280" }}>{lang}</div>
          <div>
            <button onClick={handleCopy} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
              <Copy />
            </button>
          </div>
        </div>
        <pre style={{ margin: 0, padding: 12, overflowX: "auto", background: theme === "dark" ? "#020617" : "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: Math.max(12, fontSize - 1) }}>
          <code>{text}</code>
        </pre>
      </div>
    );
  }

  /* -------------------------
     Derived data
     ------------------------- */
  const fileList = useMemo(() => Object.keys(files), [files]);
  const activeDoc = files[activeFile];

  /* -------------------------
     Theming values
     ------------------------- */
  const themeStyles = useMemo(() => {
    if (theme === "dark") {
      return {
        background: "#071019",
        card: "#0b1220",
        border: "#0f1724",
        text: "#e6eef6",
        muted: "#94a3b8",
        accent: "#10B981",
        panelBg: "#071019",
        codeBg: "#020617",
      };
    } else {
      return {
        background: "#f6f8fa",
        card: "#ffffff",
        border: "#e6e6e6",
        text: "#0f1724",
        muted: "#475569",
        accent: "#0f766e",
        panelBg: "#ffffff",
        codeBg: "#ffffff",
      };
    }
  }, [theme]);

  /* -------------------------
     Helpers for right panel width
     ------------------------- */
  function rightPanelOpenDefault() {
    try {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      return vw >= 900;
    } catch {
      return true;
    }
  }

  function rightPanelVisibleWidth() {
    if (!rightPanelOpen) return 0;
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    if (vw < 900) return 0;
    if (vw < 1200) return 320;
    return 360;
  }

  /* -------------------------
     UI JSX
     ------------------------- */
  return (
    <div style={{ background: themeStyles.background, color: themeStyles.text, minHeight: "100vh", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      {/* Inline CSS for GitHub-like markdown & other small adjustments */}
      <style>{`
        /* Markdown (GitHub-like) basic styles, scoped via .cp-markdown */
        .cp-markdown { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; line-height: 1.6; color: ${theme === "dark" ? "#cbd5e1" : "#0f1724"}; }
        .cp-markdown h1 { font-size: 1.8rem; margin: 0.6rem 0; color: ${theme === "dark" ? "#ffffff" : "#0f1724"}; }
        .cp-markdown h2 { font-size: 1.4rem; margin: 0.6rem 0; }
        .cp-markdown p { margin: 0.4rem 0; }
        .cp-markdown ul { padding-left: 1.2rem; }
        .cp-markdown a { color: ${theme === "dark" ? "#60a5fa" : "#0366d6"}; }
        .cp-markdown pre { background: ${theme === "dark" ? "#020617" : "#f6f8fa"}; padding: 12px; border-radius: 6px; overflow-x:auto; }
        .cp-markdown code { background: ${theme === "dark" ? "#021024" : "#f6f8fa"}; padding: 2px 6px; border-radius: 4px; font-family: JetBrains Mono, monospace; }
        /* buttons and inputs */
        .cp-btn { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
      `}</style>

      {/* Top toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: `1px solid ${themeStyles.border}`, background: themeStyles.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: themeStyles.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Code />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{/* Title */}Pro Code Editor</div>
            <div style={{ fontSize: 12, color: themeStyles.muted }}>Modern editor • live preview • console</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="cp-btn" onClick={runActive} style={{ background: themeStyles.accent, color: theme === "dark" ? "#041014" : "#fff" }}>
            <Play /> Run
          </button>
          <button className="cp-btn" onClick={() => { safeLocalSet("cp2_files_v1", files); toast.success("Saved locally"); }} style={{ background: "transparent", border: `1px solid ${themeStyles.border}`, color: themeStyles.text }}>
            <Save /> Save
          </button>
          <button className="cp-btn" onClick={() => exportProjectJSON()} style={{ background: "transparent", border: `1px solid ${themeStyles.border}`, color: themeStyles.text }}>
            <Download /> Export
          </button>

          <div style={{ width: 1, height: 28, background: themeStyles.border, marginLeft: 6, marginRight: 6 }} />

          <button className="cp-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{ background: "transparent", border: `1px solid ${themeStyles.border}`, color: themeStyles.text }}>
            {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light" : "Dark"}
          </button>

          <button className="cp-btn" onClick={() => setShowSettings((s) => !s)} style={{ background: "transparent", border: `1px solid ${themeStyles.border}`, color: themeStyles.text }}>
            <Settings /> Settings
          </button>

          <button onClick={() => setSidebarCollapsed((s) => !s)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} style={{ background: "transparent", border: "none", padding: 8, borderRadius: 8 }}>
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 72px)" }}>
        {/* Sidebar (languages) */}
        <div style={{
          width: sidebarCollapsed ? 64 : 220,
          transition: "width 200ms",
          borderRight: `1px solid ${themeStyles.border}`,
          background: themeStyles.card,
          paddingTop: 10,
          boxSizing: "border-box"
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            {LANGUAGES.map((lang) => (
              <button key={lang.id} onClick={() => openLanguage(lang.id)} title={`Open ${lang.label}`} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                textAlign: "left",
                background: activeFile && lang.files.includes(activeFile) ? theme === "dark" ? "#09221a" : "#eefbf7" : "transparent",
                color: themeStyles.text,
                border: "none",
                cursor: "pointer",
                width: "100%",
                boxSizing: "border-box"
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: theme === "dark" ? "#072826" : "#e6f6ef", display: "flex", alignItems: "center", justifyContent: "center", color: theme === "dark" ? "#7ee3b8" : "#0f766e" }}>
                  {lang.id === "javascript" ? <Code /> : lang.id === "python" ? <Terminal /> : lang.id === "html" ? <FileText /> : <FileText />}
                </div>
                {!sidebarCollapsed && <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{lang.label}</div>
                  <div style={{ fontSize: 12, color: themeStyles.muted }}>{lang.files.join(", ")}</div>
                </div>}
              </button>
            ))}
          </div>

          {/* bottom quick actions in sidebar */}
          <div style={{ marginTop: "auto", padding: 12 }}>
            {!sidebarCollapsed && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    const name = prompt("New file name (e.g. hello.js)");
                    if (name) createFile(name, "");
                  }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}>
                    <Plus /> New
                  </button>
                  <button onClick={() => exportProjectJSON()} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}>
                    <Download />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: editor & tabs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${themeStyles.border}`, background: themeStyles.panelBg, overflowX: "auto" }}>
            {openTabs.map((tab) => (
              <div key={tab} style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: activeFile === tab ? (theme === "dark" ? "#0a1e18" : "#eafaf1") : "transparent",
                cursor: "pointer",
                border: `1px solid ${activeFile === tab ? themeStyles.accent : "transparent"}`
              }} onClick={() => setActiveFile(tab)}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tab}</div>
                <button onClick={(e) => { e.stopPropagation(); setOpenTabs((t) => t.filter((x) => x !== tab)); if (activeFile === tab) setActiveFile(openTabs.find((x) => x !== tab) || Object.keys(files)[0] || ""); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X />
                </button>
              </div>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent", color: themeStyles.text }}>
                {[12, 13, 14, 15, 16, 18, 20].map((s) => <option key={s} value={s}>{s}px</option>)}
              </select>
              <button onClick={() => { if (files["index.html"]) { setActiveFile("index.html"); if (!openTabs.includes("index.html")) setOpenTabs((t) => ["index.html", ...t]); } }} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}>Open Preview</button>
            </div>
          </div>

          {/* Editor area and right preview panel */}
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* Editor */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Editor
                key={activeFile}
                height="100%"
                theme={theme === "dark" ? "vs-dark" : "light"}
                defaultLanguage={activeDoc?.language || "javascript"}
                language={activeDoc?.language || "javascript"}
                value={activeDoc?.content || ""}
                onChange={(val) => updateActiveContent(val || "")}
                onMount={(editor) => (editorRef.current = editor)}
                options={{
                  fontSize,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  wordWrap: "on",
                }}
              />
            </div>

            {/* Right preview / info panel */}
            <div style={{
              width: rightPanelVisibleWidth(),
              borderLeft: `1px solid ${themeStyles.border}`,
              background: themeStyles.card,
              display: rightPanelOpen ? "block" : "none",
              overflow: "auto"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: `1px solid ${themeStyles.border}` }}>
                <div style={{ fontWeight: 700 }}>Preview & Info</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setRightPanelOpen((s) => !s)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                    {rightPanelOpen ? <Minimize /> : <Maximize />}
                  </button>
                </div>
              </div>

              <div style={{ padding: 12 }}>
                {/* Preview */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: themeStyles.muted, marginBottom: 6 }}>Preview</div>
                  <div style={{ width: "100%", height: 280, background: "#fff", borderRadius: 8, overflow: "hidden", border: `1px solid ${theme === "dark" ? "#0b1220" : "#e6e6e6"}` }}>
                    {activeDoc?.language === "markdown" ? (
                      <div className="cp-markdown" style={{ padding: 12, maxHeight: "100%", overflow: "auto", background: theme === "dark" ? "#071019" : "#fff" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          code: ({node, inline, className, children, ...props}) => {
                            if (inline) {
                              return <code style={{ background: theme === "dark" ? "#021024" : "#f6f8fa", padding: "2px 6px", borderRadius: 6 }}>{children}</code>;
                            }
                            return <CodeBlockRenderer className={className}>{children}</CodeBlockRenderer>;
                          }
                        }}>
                          {activeDoc?.content || ""}
                        </ReactMarkdown>
                      </div>
                    ) : (activeFile === "index.html" || activeDoc?.language === "html") ? (
                      <iframe ref={iframeRef} title="preview" style={{ width: "100%", height: "100%", border: 0 }} />
                    ) : (
                      <div style={{ padding: 12, color: themeStyles.muted }}>No live preview for this file. To preview HTML/CSS/JS, open <strong>index.html</strong> and run the preview.</div>
                    )}
                  </div>
                </div>

                {/* File info */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: themeStyles.muted, marginBottom: 6 }}>File info</div>
                  <div style={{ background: themeStyles.panelBg, padding: 12, borderRadius: 8, border: `1px solid ${themeStyles.border}` }}>
                    <div style={{ marginBottom: 6 }}><strong>Name:</strong> {activeDoc?.name}</div>
                    <div style={{ marginBottom: 6 }}><strong>Language:</strong> {activeDoc?.language}</div>
                    <div style={{ marginBottom: 6 }}><strong>Size:</strong> {(activeDoc?.content?.length || 0)} chars</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => { navigator.clipboard?.writeText(activeDoc?.content || ""); toast.success("Copied"); }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}>
                        <Copy /> Copy
                      </button>
                      <button onClick={() => { const blob = new Blob([activeDoc?.content || ""], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = activeDoc?.name || "file.txt"; a.click(); }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: themeStyles.accent, color: theme === "dark" ? "#041014" : "#fff" }}>
                        <Download /> Download
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => runFrontend()} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: themeStyles.accent, color: "#fff" }}>Preview Project</button>
                    <button onClick={() => exportProjectJSON()} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}>Export Project</button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Bottom output panel (Console / Output / Errors) */}
          <div style={{ borderTop: `1px solid ${themeStyles.border}`, background: themeStyles.panelBg }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>Output</div>
                <div style={{ fontSize: 12, color: themeStyles.muted }}>{consoleLines.length} logs • {errors.length} errors</div>
                <div style={{ marginLeft: 8, display: "flex", gap: 6 }}>
                  <button onClick={() => setOutputTab("console")} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: outputTab === "console" ? themeStyles.accent : "transparent" }}>Console</button>
                  <button onClick={() => setOutputTab("output")} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: outputTab === "output" ? themeStyles.accent : "transparent" }}>Output</button>
                  <button onClick={() => setOutputTab("errors")} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: outputTab === "errors" ? themeStyles.accent : "transparent" }}>Errors</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => clearConsole()} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}><Trash2 /></button>
                <button onClick={() => downloadLogs()} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${themeStyles.border}`, background: "transparent" }}><Download /></button>
              </div>
            </div>

            {/* Panel content */}
            <div style={{ padding: 12, height: 180, overflow: "auto", background: theme === "dark" ? "#01060a" : "#f8fafc", color: themeStyles.text }}>
              {outputTab === "console" && (
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>
                  {consoleLines.length === 0 ? <div style={{ color: themeStyles.muted }}>Console is empty — run your code to see logs</div> :
                    consoleLines.map((l) => (
                      <div key={l.id} style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}>
                        <span style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}>[{new Date(l.t).toLocaleTimeString()}]</span>{" "}
                        <span style={{ color: l.type === "error" ? "#fb7185" : l.type === "info" ? "#60a5fa" : theme === "dark" ? "#86efac" : "#059669", fontWeight: 600 }}>{l.type.toUpperCase()}</span>
                        <span style={{ marginLeft: 8 }}>{l.text}</span>
                      </div>
                    ))
                  }
                </div>
              )}

              {outputTab === "output" && (
                <div style={{ fontFamily: "Inter, system-ui", color: themeStyles.muted }}>
                  This panel displays structured output. For frontend preview, use the Preview panel. For custom outputs from your scripts, print to console to appear here.
                </div>
              )}

              {outputTab === "errors" && (
                <div>
                  {errors.length === 0 ? <div style={{ color: themeStyles.muted }}>No errors</div> : errors.map((err) => (
                    <div key={err.id} style={{ padding: 8, borderRadius: 8, background: theme === "dark" ? "#2b021f" : "#fff1f2", marginBottom: 8, border: `1px solid ${theme === "dark" ? "#43132b" : "#fee2e2"}` }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{err.message}</div>
                      <div style={{ fontSize: 12, color: themeStyles.muted }}>{new Date(err.when).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Floating Settings Modal */}
      {showSettings && (
        <div style={{ position: "fixed", right: 20, bottom: 20, width: 360, background: themeStyles.card, border: `1px solid ${themeStyles.border}`, borderRadius: 12, zIndex: 60, boxShadow: "0 8px 40px rgba(2,6,23,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: `1px solid ${themeStyles.border}` }}>
            <div style={{ fontWeight: 700 }}>Settings</div>
            <button onClick={() => setShowSettings(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X /></button>
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Editor font size</div>
              <input type="range" min={12} max={20} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Reset files</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setFiles(TEMPLATES); toast.success("Reset to templates"); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${themeStyles.border}` }}>Reset</button>
                <button onClick={() => { safeLocalSet("cp2_files_v1", files); toast.success("Saved to localStorage"); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${themeStyles.border}` }}>Save</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Theme</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setTheme("dark")} style={{ flex: 1, padding: 10, borderRadius: 8, background: theme === "dark" ? themeStyles.accent : "transparent", color: theme === "dark" ? "#041014" : themeStyles.text, border: `1px solid ${themeStyles.border}` }}>Dark</button>
                <button onClick={() => setTheme("light")} style={{ flex: 1, padding: 10, borderRadius: 8, background: theme === "light" ? themeStyles.accent : "transparent", color: theme === "light" ? "#041014" : themeStyles.text, border: `1px solid ${themeStyles.border}` }}>Light</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
