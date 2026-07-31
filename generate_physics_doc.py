#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中物理中考总复习手册 Word document."""

from physics_doc_helpers import setup_doc, add_title_page
from physics_content_main import (
    build_exam_overview,
    build_decompose_guide,
    build_formula_cheat_sheet,
    build_study_plan,
)
from physics_content_ba_shang import build_ba_shang
from physics_content_ba_xia import build_ba_xia
from physics_content_jiu import build_jiu
from physics_content_drill_lixue_dianxue import build_mechanics_guide, build_electric_guide

OUTPUT = "人教版初中物理中考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_exam_overview(doc)
    build_decompose_guide(doc)
    build_mechanics_guide(doc)
    build_ba_shang(doc)
    build_ba_xia(doc)
    build_electric_guide(doc)
    build_jiu(doc)
    build_formula_cheat_sheet(doc)
    build_study_plan(doc)
    doc.save(OUTPUT)
    print(f"已生成：{OUTPUT}（约 {len(doc.paragraphs)} 段）")


if __name__ == "__main__":
    build_document()
