# -*- coding: utf-8 -*-
"""初中几何/应用题配图生成（matplotlib → PNG，供 Word 插入）。"""

from __future__ import annotations

import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Arc, FancyArrowPatch  # noqa: E402

# 中文字体：macOS 优先 PingFang / STHeiti
plt.rcParams["font.sans-serif"] = ["PingFang SC", "Heiti SC", "STHeiti", "Arial Unicode MS", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

FIGURE_DIR = Path(__file__).resolve().parent / "math_figures"
_ACTIVE_DIR = FIGURE_DIR
DPI = 150
FIG_W = 4.8
FIG_H = 3.2


def set_figure_dir(path: Path | str) -> None:
    global _ACTIVE_DIR
    _ACTIVE_DIR = Path(path)


def _new_fig():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def _save(fig, fig_id: str) -> str:
    _ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = _ACTIVE_DIR / f"{fig_id}.png"
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white", pad_inches=0.15)
    plt.close(fig)
    return str(path)


def _line(ax, p1, p2, **kw):
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], **kw)


def _point(ax, p, label, offset=(0.08, 0.08)):
    ax.plot(p[0], p[1], "ko", ms=3)
    ax.text(p[0] + offset[0], p[1] + offset[1], label, fontsize=11, ha="center")


def _angle_arc(ax, center, v1, v2, radius=0.35, label=None, color="#C00000"):
    import math
    a1 = math.degrees(math.atan2(v1[1], v1[0]))
    a2 = math.degrees(math.atan2(v2[1], v2[0]))
    if a2 < a1:
        a2 += 360
    arc = Arc(center, 2 * radius, 2 * radius, angle=0, theta1=a1, theta2=a2, color=color, lw=1.5)
    ax.add_patch(arc)
    if label:
        mid = math.radians((a1 + a2) / 2)
        ax.text(center[0] + (radius + 0.15) * math.cos(mid),
                center[1] + (radius + 0.15) * math.sin(mid),
                label, fontsize=10, color=color, ha="center")


# ── 七年级几何 ──────────────────────────────────────────────

def fig_parallel_corresponding():
    fig, ax = _new_fig()
    _line(ax, (0, 2), (6, 2), color="k", lw=1.5)
    _line(ax, (0, 0), (6, 0), color="k", lw=1.5)
    _line(ax, (2, -0.5), (4, 2.8), color="k", lw=1.5)
    _point(ax, (0.2, 2), "A", (-0.15, 0.1))
    _point(ax, (5.8, 2), "B", (0.05, 0.1))
    _point(ax, (0.2, 0), "C", (-0.15, -0.25))
    _point(ax, (5.8, 0), "D", (0.05, -0.25))
    ax.text(3, 2.15, "AB∥CD", fontsize=10, ha="center", color="#0066CC")
    _angle_arc(ax, (3.2, 2), (1, 0), (0.8, 0.6), radius=0.3, label="∠1=35°")
    ax.text(0.5, -0.55, "截线", fontsize=9, color="#666")
    return _save(fig, "parallel_corresponding")


def fig_pencil_model():
    fig, ax = _new_fig()
    _line(ax, (0, 2.5), (6, 2.5), color="k", lw=1.5)
    _line(ax, (0, 0.5), (6, 0.5), color="k", lw=1.5)
    _line(ax, (1.5, 2.5), (3, 1.5), color="k", lw=1.5)
    _line(ax, (3, 1.5), (4.5, 0.5), color="k", lw=1.5)
    _point(ax, (0.2, 2.5), "A")
    _point(ax, (5.8, 2.5), "B")
    _point(ax, (0.2, 0.5), "C")
    _point(ax, (5.8, 0.5), "D")
    _point(ax, (3, 1.5), "E", (0, 0.12))
    _angle_arc(ax, (1.5, 2.5), (1, 0), (-0.5, -1), radius=0.35, label="50°")
    _angle_arc(ax, (4.5, 0.5), (-1, 0), (0.5, 1), radius=0.35, label="40°")
    ax.text(3, 2.65, "AB∥CD", fontsize=10, ha="center", color="#0066CC")
    ax.text(3.5, 1.35, "求∠BED", fontsize=10, color="#C00000")
    return _save(fig, "pencil_model")


def fig_m_shape():
    fig, ax = _new_fig()
    _line(ax, (0, 3), (6, 3), color="k", lw=1.5)
    _line(ax, (0, 0), (6, 0), color="k", lw=1.5)
    pts = [(1, 3), (2, 1.8), (3, 2.6), (4, 1.2), (5, 0)]
    for i in range(len(pts) - 1):
        _line(ax, pts[i], pts[i + 1], color="k", lw=1.5)
    labels = ["A", "B", "C"]
    coords = [(1, 3), (3, 2.6), (5, 0)]
    degs = ["30°", "?", "25°"]
    for (x, y), lb, d in zip(coords, labels, degs):
        _point(ax, (x, y), lb)
        ax.text(x + 0.15, y + 0.2, d, fontsize=10, color="#C00000")
    ax.text(3, 3.15, "l1//l2", fontsize=10, ha="center", color="#0066CC")
    ax.text(3, -0.35, "求∠B（拐点处）", fontsize=10, ha="center", color="#C00000")
    return _save(fig, "m_shape")


def fig_angle_bisector():
    fig, ax = _new_fig()
    o = (1, 0.5)
    _line(ax, o, (5.5, 2.5), color="k", lw=1.5)
    _line(ax, o, (5.5, -1), color="k", lw=1.5)
    _line(ax, o, (4.8, 1.8), linestyle="--", color="#0066CC", lw=1)
    _point(ax, o, "O", (-0.2, -0.15))
    _point(ax, (5.5, 2.5), "A")
    _point(ax, (5.5, -1), "B")
    _point(ax, (4.8, 1.8), "C", (0.05, 0.1))
    _angle_arc(ax, o, (1, 0.8), (0.9, 0.2), radius=0.55, label="25°")
    ax.text(3.2, 0.2, "OC平分∠AOB", fontsize=10, color="#0066CC")
    ax.text(3.2, -0.15, "求∠AOB", fontsize=10, color="#C00000")
    return _save(fig, "angle_bisector")


def fig_segment_midpoint():
    fig, ax = _new_fig()
    _line(ax, (0.5, 1), (5.5, 1), color="k", lw=2)
    for x, lb in [(0.5, "A"), (2.75, "M"), (4, "N"), (5.5, "B")]:
        ax.plot(x, 1, "ko", ms=4)
        ax.text(x, 1.18, lb, ha="center", fontsize=11)
    ax.annotate("", xy=(5.5, 1), xytext=(0.5, 1),
                arrowprops=dict(arrowstyle="<->", color="#666"))
    ax.text(3, 0.65, "AB = 12", ha="center", fontsize=10)
    ax.text(1.6, 1.35, "中点", fontsize=9, color="#0066CC")
    ax.text(3.35, 1.35, "中点", fontsize=9, color="#0066CC")
    ax.text(3, 1.55, "求 AN", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "segment_midpoint")


def fig_coord_reflect_y():
    fig, ax = _new_fig()
    ax.axhline(0, color="#999", lw=0.8)
    ax.axvline(0, color="#999", lw=0.8)
    ax.arrow(-0.2, 0, 5.8, 0, head_width=0.12, head_length=0.15, fc="#999", ec="#999")
    ax.arrow(0, -0.2, 0, 3.5, head_width=0.12, head_length=0.15, fc="#999", ec="#999")
    ax.text(5.5, -0.25, "x", fontsize=10)
    ax.text(-0.25, 3.3, "y", fontsize=10)
    _point(ax, (-1, 2), "A(−1,2)", (-0.5, 0.15))
    _point(ax, (1, 2), "A′(1,2)", (0.05, 0.15))
    _line(ax, (-1, 2), (1, 2), linestyle="--", color="#0066CC", lw=1)
    ax.text(0, 2.35, "关于 y 轴对称", ha="center", fontsize=10, color="#0066CC")
    return _save(fig, "coord_reflect_y")


def fig_coord_translate():
    fig, ax = _new_fig()
    ax.axhline(0, color="#999", lw=0.8)
    ax.axvline(0, color="#999", lw=0.8)
    _point(ax, (3, -2), "P(3,−2)", (0.05, -0.25))
    _point(ax, (7, -1), "P′(7,−1)", (0.05, 0.1))
    arr = FancyArrowPatch((3.1, -2), (6.9, -1.05), arrowstyle="->", mutation_scale=12, color="#C00000")
    ax.add_patch(arr)
    ax.text(5, -2.45, "右4 上1", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "coord_translate")


def fig_model_pencil_card():
    """模型速查卡片用。"""
    return fig_pencil_model()


def fig_model_m_card():
    return fig_m_shape()


# ── 八年级几何 ──────────────────────────────────────────────

def fig_triangle_angles():
    fig, ax = _new_fig()
    tri = [(1, 0.5), (5, 0.5), (3.5, 3.2)]
    for i in range(3):
        _line(ax, tri[i], tri[(i + 1) % 3], color="k", lw=1.5)
    for p, lb in zip(tri, ["A", "B", "C"]):
        _point(ax, p, lb)
    ax.text(1.2, 0.25, "50°", fontsize=10, color="#C00000")
    ax.text(4.5, 0.25, "60°", fontsize=10, color="#C00000")
    _point(ax, (5.6, 0.5), "D", (-0.05, -0.25))
    _line(ax, tri[1], (5.6, 0.5), linestyle="--", color="#666", lw=1)
    ax.text(3, -0.15, "求∠C 及外角∠ACD", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "triangle_angles")


def fig_isosceles_triangle():
    fig, ax = _new_fig()
    a, b, c = (1.5, 0.5), (4.5, 0.5), (3, 3)
    for p1, p2 in [(a, b), (b, c), (c, a)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    for p, lb in [(a, "A"), (b, "B"), (c, "C")]:
        _point(ax, p, lb)
    ax.text(2.7, 2.55, "40°", fontsize=10, color="#C00000")
    ax.text(2.2, 0.25, "AB = AC", fontsize=10, color="#0066CC")
    ax.text(3, -0.15, "求∠B", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "isosceles_triangle")


def fig_congruent_ad():
    fig, ax = _new_fig()
    a, b, c, d = (1, 1), (3.5, 0.5), (2.5, 2.8), (4.5, 2.5)
    for p1, p2 in [(a, b), (b, c), (c, a), (a, d), (d, c)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    for p, lb in [(a, "A"), (b, "B"), (c, "C"), (d, "D")]:
        _point(ax, p, lb)
    ax.text(2.8, 1.2, "AB=AD", fontsize=9, color="#0066CC")
    ax.text(2.2, 2.3, "AC公共", fontsize=9, color="#0066CC")
    ax.text(2.5, -0.15, "证 △ABC ≌ △ADC", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "congruent_ad")


def fig_angle_bisector_dist():
    fig, ax = _new_fig()
    o = (0.8, 0.8)
    _line(ax, o, (5.5, 3), color="k", lw=1.5)
    _line(ax, o, (5.5, -0.5), color="k", lw=1.5)
    _line(ax, o, (4.5, 2.5), linestyle="--", color="#0066CC")
    p = (3.5, 2.2)
    _line(ax, p, (3.5, 0.8), color="#C00000", lw=1)
    _line(ax, p, (4.8, 1.5), color="#C00000", lw=1)
    ax.plot([3.5, 3.5], [0.8, 2.2], linestyle="--", color="k", lw=0.8)
    _point(ax, o, "O")
    _point(ax, p, "P", (0, 0.12))
    ax.text(3.15, 1.4, "PA=2", fontsize=10, color="#C00000")
    ax.text(2.5, 0.2, "P在∠MON平分线上", fontsize=9, color="#0066CC")
    ax.text(3, -0.2, "求 PB", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "angle_bisector_dist")


def fig_hand_in_hand():
    fig, ax = _new_fig()
    a = (3, 2.5)
    b, d = (1, 0.5), (5, 0.5)
    c, e = (1.8, 3.5), (4.2, 3.5)
    for p1, p2 in [(a, b), (a, c), (a, d), (a, e), (b, d), (c, e)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    for p, lb in [(a, "A"), (b, "B"), (c, "C"), (d, "D"), (e, "E")]:
        _point(ax, p, lb)
    ax.text(2.5, 1.5, "AB=AD", fontsize=9, color="#0066CC")
    ax.text(2.5, 3.1, "AC=AE", fontsize=9, color="#0066CC")
    ax.text(3, -0.15, "证 BD = CE", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "hand_in_hand")


def fig_river_horse():
    fig, ax = _new_fig()
    _line(ax, (0, 1), (6, 1), color="#0066CC", lw=2)
    ax.text(6.1, 1, "l", fontsize=11, color="#0066CC")
    _point(ax, (1.5, 2.5), "A")
    _point(ax, (4.5, 2.8), "B")
    _point(ax, (4.5, -0.5), "B′", (0.05, -0.2))
    _line(ax, (4.5, 2.8), (4.5, -0.5), linestyle="--", color="#999")
    _line(ax, (1.5, 2.5), (4.5, -0.5), linestyle="--", color="#C00000", lw=1)
    ax.text(3, 1.2, "河", ha="center", fontsize=10, color="#0066CC")
    ax.text(3, 3.15, "A、B在 l 同侧，求 PA+PB 最小", ha="center", fontsize=9, color="#C00000")
    return _save(fig, "river_horse")


def fig_right_triangle_345():
    fig, ax = _new_fig()
    a, b, c = (1, 0.5), (1, 2.9), (4.2, 0.5)
    for p1, p2 in [(a, b), (b, c), (c, a)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    ax.plot([1, 1.35], [0.5, 0.5], color="k", lw=1)
    ax.plot([1, 1], [0.5, 0.85], color="k", lw=1)
    for p, lb in [(a, "C"), (b, "A"), (c, "B")]:
        _point(ax, p, lb)
    ax.text(0.55, 1.7, "3", fontsize=10)
    ax.text(2.5, 0.25, "4", fontsize=10)
    ax.text(2.5, 1.8, "求 AB", fontsize=10, color="#C00000")
    ax.text(2.5, -0.15, "∠C = 90°", ha="center", fontsize=10, color="#0066CC")
    return _save(fig, "right_triangle_345")


def fig_parallelogram():
    fig, ax = _new_fig()
    a, b, c, d = (1, 0.5), (4.5, 0.5), (5.5, 2.5), (2, 2.5)
    for p1, p2 in [(a, b), (b, c), (c, d), (d, a)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    for p, lb in [(a, "A"), (b, "B"), (c, "C"), (d, "D")]:
        _point(ax, p, lb)
    ax.text(0.65, 0.35, "60°", fontsize=10, color="#C00000")
    ax.text(3, -0.15, "平行四边形ABCD，求∠B、∠C", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "parallelogram")


def fig_isosceles_right():
    fig, ax = _new_fig()
    a, b, c = (1, 0.5), (3.5, 0.5), (1, 3)
    for p1, p2 in [(a, b), (b, c), (c, a)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    ax.plot([1, 1.35], [0.5, 0.5], color="k", lw=1)
    ax.plot([1, 1], [0.5, 0.85], color="k", lw=1)
    for p, lb in [(a, "A"), (b, "B"), (c, "C")]:
        _point(ax, p, lb)
    ax.text(2, 0.25, "2", fontsize=10)
    ax.text(0.55, 1.7, "2", fontsize=10)
    ax.text(2.2, 1.5, "求 AB", fontsize=10, color="#C00000")
    return _save(fig, "isosceles_right")


def fig_fold_rectangle():
    fig, ax = _new_fig()
    a, b, c, d = (1, 0.5), (5, 0.5), (5, 3), (1, 3)
    for p1, p2 in [(a, b), (b, c), (c, d), (d, a)]:
        _line(ax, p1, p2, color="k", lw=1.5)
    e = (4.2, 3)
    _line(ax, a, e, linestyle="--", color="#C00000", lw=1.2)
    bp = (4.2, 0.5)
    _line(ax, bp, e, color="#0066CC", lw=1)
    for p, lb in [(a, "A"), (b, "B"), (c, "C"), (d, "D"), (e, "E")]:
        _point(ax, p, lb)
    _point(ax, bp, "B′", (0.05, -0.25))
    ax.text(2.5, 3.35, "沿 AE 折叠", ha="center", fontsize=10, color="#C00000")
    ax.text(3, -0.15, "证 △ABE ≌ △AB′E", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "fold_rectangle")


# ── 应用题示意图 ──────────────────────────────────────────────

def fig_rectangle_perimeter():
    fig, ax = _new_fig()
    rect = plt.Rectangle((1.5, 0.8), 3.5, 2, fill=False, lw=1.5)
    ax.add_patch(rect)
    ax.text(3.25, 0.45, "长 = 宽 + 3", ha="center", fontsize=10)
    ax.text(3.25, 3.05, "周长 = 26 cm", ha="center", fontsize=10, color="#C00000")
    ax.text(5.2, 1.8, "宽", fontsize=10)
    ax.text(3.1, 2.95, "长", fontsize=10)
    return _save(fig, "rectangle_perimeter")


def fig_ladder_wall():
    fig, ax = _new_fig()
    ax.plot([1, 1], [0, 3.5], color="k", lw=3)
    ax.text(0.6, 1.8, "墙", fontsize=10)
    ax.plot([1, 4.5], [0, 0], color="k", lw=1.5)
    _line(ax, (1, 0), (4, 3), color="#C00000", lw=2)
    ax.text(2.2, 1.8, "5 m", fontsize=10, color="#C00000", rotation=52)
    ax.text(2.5, -0.25, "底端离墙 3 m", ha="center", fontsize=10)
    ax.text(0.55, 3, "?", fontsize=11, color="#C00000")
    ax.text(2.5, 3.25, "求梯顶高度", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "ladder_wall")


def fig_train_tunnel():
    fig, ax = _new_fig()
    ax.plot([0.5, 5.5], [0.3, 0.3], color="k", lw=3)
    ax.plot([1, 4], [0.3, 2.5], color="k", lw=3)
    ax.plot([4, 5.5], [2.5, 2.5], color="k", lw=3)
    rect = plt.Rectangle((0.8, 0.8), 0.9, 0.45, fill=True, facecolor="#666", edgecolor="k")
    ax.add_patch(rect)
    ax.text(3, 2.75, "隧道 450 m / 750 m", ha="center", fontsize=10)
    ax.text(1.25, 0.55, "火车", ha="center", fontsize=9)
    ax.text(3, 0.55, "通过 = 隧道长 + 车长", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "train_tunnel")


def fig_meeting_problem():
    fig, ax = _new_fig()
    ax.plot([0.5, 5.5], [1, 1], color="k", lw=1)
    ax.annotate("", xy=(5.3, 1), xytext=(0.7, 1),
                arrowprops=dict(arrowstyle="<->", color="#666"))
    ax.text(3, 0.65, "120 km", ha="center", fontsize=10)
    ax.annotate("", xy=(1.2, 1.35), xytext=(0.8, 1.35),
                arrowprops=dict(arrowstyle="->", color="#0066CC"))
    ax.annotate("", xy=(4.8, 1.35), xytext=(5.2, 1.35),
                arrowprops=dict(arrowstyle="->", color="#C00000"))
    ax.text(0.9, 1.55, "30", fontsize=9, color="#0066CC")
    ax.text(4.9, 1.55, "50", fontsize=9, color="#C00000")
    ax.text(3, 1.85, "相向而行", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "meeting_problem")


def fig_chase_problem():
    fig, ax = _new_fig()
    ax.plot([0.5, 5.5], [1, 1], color="k", lw=1)
    ax.annotate("", xy=(4.8, 1.35), xytext=(5.2, 1.35),
                arrowprops=dict(arrowstyle="->", color="#C00000"))
    ax.annotate("", xy=(2.5, 1.35), xytext=(2.9, 1.35),
                arrowprops=dict(arrowstyle="->", color="#0066CC"))
    ax.text(4.9, 1.55, "10 m/s", fontsize=9, color="#C00000")
    ax.text(2.6, 1.55, "5 m/s", fontsize=9, color="#0066CC")
    ax.annotate("", xy=(2.9, 0.65), xytext=(5.2, 0.65),
                arrowprops=dict(arrowstyle="<->", color="#666"))
    ax.text(4, 0.35, "相距 60 m", ha="center", fontsize=10)
    ax.text(3, 1.85, "同向追及", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "chase_problem")


# ── 注册表 ────────────────────────────────────────────────────

FIGURE_FUNCS = {
    "parallel_corresponding": fig_parallel_corresponding,
    "pencil_model": fig_pencil_model,
    "m_shape": fig_m_shape,
    "angle_bisector": fig_angle_bisector,
    "segment_midpoint": fig_segment_midpoint,
    "coord_reflect_y": fig_coord_reflect_y,
    "coord_translate": fig_coord_translate,
    "model_pencil_card": fig_model_pencil_card,
    "model_m_card": fig_model_m_card,
    "triangle_angles": fig_triangle_angles,
    "isosceles_triangle": fig_isosceles_triangle,
    "congruent_ad": fig_congruent_ad,
    "angle_bisector_dist": fig_angle_bisector_dist,
    "hand_in_hand": fig_hand_in_hand,
    "river_horse": fig_river_horse,
    "right_triangle_345": fig_right_triangle_345,
    "parallelogram": fig_parallelogram,
    "isosceles_right": fig_isosceles_right,
    "fold_rectangle": fig_fold_rectangle,
    "rectangle_perimeter": fig_rectangle_perimeter,
    "ladder_wall": fig_ladder_wall,
    "train_tunnel": fig_train_tunnel,
    "meeting_problem": fig_meeting_problem,
    "chase_problem": fig_chase_problem,
}

_cache: dict[str, str] = {}


def ensure_figure(fig_id: str) -> str | None:
    """生成或返回缓存的 PNG 路径；fig_id 为空则返回 None。"""
    if not fig_id:
        return None
    key = f"{fig_id}:{_ACTIVE_DIR}"
    if key in _cache and os.path.isfile(_cache[key]):
        return _cache[key]
    fn = FIGURE_FUNCS.get(fig_id)
    if not fn:
        return None
    path = fn()
    _cache[key] = path
    return path


def ensure_all_figures(out_dir: Path | None = None) -> dict[str, str]:
    if out_dir:
        set_figure_dir(out_dir)
    else:
        set_figure_dir(FIGURE_DIR)
    _ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    return {fid: ensure_figure(fid) for fid in FIGURE_FUNCS}


def clear_cache():
    _cache.clear()
