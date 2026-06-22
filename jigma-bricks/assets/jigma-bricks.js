(function () {
  "use strict";

  if (window.JigmaBricksPanelLoaded) {
    return;
  }
  window.JigmaBricksPanelLoaded = true;

  var config = window.JigmaBricksPlugin || {};
  var storagePrefix = "jigma.bricks.beta.";
  var savedSectionsKey = storagePrefix + "savedSections";
  var dockOpenKey = storagePrefix + "dockOpen";
  var dockHeightKey = storagePrefix + "dockHeight";
  var selectedSectionId = "";

  var state = {
    html: "",
    css: "",
    js: "",
    includeJavaScriptCode: false,
    pageStylesDecision: "none",
    lastRun: null,
    target: null,
    drawerOpen: false,
    activeEditor: "html",
  };

  var contentSummary = Array.isArray(config.contentSummary) ? config.contentSummary : [];
  var contentById = new Map(contentSummary.map(function (element) {
    return [String(element.id), element];
  }));

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function readSavedSections() {
    return safeJsonParse(localStorage.getItem(savedSectionsKey) || "[]", []).filter(function (item) {
      return item && typeof item === "object";
    });
  }

  function writeSavedSections(items) {
    localStorage.setItem(savedSectionsKey, JSON.stringify(items));
  }

  function makeSectionName() {
    return "Jigma Section " + new Date().toLocaleString();
  }

  function currentSource(name) {
    return {
      id: "section-" + Date.now().toString(36),
      name: name || makeSectionName(),
      updatedAt: new Date().toISOString(),
      html: state.html,
      css: state.css,
      javascript: state.js,
      prefix: "jg",
      blockName: "section",
    };
  }

  function saveCurrentSection() {
    var items = readSavedSections();
    var existingIndex = selectedSectionId
      ? items.findIndex(function (item) { return item.id === selectedSectionId; })
      : -1;
    var next = currentSource(existingIndex >= 0 ? items[existingIndex].name : makeSectionName());
    if (existingIndex >= 0) {
      next.id = selectedSectionId;
      items[existingIndex] = next;
    } else {
      selectedSectionId = next.id;
      items.unshift(next);
    }
    writeSavedSections(items.slice(0, 40));
    return next;
  }

  function duplicateCurrentSection() {
    var items = readSavedSections();
    var source = selectedSectionId
      ? items.find(function (item) { return item.id === selectedSectionId; })
      : null;
    var next = Object.assign({}, source || currentSource("Jigma Section"), {
      id: "section-" + Date.now().toString(36),
      name: ((source && source.name) || "Jigma Section") + " Copy",
      updatedAt: new Date().toISOString(),
    });
    items.unshift(next);
    writeSavedSections(items.slice(0, 40));
    selectedSectionId = next.id;
    return next;
  }

  function loadSection(section) {
    state.html = section.html || "";
    state.css = section.css || "";
    state.js = section.javascript || "";
    selectedSectionId = section.id || "";
    state.lastRun = null;
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
    if (active) {
      return active.getAttribute("data-bricks-element-id") ||
        active.getAttribute("data-bricks-id") ||
        active.getAttribute("data-id") ||
        "";
    }

    return "";
  }

  function describeTarget(id) {
    if (!id) {
      return {
        id: "",
        exists: false,
        acceptsChildren: false,
        label: "No target selected",
        message: "Select a container in Bricks before inserting.",
      };
    }

    var summary = contentById.get(String(id));
    if (!summary) {
      return {
        id: String(id),
        exists: false,
        acceptsChildren: false,
        label: "Unknown target - " + id,
        message: "The selected Bricks element is not in the saved page content. Save or reload Bricks, then select it again.",
      };
    }

    if (!summary.acceptsChildren) {
      var lockedMessage = summary.locked
        ? "The selected element is locked or unsuitable for insertion. Select another nestable element."
        : "The selected element cannot contain children. Select its parent container or another nestable element.";
      return {
        id: String(id),
        exists: true,
        acceptsChildren: false,
        label: (summary.label || summary.name || "Element") + " - " + summary.name + " - " + id,
        message: lockedMessage,
      };
    }

    return {
      id: String(id),
      exists: true,
      acceptsChildren: true,
      label: (summary.label || summary.name || "Element") + " - " + summary.name + " - " + id,
      message: "Ready to insert.",
    };
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
      form.append("schemaVersion", config.compatibilitySchemaVersion || "bricks-compatibility.v1");

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
      includeJavaScriptCode: state.includeJavaScriptCode,
    });

    state.lastRun = result;
    state.pageStylesDecision = result.pageLevelCss.ruleCount > 0 ? "" : "none";
    return result;
  }

  function minimalPayload(result) {
    return JSON.stringify(result.payload, null, 2);
  }

  function mountPanel() {
    var dock = el("section", "jigma-bricks-dock");
    var header = el("header", "jigma-bricks-dock__header");
    var brand = el("div", "jigma-bricks-brand");
    var mark = el("span", "jigma-bricks-brand__mark", "J");
    var wordmark = el("strong", "", "Jigma");
    var target = el("span", "jigma-bricks-target", "Target: none");
    var actions = el("div", "jigma-bricks-actions");
    var run = el("button", "jigma-bricks-button", "Run");
    var insert = el("button", "jigma-bricks-button jigma-bricks-button--primary", "Insert into Selected");
    var copy = el("button", "jigma-bricks-button", "Copy Structure");
    var settings = el("button", "jigma-bricks-icon-button", "Review");
    var collapse = el("button", "jigma-bricks-icon-button", "Collapse");
    var editors = el("div", "jigma-bricks-editors");
    var tabs = el("div", "jigma-bricks-tabs");
    var drawer = el("aside", "jigma-bricks-drawer");
    var footer = el("footer", "jigma-bricks-footer");
    var status = el("p", "jigma-bricks-status", "Select a container in Bricks before inserting.");
    var save = el("button", "jigma-bricks-button", "Save Section");
    var duplicate = el("button", "jigma-bricks-button", "Duplicate Section");

    run.title = "Run - Shift + Enter";
    insert.title = "Insert into Selected - Cmd/Ctrl + Shift + Enter";
    copy.title = "Copy Structure - Cmd/Ctrl + Option/Alt + C";
    save.title = "Save Section - Cmd/Ctrl + Option/Alt + S";
    duplicate.title = "Duplicate Section - Cmd/Ctrl + Option/Alt + D";
    settings.title = "Open review drawer";
    collapse.title = "Collapse dock - Escape";

    brand.append(mark, wordmark);
    actions.append(run, insert, copy, settings, collapse);
    header.append(brand, target, actions);

    var editorFields = {};
    ["html", "css", "js"].forEach(function (kind) {
      var label = kind === "js" ? "JavaScript" : kind.toUpperCase();
      var tab = el("button", "jigma-bricks-tab", label);
      var field = el("label", "jigma-bricks-field jigma-bricks-field--" + kind);
      var fieldLabel = el("span", "", label);
      var textarea = el("textarea", "jigma-bricks-editor");
      textarea.spellcheck = false;
      textarea.value = state[kind];
      textarea.addEventListener("input", function () {
        state[kind] = textarea.value;
        state.lastRun = null;
        updateStatus();
      });
      tab.addEventListener("click", function () {
        state.activeEditor = kind;
        syncEditors();
      });
      field.append(fieldLabel, textarea);
      tabs.appendChild(tab);
      editors.appendChild(field);
      editorFields[kind] = { tab: tab, field: field, textarea: textarea };
    });

    footer.append(status, save, duplicate);
    dock.append(header, tabs, editors, drawer, footer);
    document.body.appendChild(dock);

    function syncEditors() {
      Object.keys(editorFields).forEach(function (kind) {
        editorFields[kind].textarea.value = state[kind];
        editorFields[kind].tab.classList.toggle("is-active", state.activeEditor === kind);
        editorFields[kind].field.classList.toggle("is-active", state.activeEditor === kind);
      });
    }

    function renderDrawer(errorData) {
      drawer.innerHTML = "";
      drawer.classList.toggle("is-open", state.drawerOpen);

      var review = el("section", "jigma-bricks-review");
      review.appendChild(el("h3", "", "Review"));

      if (state.lastRun) {
        var diagnostics = state.lastRun.diagnostics;
        var pageStyles = state.lastRun.pageLevelCss;
        review.appendChild(el("p", "", diagnostics.elementCount + " elements, " + diagnostics.classCount + " classes."));
        if (pageStyles.ruleCount > 0) {
          var groupText = pageStyles.groups.map(function (group) {
            return group.count + " " + group.label;
          }).join(", ");
          review.appendChild(el("p", "jigma-bricks-review__item", "Page-level CSS detected: " + groupText + "."));
          var include = el("button", "jigma-bricks-button", "Include as Jigma Page Styles");
          var exclude = el("button", "jigma-bricks-button", "Exclude page styles");
          include.addEventListener("click", function () {
            state.pageStylesDecision = "include";
            updateStatus();
          });
          exclude.addEventListener("click", function () {
            state.pageStylesDecision = "exclude";
            updateStatus();
          });
          review.append(include, exclude);
        }
        if (state.js.trim()) {
          var jsToggle = el("label", "jigma-bricks-check");
          var input = document.createElement("input");
          input.type = "checkbox";
          input.checked = state.includeJavaScriptCode;
          input.addEventListener("change", function () {
            state.includeJavaScriptCode = input.checked;
            state.lastRun = null;
            updateStatus();
          });
          jsToggle.append(input, el("span", "", "Include JavaScript as disabled Code element"));
          review.appendChild(jsToggle);
        }
      } else {
        review.appendChild(el("p", "", "Run Jigma to generate a Bricks Compatibility payload."));
      }

      if (errorData && Array.isArray(errorData.conflicts)) {
        errorData.conflicts.forEach(function (conflict) {
          review.appendChild(el("p", "jigma-bricks-review__item", "Class conflict: " + (conflict.name || "class") + ". Resolve it in Bricks or cancel insertion."));
        });
      }

      var saved = el("section", "jigma-bricks-saved");
      saved.appendChild(el("h3", "", "Saved Sections"));
      var saveCurrent = el("button", "jigma-bricks-button", "Save current");
      var importJson = el("button", "jigma-bricks-button", "Import JSON");
      saveCurrent.addEventListener("click", function () {
        saveCurrentSection();
        renderDrawer();
        updateStatus("Section saved.");
      });
      importJson.addEventListener("click", function () {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.addEventListener("change", function () {
          var file = input.files && input.files[0];
          if (!file) return;
          file.text().then(function (text) {
            var parsed = safeJsonParse(text, null);
            if (!parsed) throw new Error("Invalid section JSON.");
            loadSection(parsed);
            syncEditors();
            renderDrawer();
            updateStatus("Section imported.");
          }).catch(function (error) {
            updateStatus(error.message || "Import failed.");
          });
        });
        input.click();
      });
      saved.append(saveCurrent, importJson);

      readSavedSections().forEach(function (section) {
        var row = el("article", "jigma-bricks-saved__row");
        var name = el("strong", "", section.name || "Jigma Section");
        var date = el("span", "", section.updatedAt ? new Date(section.updatedAt).toLocaleString() : "");
        var load = el("button", "jigma-bricks-button", "Load");
        var menu = el("button", "jigma-bricks-button", "Menu");
        load.addEventListener("click", function () {
          loadSection(section);
          syncEditors();
          updateStatus("Section loaded.");
        });
        menu.addEventListener("click", function () {
          var action = window.prompt("Rename, Duplicate, Export JSON, or Delete?", "Rename");
          var items = readSavedSections();
          var index = items.findIndex(function (item) { return item.id === section.id; });
          if (index < 0 || !action) return;
          if (/rename/i.test(action)) {
            var nextName = window.prompt("Section name", items[index].name || "Jigma Section");
            if (nextName) items[index].name = nextName;
          } else if (/duplicate/i.test(action)) {
            items.unshift(Object.assign({}, items[index], {
              id: "section-" + Date.now().toString(36),
              name: (items[index].name || "Jigma Section") + " Copy",
              updatedAt: new Date().toISOString(),
            }));
          } else if (/export/i.test(action)) {
            navigator.clipboard.writeText(JSON.stringify(items[index], null, 2));
          } else if (/delete/i.test(action)) {
            items.splice(index, 1);
          }
          writeSavedSections(items);
          renderDrawer();
        });
        row.append(name, date, load, menu);
        saved.appendChild(row);
      });

      drawer.append(review, saved);
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

    function updateTarget() {
      state.target = JigmaBricksInsertAdapter.inspect().selectedTarget;
      target.textContent = "Target: " + state.target.label;
      target.classList.toggle("is-ready", Boolean(state.target.acceptsChildren));
      updateStatus();
    }

    function updateStatus(message) {
      if (message) {
        status.textContent = message;
      } else if (!state.target || !state.target.id) {
        status.textContent = "Select a container in Bricks before inserting.";
      } else if (!state.target.exists || !state.target.acceptsChildren) {
        status.textContent = state.target.message;
      } else if (!state.lastRun) {
        status.textContent = "Ready to run.";
      } else if (state.lastRun.pageLevelCss.ruleCount > 0 && !state.pageStylesDecision) {
        status.textContent = "Page-level CSS review required before insertion.";
      } else {
        status.textContent = "Ready to insert: " +
          state.lastRun.diagnostics.elementCount + " elements, " +
          state.lastRun.diagnostics.classCount + " classes, " +
          state.lastRun.pageLevelCss.ruleCount + " page-level CSS review, " +
          state.lastRun.diagnostics.unsignedJavaScriptCount + " unsigned JavaScript element.";
      }
      insert.disabled = !canInsert();
    }

    function doRun() {
      try {
        var result = runConversion();
        state.drawerOpen = result.pageLevelCss.ruleCount > 0 || result.diagnostics.warnings.length > 0;
        renderDrawer();
        updateStatus();
      } catch (error) {
        updateStatus(error.message || "Jigma run failed.");
      }
    }

    function doCopy() {
      try {
        var result = state.lastRun || runConversion();
        navigator.clipboard.writeText(minimalPayload(result)).then(function () {
          updateStatus("Bricks Compatibility payload copied.");
        }).catch(function () {
          updateStatus("Clipboard copy failed.");
          console.log("Jigma Bricks payload", result.payload);
        });
      } catch (error) {
        updateStatus(error.message || "Copy failed.");
      }
    }

    function doInsert() {
      if (!canInsert()) {
        updateStatus();
        return;
      }
      var pageStylesCss = state.pageStylesDecision === "include"
        ? state.lastRun.pageLevelCss.css
        : "";
      insert.disabled = true;
      JigmaBricksInsertAdapter.insert(state.lastRun.payload, {
        includeJsCode: state.includeJavaScriptCode,
        pageStylesCss: pageStylesCss,
      }).then(function (data) {
        var codeWarning = data.codeWarnings && data.codeWarnings.length ? " " + data.codeWarnings[0] : "";
        updateStatus((data.message || "Inserted into selected target.") + codeWarning);
      }).catch(function (error) {
        state.drawerOpen = true;
        renderDrawer(error.data || {});
        updateStatus(error.message || "Insert failed.");
      }).finally(function () {
        insert.disabled = !canInsert();
      });
    }

    run.addEventListener("click", doRun);
    insert.addEventListener("click", doInsert);
    copy.addEventListener("click", doCopy);
    settings.addEventListener("click", function () {
      state.drawerOpen = !state.drawerOpen;
      renderDrawer();
    });
    collapse.addEventListener("click", function () {
      dock.classList.toggle("is-collapsed");
      localStorage.setItem(dockOpenKey, dock.classList.contains("is-collapsed") ? "0" : "1");
    });
    save.addEventListener("click", function () {
      saveCurrentSection();
      renderDrawer();
      updateStatus("Section saved.");
    });
    duplicate.addEventListener("click", function () {
      duplicateCurrentSection();
      renderDrawer();
      updateStatus("Section duplicated.");
    });

    dock.addEventListener("keydown", function (event) {
      var modifier = event.metaKey || event.ctrlKey;
      var alt = event.altKey;
      if (event.key === "Escape") {
        event.preventDefault();
        if (state.drawerOpen) {
          state.drawerOpen = false;
          renderDrawer();
        } else {
          dock.classList.add("is-collapsed");
        }
      } else if (event.key === "Enter" && event.shiftKey && !modifier) {
        event.preventDefault();
        doRun();
      } else if (event.key === "Enter" && event.shiftKey && modifier) {
        event.preventDefault();
        doInsert();
      } else if (event.key.toLowerCase() === "c" && modifier && alt) {
        event.preventDefault();
        doCopy();
      } else if (event.key.toLowerCase() === "s" && modifier && alt) {
        event.preventDefault();
        saveCurrentSection();
        renderDrawer();
        updateStatus("Section saved.");
      } else if (event.key.toLowerCase() === "d" && modifier && alt) {
        event.preventDefault();
        duplicateCurrentSection();
        renderDrawer();
        updateStatus("Section duplicated.");
      }
    });

    var savedHeight = Number(localStorage.getItem(dockHeightKey) || 0);
    if (savedHeight >= 260 && savedHeight <= 720) {
      dock.style.setProperty("--jigma-dock-height", savedHeight + "px");
    }
    if (localStorage.getItem(dockOpenKey) === "0") {
      dock.classList.add("is-collapsed");
    }

    var resizeHandle = el("div", "jigma-bricks-resize");
    dock.appendChild(resizeHandle);
    resizeHandle.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      var startY = event.clientY;
      var startHeight = dock.getBoundingClientRect().height;
      function move(moveEvent) {
        var nextHeight = Math.min(720, Math.max(260, startHeight + startY - moveEvent.clientY));
        dock.style.setProperty("--jigma-dock-height", nextHeight + "px");
        localStorage.setItem(dockHeightKey, String(Math.round(nextHeight)));
      }
      function stop() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    });

    document.addEventListener("click", function () {
      window.setTimeout(updateTarget, 60);
    }, true);
    window.addEventListener("message", updateTarget);
    window.setInterval(updateTarget, 1000);

    syncEditors();
    renderDrawer();
    updateTarget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPanel);
  } else {
    mountPanel();
  }
})();
