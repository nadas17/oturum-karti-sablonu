# Glassmorphism Redesign — Tasarim Dokumani

**Tarih:** 2026-03-01
**Yaklasim:** Minimal Glassmorphism Dark Mode
**Kapsam:** Sadece gorsel yenileme — fonksiyonellik degismiyor

---

## Renk Sistemi

### Zemin Katmanlari

| Katman | Deger | Kullanim |
|--------|-------|----------|
| Body | `#09090b` (zinc-950) | Ana arka plan |
| Surface | `rgba(255,255,255,0.03)` + `backdrop-blur-xl` | Kartlar, paneller |
| Surface Elevated | `rgba(255,255,255,0.06)` + `backdrop-blur-xl` | Hover, aktif kartlar |
| Border | `rgba(255,255,255,0.06)` | Kart/panel kenarlari |
| Border Active | `rgba(255,255,255,0.12)` | Focus border |

### Accent

- **Emerald:** `#34d399` (emerald-400) — butonlar, aktif tab, focus ring, progress bar
- Hover: `#10b981` (emerald-500)
- Glow: `0 0 20px rgba(52,211,153,0.15)`

### Metin Hiyerarsisi

- Primary: `#fafafa` (zinc-50) — basliklar, input degerleri
- Secondary: `#a1a1aa` (zinc-400) — label'lar, aciklamalar
- Muted: `#52525b` (zinc-600) — placeholder, ikincil bilgi

---

## Layout

50/50 split korunuyor:

```
+-------------------------------------------------------------+
| HEADER (48px) — glass surface, logo + baslik + progress      |
+----------------------------+--------------------------------+
| TAB BAR — pill/segment     |                                |
| kontrol, yatay             |                                |
+----------------------------+    PDF ONIZLEME                |
|                            |    koyu zemin, subtle border    |
|  FORM ALANI                |                                |
|  glass kartlar icinde      |                                |
|  section gruplari          |                                |
|  scroll, ince scrollbar    |                                |
+----------------------------+--------------------------------+
```

---

## Bilesen Detaylari

### Header (48px)
- Glass efektli arka plan (`backdrop-blur-xl`)
- Logo rengi emerald
- Progress bar emerald tonunda, ince (h-1)
- Doldurma istatistigi mevcut yerde kalir

### Tab Bar
- Mevcut underline yerine **pill/segment** kontrol
- Aktif tab: emerald arka plan (`bg-emerald-500/20`), emerald metin, yumusak glow
- Pasif tab: transparan, hover'da `bg-white/5`
- Rounded-full pill seklinde

### Form Kartlari
- Her section bir glass kart icinde
- `bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl`
- Kartlar arasi 12-16px bosluk
- Section basliklari kart icinde

### Input'lar
- Border yok, sadece alt cizgi (`border-b border-white/10`)
- Focus'ta emerald alt cizgi + hafif glow
- Karakter sayaci mevcut stilde kalir
- `font-mono text-sm text-zinc-50`

### Butonlar
- Primary: `bg-emerald-500 hover:bg-emerald-600 text-white`
- Ghost: `border border-white/10 hover:bg-white/5 text-zinc-300`
- Danger: `text-red-400 border border-red-500/30 hover:bg-red-500/10`

### DocImport Drop Zone
- Glass kart stili, dashed border
- Drag sirasinda emerald border + glow
- Ikon ve metin zinc-400

### Toast
- Glass kart stili, emerald veya red accent

---

## Animasyonlar

- Tab degisimi: `transition-all duration-200`
- Input focus: alt cizgi 150ms gecis, hafif glow
- Kart hover: brightness artisi, border rengi acilir
- Toast: mevcut slideUp animasyonu korunur

---

## Tipografi

- Sistem fontu (`font-sans`) — ek font yuklenmez
- Basliklar: `text-xs font-semibold uppercase tracking-widest`
- Input degerleri: `font-mono text-sm`
- Label'lar biraz daha buyuk ve okunabilir

---

## Scrollbar

- Track: body rengi ile ayni
- Thumb: `rgba(255,255,255,0.1)`
- Thumb hover: `rgba(255,255,255,0.2)`
- Width: 4px

---

## Kapsam Disi

- Responsive/mobil destegi (masaustu odakli)
- Light mode
- Yeni fonksiyonellik

---

## Degisecek Dosyalar

```
frontend/src/
  form_app.jsx    — tum stil siniflari guncellenir
  DocImport.jsx   — glass kart stilleri
  PdfPreview.jsx  — border/arka plan uyumu
  main.jsx        — degisiklik yok (ErrorBoundary zaten var)
  index.css       — ozel scrollbar ve animasyon stilleri
frontend/
  index.html      — body stili guncellenir
```
