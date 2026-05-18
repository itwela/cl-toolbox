import { Command } from "./types";

export function parseCommands(markdown: string): Command[] {
  const commands: Command[] = [];
  let currentCategory = "General";
  let currentCommand: Partial<Command> | null = null;
  let descLines: string[] = [];
  let codeLines: string[] | null = null;
  let inCode = false;

  const flush = () => {
    if (currentCommand?.name) {
      commands.push({
        id: `${currentCategory}-${currentCommand.name}`,
        category: currentCategory,
        name: currentCommand.name,
        description: descLines.join(" ").trim(),
        code: codeLines?.join("\n").trim() || undefined,
        mac: currentCommand.mac,
        win: currentCommand.win,
      });
    }
    currentCommand = null;
    descLines = [];
    codeLines = null;
    inCode = false;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      flush();
      currentCategory = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      flush();
      currentCommand = { name: line.slice(3).trim() };
      continue;
    }

    if (!currentCommand) continue;

    if (line.startsWith("```")) {
      if (inCode) {
        inCode = false;
      } else {
        inCode = true;
        codeLines = codeLines ?? [];
      }
      continue;
    }

    if (inCode) {
      const macMatch = line.match(/^mac:\s*(.+)/i);
      const winMatch = line.match(/^win:\s*(.+)/i);
      if (macMatch) {
        currentCommand.mac = macMatch[1].trim();
      } else if (winMatch) {
        currentCommand.win = winMatch[1].trim();
      } else {
        codeLines = codeLines ?? [];
        codeLines.push(line);
      }
      continue;
    }

    const macMatch = line.match(/^mac:\s*(.+)/i);
    const winMatch = line.match(/^win:\s*(.+)/i);

    if (macMatch) {
      currentCommand.mac = macMatch[1].trim();
    } else if (winMatch) {
      currentCommand.win = winMatch[1].trim();
    } else if (line.trim()) {
      descLines.push(line.trim());
    }
  }

  flush();
  return commands;
}
