# -*- coding: utf-8 -*-
"""英语中考总览、复习计划、题型说明"""

from english_doc_helpers import *


def build_exam_overview(doc):
    add_book_title(doc, "中考英语考什么？+ 怎么复习")

    add_chapter_title(doc, "一、题型结构（参考多数地区）")
    add_table(doc, ["题型", "分值约", "考查重点"], [
        ["听力", "30分", "对话、短文、信息匹配；提前读题圈关键词"],
        ["单项选择", "15～20分", "语法、词汇、情景交际"],
        ["完形填空", "10～15分", "上下文逻辑、固定搭配、词义辨析"],
        ["阅读理解", "30～40分", "细节、推理、主旨、词义猜测"],
        ["任务型阅读/补全", "10～15分", "信息转换、补全句子/对话"],
        ["词汇运用/选词填空", "10分", "词形变化、时态、固定搭配"],
        ["书面表达", "15～20分", "书信、邮件、图表、话题作文"],
    ], [2.5, 2, 8])

    add_chapter_title(doc, "二、复习优先级 ★")
    add_table(doc, ["优先级", "内容", "原因"], [
        ["★★★★★", "时态（尤其现在完成时）", "单选、填空、写作 everywhere"],
        ["★★★★★", "高频短语与固定搭配", "完形、单选、写作"],
        ["★★★★★", "书面表达模板", "稳拿基础分+亮点句"],
        ["★★★★", "被动语态、宾语从句、定语从句", "九年级语法重点"],
        ["★★★★", "词性转换（名词/动词/形容词/副词）", "词汇题必考"],
        ["★★★", "七～八年级基础语法", "查漏补缺"],
    ], [2.5, 4.5, 6])

    add_chapter_title(doc, "三、每日学习建议（30～40分钟）")
    add_plain(doc, "① **10分钟** 背短语/10个单词  ② **15分钟** 语法专题+5道单选  ③ **10分钟** 默写1篇作文模板句")
    add_plain(doc, "周末：1篇完形或阅读精读 + 1篇书面表达仿写")


def build_tense_cheat_sheet(doc):
    add_book_title(doc, "附录一：时态速查表 ★必背")

    add_table(doc, ["时态", "结构", "时间标志词", "例句"], [
        ["一般现在时", "主 + do/does", "always, usually, every day", "He **goes** to school by bus."],
        ["一般过去时", "主 + did", "yesterday, last week, ago", "I **visited** Beijing last year."],
        ["一般将来时", "will do / be going to do", "tomorrow, next week", "We **will have** a test."],
        ["现在进行时", "am/is/are + doing", "now, look, listen", "She **is reading** now."],
        ["过去进行时", "was/were + doing", "at 8 o'clock yesterday", "I **was doing** homework at 8."],
        ["现在完成时", "have/has + done", "already, yet, since, for", "I **have lived** here for 5 years."],
        ["被动语态", "be + done", "by sb. / 不必提执行者", "English **is spoken** widely."],
    ], [2.5, 3, 3, 5])

    add_chapter_title(doc, "现在完成时 vs 一般过去时 ★")
    add_concept_block(doc, [
        "**一般过去时**：动作发生在**过去某一具体时间**，与现在无关。",
        "　例：I **saw** the film **yesterday**.（昨天看的，不说现在怎样）",
        "**现在完成时**：过去动作与**现在有联系**（结果、经历、持续）。",
        "　例：I **have seen** the film.（已经看过了，可能刚看完）",
        "**for + 时间段** / **since + 时间点** → 通常用**现在完成时**。",
        "　for 3 years；since 2020；since he came here",
        "**have been to**（去过已回） vs **have gone to**（去了还没回）。",
    ])
    add_errors(doc, [
        "有 **yesterday / last year** 等具体过去时间 → **不用**现在完成时。",
        "**How long** 问持续多久 → 用现在完成时 + for/since。",
        "瞬间动词（buy, die, join）与 for 连用要改：**have had**（不能 have bought for 3 years）。",
    ])


def build_word_formation(doc):
    add_book_title(doc, "附录二：词性转换规则 ★")

    add_table(doc, ["后缀/规则", "名词→形容词", "形容词→副词", "动词→名词"], [
        ["-ful / -less", "care→careful", "—", "—"],
        ["-ly", "—", "quick→quickly", "—"],
        ["-tion / -ment", "—", "—", "develop→development"],
        ["-er / -or", "—", "—", "teach→teacher"],
        ["un- / dis- / im-", "happy→unhappy", "—", "like→dislike"],
        ["-y / -al / -ous", "sun→sunny", "—", "—"],
    ], [2.5, 3, 3, 3])

    add_vocab_table(doc, ["原形", "词性变化", "中文"], [
        ["success", "succeed (v.) / successful (adj.) / successfully (adv.)", "成功"],
        ["different", "difference (n.) / differently (adv.)", "不同"],
        ["health", "healthy (adj.) / unhealthy", "健康"],
        ["interest", "interested / interesting", "兴趣（人/物）"],
        ["excite", "excited / exciting", "兴奋（人/物）"],
        ["care", "careful / careless / carefully", "小心/粗心"],
        ["pollute", "pollution (n.) / polluted", "污染"],
        ["communicate", "communication (n.)", "交流"],
        ["choose", "choice (n.)", "选择"],
        ["die", "death (n.) / dead (adj.)", "死亡"],
        ["appear", "disappear", "出现/消失"],
        ["comfortable", "comfort (n.) / comfortably", "舒适"],
        ["important", "importance (n.) / importantly", "重要"],
        ["possible", "impossible / possibly", "可能/不可能"],
        ["create", "creative (adj.) / creativity (n.)", "创造"],
    ])


def build_study_plan(doc):
    add_book_title(doc, "附录三：8周总复习计划")
    add_table(doc, ["周次", "语法", "词汇/写作"], [
        ["第1周", "一般现在/过去/将来", "日常活动短语 + 自我介绍模板"],
        ["第2周", "现在/过去进行时", "学校生活词汇 + 邀请信句型"],
        ["第3周", "现在完成时 ★", "for/since 练习 + 经历类作文"],
        ["第4周", "被动语态", "环保/科技话题词汇"],
        ["第5周", "宾语从句 + 定语从句", "宾从三要素 + 定语从句 who/that"],
        ["第6周", "状语从句 + 感叹句", "建议信 + 图表作文"],
        ["第7周", "完形阅读技巧", "高频短语总复习"],
        ["第8周", "模拟卷 + 错题", "默写5篇作文模板"],
    ], [1.5, 5, 6.5])
