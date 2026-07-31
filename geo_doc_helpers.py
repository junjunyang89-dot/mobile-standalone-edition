# -*- coding: utf-8 -*-
"""Geography doc helpers - reuse history helpers."""

from history_doc_helpers import *  # noqa: F401, F403


def add_title_page(doc):
    title = doc.add_heading("人教版初中地理 · 七～八年级地生会考总复习手册", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("2022新课标 · 人教版（2024/2025/2026版）· 2026初二地生会考适用")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(89, 89, 89)
    doc.add_paragraph(
        "说明：初中地理为人教版（七～八年级），共四册，**没有九年级地理课本**。"
        "七年级学世界地理，八年级学中国地理。初二地生会考考七～八年级全部内容。"
        "七上2024秋、七下2025春、八上2024秋、八下2025春启用新版。"
    )
    doc.add_paragraph()
