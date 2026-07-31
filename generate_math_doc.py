#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中数学总复习手册 Word document."""

from math_doc_helpers import setup_doc, add_title_page
from math_content_main import build_exam_overview, build_formula_cheat_sheet, build_summer_plan
from math_content_models_geo import build_geometry_models
from math_content_algebra import build_algebra_guide, build_word_problem_guide
from math_content_qi import build_qi_shang, build_qi_xia
from math_content_ba import build_ba_shang, build_ba_xia
from math_content_jiu import build_jiu_shang, build_jiu_xia

OUTPUT = "人教版初中数学总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_exam_overview(doc)
    build_geometry_models(doc)
    build_algebra_guide(doc)
    build_word_problem_guide(doc)
    build_qi_shang(doc)
    build_qi_xia(doc)
    build_ba_shang(doc)
    build_ba_xia(doc)
    build_jiu_shang(doc)
    build_jiu_xia(doc)
    build_formula_cheat_sheet(doc)
    build_summer_plan(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    print(f"已生成：{OUTPUT}（约 {n} 段）")


if __name__ == "__main__":
    build_document()
