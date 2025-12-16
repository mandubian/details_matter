import React, { useRef, useCallback, useEffect } from 'react';

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
    const children = (childrenMap.get(threadId) || [])
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

    // Drag-to-scroll for siblings row (desktop support)
    const siblingsRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current || !siblingsRef.current) return;
        e.preventDefault();
        const dx = e.clientX - startX.current;
        siblingsRef.current.scrollLeft = scrollLeft.current - dx;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        if (siblingsRef.current) {
            siblingsRef.current.style.cursor = 'grab';
            siblingsRef.current.style.userSelect = '';
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((e) => {
        if (!siblingsRef.current) return;
        isDragging.current = true;
        startX.current = e.clientX;
        scrollLeft.current = siblingsRef.current.scrollLeft;
        siblingsRef.current.style.cursor = 'grabbing';
        siblingsRef.current.style.userSelect = 'none';
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

    // Render a single node card
    const renderNode = (thread, variant = 'default') => {
        const images = getPreviewImages(thread);
        const isSelected = thread.id === selectedThreadId;
        const title = thread.title || 'Untitled';
        const turnCount = thread.turnCount || (thread.conversation?.length || '?');

        const handleClick = () => {
            if (!isSelected) {
                onOpenThread(thread);
            }
        };

        return (
            <div
                key={thread.id}
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

            {/* Main Family Layout: Parent -> Siblings Row -> Children */}
            <div className="genealogy-main">
                {/* Parent above */}
                {directParent && (
                    <div className="genealogy-parent-section">
                        {renderNode(directParent, 'parent')}
                        <div className="genealogy-connector-v"></div>
                    </div>
                )}

                {/* Horizontal connector bar for siblings */}
                {(directParent || siblings.length > 0) && (
                    <div className="genealogy-h-bar"></div>
                )}

                {/* Siblings Row (including selected) */}
                <div
                    className="genealogy-siblings-row"
                    ref={siblingsRef}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: siblings.length > 0 ? 'grab' : 'default' }}
                >
                    {/* Selected thread first */}
                    <div className="genealogy-sibling-item genealogy-sibling-item--selected">
                        <div className="genealogy-connector-v"></div>
                        {renderNode(selectedThread, 'selected')}
                    </div>

                    {/* Other siblings */}
                    {siblings.map(sib => (
                        <div key={sib.id} className="genealogy-sibling-item">
                            <div className="genealogy-connector-v"></div>
                            {renderNode(sib, 'sibling')}
                        </div>
                    ))}
                </div>

                {/* Vertical connector from selected to children */}
                <div className="genealogy-connector-v"></div>

                {/* Children Section */}
                {children.length > 0 ? (
                    <div className="genealogy-children-section">
                        <div className="genealogy-section__label">Forks from this thread</div>
                        {children.length > 1 && <div className="genealogy-h-bar"></div>}
                        <div className="genealogy-children-row">
                            {children.map(child => (
                                <div key={child.id} className="genealogy-child-item">
                                    <div className="genealogy-connector-v"></div>
                                    {renderNode(child, 'child')}
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

