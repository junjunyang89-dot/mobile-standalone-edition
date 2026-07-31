# -*- coding: utf-8 -*-
"""合订手册各科目内容构建（供全科/地生/中考合订复用）"""

from combined_doc_helpers import add_part_divider

from bio_content_qi_shang import build_qi_shang as bio_qi_shang
from bio_content_rest import (
    build_qi_xia as bio_qi_xia,
    build_ba_shang as bio_ba_shang,
    build_ba_xia as bio_ba_xia,
    build_appendix as bio_appendix,
)

from geo_content_qi_shang import build_qi_shang as geo_qi_shang
from geo_content_rest import (
    build_qi_xia as geo_qi_xia,
    build_ba_shang as geo_ba_shang,
    build_ba_xia as geo_ba_xia,
    build_no_grade9 as geo_no_grade9,
    build_appendix as geo_appendix,
)

from history_content_qi_shang import build_qi_shang as hist_qi_shang
from history_content_jiu import build_jiu_shang as hist_jiu_shang, build_jiu_xia as hist_jiu_xia
from history_content_rest import (
    build_qi_xia as hist_qi_xia,
    build_ba_shang as hist_ba_shang,
    build_ba_xia as hist_ba_xia,
    build_appendix as hist_appendix,
)

from yuwen_content_main import (
    build_exam_overview as yuwen_overview,
    build_60_list,
    build_classics12,
    build_appendix as yuwen_appendix,
    build_kebiao_extra,
)
from yuwen_full_qi import build_full_qi_shang, build_full_qi_xia
from yuwen_full_ba import build_full_ba_shang, build_full_ba_xia
from yuwen_full_jiu import build_full_jiu_shang, build_full_jiu_xia
from yuwen_exercise_moxie import build_moxie_exercises
from yuwen_exercise_classics import build_classics_exercises

from ddfz_content_main import (
    build_exam_overview as ddfz_overview,
    build_open_book_index,
    build_appendix as ddfz_appendix,
    build_exercises as ddfz_exercises,
)
from ddfz_content_qi import build_qi_shang as ddfz_qi_shang, build_qi_xia as ddfz_qi_xia
from ddfz_content_ba import build_ba_shang as ddfz_ba_shang, build_ba_xia as ddfz_ba_xia
from ddfz_content_jiu import build_jiu_shang as ddfz_jiu_shang, build_jiu_xia as ddfz_jiu_xia


def build_bio_part(doc, part_no="一"):
    add_part_divider(doc, part_no, "生物", "初二地生会考 · 七～八年级四册")
    bio_qi_shang(doc)
    bio_qi_xia(doc)
    bio_ba_shang(doc)
    bio_ba_xia(doc)
    bio_appendix(doc)


def build_geo_part(doc, part_no="二"):
    add_part_divider(doc, part_no, "地理", "初二地生会考 · 七～八年级四册")
    geo_qi_shang(doc)
    geo_qi_xia(doc)
    geo_ba_shang(doc)
    geo_ba_xia(doc)
    geo_no_grade9(doc)
    geo_appendix(doc)


def build_history_part(doc, part_no="三"):
    add_part_divider(doc, part_no, "历史", "初三中考 · 七～九年级")
    hist_qi_shang(doc)
    hist_qi_xia(doc)
    hist_ba_shang(doc)
    hist_ba_xia(doc)
    hist_jiu_shang(doc)
    hist_jiu_xia(doc)
    hist_appendix(doc)


def build_yuwen_part(doc, part_no="四"):
    add_part_divider(doc, part_no, "语文", "初三中考 · 七～九年级 · 古诗文全文+默写+名著")
    yuwen_overview(doc)
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
    yuwen_appendix(doc)


def build_ddfz_part(doc, part_no="五"):
    add_part_divider(doc, part_no, "道德与法治", "初三中考 · 开卷 · 含速查索引")
    ddfz_overview(doc)
    build_open_book_index(doc)
    ddfz_qi_shang(doc)
    ddfz_qi_xia(doc)
    ddfz_ba_shang(doc)
    ddfz_ba_xia(doc)
    ddfz_jiu_shang(doc)
    ddfz_jiu_xia(doc)
    ddfz_exercises(doc)
    ddfz_appendix(doc)


def build_disheng_parts(doc):
    build_bio_part(doc, "一")
    build_geo_part(doc, "二")


def build_zhongkao_parts(doc):
    build_history_part(doc, "一")
    build_yuwen_part(doc, "二")
    build_ddfz_part(doc, "三")
