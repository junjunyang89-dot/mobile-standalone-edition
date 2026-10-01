/**
 * 挂在用例分组上的说明：这一组页面调了哪些接口、代码里会出什么问题。
 * 按 分类 + 模块 + 子功能 对齐列表里的分组，点开头两条才展开。
 */
export interface CaseApiBrief {
  method: string
  path: string
  params?: string
  summary: string
  points?: string[]
}

export interface CaseIssueBrief {
  title: string
  trigger: string
  actual: string
  /** 对应用例编号，方便从弹窗跳回列表 */
  caseId?: string
}

/** 同一模块安卓和 iOS 的差异。挂在任意一端的说明上，两边列表都能看到。 */
export interface CaseDiffBrief {
  title: string
  android: string
  ios: string
  /** 安卓用例编号 */
  androidCaseId?: string
  /** iOS 用例编号 */
  iosCaseId?: string
}

export interface CaseModuleBrief {
  category: string
  module: string
  subModule?: string
  apis: CaseApiBrief[]
  issues: CaseIssueBrief[]
  diffs?: CaseDiffBrief[]
}

export const CASE_MODULE_BRIEFS: CaseModuleBrief[] = [
  {
    category: 'wmpvp-android',
    module: '发现',
    subModule: 'CS资讯',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: 'CS 资讯流只打这一条。gameTypeStr=2 是 CS。客户端 pageSize 固定传 20；服务端 home.information.v4.switch 默认开着，会忽略这个 pageSize，按最多 50 条资讯组装。',
        points: [
          '首页顺序：match 赛事卡（当天比赛多于 1 场且开关打开）→ banner → 前 4 条 news → topic 专栏（默认最多 10 个）→ 后续 news 到第 8 条后插入 activity → 剩余 news',
          '第 2 页起只有 news，不再插入 Banner、专栏、活动、赛事',
          '截图顶部的国服战令、动态、热评、视频、活动是别的 Tab，不走这个接口',
          '结果在 Redis 缓存约 1 分钟，定时任务大约 30 秒预热一次首页和第 2 页'
        ]
      }
    ],
    issues: [
      {
        title: '没有标签时，标签位显示「完美世界电竞」',
        trigger: '造一条 tagDTOList 为空、或第一个标签名为空的 CS 资讯，让它出现在资讯流。',
        actual: '标签位置不是空白，而是应用名。有标签的资讯仍显示真实标签，例如「赛事相关」。',
        caseId: 'TC-044'
      },
      {
        title: '发布时间为 0 或在未来，时间显示「刚刚」',
        trigger: '把 publishTime 设成 0，或设成比手机当前时间更晚，再下拉刷新。',
        actual: '和「3 分钟内刚发布」是同一句「刚刚」，看不出时间非法。',
        caseId: 'TC-045'
      },
      {
        title: '阅读量在 99950 附近会显示成 10万',
        trigger: '把 pageViewCount 设为 99950，对照 10000 和 308000。',
        actual: '10000 显示 1万，308000 显示 30.8万，99950 会进位成 10万。相邻阅读量可能差出一整个「万」。',
        caseId: 'TC-046'
      },
      {
        title: '连续两条大卡片，第二条变成右侧小图',
        trigger: '连续配置两条大卡片资讯，并让它们在首页相邻。',
        actual: '第一条是通栏大图，第二条在下发前被改成小图。运营配的第二张大图不会按大图出现。',
        caseId: 'TC-047'
      },
      {
        title: '赛事推荐没有比赛关联时，点击打开的是资讯详情',
        trigger: '造 recommendType=4（赛事）的资讯，但 news_match_relation 里没有这条的比赛记录。看接口里 redirectType 为空。',
        actual: '点击整行进的是资讯详情，不是赛事页。补上比赛关系后才会按 scheme 打开赛事。',
        caseId: 'TC-048'
      },
      {
        title: '外链或 scheme 地址为空时，点击没有任何反应',
        trigger: 'recommendNewsDTO.redirectType 设为 5（外链）或 6（scheme），redirectValue 留空。',
        actual: '停在资讯流，不进资讯详情，也没有错误提示。没有推荐位的普通资讯点击仍能进详情。',
        caseId: 'TC-049'
      },
      {
        title: '新发布的资讯，缓存期内下拉刷新可能看不到',
        trigger: '先打开过 CS 资讯，马上新发一条，立刻下拉刷新。大约 1 分钟后再刷新一次。',
        actual: '第一次刷新列表里可能还没有新资讯，等缓存过期后的那次刷新才会出现。',
        caseId: 'TC-050'
      },
      {
        title: '专栏超过 10 个时，没有更多入口',
        trigger: '让 CS 专题总数大于 10（topic.count 默认 10）。',
        actual: '标题是「专栏推荐 (10)」，横滑只有 10 张，标题栏没有「更多」，第 11 个从资讯页进不去。',
        caseId: 'TC-051'
      },
      {
        title: '上拉的一页如果全部重复，列表会停住不再加载',
        trigger: '让第 2 页返回的 newsId 全部已经出现在第 1 页。home.lastest.news.switch 打开时，pageNum=2 容易被折算回旧列表第 1 页。',
        actual: '抓包能看到第 2 页有数据，去重后这一页变空，底部直接结束，不再请求第 3 页。手动打 pageNum=3 其实还有资讯。',
        caseId: 'TC-052'
      },
      {
        title: '接口返回失败时，页面显示空列表而不是错误页',
        trigger: '抓包把 getHomeInformationV5 的 statusCode 改成非 0，result 置空，并保留错误文案。',
        actual: '页面走成功回调，变成空列表，错误文案不展示。本地缓存先出现过的话，刷新后旧列表还会被这次空数据盖掉。',
        caseId: 'TC-053'
      }
    ],
    diffs: [
      {
        title: '横幅自动换一张的间隔',
        android: '多张时每 3 秒换一张。只有 1 张不自动换，也不显示底部圆点。',
        ios: '多张时每 4 秒换一张。只有 1 张不换图，底部仍有一条白色指示。',
        androidCaseId: 'TC-215',
        iosCaseId: 'TC-217'
      },
      {
        title: '点活动类型的横幅',
        android: '就算这条没要求登录，也会先登录，再要求绑 Steam。未开始提示「活动暂未开始」，已结束且没有地址提示「活动已结束」。',
        ios: '这条没要求登录时，未登录只提示「请先登录哦～」，不进登录页，也不看活动是否未开始、有没有绑 Steam。',
        androidCaseId: 'TC-217',
        iosCaseId: 'TC-219'
      },
      {
        title: '视频新闻和视频帖',
        android: '新闻一律进图文详情。视频帖进全屏播放。',
        ios: 'isVideo 为真的新闻进视频新闻。帖子一律进帖子详情。',
        androidCaseId: 'TC-216',
        iosCaseId: 'TC-218'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '发现',
    subModule: 'CS资讯',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: 'iOS CS 资讯流同样只打这一条。gameTypeStr 取 ESportGameType.csgo 的 rawValue，也是 2。pageSize 固定 20。服务端 v4 开关默认开着时仍会忽略 pageSize，按最多 50 条资讯组装。',
        points: [
          '首页顺序与安卓一致：match → banner（张数大于 0 才展示）→ 前 4 条 news → topic 专栏 → 后续 news 到第 8 条后插入 activity → 剩余 news',
          '第 2 页起服务端只返回 news。iOS 收到后直接追加，不会按 newsId 去重',
          '顶部国服战令、动态、热评、视频、活动是别的 Tab，不走这个接口',
          '首页结果在 Redis 缓存约 1 分钟'
        ]
      }
    ],
    issues: [
      {
        title: '没有标签时，标签位显示「完美世界电竞」',
        trigger: '造一条 tagDTOList 为空、或第一个标签名为空的 CS 资讯。',
        actual: '发现页标签用第一个标签名，取不到就写成「完美世界电竞」，再拼上时间。',
        caseId: 'TC-041'
      },
      {
        title: '发布时间在未来时显示「刚刚」',
        trigger: '把 publishTime 设成比手机当前时间更晚，再下拉刷新。',
        actual: '时间差为负时直接显示刚刚，和刚发布的资讯一样。',
        caseId: 'TC-042'
      },
      {
        title: '发布时间为 0 时显示 1970-01-01',
        trigger: '把 publishTime 设成 0。',
        actual: '0 会被当成 1970 年的秒级时间戳，跨年之后显示 yyyy-MM-dd，也就是 1970-01-01。安卓同一条数据显示「刚刚」。',
        caseId: 'TC-043'
      },
      {
        title: '阅读量在 99950 附近会显示成 10万',
        trigger: 'pageViewCount 设为 99950，对照 10000。',
        actual: '超过 9999 按 %.1f 再去掉末尾 .0。99950 会进位成 10万。',
        caseId: 'TC-044'
      },
      {
        title: '只有一条高光帖时，时间、阅读量、评论被换成帖子的',
        trigger: '造一条比赛集锦推荐，highlightPosts 里只有 1 条帖子。',
        actual: '外层仍按普通资讯展示，但评论数、发布时间和阅读量已经被写成这条帖子的 commentCount、publishTime、heat。',
        caseId: 'TC-045'
      },
      {
        title: '小图资讯没有 thumbnailSmall 时不回退大图',
        trigger: '小图资讯只填 thumbnail，thumbnailSmall 留空。',
        actual: '封面请求空地址，显示占位图。大卡片用的是 thumbnail，不受影响。',
        caseId: 'TC-046'
      },
      {
        title: '外链推荐不会按地址打开',
        trigger: 'recommendNewsDTO.redirectType 设为 5，redirectValue 填一个可打开的链接，recommendType 不要设成 1、2、3。',
        actual: '点击整行进的是资讯详情，链接不会被打开。',
        caseId: 'TC-047'
      },
      {
        title: '赛事推荐没有比赛关联时，点击打开的是资讯详情',
        trigger: 'recommendType=4，但没有把 redirectType 写成 6，或 redirectValue 为空。',
        actual: '只有 recommendType=4 且 redirectType=6 且地址非空才会按 scheme 打开赛事，否则进资讯详情。',
        caseId: 'TC-048'
      },
      {
        title: '下拉刷新失败后，原来的列表会被清空',
        trigger: '资讯已经加载出来，下拉时断网或让接口失败。',
        actual: '请求发出前就把内存里的列表清掉。失败后按空数据刷新，页面变成空态。',
        caseId: 'TC-049'
      },
      {
        title: '上拉失败后再拉，会跳过失败的那一页',
        trigger: '滑到底触发上拉，让这一次请求失败，然后再上拉一次。',
        actual: '失败时 pageNum 已经加过，不会减回去。下一次请求的是再下一页。',
        caseId: 'TC-050'
      },
      {
        title: '已出现过的资讯，上拉还会再显示一条',
        trigger: '让第 2 页返回第 1 页里已经有的 newsId。',
        actual: 'iOS 追加前不去重，同一条资讯会再出现一次。',
        caseId: 'TC-051'
      },
      {
        title: '新发布的资讯在缓存期内下拉可能看不到',
        trigger: '先打开过资讯，马上新发一条，立刻下拉。约 1 分钟后再拉一次。',
        actual: '第一次可能仍是缓存列表，过期后的刷新才会出现新资讯。',
        caseId: 'TC-052'
      },
      {
        title: '专栏超过 10 个时没有更多入口',
        trigger: 'CS 专题总数大于 10。',
        actual: '标题是「专栏推荐 (10)」，横滑只有返回的那些，标题上没有更多。',
        caseId: 'TC-053'
      },
      {
        title: '接口只返回 1 场比赛时，iOS 仍会展示赛事卡',
        trigger: '让 getHomeInformationV5 的 match 数组只有 1 场。',
        actual: '只要有 match 节点就渲染赛事卡。安卓在客户端还会再挡掉不足 2 场的情况。',
        caseId: 'TC-054'
      },
      {
        title: '活动横幅没登录时只弹一句提示',
        trigger: '横幅 redirectType 为 1，这条 isLogin 为 false，账号未登录，点这张图。',
        actual: '中间提示「请先登录哦～」，不进登录页，也不去拉活动详情。',
        caseId: 'TC-219'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '专栏推荐',
    subModule: '详情',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: '资讯页上的「专栏推荐」卡片来自这条接口里的 topic 数组，不是单独再请求一次。默认最多 10 条，插在前 4 条资讯后面。',
        points: [
          '卡片展示 thumbnail、title、summary',
          '标题「专栏推荐 (N)」的 N 是本次返回条数'
        ]
      },
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getTopicById',
        params: 'topicId=专栏id',
        summary: '进入专栏详情时取专栏头部。结果缓存 10 分钟。未立即发布的专栏会当成不存在。',
        points: [
          '头部用到 title、summary、thumbnail、totalCount、heat',
          '安卓把头像和背景都绑成 thumbnail，不用作者头像'
        ]
      },
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getNewsListInTopic',
        params: 'topicId=专栏id&pageNum=1&pageSize=20',
        summary: '专栏里的资讯列表。阅读量用的是换算后的阅读数；推荐帖会改成帖子自己的阅读量。',
        points: [
          '安卓只有这一页资讯不为空时，才会把专栏头部放进列表',
          '详情里每条资讯的标签位显示作者，不是资讯标签'
        ]
      }
    ],
    issues: [
      {
        title: '专栏里没有资讯时，详情连头部也不展示',
        trigger: '选一个 totalCount 为 0 的专栏，或让 getNewsListInTopic 返回空数组。',
        actual: '页面是空态。封面、标题、简介都不会出现。',
        caseId: 'TC-059'
      },
      {
        title: '专栏信息接口失败时，资讯列表也出不来',
        trigger: '点进详情后，让 getTopicById 失败，getNewsListInTopic 仍成功。',
        actual: '两次请求绑在一起，信息接口失败整页走错误，资讯列表不展示。',
        caseId: 'TC-060'
      },
      {
        title: '详情头像用的是专栏封面，不是作者头像',
        trigger: '找一个作者头像和专栏封面不是同一张图的专栏，点进去看头部。',
        actual: '圆头像和背景都是 thumbnail。authorInfo.avatar 没有用上。',
        caseId: 'TC-061'
      },
      {
        title: '专栏标题或简介改完，10 分钟内详情仍是旧的',
        trigger: '先打开一次专栏详情，马上改专栏标题，再下拉刷新。',
        actual: 'getTopicById 命中 Redis，约 10 分钟内还是旧标题。',
        caseId: 'TC-062'
      },
      {
        title: '详情里点资讯不会上报资讯点击埋点',
        trigger: '进入专栏详情，点击任意一条资讯，看埋点。',
        actual: '页面能打开资讯详情。ColumnNewsViewHolder 把 itemClickEvent 空实现了，不会打 App_C_NewsClick。',
        caseId: 'TC-063'
      },
      {
        title: '头部热度很大时，用 float 相除，可能和真实值差一截',
        trigger: '把专栏 heat 设成 99950，进入详情看右下角热度。',
        actual: '显示 10万。99950 先转成 float 再除以 10000，四舍五入后去掉 .0。',
        caseId: 'TC-076'
      },
      {
        title: '「共 N 篇更新」和热度是半透明白，iOS 是深灰',
        trigger: '同一专栏分别用安卓和 iOS 打开详情，看头部左下「共 N 篇更新」和右下热度。',
        actual: '安卓是白色 70%（#B3FFFFFF）。iOS 是固定深灰 #686A78。封面图上的这两行需要对齐成同一套颜色。',
        caseId: 'TC-077'
      },
      {
        title: '简介是白色 87%，iOS 简介是纯白',
        trigger: '同一专栏两边打开，看标题下面两行简介。浅色封面和深色封面各看一次。',
        actual: '安卓简介 #DEFFFFFF，字号 13dp，固定两行，行距额外 3dp。iOS 简介纯白，字号 13pt，高度锁死 37pt。',
        caseId: 'TC-078'
      },
      {
        title: '封面蒙版安卓是 40% 黑，iOS 是 60% 黑',
        trigger: '用同一张浅色专栏封面，两边看头部底图。',
        actual: '安卓蒙版 #66000000。iOS 蒙版黑色约 60%。同一张图 iOS 更暗，上面的白字对比也不同。',
        caseId: 'TC-079'
      },
      {
        title: '圆头像白边安卓 3dp，iOS 只有 1pt',
        trigger: '两边看头部左侧圆头像边缘。',
        actual: '安卓描边白色 3dp。iOS 描边白色 1pt。头像都是 66，安卓白边明显更粗。',
        caseId: 'TC-080'
      },
      {
        title: '热度图标安卓 12dp 且 70% 透明，iOS 是 11pt 不透明',
        trigger: '两边看热度数字左边的火焰。',
        actual: '安卓 12dp，alpha 0.7，和热度文字的 70% 白一致。iOS 图标 11×11，xib 里没有降透明度。',
        caseId: 'TC-081'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '专栏推荐',
    subModule: '详情',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: '资讯页「专栏推荐」卡片来自这条接口的 topic。卡片展示封面、标题、简介。',
        points: ['点击用 topic.id 打开 pwesports://news/openColumnPage']
      },
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getTopicById',
        params: 'topicId=专栏id',
        summary: '专栏头部。缓存 10 分钟。头像优先用作者头像，没有再用封面。',
        points: ['展示标题、简介、共 N 篇更新、热度']
      },
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getNewsListInTopic',
        params: 'topicId=专栏id&pageNum=1&pageSize=20',
        summary: '专栏资讯列表，和头部是两次独立请求。列表里标签位显示作者名。',
        points: ['资讯接口失败不会把已经回来的头部清掉；头部接口失败则只有资讯、顶栏标题落到「专栏」']
      }
    ],
    issues: [
      {
        title: '头部热度刚好 10000 不转成万，再大一点会带 .0',
        trigger: '把专栏 heat 设成 10000，再设成 10001，分别进详情。',
        actual: '10000 显示 10000。10001 显示 1.0万，小数 0 不会去掉。',
        caseId: 'TC-060'
      },
      {
        title: '下拉刷新失败后，详情列表会被清空',
        trigger: '详情已经打开，下拉时断网或让接口失败。',
        actual: '请求发出前就把列表清掉，失败后页面变空。',
        caseId: 'TC-061'
      },
      {
        title: '上拉失败后再拉，会跳过失败的那一页',
        trigger: '滑到底让这一次上拉失败，然后再上拉一次，对比两次 pageNum。',
        actual: '失败时页码已经加过，下一次直接请求再下一页。',
        caseId: 'TC-062'
      },
      {
        title: '专栏信息接口失败时，没有头部，顶栏标题变成「专栏」',
        trigger: '让 getTopicById 失败，getNewsListInTopic 成功。',
        actual: '资讯还在，封面和简介没有。上滑后顶栏标题是「专栏」，不是专栏名。',
        caseId: 'TC-063'
      },
      {
        title: '资讯没有作者时，标签位显示「完美世界电竞」',
        trigger: '专栏里放一条 author 为空的资讯。',
        actual: '底部显示「完美世界电竞 · 时间」，不是空标签。',
        caseId: 'TC-064'
      },
      {
        title: '专栏标题改完，10 分钟内详情仍是旧的',
        trigger: '先打开详情，马上改标题，再下拉。',
        actual: 'getTopicById 缓存 10 分钟，刷新仍是旧标题。',
        caseId: 'TC-065'
      },
      {
        title: '资讯发布时间为 0 时，底部显示 1970-01-01',
        trigger: '专栏里放一条 publishTime 为 0 的资讯，进入详情。',
        actual: '作者后面是 1970-01-01。安卓同一条会显示刚刚。',
        caseId: 'TC-078'
      },
      {
        title: '「共 N 篇更新」和热度是深灰，安卓是半透明白',
        trigger: '同一专栏分别用 iOS 和安卓打开详情，看头部「共 N 篇更新」和热度。',
        actual: 'iOS 写死 #686A78，压在 60% 黑蒙版上偏暗。安卓是 #B3FFFFFF。这两行应改成和安卓一样的白色 70%。',
        caseId: 'TC-079'
      },
      {
        title: '简介是纯白，安卓简介是白色 87%',
        trigger: '同一专栏两边打开，看标题下的两行简介。',
        actual: 'iOS 简介 alpha 为 1，高度固定 37pt。安卓是 #DEFFFFFF，两行并带 3dp 额外行距。',
        caseId: 'TC-080'
      },
      {
        title: '封面蒙版是 60% 黑，安卓是 40% 黑',
        trigger: '同一张浅色封面，两边看头部底图。',
        actual: 'iOS 蒙版黑色 alpha 约 0.6。安卓是 #66000000。iOS 整块头部更暗。',
        caseId: 'TC-081'
      },
      {
        title: '圆头像白边只有 1pt，安卓是 3dp',
        trigger: '两边看左侧圆头像的白边。',
        actual: 'iOS borderWidth 为 1。安卓描边 3dp。',
        caseId: 'TC-082'
      },
      {
        title: '热度图标 11pt 且不透明，安卓是 12dp、70% 透明',
        trigger: '两边看热度数字左侧火焰。',
        actual: 'iOS 图标 11×11，没有设置 alpha。安卓 12dp 且 alpha 0.7。',
        caseId: 'TC-083'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '活动中心',
    subModule: '资讯入口',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: '资讯页上的「活动中心」卡片来自这条接口里的 activity 数组，只在第 1 页出现。默认插在第 8 条资讯的位置，专栏会占掉前面一截，所以常见顺序是 4 条资讯、专栏推荐、再 4 条资讯、然后活动中心。',
        points: [
          '卡片用 picUrl、name、status、startTime、endTime',
          '默认最多 10 条，包含全游戏（gameType=0）和 CS',
          '排序是 status 升序、weight 降序、开始时间降序，未开始会排在进行中前面',
          '标题没有「更多」，点标题不会进活动 Tab'
        ]
      },
      {
        method: 'GET',
        path: '/steamcn/app/activity/getActivityDetail',
        params: 'activityId=活动id',
        summary: '安卓点卡片后才会打这条，用来决定能不能打开、打开哪个地址。结果缓存 10 分钟，状态会按开始结束时间重算。',
        points: [
          '未登录先去登录页，未绑 Steam 先弹绑定框，这两步过了才请求',
          'redirectType=1 在 App 内打开网页或 scheme，redirectType=2 用系统浏览器'
        ]
      }
    ],
    issues: [
      {
        title: '未登录去点未开始的活动，不会提示「活动暂未开始」',
        trigger: '退出登录，点一张 status=0 的活动卡片。',
        actual: '直接进登录页。登录并绑定 Steam 之后再点，才会提示活动暂未开始。',
        caseId: 'TC-068'
      },
      {
        title: '开始时间已经过了，卡片仍可能显示「即将开始」',
        trigger: '资讯接口里这条活动 status 仍是 0，但 startTime 已经早于手机当前时间。',
        actual: '未开始分支里，开始时间已过会落到「即将开始」。',
        caseId: 'TC-069'
      },
      {
        title: '结束时间已经过了，卡片仍可能显示「即将结束」',
        trigger: 'status 仍是 1（进行中），但 endTime 已经早于当前时间。',
        actual: '进行中分支只判断「距结束是否大于 1 小时」。结束时间已过时显示即将结束。',
        caseId: 'TC-070'
      },
      {
        title: '进行中但没有跳转地址，点击没有任何提示',
        trigger: '活动 status=1，redirectUrl 为空，登录且已绑 Steam 后点击。',
        actual: '请求详情成功后直接 return，没有 toast。',
        caseId: 'TC-071'
      },
      {
        title: '跳转地址改完，10 分钟内点击仍打开旧地址',
        trigger: '先点开一次活动，马上改 redirectUrl，再从资讯页点同一张卡片。',
        actual: 'getActivityDetail 命中 10 分钟缓存，打开的还是旧地址。资讯流上的封面大约 1 分钟就会更新。',
        caseId: 'TC-072'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '活动中心',
    subModule: '资讯入口',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=2&pageNum=1&pageSize=20',
        summary: '资讯页「活动中心」只用这条接口里的 activity。点卡片不再请求活动详情，直接用列表里的 status 和 redirectUrl。',
        points: [
          '标题固定「活动中心」，没有条数，也没有更多',
          '卡片文案按手机本地时间和 startTime、endTime 计算，点击拦截却看接口 status'
        ]
      }
    ],
    issues: [
      {
        title: '同一天且距开始超过 1 小时，文案没有「开始」',
        trigger: '找一场今天开始、距现在大于等于 1 小时的未开始活动。',
        actual: '只显示 18:00 这种时间。安卓同一条件会显示 18:00开始。',
        caseId: 'TC-069'
      },
      {
        title: '卡片已经显示进行中，点击仍提示活动暂未开始',
        trigger: '接口 status 仍是 0，但 startTime 已经早于手机当前时间。',
        actual: '文案按本地时间算成正在进行或即将结束。点击仍看 status，弹出「活动暂未开始」。',
        caseId: 'TC-070'
      },
      {
        title: '未登录只弹 toast，不会进入登录页',
        trigger: '退出登录，点一张已开始的活动。',
        actual: '提示「您还没有登录,请先登录~~」，停在资讯页。',
        caseId: 'TC-071'
      },
      {
        title: '已结束但填了跳转地址，点击仍会打开',
        trigger: 'status=2，redirectUrl 是一个 http 地址，已登录且已绑 Steam。',
        actual: '只有地址为空才提示活动已结束。有地址会继续打开。',
        caseId: 'TC-072'
      },
      {
        title: '外链仍在 App 内打开',
        trigger: 'redirectType=2，redirectUrl 是 http 地址，活动进行中。',
        actual: '只要地址里带 http 就进 App 内活动页，不会交到系统浏览器。',
        caseId: 'TC-073'
      },
      {
        title: '进行中但没有跳转地址，点击没有提示',
        trigger: 'status=1，redirectUrl 为空。',
        actual: '未开始会提示暂未开始。进行中且地址为空时直接结束，没有 toast。',
        caseId: 'TC-074'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '国服战令',
    subModule: '入口',
    apis: [
      {
        method: 'H5',
        path: 'https://news.wmpvp.com/v3/act-seasonBenefit.html',
        summary: 'CS 发现的「国服战令」不是原生页。配置 discoveryCsgoTabConfigs 里 key 为 h5、标题为国服战令、webUrl 为这个地址时，用 X5 网页容器打开。',
        points: ['地址为空时这个 Tab 不会加到导航上', '配置整份没下发时走默认 Tab，没有国服战令']
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '国服战令',
    subModule: '入口',
    apis: [
      {
        method: 'H5',
        path: 'https://news.wmpvp.com/v3/act-seasonBenefit.html',
        summary: 'iOS 从 topPaginationCsgoConfigs 读取。key 为 h5、标题为国服战令、url 为这个地址时，用无导航栏的网页容器打开。',
        points: ['地址为空时 Tab 仍会加上，点进去是空白页']
      }
    ],
    issues: [
      {
        title: '配置没给地址时，国服战令 Tab 仍会出现',
        trigger: 'topPaginationCsgoConfigs 里有 key=h5、title=国服战令，但 url 为空。',
        actual: 'Tab 照样显示。点进去网页地址是空的。安卓同一情况下不会添加这个 Tab。',
        caseId: 'TC-085'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '国服战令',
    subModule: '赛季福利',
    apis: [
      {
        method: 'GET',
        path: '/api/userTask/listByCategory',
        params: 'category=2026S3_activity&showHidden=true',
        summary: '国服战令页的主任务列表。分类写死为 2026S3_activity。名称里带「惊喜福利」的做置顶任务，名称是 7 的做可重复钥匙任务，其余按名称排序后只取前 5 条。',
        points: [
          '状态 10 已领取，30 进行中，40 可领取',
          '奖励先截断成前 4 个，再按类型排序',
          '领取截止时间取排序后第一条任务的结束时间'
        ]
      },
      {
        method: 'GET',
        path: '/api/userTask/listByCategory',
        params: 'category=task_1&showHidden=true',
        summary: '再取 name 等于 1 的任务，固定展示成「福利任务I」，放在列表最上面。',
        points: ['和主列表是两次请求']
      },
      {
        method: 'GET',
        path: '/api/userTask/init',
        params: 'platform=CSGO',
        summary: '主列表为空或失败时调用。成功后等 2.5 秒再拉列表，最多重试 3 次。',
        points: []
      },
      {
        method: 'POST',
        path: '/api/userTask/recvAwards',
        params: 'body: { id: 任务id }',
        summary: '领取奖励。code 为 0 且 data 有值才算成功，然后弹「领取成功」并刷新两个列表。',
        points: ['黑名单、已领取、已过期不会发这个请求']
      },
      {
        method: 'GET',
        path: '/api/userTask/inBlacklist',
        summary: '已绑定 Steam 时检查付费黑名单。data 为 true 就弹「由于恶意行为，您已被禁止参与本次活动！」。',
        points: []
      },
      {
        method: 'GET',
        path: '/steamcn/community/user/getUserBasicInfo',
        params: 'token=登录token',
        summary: '头部头像和昵称。SteamID 优先用客户端账号，接口里的 steamId 只是兜底。',
        points: []
      },
      {
        method: 'GET',
        path: '/steamcn/app/common/getAnnotationList',
        params: 'gameType=2&locationType=15',
        summary: '活动规则。优先用注解 id=33 的 content，没有就用列表第一条。未登录点规则不会打开弹窗。',
        points: ['正文用 v-html 渲染']
      }
    ],
    issues: [
      {
        title: '奖励先取前 4 个再排序，后面的高优先级奖看不到',
        trigger: '某任务返回 5 个以上奖励，把大会员放在第 5 个。',
        actual: '页面只展示原数组前 4 个，再在这 4 个里排序。第 5 个大会员不会出现。',
        caseId: 'TC-010'
      },
      {
        title: '神马币配了图片也会被换成默认金币图',
        trigger: '奖励 type 为 MYSTERY_SHOP_COIN，并且 image 有地址。',
        actual: '因为写法是 image 或数量判断再选图，只要 image 有值就用 jf2 大金币，配置图不显示。',
        caseId: 'TC-011'
      },
      {
        title: '结束时间看的是状态排序后的第一条，缺时间就整页已结束',
        trigger: '让可领取任务没有 recvAwardsEndTime 和 recvEndTime，其他任务有结束时间。',
        actual: '可领取状态 40 排在最前，结束时间按 0 算。当前时间大于 0，整页盖上结束遮罩，不能领取。',
        caseId: 'TC-012'
      },
      {
        title: '未绑 Steam 的错误文案被写死',
        trigger: '让 listByCategory 返回 code=80004，msg 为别的句子。',
        actual: '页面只提示「请先绑定SteamId」。代码是字符串或 res.msg，前面的字符串永远为真。',
        caseId: 'TC-013'
      },
      {
        title: '任务名不是数字时，标题变成福利任务undefined',
        trigger: '主列表里放一条名称不是数字、也不含「惊喜福利」、状态不是 1 的任务，并排进前 5。',
        actual: 'formatTaskName 用名称减 1 当下标。名称不是数字时下标是 NaN，标题为「福利任务undefined」。',
        caseId: 'TC-014'
      },
      {
        title: '名称是 7 的任务可能显示两次',
        trigger: '2026S3_activity 里有 name 为 7 的任务，并且按名称排序能进前 5 条。',
        actual: '前 5 条里已经有它，后面又按重复任务插一次。列表出现两张。',
        caseId: 'TC-015'
      },
      {
        title: '从别的页面回到战令，列表会先被清空',
        trigger: '打开国服战令，切到其他 App 再回来，或触发页面 visibilitychange。',
        actual: '先把任务、头像、SteamID 清掉，再重新请求。中间会闪成加载或空数据。',
        caseId: 'TC-016'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '动态',
    subModule: '列表',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/event/getPlayerTeamEventPost',
        params: 'pageNum=1&pageSize=20&hltvId=可选',
        summary: '动态列表。未登录或还没初始化关注时，用配置里的战队、选手、赛事和其他账号。已初始化关注后，只看自己关注的对象；点了最近访问头像时再按 hltvId 收窄。',
        points: [
          '每页 20 条，服务端单次最多再截到 200 条',
          '热评最多 3 条',
          '时间展示按东八区'
        ]
      },
      {
        method: 'GET',
        path: '/acty/community/event/getRecentVisits',
        summary: '已登录才请求。返回最近访问、关注数量 followSize、红点用的 lastId。最多展示 6 个头像。',
        points: ['followSize 为 0 时直接进入选择关注', '有关注但没有访问记录时，列表上方出现「关注更多战队选手」']
      },
      {
        method: 'POST',
        path: '/acty/community/event/userVisitSave',
        params: 'body: { toHltvId }',
        summary: '点开一条动态时记录访问。未登录或没有 relationHltvId 不记。',
        points: []
      },
      {
        method: 'POST',
        path: '/steamcn/community/post/likePost',
        params: 'liked、postId、token',
        summary: '点赞。按钮先改数字，再发请求。未登录会拉起登录，提示「你还没登录，不能点赞哟~o(≧v≦)o」。',
        points: []
      },
      {
        method: 'GET',
        path: '/acty/community/event/getPlayerTeamEvents',
        summary: '选择关注页的选手、战队、赛事、其他。',
        points: []
      },
      {
        method: 'POST',
        path: '/acty/community/event/doFollow',
        params: 'body: { operationType, toHltvId }',
        summary: '关注或取消关注。未登录提示「你还没登录哦」。',
        points: []
      }
    ],
    issues: [
      {
        title: '动态列表请求失败时，页面显示暂无动态',
        trigger: '打开 CS 发现-动态，让 getPlayerTeamEventPost 失败。',
        actual: '没有错误提示。列表被当成拉完，空数据时文案是「暂无动态」。',
        caseId: 'TC-025'
      },
      {
        title: '日期数字按东八区，今天和昨天按手机本地时区',
        trigger: '把手机时区改成非东八区，看同一条动态的日期头和时间。',
        actual: '「09月27日」和「14:06」走东八区。后面的「/今天」「/昨天」用手机本地零点比较，两边可能不是同一天。',
        caseId: 'TC-026'
      },
      {
        title: '扩展信息不是合法 JSON 时，这一条会渲染失败',
        trigger: '让一条动态的 expandInfo 不是 JSON，例如普通字符串。',
        actual: '模板里直接 JSON.parse，解析失败会让这条动态渲染中断。',
        caseId: 'TC-027'
      },
      {
        title: '点赞先改数字，接口失败不退回',
        trigger: '已登录，点点赞，同时让 likePost 失败。',
        actual: '数字已经加 1 或减 1。请求失败后没有改回去。列表数据里的 liked 也不会更新，整页重绘后可能回到旧状态。',
        caseId: 'TC-028'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '动态',
    subModule: '跳转',
    apis: [
      {
        method: 'SCHEME',
        path: 'pwesports://community/openPostDetailPage',
        params: 'postId=帖子id&tab=comment（仅评论）',
        summary: '点正文打开帖子详情 PostDetailActivity。点评论时多带 tab=comment，详情定位到评论。点扩展图里的另一条帖子时，postId 用扩展信息里的 id。',
        points: ['postId 小于等于 0 时页面不会打开']
      },
      {
        method: 'SCHEME',
        path: 'pwesports://community/openPostShareDialog',
        params: 'postId=帖子id',
        summary: '点分享弹出 SharePostDialogFragment，不离开动态页。',
        points: []
      },
      {
        method: 'SCHEME',
        path: 'pwesports://community/openVideoPostPlayer',
        params: 'postId=帖子id',
        summary: '点纯视频封面进入 SinglePostVideoPlayerActivity。',
        points: []
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '动态',
    subModule: '跳转',
    apis: [
      {
        method: 'SCHEME',
        path: 'pwesports://community/openPostDetailPage',
        params: 'postId=帖子id&tab=comment（仅评论）',
        summary: '点正文打开 NewPostWebViewController。点评论时 tab=comment。',
        points: ['postId 为空或 0 时不创建页面']
      },
      {
        method: 'SCHEME',
        path: 'pwesports://community/openPostShareDialog',
        params: 'postId=帖子id',
        summary: '点分享先拉帖子信息，再弹出 ESShareViewController。动态页还在下面。',
        points: []
      },
      {
        method: 'SCHEME',
        path: 'pwesports://community/openVideoPostPlayer',
        params: 'postId=帖子id',
        summary: '点纯视频封面进入 VideoFullScreenViewController，全屏单条播放。',
        points: []
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '热评',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getHotComments',
        params: 'gameType=2',
        summary: 'CS 发现-热评。近 48 小时、点赞数从高到低，最多 20 条。结果在服务端内存里，靠定时任务刷新。',
        points: ['不能上拉加载更多']
      },
      {
        method: 'POST',
        path: '/acty/community/major/2024/comment/like/status',
        params: 'commentIdList=本页评论 id',
        summary: '已登录才查每条热评自己有没有点过赞。',
        points: ['这个接口失败时，热评列表也不会展示']
      },
      {
        method: 'POST',
        path: '/steamcn/community/comment/likeComment',
        params: 'commentId、liked、mainComment=true、token',
        summary: '点赞或取消。页面会先改数字再发请求。',
        points: []
      }
    ],
    issues: [
      {
        title: '会员昵称颜色和 iOS 不一致',
        trigger: '看一条会员用户的热评昵称。',
        actual: '安卓会员色是 #F2657D。iOS 是 #F26374。',
        caseId: 'TC-101'
      },
      {
        title: '点赞失败后数字不退回，也没有提示',
        trigger: '已登录，点点赞，同时让 likeComment 失败。',
        actual: '数字和红心已经改了。失败后静默，不会改回去。',
        caseId: 'TC-106'
      },
      {
        title: '点赞状态接口失败时，热评整页进错误',
        trigger: '已登录，getHotComments 成功，like/status 失败。',
        actual: '已经拿到的热评不会画出来，页面走错误态并 toast。',
        caseId: 'TC-117'
      }
    ],
    diffs: [
      {
        title: '请求多带了深色标记',
        android: '只传 gameType=2。',
        ios: '另外带 darkType，浅色 0、深色 1。服务端不看这个参数。',
        androidCaseId: 'TC-097',
        iosCaseId: 'TC-099'
      },
      {
        title: '点赞状态接口失败',
        android: '热评已经拿到也不展示，整页进错误并 toast。',
        ios: '列表照常展示，不 toast，点赞状态沿用热评接口里原来的值。',
        androidCaseId: 'TC-117',
        iosCaseId: 'TC-119'
      },
      {
        title: '满 10 分钟自动刷新',
        android: '切走再回来，距上次请求满 10 分钟会自动再请求。',
        ios: '没有这套计时。登录成功才会重新请求。',
        androidCaseId: 'TC-116',
        iosCaseId: 'TC-118'
      },
      {
        title: '再点底部「发现」',
        android: '列表回到顶部并马上刷新。',
        ios: '热评不在这次刷新的分支里，列表停在原地。',
        androidCaseId: 'TC-132',
        iosCaseId: 'TC-134'
      },
      {
        title: '第 4 名以后的数字颜色',
        android: '固定 #8196BB，深色主题也不变。',
        ios: '浅色 #8196BB，深色是白色 70%。',
        androidCaseId: 'TC-119',
        iosCaseId: 'TC-121'
      },
      {
        title: '会员昵称颜色',
        android: '#F2657D。',
        ios: '#F26374。',
        androidCaseId: 'TC-101',
        iosCaseId: 'TC-103'
      },
      {
        title: '头像框特效',
        android: '有 avatarFrame 才显示框，没有头像特效。未登录点头像也能进个人主页。',
        ios: '有框之外，nftTokenIdApp 不为空还会播头像特效。未登录点头像去登录，没有 toast。',
        androidCaseId: 'TC-120',
        iosCaseId: 'TC-122'
      },
      {
        title: '点昵称',
        android: '和点头像一样进个人主页。',
        ios: '昵称不能点。',
        androidCaseId: 'TC-104',
        iosCaseId: 'TC-106'
      },
      {
        title: '没有昵称时',
        android: '空白，不用 steamId 兜底。',
        ios: '依次用 steamId、userId。',
        androidCaseId: 'TC-129',
        iosCaseId: 'TC-131'
      },
      {
        title: '时间戳为 0',
        android: '显示「刚刚发表了评论」。',
        ios: '会格式化成 1970 的日期。',
        androidCaseId: 'TC-100',
        iosCaseId: 'TC-102'
      },
      {
        title: '评论配图和视频',
        android: '图固定 100×100。有视频时用封面填这张图，点图开大图，点视频进播放页。',
        ios: '尺寸按图片地址算。只有 image 才出图，视频封面不展示。点图片留在热评，不开大图。',
        androidCaseId: 'TC-122',
        iosCaseId: 'TC-124'
      },
      {
        title: '「评价选手」的底色',
        android: '「评价rain」有浅青底 #E5F4FF。',
        ios: '只有青色字，没有这块底。',
        androidCaseId: 'TC-123',
        iosCaseId: 'TC-125'
      },
      {
        title: '比分里较低的那一边',
        android: '低分和平局都是 #999999。',
        ios: '低分和横线保持 #666666，只有更高的数字是绿色。',
        androidCaseId: 'TC-124',
        iosCaseId: 'TC-126'
      },
      {
        title: '新闻封面',
        android: '优先 thumbnail，没有再用 thumbnailSmall。',
        ios: '只用 thumbnail，没有就用占位图。',
        androidCaseId: 'TC-125',
        iosCaseId: 'TC-127'
      },
      {
        title: '帖子引用的标题',
        android: '有 title 显示 title，没有才用摘要。',
        ios: '只显示摘要，有标题也不显示。',
        androidCaseId: 'TC-126',
        iosCaseId: 'TC-128'
      },
      {
        title: '未登录点赞',
        android: '去登录，没有「你还没登录，不能点赞哟」这句。',
        ios: '去登录，并带上这句文案。',
        androidCaseId: 'TC-105',
        iosCaseId: 'TC-107'
      },
      {
        title: '点赞失败',
        android: '数字不退回，没有 toast。从 0 再减可能变成负数。',
        ios: '数字不退回，但会 toast。减到 0 就停。点赞会播动画。',
        androidCaseId: 'TC-106',
        iosCaseId: 'TC-108'
      },
      {
        title: '点赞过万的算法',
        android: '用 float 除以 10000。',
        ios: '用 Double。临界值上可能差 0.1。',
        androidCaseId: 'TC-102',
        iosCaseId: 'TC-104'
      },
      {
        title: '没单独写过的评论类型',
        android: '仍画成新闻卡片。新闻数据是空的，点整卡不会进入新闻。',
        ios: '不填新闻标题，点整卡不跳转。',
        androidCaseId: 'TC-131',
        iosCaseId: 'TC-133'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '热评',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getHotComments',
        params: 'gameType=2，另带 darkType=0 或 1',
        summary: 'CS 发现-热评。服务端只认 gameType，darkType 不参与筛选。',
        points: ['不能上拉加载更多']
      },
      {
        method: 'POST',
        path: '/acty/community/major/2024/comment/like/status',
        params: 'commentIdList=本页评论 id',
        summary: '拉完热评后查点赞状态。这个接口失败时，列表仍然展示。',
        points: []
      },
      {
        method: 'POST',
        path: '/steamcn/community/comment/likeComment',
        params: 'commentId、liked、mainComment=true、token',
        summary: '点赞或取消。页面会先改数字再发请求。',
        points: []
      }
    ],
    issues: [
      {
        title: '会员昵称颜色和安卓不一致',
        trigger: '看一条会员用户的热评昵称。',
        actual: 'iOS 会员色是 #F26374。安卓是 #F2657D。',
        caseId: 'TC-103'
      },
      {
        title: '点评论图片不会打开大图，视频封面也不展示',
        trigger: '点一条带图的热评图片；再找一条带视频的评论。',
        actual: '图片的点击标记不是大图预览用的 499，点了留在热评。视频评论不取封面，也进不了播放页。',
        caseId: 'TC-109'
      },
      {
        title: '点赞失败后数字不退回',
        trigger: '已登录，点点赞，同时让 likeComment 失败。',
        actual: '数字已经加减。失败只会 toast 接口文案，不会把数字改回去。',
        caseId: 'TC-108'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '视频',
    apis: [
      {
        method: 'POST',
        path: '/avo/videos',
        params: 'gameType=2&tagId=0&pageNum=1&pageSize=20',
        summary: 'CS 发现-视频列表。没有视频信息的帖子会被安卓丢掉。可以上拉，每页 20 条。',
        points: ['下拉会回到第 1 页，并同时再拉置顶专题']
      },
      {
        method: 'GET',
        path: '/avo/topTopics',
        params: 'gameType=2',
        summary: '列表顶部的专题入口，最多展示 9 个，三列。空或失败时整条专题栏隐藏。',
        points: []
      },
      {
        method: 'POST',
        path: '/steamcn/community/post/likePost',
        params: 'postId、liked、token',
        summary: '点赞或取消。页面先改数字再请求。',
        points: ['失败不退回，也没有 toast']
      }
    ],
    issues: [
      {
        title: '下拉刷新后，第一条可能有声音但画面不在',
        trigger: 'Wi-Fi 下播到第 4 条之后，再下拉刷新。',
        actual: '刷新后会自动播第一条，声音出来了，画面却还停在复用前的位置。',
        caseId: 'TC-139'
      },
      {
        title: '点赞失败后数字不退回',
        trigger: '已登录，点点赞，同时让 likePost 失败。',
        actual: '数字和状态已经改了。失败后没有 toast，也不会改回去。',
        caseId: 'TC-143'
      }
    ],
    diffs: [
      {
        title: '置顶专题的排列',
        android: '三列从左到右、再换行。第 1 个在左上。',
        ios: '按列排。第一列是第 1、4、7 个，第二列是第 2、5、8 个。',
        androidCaseId: 'TC-134',
        iosCaseId: 'TC-136'
      },
      {
        title: '专题接口变空',
        android: '专题栏隐藏。',
        ios: '已经显示过的专题栏不会被清掉。',
        androidCaseId: 'TC-134',
        iosCaseId: 'TC-136'
      },
      {
        title: '没有视频信息的帖子',
        android: '从列表里去掉。',
        ios: '接口返回什么就展示什么，没有这段过滤。',
        androidCaseId: 'TC-146',
        iosCaseId: 'TC-148'
      },
      {
        title: '头像框',
        android: '绑数据前把 avatarFrame 清掉，不显示头像框，也没有 NFT 特效。',
        ios: '有头像框就盖上。nftTokenIdApp 不为空还有头像特效。',
        androidCaseId: 'TC-137',
        iosCaseId: 'TC-139'
      },
      {
        title: '没有昵称',
        android: '显示 --，不用 steamId。',
        ios: '先用 steamId，再没有才显示 --。',
        androidCaseId: 'TC-137',
        iosCaseId: 'TC-139'
      },
      {
        title: '点昵称',
        android: '和点头像一样进个人主页，不要求登录。',
        ios: '昵称不能点。点头像未登录会去登录。',
        androidCaseId: 'TC-144',
        iosCaseId: 'TC-146'
      },
      {
        title: '点整卡带进全屏的列表',
        android: '从点的那条带到当前这一页的末尾，不是已经加载的全部。',
        ios: '把当前已经加载的整表都带进全屏。正在播的那条会带上播放进度。',
        androidCaseId: 'TC-138',
        iosCaseId: 'TC-140'
      },
      {
        title: '评论数超过 999',
        android: '1000 到 9999 显示原数字，超过 9999 用「万」。',
        ios: '超过 999 显示 999+。',
        androidCaseId: 'TC-145',
        iosCaseId: 'TC-147'
      },
      {
        title: '点分享',
        android: '直接弹出分享，不先请求帖子详情。',
        ios: '先请求 getPostById，再弹出分享。帖子 id 小于等于 0 时什么都不弹。',
        androidCaseId: 'TC-141',
        iosCaseId: 'TC-143'
      },
      {
        title: '全屏滑到最后一条再往上',
        android: '灰色 toast「已经是最后一个视频了」。离底部还有 5 条时就会预拉下一页。',
        ios: '没有这句提示。滑到当前最后一条就再请求下一页，请求回来后可以继续上滑。',
        androidCaseId: 'TC-150',
        iosCaseId: 'TC-152'
      },
      {
        title: '列表里上下滑换哪一条播',
        android: '停住后，看第一条露出的视频有没有超过一半高度再加 10dp。超过就播它，否则播下一条。不允许自动播时，滑走只会停，不会开下一条。',
        ios: '松手后播离屏幕中线最近的那条。只有 Wi-Fi，或设置成任何网络都自动播时，滑动才会换播。',
        androidCaseId: 'TC-149',
        iosCaseId: 'TC-151'
      },
      {
        title: '点赞凑满任务',
        android: '弹出任务弹窗，标题「点赞成功」，说明是「点赞N次，任务完成」。',
        ios: '窗口 toast，上面是经验值，下面是「点赞N次，任务完成」。',
        androidCaseId: 'TC-157',
        iosCaseId: 'TC-159'
      },
      {
        title: '全屏单击',
        android: '竖屏单击是暂停或继续。横屏单击只切换控制条和返回键，不暂停。',
        ios: '竖屏单击是暂停或继续。横屏单击只切换控制条显隐。',
        androidCaseId: 'TC-158',
        iosCaseId: 'TC-160'
      },
      {
        title: '没在播放时长按',
        android: '播放器不是播放中时，长按不改成 2 倍速。',
        ios: '长按直接把速率设成 2，不先判断是不是正在播。',
        androidCaseId: 'TC-160',
        iosCaseId: 'TC-162'
      },
      {
        title: '全屏关注按钮文案',
        android: '未关注是「+ 关注」，已关注是「已关注」。自己的视频不显示这个按钮。',
        ios: '未关注是「关注」，已关注是「已关注」。自己的视频也不显示。',
        androidCaseId: 'TC-162',
        iosCaseId: 'TC-164'
      },
      {
        title: '全屏点昵称',
        android: '点和头像一样进个人主页，不要求登录。',
        ios: '昵称不能点。点头像不要求登录，进个人主页并带 page=post7。',
        androidCaseId: 'TC-163',
        iosCaseId: 'TC-165'
      },
      {
        title: '全屏未登录点评论',
        android: '直接拉起评论抽屉，这段点击里没有先去登录。',
        ios: '去登录，并提示「你还没登录，不能评论哟~o(≧v≦)o」。',
        androidCaseId: 'TC-165',
        iosCaseId: 'TC-167'
      },
      {
        title: '全屏遇到非 Wi-Fi',
        android: '画面上盖一层，文案「当前非Wi-Fi环境，继续观看将消耗流量」，按钮「继续播放」。点了才允许用流量并继续播。',
        ios: '弹窗，取消会停播，继续播放会记住这次选择。无网络是另一句「当前无网络，请检查网络连接状态」，按钮「知道了」。',
        androidCaseId: 'TC-170',
        iosCaseId: 'TC-172'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '视频',
    apis: [
      {
        method: 'POST',
        path: '/avo/videos',
        params: 'gameType=2&tagId=0&pageNum=1&pageSize=20',
        summary: 'CS 发现-视频列表。gameType 传的是数字 2。可以上拉，每页 20 条。',
        points: ['下拉会同时刷新顶部专题']
      },
      {
        method: 'GET',
        path: '/avo/topTopics',
        params: 'gameType=2',
        summary: '顶部专题，最多 9 个。按列排成最多 3 列。',
        points: []
      },
      {
        method: 'POST',
        path: '/steamcn/community/post/likePost',
        params: 'postId、liked',
        summary: '点赞或取消。页面先改数字再请求，失败静默。',
        points: []
      }
    ],
    issues: [
      {
        title: '点赞失败后数字不退回',
        trigger: '已登录，点点赞，同时让 likePost 失败。',
        actual: '数字已经加减。失败只是把按钮重新放开，没有改回去，也没有 toast。',
        caseId: 'TC-145'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '活动',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/activity/getActivityList',
        params: 'gameType=2&pageNum=1&pageSize=20',
        summary: 'CS 发现-活动列表。一张大图加状态角标。同一页里第一次出现已结束时，前面插一条分隔图。',
        points: ['下拉回到第 1 页', '这一页为空就没有更多']
      }
    ],
    issues: [
      {
        title: '没绑 Steam 也能进活动',
        trigger: '已登录但没绑 Steam，点一条进行中、地址是网页的活动。',
        actual: '绑定判断被注释掉了，注释写着和 iOS 统一，但 iOS 仍会去绑定。安卓直接打开网页。',
        caseId: 'TC-183'
      }
    ],
    diffs: [
      {
        title: '已结束前面的分隔',
        android: '同一页里，状态从不是已结束变成已结束时，前面插一条灰色分隔图。这一页开头就是已结束，则没有分隔。',
        ios: '没有这条分隔，已结束和进行中连在一起。',
        androidCaseId: 'TC-174',
        iosCaseId: 'TC-176'
      },
      {
        title: '卡片高度',
        android: '图高是（屏幕宽减 20dp）乘 0.349。',
        ios: '图高是（屏幕宽减 20）乘 133/355。',
        androidCaseId: 'TC-173',
        iosCaseId: 'TC-175'
      },
      {
        title: '列表是空的或失败',
        android: '第一次就是空的，出空页面。已经有数据时这一页为空，底部没有更多。失败且列表是空的出错误页；已经有数据则 toast 错误文案。',
        ios: '没有空页面，也没有错误页。失败只停住刷新，不 toast。这一页是 0 条就把底部收成没有更多。',
        androidCaseId: 'TC-177',
        iosCaseId: 'TC-179'
      },
      {
        title: '已结束且没有跳转地址',
        android: '灰色 toast「活动已结束」。',
        ios: '点了没有这句提示。地址为空时不会进网页。',
        androidCaseId: 'TC-180',
        iosCaseId: 'TC-182'
      },
      {
        title: '没绑 Steam',
        android: '不拦截，已登录就能进。',
        ios: '地址里带 http 时，会去绑定 Steam，不打开活动。',
        androidCaseId: 'TC-183',
        iosCaseId: 'TC-185'
      },
      {
        title: '跳转方式是外部浏览器',
        android: 'redirectType 为 2 时，用系统浏览器打开。',
        ios: '不看 redirectType。地址里有 http 就在应用内打开活动页。',
        androidCaseId: 'TC-185',
        iosCaseId: 'TC-187'
      },
      {
        title: '地址不是网页',
        android: '未开始仍然 toast「活动暂未开始」，不会走 scheme。进行中且 redirectType 为 1，才按 scheme 打开。',
        ios: '地址里没有 http 时，不看未开始、不看登录，直接按这个地址跳。',
        androidCaseId: 'TC-186',
        iosCaseId: 'TC-188'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '活动',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/activity/getActivityList',
        params: 'gameType=2&pageNum=1&pageSize=20',
        summary: 'CS 发现-活动列表。gameType 用游戏类型字符串。一张大图加状态角标。',
        points: ['下拉从第 1 页重新拉', '这一页 0 条就没有更多']
      }
    ],
    issues: [
      {
        title: '已结束且没有地址时，没有「活动已结束」',
        trigger: '点一条 status 为 2、跳转地址为空的活动。',
        actual: '「活动已结束」写在「地址里包含 http」的分支里，空地址进不去。点了没有 toast。',
        caseId: 'TC-182'
      },
      {
        title: '下拉出新数据后，底部可能还是没有更多',
        trigger: '先上拉到没有更多，再下拉刷新，这一页有数据。',
        actual: '刷新成功且有数据时，没有把底部从「没有更多」恢复成可以继续加载。',
        caseId: 'TC-177'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '完美开箱',
    apis: [],
    issues: [],
    diffs: [
      {
        title: '未登录点金刚位',
        android: '本地默认要求登录。没登录去登录页，打不开网页。',
        ios: '本地默认不要求登录。先打开网页，网页发现没有 token 再提示「你还没登录哦~」。',
        androidCaseId: 'TC-187',
        iosCaseId: 'TC-189'
      },
      {
        title: '默认打开的地址',
        android: 'news 域名下的 /boxLive.html，没有 hash。页面自己会进首页。',
        ios: 'web 域名下的 /boxLive.html?from=#/home/index。from 实际是空的，hash 指定首页。',
        androidCaseId: 'TC-187',
        iosCaseId: 'TC-189'
      },
      {
        title: '金刚位图标',
        android: '日间、夜间各一张静图。',
        ios: '按日夜间换动图。',
        androidCaseId: 'TC-187',
        iosCaseId: 'TC-189'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '完美开箱',
    apis: [
      {
        method: 'GET',
        path: '/liveRobot/openBox/getLiveRobotList',
        params: '',
        summary: '直播开箱的主播列表。空列表显示「主播走丢了~」。',
        points: ['选中主播后再拉直播流和实时开箱']
      },
      {
        method: 'GET',
        path: '/mall/product/dream/case/productList',
        params: 'sortType 或 filterType',
        summary: '云开箱箱子列表。热门、低价走 sortType，终端机、特价走 filterType。',
        points: ['空列表显示「暂无可用宝箱」']
      },
      {
        method: 'GET',
        path: '/liveRobot/openBox/getDailyChallengeProgress',
        params: '',
        summary: '每日挑战进度。没登录不展示这块。',
        points: ['0 点进度归零', '终端机不计入']
      },
      {
        method: 'GET',
        path: '/mall/order/dream/case/user/hasOpened',
        params: '',
        summary: '是否开过箱。为真才在底部出现「二次购买」。',
        points: []
      }
    ],
    issues: [
      {
        title: '底部「我的订单」点击时不拦登录',
        trigger: '未登录，如果已经停在完美开箱页，点底部「我的订单」。',
        actual: '登录拦截只写了名为 order 的入口。现在的四个底栏都不叫 order，所以这次点击不会再去登录。',
        caseId: 'TC-045'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '游戏商城',
    apis: [],
    issues: [],
    diffs: [
      {
        title: '未登录点金刚位',
        android: '本地默认要求登录。没登录去登录页，打不开商城。',
        ios: '本地默认不要求登录，直接打开商城网页。',
        androidCaseId: 'TC-188',
        iosCaseId: 'TC-190'
      },
      {
        title: '默认地址',
        android: '/gameMall.html#/index?tagId=3829，没有 assistCode。',
        ios: '/gameMall.html#/index?tagId=3829&assistCode=，assistCode 是空的。',
        androidCaseId: 'TC-188',
        iosCaseId: 'TC-190'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '游戏商城',
    apis: [
      {
        method: 'GET',
        path: '/mall/product/getShopCategoryTag',
        params: '',
        summary: '顶部分类。最前面固定一个「首页」。CS 发现进来时选中 tagId=3829。',
        points: ['分类顺序可以在分类设定里改，记在本机']
      },
      {
        method: 'POST',
        path: '/mall/product/productList',
        params: 'platform=8&tagId&name&sortType',
        summary: '当前分类下的商品。价格是现价乘起购数量，再除以 100。',
        points: ['空列表显示「暂无商品」']
      },
      {
        method: 'GET',
        path: '/mall/order/countGmOrders',
        params: '',
        summary: '未完成订单数。已登录且绑了 Steam 才请求，用来给出订单红点。',
        points: []
      }
    ],
    issues: [
      {
        title: '下拉刷新会把整页换成加载中',
        trigger: '商品列表下拉刷新。',
        actual: '等 1 秒后重新请求，同时刷新状态马上结束。请求期间整页是转圈，不是只在顶部转。',
        caseId: 'TC-052'
      },
      {
        title: '列表是空的时候，改排序没有效果',
        trigger: '当前分类没有商品，把排序改成热卖或价格。',
        actual: '排序方法发现列表是空的就直接返回，不会再请求。',
        caseId: 'TC-049'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: 'Top20选手',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20Prediction',
        params: '',
        summary: '今年 TOP 指数。安卓不带 darkType。名单超过 20 人时，分隔线画在第 21 条选手上。',
        points: ['没有上拉加载更多', '标签最多 3 个', '名字空显示「--」']
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20History',
        params: 'year',
        summary: '历年选手回顾。年份从去年排到 2013，默认去年。',
        points: ['战队图标最多 4 个']
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20CumulativeCountRanking',
        params: 'page&pageSize=20',
        summary: '累计入选次数。第一条默认展开。',
        points: []
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20ConsecutiveCountRanking',
        params: 'page&pageSize=20',
        summary: '连续入选次数。第一条不自动展开。',
        points: []
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20FirstEntryAgeRanking',
        params: 'sort&page&pageSize=20',
        summary: '首次入选年龄。sort=1 最年轻，sort=2 最年长。安卓没打开上拉。',
        points: []
      },
      {
        method: 'POST',
        path: '/eventcenter/app/cs/hltv/top/player/voice',
        params: 'hltvId&type',
        summary: '表态。type 1 没毛病、2 高了、3 低了、4 爆了。',
        points: ['没登录可以先看到气泡，点选项才去登录']
      }
    ],
    issues: [
      {
        title: '表态成功后，另外三个选项的人数各减 1',
        trigger: '已登录，点一个还没投过的表态。',
        actual: '选中项人数加 1。另外三项在本地各减 1，不会重新拉名单。',
        caseId: 'TC-194'
      },
      {
        title: '首次入选年龄不能看第二页',
        trigger: '最年轻或最年长名单超过 20 人，上拉。',
        actual: '这一页没有打开加载更多，只能看到第一页。',
        caseId: 'TC-200'
      }
    ],
    diffs: [
      {
        title: '页面标题',
        android: '「Top20 选手」，Top20 和选手之间有空格。',
        ios: '「Top20选手」，中间没有空格。',
        androidCaseId: 'TC-189',
        iosCaseId: 'TC-191'
      },
      {
        title: '指数接口',
        android: 'getTop20Prediction 不带 darkType。',
        ios: '同一条接口带 darkType，深色是 1，浅色是 0。',
        androidCaseId: 'TC-190',
        iosCaseId: 'TC-192'
      },
      {
        title: '第 21 名前面的分隔',
        android: '分隔线画在第 21 条选手这一行上，这一行仍占一个名次。',
        ios: '单独插一条分隔。分隔后面的名次把这一行减掉，不占名次。',
        androidCaseId: 'TC-190',
        iosCaseId: 'TC-192'
      },
      {
        title: '点选手',
        android: '打开原生 CS 选手详情。',
        ios: '打开网页 /v3/csgo-event.html#/player。指数和历年在没有 hltvId 时用 playerId。累计、连续、首次年龄在没有 hltvId 时，地址里的 playerId 写成了 0。',
        androidCaseId: 'TC-191',
        iosCaseId: 'TC-193'
      },
      {
        title: '点战队图标',
        android: '打开原生 CS 战队页。深色仍用普通队标。',
        ios: '打开网页 /v3/csgo-event.html#/team?hltvTeamId=。深色换成黑色队标。',
        androidCaseId: 'TC-192',
        iosCaseId: 'TC-194'
      },
      {
        title: '没登录点表态',
        android: '有表态数据就先弹出四个选项，点选项才去登录。没有数据则点了没反应。',
        ios: '没登录直接去登录，气泡先不出来。没有表态数据时点了也去登录。',
        androidCaseId: 'TC-195',
        iosCaseId: 'TC-197'
      },
      {
        title: '表态成功后的人数',
        android: '选中项加 1，另外三项各减 1。',
        ios: '只给选中项加 1，另外三项人数不动。',
        androidCaseId: 'TC-194',
        iosCaseId: 'TC-196'
      },
      {
        title: '历年战队图标',
        android: '最多 4 个。',
        ios: '接口返回几个就显示几个。',
        androidCaseId: 'TC-196',
        iosCaseId: 'TC-198'
      },
      {
        title: '累计第一条',
        android: '第一条默认展开，没有荣誉也展开。',
        ios: '第一条有荣誉才展开。',
        androidCaseId: 'TC-197',
        iosCaseId: 'TC-199'
      },
      {
        title: '连续第一条',
        android: '第一条不自动展开。',
        ios: '第一条有荣誉就展开。',
        androidCaseId: 'TC-198',
        iosCaseId: 'TC-200'
      },
      {
        title: '首次入选年龄翻页',
        android: '上拉无效，只有第一页 20 条。',
        ios: '可以上拉，每页 20 条。',
        androidCaseId: 'TC-200',
        iosCaseId: 'TC-202'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: 'Top20选手',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/top/player/getTop20Prediction',
        params: 'darkType',
        summary: '今年 TOP 指数。深色 darkType=1，浅色 darkType=0。超过 20 人时在第 20 条后面插一条分隔。',
        points: ['失败会提示服务端文案', '登录成功会重拉']
      },
      {
        method: 'POST',
        path: '/eventcenter/app/cs/hltv/top/player/voice',
        params: 'hltvId&type',
        summary: '表态。没登录点表态直接去登录。',
        points: ['成功只给选中项加 1']
      }
    ],
    issues: [
      {
        title: '三个榜在没有 hltvId 时，选手地址里的 playerId 是 0',
        trigger: '累计入选、连续入选、首次入选年龄里，点一个 hltvId 为 0 的选手。',
        actual: '网页地址写成 playerId=0，没有带真正的 playerId。指数和历年这两页没有这个问题。',
        caseId: 'TC-199'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '完美评分',
    apis: [
      {
        method: 'GET',
        path: '/acty/rating/getThemeListV2',
        params: 'gameType&sort&tagId=0&pageNum&pageSize=4',
        summary: '发现点进来的评分列表。sort 1 默认、2 最热、3 最新。gameType 跟金刚位地址里的 gameTypeStr，没带就是 0 全部。',
        points: ['一张卡片最多露出 3 个评分对象', '评分人数小于 3 时，标题旁的人数隐藏，对象分数显示「--」']
      }
    ],
    issues: [
      {
        title: '上拉到空页之后，下一页页码多跳了一页',
        trigger: '列表上拉，这一页接口返回空列表。',
        actual: '页码照样加 1。再上拉会请求更后面的页，中间那一页被跳过。',
        caseId: 'TC-206'
      }
    ],
    diffs: [
      {
        title: '一张卡片露出几个评分对象',
        android: '最多 3 个，多出来的要进专题才看得到。',
        ios: '接口返回几个就列几个。',
        androidCaseId: 'TC-202',
        iosCaseId: 'TC-204'
      },
      {
        title: '点赛后选手这张整卡',
        android: '打开比赛详情，并停在评论。',
        ios: '打开评分专题页。',
        androidCaseId: 'TC-205',
        iosCaseId: 'TC-207'
      },
      {
        title: '没审核通过时点评分对象',
        android: '不进对象详情，按点整张卡片处理。',
        ios: '照样按对象类型打开详情。',
        androidCaseId: 'TC-204',
        iosCaseId: 'TC-206'
      },
      {
        title: '右下角发布按钮',
        android: '社区配置里有 rating，并且发帖开关开着，才显示。没登录点了去登录。',
        ios: '首页分页配置是空的就一直显示。配置不为空时，只看发帖开关 postSwitch，评分开关的判断被盖掉了。',
        androidCaseId: 'TC-208',
        iosCaseId: 'TC-210'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '完美评分',
    apis: [
      {
        method: 'GET',
        path: '/acty/rating/getThemeListV2',
        params: 'gameType&sort&tagId=0&pageNum&pageSize=4',
        summary: '发现点进来的评分列表。三个页签是默认、最热、最新，对应 sort 1、2、3。',
        points: ['卡片把评分对象全部列出来']
      }
    ],
    issues: [
      {
        title: '发布按钮不看评分开关',
        trigger: '首页分页配置不为空，里面没有 rating，但发帖开关 postSwitch 是开的。',
        actual: '右下角发布按钮仍然显示。代码先判断了 rating，随即被发帖开关盖掉。配置是空的时候，按钮直接显示。',
        caseId: 'TC-210'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '外设排行',
    apis: [],
    issues: [],
    diffs: [
      {
        title: '未登录点金刚位',
        android: '本地默认要求登录，没登录去登录页。',
        ios: '本地默认不要求登录，直接打开外设排行网页。',
        androidCaseId: 'TC-209',
        iosCaseId: 'TC-211'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '外设排行',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/playersRankList',
        params: 'type=3&darkType',
        summary: '顶部选手，只取前 9 个。',
        points: []
      },
      {
        method: 'GET',
        path: '/mallCenter/proset/rank',
        params: 'position&prosetType',
        summary: '外设排行。position 0 全部选手、1 狙击手、2 步枪手。',
        points: ['空列表显示「暂无数据」', '价格除以 100，保留两位小数']
      }
    ],
    issues: [
      {
        title: '版本低于 3.2.4 时整页不请求',
        trigger: '用低于 302.04 的包打开外设排行。',
        actual: '弹出「温馨提示 / app版本过低，请升级」，点确认后退回，选手和排行都不请求。',
        caseId: 'TC-060'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '周边商城',
    apis: [],
    issues: [],
    diffs: [
      {
        title: '未登录点金刚位',
        android: '本地默认不要求登录，直接打开商城。地址带 tab=csgo。',
        ios: 'CS 发现本地默认要求登录。地址同样带 tab=csgo。',
        androidCaseId: 'TC-210',
        iosCaseId: 'TC-212'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '周边商城',
    apis: [
      {
        method: 'GET',
        path: '/mall/product/getBannerList',
        params: '',
        summary: '首页轮播，3 秒一张。',
        points: ['只有 type 为 1 的轮播能进商品详情']
      },
      {
        method: 'GET',
        path: '/mall/product/selectByGameType',
        params: 'gameType',
        summary: '最新上架。CS 是 gameType=2，刀塔是 1。价格除以 100。',
        points: ['没有商品时这一块不出现，没有空文案']
      }
    ],
    issues: [
      {
        title: '轮播不是商品类型时点了没反应',
        trigger: '点一张 type 不是 1 的轮播。',
        actual: '跳转方法只处理 type 为 1，其它类型不打开页面。',
        caseId: 'TC-063'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '玩家秀',
    apis: [
      {
        method: 'GET',
        path: '/acty/playerShow/pageQuery',
        params: 'sortType&pageNum&pageSize=20',
        summary: '玩家秀列表。精选 0、最热 1、最新 2。',
        points: ['空列表显示「暂无玩家秀，快来上传吧」']
      }
    ],
    issues: [
      {
        title: '版本低于 3.0.13 时打不开列表',
        trigger: '用低于 301 的包打开玩家秀。',
        actual: '弹出「温馨提示 / app版本过低，请升级」，确认后退出，列表不加载。',
        caseId: 'TC-065'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: 'ROLL房',
    apis: [],
    issues: [],
    diffs: [
      {
        title: '默认地址',
        android: 'act-roll.html，没有 #/。',
        ios: 'act-roll.html#/。',
        androidCaseId: 'TC-212',
        iosCaseId: 'TC-214'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: 'ROLL房',
    apis: [
      {
        method: 'GET',
        path: '/app/roll/list',
        params: 'pageNum&pageSize=20&status=5&type=1&orderType=1',
        summary: '抽奖专区列表。App 里每页 20 条，默认进行中。',
        points: ['空列表显示「暂无内容」', '拉完显示「已显示全部」']
      },
      {
        method: 'GET',
        path: '/app/roll/checkout',
        params: 'token',
        summary: '点创建前的检查。',
        points: ['没登录提示「登录后才能创建或参与Roll房哦」']
      }
    ],
    issues: [
      {
        title: '连续两次参与人数过少会冻结创建',
        trigger: 'checkout 返回 600045 后再点创建。',
        actual: '弹出「Roll房权限冻结」，并倒计时距离结束时间。',
        caseId: 'TC-070'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '组队开黑',
    apis: [
      {
        method: 'GET',
        path: '/card/party/list',
        params: 'pageNum&pageSize=20&gender&onlineType',
        summary: '开黑卡片。性别默认 -1 不限。',
        points: ['筛选没结果时提示「筛选结果有点少，下面为你推荐其他玩家」']
      }
    ],
    issues: [],
    diffs: [
      {
        title: '我的卡片开关没下发时',
        android: '开关缺省当成开，可以进我的卡片。',
        ios: '只有配置成 1 才能进。没下发或不是 1，点了提示「因技术升级，暂不提供查看修改服务」。',
        androidCaseId: 'TC-214',
        iosCaseId: 'TC-216'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '组队开黑',
    apis: [],
    issues: [
      {
        title: '开黑卡片开关没配成 1 时不能进我的卡片',
        trigger: '配置里没有 cardSwitch，或 cardSwitch 不是 1，点「我的卡片」。',
        actual: '提示「因技术升级，暂不提供查看修改服务」，不进卡片页。',
        caseId: 'TC-216'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '赛事',
    subModule: '赛程',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/matchs',
        summary: 'CS 赛事默认停在赛程。这个 tab 是网页，地址是 csgo-event.html#/matchs。网页进来会关掉原生下拉。',
        points: ['列表、日期、日历都在网页里', '点比赛走 pwesports://open/openEventDetailPage']
      }
    ],
    issues: [
      {
        title: '没登录点订阅时，提示文案不会出现',
        trigger: '赛程里找一场未开始的职业赛，退出登录后点「订阅」。',
        actual: '直接去登录页。网页传入的「你还没登录，不能设置比赛提醒哦」不会弹出来。',
        caseId: 'TC-219'
      }
    ],
    diffs: [
      {
        title: '没登录点订阅',
        android: '去登录页，不展示「你还没登录，不能设置比赛提醒哦」。',
        ios: '走一键登录，同样不展示这句提示。',
        androidCaseId: 'TC-219',
        iosCaseId: 'TC-221'
      },
      {
        title: '订阅成功后通知没开',
        android: '弹出「开启推送通知」。点「立即开启」走推送组件去开通知。',
        ios: '同样的标题和正文。点「立即开启」打开系统设置。点弹窗外面关不掉。',
        androidCaseId: 'TC-219',
        iosCaseId: 'TC-221'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '赛事',
    subModule: '赛程',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/matchs',
        summary: 'CS 赛事第一项是赛程，网页容器没有导航栏，也没有打开原生下拉。',
        points: ['旁边的「赛事」tab 才有原生下拉，弱网时会整页重载', '赛程不走这条']
      }
    ],
    issues: [
      {
        title: '没登录点订阅时，提示文案不会出现',
        trigger: '赛程里找一场未开始的职业赛，退出登录后点「订阅」。',
        actual: '走一键登录。网页传入的「你还没登录，不能设置比赛提醒哦」不会弹出来。',
        caseId: 'TC-221'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '赛事',
    subModule: '赛程',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/csgo/event/getMatchCountByPeriod',
        params: 'startTime&endTime',
        summary: '日期条。以选中日为中心，向前 12 天、向后 21 天。今天、日历选中日，或场次大于 0 的日期才会出现。',
        points: ['失败时整页显示「暂无比赛」']
      },
      {
        method: 'GET',
        path: '/eventcenter/app/csgo/event/getMatchList',
        params: 'matchTime=yyyy-MM-dd 00:00:00',
        summary: '当天比赛。completedStatus 为 1、2、3、4 的场次不展示。',
        points: ['失败且这一天还没加载过时，转圈不停止']
      },
      {
        method: 'POST',
        path: '/eventcenter/app/match/getUserEventSubscription',
        params: 'matchIds',
        summary: '当天有比赛时补订阅状态。'
      },
      {
        method: 'GET',
        path: '/steamcn/video/checkHasHighLight',
        params: 'matchIdStr',
        summary: '已结束的比赛是否显示「高光」。'
      },
      {
        method: 'POST',
        path: '/steamcn/app/csgo/event/new/subscribeMatch',
        params: 'matchId&status&gameType=2',
        summary: '订阅或取消。status 1 订阅，2 取消。'
      },
      {
        method: 'GET',
        path: '/eventcenter/app/event/calender/range',
        params: 'gameType=2',
        summary: '日历可选年月范围。'
      },
      {
        method: 'GET',
        path: '/eventcenter/app/event/calender/eventList',
        params: 'gameType=2&startDate=yyyy-MM',
        summary: '日历当月、上月、下月的赛事。'
      },
      {
        method: 'GET',
        path: '/acty/rating/getSubjectByAttributeIds',
        params: 'attributeIds&attributeType=13',
        summary: 'T1 或 Major 且 ratingClosed 为 true 时，拉赛事评分。'
      }
    ],
    issues: [
      {
        title: '当天比赛接口失败后一直转圈',
        trigger: '让 getMatchList 失败，而且这一天之前没加载成功过。',
        actual: '列表停在转圈，没有失败文案，下拉也要等新的请求成功才会换掉。',
        caseId: 'TC-077'
      },
      {
        title: '日期接口失败被写成暂无比赛',
        trigger: '让 getMatchCountByPeriod 失败。',
        actual: '整页显示「暂无比赛」，没有重试。',
        caseId: 'TC-071'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '赛事',
    subModule: '赛事详情',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/event/{id}',
        summary: '从赛程点赛事名打开。标题栏用赛事名，右上角可分享。页内 tab 是网页。',
        points: ['分享标题是赛事名加「赛事战报」', '副标题「更多精彩CS赛事尽在完美世界电竞App」']
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '赛事',
    subModule: '赛事详情',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/event/{id}',
        summary: '从赛程点赛事名打开。标题栏和分享与安卓同一套网页参数。',
        points: ['页内 tab 仍是网页']
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '赛事',
    subModule: '赛事列表',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/events',
        summary: '赛事 tab。热门赛事是近期、往期里的筛选项，不是详情页上的 tab。',
        points: ['网页会关掉原生下拉']
      }
    ],
    issues: [],
    diffs: [
      {
        title: '赛事 tab 的地址和下拉',
        android: '地址是 csgo-event.html#/events。网页关掉原生下拉。',
        ios: '地址是 csgo-event.html#/events-new，打开的是同一页。这个 tab 有原生下拉，弱网时下拉会整页重载。',
        androidCaseId: 'TC-221',
        iosCaseId: 'TC-223'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '赛事',
    subModule: '赛事列表',
    apis: [
      {
        method: 'GET',
        path: '/csgo-event.html#/events-new',
        summary: '赛事 tab 打开近期、往期和热门赛事筛选。容器打开了原生下拉。',
        points: ['弱网下拉会整页重新加载']
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-h5',
    module: '赛事',
    subModule: '赛事详情',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/csgo/event/getEventDetail',
        params: 'eventId',
        summary: '职业赛详情。地址没带 type 时按职业赛。',
        points: ['失败后页面是空的，不显示「赛事不存在」']
      },
      {
        method: 'GET',
        path: '/eventcenter/app/csgo/event/getMatchList',
        params: 'eventId',
        summary: '详情里的赛程。赛事已结束时默认停在「已结束」。',
        points: ['失败时这一页显示「赛事不存在」']
      },
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/match/schedule/stage',
        params: '赛事阶段',
        summary: '对阵。没有数据时职业赛显示「对阵信息更新中」，完美平台赛事显示「施工中,敬请期待」。'
      },
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/eventCensusData',
        params: 'matchId=赛事id&darkType',
        summary: '职业赛数据。选手、战队、地图、趣味数据。'
      }
    ],
    issues: [
      {
        title: '赛事详情接口失败后是空白页',
        trigger: '职业赛让 getEventDetail 失败。',
        actual: '转圈消失，不显示「赛事不存在」，概览也没有内容。',
        caseId: 'TC-078'
      },
      {
        title: '详情里的赛程接口失败会写成赛事不存在',
        trigger: '概览已经打开，再让赛程的 getMatchList 失败。',
        actual: '赛程 tab 显示「赛事不存在」。',
        caseId: 'TC-080'
      }
    ]
  },
  {
    category: 'wmpvp-h5',
    module: '赛事',
    subModule: '赛事列表',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/getEventList',
        params: 'pageNum&pageSize=10&type&eventSubType&teamId',
        summary: '近期 type=1，往期 type=2。热门赛事是 eventSubType=5。',
        points: ['没有数据时「近期暂无赛事」', '失败时「请求失败，点击重新加载」']
      }
    ],
    issues: [
      {
        title: '浏览器里点赛事卡片不会进详情',
        trigger: '不用 App，在浏览器打开赛事列表，点一张卡片。',
        actual: '提示「请打开APP查看~」。',
        caseId: 'TC-084'
      },
      {
        title: '赛事库某一段没有数据时，加载可能停住',
        trigger: '赛事库向下翻，某一段 card/detail 返回空数组。',
        actual: '这次加载的转圈不一定会停，下一段也不会继续。',
        caseId: 'TC-085'
      },
      {
        title: '浏览器里点完美平台赛事没有反应',
        trigger: '不用 App，打开完美平台，点一张赛事。',
        actual: '不会打开地址，也没有提示。',
        caseId: 'TC-086'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '赛事',
    subModule: '战队',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/cs/valve/team/rank',
        params: 'type&page&pageSize=30',
        summary: 'VALVE积分。type 0 全球、1 欧洲、3 亚洲、2 美洲。可以上拉。',
        points: ['第一名默认展开阵容，最多 5 名选手']
      },
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/teamsRankList',
        params: 'searchType&id',
        summary: 'HLTV 是 searchType=0，人气是 searchType=1。人气固定 id=-1，不显示地区筛选。',
        points: ['这两种不能上拉']
      },
      {
        method: 'GET',
        path: '/appuser/community/user/getUserSupportTeamAndTaskStatus',
        summary: '顶部主队。不是 CS 主队时当成没设置。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '主队不是 CS',
        android: '当成没设置，显示「前往设置」。点进去是设置主队。',
        ios: '仍显示这支队和已关注天数。点进去打开刀塔战队页。',
        androidCaseId: 'TC-224',
        iosCaseId: 'TC-226'
      },
      {
        title: '列表请求失败',
        android: '提示接口返回的文案。',
        ios: '转圈停掉，不提示。',
        androidCaseId: 'TC-223',
        iosCaseId: 'TC-225'
      },
      {
        title: 'VALVE 阵容里的选手',
        android: '最多展示 5 人。没有选手时箭头点不开。没有 hltvId 时用 namiId 打开选手页。两个 id 都没有则不跳。',
        ios: '展示接口返回的全部选手，没有选手也能展开一条空区域。没有 hltvId 时点选手不跳。',
        androidCaseId: 'TC-223',
        iosCaseId: 'TC-225'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '赛事',
    subModule: '战队',
    apis: [
      {
        method: 'GET',
        path: '/eventcenter/app/cs/valve/team/rank',
        params: 'type&page&pageSize=30',
        summary: 'VALVE积分，可以上拉。第一名默认展开。'
      },
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/teamsRankList',
        params: 'searchType&id',
        summary: 'HLTV searchType=0，人气 searchType=1。人气不显示地区。'
      },
      {
        method: 'GET',
        path: '/appuser/community/user/getUserSupportTeamAndTaskStatus',
        params: 'darkType',
        summary: '顶部主队。刀塔主队也会显示。'
      }
    ],
    issues: [
      {
        title: '战队列表失败没有提示',
        trigger: '让 VALVE、HLTV 或人气接口失败。',
        actual: '转圈消失，没有失败文案。原来的列表还在。',
        caseId: 'TC-225'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '赛事',
    subModule: '选手',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/playersRankList',
        params: 'searchType&type&pageNum&pageSize=30',
        summary: 'Rating 是 searchType=0，人气是 searchType=1。Rating 默认最近一年，不能上拉。人气固定 type=1，可以上拉。',
        points: ['名次按列表位置，不是接口里的 rank']
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/attribute/player/rank',
        params: 'type&page&pageSize=30',
        summary: 'HLTV属性。1 火力到 7 道具。可以上拉。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '分数是 0',
        android: 'Rating 和 HLTV 分数显示 0。',
        ios: '显示 --。',
        androidCaseId: 'TC-226',
        iosCaseId: 'TC-228'
      },
      {
        title: '选手列表失败',
        android: '提示接口文案。',
        ios: '转圈停掉，不提示。',
        androidCaseId: 'TC-226',
        iosCaseId: 'TC-228'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '赛事',
    subModule: '选手',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/event/new/playersRankList',
        params: 'searchType&type&pageNum&pageSize=30',
        summary: 'Rating 不带分页。人气带 pageSize=30，可以上拉。'
      },
      {
        method: 'GET',
        path: '/eventcenter/app/cs/hltv/attribute/player/rank',
        params: 'type&page&pageSize=30',
        summary: 'HLTV属性，可以上拉。'
      }
    ],
    issues: [
      {
        title: '选手列表失败没有提示',
        trigger: '让 Rating、人气或 HLTV 属性接口失败。',
        actual: '转圈消失，没有失败文案。',
        caseId: 'TC-228'
      }
    ]
  },
  {
    category: 'wmpvp-android',
    module: '关注',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getFollowMoments',
        params: 'token&pageNum&pageSize=20',
        summary: '关注动态。没登录也能请求。空列表「空空的什么都没有」。'
      },
      {
        method: 'GET',
        path: '/acty/community/follow/getNewRecommendList',
        summary: '没关注任何人时，头部是「精选关注」。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '关注按钮文案',
        android: '「+ 关注」，中间有空格。成功不另外提示。',
        ios: '「+关注」，没有空格。成功提示「关注成功」，取消提示「取消成功」。没登录提示「登录后才能进行关注操作哟~」。',
        androidCaseId: 'TC-227',
        iosCaseId: 'TC-229'
      },
      {
        title: '点动态里的昵称',
        android: '直接进个人主页。',
        ios: '没登录先去登录。',
        androidCaseId: 'TC-228',
        iosCaseId: 'TC-230'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '关注',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getFollowMoments',
        params: 'token&pageNum&pageSize=20',
        summary: '关注动态。空列表「空空的什么都没有」。拉完显示「没有更多数据了」。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '广场',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getSquareMoments/v2',
        params: 'pageNum&pageSize=20',
        summary: '广场动态。拉完底部是「没有更多内容了，去圈子看看吧」。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '广场拉到底',
        android: '「没有更多内容了，去圈子看看吧」。',
        ios: '「没有更多数据了」。',
        androidCaseId: 'TC-230',
        iosCaseId: 'TC-232'
      },
      {
        title: '推荐圈子弹窗标题',
        android: '「已根据你的爱好精选下方圈子」。',
        ios: '「已根据你的爱好精选以下圈子」。',
        androidCaseId: 'TC-229',
        iosCaseId: 'TC-231'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '广场',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getSquareMoments/v2',
        params: 'pageNum&pageSize=20',
        summary: '广场动态。超过 3 小时再进入会自动刷新。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '热榜',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getHotPosts',
        summary: '热帖。不能上拉。离开超过 10 分钟再回来会刷新。'
      },
      {
        method: 'GET',
        path: '/acty/meme/getHotMemes',
        params: 'size=100',
        summary: '热梗。'
      },
      {
        method: 'GET',
        path: '/acty/community/moments/getHotComments',
        params: 'gameType',
        summary: '热评。gameType 跟当前感兴趣的游戏。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '热榜左右滑',
        android: '热帖、热梗、热评可以横滑。',
        ios: '不能横滑，只能点 tab。',
        androidCaseId: 'TC-231',
        iosCaseId: 'TC-233'
      },
      {
        title: '热评点赞没登录',
        android: '去登录页。',
        ios: '提示「你还没登录，不能点赞哟~o(≧v≦)o」。',
        androidCaseId: 'TC-232',
        iosCaseId: 'TC-234'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '热榜',
    apis: [
      {
        method: 'GET',
        path: '/acty/community/moments/getHotComments',
        params: 'gameType&darkType',
        summary: '热评会多带 darkType。热帖超过 10 分钟会刷新，热梗和热评不会。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '社区评分',
    apis: [
      {
        method: 'GET',
        path: '/acty/rating/getRatingTags',
        summary: '顶部分类。失败时只剩「全部」。'
      },
      {
        method: 'GET',
        path: '/acty/rating/getThemeListV2',
        params: 'gameType&sort&tagId&pageNum&pageSize=4',
        summary: '专题列表。游戏筛选文案是「全部想看」。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '游戏筛选第一项',
        android: '「全部想看」。',
        ios: '「全部都看」。',
        androidCaseId: 'TC-233',
        iosCaseId: 'TC-235'
      },
      {
        title: '评分开关关着',
        android: '配置没开时，社区顶部没有完美评分。',
        ios: '配置里没有 rating 这一项时不出现。',
        androidCaseId: 'TC-233',
        iosCaseId: 'TC-235'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '社区评分',
    apis: [
      {
        method: 'GET',
        path: '/acty/rating/getThemeListV2',
        params: 'gameType&sort&tagId&pageNum&pageSize=4',
        summary: '社区完美评分。游戏筛选是「全部都看 / 只看CS / 只看DOTA2」。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '梗百科',
    apis: [
      {
        method: 'GET',
        path: '/acty/meme/getSquareMemeList',
        params: 'sort&pageNum&pageSize',
        summary: '全部内容。sort 2 最新回复、1 最新发布、3 热门内容。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '发表入口',
        android: '发布开关关着时没有按钮。开着时先登录，再进写梗。',
        ios: '按钮一直在。没登录提示「您还没有登录,不能使用该功能哦~」，然后去登录。登录后直接进写梗。',
        androidCaseId: 'TC-236',
        iosCaseId: 'TC-238'
      },
      {
        title: '热梗点赞',
        android: '不检查登录，直接点赞。',
        ios: '没登录直接去登录。',
        androidCaseId: 'TC-236',
        iosCaseId: 'TC-238'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '梗百科',
    apis: [
      {
        method: 'GET',
        path: '/acty/meme/getSquareMemeList',
        params: 'sort&pageNum&pageSize',
        summary: '社区梗百科和安卓同一套列表。底部「有梗」是另一页，不在这组用例里。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '数据',
    subModule: '切页',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/stats',
        summary: '官匹和完美平台是两套数据。点 tab 切换，不能横滑。主页会记住上次停的平台。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '未授权文案',
        android: '官匹未授权显示「点击授权查看官匹竞技战绩」。在数据首页一周最多弹一次授权。',
        ios: '显示「点击授权查看CS战绩」。',
        androidCaseId: 'TC-238',
        iosCaseId: 'TC-240'
      },
      {
        title: '比赛列表失败',
        android: '空态用接口返回的文案。',
        ios: '固定「网络加载失败，请稍后重试」。',
        androidCaseId: 'TC-241',
        iosCaseId: 'TC-243'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '数据',
    subModule: '切页',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/app/csgo/stats',
        summary: '点「官匹竞技」或「完美平台」切换。自己的数据页会记住上次平台。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '数据',
    subModule: '官匹竞技',
    apis: [
      {
        method: 'GET',
        path: '/appdatacenter/csgo/official/stats',
        summary: '官匹头部、雷达、网格。场次少于 11 场时雷达是空的，评定是「你还未取得最佳成绩，暂无评定」。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '数据',
    subModule: '官匹竞技',
    apis: [
      {
        method: 'GET',
        path: '/appdatacenter/csgo/official/stats',
        summary: '官匹多出雷达、网格、好友 ID 和授权条。未授权才插入授权卡片。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '数据',
    subModule: '完美平台',
    apis: [
      {
        method: 'GET',
        path: '/appdatacenter/csgo/pwa/stats',
        params: 'csgoSeasonId',
        summary: '完美平台段位、Rating Pro、WE、生涯图。比赛默认「近期比赛」。S18、S19 用旧的天梯单排、组排筛选。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '数据',
    subModule: '完美平台',
    apis: [
      {
        method: 'GET',
        path: '/appdatacenter/csgo/pwa/stats',
        params: 'csgoSeasonId',
        summary: '赛季开始时间是 2024-11-08 16:00:00 或 2025-02-14 16:00:00 时，用天梯单排、天梯组排。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '我的',
    subModule: '进入',
    apis: [
      {
        method: 'GET',
        path: '/user/basicInfo',
        summary: '个人主页。未登录点底部「我的」不会切过去，直接去登录。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '没登录点我的',
        android: '停在当前 tab，直接去登录页。',
        ios: '会切到「我的」，同时弹出登录。页面上是「你还未登录」「登录注册解锁更多功能」「立即登录」。',
        androidCaseId: 'TC-242',
        iosCaseId: 'TC-244'
      },
      {
        title: '已注销文案',
        android: '「该用户已注销」。',
        ios: '「该用户已注销，无法查看TA的数据和内容」。',
        androidCaseId: 'TC-244',
        iosCaseId: 'TC-246'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '我的',
    subModule: '进入',
    apis: [
      {
        method: 'GET',
        path: '/user/basicInfo',
        summary: '没登录时「我的」页盖着登录提示。登录成功后提示消失并拉自己的资料。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '我的',
    subModule: '头部',
    apis: [
      {
        method: 'GET',
        path: '/user/gameCard',
        summary: '没绑 Steam 显示去绑定。绑了显示 Steam 卡片和游戏数据。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '我的',
    subModule: '头部',
    apis: [
      {
        method: 'GET',
        path: '/user/gameCard',
        summary: 'Steam 信息失败时卡片区保持矮高度，不把已有卡片撑高。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '我的',
    subModule: '内容',
    apis: [
      {
        method: 'GET',
        path: '/v3/community-list.html',
        params: 'userId',
        summary: '动态。评论 type=2，梗词条 type=7，完美时刻 type=3，留言 type=5。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '我的',
    subModule: '内容',
    apis: [
      {
        method: 'GET',
        path: '/community-list.html',
        params: 'userId&type',
        summary: '五个 tab 和安卓同一套 type。写留言按钮只在留言 tab 出现。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '发现',
    subModule: 'DOTA2',
    apis: [
      {
        method: 'GET',
        path: '/appengine/config',
        summary: 'DOTA2 金刚位用 buttonConfigs.dotaButton。内容 tab 用 topPaginationDotaConfigs。没配置时本地是资讯、视频、活动。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '没配置时的内容 tab',
        android: '资讯、视频、活动。',
        ios: '资讯、活动、视频。',
        androidCaseId: 'TC-245',
        iosCaseId: 'TC-247'
      },
      {
        title: '周边商城兜底地址',
        android: 'memberMall.html#/home/index。',
        ios: 'memberMall.html。',
        androidCaseId: 'TC-251',
        iosCaseId: 'TC-253'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '发现',
    subModule: 'DOTA2',
    apis: [
      {
        method: 'GET',
        path: '/appengine/config',
        summary: '兴趣里有 DOTA2 才出现 DOTA2。DEADLOCK 始终在后面。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '发现',
    subModule: 'DOTA2资讯',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=1&pageNum&pageSize=20',
        summary: 'DOTA2 资讯。顶部推广条和 CS 是同一套轮播，游戏类型是 1。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-ios',
    module: '发现',
    subModule: 'DOTA2资讯',
    apis: [
      {
        method: 'GET',
        path: '/steamcn/community/homepage/getHomeInformationV5',
        params: 'gameTypeStr=1',
        summary: 'DOTA2 资讯。轮播间隔仍是 4 秒。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-h5',
    module: '英雄资料',
    apis: [
      {
        method: 'GET',
        path: '/dota2-heros.html',
        summary: '英雄、位置、段位、7/14/30 天。宫格或列表会记住。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-h5',
    module: '物品资料',
    apis: [
      {
        method: 'GET',
        path: '/dota2-items.html',
        summary: '基础物品、升级物品、中立物品。中立物品带等级附魔。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-h5',
    module: '开黑记录',
    apis: [
      {
        method: 'GET',
        path: '/dota2-rank.html',
        params: 'type=Party',
        summary: '好友、胜率、胜场、总场次。空列表是「暂无榜单信息」。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-h5',
    module: '发现',
    subModule: 'DOTA2攻略',
    apis: [
      {
        method: 'GET',
        path: '/dota2-heros-formula.html',
        summary: '标题是攻略公式。上面是版本答案，下面是英雄公式。'
      }
    ],
    issues: []
  },
  {
    category: 'wmpvp-android',
    module: '侧边栏',
    apis: [
      {
        method: 'GET',
        path: '/appengine/config',
        params: 'sidebarCommonButton&sidebarMoreButton',
        summary: '有配置用配置。没有时常用是收藏、资产、消息、装扮；更多里扫一扫和设置不要求登录。'
      }
    ],
    issues: [],
    diffs: [
      {
        title: '扫一扫和设置要不要登录',
        android: '用配置时跟配置。没配置时扫一扫和设置都能直接进。',
        ios: '用配置时跟配置。没配置时扫一扫和设置都要先登录。',
        androidCaseId: 'TC-259',
        iosCaseId: 'TC-261'
      },
      {
        title: '外观切换',
        android: '侧栏有外观按钮，可选浅色模式、暗夜模式。Android 10 及以上还有跟随系统。',
        ios: '侧栏没有这个按钮。',
        androidCaseId: 'TC-257',
        iosCaseId: 'TC-259'
      }
    ]
  },
  {
    category: 'wmpvp-ios',
    module: '侧边栏',
    apis: [
      {
        method: 'GET',
        path: '/appengine/config',
        params: 'sidebarCommonButton&sidebarMoreButton',
        summary: '没配置时常用多一项创作者中心。补给箱只在开关打开且是会员时保留。'
      }
    ],
    issues: []
  }
]

export function briefsForGroup(category: string, module: string, subModules: string[]): CaseModuleBrief[] {
  const subs = new Set(subModules.map((s) => s.trim()).filter(Boolean))
  return CASE_MODULE_BRIEFS.filter((b) => {
    if (b.category !== category || b.module !== module) return false
    if (!b.subModule) return true
    return subs.size === 0 || subs.has(b.subModule)
  })
}

/** 安卓 / iOS 差异不跟当前套件走，同一模块两边都能点开。 */
export function diffsForModule(module: string, subModules: string[]): CaseDiffBrief[] {
  const subs = new Set(subModules.map((s) => s.trim()).filter(Boolean))
  const seen = new Set<string>()
  const out: CaseDiffBrief[] = []
  for (const b of CASE_MODULE_BRIEFS) {
    if (b.module !== module || !b.diffs?.length) continue
    if (b.subModule && subs.size > 0 && !subs.has(b.subModule)) continue
    for (const d of b.diffs) {
      if (seen.has(d.title)) continue
      seen.add(d.title)
      out.push(d)
    }
  }
  return out
}
