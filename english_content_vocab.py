# -*- coding: utf-8
"""高频词汇、短语、句型（必背）"""

from english_doc_helpers import *


def build_core_phrases(doc):
    add_book_title(doc, "高频短语与固定搭配 ★必背")

    add_phrase_block(doc, "动词短语（单选/完形超高频）", [
        "**look after** = take care of 照顾　**look for** 寻找　**look up** 查阅　**look forward to** doing 盼望",
        "**give up** doing 放弃　**give in** 屈服　**give away** 赠送",
        "**put on** 穿上　**put off** 推迟　**put up** 张贴/搭建　**put away** 收好",
        "**take off** 脱下/起飞　**take after** 长得像　**take place** 发生（无被动）",
        "**turn on/off/up/down** 打开/关/调大/调小",
        "**get on/along with** 与…相处　**get up** 起床　**get over** 克服",
        "**keep on** doing 继续做　**keep up with** 跟上",
        "**run out of** 用完　**use up** 用完",
        "**pay for** 付钱买　**spend…on** / **spend…(in) doing** 花费",
        "**be good at** doing　**be interested in** doing　**be afraid of** doing",
        "**be proud of**　**be famous for**　**be ready for** / **be ready to do**",
        "**have fun** doing = enjoy doing　**have trouble (in) doing** 做…有困难",
        "**make friends with**　**make a decision**　**make progress**",
        "**help sb. (to) do** / **help sb. with**",
    ])

    add_phrase_block(doc, "介词短语", [
        "**at the age of** 在…岁　**at the end of** 在…末尾　**at last** = finally",
        "**by the way** 顺便说　**by hand** 手工　**by bus/train**",
        "**in the end** 最终　**in fact** 事实上　**in order to** do 为了",
        "**on time** 准时　**on foot** 步行　**on sale** 廉价出售",
        "**for example** 例如　**for free** 免费",
        "**thanks to** 多亏　**because of** + 名词　**instead of** 代替",
        "**according to** 根据　**compared with** 与…相比",
    ])

    add_phrase_block(doc, "连词与句型", [
        "**not only… but also…** 不但…而且…",
        "**either… or…** 要么…要么…　**neither… nor…** 既不…也不…",
        "**both… and…** 两者都　**between… and…** 在…之间",
        "**too… to…** 太…而不能　**enough… to…** 足够…能",
        "**so… that…** 如此…以至于　**such… that…**",
        "**It takes sb. some time to do** 做某事花费某人时间",
        "**It is + adj. + for sb. + to do** 对某人来说做…是…的",
        "**There is no doubt that…** 毫无疑问…",
        "**The + 比较级, the + 比较级** 越…越…",
    ])


def build_vocab_by_topic(doc):
    add_book_title(doc, "话题词汇速记（写作/阅读）")

    topics = [
        ("学校与学习", [
            ("subject", "科目"), ("exam", "考试"), ("grade", "成绩/年级"),
            ("knowledge", "知识"), ("practice", "练习"), ("progress", "进步"),
            ("fail", "失败"), ("succeed", "成功"), ("attention", "注意"),
        ]),
        ("健康与运动", [
            ("health", "健康"), ("exercise", "锻炼"), ("diet", "饮食"),
            ("stress", "压力"), ("relax", "放松"), ("illness", "疾病"),
            ("medicine", "药"), ("habit", "习惯"), ("balanced", "均衡的"),
        ]),
        ("环保与科技", [
            ("environment", "环境"), ("pollution", "污染"), ("recycle", "回收"),
            ("protect", "保护"), ("energy", "能源"), ("technology", "科技"),
            ("invention", "发明"), ("convenient", "便利的"), ("reduce", "减少"),
        ]),
        ("情感与品质", [
            ("confident", "自信的"), ("patient", "耐心的"), ("honest", "诚实的"),
            ("brave", "勇敢的"), ("helpful", "乐于助人的"), ("polite", "礼貌的"),
            ("respect", "尊重"), ("responsible", "负责的"), ("volunteer", "志愿者"),
        ]),
        ("交通与旅行", [
            ("traffic", "交通"), ("passenger", "乘客"), ("journey", "旅程"),
            ("guide", "导游"), ("scenery", "风景"), ("experience", "经历/体验"),
            ("foreign", "外国的"), ("culture", "文化"), ("tradition", "传统"),
        ]),
    ]
    for title, words in topics:
        add_chapter_title(doc, title)
        add_vocab_table(doc, ["单词", "中文"], words)


def build_irregular_verbs(doc):
    add_book_title(doc, "附录：不规则动词表（必背常用）")
    add_table(doc, ["原形", "过去式", "过去分词", "中文"], [
        ["be", "was/were", "been", "是"],
        ["begin", "began", "begun", "开始"],
        ["break", "broke", "broken", "打破"],
        ["bring", "brought", "brought", "带来"],
        ["buy", "bought", "bought", "买"],
        ["catch", "caught", "caught", "抓住"],
        ["choose", "chose", "chosen", "选择"],
        ["come", "came", "come", "来"],
        ["do", "did", "done", "做"],
        ["draw", "drew", "drawn", "画"],
        ["drink", "drank", "drunk", "喝"],
        ["drive", "drove", "driven", "驾驶"],
        ["eat", "ate", "eaten", "吃"],
        ["fall", "fell", "fallen", "落下"],
        ["feel", "felt", "felt", "感觉"],
        ["find", "found", "found", "找到"],
        ["fly", "flew", "flown", "飞"],
        ["forget", "forgot", "forgotten", "忘记"],
        ["get", "got", "got/gotten", "得到"],
        ["give", "gave", "given", "给"],
        ["go", "went", "gone", "去"],
        ["grow", "grew", "grown", "生长"],
        ["have", "had", "had", "有"],
        ["hear", "heard", "heard", "听见"],
        ["hold", "held", "held", "举行/抓住"],
        ["keep", "kept", "kept", "保持"],
        ["know", "knew", "known", "知道"],
        ["leave", "left", "left", "离开"],
        ["lend", "lent", "lent", "借出"],
        ["let", "let", "let", "让"],
        ["lie", "lay", "lain", "躺"],
        ["lose", "lost", "lost", "丢失"],
        ["make", "made", "made", "制作"],
        ["mean", "meant", "meant", "意思是"],
        ["meet", "met", "met", "遇见"],
        ["pay", "paid", "paid", "付费"],
        ["put", "put", "put", "放"],
        ["read", "read", "read", "读"],
        ["ride", "rode", "ridden", "骑"],
        ["rise", "rose", "risen", "上升"],
        ["run", "ran", "run", "跑"],
        ["say", "said", "said", "说"],
        ["see", "saw", "seen", "看见"],
        ["sell", "sold", "sold", "卖"],
        ["send", "sent", "sent", "发送"],
        ["set", "set", "set", "设置"],
        ["show", "showed", "shown", "展示"],
        ["sing", "sang", "sung", "唱"],
        ["sit", "sat", "sat", "坐"],
        ["sleep", "slept", "slept", "睡"],
        ["speak", "spoke", "spoken", "说"],
        ["spend", "spent", "spent", "花费"],
        ["stand", "stood", "stood", "站"],
        ["steal", "stole", "stolen", "偷"],
        ["sweep", "swept", "swept", "扫"],
        ["swim", "swam", "swum", "游泳"],
        ["take", "took", "taken", "拿/花费"],
        ["teach", "taught", "taught", "教"],
        ["tell", "told", "told", "告诉"],
        ["think", "thought", "thought", "想"],
        ["throw", "threw", "thrown", "扔"],
        ["understand", "understood", "understood", "理解"],
        ["wake", "woke", "woken", "醒来"],
        ["wear", "wore", "worn", "穿"],
        ["win", "won", "won", "赢"],
        ["write", "wrote", "written", "写"],
    ], [2, 2, 2.5, 2])


def build_vocab_all(doc):
    build_core_phrases(doc)
    build_vocab_by_topic(doc)
    build_irregular_verbs(doc)
