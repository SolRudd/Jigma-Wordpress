import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { css as cssLanguage } from "@codemirror/lang-css";
import { javascript as javascriptLanguage } from "@codemirror/lang-javascript";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  getTemplateByKey,
  templates,
} from "../../lib/templates.ts";
import {
  LOCAL_SAVED_SECTIONS_STORAGE_KEY,
  createLocalSavedSection,
  createSavedSectionSource,
  deleteSavedSection,
  duplicateSavedSection,
  exportSavedSectionJson,
  importSavedSectionJson,
  parseSavedSections,
  renameSavedSection,
  serializeSavedSections,
  upsertSavedSection,
  type LocalSavedSection,
} from "../../lib/saved-sections.ts";
import {
  collectLayerIds,
  getLayers,
  sanitizeHtmlInput,
} from "../../lib/parser/html.ts";
import { formatEditorCode, sanitizeCssInput, sanitizeJsInput } from "../../lib/formatters/code.ts";
import { inspectDependencies } from "../../lib/dependencies/inspect.ts";
import {
  DEFAULT_OUTPUT_ADAPTER,
  createOutputExport,
} from "../../lib/output/adapters.ts";
import { createPreviewDocument } from "../../lib/preview/document.ts";
import type {
  ClassMode,
  ConversionSeverity,
  Device,
  EditorKind,
  ExportMode,
  LayerNode,
  OutputOptions,
} from "../../types/jigma.ts";

const defaultOptions: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "native-bem-classes",
  classMode: "strict-bem",
  projectPrefix: "jg",
  blockName: "section",
  createGlobalClasses: true,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
  includeJavaScriptCode: true,
};

export const SOURCE_EDITOR_DEFINITIONS: {
  kind: EditorKind;
  label: string;
  badge?: string;
}[] = [
  { kind: "html", label: "HTML" },
  { kind: "css", label: "CSS" },
  { kind: "js", label: "JavaScript", badge: "Review required" },
];

const NAV_ITEMS = ["Convert", "Templates", "Presets", "Docs"] as const;
const outputAdapter = DEFAULT_OUTPUT_ADAPTER;
// Auto Scroll disabled for MVP due to preview instability.
export const AUTO_SCROLL_ENABLED = false;

interface PreviewState {
  html: string;
  css: string;
  js: string;
  runId: number;
}

interface LayerSnapshot {
  selected: string[];
  deleted: string[];
  expanded: string[];
  activeLayerId: string | null;
}

interface EditorMessage {
  kind: EditorKind | "preview" | "export";
  message: string;
}

interface ConversionIssue {
  severity: ConversionSeverity;
  message: string;
  id?: string;
  code?: string;
  title?: string;
  summary?: string;
  count?: number;
  ownerElementId?: string;
  ownerLabel?: string;
  details?: string[];
  suggestedAction?: string;
}

type WorkflowTab = "layers" | "dependencies" | "warnings" | "export";
type WarningFilter = "all" | "error" | "action-required" | "warning" | "notice";
type WorkspaceTab = "code" | "preview" | "inspect" | "export";

const WARNING_FILTERS: { id: WarningFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "action-required", label: "Action required" },
  { id: "warning", label: "Warnings" },
  { id: "notice", label: "Notices" },
];

const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "preview", label: "Preview" },
  { id: "inspect", label: "Inspect" },
  { id: "export", label: "Export" },
];

function normalizeSeverity(severity: ConversionSeverity): Exclude<ConversionSeverity, "info"> {
  return severity === "info" ? "notice" : severity;
}

function groupConversionIssues(issues: ConversionIssue[]) {
  const grouped = new Map<string, ConversionIssue>();

  issues.forEach((issue) => {
    const id = issue.id ?? issue.code ?? issue.message;
    const existing = grouped.get(id);
    if (!existing) {
      grouped.set(id, {
        ...issue,
        id,
        severity: normalizeSeverity(issue.severity),
        count: issue.count ?? 1,
      });
      return;
    }

    const existingSeverity = normalizeSeverity(existing.severity);
    const nextSeverity = normalizeSeverity(issue.severity);
    const severityRank: Record<Exclude<ConversionSeverity, "info">, number> = {
      notice: 0,
      warning: 1,
      "action-required": 2,
      error: 3,
    };

    existing.count = (existing.count ?? 1) + (issue.count ?? 1);
    existing.details = Array.from(new Set([...(existing.details ?? []), ...(issue.details ?? [])]));
    existing.severity = severityRank[nextSeverity] > severityRank[existingSeverity]
      ? nextSeverity
      : existingSeverity;
    existing.summary = existing.summary ?? issue.summary;
    existing.title = existing.title ?? issue.title;
    existing.suggestedAction = existing.suggestedAction ?? issue.suggestedAction;
  });

  return [...grouped.values()];
}

function makeLayerSnapshot(
  selectedLayerIds: Set<string>,
  deletedLayerIds: Set<string>,
  expandedLayerIds: Set<string>,
  activeLayerId: string | null,
): LayerSnapshot {
  return {
    selected: [...selectedLayerIds],
    deleted: [...deletedLayerIds],
    expanded: [...expandedLayerIds],
    activeLayerId,
  };
}

function collectBranchIds(node: LayerNode) {
  return collectLayerIds([node]);
}

function readSavedSections() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseSavedSections(window.localStorage.getItem(LOCAL_SAVED_SECTIONS_STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeSavedSections(sections: LocalSavedSection[]) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(LOCAL_SAVED_SECTIONS_STORAGE_KEY, serializeSavedSections(sections));
    return true;
  } catch {
    return false;
  }
}

function getSourceSeparationError(input: { html: string; css: string; js: string }): EditorMessage | null {
  if (/<\/?(?:style|script|html|head|body)\b|<!doctype/i.test(input.html)) {
    return {
      kind: "html",
      message: "HTML editor contains document, style or script markup. Keep HTML only and move CSS or JavaScript into their own editors.",
    };
  }

  if (/<\/?(?:style|script|html|head|body)\b|<!doctype/i.test(input.css)) {
    return {
      kind: "css",
      message: "CSS editor contains HTML or JavaScript wrapper markup. Keep CSS only.",
    };
  }

  if (/<\/?(?:style|script|html|head|body)\b|<!doctype/i.test(input.js)) {
    return {
      kind: "js",
      message: "JavaScript editor contains HTML or CSS wrapper markup. Keep JavaScript only.",
    };
  }

  if (/(?:^|[;\n\r}])\s*\.[_a-zA-Z][\w-]*(?:[\s.#:[\]>+~,_a-zA-Z0-9-]*)\s*\{/.test(input.js)) {
    return {
      kind: "js",
      message: "JavaScript editor appears to contain CSS selectors. Move CSS into the CSS editor before preview or export.",
    };
  }

  return null;
}

function getEditorHint(kind: EditorKind) {
  if (kind === "html") {
    return "Paste the section structure you want to rebuild in Bricks.";
  }

  if (kind === "css") {
    return "CSS is mapped onto editable Bricks BEM classes by default.";
  }

  return "Optional custom code. Jigma flags it for manual Bricks review.";
}

function getLayerDisplayName(node: LayerNode) {
  return getReadableLayerName(node);
}

function getTagChip(tagName: string) {
  return tagName === "section"
    ? "Section"
    : tagName === "article"
    ? "Article"
    : tagName === "button"
    ? "Button"
    : tagName.toUpperCase();
}

function getExportModeLabel(mode: ExportMode) {
  if (mode === "native-bem-classes" || mode === "global-classes") {
    return "Native Bricks Classes";
  }

  if (mode === "element-styles") {
    return "Element ID Styles";
  }

  if (mode === "scoped-css-block") {
    return "Scoped CSS block";
  }

  return "Structure only";
}

const LABEL_PREFIX_WORDS = new Set(["acme", "demo", "jg", "jig", "jigma", "lit", "prefix", "ui"]);

function titleCase(value: string) {
  if (value.toLowerCase() === "cta") {
    return "CTA";
  }

  if (value.toLowerCase() === "svg") {
    return "SVG";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function classToReadableLabel(className: string, tagName: string) {
  const [blockPart, rawElementPart = ""] = className.split("__");
  const [elementPart = "", modifierPart = ""] = rawElementPart.split("--");
  let blockWords = blockPart.split("-").filter(Boolean);

  while (blockWords.length > 1 && LABEL_PREFIX_WORDS.has(blockWords[0].toLowerCase())) {
    blockWords = blockWords.slice(1);
  }

  if (elementPart) {
    return [titleCase(blockWords.join("-")), titleCase(elementPart), titleCase(modifierPart)]
      .filter(Boolean)
      .join(" ");
  }

  const suffix = tagName === "section"
    ? "Section"
    : tagName === "article"
    ? "Card"
    : tagName === "svg"
    ? "SVG"
    : "";
  return [titleCase(blockWords.join("-")), suffix].filter(Boolean).join(" ");
}

function getReadableLayerName(node: LayerNode) {
  if (node.classes[0]) {
    return classToReadableLabel(node.classes[0], node.tagName);
  }

  if (node.text) {
    return node.text;
  }

  return getTagChip(node.tagName);
}

function getLayerBemText(node: LayerNode) {
  if (node.classes.length > 0) {
    return node.classes.slice(0, 2).join(" ");
  }

  if (node.elementId) {
    return `#${node.elementId}`;
  }

  return node.tagName;
}

function getEditorLanguage(kind: EditorKind): Extension {
  if (kind === "css") {
    return cssLanguage();
  }

  if (kind === "js") {
    return javascriptLanguage({ jsx: true, typescript: true });
  }

  return htmlLanguage();
}

const codeMirrorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "#dbeafe",
    fontSize: "0.84rem",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.62",
    overflow: "auto",
  },
  ".cm-content": {
    minHeight: "100%",
    padding: "14px 16px",
  },
  ".cm-line": {
    padding: "0 2px",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(3, 7, 18, 0.36)",
    borderRight: "1px solid rgba(148, 163, 184, 0.12)",
    color: "rgba(148, 163, 184, 0.58)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "34px",
    padding: "0 9px 0 0",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "rgba(124, 58, 237, 0.12)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(45, 212, 191, 0.26)",
  },
  "&.cm-focused": {
    outline: "none",
  },
}, { dark: true });

const editorBaseSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
];

function CodeEditor(props: {
  kind: EditorKind;
  label: string;
  badge?: string;
  value: string;
  onChange: (value: string) => void;
  onPasteText: (value: string) => string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(props.onChange);
  const onPasteTextRef = useRef(props.onPasteText);

  useEffect(() => {
    onChangeRef.current = props.onChange;
    onPasteTextRef.current = props.onPasteText;
  }, [props.onChange, props.onPasteText]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          editorBaseSetup,
          getEditorLanguage(props.kind),
          codeMirrorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            paste(event, editorView) {
              const pastedText = event.clipboardData?.getData("text/plain");
              if (typeof pastedText !== "string") {
                return false;
              }

              event.preventDefault();
              editorView.dispatch(editorView.state.replaceSelection(onPasteTextRef.current(pastedText)));
              return true;
            },
          }),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [props.kind]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (props.value !== currentValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: props.value,
        },
      });
    }
  }, [props.value]);

  return (
    <section
      id={`source-panel-${props.kind}`}
      className="editor-card editor-card--active"
      role="tabpanel"
      aria-labelledby={`source-tab-${props.kind}`}
      aria-label={`${props.label} source editor`}
    >
      <div className="code-editor-shell">
        <div
          ref={hostRef}
          className="code-editor code-editor-host"
          data-editor-library="codemirror-6"
          data-editor-kind={props.kind}
          role="textbox"
          spellCheck={false}
          aria-label={`${props.label} source`}
        />
      </div>
    </section>
  );
}

function LayerBranch(props: {
  node: LayerNode;
  depth: number;
  selectedLayerIds: Set<string>;
  deletedLayerIds: Set<string>;
  expandedLayerIds: Set<string>;
  activeLayerId: string | null;
  onToggleExpanded: (node: LayerNode) => void;
  onToggleSelected: (node: LayerNode) => void;
  onDelete: (node: LayerNode) => void;
  onActivate: (id: string) => void;
}) {
  const isDeleted = props.deletedLayerIds.has(props.node.id);
  const isSelected = props.selectedLayerIds.has(props.node.id) && !isDeleted;
  const isExpanded = props.expandedLayerIds.has(props.node.id);
  const isActive = props.activeLayerId === props.node.id;
  const hasChildren = props.node.children.length > 0;
  const rowStyle = {
    "--layer-depth": `${props.depth * 13}px`,
  } as CSSProperties;

  return (
    <li className={isDeleted ? "layer-item layer-item--deleted" : "layer-item"}>
      <div
        className={isActive ? "layer-row layer-row--active" : "layer-row"}
        data-layer-row={props.node.id}
        style={rowStyle}
      >
        <button
          type="button"
          className="layer-expand"
          disabled={!hasChildren || isDeleted}
          aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
          onClick={() => props.onToggleExpanded(props.node)}
        >
          {hasChildren ? (isExpanded ? "-" : "+") : ""}
        </button>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isDeleted}
          aria-label={`Include ${props.node.label} in export`}
          onChange={() => props.onToggleSelected(props.node)}
        />
        <button
          type="button"
          className="layer-row__main"
          onClick={() => props.onActivate(props.node.id)}
        >
          <span className="layer-row__label">
            <span className="layer-row__name">{getLayerDisplayName(props.node)}</span>
            <span className="layer-row__text" title={getLayerBemText(props.node)}>
              {getLayerBemText(props.node)}
            </span>
          </span>
        </button>
        <span className="layer-row__chip">{getTagChip(props.node.tagName)}</span>
        <button
          type="button"
          className="icon-button icon-button--danger"
          disabled={isDeleted}
          aria-label={`Delete ${props.node.label}`}
          onClick={() => props.onDelete(props.node)}
        >
          x
        </button>
      </div>
      {hasChildren && isExpanded && !isDeleted && (
        <ul className="layer-list">
          {props.node.children.map((child) => (
            <LayerBranch
              key={child.id}
              {...props}
              node={child}
              depth={props.depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LayerTree(props: {
  layers: LayerNode[];
  selectedLayerIds: Set<string>;
  deletedLayerIds: Set<string>;
  expandedLayerIds: Set<string>;
  activeLayerId: string | null;
  onToggleExpanded: (node: LayerNode) => void;
  onToggleSelected: (node: LayerNode) => void;
  onDelete: (node: LayerNode) => void;
  onActivate: (id: string) => void;
}) {
  if (props.layers.length === 0) {
    return <p className="empty-state">No layers yet</p>;
  }

  return (
    <ul className="layer-list layer-list--root">
      {props.layers.map((node) => (
        <LayerBranch
          key={node.id}
          node={node}
          depth={0}
          selectedLayerIds={props.selectedLayerIds}
          deletedLayerIds={props.deletedLayerIds}
          expandedLayerIds={props.expandedLayerIds}
          activeLayerId={props.activeLayerId}
          onToggleExpanded={props.onToggleExpanded}
          onToggleSelected={props.onToggleSelected}
          onDelete={props.onDelete}
          onActivate={props.onActivate}
        />
      ))}
    </ul>
  );
}

function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <label className={props.disabled ? "toggle-row toggle-row--disabled" : "toggle-row"}>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) =>
          props.onChange((event.currentTarget as HTMLInputElement).checked)}
      />
      <span className="toggle-switch" aria-hidden="true" />
      <span className="toggle-row__copy">
        <strong>{props.label}</strong>
        {props.note && <small>{props.note}</small>}
      </span>
    </label>
  );
}

export default function JigmaBuilder() {
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [activeTemplate, setActiveTemplate] = useState("custom");
  const [device, setDevice] = useState<Device>("desktop");
  const [previewWidth, setPreviewWidth] = useState(1280);
  const [options, setOptions] = useState<OutputOptions>(defaultOptions);
  const [preview, setPreview] = useState<PreviewState>({
    html: "",
    css: "",
    js: "",
    runId: 1,
  });
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deletedLayerIds, setDeletedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [layerHistory, setLayerHistory] = useState<LayerSnapshot[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState("Ready to convert");
  const [messages, setMessages] = useState<EditorMessage[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [showConversionDetails, setShowConversionDetails] = useState(false);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [warningFilter, setWarningFilter] = useState<WarningFilter>("all");
  const [activeEditorKind, setActiveEditorKind] = useState<EditorKind>("html");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("code");
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<WorkflowTab>("layers");
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);
  const [savedSections, setSavedSections] = useState<LocalSavedSection[]>(
    () => readSavedSections(),
  );
  const [activeSavedSectionId, setActiveSavedSectionId] = useState("");

  const layers = useMemo(() => getLayers(preview.html), [preview.html]);
  const allLayerIds = useMemo(() => collectLayerIds(layers), [layers]);
  const dependencies = useMemo(
    () => inspectDependencies(preview.html, preview.css, preview.js),
    [preview.html, preview.css, preview.js],
  );
  const sourceSeparationError = useMemo(
    () => getSourceSeparationError({ html, css, js }),
    [html, css, js],
  );
  const dependencyGroups = useMemo(() => {
    const labels: Record<string, string> = {
      font: "Fonts",
      stylesheet: "Stylesheets",
      script: "Scripts",
      image: "Images",
      svg: "SVGs",
      library: "Libraries",
      cdn: "Libraries",
      "css-variable": "CSS Variables",
    };
    const order = ["Fonts", "Stylesheets", "Scripts", "Images", "SVGs", "Libraries", "CSS Variables"];
    const groups = new Map<string, typeof dependencies>();

    dependencies.forEach((dependency) => {
      const label = labels[dependency.type] ?? "Other";
      groups.set(label, [...(groups.get(label) ?? []), dependency]);
    });

    return order
      .filter((label) => groups.has(label))
      .map((label) => ({ label, items: groups.get(label) ?? [] }));
  }, [dependencies]);
  const excludedLayerIds = useMemo(() => {
    const excluded = new Set<string>(deletedLayerIds);
    allLayerIds.forEach((id) => {
      if (!selectedLayerIds.has(id)) {
        excluded.add(id);
      }
    });
    return excluded;
  }, [allLayerIds, deletedLayerIds, selectedLayerIds]);
  const bricksExport = useMemo(
    () =>
      createOutputExport({
        html: preview.html,
        css: preview.css,
        js: preview.js,
        options,
        excludedLayerIds,
        deletedLayerIds,
      }),
    [preview.html, preview.css, preview.js, options, excludedLayerIds, deletedLayerIds],
  );
  const bricksJson = useMemo(() => JSON.stringify(bricksExport, null, 2), [bricksExport]);
  const previewInspectorActive = false;
  const previewDocument = useMemo(
    () =>
      createPreviewDocument({
        html: preview.html,
        css: preview.css,
        js: preview.js,
        activeLayerId: previewInspectorActive ? activeLayerId : null,
        deletedLayerIds,
        highlightsEnabled: previewInspectorActive,
      }),
    [
      preview.html,
      preview.css,
      preview.js,
      deletedLayerIds,
    ],
  );

  const pushLayerHistory = () => {
    const snapshot = makeLayerSnapshot(
      selectedLayerIds,
      deletedLayerIds,
      expandedLayerIds,
      activeLayerId,
    );
    setLayerHistory((current) => [...current.slice(-24), snapshot]);
  };

  const restoreLayerSnapshot = (snapshot: LayerSnapshot) => {
    setSelectedLayerIds(new Set(snapshot.selected));
    setDeletedLayerIds(new Set(snapshot.deleted));
    setExpandedLayerIds(new Set(snapshot.expanded));
    setActiveLayerId(snapshot.activeLayerId);
  };

  const resetLayerState = (nextHtml: string) => {
    const ids = collectLayerIds(getLayers(nextHtml));
    setSelectedLayerIds(new Set(ids));
    setDeletedLayerIds(new Set());
    setExpandedLayerIds(new Set(ids));
    setLayerHistory([]);
    setActiveLayerId(ids[0] ?? null);
  };

  const getEditorValue = (kind: EditorKind) => {
    if (kind === "html") {
      return html;
    }

    if (kind === "css") {
      return css;
    }

    return js;
  };

  const setEditorValue = (kind: EditorKind, value: string) => {
    if (kind === "html") {
      setHtml(value);
    } else if (kind === "css") {
      setCss(value);
    } else {
      setJs(value);
    }

    setActiveTemplate("custom");
    setActiveSavedSectionId("");
  };

  const setOption = <K extends keyof OutputOptions>(key: K, value: OutputOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const setExportMode = (exportMode: ExportMode) => {
    setOptions((current) => ({
      ...current,
      exportMode,
      createGlobalClasses: exportMode === "native-bem-classes" || exportMode === "global-classes",
    }));
  };

  const loadTemplate = (templateKey: string) => {
    const template = getTemplateByKey(templateKey);
    if (!template) {
      return;
    }

    setHtml(template.html);
    setCss(template.css);
    setJs(template.js);
    setOptions((current) => ({
      ...current,
      projectPrefix: template.prefix,
      blockName: template.blockName,
      includeJavaScriptCode: true,
    }));
    setActiveTemplate(template.key);
    setActiveSavedSectionId("");
    setRuntimeErrors([]);
    setMessages([]);
    setStatus(`${template.name} loaded. Run Preview to render and execute JavaScript.`);
  };

  const resetActiveTemplate = () => {
    const template = getTemplateByKey(activeTemplate);
    if (!template) {
      setStatus("No template selected to reset");
      return;
    }

    const confirmed = typeof window === "undefined" ||
      window.confirm(`Reset ${template.name} and replace the current editor contents?`);
    if (!confirmed) {
      return;
    }

    loadTemplate(template.key);
    setStatus(`${template.name} reset`);
  };

  const saveLocalSection = () => {
    const fallbackName = activeTemplate === "custom"
      ? options.blockName || "Untitled section"
      : templates.find((template) => template.key === activeTemplate)?.name ?? options.blockName;
    const name = typeof window === "undefined"
      ? fallbackName
      : window.prompt("Save section as", fallbackName) ?? "";

    if (!name.trim()) {
      return;
    }

    const section = createLocalSavedSection(
      createSavedSectionSource(html, css, js, options),
      new Date(),
      name,
    );
    const nextSections = upsertSavedSection(savedSections, section);
    setSavedSections(nextSections);
    setActiveSavedSectionId(section.id);
    const saved = writeSavedSections(nextSections);
    setStatus(saved ? "Section saved locally" : "Section saved for this session");
  };

  const loadSavedSection = (sectionId: string) => {
    const section = savedSections.find((item) => item.id === sectionId);
    if (!section) {
      setActiveSavedSectionId("");
      return;
    }

    setHtml(section.html);
    setCss(section.css);
    setJs(section.javascript);
    setOptions((current) => ({
      ...current,
      projectPrefix: section.projectPrefix,
      blockName: section.blockName,
      includeJavaScriptCode: true,
    }));
    setPreview((current) => ({
      html: "",
      css: "",
      js: "",
      runId: current.runId + 1,
    }));
    setActiveTemplate("custom");
    setActiveSavedSectionId(section.id);
    resetLayerState("");
    setRuntimeErrors([]);
    setMessages([]);
    setStatus(`${section.name} loaded. Run Preview to render it.`);
  };

  const renameSelectedSection = () => {
    const section = savedSections.find((item) => item.id === activeSavedSectionId);
    if (!section || typeof window === "undefined") {
      return;
    }

    const nextName = window.prompt("Rename saved section", section.name);
    if (!nextName) {
      return;
    }

    const nextSections = renameSavedSection(savedSections, section.id, nextName);
    setSavedSections(nextSections);
    writeSavedSections(nextSections);
    setStatus("Section renamed");
  };

  const duplicateSelectedSection = () => {
    if (!activeSavedSectionId) {
      return;
    }

    const nextSections = duplicateSavedSection(savedSections, activeSavedSectionId);
    setSavedSections(nextSections);
    writeSavedSections(nextSections);
    setActiveSavedSectionId(nextSections[0]?.id ?? "");
    setStatus("Section duplicated");
  };

  const deleteSelectedSection = () => {
    if (!activeSavedSectionId) {
      return;
    }

    const nextSections = deleteSavedSection(savedSections, activeSavedSectionId);
    setSavedSections(nextSections);
    writeSavedSections(nextSections);
    setActiveSavedSectionId("");
    setStatus("Section deleted");
  };

  const exportSelectedSection = async () => {
    const section = savedSections.find((item) => item.id === activeSavedSectionId);
    if (!section) {
      return;
    }

    const json = exportSavedSectionJson(section);
    try {
      await navigator.clipboard.writeText(json);
      setStatus("Saved section JSON copied");
    } catch {
      setStatus("Saved section JSON ready in Advanced output");
      setMessages((current) => [
        ...current,
        { kind: "export", message: json },
      ]);
    }
  };

  const importSectionFromJson = () => {
    if (typeof window === "undefined") {
      return;
    }

    const rawJson = window.prompt("Paste saved section JSON");
    if (!rawJson) {
      return;
    }

    const result = importSavedSectionJson(rawJson);
    if (!result.valid || !result.section) {
      setStatus(result.errors[0] ?? "Saved section import failed");
      return;
    }

    const nextSections = upsertSavedSection(savedSections, result.section);
    setSavedSections(nextSections);
    setActiveSavedSectionId(result.section.id);
    writeSavedSections(nextSections);
    setStatus("Saved section imported. Load it when ready.");
  };

  const runCode = () => {
    if (sourceSeparationError) {
      setMessages([sourceSeparationError]);
      setStatus("Fix source separation before preview");
      return;
    }

    const nextHtml = sanitizeHtmlInput(html);
    const nextCss = sanitizeCssInput(css);
    const nextJs = sanitizeJsInput(js);
    const nextMessages: EditorMessage[] = [];

    if (nextHtml !== html) {
      setHtml(nextHtml);
      nextMessages.push({ kind: "html", message: "Cleaned wrapper text before preview." });
    }

    if (nextCss !== css) {
      setCss(nextCss);
      nextMessages.push({ kind: "css", message: "Cleaned wrapper text before preview." });
    }

    if (nextJs !== js) {
      setJs(nextJs);
      nextMessages.push({ kind: "js", message: "Cleaned wrapper text before preview." });
    }

    setPreview({
      html: nextHtml,
      css: nextCss,
      js: nextJs,
      runId: preview.runId + 1,
    });
    setActiveTemplate("custom");
    resetLayerState(nextHtml);
    setRuntimeErrors([]);
    setMessages(nextMessages);
    setStatus("Preview refreshed");
  };

  const formatCode = (kind: EditorKind) => {
    const value = getEditorValue(kind);
    const result = formatEditorCode(kind, value);

    setEditorValue(kind, result.code);
    setMessages(
      result.warnings.length > 0
        ? result.warnings.map((message) => ({ kind, message }))
        : [{ kind, message: `${kind.toUpperCase()} formatted.` }],
    );
    setActiveTemplate("custom");
  };

  const copyEditorCode = async (kind: EditorKind) => {
    try {
      await navigator.clipboard.writeText(getEditorValue(kind));
      setStatus(`${kind.toUpperCase()} copied`);
      setMessages([{ kind, message: `${kind.toUpperCase()} source copied.` }]);
    } catch {
      setStatus(`${kind.toUpperCase()} copy failed`);
      setMessages([{ kind, message: `Clipboard copy failed for ${kind.toUpperCase()} source.` }]);
    }
  };

  const clearEditorCode = (kind: EditorKind) => {
    setEditorValue(kind, "");
    setStatus(`${kind.toUpperCase()} cleared`);
    setMessages([{ kind, message: `${kind.toUpperCase()} source cleared.` }]);
  };

  const handlePasteText = (kind: EditorKind, pastedText: string) => {
    const cleanedText = kind === "html"
      ? sanitizeHtmlInput(pastedText)
      : kind === "css"
      ? sanitizeCssInput(pastedText)
      : sanitizeJsInput(pastedText);
    setStatus(
      cleanedText === pastedText
        ? `Pasted ${kind.toUpperCase()}`
        : `Cleaned pasted ${kind.toUpperCase()}`,
    );

    return cleanedText;
  };

  const activateLayer = (id: string) => {
    setActiveLayerId(id);
  };

  const toggleExpanded = (node: LayerNode) => {
    pushLayerHistory();
    setExpandedLayerIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  const toggleSelected = (node: LayerNode) => {
    const branchIds = collectBranchIds(node);
    const shouldSelect = branchIds.some((id) => !selectedLayerIds.has(id));
    pushLayerHistory();
    setSelectedLayerIds((current) => {
      const next = new Set(current);
      branchIds.forEach((id) => {
        if (deletedLayerIds.has(id)) {
          return;
        }
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  const deleteLayer = (node: LayerNode) => {
    const branchIds = collectBranchIds(node);
    pushLayerHistory();
    setDeletedLayerIds((current) => new Set([...current, ...branchIds]));
    setSelectedLayerIds((current) => {
      const next = new Set(current);
      branchIds.forEach((id) => next.delete(id));
      return next;
    });
    setStatus(`${node.label} removed from export`);
  };

  const selectAllLayers = () => {
    pushLayerHistory();
    setSelectedLayerIds(new Set(allLayerIds.filter((id) => !deletedLayerIds.has(id))));
    setStatus("All available layers selected");
  };

  const deselectAllLayers = () => {
    pushLayerHistory();
    setSelectedLayerIds(new Set());
    setStatus("All layers deselected from export");
  };

  const expandAllLayers = () => {
    pushLayerHistory();
    setExpandedLayerIds(new Set(allLayerIds));
  };

  const collapseAllLayers = () => {
    pushLayerHistory();
    setExpandedLayerIds(new Set());
  };

  const undoLayerAction = () => {
    setLayerHistory((current) => {
      const previous = current.at(-1);
      if (!previous) {
        setStatus("Nothing to undo");
        return current;
      }

      restoreLayerSnapshot(previous);
      setStatus("Layer action undone");
      return current.slice(0, -1);
    });
  };

  const copyBricksStructure = async () => {
    if (sourceSeparationError) {
      setMessages([sourceSeparationError]);
      setStatus("Fix source separation before export");
      return;
    }

    if (!preview.html.trim()) {
      setStatus("Add some HTML before exporting");
      setMessages([{ kind: "export", message: "Add some HTML before exporting." }]);
      return;
    }

    try {
      await navigator.clipboard.writeText(bricksJson);
      setStatus("Bricks structure copied");
      setMessages([{ kind: "export", message: "Copied selected Bricks structure." }]);
    } catch {
      setStatus("Clipboard copy failed");
      setMessages([{ kind: "export", message: "Clipboard copy failed. View generated JSON as a fallback." }]);
    }
  };

  const downloadBricksJson = () => {
    if (typeof window === "undefined") {
      return;
    }

    const blob = new Blob([bricksJson], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jigma-${activeTemplateLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "export"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setStatus("Bricks JSON downloaded");
  };

  const openPreviewWindow = () => {
    if (typeof window === "undefined") {
      return;
    }

    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      setStatus("Preview window blocked");
      return;
    }

    previewWindow.document.open();
    previewWindow.document.write(previewDocument);
    previewWindow.document.close();
  };

  const showAllWarningsInInspector = () => {
    setActiveWorkflowTab("warnings");
    setWorkspaceTab("inspect");
    setShowAllWarnings(true);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as {
        source?: string;
        type?: string;
        message?: string;
        detail?: string;
        layerId?: string;
      };

      if (!data || data.source !== "jigma-preview") {
        return;
      }

      if (data.type === "runtime-error") {
        const detail = data.detail ? ` (${data.detail})` : "";
        setRuntimeErrors((current) => [...current, `${data.message ?? "Preview error"}${detail}`]);
      }

      // Auto Scroll disabled for MVP due to preview instability.
      // Preview-to-layer sync stays off with the hover inspector.
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const selectedCount = allLayerIds.filter((id) => selectedLayerIds.has(id) && !deletedLayerIds.has(id)).length;
  const activeTemplateLabel = activeTemplate === "custom"
    ? "Custom section"
    : templates.find((template) => template.key === activeTemplate)?.name ?? "Custom section";
  const activeEditorDefinition = SOURCE_EDITOR_DEFINITIONS.find((editor) => editor.kind === activeEditorKind) ??
    SOURCE_EDITOR_DEFINITIONS[0];
  const dependencyWarnings = dependencies
    .filter((dependency) => dependency.warning)
    .map((dependency): ConversionIssue => ({
      id: `dependency:${dependency.id}`,
      code: "dependency.review",
      severity: "notice",
      title: "Dependency review",
      summary: dependency.warning ?? dependency.label,
      message: dependency.warning ?? dependency.label,
      details: [`${dependency.label}: ${dependency.value}`],
      suggestedAction: "Confirm this dependency is available in the final Bricks site before publishing.",
    }));
  const conversionIssues: ConversionIssue[] = [
    ...bricksExport.warnings.map((warning): ConversionIssue => ({
      id: warning.id,
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      title: warning.title,
      summary: warning.summary,
      count: warning.count,
      ownerElementId: warning.ownerElementId,
      ownerLabel: warning.ownerLabel,
      details: warning.details,
      suggestedAction: warning.suggestedAction,
    })),
    ...runtimeErrors.map((message): ConversionIssue => ({
      id: `runtime:${message}`,
      code: "preview.runtime_error",
      severity: "error",
      title: "Preview runtime error",
      message,
      summary: message,
      suggestedAction: "Review the preview JavaScript or remove custom code before export.",
    })),
    ...(sourceSeparationError
      ? [{
        id: `source-separation:${sourceSeparationError.kind}`,
        code: "source.separation",
        severity: "error" as ConversionSeverity,
        title: "Source separation error",
        message: sourceSeparationError.message,
        summary: sourceSeparationError.message,
        suggestedAction: "Keep HTML, CSS and JavaScript in their matching editors before preview or export.",
      }]
      : []),
    ...dependencyWarnings,
  ];
  const groupedConversionIssues = useMemo(
    () => groupConversionIssues(conversionIssues),
    [conversionIssues],
  );
  const severityCounts = groupedConversionIssues.reduce(
    (counts, issue) => {
      const severity = normalizeSeverity(issue.severity);
      counts[severity] += 1;
      return counts;
    },
    { error: 0, "action-required": 0, warning: 0, notice: 0 },
  );
  const warningCount = groupedConversionIssues.length;
  const totalIssueCount = groupedConversionIssues.reduce((total, issue) => total + (issue.count ?? 1), 0);
  const errorCount = severityCounts.error;
  const actionRequiredCount = severityCounts["action-required"];
  const hasPreviewHtml = preview.html.trim().length > 0;
  const hasEditorJavaScript = js.trim().length > 0;
  const hasPreviewJavaScript = preview.js.trim().length > 0;
  const canCopyBricksStructure = hasPreviewHtml && !sourceSeparationError;
  const javascriptSummary = hasPreviewJavaScript
    ? options.includeJavaScriptCode
      ? "Included as one unsigned Code element"
      : "Excluded from Bricks export"
    : "none";
  const statusBadgeLabel = errorCount > 0
    ? `${errorCount} error${errorCount === 1 ? "" : "s"}`
    : actionRequiredCount > 0
    ? `${actionRequiredCount} action required`
    : warningCount > 0
    ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
    : "Ready";
  const statusBadgeClass = errorCount > 0
    ? "status-pill status-pill--error"
    : warningCount > 0
    ? "status-pill status-pill--warning"
    : "status-pill status-pill--ok";
  const previewStageStyle = {
    "--preview-width": `${previewWidth}px`,
  } as CSSProperties;
  const visibleConversionIssues = groupedConversionIssues.slice(0, showConversionDetails ? 8 : 2);
  const filteredWarningGroups = warningFilter === "all"
    ? groupedConversionIssues
    : groupedConversionIssues.filter((issue) => normalizeSeverity(issue.severity) === warningFilter);
  const visibleWarningGroups = showAllWarnings ? filteredWarningGroups : filteredWarningGroups.slice(0, 5);
  const workflowTabs: { id: WorkflowTab; label: string; count?: number }[] = [
    { id: "layers", label: "Layers", count: selectedCount },
    { id: "dependencies", label: "Dependencies", count: dependencies.length },
    { id: "warnings", label: "Warnings", count: warningCount },
    { id: "export", label: "Export" },
  ];

  return (
    <section className="jigma-builder" aria-label="Jigma conversion workspace">
      <header className="product-bar">
        <div className="product-bar__identity">
          <img className="jigma-logo" src="/jigma-logo.svg" alt="" />
          <h1 className="sr-only">Jigma</h1>
        </div>
        <nav className="product-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === "Convert" ? "nav-button nav-button--active" : "nav-button"}
              onClick={() => {
                if (item === "Templates" || item === "Presets") {
                  setLeftDrawerOpen(true);
                }
              }}
            >
              <span className={`nav-icon nav-icon--${item.toLowerCase()}`} aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>
        <div className="product-bar__actions">
          <button
            type="button"
            className="secondary-button library-button"
            onClick={() => setLeftDrawerOpen(true)}
          >
            Library
          </button>
          <span className="status-pill status-pill--target">
            {outputAdapter.targetLabel} {outputAdapter.targetVersion}
          </span>
          <span className={statusBadgeClass}>{statusBadgeLabel}</span>
          <button type="button" className="run-button run-button--top" onClick={runCode}>
            Run Preview
          </button>
          <button
            type="button"
            className="copy-button copy-button--top"
            disabled={!canCopyBricksStructure}
            onClick={copyBricksStructure}
          >
            {outputAdapter.copyLabel}
          </button>
        </div>
      </header>

      <nav className="workspace-mode-tabs" aria-label="Workspace sections">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={workspaceTab === tab.id}
            className={workspaceTab === tab.id
              ? "workspace-mode-tab workspace-mode-tab--active"
              : "workspace-mode-tab"}
            onClick={() => {
              setWorkspaceTab(tab.id);
              if (tab.id === "export") {
                setActiveWorkflowTab("export");
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="app-workspace">
        {leftDrawerOpen && (
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Close library drawer"
            onClick={() => setLeftDrawerOpen(false)}
          />
        )}
        <aside className={leftDrawerOpen ? "left-sidebar left-sidebar--open" : "left-sidebar"}>
          <div className="drawer-header">
            <strong>Library</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Close library drawer"
              onClick={() => setLeftDrawerOpen(false)}
            >
              x
            </button>
          </div>
          <section className="app-panel template-panel">
            <div className="panel-heading">
              <p className="panel__kicker">Template Library</p>
              <h2>Load example</h2>
            </div>
            <div className="template-list">
              {templates.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  className={activeTemplate === template.key
                    ? "template-card template-card--active"
                    : "template-card"}
                  onClick={() => loadTemplate(template.key)}
                >
                  <span className={`template-thumb template-thumb--${template.thumbnail}`} aria-hidden="true" />
                  <span className="template-card__copy">
                    <strong>{template.id === "jigma-header" ? "Load Header Example" : template.name}</strong>
                    <span>{template.description}</span>
                    <em>{template.category}</em>
                  </span>
                </button>
              ))}
            </div>
            {activeTemplate === "jigma-header" && (
              <button
                type="button"
                className="secondary-button template-reset-button"
                onClick={resetActiveTemplate}
              >
                Reset Header Example
              </button>
            )}
          </section>

          <section className="app-panel settings-panel">
            <div className="panel-heading">
              <p className="panel__kicker">Saved Sections</p>
              <h2>Local workspace</h2>
            </div>
            <label className="field-group">
              <span>Project Prefix</span>
              <input
                type="text"
                value={options.projectPrefix}
                onChange={(event) => {
                  setActiveSavedSectionId("");
                  setOption(
                    "projectPrefix",
                    (event.currentTarget as HTMLInputElement).value,
                  );
                }}
              />
            </label>
            <label className="field-group">
              <span>Block Name</span>
              <input
                type="text"
                value={options.blockName}
                onChange={(event) => {
                  setActiveSavedSectionId("");
                  setOption(
                    "blockName",
                    (event.currentTarget as HTMLInputElement).value,
                  );
                }}
              />
              <small>This is the fallback wrapper class when source semantics are unclear.</small>
            </label>
            <button
              type="button"
              className="primary-button primary-button--wide"
              onClick={saveLocalSection}
            >
              Save Section locally
            </button>
            <label className="field-group">
              <span>Load Saved Section</span>
              <select
                value={activeSavedSectionId}
                disabled={savedSections.length === 0}
                onChange={(event) => loadSavedSection(event.currentTarget.value)}
              >
                <option value="">
                  {savedSections.length === 0 ? "No saved sections" : "Choose saved section"}
                </option>
                {savedSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <small>HTML, CSS, JavaScript, prefix and block name stay in this browser only.</small>
            </label>
            <div className="preset-actions" aria-label="Saved section actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!activeSavedSectionId}
                onClick={renameSelectedSection}
              >
                Rename
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!activeSavedSectionId}
                onClick={duplicateSelectedSection}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!activeSavedSectionId}
                onClick={exportSelectedSection}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={importSectionFromJson}
              >
                Import JSON
              </button>
              <button
                type="button"
                className="secondary-button secondary-button--danger"
                disabled={!activeSavedSectionId}
                onClick={deleteSelectedSection}
              >
                Delete
              </button>
            </div>
          </section>
        </aside>

        <main className="center-workspace" data-workspace-tab={workspaceTab}>
          <section className="builder-split">
            <section className={workspaceTab === "code" ? "code-pane workspace-pane workspace-pane--mobile-active" : "code-pane workspace-pane"}>
              <section className="source-editor-panel app-panel" aria-label="Source editor">
                <div className="source-editor-header">
                  <div>
                    <p className="panel__kicker">Source</p>
                    <h2>{SOURCE_EDITOR_DEFINITIONS.find((editor) => editor.kind === activeEditorKind)?.label}</h2>
                  </div>
                  <div className="editor-card__actions">
                    <button type="button" className="tool-button" onClick={() => formatCode(activeEditorKind)}>
                      Format
                    </button>
                    <button
                      type="button"
                      className="tool-button"
                      disabled={!getEditorValue(activeEditorKind)}
                      onClick={() => copyEditorCode(activeEditorKind)}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="tool-button tool-button--quiet"
                      disabled={!getEditorValue(activeEditorKind)}
                      onClick={() => clearEditorCode(activeEditorKind)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="source-tabs" role="tablist" aria-label="Source editors">
                  {SOURCE_EDITOR_DEFINITIONS.map((editor) => (
                    <button
                      key={editor.kind}
                      id={`source-tab-${editor.kind}`}
                      type="button"
                      role="tab"
                      aria-controls={`source-panel-${editor.kind}`}
                      aria-selected={activeEditorKind === editor.kind}
                      className={activeEditorKind === editor.kind
                        ? "source-tab source-tab--active"
                        : "source-tab"}
                      onClick={() => setActiveEditorKind(editor.kind)}
                    >
                      <span>{editor.label}</span>
                      {editor.badge && <em>{editor.badge}</em>}
                    </button>
                  ))}
                </div>
                <div className="source-editor-stack">
                  <CodeEditor
                    key={activeEditorDefinition.kind}
                    kind={activeEditorDefinition.kind}
                    label={activeEditorDefinition.label}
                    badge={activeEditorDefinition.badge}
                    value={getEditorValue(activeEditorDefinition.kind)}
                    onChange={(value) => setEditorValue(activeEditorDefinition.kind, value)}
                    onPasteText={(value) => handlePasteText(activeEditorDefinition.kind, value)}
                  />
                </div>
                <div className="editor-foot">
                  <p>{getEditorHint(activeEditorKind)}</p>
                  {messages.length > 0 && (
                    <div className="notice-list">
                      {messages.slice(0, 2).map((message, index) => (
                        <p key={`${message.kind}-${index}`}>
                          <strong>{message.kind.toUpperCase()}:</strong> {message.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </section>

            <section className={workspaceTab === "preview" ? "canvas-pane app-panel workspace-pane workspace-pane--mobile-active" : "canvas-pane app-panel workspace-pane"}>
              <div className="canvas-header">
                <div>
                  <p className="panel__kicker">Live Preview</p>
                  <h2>{activeTemplateLabel}</h2>
                </div>
                <div className="canvas-options">
                  <div className="device-control" aria-label="Preview device size">
                    {(["desktop", "tablet", "mobile"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={device === item
                          ? `device-button device-button--${item} device-button--active`
                          : `device-button device-button--${item}`}
                        onClick={() => setDevice(item)}
                        aria-label={`${item} preview`}
                      />
                    ))}
                  </div>
                  <label className="width-control">
                    <span className="sr-only">Custom preview width</span>
                    <input
                      type="number"
                      min={320}
                      max={1600}
                      step={20}
                      value={previewWidth}
                      onChange={(event) =>
                        setPreviewWidth(Number((event.currentTarget as HTMLInputElement).value) || 1280)}
                    />
                    <span>px</span>
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Open preview in new window"
                    onClick={openPreviewWindow}
                  >
                    ↗
                  </button>
                  <button type="button" className="run-button" onClick={runCode}>
                    Run Preview
                  </button>
                </div>
              </div>
              <div
                className={`preview-stage preview-stage--${device}`}
                style={previewStageStyle}
              >
                <iframe
                  key={preview.runId}
                  className="preview-frame"
                  sandbox="allow-scripts"
                  srcDoc={previewDocument}
                  title="Jigma section preview"
                />
              </div>
            </section>
          </section>

          <section className={showConversionDetails ? "conversion-check app-panel conversion-check--open" : "conversion-check app-panel"}>
            <button
              type="button"
              className="conversion-check__summary"
              aria-expanded={showConversionDetails}
              onClick={() => setShowConversionDetails((current) => !current)}
            >
              <span className="conversion-orb" aria-hidden="true">
                <span>{errorCount > 0 ? "x" : warningCount > 0 ? "!" : "✓"}</span>
              </span>
              <span className="conversion-check__body">
                <span className="conversion-check__heading">
                  <strong>{warningCount > 0 ? "Needs review" : "Ready to export"}</strong>
                  <span className={warningCount > 0 ? "warning-badge" : "ok-badge"}>
                    {warningCount > 0 ? `${warningCount} grouped issues` : "No issues"}
                  </span>
                </span>
                <span className="conversion-copy">
                  {bricksExport.validation.totalElements} elements · {bricksExport.validation.globalClassCount} classes · {actionRequiredCount} actions required
                </span>
              </span>
              <span className="conversion-toggle" aria-hidden="true">
                {showConversionDetails ? "Hide" : "Details"}
              </span>
            </button>
            {showConversionDetails && (
              <div className="conversion-drawer">
                {visibleConversionIssues.slice(0, 3).length > 0 ? (
                  <ul className="conversion-list">
                    {visibleConversionIssues.slice(0, 3).map((issue, index) => (
                      <li key={`${issue.id ?? issue.message}-${index}`} className={`conversion-${normalizeSeverity(issue.severity)}`}>
                        <strong>{issue.title ?? issue.summary ?? issue.message}</strong>
                        <span>{issue.summary ?? issue.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="conversion-copy">No warnings. Structure is ready to copy.</p>
                )}
                <div className="detail-grid">
                  <article>
                    <strong>Dependencies</strong>
                    <span>{dependencies.length}</span>
                  </article>
                  <article>
                    <strong>Unsigned SVG</strong>
                    <span>{bricksExport.validation.unsignedSvgCodeCount}</span>
                  </article>
                  <article>
                    <strong>JavaScript review</strong>
                    <span>{bricksExport.validation.unsignedJavaScriptCodeCount}</span>
                  </article>
                </div>
                <button type="button" className="secondary-button" onClick={showAllWarningsInInspector}>
                  View all warnings
                </button>
              </div>
            )}
          </section>
        </main>

        <aside className={(workspaceTab === "inspect" || workspaceTab === "export") ? "right-sidebar app-panel workspace-pane workspace-pane--mobile-active" : "right-sidebar app-panel workspace-pane"}>
          <div className="workflow-tabs" role="tablist" aria-label="Conversion workflow">
            {workflowTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeWorkflowTab === tab.id}
                className={activeWorkflowTab === tab.id
                  ? "workflow-tab workflow-tab--active"
                  : "workflow-tab"}
                onClick={() => setActiveWorkflowTab(tab.id)}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && <strong>{tab.count}</strong>}
              </button>
            ))}
          </div>

          {activeWorkflowTab === "layers" && (
            <section className="workflow-panel layers-panel">
            <div className="sidebar-heading">
              <div>
                <p className="panel__kicker">Layers</p>
                <h2>{selectedCount}/{allLayerIds.length} selected</h2>
              </div>
            </div>
            <div className="layer-actions">
              <button type="button" className="mini-button" onClick={selectAllLayers}>
                Select
              </button>
              <button type="button" className="mini-button" onClick={deselectAllLayers}>
                Deselect
              </button>
              <button type="button" className="mini-button" onClick={expandAllLayers}>
                Expand
              </button>
              <button type="button" className="mini-button" onClick={collapseAllLayers}>
                Collapse
              </button>
              <button type="button" className="mini-button" onClick={undoLayerAction}>
                Undo
              </button>
            </div>
            <LayerTree
              layers={layers}
              selectedLayerIds={selectedLayerIds}
              deletedLayerIds={deletedLayerIds}
              expandedLayerIds={expandedLayerIds}
              activeLayerId={activeLayerId}
              onToggleExpanded={toggleExpanded}
              onToggleSelected={toggleSelected}
              onDelete={deleteLayer}
              onActivate={activateLayer}
            />
            </section>
          )}

          {activeWorkflowTab === "dependencies" && (
            <section className="workflow-panel dependency-panel">
              <div className="sidebar-heading">
                <div>
                  <p className="panel__kicker">Dependencies</p>
                  <h2>{dependencies.length} detected</h2>
                </div>
              </div>
              {dependencies.length === 0 ? (
                <p className="empty-state">No dependencies detected</p>
              ) : (
                <div className="dependency-list">
                  {dependencyGroups.map((group) => (
                    <section className="dependency-group" key={group.label}>
                      <header>
                        <h3>{group.label}</h3>
                        <span>{group.items.length}</span>
                      </header>
                      {group.items.map((dependency) => (
                        <article className="dependency-item" key={dependency.id}>
                          <div>
                            <span className={`dependency-type dependency-type--${dependency.type}`}>
                              {dependency.required ? "External dependency" : "Optional"}
                            </span>
                            <h4>{dependency.label}</h4>
                            <p>{dependency.warning ? "Review before export" : "Available for mapping"}</p>
                          </div>
                        </article>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeWorkflowTab === "warnings" && (
            <section className="workflow-panel warning-panel">
              <div className="sidebar-heading">
                <div>
                  <p className="panel__kicker">Warnings</p>
                  <h2>{warningCount} grouped issue{warningCount === 1 ? "" : "s"}</h2>
                </div>
              </div>
              {groupedConversionIssues.length === 0 ? (
                <p className="empty-state">No issues to review</p>
              ) : (
                <>
                  <div className="warning-filter-grid" aria-label="Warning filters">
                    {WARNING_FILTERS.map((filter) => {
                      const count = filter.id === "all"
                        ? warningCount
                        : severityCounts[filter.id];
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className={warningFilter === filter.id
                            ? "warning-filter warning-filter--active"
                            : "warning-filter"}
                          onClick={() => {
                            setWarningFilter(filter.id);
                            setShowAllWarnings(false);
                          }}
                        >
                          <span>{filter.label}</span>
                          <strong>{count}</strong>
                        </button>
                      );
                    })}
                  </div>
                  {filteredWarningGroups.length === 0 ? (
                    <p className="empty-state">No issues match this filter.</p>
                  ) : (
                    <ul className="warning-list">
                      {visibleWarningGroups.map((issue, index) => {
                        const severity = normalizeSeverity(issue.severity);
                        return (
                          <li key={`${issue.id ?? issue.message}-${index}`} className={`conversion-${severity}`}>
                            <details>
                              <summary>
                                <span>
                                  <strong>{issue.title ?? issue.summary ?? issue.message}</strong>
                                  <small>
                                    {issue.ownerLabel ? `${issue.ownerLabel} - ` : ""}
                                    {issue.summary ?? issue.message}
                                  </small>
                                </span>
                                {(issue.count ?? 1) > 1 && <em>{issue.count}x</em>}
                              </summary>
                              {(issue.details?.length || issue.suggestedAction) && (
                                <div className="warning-details">
                                  {issue.details?.map((detail) => <p key={detail}>{detail}</p>)}
                                  {issue.suggestedAction && <p><strong>Action:</strong> {issue.suggestedAction}</p>}
                                </div>
                              )}
                            </details>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {filteredWarningGroups.length > 5 && (
                    <button
                      type="button"
                      className="secondary-button secondary-button--wide"
                      onClick={() => setShowAllWarnings((current) => !current)}
                    >
                      {showAllWarnings ? "Show first 5" : `Show all ${filteredWarningGroups.length}`}
                    </button>
                  )}
                  {totalIssueCount > warningCount && (
                    <p className="warning-total">
                      {totalIssueCount} total notices collapsed into {warningCount} grouped issue{warningCount === 1 ? "" : "s"}.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {activeWorkflowTab === "export" && (
            <section className="workflow-panel export-settings">
            <div className="sidebar-heading">
              <div>
                <p className="panel__kicker">Export</p>
                <h2>Copy structure</h2>
              </div>
              <span className="mode-pill">{outputAdapter.formatLabel}</span>
            </div>

            <section className="export-static-grid" aria-label="Export architecture">
              <article>
                <span>Output format</span>
                <strong>{outputAdapter.formatLabel}</strong>
              </article>
              <article>
                <span>Export architecture</span>
                <strong>Native Bricks Classes</strong>
              </article>
              <article>
                <span>Naming</span>
                <strong>{options.classMode === "strict-bem" ? "Strict BEM" : "Hybrid BEM"}</strong>
              </article>
            </section>

            {!hasPreviewHtml && (
              <p className="empty-state">Add some HTML before exporting.</p>
            )}

            <div className="export-js-control">
              <Toggle
                label="Include JavaScript in Bricks"
                checked={Boolean(options.includeJavaScriptCode)}
                disabled={!hasEditorJavaScript}
                onChange={(checked) => setOption("includeJavaScriptCode", checked)}
                note={hasEditorJavaScript
                  ? "Creates one unsigned Bricks Code element with execution disabled."
                  : "JavaScript: none"}
              />
            </div>

            <dl className="export-summary">
              <div>
                <dt>Elements</dt>
                <dd>{bricksExport.validation.totalElements}</dd>
              </div>
              <div>
                <dt>Native classes</dt>
                <dd>{bricksExport.validation.globalClassCount}</dd>
              </div>
              <div>
                <dt>Native properties mapped</dt>
                <dd>{bricksExport.validation.nativeStyleMappedCount}</dd>
              </div>
              <div>
                <dt>CSS class fallbacks</dt>
                <dd>{bricksExport.validation.customCssFallbackCount}</dd>
              </div>
              <div>
                <dt>Dependencies</dt>
                <dd>{bricksExport.validation.externalDependencyCount}</dd>
              </div>
              <div>
                <dt>Native images</dt>
                <dd>{bricksExport.validation.nativeImageCount ?? 0}</dd>
              </div>
              <div>
                <dt>Responsive images</dt>
                <dd>{bricksExport.validation.responsiveImageCount ?? 0}</dd>
              </div>
              <div>
                <dt>Background images</dt>
                <dd>{bricksExport.validation.backgroundImageCount ?? 0}</dd>
              </div>
              <div>
                <dt>Overlays mapped</dt>
                <dd>{bricksExport.validation.overlayMappedCount ?? 0}</dd>
              </div>
              <div>
                <dt>Inline SVGs</dt>
                <dd>{bricksExport.validation.unsignedSvgCodeCount}</dd>
              </div>
              <div>
                <dt>Unsigned code</dt>
                <dd>{bricksExport.validation.unsignedSvgCodeCount + bricksExport.validation.unsignedJavaScriptCodeCount}</dd>
              </div>
              <div>
                <dt>JavaScript</dt>
                <dd>{javascriptSummary}</dd>
              </div>
              <div>
                <dt>Signature</dt>
                <dd>{hasPreviewJavaScript && options.includeJavaScriptCode ? "Required after import" : "none"}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>{hasPreviewJavaScript && options.includeJavaScriptCode ? "Disabled" : "none"}</dd>
              </div>
              <div>
                <dt>Failed assets</dt>
                <dd>{bricksExport.validation.failedAssetCount ?? 0}</dd>
              </div>
              <div>
                <dt>Issues requiring review</dt>
                <dd>{warningCount}</dd>
              </div>
              <div>
                <dt>Skipped layers</dt>
                <dd>{bricksExport.validation.skippedLayerCount}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="copy-button copy-button--wide"
              disabled={!canCopyBricksStructure}
              onClick={copyBricksStructure}
            >
              {outputAdapter.copyLabel}
            </button>
            <div className="export-actions">
              <button type="button" className="secondary-button" onClick={downloadBricksJson}>
                Download JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowJson((current) => !current)}
              >
                {showJson ? "Hide generated JSON" : "View generated JSON"}
              </button>
            </div>
            {showJson && <pre className="json-output json-output--inline">{bricksJson}</pre>}

            <details
              className="advanced-export"
              open={showAdvancedExport}
              onToggle={(event) =>
                setShowAdvancedExport((event.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>Advanced output</summary>
              <div className="toggle-stack">
                <Toggle
                  label="Minify fallback CSS"
                  checked={options.minifyElementCss}
                  onChange={(checked) =>
                    setOption("minifyElementCss", checked)}
                  note="Optional compact fallback CSS. Readable CSS remains the default."
                />
                <Toggle
                  label="Preserve external utility classes"
                  checked={options.classMode !== "strict-bem"}
                  onChange={(checked) =>
                    setOption("classMode", checked ? "hybrid" as ClassMode : "strict-bem")}
                  note="Keeps safe original classes alongside generated BEM."
                />
                <Toggle
                  label="Include external CSS"
                  checked={options.includeExternalCss}
                  onChange={(checked) => setOption("includeExternalCss", checked)}
                />
              </div>
              <section className="advanced-output-block">
                <p>Diagnostic class audit</p>
                <small>Class reference validation: {bricksExport.validation.classReferenceValid ? "Passed" : "Needs review"}</small>
              </section>
            </details>

            <p className="status-line">{status}</p>
            </section>
          )}
        </aside>
      </section>
      <div className="mobile-action-bar" aria-label="Primary actions">
        <button type="button" className="run-button" onClick={runCode}>
          Run Preview
        </button>
        <button
          type="button"
          className="copy-button"
          disabled={!canCopyBricksStructure}
          onClick={copyBricksStructure}
        >
          Copy Structure
        </button>
      </div>
    </section>
  );
}
