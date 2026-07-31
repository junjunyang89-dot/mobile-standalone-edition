#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中语文中考总复习手册 Word document."""

from yuwen_doc_helpers import setup_doc, add_title_page
from yuwen_content_main import (
    build_exam_overview,
    build_60_list,
    build_classics12,
    build_appendix,
    build_kebiao_extra,
)
from yuwen_full_qi import build_full_qi_shang, build_full_qi_xia
from yuwen_full_ba import build_full_ba_shang, build_full_ba_xia
from yuwen_full_jiu import build_full_jiu_shang, build_full_jiu_xia
from yuwen_exercise_moxie import build_moxie_exercises
from yuwen_exercise_classics import build_classics_exercises

OUTPUT = "人教版初中语文中考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_exam_overview(doc)
    # 按课本顺序：全篇原文 + 文言文译文
    build_full_qi_shang(doc)
    build_full_qi_xia(doc)
    build_full_ba_shang(doc)
    build_full_ba_xia(doc)
    build_full_jiu_shang(doc)
    build_full_jiu_xia(doc)
    build_kebiao_extra(doc)
    build_moxie_exercises(doc)
    build_classics_exercises(doc)
    build_60_list(doc)
    build_classics12(doc)
    build_appendix(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    print(f"已生成：{OUTPUT}（约 {n} 段）")


if __name__ == "__main__":
    build_document()
