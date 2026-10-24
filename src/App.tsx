import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FileVideo2,
  FolderOpen,
  Keyboard,
  LoaderCircle,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Split,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Share2,
  X,
} from "lucide-react";
import {
  fileSize,
  formatTime,
  invertSegments,
  parseTime,
  readProject,
  segment,
  splitSegment,
  writeProject,
  type Edit,
  type Segment,
} from "./editor";
import {
  cancelProcessing,
  exportClips,
  inspectMedia,
  type MediaInfo,
  type ExportedClip,
} from "./media";

const COLORS = ["#5a9bfc", "#73c8b5", "#e3b777", "#90bdd8", "#e8a5a5"];
const initial: Edit = { segments: [], selected: null };
const shortcutGroups = [
  ["Space", "Play / pause"],
  ["← / →", "Seek one second"],
  ["Shift + ← / →", "Seek five seconds"],
  ["I / O", "Set segment start / end"],
  ["B", "Split at playhead"],
  ["N", "Add a segment"],
  ["Delete", "Remove selected segment"],
  ["⌘ / Ctrl + Z", "Undo"],
  ["⌘ / Ctrl + Shift + Z", "Redo"],
  ["⌘ / Ctrl + S", "Save project"],
];

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
  closeOnBackdrop = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (closeOnBackdrop && e.target === e.currentTarget &&
          (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(formatTime(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(formatTime(value));
    setInvalid(false);
  }, [value]);
  function submit() {
    const next = parseTime(text);
    if (next === null) {
      setInvalid(true);
      return;
    }
    onChange(next);
    setText(formatTime(value));
    setInvalid(false);
  }
  return (
    <label className="time-field">
      <span>{label}</span>
      <input
        aria-label={label}
        aria-invalid={invalid}
        disabled={disabled}
        value={text}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {invalid && <small className="field-error" role="alert">Use seconds or hh:mm:ss.sss.</small>}
    </label>
  );
}

function useThumbnails(url: string, duration: number) {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    setFrames([]);
    if (!url || !duration) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d");
    let timeout: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
    };
    const capture = async () => {
      const next: string[] = [];
      for (let i = 0; i < 12 && !cancelled; i++) {
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            clearTimeout(timeout);
            resolve();
          };
          timeout = setTimeout(resolve, 2500);
          video.currentTime = Math.min(
            duration - 0.02,
            ((i + 0.1) * duration) / 12,
          );
        });
        if (cancelled || !context || video.readyState < 2) break;
        context.drawImage(video, 0, 0, 160, 90);
        next.push(canvas.toDataURL("image/jpeg", 0.55));
      }
      if (!cancelled) setFrames(next);
      finish();
    };
    video.onloadeddata = () => {
      video.onloadeddata = null;
      void capture();
    };
    video.src = url;
    return () => {
      cancelled = true;
      finish();
    };
  }, [url, duration]);
  return frames;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [history, setHistory] = useState({ entries: [initial], index: 0 });
  const edit = history.entries[history.index]!;
  const selected = edit.segments.find((s) => s.id === edit.selected);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [modal, setModal] = useState<"help" | "about" | "exports" | null>(null);
  const [panel, setPanel] = useState<"segments" | "tracks">("segments");
  const [extension, setExtension] = useState("original");
  const [merge, setMerge] = useState(false);
  const [tracks, setTracks] = useState<number[]>([]);
  const [outputs, setOutputs] = useState<ExportedClip[]>([]);
  const [shareError, setShareError] = useState("");
  const [drag, setDrag] = useState<{
    id: string;
    edge: "start" | "end";
    start: number;
    end: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const timelineScroller = useRef<HTMLDivElement>(null);
  const operation = useRef(0);
  const outputRef = useRef(outputs);
  outputRef.current = outputs;
  const duration = media?.duration ?? 0;
  const thumbnails = useThumbnails(url, media?.width ? duration : 0);
  const enabled = edit.segments.filter((s) => s.enabled);
  const total = enabled.reduce((sum, s) => sum + s.end - s.start, 0);
  const ready = !!media && !busy;

  useEffect(() => {
    if (video.current) video.current.playbackRate = rate;
  }, [rate, url]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(
    () => () => {
      outputRef.current.forEach((o) => URL.revokeObjectURL(o.url));
    },
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (edit.segments.length || busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [edit.segments.length, busy]);

  function commit(next: Edit | ((current: Edit) => Edit)) {
    setHistory((h) => {
      const result =
        typeof next === "function" ? next(h.entries[h.index]!) : next;
      if (result === h.entries[h.index]) return h;
      const entries = [...h.entries.slice(0, h.index + 1), result].slice(-100);
      return { entries, index: entries.length - 1 };
    });
  }
  function undo() {
    setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
  }
  function redo() {
    setHistory((h) => ({
      ...h,
      index: Math.min(h.entries.length - 1, h.index + 1),
    }));
  }
  function update(id: string, changes: Partial<Segment>) {
    commit((e) => ({
      ...e,
      segments: e.segments.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    }));
  }
  function select(id: string) {
    setHistory((h) => ({
      ...h,
      entries: h.entries.map((e, i) =>
        i === h.index ? { ...e, selected: id } : e,
      ),
    }));
  }
  function seek(next: number) {
    const clamped = Math.max(0, Math.min(duration, next));
    setTime(clamped);
    if (video.current && !previewError) video.current.currentTime = clamped;
  }
  function play() {
    if (!video.current || previewError) return;
    if (video.current.paused)
      void video.current
        .play()
        .catch(() =>
          setError(
            "This browser cannot play this media. You can still edit and export it.",
          ),
        );
    else video.current.pause();
  }
  async function fullscreen() {
    const element = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!element) return;
    try {
      if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitEnterFullscreen) element.webkitEnterFullscreen();
      else throw new Error("Fullscreen is unavailable.");
    } catch {
      setError("Fullscreen is unavailable in this browser. You can still use the inline preview.");
    }
  }
  async function shareOutput(output: ExportedClip) {
    setShareError("");
    try {
      await navigator.share({ files: [output.file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setShareError("Could not share this file. Use its download link instead.");
    }
  }
  function mark(edge: "start" | "end", value = time) {
    if (!selected) return;
    if (
      value < 0 ||
      value > duration ||
      (edge === "start" ? value >= selected.end : value <= selected.start)
    ) {
      setError(
        "The start must be before the end, and both must be inside the source video.",
      );
      return;
    }
    update(selected.id, { [edge]: value });
  }
  function addSegment() {
    if (!duration) return;
    const s = segment(Math.min(time, duration - 0.01), duration);
    commit((e) => ({ segments: [...e.segments, s], selected: s.id }));
  }
  function removeSegment() {
    commit((e) => {
      const rest = e.segments.filter((s) => s.id !== e.selected);
      return { segments: rest, selected: rest[0]?.id ?? null };
    });
  }
  function saveProject() {
    if (!file) return;
    downloadBlob(
      new Blob([writeProject(file.name, edit.segments)], {
        type: "application/json",
      }),
      `${file.name.replace(/\.[^.]+$/, "")}.llc`,
    );
    setNotice("Project saved. Your original media stays untouched.");
  }
  function downloadBlob(blob: Blob, name: string) {
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
  async function openFile(next: File) {
    if (busy) return;
    if (/\.(llc|json)$/i.test(next.name)) {
      await importProject(next);
      return;
    }
    if (next.size > 512 * 1024 * 1024) {
      setError(
        "This browser edition supports files up to 512 MB. Use desktop LosslessCut for larger media.",
      );
      return;
    }
    const token = ++operation.current;
    setBusy("Reading your media");
    setProgress(null);
    setError("");
    video.current?.pause();
    try {
      const info = await inspectMedia(next, setBusy);
      if (operation.current !== token) return;
      const first = segment(0, info.duration);
      setFile(next);
      setMedia(info);
      setUrl(URL.createObjectURL(next));
      setHistory({
        entries: [{ segments: [first], selected: first.id }],
        index: 0,
      });
      setTracks(
        info.streams
          .filter((s) => s.type === "video" || s.type === "audio")
          .map((s) => s.index),
      );
      setTime(0);
      setPlaying(false);
      setZoom(1);
      setPreviewError(false);
      setExtension("original");
      setRate(1);
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
      setOutputs([]);
    } catch (e) {
      if (operation.current === token)
        setError(e instanceof Error ? e.message : "Could not open this file.");
    } finally {
      if (operation.current === token) {
        setBusy("");
        setProgress(null);
      }
    }
  }
  async function importProject(project: File) {
    if (!media) {
      setError("Open the source media first, then load its project.");
      return;
    }
    try {
      const segments = readProject(await project.text(), duration);
      commit({ segments, selected: segments[0]?.id ?? null });
      setNotice(`Loaded ${segments.length} segments from your project.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the project.");
    }
  }
  async function sample() {
    try {
      const response = await fetch("/sample.mp4");
      if (!response.ok)
        throw new Error(
          "Sample video is unavailable. Try opening your own video.",
        );
      await openFile(
        new File([await response.blob()], "Orbit — sample.mp4", {
          type: "video/mp4",
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample.");
    }
  }
  async function runExport() {
    if (!file || !enabled.length || !tracks.length) return;
    const token = ++operation.current;
    setError("");
    setBusy("Preparing export");
    setProgress(null);
    try {
      const result = await exportClips(
        file,
        enabled,
        extension,
        merge,
        tracks,
        (label, value) => {
          setBusy(label);
          setProgress(value);
        },
      );
      if (operation.current !== token) {
        result.forEach((o) => URL.revokeObjectURL(o.url));
        return;
      }
      outputs.forEach((o) => URL.revokeObjectURL(o.url));
      setOutputs(result);
      setShareError("");
      setModal("exports");
    } catch (e) {
      if (operation.current === token)
        setError(
          e instanceof Error
            ? e.message
            : "Export failed. Try keeping the original container.",
        );
    } finally {
      if (operation.current === token) {
        setBusy("");
        setProgress(null);
      }
    }
  }
  function cancel() {
    operation.current++;
    cancelProcessing();
    setBusy("");
    setProgress(null);
    setNotice("Processing cancelled. Your edits are safe.");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input, textarea, select") ||
          e.target.isContentEditable)
      )
        return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button, a") &&
        (e.key === " " || e.key === "Enter")
      )
        return;
      if (modal || busy) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject();
        return;
      }
      if (!ready || mod || e.altKey) return;
      if (
        [
          " ",
          "ArrowLeft",
          "ArrowRight",
          "Delete",
          "Backspace",
          "i",
          "o",
          "b",
          "n",
        ].includes(e.key)
      )
        e.preventDefault();
      if (e.key === " ") play();
      if (e.key === "ArrowLeft") seek(time - (e.shiftKey ? 5 : 1));
      if (e.key === "ArrowRight") seek(time + (e.shiftKey ? 5 : 1));
      if (e.key === "i") mark("start");
      if (e.key === "o") mark("end");
      if (e.key === "b") commit((s) => splitSegment(s, time));
      if (e.key === "n") addSegment();
      if (e.key === "Delete" || e.key === "Backspace") removeSegment();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function timelineTime(clientX: number) {
    const rect = timeline.current!.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(duration, ((clientX - rect.left) / rect.width) * duration),
    );
  }

  function startScrub(e: ReactPointerEvent<HTMLElement>) {
    if (!ready || e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    video.current?.pause();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(timelineTime(e.clientX));
  }
  function moveScrub(e: ReactPointerEvent<HTMLElement>) {
    if (ready && e.currentTarget.hasPointerCapture(e.pointerId))
      seek(timelineTime(e.clientX));
  }
  function endScrub(e: ReactPointerEvent<HTMLElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function keyScrub(e: ReactKeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (!ready) return;
    seek(
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? duration
          : time + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 5 : 1),
    );
  }
  const scrubEvents = {
    onPointerDown: startScrub,
    onPointerMove: moveScrub,
    onPointerUp: endScrub,
    onPointerCancel: endScrub,
  };

  return (
    <div
      className={`app ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) {
          setDragOver(false);
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = busy ? "none" : "copy";
        if (!busy) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragOver(false);
      }}
      onDrop={(e) => {
        setDragOver(false);
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        if (e.dataTransfer.files[0]) void openFile(e.dataTransfer.files[0]);
      }}
      onDragEnd={() => setDragOver(false)}
    >
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        aria-label="Open media file"
        accept="video/*,audio/*,.mkv,.avi,.mts,.m2ts,.ts,.mov,.flac,.llc"
        onChange={(e) => {
          if (e.target.files?.[0]) void openFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={projectInput}
        className="visually-hidden"
        type="file"
        aria-label="Load project file"
        onChange={(e) => {
          if (e.target.files?.[0]) void importProject(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setModal("about");
          }}
          aria-label="About ClipIt"
        >
          <span className="brand-icon">
            <Scissors size={21} strokeWidth={2.2} />
          </span>
          clipit
        </a>
        <div className="header-center">Lossless video editor</div>
        <div className="header-actions">
          <span className="local-note">
            <ShieldCheck size={16} /> On your device
          </span>
          <IconButton
            label="Keyboard shortcuts"
            onClick={() => setModal("help")}
          >
            <Keyboard size={19} />
          </IconButton>
          <button
            className="button secondary"
            disabled={!!busy}
            onClick={() => fileInput.current?.click()}
          >
            <FolderOpen size={16} />
            Open file
          </button>
        </div>
      </header>

      <main className="workspace" aria-busy={!!busy}>
        <section className="editor-pane" aria-label="Video editor">
          <div className="source-bar">
            <div className="source-title">
              <FileVideo2 size={16} />
              <span>{file?.name ?? "New project"}</span>
              {file && <span className="file-tag">{fileSize(file.size)}</span>}
            </div>
            <span className="source-detail">
              {media
                ? `${media.width ? `${media.width} × ${media.height}` : "Audio"}${media.fps ? ` / ${media.fps.toFixed(2)} fps` : ""}`
                : "Video & audio"}
            </span>
          </div>
          <div className={`viewer ${file ? "has-media" : ""}`}>
            {url ? (
              <>
                <video
                  ref={video}
                  src={url}
                  playsInline
                  muted={muted}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onError={() => setPreviewError(true)}
                  onClick={play}
                />
                {(!media?.width || previewError) && (
                  <div className="media-fallback">
                    <FileVideo2 size={40} />
                    <h2>
                      {previewError
                        ? "Preview unavailable"
                        : "Audio-only source"}
                    </h2>
                    <p>
                      {previewError
                        ? "Your browser cannot decode this format. You can still mark times and export losslessly."
                        : "Use the transport controls to listen and mark your cuts."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-viewer">
                <div className="empty-copy">
                  <h1>Keep the<br />good parts.</h1>
                  <p>
                    Cut video and audio without re-encoding. Your files stay on
                    this device.
                  </p>
                  <button
                    className="button primary open-main"
                    disabled={!!busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    <FolderOpen size={18} />
                    Open file
                  </button>
                  <span className="drop-hint">
                    or drop media here · up to 512 MB
                  </span>
                </div>
                <button
                  className="sample-preview"
                  aria-label="Try the sample"
                  onClick={() => void sample()}
                  disabled={!!busy}
                >
                  <img
                    src="/sample-poster.jpg"
                    alt="Orbit, ClipIt's original film of a ringed planet"
                    draggable={false}
                  />
                  <span className="sample-caption">
                    <span className="sample-play">
                      <Play size={17} fill="currentColor" />
                    </span>
                    <span>
                      Try the sample<small>Orbit · 12-second original</small>
                    </span>
                    <ChevronRight size={18} />
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="transport">
            <div className="playback-left">
              <IconButton
                label={muted ? "Unmute preview" : "Mute preview"}
                disabled={!ready}
                onClick={() => setMuted(!muted)}
              >
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </IconButton>
              <select
                aria-label="Playback speed"
                disabled={!ready}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                {[0.25, 0.5, 1, 1.5, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </div>
            <div className="playback-main">
              <IconButton
                label="Go to start"
                disabled={!ready}
                onClick={() => seek(0)}
              >
                <SkipBack size={17} />
              </IconButton>
              <IconButton
                label="Back one frame"
                disabled={!ready}
                onClick={() => seek(time - 1 / (media?.fps || 30))}
              >
                <ChevronLeft size={20} />
              </IconButton>
              <button
                className="play-button"
                aria-label={playing ? "Pause" : "Play"}
                disabled={!ready || previewError}
                onClick={play}
              >
                {playing ? (
                  <Pause size={19} fill="currentColor" />
                ) : (
                  <Play size={19} fill="currentColor" />
                )}
              </button>
              <IconButton
                label="Forward one frame"
                disabled={!ready}
                onClick={() => seek(time + 1 / (media?.fps || 30))}
              >
                <ChevronRight size={20} />
              </IconButton>
              <IconButton
                label="Go to end"
                disabled={!ready}
                onClick={() => seek(duration)}
              >
                <SkipForward size={17} />
              </IconButton>
            </div>
            <div className="playback-right">
              <span className="timecode">
                {formatTime(time)}
                <span> / {formatTime(duration)}</span>
              </span>
              <IconButton
                label="Fullscreen preview"
                disabled={!ready || !media?.width}
                onClick={() => void fullscreen()}
              >
                <Maximize size={16} />
              </IconButton>
            </div>
          </div>

          <section className="timeline-section" aria-label="Timeline">
            <div className="timeline-toolbar">
              <div className="tool-group">
                <h2 className="timeline-title">Timeline</h2>
                <IconButton
                  label="Undo (Ctrl+Z)"
                  disabled={!ready || history.index === 0}
                  onClick={undo}
                >
                  <Undo2 size={16} />
                </IconButton>
                <IconButton
                  label="Redo (Ctrl+Shift+Z)"
                  disabled={
                    !ready || history.index === history.entries.length - 1
                  }
                  onClick={redo}
                >
                  <Redo2 size={16} />
                </IconButton>
                <button
                  className="tool-button"
                  disabled={
                    !ready ||
                    !selected ||
                    time <= selected.start ||
                    time >= selected.end
                  }
                  onClick={() => commit((s) => splitSegment(s, time))}
                >
                  <Scissors size={15} />
                  Split<kbd>B</kbd>
                </button>
                <button
                  className="tool-button"
                  disabled={!ready}
                  onClick={() => {
                    const segments = invertSegments(edit.segments, duration);
                    commit({ segments, selected: segments[0]?.id ?? null });
                  }}
                >
                  <ArrowLeftRight size={15} />
                  Invert
                </button>
              </div>
              <p className="timeline-guide">Drag to seek. Pull the edges to trim.</p>
              <div className="tool-group zoom-tools">
                <IconButton
                  label="Zoom out"
                  disabled={zoom <= 1 || !ready}
                  onClick={() => setZoom((z) => Math.max(1, z / 2))}
                >
                  <Minus size={15} />
                </IconButton>
                <span>{zoom === 1 ? "Fit" : `${zoom}×`}</span>
                <IconButton
                  label="Zoom in"
                  disabled={zoom >= 16 || !ready}
                  onClick={() => setZoom((z) => Math.min(16, z * 2))}
                >
                  <Plus size={15} />
                </IconButton>
              </div>
            </div>
            <div className="timeline-scroll" ref={timelineScroller}
              onScroll={(e) => {
                const el = e.currentTarget;
                setTimelinePosition(el.scrollLeft / (el.scrollWidth - el.clientWidth || 1) * 100);
              }}>
              <div
                className="timeline-content"
                ref={timeline}
                style={{ width: `${zoom * 100}%` }}
                onDragStart={(e) => e.preventDefault()}
              >
                <div
                  className="ruler"
                  role="slider"
                  aria-label="Playhead position"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={time}
                  aria-valuetext={formatTime(time)}
                  aria-disabled={!ready}
                  tabIndex={ready ? 0 : -1}
                  onKeyDown={keyScrub}
                  {...scrubEvents}
                >
                  {Array.from({ length: 8 * zoom + 1 }, (_, i) => (
                    <span
                      key={i}
                      style={{ left: `${(i / (8 * zoom)) * 100}%` }}
                    >
                      {formatTime(
                        ((duration || 60) * i) / (8 * zoom),
                        false,
                      ).slice(duration >= 3600 ? 0 : 3)}
                    </span>
                  ))}
                </div>
                <div
                  className={`filmstrip ${!file ? "filmstrip-empty" : ""}`}
                  tabIndex={-1}
                  {...scrubEvents}
                >
                  {thumbnails.length ? (
                    thumbnails.map((src, i) => (
                      <img key={i} src={src} alt="" draggable={false} />
                    ))
                  ) : (
                    <span>
                      <FileVideo2 size={17} />
                      {file ? file.name : "Open a video to see your timeline"}
                    </span>
                  )}
                </div>
                <div className="segment-lane">
                  {edit.segments.map((s, i) => {
                    const visible =
                      drag?.id === s.id
                        ? { ...s, start: drag.start, end: drag.end }
                        : s;
                    return (
                      <div
                        key={s.id}
                        className={`timeline-segment ${s.id === edit.selected ? "selected" : ""} ${!s.enabled ? "excluded" : ""}`}
                        style={
                          {
                            left: `${(visible.start / duration) * 100}%`,
                            width: `${((visible.end - visible.start) / duration) * 100}%`,
                            "--segment-color": COLORS[i % COLORS.length],
                          } as CSSProperties
                        }
                        onClick={() => select(s.id)}
                      >
                        <span className="timeline-segment-label">
                          <span>{s.name || `Segment ${i + 1}`}</span>
                        </span>
                        {(["start", "end"] as const).map((edge) => (
                          <button
                            key={edge}
                            className={`trim-handle ${edge}`}
                            aria-label={`Drag segment ${i + 1} ${edge}`}
                            disabled={!ready}
                            onPointerDown={(e) => {
                              if (e.button !== 0 || !e.isPrimary) return;
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.focus({ preventScroll: true });
                              e.currentTarget.setPointerCapture(e.pointerId);
                              select(s.id);
                              setDrag({
                                id: s.id,
                                edge,
                                start: s.start,
                                end: s.end,
                              });
                            }}
                            onPointerMove={(e) => {
                              if (
                                !drag ||
                                !e.currentTarget.hasPointerCapture(e.pointerId)
                              )
                                return;
                              const n = timelineTime(e.clientX);
                              setDrag((d) =>
                                d
                                  ? {
                                      ...d,
                                      [edge]:
                                        edge === "start"
                                          ? Math.min(n, d.end - 0.01)
                                          : Math.max(n, d.start + 0.01),
                                    }
                                  : d,
                              );
                            }}
                            onPointerUp={(e) => {
                              if (drag && e.currentTarget.hasPointerCapture(e.pointerId))
                                update(s.id, {
                                  start: drag.start,
                                  end: drag.end,
                                });
                              setDrag(null);
                              endScrub(e);
                            }}
                            onPointerCancel={() => setDrag(null)}
                            onLostPointerCapture={() => setDrag(null)}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {!edit.segments.length && (
                    <span className="empty-lane">
                      Your selected segments will appear here
                    </span>
                  )}
                </div>
                {file && (
                  <div
                    className="playhead"
                    style={{ left: `${(time / duration) * 100}%` }}
                  >
                    <button
                      className="playhead-handle"
                      aria-label="Drag playhead"
                      title="Drag to seek"
                      disabled={!ready}
                      onKeyDown={keyScrub}
                      {...scrubEvents}
                    />
                  </div>
                )}
              </div>
            </div>
            {zoom > 1 && (
              <label className="timeline-navigation">
                <span>Pan zoomed timeline</span>
                <input type="range" min={0} max={100} step="any" value={timelinePosition}
                  aria-label="Pan zoomed timeline" disabled={!ready}
                  onChange={(e) => {
                    const el = timelineScroller.current;
                    if (el) el.scrollLeft = Number(e.target.value) / 100 * (el.scrollWidth - el.clientWidth);
                  }} />
              </label>
            )}
            <div className="mark-bar">
              <div className="mark-fields">
                <button
                  className="mark-button"
                  disabled={!ready || !selected}
                  onClick={() => mark("start")}
                  title="Set start to playhead (I)"
                >
                  <span>［</span>Mark in<kbd>I</kbd>
                </button>
                <TimeField
                  label="Start time"
                  value={selected?.start ?? 0}
                  disabled={!ready || !selected}
                  onChange={(n) => mark("start", n)}
                />
                <span className="range-separator">—</span>
                <TimeField
                  label="End time"
                  value={selected?.end ?? 0}
                  disabled={!ready || !selected}
                  onChange={(n) => mark("end", n)}
                />
                <button
                  className="mark-button"
                  disabled={!ready || !selected}
                  onClick={() => mark("end")}
                  title="Set end to playhead (O)"
                >
                  Mark out<span>］</span>
                  <kbd>O</kbd>
                </button>
              </div>
              <span className="selection-duration">
                Selection
                <span>
                  {formatTime(selected ? selected.end - selected.start : 0)}
                </span>
              </span>
            </div>
          </section>
        </section>

        <aside className="sidebar" aria-label="Segments and export">
          <div className="panel-tabs">
            <button
              className={panel === "segments" ? "active" : ""}
              aria-pressed={panel === "segments"}
              onClick={() => setPanel("segments")}
            >
              <Split size={15} />
              Segments<span>{edit.segments.length}</span>
            </button>
            <button
              className={panel === "tracks" ? "active" : ""}
              aria-pressed={panel === "tracks"}
              onClick={() => setPanel("tracks")}
            >
              <SlidersHorizontal size={15} />
              Tracks
            </button>
          </div>
          <div className="segment-panel">
            {panel === "segments" ? (
              <>
                <div className="panel-subhead">
                  <span>Your kept moments</span>
                  <button
                    className="tool-button"
                    aria-label="Add segment (N)"
                    title="Add segment (N)"
                    disabled={!ready}
                    onClick={addSegment}
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
                <div className="segment-list">
                  {edit.segments.length ? (
                    edit.segments.map((s, i) => (
                      <article
                        key={s.id}
                        className={`segment-card ${edit.selected === s.id ? "active" : ""} ${!s.enabled ? "excluded" : ""}`}
                        style={
                          {
                            "--segment-color": COLORS[i % COLORS.length],
                          } as CSSProperties
                        }
                      >
                        <div className="segment-card-top">
                          <button
                            className="segment-number"
                            onClick={() => {
                              select(s.id);
                              seek(s.start);
                            }}
                            aria-label={`Select segment ${i + 1}`}
                          >
                            {thumbnails.length > 0 && (
                              <img src={thumbnails[Math.min(thumbnails.length - 1, Math.floor(s.start / duration * thumbnails.length))]} alt="" draggable={false} />
                            )}
                            <span>{i + 1}</span>
                          </button>
                          <input
                            className="segment-name"
                            aria-label={`Segment ${i + 1} name`}
                            placeholder={`Segment ${i + 1}`}
                            key={`${s.id}-${s.name}`}
                            defaultValue={s.name}
                            enterKeyHint="done"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            onFocus={() => select(s.id)}
                            onBlur={(e) => {
                              if (e.target.value !== s.name)
                                update(s.id, { name: e.target.value });
                            }}
                            disabled={!!busy}
                          />
                          <label
                            className="include-segment"
                            title="Include in export"
                          >
                            <input
                              type="checkbox"
                              aria-label={`Include segment ${i + 1} in export`}
                              checked={s.enabled}
                              disabled={!ready}
                              onChange={(e) =>
                                update(s.id, { enabled: e.target.checked })
                              }
                            />
                            <Check size={12} />
                          </label>
                        </div>
                        <button
                          className="segment-range"
                          onClick={() => {
                            select(s.id);
                            seek(s.start);
                          }}
                        >
                          <span>{formatTime(s.start)}</span>
                          <span>→</span>
                          <span>{formatTime(s.end)}</span>
                        </button>
                        <div className="segment-card-bottom">
                          <span>
                            {formatTime(s.end - s.start)}
                            <span> duration</span>
                          </span>
                          <IconButton
                            label={`Delete segment ${i + 1}`}
                            disabled={!ready}
                            onClick={() =>
                              commit((e) => {
                                const segments = e.segments.filter(
                                  (x) => x.id !== s.id,
                                );
                                return {
                                  segments,
                                  selected:
                                    e.selected === s.id
                                      ? (segments[0]?.id ?? null)
                                      : e.selected,
                                };
                              })
                            }
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-segments">
                      <h3>No segments yet</h3>
                      <p>{file ? "Add a segment at the playhead to keep another moment." : "Open a file, then mark a start and end. Each range becomes a segment."}</p>
                      <div>
                        <kbd>I</kbd>
                        <span>in</span>
                        <kbd>O</kbd>
                        <span>out</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="track-list">
                <p>Select the streams to include in your export.</p>
                {media ? (
                  media.streams.map((s) => (
                    <label className="track-row" key={s.index}>
                      <input
                        type="checkbox"
                        checked={tracks.includes(s.index)}
                        disabled={!ready}
                        onChange={(e) =>
                          setTracks((t) =>
                            e.target.checked
                              ? [...t, s.index]
                              : t.filter((i) => i !== s.index),
                          )
                        }
                      />
                      <span>
                        <strong>
                          {s.type} {s.index + 1}
                        </strong>
                        <small>
                          {s.codec}
                          {s.language ? ` · ${s.language}` : ""}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="empty-tracks">
                    <SlidersHorizontal size={28} />
                    <p>
                      Open a file to inspect its video, audio, and subtitle
                      tracks.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="project-actions">
              <button disabled={!ready} onClick={saveProject}>
                <Download size={13} />
                Save project
              </button>
              <button
                disabled={!ready}
                onClick={() => projectInput.current?.click()}
              >
                <FolderOpen size={13} />
                Load project
              </button>
            </div>
          </div>

          <section className="export-panel" aria-label="Export settings">
            <div className="export-title">
              <Settings2 size={15} />
              <h2>Export</h2>
              <span><Check size={14} /> Lossless</span>
            </div>
            <details className="export-options">
              <summary>
                Export options<ChevronDown size={16} />
              </summary>
              <label className="export-row">
                <span>Container</span>
                <div className="select-wrap">
                  <select
                    aria-label="Output container"
                    value={extension}
                    disabled={!ready}
                    onChange={(e) => setExtension(e.target.value)}
                  >
                    <option value="original">Same as source</option>
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WebM</option>
                    <option value="m4a">M4A (audio)</option>
                    <option value="mp3">MP3 (audio)</option>
                    <option value="wav">WAV (audio)</option>
                  </select>
                  <ChevronDown size={13} />
                </div>
              </label>
              <label className="export-row">
                <span>Merge selected segments</span>
                <input
                  className="switch"
                  type="checkbox"
                  checked={merge}
                  disabled={!ready}
                  onChange={(e) => setMerge(e.target.checked)}
                />
              </label>
              <div className="copy-note">
                <Copy size={14} />
                <span>
                  Stream copy. No re-encoding.
                  <small>Cuts snap to nearby keyframes.</small>
                </span>
              </div>
            </details>
            <div className="export-summary">
              <span>
                {enabled.length} {enabled.length === 1 ? "segment" : "segments"}{" "}
                selected
              </span>
              <strong>{formatTime(total)}</strong>
            </div>
            <button
              className="button export-button"
              disabled={!ready || !enabled.length || !tracks.length}
              onClick={() => void runExport()}
            >
              <ArrowDownToLine size={17} />
              Export{" "}
              {enabled.length > 1 ? `${enabled.length} segments` : "video"}
            </button>
            {outputs.length > 0 && (
              <button
                className="previous-exports"
                onClick={() => setModal("exports")}
              >
                View last export ({outputs.length})
              </button>
            )}
            <span className="export-footnote">
              Keyframe-aligned. No re-encoding.
            </span>
          </section>
        </aside>
      </main>

      <footer className="app-footer">
        <span role="status">
          <ShieldCheck size={14} />
          {notice ||
            (busy
              ? "Processing locally"
              : file
                ? "Ready to cut"
                : "Local files. Original quality.")}
        </span>
        <div>
          <span>
            <kbd>Space</kbd> play / pause
          </span>
          <span>
            <kbd>I</kbd>
            <kbd>O</kbd> mark range
          </span>
          <button onClick={() => setModal("help")}>
            <CircleHelp size={13} />
            All shortcuts
          </button>
        </div>
        <button onClick={() => setModal("about")}>About ClipIt</button>
      </footer>
      {busy && (
        <Modal title={busy} onClose={cancel} closeOnBackdrop={false}>
          <div className="processing">
            <LoaderCircle className="spin" size={24} />
            <span role="status">
              {progress === null ? "Processing locally on your device" : `${Math.round(progress * 100)}% complete`}
            </span>
            <progress aria-label="Processing progress" max={1} value={progress ?? undefined} />
            <button className="button secondary" onClick={cancel}>Cancel</button>
          </div>
        </Modal>
      )}
      {dragOver && (
        <div className="drop-overlay">
          <FolderOpen size={42} />
          <h2>Drop it here.</h2>
          <p>Your video stays on your device.</p>
        </div>
      )}
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <IconButton label="Dismiss error" onClick={() => setError("")}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      {modal === "help" && (
        <Modal title="A few keys. Faster cuts." onClose={() => setModal(null)}>
          <div className="shortcut-list">
            {shortcutGroups.map(([key, action]) => (
              <div key={key}>
                <span>{action}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="dialog-note">
            Shortcuts are active while the editor is focused, outside text
            fields.
          </p>
          <p className="dialog-note">
            On touchscreens, use the playback and editing buttons. Drag the ruler
            or images to seek, drag a selected segment’s edges to trim, and use
            “Pan zoomed timeline” to move around when zoomed in. Time fields also
            accept seconds for precise edits without dragging.
          </p>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="Meet ClipIt." onClose={() => setModal(null)}>
          <div className="about-copy">
            <p>
              A browser-native take on the LosslessCut workflow. Open local
              media, mark the parts you want, and export without re-encoding.
            </p>
            <h3>Original quality, honest boundaries.</h3>
            <p>
              Lossless video cuts start at a nearby keyframe, so exported
              boundaries can differ from your marks. Container changes do not
              convert codecs. Your browser may not preview every format that the
              export engine can read.
            </p>
            <p>
              This edition supports files up to 512 MB. FFmpeg runs in a
              WebAssembly worker using browser memory. For very large files and
              frame-exact smart cuts, use desktop LosslessCut.
            </p>
            <h3>Built on open source.</h3>
            <p>
              Powered by{" "}
              <a
                href="https://github.com/ffmpegwasm/ffmpeg.wasm"
                target="_blank"
                rel="noreferrer"
              >
                ffmpeg.wasm
              </a>{" "}
              and{" "}
              <a href="https://ffmpeg.org" target="_blank" rel="noreferrer">
                FFmpeg
              </a>
              . Inspired by{" "}
              <a
                href="https://github.com/mifi/lossless-cut"
                target="_blank"
                rel="noreferrer"
              >
                LosslessCut
              </a>
              ; an independent project, not an official port. No uploads,
              accounts, or analytics.
            </p>
          </div>
        </Modal>
      )}
      {modal === "exports" && (
        <Modal title="Your cuts are ready." onClose={() => setModal(null)}>
          <p className="dialog-note">
            Original streams. Fresh containers. Download your exports below.
          </p>
          <div className="download-list">
            {outputs.map((o) => (
              <div className="download-item" key={o.url}>
                <a href={o.url} download={o.name}>
                  <span className="download-icon">
                    <FileVideo2 size={20} />
                  </span>
                  <span>
                    <strong>{o.name}</strong>
                    <small>{fileSize(o.size)}</small>
                  </span>
                  <Download size={18} />
                </a>
                {navigator.canShare?.({ files: [o.file] }) && (
                  <button className="button secondary" aria-label={`Share ${o.name}`} onClick={() => void shareOutput(o)}>
                    <Share2 size={18} /> Share / save
                  </button>
                )}
              </div>
            ))}
          </div>
          {shareError && <p className="field-error" role="alert">{shareError}</p>}
          <p className="dialog-note">
            Keyframe-aligned cuts may include a little extra footage. Downloads
            remain available until you open another file or close this tab.
          </p>
        </Modal>
      )}
    </div>
  );
}
