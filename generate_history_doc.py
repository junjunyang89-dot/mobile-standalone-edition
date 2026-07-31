#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中历史统考总复习手册 Word document."""

from history_doc_helpers import setup_doc, add_title_page
from history_content_qi_shang import build_qi_shang
from history_content_jiu import build_jiu_shang, build_jiu_xia
from history_content_rest import build_qi_xia, build_ba_shang, build_ba_xia, build_appendix

OUTPUT = "人教版初中历史统考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_qi_shang(doc)
    build_qi_xia(doc)
    build_ba_shang(doc)
    build_ba_xia(doc)
    build_jiu_shang(doc)
    build_jiu_xia(doc)
    build_appendix(doc)
    doc.save(OUTPUT)
    print(f"已生成：{OUTPUT}")


if __name__ == "__main__":
    build_document()
