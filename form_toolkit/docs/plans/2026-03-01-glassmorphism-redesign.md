# Glassmorphism Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the entire UI with a minimal glassmorphism dark theme using emerald accent, while preserving all functionality and the 50/50 split layout.

**Architecture:** Pure CSS/className changes across 5 frontend files. No logic changes, no new dependencies. All modifications are Tailwind class swaps in existing JSX components.

**Tech Stack:** Tailwind CSS v4 (already configured), React 18

---

## Task 1: Update index.html and index.css — Base Styles

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

**Step 1: Update `index.html` body background and scrollbar colors**

Replace the entire `<style>` block in `frontend/index.html` with:

```html
<style>
  body { margin: 0; overflow: hidden; background: #09090b; }

  @keyframes slideUp {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  .form-scroll::-webkit-scrollbar { width: 4px; }
  .form-scroll::-webkit-scrollbar-track { background: transparent; }
  .form-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  .form-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  .pdf-scroll::-webkit-scrollbar { width: 4px; }
  .pdf-scroll::-webkit-scrollbar-track { background: transparent; }
  .pdf-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  .pdf-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  .glass {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .glass-elevated {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
  }
</style>
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "style: update base styles for glassmorphism theme"
```

---

## Task 2: Restyle ErrorBoundary

**Files:**
- Modify: `frontend/src/ErrorBoundary.jsx`

**Step 1: Update ErrorBoundary colors**

In `ErrorBoundary.jsx`, replace the render fallback class names:

- Outer div: `bg-slate-900` → `bg-zinc-950`
- h1: `text-slate-200` → `text-zinc-50`
- p: `text-slate-400` → `text-zinc-400`
- button: `bg-indigo-600 hover:bg-indigo-700` → `bg-emerald-500 hover:bg-emerald-600`

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/ErrorBoundary.jsx
git commit -m "style: update ErrorBoundary to glassmorphism theme"
```

---

## Task 3: Restyle form_app.jsx — Helper Components (TextInput, CheckboxInput, SectionHeading)

**Files:**
- Modify: `frontend/src/form_app.jsx` (lines 111-165)

**Step 1: Update TextInput component**

Replace the TextInput function (lines 111-138) className values:

- Outer div: replace `border-b border-slate-800 last:border-b-0 focus-within:border-indigo-700` with `border-b border-white/[0.06] last:border-b-0 focus-within:border-emerald-500/50`
- Label: replace `text-slate-600 group-focus-within:text-indigo-400` with `text-zinc-500 group-focus-within:text-emerald-400`
- Input: replace `text-slate-200 placeholder:text-slate-700` with `text-zinc-50 placeholder:text-zinc-700`
- Counter colors: replace `text-red-400` with `text-red-400` (keep), replace `text-amber-400` with `text-amber-400` (keep), replace `text-slate-600` with `text-zinc-600`

**Step 2: Update CheckboxInput component**

Replace the CheckboxInput function (lines 140-151) className values:

- Checkbox input: replace `border-slate-600 accent-indigo-500` with `border-zinc-600 accent-emerald-500`
- Label span: replace `text-slate-500 group-hover:text-slate-200` with `text-zinc-500 group-hover:text-zinc-200`

**Step 3: Update SectionHeading component**

Replace the SectionHeading function (lines 153-165) className values:

- Title span: replace `text-slate-500` with `text-zinc-500`
- Subtitle span: replace `text-slate-600` with `text-zinc-600`
- Divider: replace `bg-slate-800` with `bg-white/[0.06]`

**Step 4: Verify build**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/form_app.jsx
git commit -m "style: restyle helper components for glassmorphism"
```

---

## Task 4: Restyle form_app.jsx — Header and Tab Bar

**Files:**
- Modify: `frontend/src/form_app.jsx` (lines 347-386)

**Step 1: Update root container and header**

- Root div (line 348): replace `bg-slate-900` with `bg-zinc-950`
- Header (line 351): replace `h-10 bg-slate-950 border-b border-slate-800` with `h-12 glass border-b border-white/[0.06]`
- Logo span (line 352): replace `bg-indigo-600` with `bg-emerald-500`
- Title (line 354): replace `text-slate-200` with `text-zinc-50`
- Subtitle (line 355): replace `text-slate-600` with `text-zinc-500`
- Progress bar track (line 358): replace `bg-slate-800` with `bg-white/[0.06]`
- Progress bar fill (line 359): replace `bg-indigo-500` with `bg-emerald-500`
- Counter (line 362): replace `text-slate-600` with `text-zinc-500`

**Step 2: Update tab navigation to pill style**

Replace the entire nav element (lines 369-386) with pill/segment style:

- Nav container: replace `h-9 bg-slate-950 border-b border-slate-800 flex items-end px-4` with `h-10 glass border-b border-white/[0.06] flex items-center px-4 gap-1`
- Tab button active state: replace `text-indigo-400 border-indigo-500` with `text-emerald-300 bg-emerald-500/15`
- Tab button inactive: replace `text-slate-600 border-transparent hover:text-slate-400 hover:border-slate-700` with `text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.04]`
- Remove `border-b-2 -mb-px` from all tab buttons, add `rounded-full px-3 py-1.5` instead
- Tab page number active: replace `text-indigo-600` with `text-emerald-500/60`
- Tab page number inactive: replace `text-slate-700` with `text-zinc-600`

**Step 3: Verify build**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/form_app.jsx
git commit -m "style: restyle header and tab bar with glass + pill tabs"
```

---

## Task 5: Restyle form_app.jsx — Main Content Area (Form + PDF split)

**Files:**
- Modify: `frontend/src/form_app.jsx` (lines 388-656)

**Step 1: Update main split layout**

- Left panel (line 392): replace `bg-slate-950 border-r border-slate-800` with `bg-transparent border-r border-white/[0.06]`
- Right panel (line 642): replace `bg-slate-800` with `bg-zinc-900/50`

**Step 2: Update form section cards**

Wrap each tab's content in glass card styling. For every section within each tab, the `SectionHeading` + content should live inside a glass card div:

Each section group should be wrapped in: `<div className="glass rounded-xl p-4 mb-3">`

**Step 3: Update inline table styles across all tabs**

For all `<table>` and `<tr>` elements:
- Replace `border-b border-slate-800` with `border-b border-white/[0.06]`
- Replace `hover:bg-slate-800/50` with `hover:bg-white/[0.03]`
- Replace `text-slate-600` (table headers) with `text-zinc-500`
- Replace `text-slate-700` (row numbers) with `text-zinc-600`

For inline `<input>` elements inside tables:
- Replace `focus:bg-slate-800` with `focus:bg-white/[0.06]`
- Replace `placeholder:text-slate-700` with `placeholder:text-zinc-700`
- Replace `text-slate-200` with `text-zinc-50`

For the family table:
- Replace `focus:bg-indigo-50` with `focus:bg-emerald-500/10`
- Replace `placeholder:text-slate-200` with `placeholder:text-zinc-600`

**Step 4: Update checkbox separator**

- Line 411: replace `border-t border-slate-800` with `border-t border-white/[0.06]`

**Step 5: Update info text**

- Line 546-548: replace `text-slate-600` with `text-zinc-500`

**Step 6: Update export tab**

- JSON download button: replace `bg-indigo-600 hover:bg-indigo-700` with `bg-emerald-500 hover:bg-emerald-600`
- JSON upload button: replace `bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700` with `glass text-zinc-300 hover:bg-white/[0.06]`
- PDF button: keep `bg-emerald-600 hover:bg-emerald-700`
- Clear button: keep red styling
- Preview pre: replace `bg-slate-950` with `bg-zinc-950`
- Preview label: replace `text-slate-400` with `text-zinc-400`
- Info card: replace `bg-slate-900 border border-slate-800` with `glass`
- Info heading: replace `text-slate-500` with `text-zinc-500`
- Info text: replace `text-slate-400` with `text-zinc-400`, `text-slate-300` with `text-zinc-200`
- Info hint: replace `text-slate-600` with `text-zinc-600`

**Step 7: Update toast**

- Toast (line 652): replace `bg-slate-900 text-white` with `glass-elevated text-zinc-50`

**Step 8: Verify build**

Run: `cd frontend && npm run build`

**Step 9: Commit**

```bash
git add frontend/src/form_app.jsx
git commit -m "style: restyle main content area, cards, tables, buttons, toast"
```

---

## Task 6: Restyle DocImport.jsx

**Files:**
- Modify: `frontend/src/DocImport.jsx`

**Step 1: Update upload phase**

- Drop zone active: replace `border-indigo-500 bg-indigo-950/30` with `border-emerald-500 bg-emerald-500/10`
- Drop zone inactive: replace `border-slate-700 hover:border-slate-500 bg-slate-900/50` with `border-white/10 hover:border-white/20 bg-white/[0.02]`
- Icon: replace `text-slate-600` with `text-zinc-600`
- Text: replace `text-slate-400` with `text-zinc-400`, `text-slate-300` with `text-zinc-200`
- Subtitle: replace `text-slate-600` with `text-zinc-600`
- Info card: replace `bg-slate-900 border border-slate-800` with `glass`
- Info heading: replace `text-slate-500` with `text-zinc-500`
- Info text: replace `text-slate-400` with `text-zinc-400`

**Step 2: Update loading phase**

- Spinner: replace `border-indigo-500` with `border-emerald-500`
- Text: replace `text-slate-400` with `text-zinc-400`, `text-slate-600` with `text-zinc-600`

**Step 3: Update mapping phase**

- Header labels: replace `text-slate-500` with `text-zinc-500`, `text-slate-600` with `text-zinc-600`
- Missing fields panel: replace `border-amber-700/50 bg-amber-950/20` with `border-amber-500/30 bg-amber-500/5`
- Missing fields button hover: replace `hover:bg-amber-950/30` with `hover:bg-amber-500/10`
- Table header: replace `border-b border-slate-700` with `border-b border-white/[0.06]`
- Table header th: replace `text-slate-500` with `text-zinc-500`
- Table row: replace `border-b border-slate-800 hover:bg-slate-800/50` with `border-b border-white/[0.06] hover:bg-white/[0.03]`
- Input: replace `text-slate-200 focus:bg-slate-800 focus:border-slate-600` with `text-zinc-50 focus:bg-white/[0.06] focus:border-white/10`
- Select: replace `bg-slate-900 text-slate-300 border border-slate-700 focus:border-indigo-600` with `bg-zinc-900 text-zinc-300 border border-white/10 focus:border-emerald-500`
- Raw text panel: replace `border-slate-800` with `border-white/[0.06]`
- Raw text button: replace `bg-slate-900 hover:bg-slate-800` with `bg-white/[0.03] hover:bg-white/[0.06]`
- Raw text pre: replace `text-slate-500 bg-slate-950` with `text-zinc-500 bg-zinc-950`
- Import button: replace `bg-indigo-600 hover:bg-indigo-700` with `bg-emerald-500 hover:bg-emerald-600`
- Cancel button: replace `text-slate-400 border border-slate-700 hover:bg-slate-800` with `text-zinc-400 border border-white/10 hover:bg-white/[0.06]`

**Step 4: Verify build**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/DocImport.jsx
git commit -m "style: restyle DocImport for glassmorphism theme"
```

---

## Task 7: Final Build Verification

**Step 1: Run full frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, CSS output ~20-25KB

**Step 2: Run backend tests**

Run: `cd form_toolkit && python -m pytest tests/ -v`
Expected: All 22 tests pass (no changes to Python code)

**Step 3: Visual check list**

Start the dev server (`cd frontend && npm run dev`) and verify:
- [ ] Body background is near-black (#09090b)
- [ ] Header has glass effect with emerald logo
- [ ] Tab bar uses pill/segment style with emerald active state
- [ ] Form inputs have bottom-border style with emerald focus
- [ ] Section cards have glass effect (subtle transparency)
- [ ] Buttons use emerald primary color
- [ ] Scrollbars are thin and transparent
- [ ] Toast notifications have glass style
- [ ] DocImport drop zone has glass style
- [ ] PDF preview panel has subtle border

**Step 4: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "style: final glassmorphism polish and adjustments"
```

---

## Files Summary

```
frontend/
  index.html              — body background, scrollbar colors, glass CSS classes
  src/
    index.css             — no changes needed (Tailwind import only)
    ErrorBoundary.jsx     — zinc/emerald color swap
    form_app.jsx          — full restyle: header, tabs, cards, inputs, buttons, toast
    DocImport.jsx         — full restyle: upload, loading, mapping phases
    PdfPreview.jsx        — minimal: right panel bg color only
    main.jsx              — no changes
    api.js                — no changes
```
