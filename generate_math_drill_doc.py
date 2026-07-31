#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 七～八年级数学拆题专练手册（几何+应用题，含配图）."""

import os

from math_doc_helpers import setup_doc
from math_figure_draw import ensure_all_figures, clear_cache, FIGURE_DIR
from math_content_drill_78 import (
    _drill_title_page,
    build_drill_qi_geometry,
    build_drill_ba_geometry,
    build_drill_qi_apps,
    build_drill_ba_apps,
)

OUTPUT = "人教版初中数学七八年级拆题专练手册.docx"


def build_document():
    clear_cache()
    os.environ.setdefault("MPLCONFIGDIR", str(FIGURE_DIR / ".mpl_cache"))
    ensure_all_figures(FIGURE_DIR)
    doc = setup_doc()
    _drill_title_page(doc)
    build_drill_qi_geometry(doc)
    build_drill_ba_geometry(doc)
    build_drill_qi_apps(doc)
    build_drill_ba_apps(doc)
    doc.save(OUTPUT)
    n = len(doc.paragraphs)
    n_fig = len(list(FIGURE_DIR.glob("*.png")))
    print(f"已生成：{OUTPUT}（约 {n} 段，配图 {n_fig} 张）")


if __name__ == "__main__":
    build_document()
