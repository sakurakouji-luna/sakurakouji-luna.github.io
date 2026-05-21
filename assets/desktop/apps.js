(function () {
  const local = (path) => new URL(path, window.location.href).href;
  const icon = (name) => `https://cdn.jsdelivr.net/gh/sakurakouji-luna/pic@main/web/icon/${name}`;

  const APP_REGISTRY = [
    {
      id: "terminal",
      title: "Terminal",
      appType: "terminal",
      aliases: ["shell", "console", "term", "default"],
      singleton: true,
      icon: ">_",
      kind: "terminal"
    },
    {
      id: "blog",
      title: "Blog",
      appType: "browser",
      aliases: ["notes", "随想", "日志", "tsuki"],
      singleton: true,
      icon: icon("blog.png"),
      kind: "iframe",
      iframeUrl: local("./blog/index.html")
    },
    {
      id: "bio",
      title: "Bio",
      appType: "browser",
      aliases: ["biology", "生物", "course"],
      singleton: true,
      icon: icon("bio.png"),
      kind: "iframe",
      iframeUrl: local("./bio/index.html")
    },
    {
      id: "radio",
      title: "Radio BD8AFN",
      appType: "browser",
      aliases: ["qrz", "ham", "bd8afn", "radio"],
      singleton: true,
      icon: icon("Analogue-Antenna.png"),
      kind: "iframe",
      iframeUrl: local("./radio/index.html")
    },
    {
      id: "steam",
      title: "Steam",
      appType: "browser",
      aliases: ["game", "profile", "slchy steam"],
      singleton: true,
      icon: icon("steam.png"),
      kind: "iframe",
      iframeUrl: "https://web.archive.org/web/20260521141008/https://steamcommunity.com/id/slchy/"
    },
    {
      id: "bangumi",
      title: "Bangumi",
      appType: "browser",
      aliases: ["anime", "番组", "bgm"],
      singleton: true,
      icon: icon("bangumi.png"),
      kind: "iframe",
      iframeUrl: "https://bangumi.tv/user/slchy"
    },
    {
      id: "bilibili",
      title: "Bilibili",
      appType: "browser",
      aliases: ["b站", "video", "space"],
      singleton: true,
      icon: icon("bilibili.png"),
      kind: "iframe",
      iframeUrl: "https://space.bilibili.com/103111730"
    },
    {
      id: "main-site",
      title: "Main Site",
      appType: "browser",
      aliases: ["slchy", "main", "homepage"],
      singleton: true,
      icon: "MS",
      kind: "iframe",
      iframeUrl: "https://slchy.com"
    },
    {
      id: "mail",
      title: "Mail",
      appType: "settings",
      aliases: ["email", "contact", "联系"],
      singleton: false,
      icon: icon("mail.png"),
      kind: "external",
      externalUrl: "mailto:213020167@scujcc.edu.cn"
    }
  ];

  window.DesktopApps = {
    APP_REGISTRY,
    DEFAULT_APP_ID: "terminal",
    getApp(appId) {
      return APP_REGISTRY.find((app) => app.id === appId) || APP_REGISTRY[0];
    }
  };
})();
