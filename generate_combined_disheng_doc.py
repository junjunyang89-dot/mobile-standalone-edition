#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 地生会考合订手册（生物+地理）."""

from combined_doc_helpers import setup_doc, add_disheng_title_page
from combined_builders import build_disheng_parts

OUTPUT = "人教版初中地生会考总复习合订手册.docx"


def build_document():
    doc = setup_doc()
    add_disheng_title_page(doc)
    build_disheng_parts(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    print(f"已生成：{OUTPUT}（约 {n} 段）")


if __name__ == "__main__":
    build_document()
