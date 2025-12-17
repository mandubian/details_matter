import React, { useRef, useCallback, useEffect, useState, useLayoutEffect } from 'react';

/**
 * Compute the lineage for a given thread:
 * - ancestors: chain from root down to parent
 * - siblings: other forks from the same parent
 * - children: direct forks from this thread
 * - contentOrigin: the true origin of this thread's starting content
 */
function computeLineage(threadId, byId, childrenMap) {
    const thread = byId.get(threadId);
    if (!thread) return { ancestors: [], siblings: [], children: [], contentOrigin: null };

    // Walk up to find ancestors (using parent chain)
    const ancestors = [];
    let current = thread;
    const visited = new Set();
    visited.add(threadId);
    let guard = 0;
    while (current?.forkInfo?.parentId && guard < 200) {
        guard += 1;
        const parentId = current.forkInfo.parentId;
        if (!parentId || visited.has(parentId) || parentId === current.id) break;
        visited.add(parentId);

        const parent = byId.get(parentId);
        if (parent) {
            ancestors.unshift(parent);
            current = parent;
        } else {
            break;
        }
    }

    const MAX_SIDE_NODES = 50;

    // Siblings: other children of our parent
    const parentId = thread?.forkInfo?.parentId;
    const siblings = parentId && byId.has(parentId)
        ? (childrenMap.get(parentId) || [])
            .filter(id => id !== threadId)
            .map(id => byId.get(id))
            .filter(Boolean)
            .slice(0, MAX_SIDE_NODES)
        : [];

    // Children: forks from this thread
    // Filter out any that are ancestors (to handle potential data cycles)
    const ancestorIds = new Set(ancestors.map(a => a.id));
    ancestorIds.add(threadId); // Also exclude self
    const children = (childrenMap.get(threadId) || [])
        .filter(id => !ancestorIds.has(id)) // Exclude ancestors to prevent cycle display
        .map(id => byId.get(id))
        .filter(Boolean)
        .slice(0, MAX_SIDE_NODES);

    // Content origin: trace back using originThreadId if different from parentId
    let contentOrigin = null;
    if (thread.forkInfo?.originThreadId &&
        thread.forkInfo.originThreadId !== thread.forkInfo.parentId) {
        const originThread = byId.get(thread.forkInfo.originThreadId);
        if (originThread) {
            contentOrigin = {
                thread: originThread,
                turnIndex: thread.forkInfo.originTurnIndex || 0
            };
        }
    }

    return { ancestors, siblings, children, contentOrigin };
}

/**
 * SVG Connector component that draws lines between tree nodes
 */
const TreeConnectors = ({ containerRef, parentRef, siblingRefs, childRefs, hasParent, hasSiblings, hasChildren }) => {
    const [lines, setLines] = useState([]);

    const calculateLines = useCallback(() => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const toLocal = (rect) => ({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        });

        const newLines = [];
        const lineColor = '#8a7a5a'; // gold-dark
        const strokeWidth = 2;

        // Get sibling positions (including selected)
        const siblingPositions = [];
        siblingRefs.forEach((ref, idx) => {
            if (ref.current) {
                const pos = toLocal(ref.current.getBoundingClientRect());
                siblingPositions.push({ ...pos, idx });
            }
        });

        if (siblingPositions.length > 0) {
            // Sort by x position
            siblingPositions.sort((a, b) => a.x - b.x);

            // Horizontal bar Y position (top of siblings)
            const barY = siblingPositions[0].y - 12; // 12px gap above nodes

            // Draw vertical line from parent down to bar
            if (hasParent && parentRef.current) {
                const parentPos = toLocal(parentRef.current.getBoundingClientRect());
                newLines.push({
                    key: 'parent-to-bar',
                    x1: parentPos.x,
                    y1: parentPos.y + parentPos.height,
                    x2: parentPos.x,
                    y2: barY,
                    stroke: lineColor,
                    strokeWidth
                });
            }

            // Draw horizontal bar spanning all siblings
            if (siblingPositions.length > 1 || hasParent) {
                const leftX = siblingPositions[0].x;
                const rightX = siblingPositions[siblingPositions.length - 1].x;
                newLines.push({
                    key: 'h-bar',
                    x1: leftX,
                    y1: barY,
                    x2: rightX,
                    y2: barY,
                    stroke: lineColor,
                    strokeWidth
                });
            }

            // Draw drop lines to each sibling
            siblingPositions.forEach((pos, i) => {
                newLines.push({
                    key: `drop-${i}`,
                    x1: pos.x,
                    y1: barY,
                    x2: pos.x,
                    y2: pos.y,
                    stroke: lineColor,
                    strokeWidth
                });
            });
        }

        // Draw lines to children
        if (hasChildren && childRefs.length > 0) {
            const childPositions = [];
            childRefs.forEach((ref, idx) => {
                if (ref.current) {
                    const pos = toLocal(ref.current.getBoundingClientRect());
                    childPositions.push({ ...pos, idx });
                }
            });

            if (childPositions.length > 0) {
                childPositions.sort((a, b) => a.x - b.x);

                // Find selected node (first sibling ref is selected)
                const selectedRef = siblingRefs[0];
                if (selectedRef?.current) {
                    const selectedPos = toLocal(selectedRef.current.getBoundingClientRect());
                    const childBarY = selectedPos.y + selectedPos.height + 24; // Below selected

                    // Vertical from selected to child bar
                    newLines.push({
                        key: 'selected-to-child-bar',
                        x1: selectedPos.x,
                        y1: selectedPos.y + selectedPos.height,
                        x2: selectedPos.x,
                        y2: childBarY,
                        stroke: lineColor,
                        strokeWidth
                    });

                    // Horizontal bar for children
                    if (childPositions.length > 1) {
                        const leftX = childPositions[0].x;
                        const rightX = childPositions[childPositions.length - 1].x;
                        newLines.push({
                            key: 'child-h-bar',
                            x1: leftX,
                            y1: childBarY,
                            x2: rightX,
                            y2: childBarY,
                            stroke: lineColor,
                            strokeWidth
                        });
                    }

                    // Drop lines to children
                    childPositions.forEach((pos, i) => {
                        newLines.push({
                            key: `child-drop-${i}`,
                            x1: pos.x,
                            y1: childBarY,
                            x2: pos.x,
                            y2: pos.y,
                            stroke: lineColor,
                            strokeWidth
                        });
                    });
                }
            }
        }

        setLines(newLines);
    }, [containerRef, parentRef, siblingRefs, childRefs, hasParent, hasSiblings, hasChildren]);

    useLayoutEffect(() => {
        calculateLines();
    }, [calculateLines]);

    useEffect(() => {
        const handleResize = () => calculateLines();
        window.addEventListener('resize', handleResize);

        // Also recalculate after a short delay (for layout settling)
        const timer = setTimeout(calculateLines, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timer);
        };
    }, [calculateLines]);

    if (lines.length === 0) return null;

    return (
        <svg className="genealogy-svg-connectors">
            {lines.map(line => (
                <line
                    key={line.key}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={line.stroke}
                    strokeWidth={line.strokeWidth}
                    strokeLinecap="round"
                />
            ))}
        </svg>
    );
};

/**
 * GenealogyTree: A vertical family-tree view centered on a single thread.
 * Shows siblings as branches from the same parent level.
 */
const GenealogyTree = ({
    selectedThreadId,
    tree,
    getPreviewImages,
    onSelectThread,
    onOpenThread,
    onBack
}) => {
    const { byId, children: childrenMap } = tree;
    const selectedThread = byId.get(selectedThreadId);

    // Refs for SVG connector calculations
    const mainRef = useRef(null); // ref for .genealogy-main where SVG is positioned
    const parentRef = useRef(null);
    const siblingRefsRef = useRef([]);
    const childRefsRef = useRef([]);

    // Drag-to-scroll for siblings row
    const siblingsRowRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const hasDragged = useRef(false);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current || !siblingsRowRef.current) return;
        e.preventDefault();
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 5) {
            hasDragged.current = true;
        }
        siblingsRowRef.current.scrollLeft = scrollLeft.current - dx;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        if (siblingsRowRef.current) {
            siblingsRowRef.current.style.cursor = 'grab';
            siblingsRowRef.current.style.userSelect = '';
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Reset hasDragged after a tick to prevent click
        setTimeout(() => {
            hasDragged.current = false;
        }, 0);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((e) => {
        if (!siblingsRowRef.current) return;
        isDragging.current = true;
        hasDragged.current = false;
        startX.current = e.clientX;
        scrollLeft.current = siblingsRowRef.current.scrollLeft;
        siblingsRowRef.current.style.cursor = 'grabbing';
        siblingsRowRef.current.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, handleMouseUp]);

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    if (!selectedThread) {
        return (
            <div className="genealogy-tree genealogy-tree--empty">
                <button className="genealogy-back-btn" onClick={onBack}>
                    ← Back to Gallery
                </button>
                <p>Thread not found.</p>
            </div>
        );
    }

    const { ancestors, siblings, children, contentOrigin } = computeLineage(selectedThreadId, byId, childrenMap);
    const directParent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;

    // Build refs arrays for siblings and children
    const allSiblings = [selectedThread, ...siblings];
    siblingRefsRef.current = allSiblings.map((_, i) => siblingRefsRef.current[i] || React.createRef());
    childRefsRef.current = children.map((_, i) => childRefsRef.current[i] || React.createRef());

    // Render a single node card
    const renderNode = (thread, variant = 'default', ref = null) => {
        const images = getPreviewImages(thread);
        const isSelected = thread.id === selectedThreadId;
        const title = thread.title || 'Untitled';
        const turnCount = thread.turnCount || (thread.conversation?.length || '?');

        const handleClick = (e) => {
            // Prevent click if we just dragged
            if (hasDragged.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (!isSelected) {
                // Re-center the lineage view on this thread (don't open it)
                onSelectThread(thread.id);
            }
        };

        return (
            <div
                key={thread.id}
                ref={ref}
                className={`genealogy-node genealogy-node--${variant} ${isSelected ? 'genealogy-node--selected' : ''}`}
                onClick={handleClick}
            >
                <div className="genealogy-node__image">
                    {images[0] ? (
                        <img src={images[0]} alt={title} />
                    ) : (
                        <div className="genealogy-node__placeholder">🖼️</div>
                    )}
                </div>
                <div className="genealogy-node__info">
                    <div className="genealogy-node__title">{title}</div>
                    <div className="genealogy-node__meta">{turnCount} turns</div>
                </div>
                {isSelected && (
                    <button
                        className="genealogy-node__open-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenThread(thread);
                        }}
                    >
                        Open
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="genealogy-tree">

            {/* Header */}
            <div className="genealogy-header">
                <button className="genealogy-back-btn" onClick={onBack}>
                    ← Back to Gallery
                </button>
                <h2 className="genealogy-title">
                    🌳 Lineage of "{selectedThread.title || 'Untitled'}"
                </h2>
            </div>

            {/* Content Origin Indicator */}
            {contentOrigin && (
                <div className="genealogy-origin-badge">
                    <span className="genealogy-origin-badge__icon">🧬</span>
                    <span className="genealogy-origin-badge__text">
                        Content originated from <strong>{contentOrigin.thread.title || 'Untitled'}</strong> (turn {contentOrigin.turnIndex})
                    </span>
                    <button
                        className="genealogy-origin-badge__link"
                        onClick={() => onSelectThread(contentOrigin.thread.id)}
                    >
                        View Origin
                    </button>
                </div>
            )}

            {/* Ancestors Section (except immediate parent) */}
            {ancestors.length > 1 && (
                <div className="genealogy-section genealogy-section--ancestors">
                    <div className="genealogy-section__label">Earlier Ancestors</div>
                    <div className="genealogy-chain">
                        {ancestors.slice(0, -1).map((ancestor) => (
                            <React.Fragment key={ancestor.id}>
                                {renderNode(ancestor, 'ancestor')}
                                <div className="genealogy-connector-v"></div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Family Layout - key forces remount for animation on selection change */}
            <div className="genealogy-main" ref={mainRef} key={selectedThreadId}>
                {/* SVG Connectors Layer - inside genealogy-main for correct positioning */}
                <TreeConnectors
                    containerRef={mainRef}
                    parentRef={parentRef}
                    siblingRefs={siblingRefsRef.current}
                    childRefs={childRefsRef.current}
                    hasParent={!!directParent}
                    hasSiblings={siblings.length > 0}
                    hasChildren={children.length > 0}
                />

                {/* Parent above */}
                {directParent && (
                    <div className="genealogy-parent-section">
                        {renderNode(directParent, 'parent', parentRef)}
                    </div>
                )}

                {/* Spacer for SVG lines */}
                <div className="genealogy-connector-spacer"></div>

                {/* Siblings Row (including selected) */}
                <div
                    className="genealogy-siblings-row"
                    ref={siblingsRowRef}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: siblings.length > 0 ? 'grab' : 'default' }}
                >
                    {allSiblings.map((sib, idx) => (
                        <div key={sib.id} className={`genealogy-sibling-item ${sib.id === selectedThreadId ? 'genealogy-sibling-item--selected' : ''}`}>
                            {renderNode(sib, sib.id === selectedThreadId ? 'selected' : 'sibling', siblingRefsRef.current[idx])}
                        </div>
                    ))}
                </div>

                {/* Spacer for SVG lines to children */}
                <div className="genealogy-connector-spacer"></div>

                {/* Children Section */}
                {children.length > 0 ? (
                    <div className="genealogy-children-section">
                        <div className="genealogy-section__label">Forks from this thread</div>
                        <div className="genealogy-children-row">
                            {children.map((child, idx) => (
                                <div key={child.id} className="genealogy-child-item">
                                    {renderNode(child, 'child', childRefsRef.current[idx])}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="genealogy-empty-label">No forks yet</div>
                )}
            </div>
        </div>
    );
};

export default GenealogyTree;
