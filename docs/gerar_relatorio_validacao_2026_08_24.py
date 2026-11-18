from pathlib import Path
from html import escape
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "documento-erros-validacao-2026-08-24.md"
OUT = ROOT / "output" / "pdf" / "relatorio-validacao-funcional-lucromais-2026-08-24-v2.pdf"


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverX", parent=styles["Title"], fontName="Helvetica-Bold",
                          fontSize=23, leading=28, textColor=colors.HexColor("#0f3d56"),
                          alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="H1X", parent=styles["Heading1"], fontName="Helvetica-Bold",
                          fontSize=15, leading=19, textColor=colors.HexColor("#0f3d56"),
                          spaceBefore=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="H2X", parent=styles["Heading2"], fontName="Helvetica-Bold",
                          fontSize=10.5, leading=13, textColor=colors.HexColor("#145374"),
                          spaceBefore=7, spaceAfter=3, keepWithNext=True))
styles.add(ParagraphStyle(name="BodyX", parent=styles["BodyText"], fontSize=8.5, leading=11.5,
                          textColor=colors.HexColor("#263238"), spaceAfter=4))
styles.add(ParagraphStyle(name="SmallX", parent=styles["BodyText"], fontSize=6.8, leading=8.2,
                          textColor=colors.HexColor("#263238")))
styles.add(ParagraphStyle(name="SmallHeaderX", parent=styles["SmallX"], fontName="Helvetica-Bold",
                          textColor=colors.white))


def clean(text):
    text = re.sub(r"[*_]", "", text)
    return text.replace(chr(96), "").strip()


def para(text, style="BodyX"):
    return Paragraph(escape(clean(text)).replace("\n", "<br/>"), styles[style])


def table_flow(rows):
    count = len(rows[0])
    if count == 2:
        widths = [44 * mm, 132 * mm]
    elif count == 3:
        widths = [40 * mm, 43 * mm, 93 * mm]
    elif count == 4:
        widths = [35 * mm, 40 * mm, 53 * mm, 48 * mm]
    else:
        widths = [176 * mm / count] * count
    converted = []
    for idx, row in enumerate(rows):
        style = "SmallHeaderX" if idx == 0 else "SmallX"
        converted.append([para(cell, style) for cell in row])
    tbl = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3d56")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for row in range(2, len(rows), 2):
        commands.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#f8fafc")))
    tbl.setStyle(TableStyle(commands))
    return tbl


def parse_markdown(text):
    lines = text.splitlines()
    story = [
        Spacer(1, 18 * mm),
        para("RELATÓRIO DE VALIDAÇÃO GERAL", "CoverX"),
        para("Lucro+ — teste funcional orientado a usuário", "BodyX"),
        Spacer(1, 5 * mm),
    ]
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("# "):
            i += 1
            continue
        if line.startswith("## "):
            story.append(para(line[3:], "H1X"))
            i += 1
            continue
        if line.startswith("### "):
            story.append(para(line[4:], "H2X"))
            i += 1
            continue
        if line.startswith("**ID:"):
            story.append(para(line, "BodyX"))
            i += 1
            continue
        if line.startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                current = lines[i].strip()
                cells = [c.strip() for c in current.strip("|").split("|")]
                if not all(re.fullmatch(r"[-: ]+", c or " ") for c in cells):
                    block.append(cells)
                i += 1
            if block:
                story.append(table_flow(block))
                story.append(Spacer(1, 4))
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(("#", "|")):
            paragraph.append(lines[i].strip())
            i += 1
        story.append(para(" ".join(paragraph), "BodyX"))
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d9e2ec"))
    canvas.line(17 * mm, 12 * mm, A4[0] - 17 * mm, 12 * mm)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(17 * mm, 8 * mm, "Lucro+ | Validação geral orientada a usuário | 24/08/2026")
    canvas.drawRightString(A4[0] - 17 * mm, 8 * mm, f"Página {doc.page}")
    canvas.restoreState()


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    story = parse_markdown(SOURCE.read_text(encoding="utf-8"))
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=17 * mm, leftMargin=17 * mm,
                            topMargin=17 * mm, bottomMargin=17 * mm, title="Relatório de Validação Geral — Lucro+")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT)


if __name__ == "__main__":
    build()
