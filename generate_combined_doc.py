#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 五科合订版统考/中考总复习手册 Word document."""

from combined_doc_helpers import setup_doc, add_master_title_page
from combined_builders import build_disheng_parts, build_zhongkao_parts

OUTPUT = "人教版初中统考中考总复习合订手册.docx"


def build_document():
    doc = setup_doc()
    add_master_title_page(doc)
    build_disheng_parts(doc)
    build_zhongkao_parts(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    print(f"已生成：{OUTPUT}（约 {n} 段）")


if __name__ == "__main__":
    build_document()
