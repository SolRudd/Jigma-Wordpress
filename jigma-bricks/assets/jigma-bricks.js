(function () {
  "use strict";

  var ROOT_ID = "jigma-bricks-root";
  var UI_KEY = "jigma_bricks_ui_v1";
  var WORKSPACE_KEY = "jigma_bricks_workspace_v1";
  var SAVED_SECTIONS_KEY = "jigma_bricks_saved_sections_v1";
  var SCHEMA_VERSION = "bricks-compatibility.v1";

  var config = window.JigmaBricksPlugin || {};
  var debugMode = Boolean(config.debug || window.JigmaBricksDiagnostics);
  var diagnostics = debugMode
    ? (window.JigmaBricksDiagnostics = window.JigmaBricksDiagnostics || {
      phpEnqueued: false,
      builderDetected: false,
      coreLoaded: false,
      configLoaded: false,
      mounted: false,
      rootFound: false,
      workspaceDetected: false,
      dockState: "pending",
      pluginVersion: "",
      errors: [],
    })
    : null;
  var initStage = "bootstrap";

  function setDiagnostics(values) {
    if (!diagnostics) return;
    Object.keys(values).forEach(function (key) {
      diagnostics[key] = values[key];
    });
  }

  setDiagnostics({
    configLoaded: Boolean(window.JigmaBricksPlugin),
    coreLoaded: Boolean(window.JigmaCore && typeof window.JigmaCore.convertToBricksCompatibility === "function"),
    pluginVersion: config.version || "",
  });

  if (document.getElementById(ROOT_ID) || window.JigmaBricksPanelLoaded) {
    setDiagnostics({
      mounted: Boolean(document.getElementById(ROOT_ID)),
      rootFound: Boolean(document.getElementById(ROOT_ID)),
    });
    return;
  }

  var contentSummary = Array.isArray(config.contentSummary) ? config.contentSummary : [];
  var contentById = new Map(contentSummary.map(function (element) {
    return [String(element.id), element];
  }));

  var defaultUi = {
    dockState: "collapsed",
    dockHeight: 300,
    editorWidths: { html: 1, css: 1, js: 1 },
    visibleEditors: { html: true, css: true, js: false },
    activeEditor: "html",
    liveAnalysis: false,
    confirmBeforeInsert: true,
    restoreLastWorkspace: true,
    clearAfterInsert: false,
    openExpandedOnLoad: false,
    rememberDockState: true,
    rememberEditorWidths: true,
    showDiagnostics: false,
    includeJavaScript: true,
    pageCssMode: "ask",
    classConflictMode: "ask",
  };

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function setInitStage(stage) {
    initStage = stage;
  }

  function waitForBody(callback) {
    if (document.body) {
      callback();
      return;
    }

    var done = false;
    function finish() {
      if (done || !document.body) return;
      done = true;
      callback();
    }

    document.addEventListener("DOMContentLoaded", finish, { once: true });
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (document.body || attempts > 120) {
        window.clearInterval(timer);
        finish();
      }
    }, 50);
  }

  function reportInitializationError(stage, error) {
    var message = error && error.message ? error.message : String(error || "Unknown initialization error.");
    console.error("[Jigma] initialization failed at " + stage, error);
    if (diagnostics) {
      diagnostics.errors = Array.isArray(diagnostics.errors) ? diagnostics.errors : [];
      diagnostics.errors.push({ stage: stage, message: message });
      diagnostics.mounted = false;
      diagnostics.rootFound = Boolean(document.getElementById(ROOT_ID));
    }
    renderInitializationError(stage, message);
  }

  function renderInitializationError(stage, message) {
    waitForBody(function () {
      var root = document.getElementById(ROOT_ID) || el("div", "jigma-root");
      root.id = ROOT_ID;
      root.classList.add("jigma-root");
      if (!root.parentNode && document.body) {
        document.body.appendChild(root);
      }

      var launcher = root.querySelector(".jigma-launcher--error") || el("button", "jigma-launcher jigma-launcher--error", "Jigma error");
      var errorPanel = root.querySelector(".jigma-init-error") || el("section", "jigma-init-error");
      launcher.type = "button";
      launcher.hidden = false;
      launcher.addEventListener("click", function () {
        errorPanel.hidden = !errorPanel.hidden;
      });
      errorPanel.hidden = false;
      errorPanel.innerHTML = "";
      errorPanel.appendChild(el("strong", "", "Jigma initialization failed"));
      errorPanel.appendChild(el("p", "", "Stage: " + stage));
      errorPanel.appendChild(el("p", "", message));
      if (!launcher.parentNode) root.appendChild(launcher);
      if (!errorPanel.parentNode) root.appendChild(errorPanel);
      setDiagnostics({ rootFound: true, dockState: "error" });
    });
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function storageGet(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, value);
    } catch (error) {
      if (diagnostics) {
        diagnostics.errors = Array.isArray(diagnostics.errors) ? diagnostics.errors : [];
        diagnostics.errors.push({ stage: "storage", message: "Unable to persist Jigma UI state." });
      }
    }
  }

  function storageRemove(key) {
    try {
      if (window.localStorage) window.localStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }

  function mergeUi(input) {
    var value = isPlainObject(input) ? input : {};
    return {
      dockState: value.dockState || defaultUi.dockState,
      dockHeight: Number(value.dockHeight || defaultUi.dockHeight),
      editorWidths: Object.assign({}, defaultUi.editorWidths, value.editorWidths || {}),
      visibleEditors: normalizeVisibility(Object.assign({}, defaultUi.visibleEditors, value.visibleEditors || {})),
      activeEditor: value.activeEditor || defaultUi.activeEditor,
      liveAnalysis: Boolean(value.liveAnalysis),
      confirmBeforeInsert: value.confirmBeforeInsert !== false,
      restoreLastWorkspace: value.restoreLastWorkspace !== false,
      clearAfterInsert: Boolean(value.clearAfterInsert),
      openExpandedOnLoad: typeof value.openExpandedOnLoad === "boolean" ? value.openExpandedOnLoad : defaultUi.openExpandedOnLoad,
      rememberDockState: typeof value.rememberDockState === "boolean" ? value.rememberDockState : defaultUi.rememberDockState,
      rememberEditorWidths: typeof value.rememberEditorWidths === "boolean" ? value.rememberEditorWidths : defaultUi.rememberEditorWidths,
      showDiagnostics: Boolean(value.showDiagnostics),
      includeJavaScript: value.includeJavaScript !== false,
      pageCssMode: ["ask", "include", "exclude"].indexOf(value.pageCssMode) === -1 ? "ask" : value.pageCssMode,
      classConflictMode: ["ask", "reuse", "cancel"].indexOf(value.classConflictMode) === -1 ? "ask" : value.classConflictMode,
    };
  }

  function isValidStoredUi(value) {
    if (!isPlainObject(value)) return false;
    if (value.dockState && ["expanded", "collapsed", "hidden"].indexOf(value.dockState) === -1) return false;
    if (value.dockHeight !== undefined && (!Number.isFinite(Number(value.dockHeight)) || Number(value.dockHeight) < 120)) return false;
    if (value.activeEditor && ["html", "css", "js"].indexOf(value.activeEditor) === -1) return false;
    if (value.visibleEditors && (typeof value.visibleEditors !== "object" || Array.isArray(value.visibleEditors))) return false;
    if (value.editorWidths && (typeof value.editorWidths !== "object" || Array.isArray(value.editorWidths))) return false;
    return true;
  }

  function readStoredUi() {
    var raw = storageGet(UI_KEY);
    if (raw === null || raw === undefined) return defaultUi;
    if (raw === "") {
      storageRemove(UI_KEY);
      return defaultUi;
    }
    var parsed = safeJsonParse(raw, null);
    if (!isValidStoredUi(parsed)) {
      storageRemove(UI_KEY);
      return defaultUi;
    }
    return parsed;
  }

  function readStoredWorkspace() {
    var raw = storageGet(WORKSPACE_KEY);
    if (raw === null || raw === undefined) return {};
    if (raw === "") {
      storageRemove(WORKSPACE_KEY);
      return {};
    }
    var parsed = safeJsonParse(raw, null);
    if (!isPlainObject(parsed)) {
      storageRemove(WORKSPACE_KEY);
      return {};
    }
    if (
      (parsed.html !== undefined && typeof parsed.html !== "string") ||
      (parsed.css !== undefined && typeof parsed.css !== "string") ||
      (parsed.js !== undefined && typeof parsed.js !== "string")
    ) {
      storageRemove(WORKSPACE_KEY);
      return {};
    }
    return {
      html: typeof parsed.html === "string" ? parsed.html : "",
      css: typeof parsed.css === "string" ? parsed.css : "",
      js: typeof parsed.js === "string" ? parsed.js : "",
    };
  }

  function normalizeVisibility(visible) {
    var next = {
      html: visible.html !== false,
      css: visible.css !== false,
      js: visible.js !== false,
    };
    if (!next.html && !next.css && !next.js) {
      next.html = true;
    }
    return next;
  }

  var ui;
  var state;
  var nodes = {};
  var liveAnalysisTimer = 0;
  var workspaceObserver = null;
  var mutationObserver = null;

  function initializeBootstrapState() {
    ui = mergeUi(readStoredUi());
    if (!ui.rememberDockState) {
      ui.dockState = ui.openExpandedOnLoad ? "expanded" : "collapsed";
    }

    var restoredWorkspace = ui.restoreLastWorkspace
      ? readStoredWorkspace()
      : {};

    state = {
      html: restoredWorkspace.html || "",
      css: restoredWorkspace.css || "",
      js: restoredWorkspace.js || "",
      lastRun: null,
      target: null,
      drawerOpen: false,
      drawerMode: "review",
      modal: null,
      pageStylesDecision: "none",
      statusKind: "blocked",
    };
  }

  try {
    setInitStage("bootstrap-state");
    initializeBootstrapState();
  } catch (error) {
    reportInitializationError(initStage, error);
    return;
  }

  function persistUi() {
    ui.visibleEditors = normalizeVisibility(ui.visibleEditors);
    storageSet(UI_KEY, JSON.stringify(ui));
  }

  function persistWorkspace() {
    if (!ui.restoreLastWorkspace) return;
    storageSet(WORKSPACE_KEY, JSON.stringify({
      html: state.html,
      css: state.css,
      js: state.js,
    }));
  }

  function readSavedSections() {
    var raw = storageGet(SAVED_SECTIONS_KEY);
    if (raw === null || raw === undefined) return [];
    if (raw === "") {
      storageRemove(SAVED_SECTIONS_KEY);
      return [];
    }
    var parsed = safeJsonParse(raw, null);
    if (!Array.isArray(parsed)) {
      storageRemove(SAVED_SECTIONS_KEY);
      return [];
    }
    if (!parsed.every(isPlainObject)) {
      storageRemove(SAVED_SECTIONS_KEY);
      return [];
    }
    return parsed;
  }

  function selectedIdFromGlobals() {
    var candidates = [
      window.bricksData && window.bricksData.selectedElement && window.bricksData.selectedElement.id,
      window.bricksData && window.bricksData.selectedElementId,
      window.BRICKS_DATA && window.BRICKS_DATA.selectedElement && window.BRICKS_DATA.selectedElement.id,
      window.BRICKS_DATA && window.BRICKS_DATA.selectedElementId,
      window.bricksBuilder && window.bricksBuilder.selectedElement && window.bricksBuilder.selectedElement.id,
      window.bricksBuilder && window.bricksBuilder.selectedElementId,
      window.Bricks && window.Bricks.selectedElement && window.Bricks.selectedElement.id,
      window.Bricks && window.Bricks.selectedElementId,
    ].filter(Boolean);

    if (candidates.length > 0) {
      return String(candidates[0]);
    }

    var active = document.querySelector(
      "[data-bricks-element-id].active,[data-bricks-element-id].selected,[data-bricks-id].active,[data-bricks-id].selected,[data-control-key='selectedElement']"
    );
    if (!active) return "";
    return active.getAttribute("data-bricks-element-id") ||
      active.getAttribute("data-bricks-id") ||
      active.getAttribute("data-id") ||
      "";
  }

  function describeTarget(id) {
    function label(summary, targetId) {
      var name = summary.name || "Element";
      var displayName = summary.label || name;
      return displayName + " \u00b7 " + name + " \u00b7 " + targetId;
    }

    if (!id) {
      return {
        id: "",
        exists: false,
        acceptsChildren: false,
        label: "No target selected",
        shortLabel: "No target selected",
        message: "Select a container in Bricks before inserting.",
      };
    }

    var summary = contentById.get(String(id));
    if (!summary) {
      return {
        id: String(id),
        exists: false,
        acceptsChildren: false,
        label: "Unknown target \u00b7 " + id,
        shortLabel: "Unknown target",
        message: "The selected Bricks element is not in the saved page content. Save or reload Bricks, then select it again.",
      };
    }

    if (!summary.acceptsChildren) {
      return {
        id: String(id),
        exists: true,
        acceptsChildren: false,
        label: label(summary, id),
        shortLabel: summary.label || summary.name || "Element",
        message: summary.locked
          ? "The selected element is locked or unsuitable for insertion. Select another nestable element."
          : "The selected element cannot contain children.",
      };
    }

    return {
      id: String(id),
      exists: true,
      acceptsChildren: true,
      label: label(summary, id),
      shortLabel: summary.label || summary.name || "Element",
      message: "Ready to insert.",
    };
  }

  function findWorkspaceNode() {
    var selectors = [
      "#bricks-builder-iframe-wrapper",
      "#bricks-iframe-wrapper",
      ".bricks-builder-iframe-wrapper",
      ".bricks-iframe-wrapper",
      ".bricks-preview-wrapper",
      ".bricks-builder-preview",
      "[data-builder-canvas]",
      "[data-bricks-builder-canvas]",
      "#bricks-builder",
    ];

    for (var index = 0; index < selectors.length; index += 1) {
      var node = document.querySelector(selectors[index]);
      if (node && node.getBoundingClientRect().width > 240) {
        return node;
      }
    }

    return null;
  }

  function isRealBricksBuilderContext() {
    return Boolean(config.builderContext && config.bricksActive);
  }

  function abortMount(reason) {
    setDiagnostics({
      mounted: false,
      rootFound: Boolean(document.getElementById(ROOT_ID)),
      workspaceDetected: false,
      dockState: reason,
    });
  }

  function waitForWorkspace(callback) {
    var attempts = 0;
    var maxAttempts = 50;
    function check() {
      var workspace = findWorkspaceNode();
      if (workspace) {
        callback(workspace);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        callback(null);
        return;
      }
      window.setTimeout(check, 100);
    }
    check();
  }

  function updateDockBounds() {
    if (!nodes.root) return;
    var workspace = findWorkspaceNode();

    if (!workspace) {
      nodes.root.hidden = true;
      nodes.root.dataset.workspace = "missing";
      setDiagnostics({ workspaceDetected: false });
      return;
    }

    var rect = workspace.getBoundingClientRect();
    var bounds = {
      left: Math.max(8, rect.left),
      right: Math.max(8, window.innerWidth - rect.right),
    };
    nodes.root.hidden = false;
    nodes.root.dataset.workspace = "detected";
    setDiagnostics({ workspaceDetected: true });
    nodes.root.style.setProperty("--jigma-left", Math.round(bounds.left) + "px");
    nodes.root.style.setProperty("--jigma-right", Math.round(bounds.right) + "px");
    nodes.root.style.setProperty("--jigma-bottom", "0px");
  }

  function observeWorkspace() {
    if (workspaceObserver) workspaceObserver.disconnect();
    if (mutationObserver) mutationObserver.disconnect();

    if ("ResizeObserver" in window) {
      workspaceObserver = new ResizeObserver(function () {
        window.requestAnimationFrame(updateDockBounds);
      });
      var workspace = findWorkspaceNode();
      if (workspace) workspaceObserver.observe(workspace);
      workspaceObserver.observe(document.documentElement);
    }

    mutationObserver = new MutationObserver(function (records) {
      var shouldUpdate = records.some(function (record) {
        return record.type === "childList" ||
          record.attributeName === "class" ||
          record.attributeName === "style";
      });
      if (shouldUpdate) window.requestAnimationFrame(updateDockBounds);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    window.addEventListener("resize", updateDockBounds);
    window.addEventListener("orientationchange", updateDockBounds);
    window.addEventListener("beforeunload", function () {
      if (workspaceObserver) workspaceObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
    }, { once: true });
  }

  var JigmaBricksInsertAdapter = {
    inspect: function () {
      var postId = Number(config.postId || 0);
      if (!postId && window.bricksData && window.bricksData.postId) postId = Number(window.bricksData.postId);
      if (!postId && window.BRICKS_DATA && window.BRICKS_DATA.postId) postId = Number(window.BRICKS_DATA.postId);

      return {
        postId: postId || 0,
        contentHash: config.contentHash || "",
        selectedTarget: describeTarget(selectedIdFromGlobals()),
      };
    },
    insert: function (payload, options) {
      var details = this.inspect();
      var form = new FormData();

      if (!config.ajaxUrl || !config.insertNonce) {
        return Promise.reject(new Error("Jigma insert endpoint is not available in this Bricks context."));
      }
      if (!details.postId) {
        return Promise.reject(new Error("Jigma could not identify the current editable Bricks post."));
      }
      if (!details.selectedTarget.id) {
        return Promise.reject(new Error("Select a container in Bricks before inserting."));
      }
      if (!details.selectedTarget.exists || !details.selectedTarget.acceptsChildren) {
        return Promise.reject(new Error(details.selectedTarget.message));
      }

      form.append("action", "jigma_bricks_insert");
      form.append("nonce", config.insertNonce);
      form.append("builderContext", "1");
      form.append("postId", String(details.postId));
      form.append("targetId", details.selectedTarget.id);
      form.append("contentHash", String(details.contentHash || ""));
      form.append("payload", JSON.stringify(payload));
      form.append("includeJsCode", options && options.includeJsCode ? "1" : "");
      form.append("pageStylesCss", options && options.pageStylesCss ? options.pageStylesCss : "");
      form.append("schemaVersion", config.compatibilitySchemaVersion || SCHEMA_VERSION);

      return fetch(config.ajaxUrl, {
        body: form,
        credentials: "same-origin",
        method: "POST",
      }).then(function (response) {
        return response.json().catch(function () {
          throw new Error("Jigma insert failed with an unreadable WordPress response.");
        });
      }).then(function (data) {
        if (!data || !data.success) {
          var error = new Error(data && data.data && data.data.message ? data.data.message : "Jigma insert was rejected by WordPress.");
          error.data = data && data.data ? data.data : {};
          throw error;
        }
        return data.data || {};
      });
    },
  };
  window.JigmaBricksInsertAdapter = JigmaBricksInsertAdapter;

  function runConversion() {
    if (!window.JigmaCore || typeof window.JigmaCore.convertToBricksCompatibility !== "function") {
      throw new Error("Jigma Core bundle is not available.");
    }

    var result = window.JigmaCore.convertToBricksCompatibility({
      html: state.html,
      css: state.css,
      js: state.js,
      projectPrefix: "jg",
      blockName: "section",
      includeJavaScriptCode: Boolean(state.js.trim()) && ui.includeJavaScript,
    });

    state.lastRun = result;
    if (result.pageLevelCss.ruleCount === 0) {
      state.pageStylesDecision = "none";
    } else if (ui.pageCssMode === "include") {
      state.pageStylesDecision = "include";
    } else if (ui.pageCssMode === "exclude") {
      state.pageStylesDecision = "exclude";
    } else {
      state.pageStylesDecision = "";
    }
    return result;
  }

  function scheduleLiveAnalysis() {
    window.clearTimeout(liveAnalysisTimer);
    if (!ui.liveAnalysis) return;
    liveAnalysisTimer = window.setTimeout(function () {
      try {
        runConversion();
        renderReviewDrawer();
        updateStatus();
      } catch (error) {
        updateStatus(error.message || "Jigma validation failed.");
      }
    }, 450);
  }

  function minimalPayload(result) {
    return JSON.stringify(result.payload, null, 2);
  }

  function formatSource(kind, value) {
    var text = String(value || "").trim();
    if (!text) return "";
    if (kind === "css") {
      return text.replace(/\s*{\s*/g, " {\n  ")
        .replace(/;\s*/g, ";\n  ")
        .replace(/\s*}\s*/g, "\n}\n\n")
        .replace(/\n\s+\n/g, "\n")
        .trim();
    }
    if (kind === "js") {
      return text.replace(/;\s*/g, ";\n").replace(/\{\s*/g, "{\n  ").replace(/\}\s*/g, "\n}\n").trim();
    }
    return text.replace(/></g, ">\n<");
  }

  function getVisibleEditorKinds() {
    return ["html", "css", "js"].filter(function (kind) {
      return ui.visibleEditors[kind] !== false;
    });
  }

  function setDockState(nextState) {
    ui.dockState = nextState;
    if (ui.rememberDockState) persistUi();
    else storageSet(UI_KEY, JSON.stringify(Object.assign({}, ui, { dockState: defaultUi.dockState })));
    syncDockState();
  }

  function syncDockState() {
    if (["expanded", "collapsed", "hidden"].indexOf(ui.dockState) === -1) {
      ui.dockState = defaultUi.dockState;
      persistUi();
    }
    nodes.dock.classList.toggle("is-collapsed", ui.dockState === "collapsed");
    nodes.dock.classList.toggle("is-hidden", ui.dockState === "hidden");
    nodes.launcher.hidden = ui.dockState !== "hidden";
    nodes.collapse.textContent = ui.dockState === "collapsed" ? "Expand" : "Collapse";
    nodes.collapse.title = ui.dockState === "collapsed" ? "Expand Jigma dock" : "Collapse dock - Escape";
    nodes.collapse.setAttribute("aria-expanded", ui.dockState === "expanded" ? "true" : "false");
    nodes.dock.style.setProperty("--jigma-dock-height", Math.max(180, Math.min(ui.dockHeight, Math.round(window.innerHeight * 0.65))) + "px");
    setDiagnostics({ dockState: ui.dockState, rootFound: Boolean(nodes.root), mounted: Boolean(nodes.root) });
  }

  function setActiveEditor(kind) {
    ui.activeEditor = kind;
    persistUi();
    syncEditors();
  }

  function syncEditors() {
    var visibleKinds = getVisibleEditorKinds();
    if (visibleKinds.indexOf(ui.activeEditor) === -1) {
      ui.activeEditor = visibleKinds[0] || "html";
    }

    ["html", "css", "js"].forEach(function (kind) {
      var field = nodes.editors[kind].field;
      var tab = nodes.editors[kind].tab;
      nodes.editors[kind].textarea.value = state[kind];
      field.hidden = ui.visibleEditors[kind] === false;
      field.classList.toggle("is-active", ui.activeEditor === kind);
      tab.hidden = ui.visibleEditors[kind] === false;
      tab.classList.toggle("is-active", ui.activeEditor === kind);
      tab.setAttribute("aria-selected", ui.activeEditor === kind ? "true" : "false");
    });

    nodes.editorsWrap.style.gridTemplateColumns = visibleKinds.map(function (kind) {
      return "minmax(160px, " + Math.max(0.35, Number(ui.editorWidths[kind] || 1)) + "fr)";
    }).join(" ");
    renderGutters();
  }

  function renderGutters() {
    nodes.gutters.innerHTML = "";
    var visibleKinds = getVisibleEditorKinds();
    if (visibleKinds.length < 2) return;
    visibleKinds.slice(0, -1).forEach(function (kind, index) {
      var gutter = el("button", "jigma-editor-gutter", "");
      gutter.type = "button";
      gutter.setAttribute("aria-label", "Resize " + kind.toUpperCase() + " editor");
      gutter.dataset.before = kind;
      gutter.dataset.after = visibleKinds[index + 1];
      gutter.addEventListener("pointerdown", startEditorResize);
      gutter.addEventListener("keydown", function (event) {
        var delta = event.key === "ArrowLeft" ? -0.1 : event.key === "ArrowRight" ? 0.1 : 0;
        if (!delta) return;
        event.preventDefault();
        ui.editorWidths[gutter.dataset.before] = Math.max(0.35, Number(ui.editorWidths[gutter.dataset.before] || 1) + delta);
        ui.editorWidths[gutter.dataset.after] = Math.max(0.35, Number(ui.editorWidths[gutter.dataset.after] || 1) - delta);
        if (ui.rememberEditorWidths) persistUi();
        syncEditors();
      });
      nodes.gutters.appendChild(gutter);
    });
  }

  function startEditorResize(event) {
    event.preventDefault();
    var before = event.currentTarget.dataset.before;
    var after = event.currentTarget.dataset.after;
    var startX = event.clientX;
    var startBefore = Number(ui.editorWidths[before] || 1);
    var startAfter = Number(ui.editorWidths[after] || 1);
    function move(moveEvent) {
      var delta = (moveEvent.clientX - startX) / 260;
      ui.editorWidths[before] = Math.max(0.35, startBefore + delta);
      ui.editorWidths[after] = Math.max(0.35, startAfter - delta);
      syncEditors();
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      if (ui.rememberEditorWidths) persistUi();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function updateTarget() {
    state.target = JigmaBricksInsertAdapter.inspect().selectedTarget;
    nodes.target.textContent = state.target.id ? state.target.shortLabel : "No target selected";
    nodes.target.title = "Target: " + state.target.label;
    nodes.target.classList.toggle("is-ready", Boolean(state.target.acceptsChildren));
    nodes.target.classList.toggle("is-empty", !state.target.id);
    updateStatus();
  }

  function warningCountByCode(pattern) {
    if (!state.lastRun) return 0;
    return (state.lastRun.diagnostics.warnings || []).filter(function (warning) {
      return pattern.test(String(warning.code || warning.message || ""));
    }).reduce(function (sum, warning) {
      return sum + (warning.count || 1);
    }, 0);
  }

  function statusText() {
    if (!state.target || !state.target.id) {
      state.statusKind = "neutral";
      return "No target selected";
    }
    if (!state.target.exists || !state.target.acceptsChildren) {
      state.statusKind = "blocked";
      return state.target.message;
    }
    if (!state.lastRun) {
      state.statusKind = "target";
      return "Target selected";
    }
    if (state.pageStylesDecision === "" || warningCountByCode(/signature|asset|unresolved|sanitize|sanit/i) > 0) {
      state.statusKind = "review";
      if (warningCountByCode(/svg\.signature/i) > 0) {
        return "Needs review \u00b7 " + warningCountByCode(/svg\.signature/i) + " unsigned SVGs";
      }
      if (state.pageStylesDecision === "") return "Needs review \u00b7 Page-level CSS";
      return "Needs review";
    }
    state.statusKind = "ready";
    return "Ready \u00b7 " +
      state.lastRun.diagnostics.elementCount + " elements \u00b7 " +
      state.lastRun.diagnostics.classCount + " classes";
  }

  function updateStatus(message, kind) {
    if (message) {
      nodes.status.textContent = message;
      state.statusKind = kind || state.statusKind || "ready";
    } else {
      nodes.status.textContent = statusText();
    }
    nodes.status.dataset.status = state.statusKind;
    nodes.target.dataset.status = state.target && state.target.acceptsChildren ? "target" : state.statusKind;
    nodes.insert.disabled = !canInsert();
    nodes.jsBadge.textContent = state.js.trim() ? "Review required" : "None";
    nodes.jsBadge.dataset.status = state.js.trim() ? "review" : "idle";
  }

  function canInsert() {
    var pageStylesReady = !state.lastRun ||
      state.lastRun.pageLevelCss.ruleCount === 0 ||
      state.pageStylesDecision === "include" ||
      state.pageStylesDecision === "exclude";
    return Boolean(
      state.lastRun &&
      state.target &&
      state.target.exists &&
      state.target.acceptsChildren &&
      pageStylesReady
    );
  }

  function renderReviewDrawer(errorData) {
    nodes.drawer.innerHTML = "";
    nodes.drawer.classList.toggle("is-open", state.drawerOpen);
    nodes.status.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
    if (!state.drawerOpen) return;

    var review = el("section", "jigma-review");
    review.appendChild(el("h3", "", "Review"));

    if (!state.lastRun) {
      review.appendChild(el("p", "", "Run Jigma to generate a Bricks Compatibility payload."));
    } else {
      review.appendChild(el("p", "", state.lastRun.diagnostics.elementCount + " elements, " + state.lastRun.diagnostics.classCount + " classes."));
      if (state.pageStylesDecision === "") {
        renderPageCssReview(review);
      }
      if (state.js.trim() && ui.includeJavaScript) {
        review.appendChild(el("p", "jigma-review__item", "Unsigned JavaScript: Signature required after import."));
      }
      renderWarnings(review);
    }

    if (errorData && Array.isArray(errorData.conflicts)) {
      errorData.conflicts.forEach(function (conflict) {
        var item = el("div", "jigma-review__item");
        item.appendChild(el("strong", "", "Class conflict: ." + (conflict.name || "class")));
        item.appendChild(el("p", "", "This class already exists with different CSS."));
        ["Use existing", "Rename imported", "Cancel"].forEach(function (label) {
          var button = el("button", "jigma-button", label);
          button.type = "button";
          button.addEventListener("click", function () {
            updateStatus("Resolve class conflicts in Bricks before inserting.", "blocked");
          });
          item.appendChild(button);
        });
        review.appendChild(item);
      });
    }

    nodes.drawer.appendChild(review);
  }

  function renderPageCssReview(parent) {
    var pageStyles = state.lastRun.pageLevelCss;
    var groupText = pageStyles.groups.map(function (group) {
      return group.count + " " + group.label;
    }).join(", ");
    var item = el("div", "jigma-review__item");
    item.appendChild(el("strong", "", "Page-level CSS detected"));
    item.appendChild(el("p", "", groupText || "Global CSS rules require review."));
    var include = el("button", "jigma-button", "Include as Jigma Page Styles");
    var exclude = el("button", "jigma-button", "Exclude");
    var inspect = el("button", "jigma-button", "Review");
    include.type = exclude.type = inspect.type = "button";
    include.addEventListener("click", function () {
      state.pageStylesDecision = "include";
      renderReviewDrawer();
      updateStatus();
    });
    exclude.addEventListener("click", function () {
      state.pageStylesDecision = "exclude";
      renderReviewDrawer();
      updateStatus();
    });
    inspect.addEventListener("click", function () {
      window.alert(pageStyles.css);
    });
    item.append(include, exclude, inspect);
    parent.appendChild(item);
  }

  function renderWarnings(parent) {
    var actionable = (state.lastRun.diagnostics.warnings || []).filter(function (warning) {
      return /error|action|required|unresolved|asset|signature|sanitize|sanit|conflict/i.test(
        String(warning.severity || "") + " " + String(warning.code || "") + " " + String(warning.message || "")
      );
    });
    actionable.slice(0, 8).forEach(function (warning) {
      parent.appendChild(el("p", "jigma-review__item", warning.title || warning.message || "Review required"));
    });
  }

  function doRun() {
    try {
      runConversion();
      state.drawerOpen = state.pageStylesDecision === "" || (state.lastRun.diagnostics.warnings || []).length > 0;
      state.drawerMode = "review";
      renderReviewDrawer();
      updateStatus();
    } catch (error) {
      updateStatus(error.message || "Jigma run failed.", "blocked");
    }
  }

  function doCopy() {
    try {
      var result = state.lastRun || runConversion();
      navigator.clipboard.writeText(minimalPayload(result)).then(function () {
        updateStatus("Copied Bricks Compatibility payload.", "ready");
      }).catch(function () {
        updateStatus("Clipboard copy failed.", "blocked");
        console.log("Jigma Bricks payload", result.payload);
      });
    } catch (error) {
      updateStatus(error.message || "Copy failed.", "blocked");
    }
  }

  function doInsert() {
    if (!canInsert()) {
      updateStatus();
      return;
    }
    if (ui.confirmBeforeInsert && !window.confirm("Insert Jigma content into " + state.target.shortLabel + "?")) {
      return;
    }
    var pageStylesCss = state.pageStylesDecision === "include" ? state.lastRun.pageLevelCss.css : "";
    nodes.insert.disabled = true;
    JigmaBricksInsertAdapter.insert(state.lastRun.payload, {
      includeJsCode: Boolean(state.js.trim()) && ui.includeJavaScript,
      pageStylesCss: pageStylesCss,
    }).then(function (data) {
      if (ui.clearAfterInsert) {
        state.html = "";
        state.css = "";
        state.js = "";
        state.lastRun = null;
        persistWorkspace();
        syncEditors();
      }
      var codeWarning = data.codeWarnings && data.codeWarnings.length ? " " + data.codeWarnings[0] : "";
      updateStatus((data.message || "Inserted. Reload the Bricks builder to view saved content.") + codeWarning, "inserted");
    }).catch(function (error) {
      state.drawerOpen = true;
      state.drawerMode = "review";
      renderReviewDrawer(error.data || {});
      updateStatus(error.message || "Insert failed.", "blocked");
    }).finally(function () {
      nodes.insert.disabled = !canInsert();
    });
  }

  function openSettingsModal() {
    openModal("Jigma Settings", renderSettingsModal);
  }

  function openModal(title, renderBody) {
    closeModal();
    var overlay = el("div", "jigma-modal-layer");
    var dialog = el("section", "jigma-modal");
    var heading = el("h2", "", title);
    var close = el("button", "jigma-icon-button", "Close");
    var body = el("div", "jigma-modal-body");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "jigma-modal-title");
    heading.id = "jigma-modal-title";
    close.type = "button";
    close.setAttribute("aria-label", "Close Jigma settings");
    close.addEventListener("click", closeModal);
    var head = el("header", "jigma-modal-head");
    head.append(heading, close);
    renderBody(body);
    dialog.append(head, body);
    overlay.appendChild(dialog);
    nodes.root.appendChild(overlay);
    state.modal = overlay;
    var focusables = modalFocusables();
    (focusables[0] || close).focus();
  }

  function modalFocusables() {
    if (!state.modal) return [];
    return Array.from(state.modal.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])"))
      .filter(function (node) { return !node.disabled && node.offsetParent !== null; });
  }

  function closeModal() {
    if (state.modal) {
      state.modal.remove();
      state.modal = null;
      nodes.settings.focus();
    }
  }

  function renderSettingsModal(body) {
    body.append(
      settingsSection("General", [
        toggleRow("Confirm before insertion", "", "confirmBeforeInsert"),
        toggleRow("Restore last workspace", "", "restoreLastWorkspace"),
        toggleRow("Clear after successful insertion", "", "clearAfterInsert"),
      ]),
      editorVisibilitySection(),
      dockSettingsSection(),
      exportSettingsSection(),
      toolsSection()
    );
    if (ui.showDiagnostics) {
      body.appendChild(diagnosticsSection());
    }
  }

  function settingsSection(title, rows) {
    var section = el("section", "jigma-settings-section");
    section.appendChild(el("h3", "", title));
    rows.forEach(function (row) { section.appendChild(row); });
    return section;
  }

  function toggleRow(label, helper, key) {
    var row = el("label", "jigma-setting-row");
    var text = el("span", "jigma-setting-row__text");
    text.appendChild(el("strong", "", label));
    if (helper) text.appendChild(el("small", "", helper));
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(ui[key]);
    input.addEventListener("change", function () {
      ui[key] = input.checked;
      persistUi();
      if (key === "liveAnalysis") scheduleLiveAnalysis();
      if (key === "showDiagnostics") renderSettingsModalRefresh();
    });
    row.append(text, input);
    return row;
  }

  function defaultCollapsedRow() {
    var row = el("label", "jigma-setting-row");
    var text = el("span", "jigma-setting-row__text");
    text.appendChild(el("strong", "", "Default collapsed"));
    text.appendChild(el("small", "", "Open Jigma as a slim bottom bar when Bricks loads."));
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !ui.openExpandedOnLoad;
    input.addEventListener("change", function () {
      ui.openExpandedOnLoad = !input.checked;
      if (!ui.rememberDockState) {
        ui.dockState = input.checked ? "collapsed" : "expanded";
        syncDockState();
      }
      persistUi();
    });
    row.append(text, input);
    return row;
  }

  function editorVisibilitySection() {
    var section = settingsSection("Editor visibility", []);
    ["html", "css", "js"].forEach(function (kind) {
      var row = el("label", "jigma-setting-row");
      row.appendChild(el("strong", "", kind === "js" ? "JavaScript" : kind.toUpperCase()));
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = ui.visibleEditors[kind] !== false;
      input.addEventListener("change", function () {
        var next = Object.assign({}, ui.visibleEditors);
        next[kind] = input.checked;
        ui.visibleEditors = normalizeVisibility(next);
        persistUi();
        syncEditors();
        renderSettingsModalRefresh();
      });
      row.appendChild(input);
      section.appendChild(row);
    });
    return section;
  }

  function renderSettingsModalRefresh() {
    if (!state.modal) return;
    var body = state.modal.querySelector(".jigma-modal-body");
    if (!body) return;
    body.innerHTML = "";
    renderSettingsModal(body);
  }

  function dockSettingsSection() {
    var section = settingsSection("Dock", []);
    var height = el("label", "jigma-setting-row");
    height.appendChild(el("strong", "", "Dock height"));
    var input = document.createElement("input");
    input.type = "range";
    input.min = "180";
    input.max = String(Math.round(window.innerHeight * 0.65));
    input.value = String(ui.dockHeight);
    input.addEventListener("input", function () {
      ui.dockHeight = Number(input.value);
      persistUi();
      syncDockState();
    });
    height.appendChild(input);
    section.appendChild(height);
    var resetWidths = el("button", "jigma-button", "Reset panel sizes");
    var restoreLayout = el("button", "jigma-button", "Restore default layout");
    var hideDock = el("button", "jigma-button", "Hide dock");
    resetWidths.type = restoreLayout.type = hideDock.type = "button";
    resetWidths.addEventListener("click", function () {
      ui.editorWidths = Object.assign({}, defaultUi.editorWidths);
      persistUi();
      syncEditors();
    });
    restoreLayout.addEventListener("click", function () {
      ui = mergeUi(defaultUi);
      persistUi();
      syncDockState();
      syncEditors();
      renderSettingsModalRefresh();
    });
    hideDock.addEventListener("click", function () {
      closeModal();
      setDockState("hidden");
    });
    section.append(defaultCollapsedRow());
    section.append(toggleRow("Remember dock state", "Persist expanded, collapsed, or hidden state in this browser.", "rememberDockState"));
    section.append(toggleRow("Remember editor widths", "", "rememberEditorWidths"));
    section.append(resetWidths, restoreLayout, hideDock);
    return section;
  }

  function exportSettingsSection() {
    var section = settingsSection("Export", []);
    var includeJs = toggleRow("Include JavaScript", "Creates one disabled Code element when JavaScript exists.", "includeJavaScript");
    includeJs.querySelector("input").disabled = !state.js.trim();
    section.appendChild(includeJs);
    section.appendChild(selectRow("Include page-level CSS", "pageCssMode", [
      ["ask", "Ask each time"],
      ["include", "Always include"],
      ["exclude", "Always exclude"],
    ]));
    section.appendChild(selectRow("Class conflict behaviour", "classConflictMode", [
      ["ask", "Ask"],
      ["reuse", "Reuse matching"],
      ["cancel", "Cancel on conflict"],
    ]));
    return section;
  }

  function selectRow(label, key, options) {
    var row = el("label", "jigma-setting-row");
    row.appendChild(el("strong", "", label));
    var select = document.createElement("select");
    options.forEach(function (option) {
      var node = document.createElement("option");
      node.value = option[0];
      node.textContent = option[1];
      select.appendChild(node);
    });
    select.value = ui[key];
    select.addEventListener("change", function () {
      ui[key] = select.value;
      persistUi();
    });
    row.appendChild(select);
    return row;
  }

  function toolsSection() {
    var section = settingsSection("Tools", []);
    var reset = el("button", "jigma-button", "Reset Jigma UI");
    reset.type = "button";
    reset.addEventListener("click", function () {
      storageRemove(UI_KEY);
      storageRemove(WORKSPACE_KEY);
      storageRemove(SAVED_SECTIONS_KEY);
      ui = mergeUi(defaultUi);
      persistUi();
      syncDockState();
      syncEditors();
      renderSettingsModalRefresh();
    });
    section.append(toggleRow("Show diagnostics", "Show safe local mount and update diagnostics in this settings view.", "showDiagnostics"));
    section.append(reset);
    return section;
  }

  function diagnosticsSection() {
    var section = settingsSection("Diagnostics", []);
    var payload = {
      mounted: Boolean(nodes.root),
      workspaceDetected: Boolean(diagnostics && diagnostics.workspaceDetected),
      dockState: ui.dockState,
      pluginVersion: config.version || "",
      target: state.target && state.target.shortLabel ? state.target.shortLabel : "none",
    };
    var pre = el("pre", "jigma-diagnostics", JSON.stringify(payload, null, 2));
    section.appendChild(pre);
    return section;
  }

  function makeEditor(kind, label) {
    var field = el("section", "jigma-editor jigma-editor--" + kind);
    var header = el("header", "jigma-editor__head");
    var title = el("strong", "", label);
    var badge = el("span", "jigma-editor__badge", kind === "js" ? "None" : "Ready");
    var actions = el("div", "jigma-editor__actions");
    var format = el("button", "jigma-mini-button", "Format");
    var copy = el("button", "jigma-mini-button", "Copy");
    var clear = el("button", "jigma-mini-button", "Clear");
    var textarea = el("textarea", "jigma-editor__textarea");
    format.type = copy.type = clear.type = "button";
    textarea.spellcheck = false;
    textarea.value = state[kind];
    format.addEventListener("click", function () {
      state[kind] = formatSource(kind, state[kind]);
      state.lastRun = null;
      persistWorkspace();
      syncEditors();
      scheduleLiveAnalysis();
    });
    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(state[kind] || "");
    });
    clear.addEventListener("click", function () {
      state[kind] = "";
      state.lastRun = null;
      persistWorkspace();
      syncEditors();
      scheduleLiveAnalysis();
      updateStatus();
    });
    textarea.addEventListener("input", function () {
      state[kind] = textarea.value;
      state.lastRun = null;
      persistWorkspace();
      scheduleLiveAnalysis();
      updateStatus();
    });
    actions.append(format, copy, clear);
    header.append(title, badge, actions);
    field.append(header, textarea);
    return { field: field, textarea: textarea, badge: badge };
  }

  function mountPanel() {
    setInitStage("create-root");
    var root = el("div", "jigma-root");
    root.id = ROOT_ID;
    var launcher = el("button", "jigma-launcher", "Jigma");
    launcher.type = "button";
    launcher.hidden = true;
    launcher.addEventListener("click", function () { setDockState("expanded"); });

    var dock = el("section", "jigma-dock");
    dock.setAttribute("aria-label", "Jigma Bricks dock");

    var toolbar = el("header", "jigma-toolbar");
    var brand = el("div", "jigma-brand");
    var mark = el("span", "jigma-brand__mark", "Jg");
    var wordmark = el("strong", "", "Jigma");
    var target = el("span", "jigma-target is-empty", "No target selected");
    var status = el("button", "jigma-status", "No target selected");
    var actions = el("div", "jigma-actions");
    var run = el("button", "jigma-button jigma-button--preview jigma-action-primary", "Preview");
    var insert = el("button", "jigma-button jigma-button--primary jigma-action-primary", config.insertLabel || "Insert into Selected");
    var copy = el("button", "jigma-button jigma-action-secondary", config.copyLabel || "Copy Structure");
    var settings = el("button", "jigma-icon-button jigma-action-tertiary", "Settings");
    var collapse = el("button", "jigma-icon-button jigma-action-tertiary jigma-expand-toggle", "Collapse");
    var tabs = el("div", "jigma-tabs");
    var editorsWrap = el("div", "jigma-editors");
    var gutters = el("div", "jigma-editor-gutters");
    var drawer = el("aside", "jigma-drawer");
    var resize = el("button", "jigma-dock-resize", "");

    status.type = run.type = insert.type = copy.type = settings.type = collapse.type = resize.type = "button";
    run.title = "Run - Shift + Enter";
    insert.title = "Insert into Selected - Cmd/Ctrl + Shift + Enter";
    copy.title = "Copy Structure - Cmd/Ctrl + Option/Alt + C";
    settings.title = "Settings";
    collapse.title = "Collapse dock - Escape";
    resize.setAttribute("aria-label", "Resize Jigma dock");
    collapse.setAttribute("aria-expanded", "true");
    status.setAttribute("aria-label", "Open Jigma review");

    brand.append(mark, wordmark);
    actions.append(run, insert, copy, status, settings, collapse);
    toolbar.append(brand, target, actions);

    nodes = {
      root: root,
      dock: dock,
      launcher: launcher,
      target: target,
      status: status,
      run: run,
      insert: insert,
      copy: copy,
      settings: settings,
      collapse: collapse,
      tabs: tabs,
      editorsWrap: editorsWrap,
      gutters: gutters,
      drawer: drawer,
      jsBadge: null,
      editors: {},
    };

    [
      ["html", "HTML"],
      ["css", "CSS"],
      ["js", "JavaScript"],
    ].forEach(function (entry) {
      var kind = entry[0];
      var label = entry[1];
      var tab = el("button", "jigma-tab", label);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", function () { setActiveEditor(kind); });
      var editor = makeEditor(kind, label);
      nodes.editors[kind] = Object.assign({ tab: tab }, editor);
      tabs.appendChild(tab);
      editorsWrap.appendChild(editor.field);
      if (kind === "js") nodes.jsBadge = editor.badge;
    });

    setInitStage("render-dock");
    dock.append(resize, toolbar, tabs, editorsWrap, gutters, drawer);
    root.append(dock, launcher);
    setInitStage("append-root");
    document.body.appendChild(root);
    setDiagnostics({ mounted: true, rootFound: true, dockState: ui.dockState });

    setInitStage("wire-actions");
    run.addEventListener("click", doRun);
    insert.addEventListener("click", doInsert);
    copy.addEventListener("click", doCopy);
    status.addEventListener("click", function () {
      state.drawerOpen = !state.drawerOpen;
      state.drawerMode = "review";
      renderReviewDrawer();
    });
    settings.addEventListener("click", openSettingsModal);
    collapse.addEventListener("click", function () {
      setDockState(ui.dockState === "collapsed" ? "expanded" : "collapsed");
    });
    resize.addEventListener("pointerdown", startDockResize);
    resize.addEventListener("keydown", function (event) {
      var delta = event.key === "ArrowUp" ? 12 : event.key === "ArrowDown" ? -12 : 0;
      if (!delta) return;
      event.preventDefault();
      ui.dockHeight = Math.max(180, Math.min(Math.round(window.innerHeight * 0.65), ui.dockHeight + delta));
      persistUi();
      syncDockState();
    });

    root.addEventListener("keydown", handleScopedShortcuts);
    document.addEventListener("click", function () {
      window.setTimeout(updateTarget, 60);
    }, true);
    window.addEventListener("message", updateTarget);
    window.setInterval(updateTarget, 1200);

    setInitStage("sync-state");
    root.dataset.workspace = "detected";
    syncDockState();
    syncEditors();
    renderReviewDrawer();
    window.requestAnimationFrame(function () {
      try {
        setInitStage("workspace-detection");
        updateDockBounds();
        observeWorkspace();
      } catch (error) {
        reportInitializationError("workspace-detection", error);
      }
    });
    setInitStage("target-detection");
    updateTarget();
    setInitStage("mounted");
  }

  function startDockResize(event) {
    event.preventDefault();
    var startY = event.clientY;
    var startHeight = nodes.dock.getBoundingClientRect().height;
    function move(moveEvent) {
      ui.dockHeight = Math.max(180, Math.min(Math.round(window.innerHeight * 0.65), startHeight + startY - moveEvent.clientY));
      syncDockState();
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      persistUi();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function handleScopedShortcuts(event) {
    var modifier = event.metaKey || event.ctrlKey;
    var alt = event.altKey;
    if (state.modal && event.key === "Tab") {
      var focusables = modalFocusables();
      if (focusables.length > 0) {
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (state.modal) closeModal();
      else if (state.drawerOpen) {
        state.drawerOpen = false;
        renderReviewDrawer();
      } else setDockState("collapsed");
    } else if (event.key === "Enter" && event.shiftKey && !modifier) {
      event.preventDefault();
      doRun();
    } else if (event.key === "Enter" && event.shiftKey && modifier) {
      event.preventDefault();
      doInsert();
    } else if (event.key.toLowerCase() === "c" && modifier && alt) {
      event.preventDefault();
      doCopy();
    }
  }

  waitForBody(function () {
    try {
      setInitStage("builder-context");
      setDiagnostics({
        configLoaded: Boolean(window.JigmaBricksPlugin),
        coreLoaded: Boolean(window.JigmaCore && typeof window.JigmaCore.convertToBricksCompatibility === "function"),
      });
      if (!isRealBricksBuilderContext()) {
        abortMount("not-builder-context");
        return;
      }
      window.JigmaBricksPanelLoaded = true;
      setInitStage("workspace-ready");
      waitForWorkspace(function (workspace) {
        try {
          if (!workspace) {
            abortMount("missing-bricks-workspace");
            return;
          }
          setInitStage("mount");
          mountPanel();
        } catch (error) {
          reportInitializationError(initStage, error);
        }
      });
    } catch (error) {
      reportInitializationError(initStage, error);
    }
  });
})();
