# -*- coding: utf-8 -*-
"""Word document formatting helpers for biology study notes."""

import re
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn


def setup_doc():
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "宋体"
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    style.font.size = Pt(11)
    return doc


def add_title_page(doc):
    title = doc.add_heading("人教版初中生物 · 七～八年级统考总复习手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 人教版（2024/2026版）· 2026初二统考适用")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "说明：本手册按「例子→概念」详细汇总，每节含必背要点、补充说明、易错提醒、常考题型。"
        "七上、七下、八上为2024年秋季启用；八下为2026年春季启用新版。非2012旧版教材。"
    )
    doc.add_paragraph()


def add_book_title(doc, title):
    doc.add_page_break()
    h = doc.add_heading(title, 1)
    h.alignment = WD_ALIGN_PARAGRAPH.LEFT


def add_chapter_title(doc, title):
    doc.add_heading(title, 2)


def add_section_title(doc, code, title):
    p = doc.add_paragraph()
    r = p.add_run(f"{code} {title}")
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)


def add_text_with_bold(doc, text, indent=False):
    """Parse **bold** markers in text."""
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.left_indent = Pt(18)
    parts = re.split(r"(\*\*.*?\*\*)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            r = p.add_run(part[2:-2])
            r.bold = True
        elif part:
            p.add_run(part)


def add_plain(doc, text):
    add_text_with_bold(doc, text)


def add_example(doc, example, concept, note=None):
    p = doc.add_paragraph()
    p.add_run(example)
    p.add_run("，体现的生物共同特征：")
    r = p.add_run(concept)
    r.bold = True
    if note:
        p2 = doc.add_paragraph()
        p2.paragraph_format.left_indent = Pt(18)
        r2 = p2.add_run(f"（{note}）")
        r2.font.color.rgb = RGBColor(89, 89, 89)
        r2.font.size = Pt(10)


def add_fact(doc, fact, concept=None):
    """General fact line, optionally ending with concept."""
    if concept:
        p = doc.add_paragraph()
        p.add_run(fact)
        p.add_run("，")
        r = p.add_run(concept)
        r.bold = True
    else:
        add_plain(doc, fact)


def add_block_title(doc, title, color=RGBColor(192, 0, 0)):
    p = doc.add_paragraph()
    r = p.add_run(f"【{title}】")
    r.bold = True
    r.font.color.rgb = color


def add_supplement(doc, items):
    add_block_title(doc, "补充说明", RGBColor(0, 112, 0))
    for item in items:
        if isinstance(item, tuple):
            add_text_with_bold(doc, f"关于{item[0]}：{item[1]}", indent=True)
        else:
            add_text_with_bold(doc, item, indent=True)


def add_errors(doc, items):
    add_block_title(doc, "易错")
    for item in items:
        add_text_with_bold(doc, item, indent=True)


def add_exam_types(doc, items):
    add_block_title(doc, "常考题型", RGBColor(0, 112, 192))
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)


def add_table_simple(doc, headers, rows):
    from docx.enum.table import WD_TABLE_ALIGNMENT
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        table.rows[0].cells[i].text = h
        for r in table.rows[0].cells[i].paragraphs[0].runs:
            r.bold = True
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            table.rows[ri + 1].cells[ci].text = str(val)
    doc.add_paragraph()
