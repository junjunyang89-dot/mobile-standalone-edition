# -*- coding: utf-8 -*-
"""几何模型归纳 + 拆题训练"""

from math_doc_helpers import (
    add_book_title,
    add_chapter_title,
    add_plain,
    add_model_card,
    add_decompose_drill,
    add_formula_block,
    add_errors,
    add_exam_types,
    add_table,
)


def build_geometry_models(doc):
    add_book_title(doc, "专题一：几何模型归纳（拆题→解题）")
    add_plain(doc,
                "**怎么用**：见到几何题 → 先想「像哪个模型」→ 再按模型步骤证或算。"
                "下面每个模型配 **拆题练习**，要求先独立填「我来拆题」四步，再对答案。")

    add_chapter_title(doc, "七年级模型")
    add_model_card(doc,
                   "铅笔模型 / 猪蹄模型（平行线拐角）",
                   "多条平行线中间有折线或Z字形、M字形拐角",
                   "过拐点作平行线，把角拆成两个内错角或同旁内角；或：拐角=两平行线同侧内角之和",
                   "如图l₁∥l₂，折线ABCD，∠B+∠D=∠A+∠C（常见结论，具体看图）")
    add_model_card(doc,
                   "数轴上动点 / 距离",
                   "动点P在数轴上运动，求PA+PB最小或|P−A|+|P−B|",
                   "① 标各点坐标 ② 距离=右−左或|a−b| ③ 分类讨论动点位置",
                   "A(−2)，B(3)，P在数轴上，PA+PB最小→P在线段AB上，最小=5")

    add_decompose_drill(doc, 1,
                      "如图，AB∥CD，∠ABE=40°，∠CDE=30°，求∠BED。",
                      [("圈关键词", "平行、拐角"),
                       ("判模型", "平行线+拐点→过E作平行线"),
                       ("找角关系", "内错角相等"),
                       ("列式计算", "∠BED=40°+30°")],
                      "AB∥CD → 过E作EF∥AB → ∠BEF=∠ABE=40°，∠DEF=∠CDE=30°（内错角）",
                      "∠BED = ∠BEF + ∠DEF = 40° + 30° = **70°**")

    add_chapter_title(doc, "八年级模型 ★（初二核心）")
    add_table(doc, ["模型", "识别特征", "关键结论/作法"], [
        ["手拉手全等", "两个等腰共顶点，旋转", "旋转前后对应边相等，证SAS"],
        ["一线三等角", "同一直线上三个直角或等角", "证两对三角形全等"],
        ["角平分线+垂直", "角平分线上一点到两边距离", "角平分线上的点到角两边距离相等"],
        ["对称/折叠", "折痕是对称轴", "对应边、对应角相等；常作垂线连对称点"],
        ["最短路径", "河对岸一点、军营饮马", "作对称点，连直线段"],
        ["K字 / 一线三垂直", "两个直角三角形共斜边一线", "证全等或相似（九年级）"],
    ], [2.5, 4, 7])

    add_model_card(doc,
                   "手拉手模型（共顶点旋转）",
                   "△OAB与△OCD均为等腰，OA=OB，OC=OD，∠AOB=∠COD",
                   "证△OAC≌△OBD（SAS）→ AC=BD，夹角相等",
                   "常见于正方形、等腰直角三角形旋转")

    add_model_card(doc,
                   "角平分线性质 + 垂线",
                   "P在∠AOB平分线上，PM⊥OA，PN⊥OB",
                   "PM=PN；逆命题：到两边距离相等的点在角平分线上",
                   "证明题常作PM⊥OA，PN⊥OB")

    add_model_card(doc,
                   "将军饮马（最短路径）",
                   "A在河一侧，要到河对岸某处再返回，求最短路线",
                   "作A关于河岸的对称点A′，连A′B交河于P，P即为所求",
                   "也可用于：正方形内动点PA+PB最小")

    add_decompose_drill(doc, 2,
                      "如图，P是∠AOB平分线上一点，PM⊥OA于M，PN⊥OB于N，PM=3，求PN。",
                      [("圈关键词", "角平分线、垂直、距离"),
                       ("判模型", "角平分线性质"),
                       ("找关系", "角平分线上的点到两边距离相等"),
                       ("写结论", "PN=PM")],
                      "P在角平分线上，PM⊥OA，PN⊥OB → 角平分线性质：PM=PN",
                      "PN = PM = **3**")

    add_decompose_drill(doc, 3,
                      "已知：AB=AD，∠BAD=∠EAC，AE=AC。求证：BD=CE。",
                      [("圈已知", "两组边相等，夹角关系"),
                       ("判模型", "手拉手（共顶点A旋转）"),
                       ("证全等", "△ABD与△ACE，SAS"),
                       ("得结论", "对应边BD=CE")],
                      "∠BAD=∠EAC → 两边夹角相等 → △ABD≌△ACE（SAS）",
                      "BD = CE")

    add_chapter_title(doc, "八下～九年级模型")
    add_model_card(doc,
                   "勾股定理 — 弦图 / 面积法",
                   "直角三角形三边上各作正方形，证a²+b²=c²",
                   "用面积分割或补形，小学→初中证明")

    add_model_card(doc,
                   "A字型相似",
                   "DE∥BC，截△ABC",
                   "△ADE∽△ABC，AD/AB=AE/AC=DE/BC")

    add_model_card(doc,
                   "双垂直射影（直角三角形）",
                   "Rt△ABC，CD⊥AB",
                   "CD²=AD·BD；AC²=AB·AD（射影定理，九下）")

    add_model_card(doc,
                   "圆 — 垂径定理",
                   "圆心到弦的垂线",
                   "垂直于弦的直径平分弦，且平分所对的两条弧")

    add_decompose_drill(doc, 4,
                      "在⊙O中，弦AB=8，OC⊥AB于C，OC=3，求半径。",
                      [("圈关键词", "圆、弦、垂直"),
                       ("判模型", "垂径定理"),
                       ("作图关系", "C为AB中点，AC=4"),
                       ("勾股", "R²=4²+3²")],
                      "OC⊥AB → C为AB中点，AC=4；连OA，Rt△OAC",
                      "R = √(16+9) = **5**")

    add_errors(doc, [
        "没看清「平行」就乱作辅助线——先找平行，再过拐点作平行线。",
        "全等证明跳步——必须写清**三对应**（边或角），判定依据（SAS等）不能省。",
        "将军饮马忘了**对称**——最短路径几乎都要转化到「两点之间线段最短」。",
        "相似比混淆——对应顶点顺序必须一致：△ADE∽△ABC，则AD对应AB。",
    ])
    add_exam_types(doc, [
        "平行线拐角求角（铅笔/猪蹄）",
        "证全等（手拉手、角平分线作垂线）",
        "最短路径作对称",
        "圆中垂径+勾股",
        "相似A字/X字",
    ])
