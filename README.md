# Poland Residence Permit Form Filler

A web application that automatically fills the Polish temporary residence permit (Karta Pobytu) application form. It reads Turkish documents (ID cards, passports, etc.) using AI and translates them into the Polish form.

## Features

- **AI Document Parsing** — Upload Turkish documents, Claude AI extracts form fields automatically
- **TR → PL Translation** — Translates marital status, gender, country names and more into Polish
- **PDF Filling** — Writes 131 fields onto the original PDF with pixel-level precision
- **Live Preview** — See the filled PDF update in real time as you type
- **Missing Field Detection** — Lists fields that couldn't be found in the uploaded document

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Flask, Python 3.10+ |
| Frontend | React 18, Vite, Tailwind CSS |
| AI | Claude API (Anthropic), LlamaParse |
| PDF | ReportLab, pypdf, pdf.js |

## Setup

### 1. Backend

```bash
cd form_toolkit
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd form_toolkit/frontend
npm install
npm run build
```

### 3. API Keys

```bash
cp form_toolkit/.env.example form_toolkit/.env
```

Add your keys to the `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
LLAMAPARSE_API_KEY=llx-...
```

## Usage

### Web UI

```bash
cd form_toolkit
python app.py
# → http://localhost:5000
```

Open in browser, upload a document or fill fields manually, then download the PDF.

### CLI

```bash
cd form_toolkit

# Generate a sample data file
python fill_form.py --ornek

# Fill the form
python fill_form.py data.json output.pdf
```

## Project Structure

```
form_toolkit/
├── app.py                  # Flask application
├── config.py               # Configuration
├── api/routes.py           # API endpoints
├── core/
│   ├── ai_extractor.py     # Claude AI integration
│   ├── doc_parser.py       # LlamaParse document reader
│   ├── pdf_engine.py       # ReportLab PDF writer
│   ├── field_matcher.py    # Field matching logic
│   └── validator.py        # Data validation
├── fill_form.py            # CLI form filler
├── assets/
│   ├── form_field_map_v3.json  # 131-field coordinate map
│   └── wniosek-...pdf          # Original blank form
└── frontend/
    ├── src/
    │   ├── form_app.jsx    # Main form component
    │   ├── PdfPreview.jsx  # PDF preview
    │   └── DocImport.jsx   # Document upload
    └── package.json
```

## API Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/fields` | GET | List form fields |
| `/api/sample` | GET | Sample filled data |
| `/api/generate-pdf` | POST | Generate and download filled PDF |
| `/api/import-doc` | POST | Upload document, extract fields with AI |
| `/api/template-pdf` | GET | Blank form PDF |
| `/api/field-map` | GET | Field coordinate map |

## License

MIT
