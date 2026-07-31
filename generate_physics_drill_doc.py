#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中物理拆题专练手册 Word document."""

import os

from physics_doc_helpers import setup_doc
from physics_figure_draw import ensure_all_figures, clear_cache, FIGURE_DIR
from physics_content_drill import build_all_drills

OUTPUT = "人教版初中物理拆题专练手册.docx"


def build_document():
    clear_cache()
    os.environ.setdefault("MPLCONFIGDIR", str(FIGURE_DIR / ".mpl_cache"))
    ensure_all_figures(FIGURE_DIR)
    doc = setup_doc()
    build_all_drills(doc)
    doc.save(OUTPUT)
    n_fig = len(list(FIGURE_DIR.glob("*.png")))
    print(f"已生成：{OUTPUT}（约 {len(doc.paragraphs)} 段，配图 {n_fig} 张）")


if __name__ == "__main__":
    build_document()
