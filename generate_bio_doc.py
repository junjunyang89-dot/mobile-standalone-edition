#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate detailed 人教版初中生物统考总复习手册 Word document."""

from bio_doc_helpers import setup_doc, add_title_page
from bio_content_qi_shang import build_qi_shang
from bio_content_rest import build_qi_xia, build_ba_shang, build_ba_xia, build_appendix

OUTPUT = "人教版初中生物统考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_qi_shang(doc)
    build_qi_xia(doc)
    build_ba_shang(doc)
    build_ba_xia(doc)
    build_appendix(doc)
    doc.save(OUTPUT)
    print(f"已生成：{OUTPUT}")


if __name__ == "__main__":
    build_document()
