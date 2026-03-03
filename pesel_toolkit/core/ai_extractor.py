# core/ai_extractor.py
"""
Claude AI ile PESEL formu için belge çıkarma ve alan eşleştirme.
"""
import json
import logging
import re
import time

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 8192
TEMPERATURE = 0.0
MAX_RETRIES = 2
RETRY_BASE_DELAY = 2


def build_field_schema(field_map):
    """field_map'ten Claude'a gönderilecek alan şemasını oluşturur."""
    schema = []
    for f in field_map.get("form_fields", []):
        ft = f.get("field_type", "")
        schema.append({
            "field_id": f["field_id"],
            "label": f.get("label", ""),
            "type": ft,
            "max_len": f.get("num_cells", 0),
        })
    return schema


SYSTEM_PROMPT_TEMPLATE = """\
You are an intelligent reasoning agent for document data extraction. Your task is to extract personal information from parsed document text and map it to specific PESEL application form fields.

## Context
The target form is "Wniosek o nadanie numeru PESEL" (Application for PESEL number assignment) — a Polish government form. You must extract data from the source document and map it to the form fields described below.

## Turkish → Polish Translation
Source documents may be in Turkish. ALL extracted values must be written in POLISH for the form.

Key translations you MUST apply:
- Sex: ERKEK/BAY → mężczyzna (mark s2_sex_male), KADIN/BAYAN → kobieta (mark s2_sex_female)
- Marital status: BEKAR → kawaler/panna (s4_status_single), EVLİ → żonaty/zamężna (s4_status_married), BOŞANMIŞ → rozwiedziony/rozwiedziona (s4_status_divorced), DUL → wdowiec/wdowa (s4_status_widowed)
- Country names: TÜRKİYE → TURCJA, ALMANYA → NIEMCY, FRANSA → FRANCJA, İNGİLTERE → WIELKA BRYTANIA, İTALYA → WŁOCHY, İSPANYA → HISZPANIA, HOLLANDA → HOLANDIA, BELÇİKA → BELGIA, AVUSTURYA → AUSTRIA, İSVİÇRE → SZWAJCARIA, YUNANISTAN → GRECJA, BULGARISTAN → BUŁGARIA, ROMANYA → RUMUNIA, UKRAYNA → UKRAINA, RUSYA → ROSJA, İRAN → IRAN, IRAK → IRAK, SURİYE → SYRIA, MISIR → EGIPT, ABD/AMERİKA → USA, KANADA → KANADA, ÇİN → CHINY, JAPONYA → JAPONIA, PAKİSTAN → PAKISTAN, HİNDİSTAN → INDIE, GÜRCÜSTAN → GRUZJA, AZERBAYCAN → AZERBEJDŻAN, ÖZBEKİSTAN → UZBEKISTAN, TÜRKMENİSTAN → TURKMENISTAN, KAZAKISTAN → KAZACHSTAN, KIRGIZISTAN → KIRGISTAN, POLONYA → POLSKA
- Citizenship: TÜRK → TURECKIE
- Yes/No: EVET → TAK, HAYIR → NIE

## Form Fields Schema
```json
{field_schema_json}
```

## Field Mapping Rules

### Section 1 — Wnioskodawca (Applicant)
- s1_name, s1_surname: The person filing the form (may be same as person in section 2)
- s1_street, s1_house_no, s1_flat_no, s1_postal_1, s1_postal_2, s1_city: Correspondence address
  - s1_postal_1 = first 2 digits of postal code, s1_postal_2 = last 3 digits

### Section 2 — Dane osoby (Person's data)
- s2_first_name, s2_second_name, s2_other_names, s2_surname
- Sex: Set s2_sex_female OR s2_sex_male to "true" (checkbox)
- Date of birth: s2_dob_day (DD), s2_dob_month (MM), s2_dob_year (YYYY)
- s2_birth_country, s2_residence_country
- Citizenship: Set exactly ONE of s2_citizenship_polish, s2_citizenship_stateless, s2_citizenship_other to "true"
  - If other, also fill s2_citizenship_other_text

### Documents (still on pages 1-2)
- Passport: s2_passport_series, s2_passport_exp_day/month/year
- Travel document: s2_travel_doc_series, s2_travel_doc_exp_day/month/year

### Section 3 — Additional data & Parents
- s3_maiden_name, s3_birthplace, s3_birth_cert_ref, s3_birth_registry
- s3_father_name, s3_father_maiden_name
- s3_mother_name, s3_mother_maiden_name
- ID card: s3_id_series, s3_id_exp_day/month/year, s3_id_issuer

### Section 4 — Marital status
- Set exactly ONE: s4_status_single, s4_status_married, s4_status_divorced, s4_status_widowed
- If married: s4_spouse_name, s4_spouse_maiden_name, s4_spouse_pesel

### Section 5 — Marriage event
- Event type: Set ONE of s5_event_marriage, s5_event_divorce, s5_event_annulment, s5_event_spouse_death, s5_event_spouse_death_found
- s5_event_date_day/month/year, s5_marriage_cert_ref, s5_marriage_registry

### Section 6 — Notification
- s6_notify_paper OR s6_notify_electronic (checkbox)
- s6_epuap_address (if electronic)

### Section 7-8 — Legal basis & Signature
- s7_legal_basis: text describing the legal basis
- s8_city, s8_date_day/month/year

## Output Rules
1. Return ONLY a JSON object: {{"fields": {{...}}, "missing_fields": [...]}}
2. All text values UPPERCASE.
3. Dates: split into separate day/month/year fields. Day=DD, Month=MM, Year=YYYY.
4. Checkboxes: use string "true" or "false".
5. Text cleaning: Remove markdown artifacts.
6. Only include fields with matching data. Don't guess.
7. For missing critical fields, add to missing_fields with reason in Turkish.

Critical fields to check: surname, first name, DOB, sex, citizenship, birth country, father's name, mother's name.
"""


def _clean_json_response(text):
    """Claude yanıtından JSON objesini çıkarır."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        text = match.group(1).strip()
    return text


def extract_with_claude(raw_text, field_map, api_key):
    """
    Claude API ile ham metinden PESEL form alanlarına eşleştirme yapar.

    Returns:
        tuple: (mappings, missing_fields)
    """
    field_schema = build_field_schema(field_map)
    field_schema_json = json.dumps(field_schema, ensure_ascii=False, indent=2)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(field_schema_json=field_schema_json)

    client = anthropic.Anthropic(api_key=api_key)
    messages = [
        {
            "role": "user",
            "content": (
                "Extract all personal information from the following parsed document text "
                "and map them to the PESEL form fields described in the system prompt.\n\n"
                "--- DOCUMENT TEXT START ---\n"
                f"{raw_text}\n"
                "--- DOCUMENT TEXT END ---"
            ),
        }
    ]

    for attempt in range(1 + MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=system_prompt,
                messages=messages,
            )
            break
        except (anthropic.APITimeoutError, anthropic.RateLimitError) as exc:
            if attempt < MAX_RETRIES:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning("Claude API hatası (deneme %d/%d): %s — %ds bekle",
                               attempt + 1, 1 + MAX_RETRIES, exc, delay)
                time.sleep(delay)
            else:
                raise

    response_text = response.content[0].text
    logger.debug("Claude raw response: %s", response_text[:500])

    cleaned = _clean_json_response(response_text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Claude JSON parse hatası: %s\nResponse: %s", exc, cleaned[:500])
        raise ValueError(f"Claude yanıtı JSON olarak ayrıştırılamadı: {exc}") from exc

    if "fields" in parsed and isinstance(parsed["fields"], dict):
        extracted = parsed["fields"]
        missing_fields = parsed.get("missing_fields", [])
    else:
        extracted = parsed
        missing_fields = []

    field_lookup = {}
    for f in field_map.get("form_fields", []):
        field_lookup[f["field_id"]] = f

    mappings = []
    for field_id, value in extracted.items():
        field_info = field_lookup.get(field_id)
        if field_info is None:
            logger.warning("Claude bilinmeyen field_id döndü: %s", field_id)
            continue

        value_str = str(value) if not isinstance(value, str) else value
        max_length = field_info.get("num_cells", 0)
        value_fits = len(value_str) <= max_length if max_length > 0 else True

        mappings.append({
            "extracted_key": field_info.get("label", field_id),
            "extracted_value": value_str,
            "matched_field_id": field_id,
            "confidence": 0.95,
            "field_label": field_info.get("label", ""),
            "field_type": field_info.get("field_type", ""),
            "max_length": max_length,
            "value_fits": value_fits,
        })

    logger.info("Claude %d alan eşleştirdi, %d eksik alan tespit edildi",
                len(mappings), len(missing_fields))
    return mappings, missing_fields
