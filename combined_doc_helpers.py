# -*- coding: utf-8 -*-
"""合订版 Word 文档 helpers."""

from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from history_doc_helpers import setup_doc, add_plain, add_table, add_chapter_title  # noqa: F401


def add_master_title_page(doc):
    title = doc.add_heading("人教版（统编版）初中 · 统考/中考总复习合订手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 统编版 · 2026适用 · 生物+地理+历史+语文+道法")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "本合订本收录五科复习手册全文，按科目分编。"
        "**初二地生会考**重点看第一、二编（生物、地理）；"
        "**初三中考**重点看第三～五编（历史、语文、道德与法治）。"
    )
    add_table(doc, ["编次", "科目", "适用考试", "复习重点"], [
        ["第一编", "生物", "初二地生会考", "七～八年级四册；理解+默写"],
        ["第二编", "地理", "初二地生会考", "七～八年级四册；读图+背记"],
        ["第三编", "历史", "初三中考", "七～九年级；时间轴+史实"],
        ["第四编", "语文", "初三中考", "古诗文全文+默写+名著"],
        ["第五编", "道德与法治", "初三中考（开卷）", "八下法治+九年级；见速查索引"],
    ], [1.5, 2.5, 3, 7.5])
    doc.add_paragraph()


def add_disheng_title_page(doc):
    title = doc.add_heading("人教版（统编版）初中 · 地生会考总复习合订手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 统编版 · 2026初二地生会考适用 · 生物+地理")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "本合订本收录**生物、地理**两科复习手册全文，适用于**初二下学期地生会考**。"
        "考查范围均为七～八年级四册（九年级无生物、地理课本）。"
    )
    add_table(doc, ["编次", "科目", "复习重点"], [
        ["第一编", "生物", "七～八年级四册；概念+图表+默写"],
        ["第二编", "地理", "七～八年级四册；读图+背记+综合"],
    ], [2, 2.5, 9])
    doc.add_paragraph()


def add_zhongkao_title_page(doc):
    title = doc.add_heading("人教版（统编版）初中 · 中考总复习合订手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 统编版 · 2026初三中考适用 · 历史+语文+道德与法治")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "本合订本收录**历史、语文、道德与法治**三科复习手册全文，适用于**初三中考**。"
        "道法为开卷考试，第五编开头附**开卷速查索引**。"
    )
    add_table(doc, ["编次", "科目", "复习重点"], [
        ["第一编", "历史", "七～九年级；时间轴+史实+世界史"],
        ["第二编", "语文", "古诗文全文+默写卷+名著+文言文译文"],
        ["第三编", "道德与法治", "八下法治专册+九年级；开卷速查索引"],
    ], [2, 3, 9])
    doc.add_paragraph()


def add_part_divider(doc, part_no, title, subtitle):
    doc.add_page_break()
    h = doc.add_heading(f"第{part_no}编  {title}", 0)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(subtitle)
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(102, 0, 0)
    doc.add_paragraph()
