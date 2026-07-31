#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate 人教版初中英语中考总复习手册 Word document."""

from english_doc_helpers import setup_doc, add_title_page
from english_content_main import (
    build_exam_overview,
    build_tense_cheat_sheet,
    build_word_formation,
    build_study_plan,
)
from english_content_grammar import build_grammar_all
from english_content_vocab import build_vocab_all
from english_content_exam import build_exam_all

OUTPUT = "人教版初中英语中考总复习手册.docx"


def build_document():
    doc = setup_doc()
    add_title_page(doc)
    build_exam_overview(doc)
    build_grammar_all(doc)
    build_vocab_all(doc)
    build_exam_all(doc)
    build_tense_cheat_sheet(doc)
    build_word_formation(doc)
    build_study_plan(doc)
    doc.save(OUTPUT)
    print(f"已生成：{OUTPUT}（约 {len(doc.paragraphs)} 段）")


if __name__ == "__main__":
    build_document()
