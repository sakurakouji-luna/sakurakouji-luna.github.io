(function () {
  const Apps = window.DesktopApps;
  const Tree = window.TilingTree;
  const WORKSPACE_COUNT = 9;
  const MIN_WINDOW_WIDTH = 180;
  const MIN_WINDOW_HEIGHT = 120;
  const SITE_HOST_ALIASES = new Set(["moe.st", "www.moe.st", "tsuki.su", "www.tsuki.su"]);
  const TERMINAL_OPEN_APP_IDS = new Set([
    "blog",
    "bio",
    "radio"
  ]);

  const state = {
    workspaces: {},
    workspaceFocus: {},
    currentWorkspace: 1,
    activeWindowId: null,
    nextSplitDirection: "horizontal",
    rofiOpen: false,
    rofiQuery: "",
    rofiSelectedIndex: 0
  };

  const elements = {};
  const windowElements = new Map();
  let shieldTimer = 0;
  let idCounter = 0;

  function setup() {
    for (let index = 1; index <= WORKSPACE_COUNT; index += 1) {
      state.workspaces[index] = null;
      state.workspaceFocus[index] = null;
    }

    elements.workspaceBar = document.getElementById("workspaceBar");
    elements.windowTitle = document.getElementById("windowTitle");
    elements.appsButton = document.getElementById("appsButton");
    elements.helpButton = document.getElementById("helpButton");
    elements.splitMode = document.getElementById("splitMode");
    elements.networkStatus = document.getElementById("networkStatus");
    elements.batteryStatus = document.getElementById("batteryStatus");
    elements.clock = document.getElementById("clock");
    elements.desktop = document.getElementById("desktop");
    elements.emptyState = document.getElementById("emptyState");
    elements.windowsLayer = document.getElementById("windowsLayer");
    elements.interactionShield = document.getElementById("interactionShield");
    elements.rofiOverlay = document.getElementById("rofiOverlay");
    elements.rofiInput = document.getElementById("rofiInput");
    elements.rofiList = document.getElementById("rofiList");
    elements.toastRegion = document.getElementById("toastRegion");

    bindEvents();
    startSystemStatus();
    render();
    launchApp(Apps.getApp(Apps.DEFAULT_APP_ID), { forceNew: true, silent: true });
  }

  function bindEvents() {
    window.addEventListener("keydown", handleGlobalKeydown, true);
    window.addEventListener("resize", render);
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    window.addEventListener("blur", () => {
      if (!state.rofiOpen) activateShield(700);
    });

    elements.workspaceBar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-workspace]");
      if (!button) return;
      switchWorkspace(Number(button.dataset.workspace));
    });
    elements.appsButton.addEventListener("click", openRofi);
    elements.helpButton.addEventListener("click", openHelpTerminal);

    elements.windowsLayer.addEventListener("mousedown", (event) => {
      const frame = event.target.closest(".window-frame");
      if (!frame) return;
      focusWindow(frame.dataset.windowId);
    });

    elements.windowsLayer.addEventListener("click", handleWindowClick);
    elements.windowsLayer.addEventListener("submit", handleWindowSubmit);

    elements.interactionShield.addEventListener("click", () => {
      deactivateShield();
      elements.desktop.focus();
    });

    elements.rofiOverlay.addEventListener("mousedown", (event) => {
      if (event.target === elements.rofiOverlay) closeRofi();
    });
    elements.rofiInput.addEventListener("input", () => {
      state.rofiQuery = elements.rofiInput.value;
      state.rofiSelectedIndex = 0;
      renderRofiList();
    });
    elements.rofiInput.addEventListener("keydown", handleRofiKeydown);
    elements.rofiList.addEventListener("click", (event) => {
      const row = event.target.closest("[data-rofi-index]");
      if (!row) return;
      state.rofiSelectedIndex = Number(row.dataset.rofiIndex);
      chooseRofiSelection();
    });
  }

  function startSystemStatus() {
    updateClock();
    setInterval(updateClock, 1000);
    updateNetworkStatus();
    setupBatteryStatus();
  }

  function updateClock() {
    const now = new Date();
    const value = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join("-") + " " + [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join(":");
    elements.clock.textContent = value;
    elements.clock.dateTime = now.toISOString();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function updateNetworkStatus() {
    const online = navigator.onLine;
    elements.networkStatus.textContent = online ? "Online" : "Offline";
    elements.networkStatus.classList.toggle("is-offline", !online);
  }

  function setupBatteryStatus() {
    if (!("getBattery" in navigator)) {
      elements.batteryStatus.textContent = "Battery --";
      return;
    }

    navigator.getBattery().then((battery) => {
      const renderBattery = () => {
        const level = Math.round(battery.level * 100);
        elements.batteryStatus.textContent = `${battery.charging ? "Charging" : "Battery"} ${level}%`;
        elements.batteryStatus.classList.toggle("is-warn", !battery.charging && level <= 20);
      };
      renderBattery();
      battery.addEventListener("levelchange", renderBattery);
      battery.addEventListener("chargingchange", renderBattery);
    }).catch(() => {
      elements.batteryStatus.textContent = "Battery --";
    });
  }

  function handleGlobalKeydown(event) {
    if (state.rofiOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRofi();
      }
      return;
    }

    if (!event.altKey) return;
    const key = event.key.toLowerCase();
    const workspaceNumber = /^[1-9]$/.test(key) ? Number(key) : 0;

    if (workspaceNumber) {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        moveActiveWindowToWorkspace(workspaceNumber);
      } else {
        switchWorkspace(workspaceNumber);
      }
      activateShield();
      return;
    }

    if (!event.shiftKey) return;

    const handled = {
      enter: () => launchApp(Apps.getApp("terminal"), { forceNew: true }),
      f: openRofi,
      q: () => killWindow(state.activeWindowId),
      g: () => setSplitDirection("horizontal"),
      v: () => setSplitDirection("vertical"),
      h: () => focusByDirection("left"),
      l: () => focusByDirection("right"),
      j: () => focusByDirection("down"),
      k: () => focusByDirection("up")
    }[key];

    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
    handled();
    activateShield();
  }

  function handleRofiKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveRofiCursor(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveRofiCursor(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseRofiSelection();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeRofi();
    }
  }

  function handleWindowClick(event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const frame = event.target.closest(".window-frame");
    const windowId = frame ? frame.dataset.windowId : "";

    if (action === "close-window") {
      event.preventDefault();
      killWindow(windowId);
    } else if (action === "launch-app") {
      event.preventDefault();
      launchApp(Apps.getApp(actionElement.dataset.appId));
    }
  }

  function handleWindowSubmit(event) {
    const form = event.target.closest("form[data-action]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.action === "terminal-form") {
      const frame = form.closest(".window-frame");
      const input = form.querySelector(".terminal-input");
      if (!frame || !input) return;
      executeTerminalCommand(frame.dataset.windowId, input.value);
      input.value = "";
    }
  }

  function generateId(prefix) {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
  }

  function getCurrentRoot() {
    return state.workspaces[state.currentWorkspace];
  }

  function setCurrentRoot(root) {
    state.workspaces[state.currentWorkspace] = root;
  }

  function getDesktopRect() {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, elements.desktop.clientWidth || window.innerWidth),
      height: Math.max(1, elements.desktop.clientHeight || window.innerHeight - 32)
    };
  }

  function getLayouts(root) {
    const rect = getDesktopRect();
    if (isMobileLayout()) {
      const activeWindow = Tree.findWindow(root, state.activeWindowId);
      const fallbackWindow = Tree.collectWindows(root)[0];
      const focusedWindow = activeWindow || fallbackWindow;
      return focusedWindow ? [{ node: focusedWindow, rect }] : [];
    }
    return Tree.calculateLayout(root, rect);
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function respectsMinimumSize(root) {
    const layouts = getLayouts(root);
    if (layouts.length <= 1) return true;
    return layouts.every((item) => item.rect.width >= MIN_WINDOW_WIDTH && item.rect.height >= MIN_WINDOW_HEIGHT);
  }

  function createWindowFromApp(app) {
    return {
      id: generateId("win"),
      type: "window",
      parentId: null,
      weight: 1,
      title: app.title,
      appId: app.id,
      appType: app.appType,
      icon: app.icon,
      iframeUrl: app.iframeUrl || "",
      externalUrl: app.externalUrl || "",
      terminalLines: app.kind === "terminal" ? getInitialTerminalLines() : [],
      terminalRevision: 0
    };
  }

  function launchApp(app, options) {
    const settings = options || {};
    if (!app) return;

    if (app.kind === "external") {
      window.open(app.externalUrl, "_blank", "noopener");
      if (!settings.silent) showToast(`${app.title} opened externally`);
      return;
    }

    if (!settings.forceNew && app.singleton !== false) {
      const existing = findWindowByAppId(app.id);
      if (existing) {
        focusWorkspaceWindow(existing.workspace, existing.windowNode.id);
        if (!settings.silent) showToast(`${app.title} focused`);
        return existing.windowNode.id;
      }
    }

    const root = getCurrentRoot();
    const newWindow = createWindowFromApp(app);
    let nextRoot = null;

    if (!root) {
      nextRoot = newWindow;
    } else {
      const activeId = state.activeWindowId || firstWindowId(root);
      nextRoot = Tree.insertWindow(root, activeId, newWindow, state.nextSplitDirection, () => generateId("split"));
    }

    if (!respectsMinimumSize(nextRoot)) {
      showToast("Screen space insufficient");
      return null;
    }

    setCurrentRoot(nextRoot);
    focusWindow(newWindow.id, { renderNow: false });
    render();
    return newWindow.id;
  }

  function spawnCustomUrl(rawUrl) {
    const url = normalizeUserUrl(rawUrl);
    if (!url) return;
    const parsed = new URL(url, window.location.href);
    launchApp({
      id: `url-${generateId("custom")}`,
      title: parsed.hostname || parsed.pathname || "Browser",
      appType: "browser",
      aliases: [parsed.href],
      singleton: false,
      icon: "URL",
      kind: "iframe",
      iframeUrl: parsed.href
    }, { forceNew: true });
  }

  function renderIcon(container, iconValue, fallback) {
    const value = iconValue || fallback || "AP";
    container.replaceChildren();
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("./") || value.startsWith("/")) {
      const image = document.createElement("img");
      image.src = value;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      container.appendChild(image);
      return;
    }
    container.textContent = value;
  }

  function findWindowByAppId(appId) {
    for (let workspace = 1; workspace <= WORKSPACE_COUNT; workspace += 1) {
      const found = Tree.collectWindows(state.workspaces[workspace]).find((node) => node.appId === appId);
      if (found) return { workspace, windowNode: found };
    }
    return null;
  }

  function findWindowEverywhere(windowId) {
    for (let workspace = 1; workspace <= WORKSPACE_COUNT; workspace += 1) {
      const windowNode = Tree.findWindow(state.workspaces[workspace], windowId);
      if (windowNode) return { workspace, windowNode };
    }
    return null;
  }

  function focusWorkspaceWindow(workspace, windowId) {
    state.currentWorkspace = workspace;
    state.workspaceFocus[workspace] = windowId;
    state.activeWindowId = windowId;
    render();
    activateShield();
  }

  function focusWindow(windowId, options) {
    if (!windowId) return;
    state.activeWindowId = windowId;
    state.workspaceFocus[state.currentWorkspace] = windowId;
    if (!options || options.renderNow !== false) render();
  }

  function firstWindowId(root) {
    const first = Tree.collectWindows(root)[0];
    return first ? first.id : null;
  }

  function killWindow(windowId) {
    const root = getCurrentRoot();
    const target = Tree.findWindow(root, windowId);
    if (!target) return;

    const nextRoot = Tree.removeWindow(root, windowId);
    setCurrentRoot(nextRoot);
    const nextFocus = firstWindowId(nextRoot);
    state.activeWindowId = nextFocus;
    state.workspaceFocus[state.currentWorkspace] = nextFocus;
    render();
  }

  function closeTerminalWindow(windowId) {
    const root = getCurrentRoot();
    const target = Tree.findWindow(root, windowId);
    if (!target) return;
    const nextRoot = Tree.removeWindow(root, windowId);
    setCurrentRoot(nextRoot);
    const nextFocus = firstWindowId(nextRoot);
    state.activeWindowId = nextFocus;
    state.workspaceFocus[state.currentWorkspace] = nextFocus;
    render();
  }

  function switchWorkspace(workspace) {
    if (workspace < 1 || workspace > WORKSPACE_COUNT || workspace === state.currentWorkspace) return;
    state.currentWorkspace = workspace;
    const storedFocus = state.workspaceFocus[workspace];
    const root = getCurrentRoot();
    const focus = Tree.findWindow(root, storedFocus) ? storedFocus : firstWindowId(root);
    state.activeWindowId = focus;
    state.workspaceFocus[workspace] = focus;
    render();
    activateShield();
  }

  function moveActiveWindowToWorkspace(targetWorkspace) {
    if (targetWorkspace === state.currentWorkspace || !state.activeWindowId) return;
    const sourceRoot = getCurrentRoot();
    const detached = Tree.detachWindow(sourceRoot, state.activeWindowId);
    if (!detached.windowNode) return;

    const targetRoot = state.workspaces[targetWorkspace];
    const movedWindow = {
      ...detached.windowNode,
      parentId: null,
      weight: 1
    };
    const nextTargetRoot = Tree.appendAsRoot(targetRoot, movedWindow, state.nextSplitDirection, () => generateId("split"));

    if (!respectsMinimumSize(nextTargetRoot)) {
      showToast("Screen space insufficient");
      return;
    }

    setCurrentRoot(detached.root);
    state.workspaces[targetWorkspace] = nextTargetRoot;
    state.workspaceFocus[targetWorkspace] = movedWindow.id;
    const nextFocus = firstWindowId(detached.root);
    state.activeWindowId = nextFocus;
    state.workspaceFocus[state.currentWorkspace] = nextFocus;
    render();
  }

  function setSplitDirection(direction) {
    state.nextSplitDirection = direction;
    renderSplitMode();
    showToast(direction === "horizontal" ? "Horizontal split" : "Vertical split");
  }

  function focusByDirection(direction) {
    const root = getCurrentRoot();
    const neighbor = Tree.findNeighbor(getLayouts(root), state.activeWindowId, direction);
    if (!neighbor) return;
    focusWindow(neighbor.id);
  }

  function navigateWindow(windowId, rawUrl) {
    const found = findWindowEverywhere(windowId);
    if (!found || !found.windowNode.iframeUrl) return false;

    let targetUrl;
    try {
      targetUrl = normalizeNestedTargetUrl(new URL(normalizeUserUrl(rawUrl), found.windowNode.iframeUrl), found.windowNode.iframeUrl);
    } catch (error) {
      showToast("Invalid URL");
      return false;
    }

    const currentUrl = new URL(found.windowNode.iframeUrl, window.location.href);
    if (!isSameDomain(currentUrl, targetUrl)) {
      showToast("Cross-origin nesting is not allowed");
      return false;
    }

    updateWindowEverywhere(windowId, (node) => ({
      ...node,
      iframeUrl: targetUrl.href
    }));
    render();
    return true;
  }

  function updateWindowEverywhere(windowId, updater) {
    for (let workspace = 1; workspace <= WORKSPACE_COUNT; workspace += 1) {
      state.workspaces[workspace] = Tree.updateWindow(state.workspaces[workspace], windowId, updater);
    }
  }

  function normalizeUserUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
      return value;
    }
    if (value.includes(".") || value.includes("localhost")) return `https://${value}`;
    return value;
  }

  function looksLikeUrl(value) {
    const query = String(value || "").trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(query) || query.startsWith("/") || query.startsWith("./") || query.startsWith("../") || query.includes(".");
  }

  function isSameDomain(currentUrl, targetUrl) {
    if (currentUrl.protocol === "mailto:" || targetUrl.protocol === "mailto:") return false;
    if (!currentUrl.hostname && !targetUrl.hostname) return true;
    return getCanonicalHost(currentUrl.hostname) === getCanonicalHost(targetUrl.hostname);
  }

  function getCanonicalHost(hostname) {
    return SITE_HOST_ALIASES.has(hostname) ? "moe.st" : hostname;
  }

  function normalizeNestedTargetUrl(targetUrl, baseUrl) {
    const candidate = new URL(targetUrl.href);
    const base = new URL(baseUrl, window.location.href);
    if (!SITE_HOST_ALIASES.has(candidate.hostname)) return candidate;
    if (base.hostname === candidate.hostname) return candidate;
    if (base.protocol === "file:" || isLocalDevHost(base.hostname)) {
      return new URL(`.${candidate.pathname}${candidate.search}${candidate.hash}`, window.location.href);
    }
    return candidate;
  }

  function isLocalDevHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
  }

  function openHelpTerminal() {
    const terminalId = launchApp(Apps.getApp("terminal"));
    if (terminalId) executeTerminalCommand(terminalId, "help", { synthetic: true });
  }

  function openRofi() {
    state.rofiOpen = true;
    state.rofiQuery = "";
    state.rofiSelectedIndex = 0;
    elements.rofiOverlay.hidden = false;
    elements.rofiInput.value = "";
    renderRofiList();
    requestAnimationFrame(() => elements.rofiInput.focus());
    activateShield(500);
  }

  function closeRofi() {
    state.rofiOpen = false;
    elements.rofiOverlay.hidden = true;
    elements.rofiInput.value = "";
  }

  function getRofiEntries() {
    const query = state.rofiQuery.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const apps = Apps.APP_REGISTRY.filter((app) => {
      if (!tokens.length) return true;
      const haystack = `${app.id} ${app.title} ${(app.aliases || []).join(" ")}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });

    if (query && looksLikeUrl(query)) {
      return [{
        id: "__url__",
        title: state.rofiQuery.trim(),
        appType: "browser",
        aliases: ["url"],
        icon: "URL",
        kind: "url-action",
        iframeUrl: state.rofiQuery.trim()
      }, ...apps];
    }

    return apps;
  }

  function renderRofiList() {
    const entries = getRofiEntries();
    if (state.rofiSelectedIndex >= entries.length) state.rofiSelectedIndex = Math.max(0, entries.length - 1);
    elements.rofiList.replaceChildren(...entries.map((entry, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `rofi-row${index === state.rofiSelectedIndex ? " is-selected" : ""}`;
      row.dataset.rofiIndex = String(index);
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", index === state.rofiSelectedIndex ? "true" : "false");
      row.innerHTML = `
        <span class="rofi-icon"></span>
        <span class="rofi-text">
          <span class="rofi-title"></span>
          <span class="rofi-alias"></span>
        </span>
        <span class="rofi-kind"></span>
      `;
      renderIcon(row.querySelector(".rofi-icon"), entry.icon, "AP");
      row.querySelector(".rofi-title").textContent = entry.title;
      row.querySelector(".rofi-alias").textContent = (entry.aliases || []).slice(0, 4).join(" · ");
      row.querySelector(".rofi-kind").textContent = entry.kind === "url-action" ? "url" : entry.appType;
      return row;
    }));
  }

  function moveRofiCursor(delta) {
    const entries = getRofiEntries();
    if (!entries.length) return;
    state.rofiSelectedIndex = (state.rofiSelectedIndex + delta + entries.length) % entries.length;
    renderRofiList();
  }

  function chooseRofiSelection() {
    const entry = getRofiEntries()[state.rofiSelectedIndex];
    if (!entry) return;
    closeRofi();
    if (entry.kind === "url-action") {
      openUrlFromRofi(entry.iframeUrl);
    } else {
      launchApp(entry);
    }
  }

  function openUrlFromRofi(rawUrl) {
    spawnCustomUrl(rawUrl);
  }

  function render() {
    renderWorkspaces();
    renderStatus();
    renderWindows();
  }

  function renderWorkspaces() {
    const buttons = [];
    for (let workspace = 1; workspace <= WORKSPACE_COUNT; workspace += 1) {
      const button = document.createElement("button");
      const occupied = Tree.collectWindows(state.workspaces[workspace]).length > 0;
      button.type = "button";
      button.className = [
        "workspace-button",
        workspace === state.currentWorkspace ? "is-active" : "",
        occupied ? "is-occupied" : ""
      ].filter(Boolean).join(" ");
      button.dataset.workspace = String(workspace);
      button.textContent = String(workspace);
      button.setAttribute("aria-label", `Workspace ${workspace}`);
      buttons.push(button);
    }
    elements.workspaceBar.replaceChildren(...buttons);
  }

  function renderStatus() {
    const activeWindow = Tree.findWindow(getCurrentRoot(), state.activeWindowId);
    const title = activeWindow ? formatWindowTitle(activeWindow) : `Workspace ${state.currentWorkspace} - Empty`;
    elements.windowTitle.textContent = title;
    elements.emptyState.querySelector(".empty-title").textContent = `Workspace ${state.currentWorkspace} - Empty`;
    renderSplitMode();
  }

  function renderSplitMode() {
    elements.splitMode.textContent = state.nextSplitDirection;
  }

  function renderWindows() {
    const root = getCurrentRoot();
    const layouts = getLayouts(root);
    const visibleIds = new Set(layouts.map((item) => item.node.id));

    elements.emptyState.hidden = layouts.length !== 0;

    for (const [windowId, frame] of windowElements.entries()) {
      if (!visibleIds.has(windowId)) {
        frame.remove();
        windowElements.delete(windowId);
      }
    }

    for (const item of layouts) {
      let frame = windowElements.get(item.node.id);
      if (!frame) {
        frame = createWindowFrame(item.node);
        windowElements.set(item.node.id, frame);
        elements.windowsLayer.appendChild(frame);
      }
      updateWindowFrame(frame, item);
    }
  }

  function createWindowFrame(node) {
    const frame = document.createElement("article");
    frame.className = "window-frame";
    frame.dataset.windowId = node.id;
    frame.innerHTML = `
      <header class="window-header">
        <span class="window-icon"></span>
        <div class="window-caption"></div>
        <div class="window-tools"></div>
        <button class="window-button is-danger" type="button" data-action="close-window" title="Close">×</button>
      </header>
      <div class="window-content"></div>
    `;
    return frame;
  }

  function updateWindowFrame(frame, item) {
    const node = item.node;
    const app = Apps.getApp(node.appId);
    frame.dataset.windowId = node.id;
    frame.style.left = `${item.rect.x}px`;
    frame.style.top = `${item.rect.y}px`;
    frame.style.width = `${item.rect.width}px`;
    frame.style.height = `${item.rect.height}px`;
    frame.classList.toggle("is-active", node.id === state.activeWindowId);

    renderIcon(frame.querySelector(".window-icon"), node.icon || app.icon, "AP");
    frame.querySelector(".window-caption").textContent = formatWindowTitle(node);

    const tools = frame.querySelector(".window-tools");
    const content = frame.querySelector(".window-content");

    if (node.iframeUrl) {
      tools.replaceChildren();
      renderIframeContent(content, node);
    } else {
      tools.replaceChildren();
      renderTerminalContent(content, node);
    }
  }

  function renderIframeContent(content, node) {
    let iframe = content.querySelector("iframe");
    if (!iframe) {
      content.replaceChildren();
      iframe = document.createElement("iframe");
      iframe.loading = "eager";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.setAttribute("allow", "fullscreen; clipboard-read; clipboard-write");
      iframe.addEventListener("load", () => trapSameOriginLinks(iframe, node.id));
      content.appendChild(iframe);
    }
    if (iframe.dataset.src !== node.iframeUrl) {
      iframe.dataset.src = node.iframeUrl;
      iframe.src = node.iframeUrl;
    }
  }

  function renderTerminalContent(content, node) {
    const revision = String(node.terminalRevision || 0);
    if (content.dataset.terminalRevision === revision) return;
    content.dataset.terminalRevision = revision;
    const terminal = document.createElement("div");
    terminal.className = "terminal-body";

    const apps = Apps.APP_REGISTRY.filter((app) => app.kind !== "external");
    terminal.innerHTML = `
      <div class="terminal-scroll">
        <div class="terminal-output" aria-live="polite"></div>
        <div class="terminal-spacer" aria-hidden="true"></div>
        <div class="terminal-grid"></div>
      </div>
      <form class="terminal-form" data-action="terminal-form">
        <span class="terminal-prompt">$</span>
        <input class="terminal-input" type="text" autocomplete="off" spellcheck="false" aria-label="Terminal command">
      </form>
    `;
    const scroll = terminal.querySelector(".terminal-scroll");
    const output = terminal.querySelector(".terminal-output");
    for (const line of node.terminalLines || []) {
      const row = document.createElement("p");
      row.className = `terminal-line terminal-${line.kind || "output"}`;
      row.textContent = line.text;
      output.appendChild(row);
    }
    const grid = terminal.querySelector(".terminal-grid");
    for (const app of apps) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "terminal-app";
      button.dataset.action = "launch-app";
      button.dataset.appId = app.id;
      button.innerHTML = `<span class="rofi-icon"></span><span></span>`;
      renderIcon(button.querySelector(".rofi-icon"), app.icon, "AP");
      button.querySelector("span:last-child").textContent = app.title;
      grid.appendChild(button);
    }

    content.replaceChildren(terminal);
    requestAnimationFrame(() => {
      scroll.scrollTop = Math.max(0, output.offsetTop + output.scrollHeight - scroll.clientHeight);
      if (node.id === state.activeWindowId) terminal.querySelector(".terminal-input").focus();
    });
  }

  function trapSameOriginLinks(iframe, windowId) {
    try {
      const doc = iframe.contentDocument;
      if (!doc || doc.dataset.wmTrapAttached === "true") return;
      doc.dataset.wmTrapAttached = "true";
      doc.addEventListener("click", (event) => {
        const anchor = event.target.closest ? event.target.closest("a[href]") : null;
        if (!anchor) return;
        const target = (anchor.getAttribute("target") || "_self").toLowerCase();
        if (target && target !== "_self") return;
        const targetUrl = normalizeNestedTargetUrl(new URL(anchor.getAttribute("href"), iframe.src), iframe.src);
        const currentUrl = new URL(iframe.src, window.location.href);
        if (!isSameDomain(currentUrl, targetUrl)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        navigateWindow(windowId, targetUrl.href);
      }, true);
    } catch (error) {
      // Cross-origin frames cannot be inspected.
    }
  }

  function formatWindowTitle(node) {
    if (!node) return `Workspace ${state.currentWorkspace} - Empty`;
    return node.title;
  }

  function activateShield(duration) {
    elements.interactionShield.classList.add("is-active");
    clearTimeout(shieldTimer);
    shieldTimer = window.setTimeout(deactivateShield, duration || 260);
  }

  function deactivateShield() {
    elements.interactionShield.classList.remove("is-active");
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function getInitialTerminalLines() {
    return [
      { kind: "banner", text: " ____  _       ____ _   _ __   __" },
      { kind: "banner", text: "/ ___|| |     / ___| | | |\\ \\ / /" },
      { kind: "banner", text: "\\___ \\| |    | |   | |_| | \\ V / " },
      { kind: "banner", text: " ___) | |___ | |___|  _  |  | |  " },
      { kind: "banner", text: "|____/|_____| \\____|_| |_|  |_|  " },
      { kind: "muted", text: "slchy_routingspace / " },
      { kind: "output", text: "type `help` for commands and keybindings" }
    ];
  }

  function executeTerminalCommand(windowId, rawCommand, options) {
    const command = String(rawCommand || "").trim();
    const found = findWindowEverywhere(windowId);
    if (!found || !found.windowNode || found.windowNode.appId !== "terminal" || !command) return;

    if (command === "clear") {
      setTerminalLines(windowId, []);
      return;
    }

    if (command === "exit") {
      closeTerminalWindow(windowId);
      return;
    }

    const existingLines = found.windowNode.terminalLines || [];
    const nextLines = options && options.synthetic ? [...existingLines] : [...existingLines, { kind: "prompt", text: `$ ${command}` }];
    const [name, ...args] = command.split(/\s+/);
    const lowerName = name.toLowerCase();

    if (lowerName === "help") {
      nextLines.push(...getHelpLines());
    } else if (lowerName === "about") {
      nextLines.push(...getAboutLines());
    } else if (lowerName === "open") {
      const query = args.join(" ");
      const app = findTerminalOpenApp(query);
      if (!query) {
        nextLines.push({ kind: "error", text: "Usage: open [app]" });
      } else if (!app) {
        nextLines.push({ kind: "error", text: `Open is limited to site apps: ${getTerminalOpenAppNames()}` });
      } else {
        nextLines.push({ kind: "output", text: `Opening ${app.title}` });
        setTerminalLines(windowId, nextLines, { renderNow: false });
        launchApp(app);
        return;
      }
    } else {
      nextLines.push({ kind: "error", text: `Command not found: ${command}` });
    }

    setTerminalLines(windowId, nextLines);
  }

  function setTerminalLines(windowId, lines, options) {
    updateWindowEverywhere(windowId, (node) => ({
      ...node,
      terminalLines: lines,
      terminalRevision: (node.terminalRevision || 0) + 1
    }));
    if (!options || options.renderNow !== false) render();
  }

  function getHelpLines() {
    return [
      { kind: "output", text: "Commands:" },
      { kind: "output", text: "  clear       clear terminal output" },
      { kind: "output", text: "  exit        close this terminal" },
      { kind: "output", text: "  help        show commands and keybindings" },
      { kind: "output", text: "  open [app]  open a site app: " + getTerminalOpenAppNames() },
      { kind: "output", text: "  about       print personal information" },
      { kind: "output", text: "Keybindings:" },
      { kind: "output", text: "  Alt+Shift+Enter  open terminal" },
      { kind: "output", text: "  Alt+Shift+F      open Rofi launcher" },
      { kind: "output", text: "  Alt+Shift+Q      close focused window" },
      { kind: "output", text: "  Alt+Shift+G/V    set next split horizontal/vertical" },
      { kind: "output", text: "  Alt+Shift+H/J/K/L move focus left/down/up/right" },
      { kind: "output", text: "  Alt+1..9         switch workspace" },
      { kind: "output", text: "  Alt+Shift+1..9   move focused window to workspace" }
    ];
  }

  function getAboutLines() {
    return [
      { kind: "output", text: "Прекрасное Далеко! Не будь ко мне жестоко." },
      { kind: "output", text: "since 2020 | SLCHY | moe.st" }
    ];
  }

  function findTerminalOpenApp(query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return null;
    return Apps.APP_REGISTRY.find((app) => {
      if (!TERMINAL_OPEN_APP_IDS.has(app.id)) return false;
      const names = [app.id, app.title, ...(app.aliases || [])].map((value) => String(value).toLowerCase());
      return names.some((value) => value === normalized || value.includes(normalized));
    }) || null;
  }

  function getTerminalOpenAppNames() {
    return Apps.APP_REGISTRY
      .filter((app) => TERMINAL_OPEN_APP_IDS.has(app.id))
      .map((app) => app.id)
      .join(", ");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
