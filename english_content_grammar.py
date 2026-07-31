# -*- coding: utf-8 -*-
"""英语语法专题详解（七～九年级必考）"""

from english_doc_helpers import *


def build_grammar_qi(doc):
    add_book_title(doc, "七年级语法 ★基础")

    add_chapter_title(doc, "一、名词与冠词")
    add_grammar_block(doc, "可数名词复数",
                      "一般 +s；以 s/x/ch/sh 结尾 +es；辅音+y 变 y 为 i +es；f/fe 变 ves",
                      ["box→boxes", "city→cities", "knife→knives", "child→children（不规则）"],
                      ["people 本身是复数", "hair 作整体不可数"])
    add_grammar_block(doc, "冠词 a / an / the",
                      "a/an 表泛指；an 用于元音音素开头；the 表特指",
                      ["an hour, a useful book", "the sun, the first day"],
                      ["u 发 /juː/ 用 a：a university"])

    add_chapter_title(doc, "二、代词")
    add_concept_block(doc, [
        "**人称代词**：主格 I/you/he；宾格 me/him/her",
        "**物主代词**：形容词性 my/your + 名词；名词性 mine/yours 单独用",
        "**反身代词**：enjoy **oneself**；by **oneself** 独自",
        "**不定代词**：some/any；many/much；few/a few；little/a little",
        "　few/little 表「几乎没有」；a few/a little 表「一些」",
    ])
    add_exam_types(doc, ["some/any 用法", "few/little 辨析", "物主代词 + 名词"])

    add_chapter_title(doc, "三、一般现在时 & 现在进行时")
    add_grammar_block(doc, "一般现在时",
                      "主语 + 动词原形（三单 +s/es）",
                      ["He **likes** music.", "They **play** basketball every day."],
                      ["标志词：always, usually, often, sometimes, every day"])
    add_grammar_block(doc, "现在进行时",
                      "am/is/are + doing",
                      ["Look! The children **are playing**.", "She **isn't watching** TV now."],
                      ["look, listen, now, at the moment → 进行时"])

    add_chapter_title(doc, "四、一般过去时")
    add_grammar_block(doc, "规则/不规则动词",
                      "规则：+ed；不规则需背诵（go→went, see→saw, buy→bought）",
                      ["I **visited** my grandparents **last weekend**.", "Did you **go** shopping? — Yes, I **did**."],
                      ["有 yesterday/last…/…ago → 一般过去时，不用完成时"])

    add_chapter_title(doc, "五、情态动词")
    add_concept_block(doc, [
        "**can** 能/会；**could** 过去能/委婉请求 Could you…?",
        "**must** 必须（主观）；**have to** 不得不（客观）；must 否定 **mustn't** 禁止",
        "**should** 应该；**shouldn't** 不应该",
        "**need** 需要；**needn't** 不必（= don't have to）",
        "情态动词后接**动词原形**：can **go**, must **finish**",
    ])
    add_exam_types(doc, ["must/have to 区别", "mustn't/needn't 区别", "情态动词 + 原形"])

    add_chapter_title(doc, "六、There be & 祈使句")
    add_grammar_block(doc, "There be",
                      "There is/are + 名词 + 地点；就近原则",
                      ["There **is** a book and two pens.", "There **aren't** any apples."],
                      ["There be 不与 have 连用表示「有」"])
    add_grammar_block(doc, "祈使句",
                      "动词原形开头；否定 Don't + 原形",
                      ["**Don't be** late.", "**Please sit** down."], None)


def build_grammar_ba(doc):
    add_book_title(doc, "八年级语法")

    add_chapter_title(doc, "一、比较级与最高级")
    add_grammar_block(doc, "形容词/副词比较等级",
                      "比较级：-er / more + adj；最高级：-est / most + adj",
                      ["tall→taller→tallest", "important→more important→most important",
                       "He runs **faster** than me.", "She is **the tallest** in her class."],
                      ["as…as 和…一样；not as/so…as 不如",
                       "比较级 + and + 比较级：better and better",
                       "the + 比较级, the + 比较级：The more, the better"])

    add_chapter_title(doc, "二、一般将来时")
    add_grammar_block(doc, "will / be going to",
                      "will + do（临时决定）；be going to + do（计划/迹象）",
                      ["I **will call** you later.", "It **is going to rain**.", "We **are going to visit** Beijing."],
                      ["there will be = there is/are going to be"])

    add_chapter_title(doc, "三、过去进行时")
    add_grammar_block(doc, "过去进行时",
                      "was/were + doing",
                      ["I **was doing** homework when he called.", "While I **was reading**, she **was cooking**."],
                      ["when 短动作（过去时）；while 长动作（过去进行时）"])

    add_chapter_title(doc, "四、反意疑问句")
    add_concept_block(doc, [
        "前肯后否，前否后肯；**前后主语一致**（用代词）。",
        "He is a student, **isn't he**?",
        "They don't like it, **do they**?",
        "Let's go, **shall we**? / Let us go, **will you**?",
        "I 作主语，反意部分用 **aren't I**（习惯用法）",
    ])


def build_grammar_jiu(doc):
    add_book_title(doc, "九年级语法 ★中考重点")

    add_chapter_title(doc, "一、现在完成时 ★★★")
    add_grammar_block(doc, "现在完成时",
                      "have/has + 过去分词",
                      ["I **have finished** my homework **already**.", "Have you ever **been to** Shanghai?",
                       "She **has lived** here **for** 10 years **since** 2014."],
                      ["already 肯定句；yet 疑问/否定",
                       "have been to 去过；have gone to 去了",
                       "瞬间动词 → 延续：buy→have, borrow→keep, join→be in"])

    add_chapter_title(doc, "二、被动语态 ★★")
    add_grammar_block(doc, "被动语态",
                      "主语 + be (am/is/are/was/were/has been…) + done (+ by sb.)",
                      ["English **is spoken** in many countries.", "The bridge **was built** in 1990.",
                       "A new school **will be built** next year."],
                      ["不及物动词无被动：The accident **happened**.",
                       "双宾语：A book was given to me. / I was given a book."])

    add_chapter_title(doc, "三、宾语从句 ★★")
    add_concept_block(doc, [
        "**三要素**：① **连接词** ② **语序**（陈述语序） ③ **时态**（主过从过；客观真理用一般现在时）",
        "I know **that** he **is** honest.（that 可省略）",
        "Do you know **where** he **lives**?（不能 where does he live）",
        "Can you tell me **if/whether** it **will rain**?",
        "He said (that) he **would go** the next day.（主过从过）",
        "The teacher said the earth **goes** around the sun.（客观真理）",
    ])
    add_errors(doc, [
        "宾从**不能用疑问语序**：where is he ✗ → where he is ✓",
        "if/whether 表「是否」；that 表陈述，可省略",
    ])

    add_chapter_title(doc, "四、定语从句 ★★")
    add_concept_block(doc, [
        "先行词 + **关系代词** (who/whom/which/that) + 从句",
        "**人** → who / that；**物** → which / that",
        "The boy **who/that** is reading is my brother.",
        "This is the book **which/that** I bought yesterday.",
        "先行词含最高级、序数词、all/every/any/no 等 → 常用 **that**",
        "The first thing **that** I should do is…",
    ])

    add_chapter_title(doc, "五、状语从句")
    add_table(doc, ["连接词", "含义", "例句"], [
        ["when / while / as", "当…时", "Call me when you arrive."],
        ["before / after", "在…之前/之后", "Finish homework before you play."],
        ["until / till", "直到…才", "Wait until he comes."],
        ["if / unless", "如果/除非", "If it rains, we'll stay home."],
        ["because / so", "因为/所以", "不能同时用 because 和 so"],
        ["although / though", "虽然", "不能与 but 连用"],
        ["so…that / such…that", "如此…以至于", "He is so tired that he can't walk."],
    ], [2.5, 2.5, 6])

    add_chapter_title(doc, "六、感叹句 & 其他")
    add_concept_block(doc, [
        "**What** + (a/an) + adj. + n. + (主谓)!  What a beautiful day (it is)!",
        "**How** + adj./adv. + (主谓)!  How fast he runs!",
        "**too…to…** 太…而不能：too young to go to school",
        "**enough…to…** 足够…能：old enough to dress himself",
        "**both…and…** 两者都；**either…or…** 要么…要么；**neither…nor…** 既不…也不",
        "**not only…but also…** 不但…而且…",
    ])


def build_grammar_all(doc):
    build_grammar_qi(doc)
    build_grammar_ba(doc)
    build_grammar_jiu(doc)
