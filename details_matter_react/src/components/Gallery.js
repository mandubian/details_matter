import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { fetchCloudGallery, getWorkerUrl, setWorkerUrl } from '../services/cloudService';

const Gallery = ({
  localGallery,
  currentSession,
  isLoading,
  onNewThread,
  onOpenThread,
  onForkThread,
  onDeleteThread,
}) => {
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'cloud'
  const [browseMode, setBrowseMode] = useState('wall'); // 'wall' | 'tree'
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cloudThreads, setCloudThreads] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [workerUrlInput, setWorkerUrlInput] = useState(getWorkerUrl() || '');
  const [isConfiguring, setIsConfiguring] = useState(!getWorkerUrl());
  const [treePan, setTreePan] = useState({ x: 0, y: 0 });
  const [treeZoom, setTreeZoom] = useState(1);

  useEffect(() => {
    if (activeTab === 'cloud' && !isConfiguring && getWorkerUrl()) {
      loadCloudGallery();
    }
  }, [activeTab, isConfiguring]);

  const loadCloudGallery = async () => {
    setLoadingCloud(true);
    const threads = await fetchCloudGallery();
    setCloudThreads(threads);
    setLoadingCloud(false);
  };

  const handleSaveConfig = () => {
    setWorkerUrl(workerUrlInput);
    setIsConfiguring(false);
    if (activeTab === 'cloud') loadCloudGallery();
  };

  const getPreviewImages = (thread) => {
    // Local threads may have the compressed conversation stored; cloud threads typically have only thumbnail.
    if (thread?.conversation && Array.isArray(thread.conversation)) {
      const forkTurn = Number.isFinite(thread?.forkInfo?.parentTurn) ? thread.forkInfo.parentTurn : null;
      const images = thread.conversation
        .map((t, idx) => ({ idx, img: t?.image }))
        .filter(x => !!x.img);

      // If it's a fork, prefer images after the fork point so it doesn't look like a duplicate.
      if (forkTurn !== null) {
        const postFork = images.filter(x => x.idx > forkTurn).map(x => x.img);
        if (postFork.length > 0) return postFork.slice(0, 4);
      }

      return images.map(x => x.img).slice(0, 4);
    }
    return thread?.thumbnail ? [thread.thumbnail] : [];
  };

  // Full thread images for the preview overlay (so you can browse the evolution).
  // For forks, prefer browsing from the fork point forward.
  const getThreadImagesForPreview = (thread) => {
    if (thread?.conversation && Array.isArray(thread.conversation)) {
      const forkTurn = Number.isFinite(thread?.forkInfo?.parentTurn) ? thread.forkInfo.parentTurn : null;
      const all = thread.conversation
        .map((t, idx) => ({ idx, img: t?.image }))
        .filter(x => !!x.img);

      if (forkTurn !== null) {
        const postFork = all.filter(x => x.idx > forkTurn).map(x => x.img);
        if (postFork.length > 0) return postFork;
      }

      return all.map(x => x.img);
    }
    return thread?.thumbnail ? [thread.thumbnail] : [];
  };

  // Sample frames across the evolution so a tile gives a sense of progression
  const getEvolutionFrames = (thread, maxFrames = 5) => {
    if (!thread?.conversation || !Array.isArray(thread.conversation)) {
      return thread?.thumbnail ? [thread.thumbnail] : [];
    }

    const forkTurn = Number.isFinite(thread?.forkInfo?.parentTurn) ? thread.forkInfo.parentTurn : null;
    const all = thread.conversation
      .map((t, idx) => ({ idx, img: t?.image }))
      .filter(x => !!x.img);

    // For forks, prefer sampling from images after the fork point.
    let images = all.map(x => x.img);
    if (forkTurn !== null) {
      const postFork = all.filter(x => x.idx > forkTurn).map(x => x.img);
      if (postFork.length > 0) images = postFork;
    }

    if (images.length <= maxFrames) return images;

    const picks = new Set();
    const idx = (ratio) => Math.max(0, Math.min(images.length - 1, Math.round(ratio * (images.length - 1))));

    // first, 25%, 50%, 75%, last (unique indices)
    [0, 0.25, 0.5, 0.75, 1].forEach(r => picks.add(idx(r)));

    // If still not enough (e.g. very small), fill sequentially
    const pickedIdx = Array.from(picks).sort((a, b) => a - b).slice(0, maxFrames);
    return pickedIdx.map(i => images[i]);
  };

  const threads = activeTab === 'local' ? (localGallery || []) : (cloudThreads || []);

  const normalizedThreads = useMemo(() => {
    const out = (threads || []).map(t => ({
      ...t,
      id: t.id || t.threadId,
      forkInfo: t.forkInfo || t.forkFrom || null,
    })).filter(t => !!t.id);
    return out;
  }, [threads]);

  // Build a simple parent->children tree using forkInfo.parentId
  const tree = useMemo(() => {
    const byId = new Map();
    const children = new Map();
    const roots = [];

    for (const t of normalizedThreads) {
      byId.set(t.id, t);
      children.set(t.id, []);
    }

    for (const t of normalizedThreads) {
      const parentId = t?.forkInfo?.parentId;
      if (parentId && byId.has(parentId)) {
        children.get(parentId).push(t.id);
      } else {
        roots.push(t.id);
      }
    }

    // sort roots/children by timestamp desc when available
    const sortByTimeDesc = (aId, bId) => {
      const a = byId.get(aId);
      const b = byId.get(bId);
      const at = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bt - at;
    };

    roots.sort(sortByTimeDesc);
    for (const [k, arr] of children.entries()) {
      arr.sort(sortByTimeDesc);
      children.set(k, arr);
    }

    return { byId, children, roots };
  }, [normalizedThreads]);

  const openPreviewAt = (idx) => {
    const safe = Math.max(0, Math.min(idx, normalizedThreads.length - 1));
    setPreviewIndex(safe);
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

  const stepPreview = (delta) => {
    if (normalizedThreads.length === 0) return;
    const next = (previewIndex + delta + normalizedThreads.length) % normalizedThreads.length;
    setPreviewIndex(next);
  };

  /* === Fantasy RPG Components === */

  const RPGThreadCard = ({ thread, isCloud }) => {
    const images = getPreviewImages(thread);
    const title = thread.title || 'Untitled';
    const turnCount = thread.turnCount || (thread.conversation ? thread.conversation.length : '?');
    const parent = thread?.forkInfo?.parentId;

    return (
      <div className="rpg-card" onClick={() => onOpenThread(thread, isCloud)}>
        <div className="rpg-card__frame">
          <div className="rpg-card__imageContainer">
            {images[0] ? (
              <img src={images[0]} alt="preview" className="rpg-card__image" loading="lazy" />
            ) : (
              <div className="rpg-card__empty">No Preview</div>
            )}

            {/* Medallion / Jewel overlay */}
            <div className={`rpg-card__jewel ${images[0] ? 'has-image' : ''}`}></div>
          </div>

          <div className="rpg-card__content">
            <h3 className="rpg-card__title">{title}</h3>

            <div className="rpg-card__actions">
              <button
                className="rpg-btn-small"
                onClick={(e) => { e.stopPropagation(); openPreviewAt(normalizedThreads.indexOf(thread)); }}
              >
                🔍 Preview
              </button>
              <button
                className="rpg-btn-small"
                onClick={(e) => { e.stopPropagation(); onForkThread(thread, isCloud); }}
              >
                🌱 Fork
              </button>
            </div>
          </div>

          {/* Decorative Corner Elements (CSS handles these via pseudo-elements mostly, but adding hooks if needed) */}
        </div>
      </div>
    );
  };

  return (
    <div className="rpg-layout">
      {/* BACKGROUND DECORATIONS handled in CSS on body or layout */}

      {/* HEADER */}
      <header className="rpg-header">
        <h1 className="rpg-main-title">Thread Gallery</h1>

        <div className="rpg-header__controls">
          <div className="rpg-toggle-group">
            <button
              className={`rpg-jewel-btn red ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => setActiveTab('local')}
            >
              Local
            </button>
            <button
              className={`rpg-jewel-btn blue ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              Cloud
            </button>
          </div>

          <button className="rpg-scroll-btn" onClick={onNewThread} disabled={isLoading}>
            <span className="rpg-scroll-text">New Thread</span>
          </button>
        </div>
      </header>

      {/* MAIN LIST */}
      <main className="rpg-main">
        {activeTab === 'cloud' && (
          <div className="rpg-notice-panel">
            {isConfiguring ? (
              <div className="config-panel">
                <input
                  type="text"
                  placeholder="Worker URL..."
                  value={workerUrlInput}
                  onChange={(e) => setWorkerUrlInput(e.target.value)}
                  className="rpg-input"
                />
                <button className="rpg-btn-small" onClick={handleSaveConfig}>Save</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <button className="rpg-btn-text" onClick={() => setIsConfiguring(true)}>⚙️ Config</button>
                <button className="rpg-btn-text" onClick={loadCloudGallery}>🔄 Refresh</button>
              </div>
            )}
          </div>
        )}

        {browseMode === 'wall' && (
          <div className="rpg-grid">
            {normalizedThreads.map(t => (
              <RPGThreadCard key={t.id} thread={t} isCloud={activeTab === 'cloud'} />
            ))}
            {normalizedThreads.length === 0 && (
              <div className="rpg-empty">No scrolls found in the archives.</div>
            )}
          </div>
        )}

        {browseMode === 'tree' && (
          <div className="rpg-tree-container">
            {tree.roots.length === 0 ? <div className="rpg-empty">Empty Archive</div> :
              <TreeMap
                tree={tree}
                getPreviewImages={getPreviewImages}
                isCloud={activeTab === 'cloud'}
                isLoading={isLoading}
                onOpenThread={onOpenThread}
                onForkThread={onForkThread}
                pan={treePan}
                setPan={setTreePan}
                zoom={treeZoom}
                setZoom={setTreeZoom}
              />
            }
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="rpg-nav-bar">
        <button className="rpg-nav-item active">
          <span className="rpg-icon">🏠</span>
        </button>
        <button className="rpg-nav-item">
          <span className="rpg-icon">🔍</span>
        </button>
        {/* Toggle View Mode via Nav item */}
        <button
          className={`rpg-nav-center ${browseMode === 'tree' ? 'active' : ''}`}
          onClick={() => setBrowseMode(browseMode === 'wall' ? 'tree' : 'wall')}
        >
          <span className="rpg-icon-large">Wait</span> {/* Will execute logic, maybe icon is Y-shape */}
          <span className="rpg-icon-large">{browseMode === 'wall' ? '🌿' : '🖼️'}</span>
        </button>
        <button className="rpg-nav-item">
          <span className="rpg-icon">👤</span>
        </button>
      </nav>

      {/* Fullscreen preview (swipeable) */}
      {previewOpen && normalizedThreads[previewIndex] && (
        <PreviewOverlay
          thread={normalizedThreads[previewIndex]}
          isCloud={activeTab === 'cloud'}
          getPreviewImages={getPreviewImages}
          getThreadImages={getThreadImagesForPreview}
          onClose={closePreview}
          onPrev={() => stepPreview(-1)}
          onNext={() => stepPreview(1)}
          onOpen={() => onOpenThread(normalizedThreads[previewIndex], activeTab === 'cloud')}
          onFork={() => onForkThread(normalizedThreads[previewIndex], activeTab === 'cloud')}
        />
      )}
    </div>
  );
};

export default Gallery;

const PreviewOverlay = ({ thread, isCloud, getPreviewImages, getThreadImages, onClose, onPrev, onNext, onOpen, onFork }) => {
  const images = (getThreadImages ? getThreadImages(thread) : getPreviewImages(thread)) || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  // When switching threads, reset to first frame
  useEffect(() => {
    setActiveIdx(0);
  }, [thread?.id]);

  // Swipe logic: primarily navigates IMAGES within the thread.
  // If at the end/start, we could loop or stop. For now, let's stop to avoid accidental thread switching.
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    setTouchStart({ x: t.clientX, y: t.clientY });
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches?.[0];
    if (!t || !touchStart) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        // Swipe Right -> Prev Image
        if (activeIdx > 0) setActiveIdx(activeIdx - 1);
      } else {
        // Swipe Left -> Next Image
        if (activeIdx < images.length - 1) setActiveIdx(activeIdx + 1);
      }
    }
    setTouchStart(null);
  };

  return (
    <div className="dm-preview" onClick={onClose}>
      <div className="dm-preview__sheet" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="dm-preview__top">
          <div className="dm-preview__title">{thread.title || 'Untitled'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="secondary-button" onClick={onPrev} style={{ width: 'auto' }} title="Previous thread">‹</button>
            <button className="secondary-button" onClick={onNext} style={{ width: 'auto' }} title="Next thread">›</button>
            <button className="secondary-button" onClick={onClose} style={{ width: 'auto' }}>✕</button>
          </div>
        </div>
        <div className="dm-preview__image">
          {images?.[activeIdx] ? <img src={images[activeIdx]} alt="preview" /> : <div className="dm-preview__empty">No preview</div>}
        </div>

        {images?.length > 1 && (
          <div className="dm-preview__strip" aria-label="Preview frames">
            {images.map((src, idx) => (
              <button
                key={idx}
                type="button"
                className={`dm-preview__stripItem ${idx === activeIdx ? 'active' : ''}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={`Show frame ${idx + 1}`}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <div className="dm-preview__nav">
          <button
            className="secondary-button"
            onClick={() => { if (activeIdx > 0) setActiveIdx(activeIdx - 1); }}
            disabled={activeIdx === 0}
            title="Previous image"
          >
            ←
          </button>

          <div className="dm-preview__indicators" style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}></span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}></span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}></span>
          </div>

          <div className="dm-preview__hint">Swipe to browse story</div>
          <button
            className="secondary-button"
            onClick={() => { if (activeIdx < images.length - 1) setActiveIdx(activeIdx + 1); }}
            disabled={activeIdx === images.length - 1}
            title="Next image"
          >
            →
          </button>
        </div>
        <div className="dm-preview__actions">
          <button className="primary-button" onClick={onOpen}>Open</button>
          <button className="secondary-button" onClick={onFork}>Fork</button>
        </div>
      </div>

    </div>
  );
};

const TreeMap = ({ tree, getPreviewImages, isCloud, isLoading, onOpenThread, onForkThread, pan, setPan, zoom, setZoom }) => {
  const nodes = tree.roots;

  const containerRef = useRef(null);
  const autoFitDoneRef = useRef(false);
  const pointerStateRef = useRef({
    pointers: new Map(),
    drag: null,
    pinch: null,
  });

  // Layout: compact tidy-ish tree
  const layout = useMemo(() => {
    const positions = new Map();
    const edges = [];
    const isNarrow = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const NODE_W = isNarrow ? 200 : 240;
    const NODE_H = isNarrow ? 260 : 280; // Increased height to prevent vertical overlap
    const GAP_X = isNarrow ? 80 : 120;
    const GAP_Y = isNarrow ? 40 : 70;

    // First pass: compute leaf span per node
    const span = new Map();
    const calcSpan = (id) => {
      const kids = tree.children.get(id) || [];
      if (kids.length === 0) {
        span.set(id, 1);
        return 1;
      }
      let s = 0;
      for (const kid of kids) {
        edges.push([id, kid]);
        s += calcSpan(kid);
      }
      span.set(id, Math.max(1, s));
      return span.get(id);
    };
    for (const root of nodes) calcSpan(root);

    // Second pass: assign positions with parent centered above children
    let leafCursor = 0;
    const place = (id, depth) => {
      const kids = tree.children.get(id) || [];
      if (kids.length === 0) {
        const y = leafCursor;
        leafCursor += 1;
        positions.set(id, { x: depth, y });
        return y;
      }

      const childYs = [];
      for (const kid of kids) {
        childYs.push(place(kid, depth + 1));
      }
      const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
      positions.set(id, { x: depth, y });
      return y;
    };
    for (const root of nodes) place(root, 0);

    // Scale to pixels
    for (const [id, p] of positions.entries()) {
      positions.set(id, { x: p.x * (NODE_W + GAP_X), y: p.y * (NODE_H + GAP_Y) });
    }

    // compute bounds
    let maxX = 0;
    let maxY = 0;
    for (const [, p] of positions.entries()) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { positions, edges, NODE_W, NODE_H, width: maxX + NODE_W + 200, height: maxY + NODE_H + 200 };
  }, [tree, nodes]);

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pad = 24;
    const sx = (rect.width - pad * 2) / Math.max(1, layout.width);
    const sy = (rect.height - pad * 2) / Math.max(1, layout.height);
    const fit = Math.max(0.45, Math.min(1.2, Math.min(sx, sy)));
    setZoom(fit);

    // center content
    const cx = (rect.width - layout.width * fit) / 2;
    const cy = (rect.height - layout.height * fit) / 2;
    setPan({ x: cx, y: cy });
  }, [layout.width, layout.height, setPan, setZoom]);

  // Auto-fit once when tree changes (keeps mobile usable)
  useEffect(() => {
    if (autoFitDoneRef.current) return;
    fitToView();
    autoFitDoneRef.current = true;
  }, [fitToView]);

  const clampZoom = (z) => Math.max(0.35, Math.min(2.0, z));

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const st = pointerStateRef.current;
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (st.pointers.size === 1) {
      st.drag = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
      st.pinch = null;
    } else if (st.pointers.size === 2) {
      const pts = Array.from(st.pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      st.drag = null;
      st.pinch = { startDist: dist, startZoom: zoom, startPan: { ...pan }, mid };
    }
  };

  const onPointerMove = (e) => {
    const st = pointerStateRef.current;
    if (!st.pointers.has(e.pointerId)) return;
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (st.pinch && st.pointers.size >= 2) {
      const pts = Array.from(st.pointers.values()).slice(0, 2);
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

      const ratio = dist / Math.max(1, st.pinch.startDist);
      const nextZoom = clampZoom(st.pinch.startZoom * ratio);

      // Keep world point under midpoint stable
      const worldX = (mid.x - st.pinch.startPan.x) / st.pinch.startZoom;
      const worldY = (mid.y - st.pinch.startPan.y) / st.pinch.startZoom;
      const nextPan = { x: mid.x - worldX * nextZoom, y: mid.y - worldY * nextZoom };

      setZoom(nextZoom);
      setPan(nextPan);
      return;
    }

    if (st.drag && st.pointers.size === 1) {
      const dx = e.clientX - st.drag.x;
      const dy = e.clientY - st.drag.y;
      setPan({ x: st.drag.ox + dx, y: st.drag.oy + dy });
    }
  };

  const onPointerUp = (e) => {
    const st = pointerStateRef.current;
    st.pointers.delete(e.pointerId);
    if (st.pointers.size === 0) {
      st.drag = null;
      st.pinch = null;
    } else if (st.pointers.size === 1) {
      // transition back to drag
      const remaining = Array.from(st.pointers.values())[0];
      st.drag = { x: remaining.x, y: remaining.y, ox: pan.x, oy: pan.y };
      st.pinch = null;
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = -e.deltaY;
    const step = delta > 0 ? 0.08 : -0.08;
    const nextZoom = clampZoom(zoom + step);

    // Anchor zoom to cursor position
    const worldX = (mouse.x - pan.x) / zoom;
    const worldY = (mouse.y - pan.y) / zoom;
    const nextPan = { x: mouse.x - worldX * nextZoom, y: mouse.y - worldY * nextZoom };
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const onDoubleClick = () => {
    fitToView();
  };

  return (
    <div
      ref={containerRef}
      className="dm-treeMap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <div className="dm-treeMap__hint">Drag to pan · Wheel/pinch to zoom · Double-click to refit</div>
      <div
        className="dm-treeMap__surface"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, width: layout.width, height: layout.height }}
      >
        <svg className="dm-treeEdges" width={layout.width} height={layout.height}>
          {layout.edges.map(([from, to]) => {
            const a = layout.positions.get(from);
            const b = layout.positions.get(to);
            if (!a || !b) return null;
            const x1 = a.x + layout.NODE_W;
            const y1 = a.y + layout.NODE_H * 0.45;
            const x2 = b.x;
            const y2 = b.y + layout.NODE_H * 0.45;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="2"
                fill="none"
              />
            );
          })}
        </svg>

        {[...layout.positions.entries()].map(([id, pos]) => {
          const thread = tree.byId.get(id);
          if (!thread) return null;
          const preview = getPreviewImages(thread)[0];
          const forkTurn = Number.isFinite(thread?.forkInfo?.parentTurn) ? thread.forkInfo.parentTurn : null;
          const forkImg = thread?.forkInfo?.parentImage || null;
          return (
            <div
              className="dm-treeNode"
              key={id}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dm-treeNode__img">
                {preview ? <img src={preview} alt="preview" loading="lazy" /> : null}
                {forkImg ? (
                  <div className="dm-treeNode__forkThumb" title={forkTurn !== null ? `Forked @ turn ${forkTurn}` : 'Fork origin'}>
                    <img src={forkImg} alt="fork origin" loading="lazy" />
                  </div>
                ) : null}
              </div>
              <div className="dm-treeNode__body">
                <div className="dm-treeNode__title">{thread.title || 'Untitled'}</div>
                <div className="dm-treeNode__meta">
                  <span>{thread.turnCount || (thread.conversation ? thread.conversation.length : '?')} turns</span>
                  <span>{forkTurn !== null ? `fork@${forkTurn}` : (thread.model || '')}</span>
                </div>
                <div className="dm-treeNode__actions">
                  <button
                    className="dm-treeNode__action"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onOpenThread(thread, isCloud); }}
                    disabled={isLoading}
                  >
                    Open
                  </button>
                  <button
                    className="dm-treeNode__action"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onForkThread(thread, isCloud); }}
                    disabled={isLoading}
                  >
                    Fork
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

