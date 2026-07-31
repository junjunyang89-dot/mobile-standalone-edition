# -*- coding: utf-8 -*-
"""初中英语 Word 文档 helpers."""

from history_doc_helpers import *  # noqa: F401, F403


def add_title_page(doc):
    title = doc.add_heading("人教版初中英语 · 七～九年级中考总复习手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 人教版（Go for it!）· 2026中考适用")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "说明：本手册汇总七～九年级**必背词汇、语法、句型、写作模板**与**常考题型技巧**。"
        "按「概念→例句→易错→题型」编排，适合初三总复习，也可供八年级提前积累。"
        "含**语法速查、高频短语、书面表达万能句**。"
    )
    doc.add_paragraph()


def add_concept_block(doc, items):
    add_block_title(doc, "核心要点", RGBColor(0, 51, 102))
    for item in items:
        add_text_with_bold(doc, item, indent=True)


def add_grammar_block(doc, title, structure, examples, notes=None):
    p = doc.add_paragraph()
    r = p.add_run(f"▎{title}")
    r.bold = True
    r.font.color.rgb = RGBColor(0, 51, 102)
    add_text_with_bold(doc, f"**结构**：{structure}", indent=True)
    add_block_title(doc, "例句", RGBColor(0, 112, 0))
    for ex in examples:
        add_text_with_bold(doc, ex, indent=True)
    if notes:
        add_errors(doc, notes)


def add_vocab_table(doc, headers, rows, col_widths=None):
    n = len(headers)
    default_widths = {2: [4, 6], 3: [3, 3, 5], 4: [2, 2, 2.5, 2.5]}
    add_table(doc, headers, rows, col_widths or default_widths.get(n, [3] * n))


def add_phrase_block(doc, title, phrases):
    add_block_title(doc, title, RGBColor(128, 0, 128))
    for p in phrases:
        add_text_with_bold(doc, p, indent=True)


def add_writing_template(doc, genre, outline, sample_sentences, sample_paragraph=None):
    p = doc.add_paragraph()
    r = p.add_run(f"▎{genre}")
    r.bold = True
    r.font.color.rgb = RGBColor(0, 51, 102)
    add_text_with_bold(doc, f"**结构**：{outline}", indent=True)
    add_block_title(doc, "万能句型", RGBColor(0, 112, 192))
    for s in sample_sentences:
        add_text_with_bold(doc, s, indent=True)
    if sample_paragraph:
        add_block_title(doc, "范文片段", RGBColor(0, 112, 0))
        add_plain(doc, sample_paragraph)
    doc.add_paragraph()


def add_mistake_pair(doc, wrong, right, reason=None):
    add_text_with_bold(doc, f"✗ {wrong}", indent=True)
    add_text_with_bold(doc, f"✓ {right}", indent=True)
    if reason:
        add_text_with_bold(doc, f"　→ {reason}", indent=True)
