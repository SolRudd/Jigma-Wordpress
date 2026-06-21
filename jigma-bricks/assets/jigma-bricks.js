(function () {
  "use strict";

  if (window.JigmaBricksPanelLoaded) {
    return;
  }
  window.JigmaBricksPanelLoaded = true;

  var config = window.JigmaBricksPlugin || {};
  var targetVersion = config.targetBricksVersion || "2.3.7";
  var hiddenTags = new Set(["script", "style", "link", "meta", "title", "base", "template"]);
  var wrapperTags = new Set(["div", "article", "header", "main", "footer", "nav", "aside", "ul", "ol"]);
  var textTags = new Set(["p", "span", "strong", "em", "small", "b", "i", "mark", "li"]);
  var blockSuffixWords = new Set(["area", "block", "component", "container", "layout", "module", "section", "wrapper", "wrap"]);
  var modifierWords = new Set(["active", "compact", "dark", "disabled", "featured", "ghost", "inverse", "large", "lg", "light", "muted", "outline", "primary", "secondary", "selected", "small", "sm", "solid", "tertiary", "wide"]);
  var genericWords = new Set(["block", "component", "layout", "module", "section", "wrapper"]);
  var projectPrefixWords = new Set(["jig", "jigma", "ui", "c"]);
  var BRICKS_ELEMENT_CUSTOM_CSS_FIELD = "_cssCustom";

  var state = {
    html: '<section class="hero-section">\\n  <div class="hero-content">\\n    <p class="hero-eyebrow">Code to Bricks</p>\\n    <h1 class="hero-title">Paste code. Copy Bricks structure.</h1>\\n    <p class="hero-text">Jigma creates element classes and Bricks-ready structure from pasted frontend code.</p>\\n    <div class="hero-actions">\\n      <a class="hero-button hero-button--primary" href="#start">Start</a>\\n      <a class="hero-button hero-button--secondary" href="#preview">Preview</a>\\n    </div>\\n  </div>\\n</section>',
    css: ".hero-section {\\n  padding: 72px 48px;\\n  background: #080b16;\\n  color: white;\\n}\\n\\n.hero-content {\\n  max-width: 760px;\\n}\\n\\n.hero-title {\\n  font-size: 64px;\\n  line-height: 1;\\n}\\n\\n.hero-button {\\n  display: inline-flex;\\n  padding: 14px 18px;\\n  border-radius: 10px;\\n}\\n\\n.hero-button--secondary {\\n  border: 1px solid currentColor;\\n}\\n\\n@media (max-width: 820px) {\\n  .hero-title {\\n    font-size: 42px;\\n  }\\n}",
    js: "",
    includeJsCode: false,
    lastExport: null,
  };

  var JigmaBricksInsertAdapter = {
    inspect: function () {
      var postId = Number(config.postId || 0);
      var globals = ["bricksData", "BRICKS_DATA", "bricksBuilder", "Bricks"].filter(function (key) {
        return Boolean(window[key]);
      });

      if (!postId && window.bricksData && window.bricksData.postId) {
        postId = Number(window.bricksData.postId);
      }

      if (!postId && window.BRICKS_DATA && window.BRICKS_DATA.postId) {
        postId = Number(window.BRICKS_DATA.postId);
      }

      if (!postId) {
        var bodyClass = document.body ? document.body.className.match(/\bpostid-(\d+)\b/) : null;
        if (bodyClass) {
          postId = Number(bodyClass[1]);
        }
      }

      return {
        postId: postId || 0,
        globals: globals,
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

      form.append("action", "jigma_bricks_insert");
      form.append("nonce", config.insertNonce);
      form.append("postId", String(details.postId));
      form.append("payload", JSON.stringify(payload));
      form.append("includeJsCode", options && options.includeJsCode ? "1" : "");

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
          throw new Error(data && data.data && data.data.message ? data.data.message : "Jigma insert was rejected by WordPress.");
        }
        return data.data || {};
      });
    },
  };

  window.JigmaBricksInsertAdapter = JigmaBricksInsertAdapter;

  function sanitizePart(value, fallback) {
    var cleaned = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleaned) {
      return fallback;
    }

    return /^[a-z]/.test(cleaned) ? cleaned : fallback + "-" + cleaned;
  }

  function stripKnownPrefix(value, projectPrefix) {
    var parts = value.split("-").filter(Boolean);
    if (parts.length <= 1) {
      return value;
    }

    if (parts[0] === projectPrefix || projectPrefixWords.has(parts[0])) {
      return parts.slice(1).join("-");
    }

    return value;
  }

  function stripBlockSuffix(value) {
    var parts = value.split("-").filter(Boolean);
    var last = parts[parts.length - 1];
    if (parts.length > 1 && blockSuffixWords.has(last)) {
      return parts.slice(0, -1).join("-");
    }
    return value;
  }

  function splitClassBase(className) {
    return sanitizePart(String(className || "").split("--")[0].split("__")[0], "");
  }

  function getClassNames(element) {
    return Array.from(element.classList || []).filter(Boolean);
  }

  function isUseful(value) {
    return Boolean(value) && !genericWords.has(value) && !modifierWords.has(value);
  }

  function hash(seed) {
    var value = 2166136261;
    for (var index = 0; index < seed.length; index += 1) {
      value ^= seed.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    var id = (value >>> 0).toString(36).padStart(6, "0").slice(0, 6);
    return /^[a-z]/.test(id) ? id : "j" + id.slice(1);
  }

  function textOf(element) {
    return Array.from(element.childNodes || [])
      .filter(function (node) { return node.nodeType === Node.TEXT_NODE; })
      .map(function (node) { return node.textContent.replace(/\s+/g, " ").trim(); })
      .filter(Boolean)
      .join(" ");
  }

  function fullTextOf(element) {
    return (element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function inferRoot(element, projectPrefix, fallbackBlock) {
    var classes = getClassNames(element);
    for (var index = 0; index < classes.length; index += 1) {
      var rawBase = splitClassBase(classes[index]);
      var normalized = stripKnownPrefix(rawBase, projectPrefix);
      var candidate = stripBlockSuffix(normalized);
      if (!isUseful(candidate)) {
        continue;
      }

      var removedSuffix = normalized !== candidate;
      var preserveRaw = !removedSuffix && rawBase.indexOf("-") !== -1;
      return {
        blockPart: candidate,
        blockName: preserveRaw ? rawBase : projectPrefix + "-" + candidate,
        rootBases: Array.from(new Set([rawBase, normalized, candidate])).filter(Boolean),
      };
    }

    return {
      blockPart: fallbackBlock,
      blockName: projectPrefix + "-" + fallbackBlock,
      rootBases: [fallbackBlock],
    };
  }

  function stripRootPrefix(value, rootBases) {
    for (var index = 0; index < rootBases.length; index += 1) {
      var rootBase = rootBases[index];
      if (value === rootBase) {
        return "";
      }
      if (value.indexOf(rootBase + "-") === 0) {
        return value.slice(rootBase.length + 1);
      }
    }
    return value;
  }

  function explicitModifier(classNames, role, projectPrefix) {
    for (var index = 0; index < classNames.length; index += 1) {
      var explicit = String(classNames[index]).split("--")[1];
      if (explicit) {
        return sanitizePart(explicit, "");
      }
    }

    for (var nextIndex = 0; nextIndex < classNames.length; nextIndex += 1) {
      var candidate = sanitizePart(stripKnownPrefix(classNames[nextIndex], projectPrefix), "");
      if (modifierWords.has(candidate)) {
        return candidate;
      }
      if (candidate.indexOf(role + "-") === 0) {
        var maybeModifier = candidate.slice(role.length + 1);
        if (modifierWords.has(maybeModifier)) {
          return maybeModifier;
        }
      }
    }

    return "";
  }

  function tagFallbackRole(element) {
    var tag = element.tagName.toLowerCase();
    if (tag === "h1") {
      return "title";
    }
    if (/^h[2-6]$/.test(tag)) {
      return "heading";
    }
    if (tag === "a") {
      return "button";
    }
    if (tag === "button") {
      return "button";
    }
    if (tag === "img") {
      return "image";
    }
    if (tag === "svg") {
      return "svg";
    }
    if (textTags.has(tag)) {
      return "text";
    }
    return "block";
  }

  function inferElementRole(element, context) {
    var classNames = getClassNames(element);

    for (var index = 0; index < classNames.length; index += 1) {
      var className = classNames[index];
      if (className.indexOf("__") === -1) {
        continue;
      }

      var parts = className.toLowerCase().split("__");
      var base = stripKnownPrefix(sanitizePart(parts[0].split("--")[0], ""), context.projectPrefix);
      var elementPart = sanitizePart(parts[1].split("--")[0], "");
      var baseWithoutRoot = stripRootPrefix(base, context.rootBases);
      var role = baseWithoutRoot && isUseful(baseWithoutRoot)
        ? sanitizePart(baseWithoutRoot + "-" + elementPart, "")
        : elementPart;
      if (isUseful(role)) {
        return { role: role, modifier: explicitModifier(classNames, role, context.projectPrefix) };
      }
    }

    for (var nextIndex = 0; nextIndex < classNames.length; nextIndex += 1) {
      var normalized = stripKnownPrefix(splitClassBase(classNames[nextIndex]), context.projectPrefix);
      var withoutRoot = stripRootPrefix(normalized, context.rootBases);
      var candidate = stripBlockSuffix(withoutRoot || normalized);
      var candidateParts = candidate.split("-").filter(Boolean);
      var modifier = "";
      var last = candidateParts[candidateParts.length - 1];
      if (candidateParts.length > 1 && modifierWords.has(last)) {
        modifier = last;
        candidate = candidateParts.slice(0, -1).join("-");
      }
      if (isUseful(candidate)) {
        return {
          role: candidate,
          modifier: modifier || explicitModifier(classNames, candidate, context.projectPrefix),
        };
      }
    }

    var fallback = tagFallbackRole(element);
    return {
      role: fallback,
      modifier: explicitModifier(classNames, fallback, context.projectPrefix),
    };
  }

  function classListFor(bemClass) {
    if (bemClass.indexOf("__") !== -1 && bemClass.indexOf("--") !== -1) {
      return [bemClass.split("--")[0], bemClass];
    }
    return [bemClass];
  }

  function makeGlobalClassId(className, usedIds) {
    var attempt = 0;
    var id = hash("class:" + className);
    while (usedIds.has(id)) {
      attempt += 1;
      id = hash("class:" + className + ":" + attempt);
    }
    usedIds.add(id);
    return id;
  }

  function createGlobalClasses(targets) {
    var seen = new Set();
    var usedIds = new Set();
    var classes = [];

    targets.forEach(function (target) {
      target.classList.forEach(function (className) {
        if (seen.has(className)) {
          return;
        }
        seen.add(className);
        classes.push({
          id: makeGlobalClassId(className, usedIds),
          name: className,
          settings: {},
        });
      });
    });

    return classes;
  }

  function globalClassIdMap(globalClasses) {
    var map = new Map();
    globalClasses.forEach(function (globalClass) {
      map.set(globalClass.name, globalClass.id);
    });
    return map;
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
      .join(" ");
  }

  function labelFromBem(bemClass, tagName, parentLabel) {
    var cleaned = bemClass.replace(/^jg-/, "");
    if (cleaned.indexOf("__") === -1) {
      return titleCase(stripBlockSuffix(cleaned)) + " Section";
    }

    var block = stripBlockSuffix(cleaned.split("__")[0]);
    var rest = cleaned.split("__")[1];
    var element = rest.split("--")[0];
    var modifier = rest.split("--")[1] || "";
    var label = titleCase(block + "-" + element + (modifier ? "-" + modifier : ""));

    if (tagName === "svg" && parentLabel && label.indexOf("SVG") === -1) {
      return parentLabel + " SVG";
    }

    return label;
  }

  function bricksMapping(element) {
    var tag = element.tagName.toLowerCase();
    var text = fullTextOf(element);

    if (tag === "section") {
      return "section";
    }
    if (/^h[1-6]$/.test(tag)) {
      return "heading";
    }
    if (tag === "img") {
      return "image";
    }
    if (tag === "a") {
      return "text-link";
    }
    if (tag === "button") {
      return "button";
    }
    if (tag === "svg") {
      return "svg";
    }
    if (textTags.has(tag) && element.children.length === 0 && text) {
      return "text-basic";
    }
    return "div";
  }

  function elementSettings(element, name) {
    var tag = element.tagName.toLowerCase();
    var settings = {};
    var text = (name === "heading" || name === "text-link" || name === "button")
      ? fullTextOf(element)
      : textOf(element);

    if (element.id) {
      settings._cssId = element.id;
    }

    if (name === "heading") {
      settings.text = text;
      settings.tag = tag;
    }

    if (name === "text-basic" || name === "button" || name === "text-link") {
      settings.text = text;
    }

    if (name === "button" || name === "text-link") {
      var href = element.getAttribute("href");
      if (href) {
        settings.link = {
          type: href.indexOf("#") === 0 ? "internal" : "external",
          url: href,
        };
      }
    }

    if (name === "image") {
      var src = element.getAttribute("src");
      if (src) {
        settings.image = { url: src };
      }
      if (element.getAttribute("alt")) {
        settings.altText = element.getAttribute("alt");
      }
    }

    if (name === "svg") {
      settings.svg = element.outerHTML;
    }

    return settings;
  }

  function parseHtml(html) {
    var parser = new DOMParser();
    var document = parser.parseFromString(html || "", "text/html");
    return Array.from(document.body.children || []).filter(function (element) {
      return !hiddenTags.has(element.tagName.toLowerCase());
    });
  }

  function createTargets(roots, options, warnings) {
    var content = [];
    var targets = [];
    var projectPrefix = sanitizePart(options.projectPrefix || "jg", "jg");
    var fallbackBlock = sanitizePart(options.blockName || "section", "section");
    var rootChoice = roots[0]
      ? inferRoot(roots[0], projectPrefix, fallbackBlock)
      : { blockName: projectPrefix + "-" + fallbackBlock, blockPart: fallbackBlock, rootBases: [fallbackBlock] };
    var context = {
      projectPrefix: projectPrefix,
      blockName: rootChoice.blockName,
      rootBases: rootChoice.rootBases,
      roleCounts: {},
      rootCount: 0,
    };

    function makeElementClass(role, modifier) {
      var base = context.blockName + "__" + role + (modifier ? "--" + modifier : "");
      if (modifier || ["button", "card", "content", "icon", "image", "label", "metric", "number", "title"].indexOf(role) !== -1) {
        return base;
      }
      var count = (context.roleCounts[role] || 0) + 1;
      context.roleCounts[role] = count;
      return count === 1 ? base : base + "-" + count;
    }

    function walk(element, parent, path) {
      var tag = element.tagName.toLowerCase();
      if (hiddenTags.has(tag)) {
        return null;
      }

      var name = bricksMapping(element);
      var sourceClasses = getClassNames(element);
      var bemClass;

      if (parent === 0) {
        context.rootCount += 1;
        bemClass = context.rootCount === 1
          ? context.blockName
          : context.blockName + "--root-" + context.rootCount;
      } else {
        var semantics = inferElementRole(element, context);
        bemClass = makeElementClass(semantics.role, semantics.modifier);
      }

      var id = hash(path + ":" + tag + ":" + bemClass + ":" + fullTextOf(element).slice(0, 80));
      var settings = elementSettings(element, name);
      var classList = classListFor(bemClass);

      var parentElement = parent === 0 ? null : content.find(function (item) { return item.id === parent; });
      var bricksElement = {
        id: id,
        name: name,
        parent: parent,
        children: [],
        settings: settings,
        label: labelFromBem(bemClass, tag, parentElement && parentElement.label),
      };

      content.push(bricksElement);
      targets.push({
        element: bricksElement,
        bemClass: bemClass,
        classList: classList,
        sourceClasses: sourceClasses,
        sourceId: element.id || "",
      });

      if (wrapperTags.has(tag) && name === "div" && tag !== "div") {
        warnings.push({ severity: "info", message: "<" + tag + "> was exported as a Bricks Div." });
      }

      var childIndex = 0;
      Array.from(element.children || []).forEach(function (child) {
        if (hiddenTags.has(child.tagName.toLowerCase())) {
          return;
        }
        var childId = walk(child, id, path + "-" + childIndex);
        childIndex += 1;
        if (childId) {
          bricksElement.children.push(childId);
        }
      });

      return id;
    }

    roots.forEach(function (root, index) {
      walk(root, 0, String(index));
    });

    if (content.length === 0) {
      warnings.push({ severity: "error", message: "No renderable HTML elements were found." });
    }

    return { content: content, targets: targets, blockName: context.blockName };
  }

  function declarationsFromStyle(style) {
    return Array.from(style || []).map(function (property) {
      var priority = style.getPropertyPriority(property);
      return "  " + property + ": " + style.getPropertyValue(property).trim() + (priority ? " !" + priority : "") + ";";
    }).join("\n");
  }

  function parseCssRulesWithCssom(css) {
    if (!css.trim()) {
      return [];
    }

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    try {
      var rules = [];

      function collect(ruleList, mediaText) {
        Array.from(ruleList || []).forEach(function (rule) {
          if (rule.type === CSSRule.STYLE_RULE) {
            rules.push({
              selector: rule.selectorText,
              declarations: declarationsFromStyle(rule.style),
              media: mediaText || "",
            });
          } else if (rule.type === CSSRule.MEDIA_RULE) {
            collect(rule.cssRules, rule.conditionText || rule.media.mediaText || "");
          }
        });
      }

      collect(style.sheet.cssRules, "");
      return rules;
    } catch (error) {
      return [];
    } finally {
      style.remove();
    }
  }

  function parseCssRulesFallback(css) {
    var rules = [];
    var mediaPattern = /@media\s*([^{]+)\{([\s\S]*?)\n?\}/g;
    var cssWithoutMedia = css.replace(mediaPattern, function (_, condition, body) {
      var inner = body.match(/([^{}]+)\{([^{}]+)\}/g) || [];
      inner.forEach(function (block) {
        var match = block.match(/([^{}]+)\{([^{}]+)\}/);
        if (match) {
          rules.push({
            selector: match[1].trim(),
            declarations: match[2].trim().split(";").filter(Boolean).map(function (line) {
              return "  " + line.trim() + ";";
            }).join("\n"),
            media: condition.trim(),
          });
        }
      });
      return "";
    });

    (cssWithoutMedia.match(/([^{}]+)\{([^{}]+)\}/g) || []).forEach(function (block) {
      var match = block.match(/([^{}]+)\{([^{}]+)\}/);
      if (match) {
        rules.push({
          selector: match[1].trim(),
          declarations: match[2].trim().split(";").filter(Boolean).map(function (line) {
            return "  " + line.trim() + ";";
          }).join("\n"),
          media: "",
        });
      }
    });

    return rules;
  }

  function parseCssRules(css) {
    var rules = parseCssRulesWithCssom(css);
    return rules.length > 0 ? rules : parseCssRulesFallback(css);
  }

  function selectorTarget(selector) {
    var trimmed = selector.trim();
    var match = trimmed.match(/^\.([_a-zA-Z][\w-]*)(:{1,2}[a-zA-Z-]+)?$/);
    if (!match) {
      return null;
    }
    return {
      className: match[1],
      pseudo: match[2] || "",
    };
  }

  function sourceClassTargets(targets) {
    var map = new Map();

    function add(sourceClass, bemClass) {
      if (!sourceClass || !bemClass) {
        return;
      }
      map.set(sourceClass, bemClass);
    }

    targets.forEach(function (target) {
      var modifierClasses = target.classList.filter(function (className) {
        return className.indexOf("--") !== -1;
      });
      var modifierWordsForTarget = modifierClasses.map(function (className) {
        return className.split("--")[1] || "";
      }).filter(Boolean);
      var baseClass = target.classList[0];
      var modifierClass = modifierClasses[0] || "";

      target.classList.forEach(function (className) {
        add(className, className);
      });

      target.sourceClasses.forEach(function (sourceClass) {
        var normalized = sanitizePart(sourceClass, "");
        var matchedModifier = modifierWordsForTarget.find(function (modifier) {
          return normalized.indexOf("--" + modifier) !== -1 ||
            normalized === modifier ||
            normalized.lastIndexOf("-" + modifier) === normalized.length - modifier.length - 1;
        });

        if (matchedModifier && modifierClass) {
          add(sourceClass, modifierClass);
        } else if (baseClass) {
          add(sourceClass, baseClass);
        }
      });

      if (target.sourceId && target.classList.length > 0) {
        add("#" + target.sourceId, target.classList[target.classList.length - 1]);
      }
    });

    return map;
  }

  function parseCssDeclarations(declarations) {
    return String(declarations || "").split("\n").map(function (line) {
      var cleaned = line.trim().replace(/;$/, "");
      var colonIndex = cleaned.indexOf(":");
      if (colonIndex === -1) {
        return null;
      }

      var property = cleaned.slice(0, colonIndex).trim().toLowerCase();
      var value = cleaned.slice(colonIndex + 1).trim();
      var important = /!\s*important$/i.test(value);
      value = value.replace(/!\s*important$/i, "").trim();

      return property && value
        ? { property: property, value: value, important: important }
        : null;
    }).filter(Boolean);
  }

  function formatCssDeclarations(declarations) {
    return declarations.map(function (declaration) {
      return "  " + declaration.property + ": " + declaration.value + (declaration.important ? " !important" : "") + ";";
    }).join("\n");
  }

  function formatLiteralCssRule(selector, declarations, media) {
    var block = selector + " {\n" + declarations + "\n}";
    return media
      ? "@media " + media + " {\n  " + block.replace(/\n/g, "\n  ") + "\n}"
      : block;
  }

  function splitCssValue(value) {
    var parts = [];
    var current = "";
    var quote = "";
    var depth = 0;

    String(value || "").split("").forEach(function (char, index, chars) {
      var previous = chars[index - 1];
      if (quote) {
        current += char;
        if (char === quote && previous !== "\\") {
          quote = "";
        }
        return;
      }
      if (char === "\"" || char === "'") {
        quote = char;
        current += char;
        return;
      }
      if (char === "(") {
        depth += 1;
        current += char;
        return;
      }
      if (char === ")") {
        depth = Math.max(0, depth - 1);
        current += char;
        return;
      }
      if (/\s/.test(char) && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = "";
        return;
      }
      current += char;
    });

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  function spacingFromValue(value) {
    var parts = splitCssValue(value);
    var top = parts[0] || "";
    var right = parts[1] || top;
    var bottom = parts[2] || top;
    var left = parts[3] || right;
    return { top: top, right: right, bottom: bottom, left: left };
  }

  function settingKey(baseKey, breakpoint, state) {
    return [baseKey, breakpoint, state].filter(Boolean).join(":");
  }

  function breakpointFromMedia(media) {
    var match = String(media || "").match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/i);
    if (!match) {
      return "";
    }

    var width = Number(match[1]);
    if (width <= 478) {
      return "mobile_portrait";
    }
    if (width <= 767) {
      return "mobile_landscape";
    }
    return "tablet_portrait";
  }

  function stateFromPseudo(pseudo) {
    var state = String(pseudo || "").replace(/^:/, "");
    return ["hover", "focus", "focus-visible", "active"].indexOf(state) === -1 ? "" : state;
  }

  function mergeSetting(settings, key, value) {
    var existing = settings[key] && typeof settings[key] === "object" && !Array.isArray(settings[key])
      ? settings[key]
      : {};
    settings[key] = Object.assign({}, existing, value);
  }

  function colorValue(value) {
    return { raw: value };
  }

  function isSimpleColor(value) {
    var lower = String(value || "").trim().toLowerCase();
    return !/(gradient|url)\s*\(/i.test(lower) &&
      (/^#([0-9a-f]{3,8})$/i.test(lower) ||
        /^(rgb|rgba|hsl|hsla|color|color-mix|var)\(/i.test(lower) ||
        /^(currentcolor|transparent|inherit|initial|unset|[a-z]+)$/.test(lower));
  }

  function parseBorder(value) {
    var styles = ["none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"];
    var parts = splitCssValue(value);
    var styleIndex = parts.findIndex(function (part) {
      return styles.indexOf(part.toLowerCase()) !== -1;
    });

    if (styleIndex === -1) {
      return null;
    }

    var width = parts.slice(0, styleIndex).join(" ");
    var style = parts[styleIndex];
    var color = parts.slice(styleIndex + 1).join(" ");
    return Object.assign(
      {},
      width ? { width: spacingFromValue(width) } : {},
      { style: style },
      color ? { color: colorValue(color) } : {},
    );
  }

  function applyNativeSetting(settings, declaration, breakpoint, state) {
    if (declaration.important) {
      return false;
    }

    var property = declaration.property;
    var value = declaration.value;
    var key = function (baseKey) { return settingKey(baseKey, breakpoint, state); };

    if (property === "display") {
      settings[key("_display")] = value;
      return true;
    }
    if (property === "flex-direction") {
      settings[key("_direction")] = value;
      return true;
    }
    if (property === "align-items") {
      settings[key("_alignItems")] = value;
      return true;
    }
    if (property === "justify-content") {
      settings[key("_justifyContent")] = value;
      return true;
    }
    if (property === "grid-template-columns") {
      settings[key("_gridTemplateColumns")] = value;
      return true;
    }
    if (property === "gap") {
      settings[key("_gap")] = value;
      return true;
    }
    if (property === "width") {
      settings[key("_width")] = value;
      return true;
    }
    if (property === "max-width") {
      settings[key("_widthMax")] = value;
      return true;
    }
    if (property === "min-height") {
      settings[key("_heightMin")] = value;
      return true;
    }
    if (property === "margin") {
      mergeSetting(settings, key("_margin"), spacingFromValue(value));
      return true;
    }
    if (property === "padding") {
      mergeSetting(settings, key("_padding"), spacingFromValue(value));
      return true;
    }
    if (/^margin-(top|right|bottom|left)$/.test(property)) {
      mergeSetting(settings, key("_margin"), Object.fromEntries([[property.replace("margin-", ""), value]]));
      return true;
    }
    if (/^padding-(top|right|bottom|left)$/.test(property)) {
      mergeSetting(settings, key("_padding"), Object.fromEntries([[property.replace("padding-", ""), value]]));
      return true;
    }
    if (["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "text-decoration"].indexOf(property) !== -1) {
      mergeSetting(settings, key("_typography"), Object.fromEntries([[property, value]]));
      return true;
    }
    if (property === "color") {
      mergeSetting(settings, key("_typography"), { color: colorValue(value) });
      return true;
    }
    if (property === "background-color" || (property === "background" && isSimpleColor(value))) {
      mergeSetting(settings, key("_background"), { color: colorValue(value) });
      return true;
    }
    if (property === "border") {
      var border = parseBorder(value);
      if (!border) {
        return false;
      }
      mergeSetting(settings, key("_border"), border);
      return true;
    }
    if (property === "border-radius") {
      mergeSetting(settings, key("_border"), { radius: spacingFromValue(value) });
      return true;
    }
    if (property === "opacity") {
      settings[key("_opacity")] = value;
      return true;
    }

    return false;
  }

  function auditClasses(content, globalClasses) {
    var byId = new Map();
    var entries = [];
    var missing = 0;

    globalClasses.forEach(function (globalClass) {
      var customCss = globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD];
      var entry = {
        className: globalClass.name,
        classId: globalClass.id,
        assignedElementIds: [],
        nativeSettingsCount: Object.keys(globalClass.settings).filter(function (key) {
          return key !== BRICKS_ELEMENT_CUSTOM_CSS_FIELD;
        }).length,
        fallbackCssRuleCount: 0,
        fallbackStrategy: "none",
        customCssPresent: typeof customCss === "string" && customCss.trim().length > 0,
        missingReferences: [],
        conflicts: [],
      };
      byId.set(globalClass.id, entry);
      entries.push(entry);
    });

    content.forEach(function (element) {
      (Array.isArray(element.settings._cssGlobalClasses) ? element.settings._cssGlobalClasses : []).forEach(function (classId) {
        var entry = byId.get(String(classId));
        if (entry) {
          entry.assignedElementIds.push(element.id);
        } else {
          missing += 1;
          entries.push({
            className: "(missing class record)",
            classId: String(classId),
            assignedElementIds: [element.id],
            nativeSettingsCount: 0,
            fallbackCssRuleCount: 0,
            fallbackStrategy: "none",
            customCssPresent: false,
            missingReferences: [String(classId)],
            conflicts: ["Element references a class ID that is missing from globalClasses."],
          });
        }
      });
    });

    return { entries: entries, missing: missing };
  }

  function attachCss(css, targets, globalClasses, warnings) {
    var rules = parseCssRules(css);
    var attached = 0;
    var unmapped = 0;
    var native = 0;
    var fallback = 0;
    var cssByClass = new Map();
    var literalFallbackKeys = new Set();
    var sourceMap = sourceClassTargets(targets);
    var classByName = new Map();

    globalClasses.forEach(function (globalClass) {
      classByName.set(globalClass.name, globalClass);
      cssByClass.set(globalClass.name, []);
    });

    rules.forEach(function (rule) {
      var ruleMatched = false;
      rule.selector.split(",").forEach(function (selector) {
        var targetSelector = selectorTarget(selector);
        if (!targetSelector || !rule.declarations.trim()) {
          return;
        }

        var className = sourceMap.get(targetSelector.className) ||
          sourceMap.get("#" + targetSelector.className) ||
          "";
        var globalClass = classByName.get(className);

        if (!globalClass) {
          return;
        }

        var breakpoint = breakpointFromMedia(rule.media);
        var state = stateFromPseudo(targetSelector.pseudo);
        var canMapNatively = (!rule.media || breakpoint) && (!targetSelector.pseudo || state);
        var fallbackDeclarations = [];

        parseCssDeclarations(rule.declarations).forEach(function (declaration) {
          if (canMapNatively && applyNativeSetting(globalClass.settings, declaration, breakpoint, state)) {
            native += 1;
            return;
          }
          fallbackDeclarations.push(declaration);
        });

        if (fallbackDeclarations.length === 0) {
          attached += 1;
          ruleMatched = true;
          return;
        }

        var formattedDeclarations = formatCssDeclarations(fallbackDeclarations);
        var fallbackSelector = "." + globalClass.name + (targetSelector.pseudo || "");
        var block = formatLiteralCssRule(fallbackSelector, formattedDeclarations, rule.media);
        var blockKey = fallbackSelector + "\n" + (rule.media || "") + "\n" + formattedDeclarations;
        if (!literalFallbackKeys.has(blockKey)) {
          literalFallbackKeys.add(blockKey);
          cssByClass.get(globalClass.name).push(block);
          fallback += fallbackDeclarations.length;
          attached += 1;
        }
        ruleMatched = true;
      });

      if (!ruleMatched && rule.selector.trim()) {
        unmapped += 1;
      }
    });

    globalClasses.forEach(function (globalClass) {
      var blocks = cssByClass.get(globalClass.name) || [];
      if (blocks.length > 0) {
        globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = blocks.join("\n\n");
      }
    });

    if (unmapped > 0) {
      warnings.push({
        severity: "warning",
        message: unmapped + " CSS rule(s) could not be attached to a matching element.",
      });
    }

    return {
      attached: attached,
      unmapped: unmapped,
      native: native,
      fallback: fallback,
      literalFallbackCss: "",
      literalFallbackRuleCount: literalFallbackKeys.size,
    };
  }

  function inspectDependencies(html, css, js) {
    var dependencies = [];
    var seen = new Set();

    function add(type, value, source, warning) {
      if (!value || seen.has(type + ":" + value)) {
        return;
      }
      seen.add(type + ":" + value);
      dependencies.push({
        type: type,
        value: value,
        source: source,
        warning: warning || "",
      });
    }

    var document = new DOMParser().parseFromString(html || "", "text/html");
    Array.from(document.querySelectorAll("link[href]")).forEach(function (node) {
      add("stylesheet", node.getAttribute("href"), "html", "External stylesheet requires review in Bricks.");
    });
    Array.from(document.querySelectorAll("script[src]")).forEach(function (node) {
      add("script", node.getAttribute("src"), "html", "External script requires manual review.");
    });
    Array.from(document.querySelectorAll("img[src]")).forEach(function (node) {
      var src = node.getAttribute("src");
      if (/^https?:\/\//i.test(src)) {
        add("image", src, "html", "");
      }
    });

    var urlMatches = String(css || "").match(/url\(([^)]+)\)/g) || [];
    urlMatches.forEach(function (match) {
      add("asset", match.replace(/^url\(["']?|["']?\)$/g, ""), "css", "CSS asset URL requires review.");
    });

    var importMatches = String(js || "").match(/import\s+.*?from\s+["']([^"']+)["']/g) || [];
    importMatches.forEach(function (match) {
      var value = (match.match(/["']([^"']+)["']/) || [])[1];
      add("library", value, "js", "JavaScript dependency requires manual review.");
    });

    return dependencies;
  }

  function createExport() {
    var warnings = [];
    var dependencies = inspectDependencies(state.html, state.css, state.js);
    dependencies.forEach(function (dependency) {
      if (dependency.warning) {
        warnings.push({ severity: "warning", message: dependency.warning });
      }
    });

    if (state.js.trim() && state.includeJsCode) {
      warnings.push({
        severity: "warning",
        message: "JavaScript will be inserted as a disabled Bricks Code element for manual review.",
      });
    } else if (state.js.trim()) {
      warnings.push({
        severity: "warning",
        message: "JavaScript was detected but not converted. Rebuild behavior manually in Bricks or review it as custom code.",
      });
    }

    var roots = parseHtml(state.html);
    var built = createTargets(roots, {
      projectPrefix: "jg",
      blockName: "section",
    }, warnings);
    var globalClasses = createGlobalClasses(built.targets);
    var classIdMap = globalClassIdMap(globalClasses);

    built.targets.forEach(function (target) {
      var classIds = target.classList.map(function (className) {
        return classIdMap.get(className);
      }).filter(Boolean);
      if (classIds.length > 0) {
        target.element.settings._cssGlobalClasses = classIds;
      }
    });

    var cssResult = attachCss(state.css, built.targets, globalClasses, warnings);
    var optionalCodeElement = null;

    if (state.js.trim() && state.includeJsCode) {
      optionalCodeElement = {
        id: hash("jigma-js-review:" + state.js.slice(0, 120)),
        name: "code",
        parent: 0,
        children: [],
        settings: {
          executeCode: false,
          javascriptCode: state.js.trim(),
        },
        label: "Jigma JavaScript Review",
      };
      built.content.push(optionalCodeElement);
    }

    var classAudit = auditClasses(built.content, globalClasses);

    var payload = {
      content: built.content,
      globalClasses: globalClasses,
      source: "bricksCopiedElements",
      sourceUrl: "jigma.bricks-plugin",
      version: targetVersion,
      jigmaMeta: {
        label: "Jigma Bricks plugin POC",
        targetBricksVersion: targetVersion,
        stylingMode: "bem-css",
        classAudit: classAudit.entries,
        notes: [
          "Generated inside the Bricks builder environment.",
          "BEM classes are created as native editable Bricks classes.",
          "Matching CSS declarations use native Bricks class settings with literal BEM Custom CSS on the owning class for unsupported rules.",
          state.includeJsCode
            ? "JavaScript is included as a disabled Code element for manual Bricks review."
            : "JavaScript and external dependencies require manual Bricks review.",
        ],
      },
      warnings: warnings,
      validation: {
        targetBricksVersion: targetVersion,
        rootCount: built.content.filter(function (element) { return element.parent === 0; }).length,
        totalElements: built.content.length,
        hierarchyValid: true,
        skippedLayerCount: 0,
        deletedLayerCount: 0,
        unsupportedElementCount: 0,
        generatedTextElementCount: 0,
        classAttachmentCount: built.targets.reduce(function (sum, target) { return sum + target.classList.length; }, 0) + (optionalCodeElement ? 1 : 0),
        globalClassCount: globalClasses.length,
        bemClassCount: built.targets.length,
        optionalCodeElementCount: optionalCodeElement ? 1 : 0,
        cssAttachedRuleCount: cssResult.attached,
        cssScopedRuleCount: 0,
        cssUnmappedRuleCount: cssResult.unmapped,
        unusedSelectorCount: 0,
        nativeStyleMappedCount: cssResult.native,
        customCssFallbackCount: cssResult.fallback,
        literalFallbackRuleCount: cssResult.literalFallbackRuleCount,
        classFallbackStrategy: cssResult.fallback > 0 ? "literal-bem" : "none",
        classReferenceValid: classAudit.missing === 0,
        missingClassReferenceCount: classAudit.missing,
        duplicateClassIdCount: 0,
        duplicateClassNameCount: 0,
        emptyStyledClassCount: 0,
        dependencyWarningCount: dependencies.length,
        jsWarningCount: state.js.trim() ? 1 : 0,
      },
    };

    return {
      payload: payload,
      dependencies: dependencies,
      warnings: warnings,
    };
  }

  function previewDocument() {
    return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>html,body{margin:0;min-height:100%;font-family:Inter,system-ui,sans-serif;background:#f8fafc;}*{box-sizing:border-box;}" +
      state.css +
      "</style></head><body>" +
      state.html +
      (state.js.trim() ? "<script>try{" + state.js + "}catch(error){parent.postMessage({source:'jigma-bricks-panel',type:'preview-error',message:error.message},'*');}<\/script>" : "") +
      "</body></html>";
  }

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  }

  function textarea(label, value, onInput) {
    var field = el("label", "jigma-bricks-field");
    var span = el("span", "", label);
    var input = el("textarea", "jigma-bricks-editor");
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", function () {
      onInput(input.value);
    });
    field.append(span, input);
    return field;
  }

  function checkbox(label, helper, checked, onChange) {
    var field = el("label", "jigma-bricks-option");
    var input = document.createElement("input");
    var text = el("span", "", label);
    var help = helper ? el("small", "", helper) : null;

    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", function () {
      onChange(input.checked);
    });

    field.append(input, text);
    if (help) {
      field.appendChild(help);
    }
    return field;
  }

  function renderList(node, items, emptyText) {
    node.innerHTML = "";
    if (!items.length) {
      node.appendChild(el("p", "jigma-bricks-empty", emptyText));
      return;
    }
    items.slice(0, 8).forEach(function (item) {
      var row = el("article", "jigma-bricks-list-item");
      row.appendChild(el("strong", "", item.type ? item.type : item.severity));
      row.appendChild(el("span", "", item.value || item.message));
      node.appendChild(row);
    });
  }

  function mountPanel() {
    var panel = el("section", "jigma-bricks-panel");
    var header = el("header", "jigma-bricks-header");
    var titleWrap = el("div", "");
    var title = el("strong", "", config.panelTitle || "Jigma");
    var subtitle = el("span", "", config.panelSubtitle || "HTML/CSS/JS to Bricks structure");
    var actions = el("div", "jigma-bricks-header-actions");
    var badge = el("span", config.bricksActive ? "jigma-bricks-badge" : "jigma-bricks-badge jigma-bricks-badge--warn", config.bricksActive ? "Bricks detected" : "Bricks not detected");
    var collapse = el("button", "jigma-bricks-icon-button", "-");
    var body = el("div", "jigma-bricks-body");
    var toolbar = el("div", "jigma-bricks-toolbar");
    var run = el("button", "jigma-bricks-button", config.runPreviewLabel || "Run Preview");
    var insert = el("button", "jigma-bricks-button jigma-bricks-button--primary", config.insertLabel || "Insert Into Page");
    var copy = el("button", "jigma-bricks-button", config.copyLabel || "Copy Bricks Structure");
    var status = el("p", "jigma-bricks-status", "Ready");
    var preview = el("iframe", "jigma-bricks-preview");
    var dependenciesList = el("div", "jigma-bricks-list");
    var warningsList = el("div", "jigma-bricks-list");

    titleWrap.append(title, subtitle);
    actions.append(badge, collapse);
    header.append(titleWrap, actions);

    toolbar.append(run, insert, copy);
    body.append(
      toolbar,
      textarea("HTML", state.html, function (value) { state.html = value; }),
      textarea("CSS", state.css, function (value) { state.css = value; }),
      textarea("JavaScript", state.js, function (value) { state.js = value; }),
      checkbox(
        "Include JavaScript as review Code element",
        "Optional. Jigma inserts it disabled so behavior can be reviewed manually in Bricks.",
        state.includeJsCode,
        function (value) { state.includeJsCode = value; }
      ),
      el("h3", "jigma-bricks-section-title", "Preview"),
      preview,
      el("h3", "jigma-bricks-section-title", "Dependencies"),
      dependenciesList,
      el("h3", "jigma-bricks-section-title", "Warnings"),
      warningsList,
      status
    );
    panel.append(header, body);
    document.body.appendChild(panel);

    function updatePreview() {
      preview.srcdoc = previewDocument();
      var result = createExport();
      state.lastExport = result.payload;
      var adapterDetails = JigmaBricksInsertAdapter.inspect();
      renderList(dependenciesList, result.dependencies, "No external dependencies detected.");
      renderList(warningsList, result.warnings, "No warnings yet.");
      status.textContent = "Preview ready. Elements: " + result.payload.validation.totalElements + ". CSS rules attached: " + result.payload.validation.cssAttachedRuleCount + "." + (adapterDetails.postId ? " Target post: " + adapterDetails.postId + "." : " Target post not detected.");
    }

    run.addEventListener("click", updatePreview);
    insert.addEventListener("click", function () {
      var result = createExport();
      state.lastExport = result.payload;
      renderList(dependenciesList, result.dependencies, "No external dependencies detected.");
      renderList(warningsList, result.warnings, "No warnings.");
      insert.disabled = true;
      status.textContent = "Inserting Jigma elements into the current Bricks page...";

      JigmaBricksInsertAdapter.insert(result.payload, {
        includeJsCode: state.includeJsCode,
      }).then(function (data) {
        status.textContent = (data.message || "Jigma elements inserted.") + " Inserted: " + (data.insertedCount || result.payload.validation.totalElements) + ". Reload the Bricks builder to view them on the canvas.";
      }).catch(function (error) {
        status.textContent = error.message || "Jigma insert failed.";
      }).finally(function () {
        insert.disabled = false;
      });
    });
    copy.addEventListener("click", function () {
      var result = createExport();
      state.lastExport = result.payload;
      var payload = JSON.stringify(result.payload, null, 2);
      navigator.clipboard.writeText(payload).then(function () {
        renderList(dependenciesList, result.dependencies, "No external dependencies detected.");
        renderList(warningsList, result.warnings, "No warnings.");
        status.textContent = "Bricks structure copied. Paste into Bricks manually.";
      }).catch(function () {
        status.textContent = "Clipboard copy failed. Select and copy from browser console fallback.";
        console.log("Jigma Bricks payload", payload);
      });
    });
    collapse.addEventListener("click", function () {
      panel.classList.toggle("jigma-bricks-panel--collapsed");
      collapse.textContent = panel.classList.contains("jigma-bricks-panel--collapsed") ? "+" : "-";
    });

    updatePreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPanel);
  } else {
    mountPanel();
  }
})();
