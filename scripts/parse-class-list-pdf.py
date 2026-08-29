# -*- coding: utf-8 -*-
"""
MEB sinif listesi PDF'ini okur ve ogrenci kayitlarini JSON'a cevirir.

Kullanim:
    python scripts/parse-class-list-pdf.py <pdf-yolu> [cikti.json]

Neden koordinat bazli okuyoruz:
  pdftotext -layout ile okundugunda her sinifin ILK ogrencisinin soyadi
  kayboluyordu; "Soyadi" sutun basligi ilk satirla ayni hizaya dusuyor ve
  satiri eziyordu. Bu yuzden kelimeler x/y koordinatlariyla okunuyor ve
  sutun sinirlari her sayfanin kendi baslik satirindan tespit ediliyor
  (sabit piksel degeri varsayilmiyor).
"""
import json
import re
import sys
import unicodedata

import pdfplumber

ROW_TOLERANCE = 6.0          # ayni satir sayilacak dikey mesafe
HEADER_WORDS = ("S.No", "Öğrenci", "Adı", "Soyadı", "Cinsiyeti")


def normalize_class(title: str):
    """'6. Sınıf / A Şubesi Sınıf Listesi' -> ('6A', '6. Sınıf / A Şubesi')"""
    t = " ".join(title.split())
    t = re.sub(r"\s*Sınıf Listesi\s*$", "", t)

    m = re.match(r"^(\d+)\.\s*Sınıf\s*/\s*([A-ZÇĞİÖŞÜ])\s*Şubesi$", t)
    if m:
        return f"{m.group(1)}{m.group(2)}", t

    # "5. Sınıf / Geçici Şube" gibi subesi henuz belli olmayanlar
    m = re.match(r"^(\d+)\.\s*Sınıf\s*/\s*(.+)$", t)
    if m:
        grade = m.group(1)
        label = m.group(2).strip()
        slug = "".join(
            c for c in unicodedata.normalize("NFKD", label.upper())
            if c.isalnum()
        )[:8] or "GECICI"
        return f"{grade}-{slug}", t

    return None, t


def group_rows(words):
    """Kelimeleri dikey konuma gore satirlara ayirir."""
    rows = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for row in rows:
            if abs(row["top"] - w["top"]) <= ROW_TOLERANCE:
                row["words"].append(w)
                row["top"] = min(row["top"], w["top"])
                break
        else:
            rows.append({"top": w["top"], "words": [w]})
    for r in rows:
        r["words"].sort(key=lambda w: w["x0"])
    return sorted(rows, key=lambda r: r["top"])


def find_header(rows):
    """Baslik satirini bulur ve sutun x sinirlarini dondurur."""
    for i, row in enumerate(rows):
        texts = [w["text"] for w in row["words"]]
        if "S.No" in texts and "Cinsiyeti" in texts:
            pos = {}
            for w in row["words"]:
                if w["text"] in HEADER_WORDS:
                    pos.setdefault(w["text"], w["x0"])
            if not {"S.No", "Adı", "Soyadı", "Cinsiyeti"} <= set(pos):
                continue
            # sutun sinirlari: iki baslik arasinin ortasi
            no_x = pos.get("Öğrenci", (pos["S.No"] + pos["Adı"]) / 2)
            return i, {
                "sno_max": (pos["S.No"] + no_x) / 2,
                "no_max": (no_x + pos["Adı"]) / 2,
                "ad_max": (pos["Adı"] + pos["Soyadı"]) / 2,
                "soyad_max": (pos["Soyadı"] + pos["Cinsiyeti"]) / 2,
            }
    return None, None


def parse_page(page):
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return None, []

    rows = group_rows(words)

    title = None
    for row in rows[:8]:
        line = " ".join(w["text"] for w in row["words"])
        if "Sınıf Listesi" in line:
            title = line
            break
    if not title:
        return None, []

    class_key, class_display = normalize_class(title)
    header_idx, bounds = find_header(rows)
    if header_idx is None:
        return (class_key, class_display), []

    students = []
    for row in rows[header_idx + 1:]:
        cols = {"sno": [], "no": [], "ad": [], "soyad": [], "cins": []}
        for w in row["words"]:
            x = w["x0"]
            if x < bounds["sno_max"]:
                cols["sno"].append(w["text"])
            elif x < bounds["no_max"]:
                cols["no"].append(w["text"])
            elif x < bounds["ad_max"]:
                cols["ad"].append(w["text"])
            elif x < bounds["soyad_max"]:
                cols["soyad"].append(w["text"])
            else:
                cols["cins"].append(w["text"])

        sno = " ".join(cols["sno"]).strip()
        no = " ".join(cols["no"]).strip()
        ad = " ".join(cols["ad"]).strip()
        soyad = " ".join(cols["soyad"]).strip()

        # basliklarin tekrari veya bos satirlar
        if soyad in ("Soyadı",) or ad in ("Adı",):
            continue
        if not re.fullmatch(r"\d+", sno or ""):
            continue
        if not ad and not soyad:
            continue

        students.append({
            "sira": int(sno),
            "ogrenci_no": no,
            "ad": ad,
            "soyad": soyad,
        })

    return (class_key, class_display), students


def main():
    if len(sys.argv) < 2:
        print("kullanim: python scripts/parse-class-list-pdf.py <pdf> [cikti.json]")
        return 1

    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "ogrenciler.json"

    classes = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            info, students = parse_page(page)
            if not info or not info[0]:
                continue
            key, display = info
            if key not in classes:
                classes[key] = {"class_key": key, "class_display": display, "students": []}
            classes[key]["students"].extend(students)

    result = list(classes.values())
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = sum(len(c["students"]) for c in result)
    lines = [f"{len(result)} sinif, {total} ogrenci -> {out_path}", ""]
    for c in result:
        lines.append(f"  {c['class_key']:<12} {len(c['students']):>3} ogrenci   {c['class_display']}")
    sys.stdout.buffer.write(("\n".join(lines) + "\n").encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
