# CL Toolbox — Open Source Plan

## The Model
- **Software is free** — MIT licensed, open source on GitHub
- **Your commands stay private** — the `.md` file is never included, only the app
- **Optional $5 setup guide** — not required, but pays for your time explaining the concept
  - Could live on Gumroad, Ko-fi, or a simple link in the README
  - Value prop: "Claude sets this up for you in 2 minutes, tailored to your workflow"

## Audience
Heavy computer users who can't keep everything in their head:
- Terminal / CLI daily users
- Blender artists, 3D/creative-tech people
- Developers, designers, power users
- People who just got Claude and want a first tangible win

---

## Steps to Ship

### 1. Repo cleanup
- [ ] Create GitHub repo — `cl-toolbox` (public)
- [ ] Add `.gitignore` — exclude `src-tauri/target/`, `dist/`, `node_modules/`, any local config with personal paths
- [ ] Verify `src-tauri/tauri.conf.json` has no personal identifiers (identifier is fine, check nothing else leaks)
- [ ] Check the Tauri store config path doesn't hardcode anything personal

### 2. Sample commands file
- [ ] Create `example-commands.md` in the repo root
- [ ] Populate with generic but genuinely useful commands across categories:
  - `General` — clipboard, screenshots, system stuff
  - `Terminal` — common git, file ops, network
  - `Blender` — most-used shortcuts with descriptions
  - `VS Code` — key bindings people forget
- [ ] This becomes the "starter pack" — reference it in README and the Claude skill

### 3. First-run experience (already done)
- [x] Graceful setup screen when no file is linked
- [x] Browse for file button
- [x] Min window size enforced (245×245)

### 4. README
- [ ] What it is — one sentence, no fluff
- [ ] Screenshot or short GIF of the UI
- [ ] How to install (releases page — download the `.dmg` / `.exe`)
- [ ] How to set up your commands file (link to `example-commands.md` format)
- [ ] Link to the optional $5 guide
- [ ] "Built with Tauri + React"

### 5. Releases
- [ ] `npm run build` → Tauri bundle
- [ ] Create GitHub Release with `.dmg` (Mac) and `.exe` (Windows) attached
- [ ] Tag as `v1.0.0`

### 6. Claude skill (the real hook)
- [ ] Build a Claude Code skill: `setup-cl-toolbox`
- [ ] Skill flow:
  1. Checks if CL Toolbox is installed, gives download link if not
  2. Asks user questions: what software do you use daily? terminal? Blender? VS Code? What do you keep Googling?
  3. Generates a personalized starter `.md` commands file based on answers
  4. Saves it somewhere sensible, tells user to point the app at it
  5. Explains how to keep adding commands over time
- [ ] This skill IS the $5 guide experience — or it links to deeper explanation

### 7. Positioning / posting
- [ ] Short-form video showing: open app → search → copy → paste. Done.
- [ ] Caption angle: "your brain has a RAM limit. this is external memory."
- [ ] Pin the GitHub link
- [ ] Mention the optional guide in bio / pinned comment

---

## Notes
- Don't over-explain the app. Show it working.
- The $5 doesn't need a Stripe integration — Gumroad handles it, or even a Ko-fi page with a PDF.
- The Claude skill is the highest-leverage piece — it removes all friction from setup.
