import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { parseCommands } from "./parseCommands";
import { Command } from "./types";
import ToolboxButton from "./ToolboxButton";
import iconDark from "./assets/icon-dark.png";
import iconLight from "./assets/icon-light.png";
import "./App.css";

export default function App() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"mac" | "win">("mac");
  const [copied, setCopied] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [view, setView] = useState<"list" | "categories">("list");
  const [promptCopied, setPromptCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const appWindow = getCurrentWindow();

  const loadCommands = useCallback(async (path: string, retry = true) => {
    try {
      const content = await invoke<string>("read_commands_file", { path });
      setCommands(parseCommands(content));
      setError(null);
    } catch (e) {
      if (retry) {
        setTimeout(() => loadCommands(path, false), 1000);
      } else {
        setError(String(e));
      }
    }
  }, []);

  const initPath = useCallback(async () => {
    const [path, savedTheme] = await Promise.all([
      invoke<string>("get_commands_path"),
      invoke<string>("get_theme"),
    ]);
    setFilePath(path);
    setTheme(savedTheme === "light" ? "light" : "dark");
    if (path) {
      await loadCommands(path);
      await invoke("start_file_watcher", { path });
    }
    setHasInitialized(true);
  }, [loadCommands]);

  const handleThemeToggle = async (next: "dark" | "light") => {
    setTheme(next);
    await invoke("set_theme", { theme: next });
  };

  useEffect(() => {
    initPath();
    searchRef.current?.focus();

    const unlisten = listen("commands-file-changed", () => {
      loadCommands(filePath);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Re-watch when filePath changes after init
  useEffect(() => {
    if (!filePath) return;
    loadCommands(filePath);
    invoke("start_file_watcher", { path: filePath });
  }, [filePath]);

  const categories = [...new Set(commands.map((c) => c.category))];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    const matchesSearch =
      cmd.name.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q);
    const matchesCategory = !activeCategory || cmd.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    (acc[cmd.category] = acc[cmd.category] || []).push(cmd);
    return acc;
  }, {});

  const resolveCommand = (cmd: Command) => {
    if (platform === "mac" && cmd.mac) return cmd.mac;
    if (platform === "win" && cmd.win) return cmd.win;
    return cmd.code || cmd.name;
  };

  const handleCopy = async (cmd: Command) => {
    const text = resolveCommand(cmd);
    await writeText(text);
    setCopied(cmd.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleBrowse = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (selected && typeof selected === "string") {
      setFilePath(selected);
      await invoke("set_commands_path", { path: selected });
    }
  };

  return (
    <div className={`app${theme === "dark" ? " dark" : ""}`}>
      <div className="titlebar" onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        appWindow.startDragging();
      }}>
        {showSettings
          ? <span className="app-title">CL Toolbox</span>
          : <img src={theme === "dark" ? iconDark : iconLight} className="app-logo" alt="CL Toolbox" />
        }
        <div className="platform-toggle">
          <button
            className={`toggle-btn ${platform === "mac" ? "active" : ""}`}
            onClick={() => setPlatform("mac")}
          >Mac</button>
          <button
            className={`toggle-btn ${platform === "win" ? "active" : ""}`}
            onClick={() => setPlatform("win")}
          >Win</button>
        </div>
        <div className="titlebar-actions">
          <button className="icon-btn" onClick={() => loadCommands(filePath)} title="Reload file">↺</button>
          <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">{showSettings ? "Home" : "Settings"}</button>
          <button className="icon-btn" onClick={() => appWindow.minimize()} title="Minimize">Hide</button>
        </div>
      </div>

      {showSettings ? (
        <div className="settings">
          <p className="settings-label">Commands file path:</p>
          <div className="settings-row">
            <input
              className="path-input"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              onBlur={async () => {
                await invoke("set_commands_path", { path: filePath });
              }}
              spellCheck={false}
            />
            <ToolboxButton label="Browse" onClick={handleBrowse} />
          </div>
          <p className="settings-label">Appearance:</p>
          <div className="platform-toggle theme-toggle">
            <button
              className={`toggle-btn ${theme === "dark" ? "active" : ""}`}
              onClick={() => handleThemeToggle("dark")}
            >Dark</button>
            <button
              className={`toggle-btn ${theme === "light" ? "active" : ""}`}
              onClick={() => handleThemeToggle("light")}
            >Light</button>
          </div>
          <button className="done-btn" onClick={() => setShowSettings(false)}>Done</button>
          <button className="reset-btn" onClick={() => {
            if (confirmReset) {
              invoke("set_commands_path", { path: "" });
              setFilePath("");
              setCommands([]);
              setShowSettings(false);
              setConfirmReset(false);
            } else {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 3000);
            }
          }}>{confirmReset ? "Are you sure?" : "Reset file path"}</button>
          <div className="settings-footer">
            <span>An Itwela &amp; Caveman Creative product</span>
            <a href="https://cavemancreativehq.com" target="_blank" rel="noreferrer">cavemancreativehq.com</a>
            <span>v1.0.0</span>
          </div>
        </div>
      ) : !hasInitialized ? null : !filePath ? (
        <div className="setup">
          <p className="setup-heading">No file linked yet</p>
          <p className="setup-body">
            CL Toolbox reads your commands from a <code>.md</code> file you control —
            one place for every shortcut, snippet, and CLI command you use.
          </p>
          <ToolboxButton label="Browse for file" onClick={handleBrowse} />
          <div className="setup-divider"><span>or</span></div>
          <div className="setup-generate">
            <p className="setup-generate-label">Don't have a file? Let Claude build one for you.</p>
            <ToolboxButton label={promptCopied ? "Copied ✓" : "Copy Claude Prompt"} active={promptCopied} onClick={() => {
              const prompt = `I'm setting up CL Toolbox, a command palette app that reads shortcuts and CLI commands from a Markdown file. I need you to build my personal commands file.

First, ask me a few questions to understand my workflow — things like: what OS I'm on, what languages and frameworks I use, what tools I run from the terminal, what apps I use daily (editors, deployment platforms, etc).

Then, based on my answers, generate a properly formatted My Commands.md file with the most useful commands for my specific setup. Use this exact format:

- Categories use a single #
- Command names use ##
- Description goes on the line below the command name
- The actual command goes in a fenced code block
- For platform-specific commands use mac: or win: prefix inside the code block

After generating the file, save it to my Desktop as My Commands.md and tell me the exact full file path at the very end of your response so I can paste it into CL Toolbox.`;
              writeText(prompt);
              setPromptCopied(true);
              setTimeout(() => setPromptCopied(false), 2500);
            }} />
            <p className="setup-generate-hint">Paste into Claude Code → Claude builds your file → paste the path back here.</p>
          </div>
          <button className="setup-manual" onClick={() => setShowSettings(true)}>
            or enter a path manually
          </button>
        </div>
      ) : (
        <>
          <div className="search-wrap">
            <input
              ref={searchRef}
              className="search"
              placeholder="Search commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <ToolboxButton label="Browse" onClick={() => setView(view === "list" ? "categories" : "list")} active={view === "categories"} title="Browse by category" />
          </div>

          {view === "categories" ? (
            <div className="cat-grid">
              <button
                className={`cat-tile ${activeCategory === null ? "active" : ""}`}
                onClick={() => { setActiveCategory(null); setView("list"); }}
              >
                <span className="cat-tile-name">All</span>
                <span className="cat-tile-count">{commands.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`cat-tile ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => { setActiveCategory(cat); setView("list"); }}
                >
                  <span className="cat-tile-name">{cat}</span>
                  <span className="cat-tile-count">{commands.filter(c => c.category === cat).length}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="filters">
                <button
                  className={`pill ${activeCategory === null ? "active" : ""}`}
                  onClick={() => setActiveCategory(null)}
                >All</button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`pill ${activeCategory === cat ? "active" : ""}`}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  >{cat}</button>
                ))}
              </div>

              {error ? (
                <div className="error">
                  <p>Could not read file:</p>
                  <code>{error}</code>
                  <button onClick={() => loadCommands(filePath)}>Retry</button>
                  <button onClick={() => setShowSettings(true)}>Change path</button>
                </div>
              ) : (
                <div className="list">
                  {Object.keys(grouped).length === 0 ? (
                    <p className="empty">No commands found.</p>
                  ) : (
                    Object.entries(grouped).map(([cat, cmds]) => (
                      <div key={cat} className="category">
                        <p className="category-label">{cat}</p>
                        {cmds.map((cmd) => (
                          <button
                            key={cmd.id}
                            className={`command-row ${copied === cmd.id ? "copied" : ""}`}
                            onClick={() => handleCopy(cmd)}
                          >
                            <div className="cmd-body">
                              <span className="cmd-name">{resolveCommand(cmd)}</span>
                              {cmd.description && <span className="cmd-desc">{cmd.description}</span>}
                            </div>
                            <span className="cmd-copy">{copied === cmd.id ? "OK ✓" : "copy"}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
