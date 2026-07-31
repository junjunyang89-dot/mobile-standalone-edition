# -*- coding: utf-8 -*-
"""道德与法治 Word document helpers."""

from history_doc_helpers import *  # noqa: F401, F403


def add_title_page(doc):
    title = doc.add_heading("人教版（统编版）初中道德与法治 · 七～九年级中考总复习手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 统编版（2024/2026版）· 2026中考适用")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "说明：道德与法治为**教育部统编版**（人民教育出版社），初三**中考开卷考查**。"
        "本手册按七上～九下编排，提炼**核心观点、必背表述、易错点**；"
        "**八下法治专册**与**九年级**为中考重中之重。"
    )
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
