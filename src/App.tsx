import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { parseCommands } from "./parseCommands";
import { Command } from "./types";
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
  const searchRef = useRef<HTMLInputElement>(null);
  const appWindow = getCurrentWindow();

  const loadCommands = useCallback(async (path: string) => {
    try {
      const content = await invoke<string>("read_commands_file", { path });
      setCommands(parseCommands(content));
      setError(null);
    } catch (e) {
      setError(String(e));
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
        <span className="app-title">CL Toolbox</span>
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
          <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">Config</button>
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
            <button className="browse-btn" onClick={handleBrowse}>Browse</button>
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
        </div>
      ) : !hasInitialized ? null : !filePath ? (
        <div className="setup">
          <p className="setup-heading">No file linked yet</p>
          <p className="setup-body">
            CL Toolbox reads your commands from a <code>.md</code> file you control —
            one place for every shortcut, snippet, and CLI command you use.
          </p>
          <button className="setup-browse" onClick={handleBrowse}>Browse for file</button>
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
          </div>

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
    </div>
  );
}
