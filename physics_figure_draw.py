# -*- coding: utf-8 -*-
"""初中物理配图生成（运动图像、频闪照片、透镜应用等）。"""

from __future__ import annotations

import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

plt.rcParams["font.sans-serif"] = ["PingFang SC", "Heiti SC", "STHeiti", "Arial Unicode MS", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

FIGURE_DIR = Path(__file__).resolve().parent / "physics_figures"
_ACTIVE_DIR = FIGURE_DIR
DPI = 150
FIG_W = 4.8
FIG_H = 3.2


def set_figure_dir(path: Path | str) -> None:
    global _ACTIVE_DIR
    _ACTIVE_DIR = Path(path)


def _save(fig, fig_id: str) -> str:
    _ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = _ACTIVE_DIR / f"{fig_id}.png"
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white", pad_inches=0.15)
    plt.close(fig)
    return str(path)


def _axis_graph(title, xlabel, ylabel):
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)
    ax.set_title(title, fontsize=11, color="#003366")
    ax.grid(True, linestyle=":", alpha=0.6)
    return fig, ax


# ── s-t / v-t 图像 ───────────────────────────────────────────

def fig_st_uniform():
    fig, ax = _axis_graph("甲物体 s-t 图像", "t / s", "s / m")
    t = np.linspace(0, 5, 50)
    ax.plot(t, 2 * t, "b-", lw=2, label="甲：过原点直线")
    ax.legend(fontsize=9)
    ax.text(3, 4, "斜率 k = v", fontsize=9, color="#C00000")
    return _save(fig, "st_uniform")


def fig_st_variable():
    fig, ax = _axis_graph("乙物体 s-t 图像", "t / s", "s / m")
    t = np.linspace(0, 4, 50)
    ax.plot(t, 0.5 * t ** 2, color="#C00000", lw=2, label="乙：曲线向上弯")
    ax.legend(fontsize=9)
    ax.text(2.2, 2.5, "变速运动\n路程增加越来越快", fontsize=9, color="#C00000")
    return _save(fig, "st_variable")


def fig_st_compare():
    fig, ax = _axis_graph("甲、乙 s-t 图像对比", "t / s", "s / m")
    t = np.linspace(0, 5, 50)
    ax.plot(t, 2 * t, "b-", lw=2, label="甲（斜率大）")
    ax.plot(t, t, color="#C00000", lw=2, label="乙（斜率小）")
    ax.legend(fontsize=9)
    ax.text(4, 8.5, "甲更快", fontsize=9, color="#0066CC")
    return _save(fig, "st_compare")


def fig_vt_uniform():
    fig, ax = _axis_graph("匀速运动 v-t 图像", "t / s", "v / (m/s)")
    ax.plot([0, 5], [3, 3], "b-", lw=2)
    ax.axhline(0, color="k", lw=0.5)
    ax.text(2.5, 3.3, "水平线：v 不变", fontsize=9, color="#0066CC")
    ax.text(2.5, 1.2, "面积 = 路程 s", fontsize=9, color="#C00000")
    return _save(fig, "vt_uniform")


def fig_vt_accel():
    fig, ax = _axis_graph("匀加速运动 v-t 图像（拓展）", "t / s", "v / (m/s)")
    t = np.linspace(0, 4, 50)
    ax.plot(t, 2 * t, color="#C00000", lw=2)
    ax.fill_between(t, 0, 2 * t, alpha=0.15, color="#C00000")
    ax.text(2, 3.5, "倾斜直线：v 增大", fontsize=9, color="#C00000")
    ax.text(2, 0.8, "面积 = s", fontsize=9, color="#0066CC")
    return _save(fig, "vt_accel")


def fig_st_rest():
    fig, ax = _axis_graph("丙物体 s-t 图像", "t / s", "s / m")
    ax.plot([0, 5], [2, 2], "g-", lw=2)
    ax.text(2.5, 2.35, "水平线：静止", fontsize=10, color="#006600")
    return _save(fig, "st_rest")


# ── 小球频闪 / 下落 ───────────────────────────────────────────

def fig_ball_strobe_fall():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(-0.5, 3)
    ax.set_ylim(-0.5, 5.5)
    ax.axis("off")
    ax.text(1.5, 5.2, "频闪照片：相邻两次闪光时间间隔相同", ha="center", fontsize=10, color="#003366")
    # 下落位置：间距 1:3:5 比例示意
    ys = [5, 4, 2.5, 0.5]
    labels = ["t=0", "t1", "t2", "t3"]
    for i, (y, lb) in enumerate(zip(ys, labels)):
        ax.plot(1.5, y, "o", ms=14, color="#C00000")
        ax.text(2.0, y, lb, fontsize=9)
        if i < len(ys) - 1:
            ax.annotate("", xy=(1.5, ys[i + 1] + 0.15), xytext=(1.5, y - 0.15),
                        arrowprops=dict(arrowstyle="->", color="#666"))
    ax.text(0.3, 2.8, "间距越来越大\n→ 变速（加速）", fontsize=9, color="#C00000")
    ax.text(1.5, -0.25, "小球自由下落（忽略空气阻力）", ha="center", fontsize=9)
    return _save(fig, "ball_strobe_fall")


def fig_ball_strobe_uniform_wrong():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(-0.5, 3)
    ax.set_ylim(-0.5, 5.5)
    ax.axis("off")
    ax.text(1.5, 5.2, "频闪照片：间距相等", ha="center", fontsize=10, color="#003366")
    ys = [5, 4, 3, 2, 1]
    for y in ys:
        ax.plot(1.5, y, "o", ms=12, color="#0066CC")
    ax.text(0.2, 2.8, "间距相等\n→ 匀速", fontsize=9, color="#0066CC")
    return _save(fig, "ball_strobe_uniform")


def fig_ball_fall_distances():
    """经典 1:3:5:7 奇数比。"""
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 8)
    ax.set_ylim(0, 6)
    ax.axis("off")
    ax.text(4, 5.5, "相等时间间隔内下落距离之比（初速为0的加速）", ha="center", fontsize=10, color="#003366")
    segs = [("1份", 1), ("3份", 3), ("5份", 5), ("7份", 7)]
    x = 1
    for label, h in segs:
        rect = plt.Rectangle((x, 0.5), 1.2, h * 0.35, fill=True, facecolor="#FFE0E0", edgecolor="#C00000")
        ax.add_patch(rect)
        ax.text(x + 0.6, 0.5 + h * 0.35 / 2, label, ha="center", va="center", fontsize=9)
        x += 1.5
    ax.text(4, 0.1, "1 : 3 : 5 : 7 …（连续奇数比）", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "ball_fall_distances")


# ── 汽车运动 ─────────────────────────────────────────────────

def fig_car_bridge():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3)
    ax.axis("off")
    ax.plot([1, 9], [0.5, 0.5], "k-", lw=2)
    ax.plot([2, 8], [0.5, 1.5], "k-", lw=2)
    ax.plot([2, 2], [0.5, 1.5], "k-", lw=2)
    ax.plot([8, 8], [0.5, 1.5], "k-", lw=2)
    rect = plt.Rectangle((3.5, 0.65), 2, 0.5, fill=True, facecolor="#666", edgecolor="k")
    ax.add_patch(rect)
    ax.annotate("", xy=(9.2, 0.9), xytext=(3.3, 0.9), arrowprops=dict(arrowstyle="<->", color="#C00000"))
    ax.text(6.2, 1.15, "s = 桥长 + 车长", fontsize=9, color="#C00000")
    ax.text(5, 0.35, "桥", ha="center", fontsize=10)
    ax.text(4.5, 0.5, "车", fontsize=8, color="white")
    ax.text(5, 2.5, "「完全通过」= 车头进→车尾出", ha="center", fontsize=9, color="#003366")
    return _save(fig, "car_bridge")


def fig_car_meeting():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 2.5)
    ax.axis("off")
    ax.plot([0.5, 9.5], [1, 1], "k--", lw=0.8)
    ax.annotate("", xy=(8.5, 1.4), xytext=(1.5, 1.4), arrowprops=dict(arrowstyle="->", color="#0066CC"))
    ax.annotate("", xy=(1.5, 0.6), xytext=(8.5, 0.6), arrowprops=dict(arrowstyle="->", color="#C00000"))
    ax.text(1.2, 1.55, "v1", fontsize=10, color="#0066CC")
    ax.text(8.2, 0.35, "v2", fontsize=10, color="#C00000")
    ax.annotate("", xy=(8.5, 0.15), xytext=(1.5, 0.15), arrowprops=dict(arrowstyle="<->", color="#666"))
    ax.text(5, 0.0, "相距 s", ha="center", fontsize=10)
    ax.text(5, 2.1, "相向而行：s = (v1+v2)t", ha="center", fontsize=10, color="#003366")
    return _save(fig, "car_meeting")


def fig_car_chase():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 2.5)
    ax.axis("off")
    ax.annotate("", xy=(8, 1.3), xytext=(3, 1.3), arrowprops=dict(arrowstyle="->", color="#C00000"))
    ax.annotate("", xy=(6.5, 0.7), xytext=(2, 0.7), arrowprops=dict(arrowstyle="->", color="#0066CC"))
    ax.text(7.5, 1.5, "快 v大", fontsize=9, color="#C00000")
    ax.text(5.5, 0.45, "慢 v小", fontsize=9, color="#0066CC")
    ax.annotate("", xy=(6.5, 0.1), xytext=(2, 0.1), arrowprops=dict(arrowstyle="<->", color="#666"))
    ax.text(4.2, -0.05, "初始相距 s0", ha="center", fontsize=9)
    ax.text(5, 2.1, "同向追及：s = (v快-v慢)t", ha="center", fontsize=10, color="#003366")
    return _save(fig, "car_chase")


def fig_car_multisegment():
    fig, ax = _axis_graph("汽车多段行程 s-t 示意", "t / h", "s / km")
    ax.plot([0, 1, 3, 4], [0, 40, 40, 100], "b-o", lw=2)
    ax.text(0.5, 25, "加速/匀速\n40 km", fontsize=8)
    ax.text(2, 43, "休息\n斜率=0", fontsize=8, color="#006600")
    ax.text(3.5, 75, "再行驶\n60 km", fontsize=8)
    ax.text(2, 5, "求全程平均速度：s总/t总", fontsize=9, color="#C00000")
    return _save(fig, "car_multisegment")


def fig_car_roundtrip():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3)
    ax.axis("off")
    ax.plot([1, 9], [1.5, 1.5], "k-", lw=2)
    ax.plot(1, 1.5, "ko", ms=8)
    ax.plot(9, 1.5, "ko", ms=8)
    ax.text(0.5, 1.5, "A", fontsize=11)
    ax.text(9.1, 1.5, "B", fontsize=11)
    ax.annotate("", xy=(9, 2), xytext=(1, 2), arrowprops=dict(arrowstyle="->", color="#0066CC"))
    ax.annotate("", xy=(1, 1), xytext=(9, 1), arrowprops=dict(arrowstyle="->", color="#C00000"))
    ax.text(5, 2.2, "去：v1=60 km/h", ha="center", fontsize=9, color="#0066CC")
    ax.text(5, 0.65, "回：v2=40 km/h", ha="center", fontsize=9, color="#C00000")
    ax.text(5, 0.1, "平均速度 = 总路程 / 总时间（不是速度平均）", ha="center", fontsize=9, color="#C00000")
    return _save(fig, "car_roundtrip")


# ── 透镜：相机 / 投影仪 / 放大镜 ─────────────────────────────

def fig_lens_camera():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(-1, 10)
    ax.set_ylim(-2.5, 2.5)
    ax.axis("off")
    ax.axhline(0, color="#999", lw=0.5)
    ax.plot(5, -2, 5, 2, "k-", lw=2)
    ax.plot(4.85, -0.3, 5.15, 0.3, "k-", lw=3)
    ax.plot(4.85, 0.3, 5.15, -0.3, "k-", lw=3)
    ax.text(5.2, 2.1, "凸透镜", fontsize=9)
    ax.text(5.2, -2.1, "f", fontsize=9)
    # 物（远）
    ax.plot([1, 1], [-0.8, 0.8], "b-", lw=2)
    ax.text(0.6, 0, "物", fontsize=9, color="#0066CC")
    ax.text(1, -1.2, "u > 2f", fontsize=9, color="#0066CC")
    # 像（小、倒、实）
    ax.plot([7.5, 7.5], [-0.35, 0.35], color="#C00000", lw=2)
    ax.text(7.7, 0, "像", fontsize=9, color="#C00000")
    ax.text(7.5, -1.2, "倒立缩小实像", fontsize=9, color="#C00000")
    ax.text(4, 2.2, "照相机原理", ha="center", fontsize=11, color="#003366", weight="bold")
    for x in [2.5, 7.5]:
        ax.plot(x, 0, "k|", ms=8, mew=1)
    ax.text(2.5, -0.35, "2f", fontsize=8, ha="center")
    return _save(fig, "lens_camera")


def fig_lens_projector():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(-1, 10)
    ax.set_ylim(-2.5, 2.5)
    ax.axis("off")
    ax.axhline(0, color="#999", lw=0.5)
    ax.plot(5, -2, 5, 2, "k-", lw=2)
    ax.plot([1.8, 1.8], [-1.2, 1.2], "b-", lw=2)
    ax.text(1.4, 0, "幻灯片", fontsize=8, color="#0066CC")
    ax.text(1.8, -1.6, "f<u<2f", fontsize=9, color="#0066CC")
    ax.plot([8, 8], [-1.8, 1.8], color="#C00000", lw=2)
    ax.text(8.2, 0, "屏上像", fontsize=8, color="#C00000")
    ax.text(4, 2.2, "投影仪 / 幻灯机", ha="center", fontsize=11, color="#003366", weight="bold")
    ax.text(4, -2.2, "倒立放大实像", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "lens_projector")


def fig_lens_magnifier():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(-1, 8)
    ax.set_ylim(-2, 2.5)
    ax.axis("off")
    ax.plot(4, -1.8, 4, 1.8, "k-", lw=2)
    ax.plot([2.5, 2.5], [-0.6, 0.6], "b-", lw=2)
    ax.text(2.2, 0, "物", fontsize=9, color="#0066CC")
    ax.text(2.5, -1.2, "u < f", fontsize=9, color="#0066CC")
    ax.plot([2.5, 2.5], [1.0, 1.8], color="#C00000", lw=2, linestyle="--")
    ax.text(2.2, 1.4, "虚像", fontsize=9, color="#C00000")
    ax.text(4, 2.1, "放大镜原理", ha="center", fontsize=11, color="#003366", weight="bold")
    ax.text(4, -1.7, "正立放大虚像", ha="center", fontsize=10, color="#C00000")
    return _save(fig, "lens_magnifier")


def fig_lens_three_apps():
    fig, ax = plt.subplots(figsize=(5.5, 3.5))
    ax.axis("off")
    ax.text(2.75, 3.2, "凸透镜三种应用（必背）", ha="center", fontsize=12, color="#003366", weight="bold")
    rows = [
        ("照相机", "u > 2f", "倒立缩小实像"),
        ("投影仪", "f < u < 2f", "倒立放大实像"),
        ("放大镜", "u < f", "正立放大虚像"),
    ]
    for i, (name, u, img) in enumerate(rows):
        y = 2.2 - i * 0.85
        ax.text(0.3, y, name, fontsize=10, weight="bold", color="#0066CC")
        ax.text(1.8, y, u, fontsize=9)
        ax.text(3.5, y, img, fontsize=9, color="#C00000")
    return _save(fig, "lens_three_apps")


def fig_reference_frame():
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3)
    ax.axis("off")
    rect = plt.Rectangle((2, 0.8), 5, 1.2, fill=True, facecolor="#E8E8E8", edgecolor="k", lw=1.5)
    ax.add_patch(rect)
    ax.text(4.5, 1.4, "火车", ha="center", fontsize=11)
    ax.plot(3.5, 1.4, "ro", ms=8)
    ax.text(3.2, 1.7, "乘客", fontsize=9, color="#C00000")
    ax.annotate("", xy=(8.5, 1.4), xytext=(2, 1.4), arrowprops=dict(arrowstyle="->", color="#0066CC", lw=2))
    ax.text(5, 2.5, "相对地面：运动", ha="center", fontsize=9, color="#0066CC")
    ax.text(5, 0.3, "相对火车：静止（参照物选火车）", ha="center", fontsize=9, color="#C00000")
    return _save(fig, "reference_frame")


FIGURE_FUNCS = {
    "st_uniform": fig_st_uniform,
    "st_variable": fig_st_variable,
    "st_compare": fig_st_compare,
    "st_rest": fig_st_rest,
    "vt_uniform": fig_vt_uniform,
    "vt_accel": fig_vt_accel,
    "ball_strobe_fall": fig_ball_strobe_fall,
    "ball_strobe_uniform": fig_ball_strobe_uniform_wrong,
    "ball_fall_distances": fig_ball_fall_distances,
    "car_bridge": fig_car_bridge,
    "car_meeting": fig_car_meeting,
    "car_chase": fig_car_chase,
    "car_multisegment": fig_car_multisegment,
    "car_roundtrip": fig_car_roundtrip,
    "lens_camera": fig_lens_camera,
    "lens_projector": fig_lens_projector,
    "lens_magnifier": fig_lens_magnifier,
    "lens_three_apps": fig_lens_three_apps,
    "reference_frame": fig_reference_frame,
}

_cache: dict[str, str] = {}


def ensure_figure(fig_id: str) -> str | None:
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
