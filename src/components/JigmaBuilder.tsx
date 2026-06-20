import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { templates } from "../../lib/templates.ts";
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
import {
  PREVIEW_HOVER_INSPECTOR_ENABLED,
  createPreviewDocument,
} from "../../lib/preview/document.ts";
import type {
  ClassMode,
  Device,
  EditorKind,
  ExportMode,
  LayerNode,
  OutputOptions,
} from "../../types/jigma.ts";

const defaultOptions: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "element-styles",
  classMode: "strict-bem",
  projectPrefix: "jg",
  blockName: "hero-jigma",
  createGlobalClasses: false,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
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

const RECENT_PROJECTS = [
  { title: "Jigma Hero Section", meta: "Updated just now", accent: "purple" },
  { title: "Agency Portfolio", meta: "Updated 2h ago", accent: "teal" },
  { title: "SaaS Landing Page", meta: "Updated yesterday", accent: "blue" },
];

const NAV_ITEMS = ["Convert", "Presets", "Docs"] as const;
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

interface EditorPasteEvent {
  clipboardData?: DataTransfer | null;
  currentTarget: EventTarget | null;
  preventDefault: () => void;
}

interface ConversionIssue {
  severity: "info" | "warning" | "error";
  message: string;
}

type WorkflowTab = "layers" | "dependencies" | "warnings" | "export";

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

function getEditorHint(kind: EditorKind) {
  if (kind === "html") {
    return "Paste the section structure you want to rebuild in Bricks.";
  }

  if (kind === "css") {
    return "CSS is scoped to generated strict BEM classes by default.";
  }

  return "Optional custom code. Jigma flags it for manual Bricks review.";
}

function getLayerDisplayName(node: LayerNode) {
  if (node.elementId) {
    return `${node.tagName}#${node.elementId}`;
  }

  if (node.classes.length > 0) {
    return `${node.tagName}.${node.classes[0]}`;
  }

  if (node.text) {
    return `${node.tagName} "${node.text}"`;
  }

  return node.tagName;
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

function getLayerIconType(tagName: string) {
  if (tagName === "section" || tagName === "article" || tagName === "main") {
    return "section";
  }

  if (/^h[1-6]$/.test(tagName) || tagName === "p" || tagName === "span" || tagName === "strong") {
    return "text";
  }

  if (tagName === "img" || tagName === "svg" || tagName === "picture") {
    return "media";
  }

  if (tagName === "a" || tagName === "button") {
    return "action";
  }

  return "box";
}

function getExportModeLabel(mode: ExportMode) {
  if (mode === "element-styles") {
    return "Element styles";
  }

  if (mode === "global-classes") {
    return "Bricks/global classes";
  }

  if (mode === "scoped-css-block") {
    return "Scoped CSS block";
  }

  return "Structure only";
}

function CodeEditor(props: {
  kind: EditorKind;
  label: string;
  badge?: string;
  value: string;
  onChange: (value: string) => void;
  onFormat: () => void;
  onCopy: () => void;
  onClear: () => void;
  onPaste: (event: EditorPasteEvent) => void;
}) {
  const lineCount = Math.max(1, props.value.split("\n").length);

  return (
    <section className="editor-card" aria-label={`${props.label} source editor`}>
      <div className="editor-card__bar">
        <div>
          <p className="editor-card__kind">{props.kind.toUpperCase()}</p>
          <div className="editor-card__title">
            <h3>{props.label}</h3>
            {props.badge && <span>{props.badge}</span>}
          </div>
        </div>
        <div className="editor-card__actions">
          <button type="button" className="tool-button" onClick={props.onFormat}>
            Format
          </button>
          <button
            type="button"
            className="tool-button"
            disabled={!props.value}
            onClick={props.onCopy}
          >
            Copy
          </button>
          <button
            type="button"
            className="tool-button tool-button--quiet"
            disabled={!props.value}
            onClick={props.onClear}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="code-editor-shell">
        <div className="code-lines" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <textarea
          className="code-editor"
          spellCheck={false}
          value={props.value}
          onPaste={props.onPaste}
          onChange={(event) =>
            props.onChange((event.currentTarget as HTMLTextAreaElement).value)}
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
  const iconType = getLayerIconType(props.node.tagName);
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
          <span className={`layer-icon layer-icon--${iconType}`} aria-hidden="true" />
          <span className="layer-row__label">
            <span className="layer-row__name">{getLayerDisplayName(props.node)}</span>
            {props.node.text && <span className="layer-row__text">{props.node.text}</span>}
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
    return <p className="empty-state">Run preview to generate a layer tree.</p>;
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
  const initialTemplate = templates[0];
  const initialLayerIds = collectLayerIds(getLayers(initialTemplate.html));
  const [html, setHtml] = useState(initialTemplate.html);
  const [css, setCss] = useState(initialTemplate.css);
  const [js, setJs] = useState(initialTemplate.js);
  const [activeTemplate, setActiveTemplate] = useState(initialTemplate.key);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewWidth, setPreviewWidth] = useState(1280);
  const [options, setOptions] = useState<OutputOptions>(defaultOptions);
  const [preview, setPreview] = useState<PreviewState>({
    html: initialTemplate.html,
    css: initialTemplate.css,
    js: initialTemplate.js,
    runId: 1,
  });
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(
    () => new Set(initialLayerIds),
  );
  const [deletedLayerIds, setDeletedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<string>>(
    () => new Set(initialLayerIds),
  );
  const [layerHistory, setLayerHistory] = useState<LayerSnapshot[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(
    initialLayerIds[0] ?? null,
  );
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);
  const [status, setStatus] = useState("Ready to convert");
  const [messages, setMessages] = useState<EditorMessage[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [showConversionDetails, setShowConversionDetails] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<WorkflowTab>("layers");
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);

  const layers = useMemo(() => getLayers(preview.html), [preview.html]);
  const allLayerIds = useMemo(() => collectLayerIds(layers), [layers]);
  const dependencies = useMemo(
    () => inspectDependencies(preview.html, preview.css, preview.js),
    [preview.html, preview.css, preview.js],
  );
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
  const previewInspectorActive = PREVIEW_HOVER_INSPECTOR_ENABLED && highlightsEnabled;
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
      previewInspectorActive,
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
  };

  const setOption = <K extends keyof OutputOptions>(key: K, value: OutputOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const setExportMode = (exportMode: ExportMode) => {
    setOptions((current) => ({
      ...current,
      exportMode,
      createGlobalClasses: exportMode === "global-classes",
    }));
  };

  const loadTemplate = (templateKey: string) => {
    const template = templates.find((item) => item.key === templateKey);
    if (!template) {
      return;
    }

    setHtml(template.html);
    setCss(template.css);
    setJs(template.js);
    setPreview({
      html: template.html,
      css: template.css,
      js: template.js,
      runId: preview.runId + 1,
    });
    setActiveTemplate(template.key);
    resetLayerState(template.html);
    setRuntimeErrors([]);
    setMessages([]);
    setStatus(`${template.name} loaded`);
  };

  const runCode = () => {
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

  const handlePaste = (kind: EditorKind, event: EditorPasteEvent) => {
    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string") {
      return;
    }

    const textarea = event.currentTarget as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }

    const cleanedText = kind === "html"
      ? sanitizeHtmlInput(pastedText)
      : kind === "css"
      ? sanitizeCssInput(pastedText)
      : sanitizeJsInput(pastedText);
    const currentValue = textarea.value;
    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = currentValue.slice(0, selectionStart) +
      cleanedText +
      currentValue.slice(selectionEnd);

    event.preventDefault();

    setEditorValue(kind, nextValue);
    setStatus(
      cleanedText === pastedText
        ? `Pasted ${kind.toUpperCase()}`
        : `Cleaned pasted ${kind.toUpperCase()}`,
    );

    const caretPosition = selectionStart + cleanedText.length;
    setTimeout(() => {
      textarea.selectionStart = caretPosition;
      textarea.selectionEnd = caretPosition;
    }, 0);
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
    try {
      await navigator.clipboard.writeText(bricksJson);
      setStatus("Bricks structure copied");
      setMessages([{ kind: "export", message: "Copied selected Bricks structure." }]);
    } catch {
      setStatus("Clipboard copy failed");
      setMessages([{ kind: "export", message: "Clipboard copy failed. View generated JSON as a fallback." }]);
    }
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
  const dependencyWarnings = dependencies
    .filter((dependency) => dependency.warning)
    .map((dependency): ConversionIssue => ({
      severity: "warning",
      message: dependency.warning ?? dependency.label,
    }));
  const conversionIssues: ConversionIssue[] = [
    ...bricksExport.warnings.map((warning) => ({
      severity: warning.severity,
      message: warning.message,
    })),
    ...runtimeErrors.map((message) => ({ severity: "error" as const, message })),
    ...dependencyWarnings,
  ];
  const warningCount = conversionIssues.length;
  const errorCount = conversionIssues.filter((issue) => issue.severity === "error").length;
  const statusBadgeLabel = errorCount > 0
    ? `${errorCount} error${errorCount === 1 ? "" : "s"}`
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
  const visibleConversionIssues = conversionIssues.slice(0, showConversionDetails ? 8 : 2);
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
            >
              <span className={`nav-icon nav-icon--${item.toLowerCase()}`} aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>
        <div className="product-bar__actions">
          <span className="status-pill status-pill--target">
            {outputAdapter.targetLabel} {outputAdapter.targetVersion}
          </span>
          <span className={statusBadgeClass}>{statusBadgeLabel}</span>
          <button type="button" className="run-button run-button--top" onClick={runCode}>
            Run Preview
          </button>
          <button type="button" className="copy-button copy-button--top" onClick={copyBricksStructure}>
            {outputAdapter.copyLabel}
          </button>
        </div>
      </header>

      <section className="app-workspace">
        <aside className="left-sidebar">
          <section className="app-panel settings-panel">
            <div className="panel-heading">
              <p className="panel__kicker">Project Settings</p>
            </div>
            <label className="field-group">
              <span>Preset</span>
              <select value={activeTemplate} onChange={(event) => loadTemplate(event.currentTarget.value)}>
                {activeTemplate === "custom" && <option value="custom">Custom section</option>}
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Project Prefix</span>
              <input
                type="text"
                value={options.projectPrefix}
                onChange={(event) =>
                  setOption(
                    "projectPrefix",
                    (event.currentTarget as HTMLInputElement).value,
                  )}
              />
            </label>
            <label className="field-group">
              <span>Block Name</span>
              <input
                type="text"
                value={options.blockName}
                onChange={(event) =>
                  setOption(
                    "blockName",
                    (event.currentTarget as HTMLInputElement).value,
                  )}
              />
              <small>This is the fallback wrapper class when source semantics are unclear.</small>
            </label>
            <button
              type="button"
              className="primary-button primary-button--wide"
              onClick={() => setStatus("Preset saved for this session")}
            >
              Save Preset
            </button>
          </section>

          <details className="app-panel recent-panel">
            <summary className="panel__kicker">Recent</summary>
            <div className="recent-list">
              {RECENT_PROJECTS.map((project) => (
                <article className="recent-card" key={project.title}>
                  <span className={`recent-thumb recent-thumb--${project.accent}`} aria-hidden="true" />
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.meta}</p>
                  </div>
                  {project.meta === "Updated just now" && <span className="recent-dot" aria-hidden="true" />}
                </article>
              ))}
            </div>
            <button type="button" className="secondary-button secondary-button--wide">
              View All Projects
            </button>
          </details>
        </aside>

        <main className="center-workspace">
          <section className="workspace-toolbar app-panel">
            <div className="source-heading" aria-label="Source editors">
              <p className="panel__kicker">Source</p>
              <h2>HTML / CSS / JavaScript</h2>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="run-button" onClick={runCode}>
                Run Preview
              </button>
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
            </div>
          </section>

          <section className="builder-split">
            <section className="code-pane app-panel">
              <div className="source-editor-stack">
                {SOURCE_EDITOR_DEFINITIONS.map((editor) => (
                  <CodeEditor
                    key={editor.kind}
                    kind={editor.kind}
                    label={editor.label}
                    badge={editor.badge}
                    value={getEditorValue(editor.kind)}
                    onChange={(value) => setEditorValue(editor.kind, value)}
                    onFormat={() => formatCode(editor.kind)}
                    onCopy={() => copyEditorCode(editor.kind)}
                    onClear={() => clearEditorCode(editor.kind)}
                    onPaste={(event) => handlePaste(editor.kind, event)}
                  />
                ))}
              </div>
              <div className="editor-foot">
                <p>
                  {getEditorHint("html")} CSS may be empty. JavaScript is optional and marked for
                  review rather than converted into builder-native behavior.
                </p>
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

            <section className="canvas-pane app-panel">
              <div className="canvas-header">
                <div>
                  <p className="panel__kicker">Live Preview</p>
                  <h2>{activeTemplateLabel}</h2>
                </div>
                <div className="canvas-options">
                  <Toggle
                    label="Disable Highlights"
                    checked={!PREVIEW_HOVER_INSPECTOR_ENABLED || !highlightsEnabled}
                    onChange={(checked) => setHighlightsEnabled(!checked)}
                    disabled={!PREVIEW_HOVER_INSPECTOR_ENABLED}
                  />
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

          <section className="conversion-check app-panel">
            <div className="conversion-orb" aria-hidden="true">
              <span>{errorCount > 0 ? "x" : warningCount > 0 ? "!" : "✓"}</span>
            </div>
            <div className="conversion-check__body">
              <div className="conversion-check__heading">
                <h2>Conversion Check</h2>
                <span className={warningCount > 0 ? "warning-badge" : "ok-badge"}>
                  {warningCount > 0 ? `${warningCount} Warnings` : "No Warnings"}
                </span>
              </div>
              {visibleConversionIssues.length > 0 ? (
                <ul className="conversion-list">
                  {visibleConversionIssues.map((issue, index) => (
                    <li key={`${issue.message}-${index}`} className={`conversion-${issue.severity}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="conversion-copy">
                  Ready to copy and paste into Bricks.
                </p>
              )}
              {showConversionDetails && (
                <div className="detail-grid">
                  <article>
                    <strong>Dependencies</strong>
                    <span>{dependencies.length}</span>
                  </article>
                  <article>
                    <strong>JavaScript review</strong>
                    <span>{preview.js.trim() ? "Required" : "None"}</span>
                  </article>
                  <article>
                    <strong>Export mode</strong>
                    <span>{getExportModeLabel(options.exportMode)}</span>
                  </article>
                </div>
              )}
            </div>
            <div className="conversion-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowConversionDetails((current) => !current)}
              >
                {showConversionDetails ? "Hide Details" : "View Details"}
              </button>
            </div>
          </section>
        </main>

        <aside className="right-sidebar app-panel">
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
                <p className="empty-state">No external dependencies detected.</p>
              ) : (
                <div className="dependency-list">
                  {dependencies.map((dependency) => (
                    <article className="dependency-item" key={dependency.id}>
                      <div>
                        <span className={`dependency-type dependency-type--${dependency.type}`}>
                          {dependency.type}
                        </span>
                        <h3>{dependency.label}</h3>
                        <p>{dependency.value}</p>
                      </div>
                      {dependency.warning && <p className="dependency-warning">{dependency.warning}</p>}
                    </article>
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
                  <h2>{warningCount} issue{warningCount === 1 ? "" : "s"}</h2>
                </div>
              </div>
              {conversionIssues.length === 0 ? (
                <p className="empty-state">No warnings. Structure is ready to copy.</p>
              ) : (
                <ul className="warning-list">
                  {conversionIssues.map((issue, index) => (
                    <li key={`${issue.message}-${index}`} className={`conversion-${issue.severity}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {activeWorkflowTab === "export" && (
            <section className="workflow-panel export-settings">
            <div className="sidebar-heading">
              <div>
                <p className="panel__kicker">Export Settings</p>
                <h2>Output Format</h2>
              </div>
              <span className="mode-pill">{getExportModeLabel(options.exportMode)}</span>
            </div>

            <label className="field-group field-group--inline">
              <span>Output Format</span>
              <select value={outputAdapter.format} onChange={() => undefined}>
                <option value={outputAdapter.format}>{outputAdapter.formatLabel}</option>
              </select>
              <small>More output formats later.</small>
            </label>

            <label className="field-group field-group--inline">
              <span>Export mode</span>
              <select
                value={options.exportMode === "structure-only" ? "structure-only" : "element-styles"}
                onChange={(event) =>
                  setExportMode((event.currentTarget as HTMLSelectElement).value as ExportMode)}
              >
                <option value="element-styles">Element styles</option>
                <option value="structure-only">Structure only</option>
              </select>
            </label>

            <section className="attachment-card">
              <p>Class attachment</p>
              <span className="attachment-value">Element classes</span>
              <small>
                Element styles attaches BEM classes to each Bricks element and writes matching CSS
                into that element using Bricks' %root% custom CSS pattern.
              </small>
            </section>

            <dl className="export-summary">
              <div>
                <dt>Elements</dt>
                <dd>{bricksExport.validation.totalElements}</dd>
              </div>
              <div>
                <dt>BEM classes</dt>
                <dd>{bricksExport.validation.bemClassCount}</dd>
              </div>
              <div>
                <dt>Global classes</dt>
                <dd>{bricksExport.validation.globalClassCount}</dd>
              </div>
              <div>
                <dt>CSS scoped</dt>
                <dd>
                  {options.exportMode === "scoped-css-block"
                    ? bricksExport.validation.cssScopedRuleCount
                    : bricksExport.validation.cssAttachedRuleCount}
                </dd>
              </div>
              <div>
                <dt>Warnings</dt>
                <dd>{warningCount}</dd>
              </div>
              <div>
                <dt>Skipped layers</dt>
                <dd>{bricksExport.validation.skippedLayerCount}</dd>
              </div>
            </dl>

            <details
              className="advanced-export"
              open={showAdvancedExport}
              onToggle={(event) =>
                setShowAdvancedExport((event.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>Advanced export settings</summary>
              <div className="toggle-stack">
                <Toggle
                  label="Strict BEM"
                  checked={options.classMode === "strict-bem"}
                  onChange={(checked) =>
                    setOption("classMode", checked ? "strict-bem" : "hybrid" as ClassMode)}
                />
                <Toggle
                  label="Scoped CSS"
                  checked={options.exportMode === "scoped-css-block"}
                  onChange={(checked) => setExportMode(checked ? "scoped-css-block" : "element-styles")}
                  note="Advanced fallback for a generated CSS block."
                />
                <Toggle
                  label="Global classes"
                  checked={options.exportMode === "global-classes"}
                  onChange={(checked) => setExportMode(checked ? "global-classes" : "element-styles")}
                  note="Create Bricks global class entries only when needed."
                />
                <Toggle
                  label="Include external CSS"
                  checked={options.includeExternalCss}
                  onChange={(checked) => setOption("includeExternalCss", checked)}
                />
                <Toggle
                  label="Include external JS"
                  checked={options.includeExternalScripts}
                  onChange={(checked) => setOption("includeExternalScripts", checked)}
                  note="Review custom code before using it in Bricks."
                />
                <Toggle
                  label="Minify element CSS"
                  checked={options.minifyElementCss}
                  onChange={(checked) => setOption("minifyElementCss", checked)}
                  note="Optional compact %root% CSS. Readable CSS remains the default."
                />
              </div>
            </details>

            <button type="button" className="copy-button copy-button--wide" onClick={copyBricksStructure}>
              {outputAdapter.copyLabel}
            </button>
            <button
              type="button"
              className="secondary-button secondary-button--wide"
              onClick={() => setShowJson((current) => !current)}
            >
              {showJson ? "Hide generated JSON" : "View generated JSON"}
            </button>
            {showJson && <pre className="json-output">{bricksJson}</pre>}

            <p className="status-line">{status}</p>
            </section>
          )}
        </aside>
      </section>
    </section>
  );
}
