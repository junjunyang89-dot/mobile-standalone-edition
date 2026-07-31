# -*- coding: utf-8 -*-
"""书面表达模板 + 阅读完形技巧"""

from english_doc_helpers import *


def build_writing_templates(doc):
    add_book_title(doc, "书面表达万能模板 ★必背")

    add_writing_template(
        doc, "书信/邮件（建议信）",
        "称呼 + 开头表明目的 + 主体2～3点建议 + 结尾祝愿 + 落款",
        [
            "I'm writing to give you some advice on **…**.",
            "First of all, you'd better **…**",
            "What's more, it's a good idea to **…**",
            "Last but not least, remember to **…**",
            "I hope my advice will be helpful to you.",
            "I'm looking forward to your reply.",
        ],
        "Dear Tom,\n\nI'm glad to hear from you. Here is my advice on how to learn English well.\n\nFirst of all, you'd better read English every day. What's more, it's a good idea to keep a diary in English. Last but not least, remember to listen to English songs.\n\nI hope my advice will be helpful.\n\nYours,\nLi Ming",
    )

    add_writing_template(
        doc, "介绍人物/事物",
        "总述 + 外貌/特点 + 事例/原因 + 总结感受",
        [
            "Let me tell you something about **…**",
            "**…** is one of the most important/interesting **…** in my life.",
            "He/She is not only **…** but also **…**",
            "What impressed me most is that **…**",
            "In a word, I think **…**",
        ],
    )

    add_writing_template(
        doc, "活动计划/邀请",
        "说明活动 + 时间地点 + 内容 + 邀请参加",
        [
            "We are going to **…**",
            "It will be held at/in **…** on **…**",
            "There will be many interesting activities, such as **…**",
            "Would you like to join us? / You're welcome to come.",
            "If you are interested, please **…**",
        ],
    )

    add_writing_template(
        doc, "图表作文（调查/变化）",
        "描述现象 + 分析原因 + 看法/建议",
        [
            "According to the survey/chart, **…**",
            "The number of **…** has increased/decreased from **…** to **…**",
            "There are several reasons for this.",
            "First, **…** Second, **…**",
            "In my opinion, we should **…**",
        ],
    )

    add_writing_template(
        doc, "观点论述（环保/健康/学习）",
        "亮明观点 + 理由2点 + 呼吁/总结",
        [
            "As we all know, **…** is very important.",
            "On one hand, **…** On the other hand, **…**",
            "However, some people **…**",
            "As students, we should **…**",
            "Only in this way can we **…**",
        ],
        "As we all know, protecting the environment is very important. On one hand, a good environment helps us live healthily. On the other hand, it is our duty to keep our city clean.\n\nAs students, we should save water, recycle paper and never litter. Only in this way can we make our world more beautiful.",
    )

    add_chapter_title(doc, "写作提分句型（背 10 句够用）")
    add_phrase_block(doc, "开头/过渡/结尾", [
        "With the development of **…**, more and more people **…**",
        "It is widely believed that **…**",
        "There is no doubt that **…**",
        "From my point of view, **…**",
        "All in all / In a word / In short, **…**",
        "Let's work together to **…**",
    ])

    add_errors(doc, [
        "书信格式：**Dear…,** 开头；**Yours,** + 姓名结尾；段落空行。",
        "第三人称注意**主谓一致**；过去叙事用**一般过去时**。",
        "避免全篇 I think；适当用 **In my opinion / From my point of view** 替换。",
        "字数不够时加**具体例子**，不要重复同一句换说法。",
    ])


def build_reading_cloze_skills(doc):
    add_book_title(doc, "阅读理解 & 完形填空技巧")

    add_chapter_title(doc, "一、阅读理解题型")
    add_table(doc, ["题型", "问法", "方法"], [
        ["细节题", "What/When/Where/How many", "回原文定位关键词，同义替换"],
        ["推理题", "infer, probably, suggest", "依据原文推断，不能过度推理"],
        ["主旨题", "main idea, best title", "首尾段+各段首句；排除太窄/太宽"],
        ["词义猜测", "The word … means", "上下文逻辑、构词法、对比"],
        ["态度观点", "author's attitude", "找形容词、动词感情色彩"],
    ], [2.5, 3.5, 7])

    add_chapter_title(doc, "二、完形填空三步法")
    add_concept_block(doc, [
        "**第一遍**：快速通读，了解大意（名词选义、动词选动作）。",
        "**第二遍**：逐空分析——**语法**（时态、词性）+ **搭配**（固定短语）+ **逻辑**（转折 but、因果 so/because）。",
        "**第三遍**：通读检查，看前后是否一致。",
        "**技巧**：复现原则（上文出现过的词可能再考）；**情感色彩**（积极/消极）；**并列结构** 前后形式一致。",
    ])

    add_chapter_title(doc, "三、补全对话 / 任务型阅读")
    add_concept_block(doc, [
        "**补全对话**：看**上下文**；问句答句配对；**冠词/代词**提示（this/that 指代）。",
        "常见答语：**Sure/Of course/Good idea/I'm sorry to hear that**",
        "**任务型阅读**：找题干关键词回原文；注意**词数限制**；时态人称转换。",
    ])

    add_chapter_title(doc, "四、情景交际（单选常考）")
    add_table(doc, ["情境", "正确应答"], [
        ["感谢 Thanks a lot.", "You're welcome. / My pleasure."],
        ["道歉 I'm sorry.", "That's OK. / Never mind."],
        ["祝愿 Good luck!", "Thank you. / The same to you."],
        ["邀请 Would you like…?", "Yes, I'd love to. / Sorry, I can't."],
        ["问路 Excuse me, how can I…?", "Go straight… / You can take…"],
        ["打电话 May I speak to…?", "This is … speaking. / Hold on, please."],
        ["购物 Can I help you?", "I'm looking for… / I'd like…"],
        ["看病 What's wrong?", "I have a fever/cough."],
    ], [4, 7])


def build_exam_mistakes(doc):
    add_book_title(doc, "易错辨析速查 ★")

    add_chapter_title(doc, "语法易错")
    mistakes = [
        ("He have a book.", "He **has** a book.", "三单 +s"),
        ("I have seen him yesterday.", "I **saw** him yesterday.", "有 yesterday 用过去时"),
        ("How long have you bought it?", "How long have you **had** it?", "瞬间动词改延续"),
        ("Tell me where is he.", "Tell me where **he is**.", "宾从陈述语序"),
        ("Although he is young, but he works hard.", "Although he is young, **/** he works hard.", "although 不与 but 连用"),
        ("There have many people.", "There **are** many people.", "There be 不用 have"),
        ("The book is worth to read.", "The book is worth **reading**.", "be worth doing"),
        ("He is too young to not go.", "He is too young **to go**.", "too…to 本身含否定"),
    ]
    for w, r, reason in mistakes:
        add_mistake_pair(doc, w, r, reason)
        doc.add_paragraph()

    add_chapter_title(doc, "词汇易混")
    add_table(doc, ["词组", "区别"], [
        ["look for / look after / look up", "寻找 / 照顾 / 查阅"],
        ["borrow / lend", "借入 / 借出"],
        ["hear / listen", "听见（结果）/ 听（动作）"],
        ["alone / lonely", "独自（状态）/ 孤独（感受）"],
        ["other / another / the other", "其他 / 再一个 / 两者中另一个"],
        ["reach / arrive / get to", "及物 / arrive in/at / get to"],
        ["job / work / works", "可数职业 / 不可数工作 / 作品"],
        ["sound / noise / voice", "听起来/声音 / 噪音 / 嗓音"],
    ], [4, 7])


def build_exam_all(doc):
    build_writing_templates(doc)
    build_reading_cloze_skills(doc)
    build_exam_mistakes(doc)
