#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中道德与法治中考总复习手册 Word document."""

from ddfz_doc_helpers import setup_doc, add_title_page
from ddfz_content_main import build_exam_overview, build_open_book_index, build_appendix, build_exercises
from ddfz_content_qi import build_qi_shang, build_qi_xia
from ddfz_content_ba import build_ba_shang, build_ba_xia
from ddfz_content_jiu import build_jiu_shang, build_jiu_xia

OUTPUT = "人教版初中道德与法治中考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_exam_overview(doc)
    build_open_book_index(doc)
    build_qi_shang(doc)
    build_qi_xia(doc)
    build_ba_shang(doc)
    build_ba_xia(doc)
    build_jiu_shang(doc)
    build_jiu_xia(doc)
    build_exercises(doc)
    build_appendix(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    print(f"已生成：{OUTPUT}（约 {n} 段）")


if __name__ == "__main__":
    build_document()
