# -*- coding: utf-8 -*-
"""Chinese language doc helpers."""

from history_doc_helpers import *  # noqa: F401, F403


def add_title_page(doc):
    title = doc.add_heading("人教版（统编版）初中语文 · 七～九年级中考总复习手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 统编版 · 2026中考适用 · 含全篇原文与译文")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "说明：本手册按**七上～九下**课本顺序编排，收录课内**古诗词全文**、"
        "**文言文原文+标准译文**、**古诗文默写填空卷**、**名著专项练习**及必背要点。"
        "孩子可按册复习，**对照本手册即可，不必逐页翻课本**。"
    )
    doc.add_paragraph()


def add_exercise_intro(doc, text):
    add_plain(doc, text)
    doc.add_paragraph()


def add_exercise_unit(doc, title):
    p = doc.add_paragraph()
    r = p.add_run(title)
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0, 51, 102)


def add_question(doc, num, stem, blank_lines=1):
    p = doc.add_paragraph()
    p.add_run(f"{num}. {stem}")
    for _ in range(blank_lines):
        bp = doc.add_paragraph("_" * 42)
        bp.paragraph_format.left_indent = Pt(24)


def add_choice_question(doc, num, stem, options):
    p = doc.add_paragraph()
    p.add_run(f"{num}. {stem}")
    for opt in options:
        op = doc.add_paragraph(opt)
        op.paragraph_format.left_indent = Pt(24)


def add_answers(doc, title, items):
    """items: [(num, answer), ...]"""
    add_exercise_unit(doc, title)
    for num, ans in items:
        p = doc.add_paragraph()
        r = p.add_run(f"{num}. ")
        r.bold = True
        p.add_run(ans)
    doc.add_paragraph()


def add_poem(doc, title, author, text, notes=None, must_mem=False):
    """Add a poem with full text."""
    p = doc.add_paragraph()
    tag = "★必背 " if must_mem else ""
    r = p.add_run(f"{tag}《{title}》")
    r.bold = True
    r.font.size = Pt(12)
    if author:
        p.add_run(f"  [{author}]")
    for line in text.strip().split("\n"):
        line = line.strip()
        if line:
            lp = doc.add_paragraph(line)
            lp.paragraph_format.left_indent = Pt(24)
            lp.paragraph_format.line_spacing = 1.25
    if notes:
        np = doc.add_paragraph()
        nr = np.add_run(f"▎考点：{notes}")
        nr.font.color.rgb = RGBColor(0, 112, 0)
        nr.font.size = Pt(10)
    doc.add_paragraph()


def add_prose(doc, title, author, original, translation, notes=None, must_mem=False):
    """Add classical Chinese with original + translation."""
    p = doc.add_paragraph()
    tag = "★必背 " if must_mem else ""
    r = p.add_run(f"{tag}{title}")
    r.bold = True
    r.font.size = Pt(12)
    if author:
        p.add_run(f"  [{author}]")
    add_block_title(doc, "原文", RGBColor(102, 0, 0))
    for para in original.strip().split("\n\n"):
        para = para.strip()
        if para:
            op = doc.add_paragraph(para)
            op.paragraph_format.left_indent = Pt(12)
            op.paragraph_format.line_spacing = 1.2
    add_block_title(doc, "译文", RGBColor(0, 51, 102))
    for para in translation.strip().split("\n\n"):
        para = para.strip()
        if para:
            tp = doc.add_paragraph(para)
            tp.paragraph_format.left_indent = Pt(12)
            tp.paragraph_format.line_spacing = 1.2
    if notes:
        np = doc.add_paragraph()
        nr = np.add_run(f"▎考点：{notes}")
        nr.font.color.rgb = RGBColor(0, 112, 0)
        nr.font.size = Pt(10)
    doc.add_paragraph()
