import { app } from "/scripts/app.js";

console.log("[Trix Bypasser] Loading pixel-perfect premium minimalist UI v12 (Nodes 2.0 compatible)...");

// =========================================================
// 1. STYLE INJECTION
// =========================================================
const TRIX_CSS = `
.trix-picker-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(10,10,12,0.75); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    backdrop-filter: blur(4px);
}
.trix-picker-modal {
    background: #18181c; border: 1px solid #2e2e38; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    width: 480px; max-height: 75vh; display: flex; flex-direction: column;
    border-radius: 8px; overflow: hidden;
}
.trix-picker-header {
    padding: 14px 16px; border-bottom: 1px solid #282830; background: #1b1b22;
    display: flex; flex-direction: column; gap: 10px;
}
.trix-picker-title {
    color: #e2e2e9; font-size: 13px; font-weight: 600; text-align: center;
    margin: 0; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.8;
}
.trix-picker-manual-container {
    display: flex; flex-direction: column; gap: 4px;
}
.trix-picker-manual-label {
    color: #777; font-size: 10px; font-weight: 600; text-transform: uppercase;
}
.trix-picker-manual-row {
    display: flex; gap: 6px; align-items: center; width: 100%;
}
.trix-picker-manual-input {
    flex: 1; min-width: 0; background: #101014; border: 1px solid #282832; color: #e2e2e9;
    padding: 6px 10px; border-radius: 4px; font-size: 12px; outline: none;
    box-sizing: border-box; transition: border-color 0.2s, background-color 0.2s;
    font-family: monospace;
}
.trix-picker-manual-input:focus {
    border-color: #387aff; background: #0c0c0f;
}
.trix-picker-search {
    width: 100%; background: #101014; border: 1px solid #282832; color: #e2e2e9;
    padding: 6px 10px; border-radius: 4px; font-size: 12px; outline: none;
    box-sizing: border-box; transition: border-color 0.2s, background-color 0.2s;
}
.trix-picker-search:focus {
    border-color: #387aff; background: #0c0c0f;
}
.trix-picker-list {
    flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;
    background: #141418;
}
.trix-group-header {
    padding: 8px 12px; background: #1d1d24; border: 1px solid #2c2c36;
    color: #a0a0b0; font-weight: 600; font-size: 12px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    border-radius: 6px; margin-bottom: 4px; user-select: none;
    transition: background 0.15s, color 0.15s;
}
.trix-group-header:hover {
    background: #25252e; color: #e2e2e9;
}
.trix-group-header .arrow {
    font-size: 10px; color: #666; transition: transform 0.2s;
}
.trix-group-header.active .arrow {
    transform: rotate(90deg); color: #387aff;
}
.trix-group-content {
    display: none; padding: 4px 0 8px 0;
}
.trix-group-content.open {
    display: block;
}
.trix-picker-item {
    padding: 6px 12px; border-radius: 4px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 2px; transition: background 0.15s, border-color 0.15s;
    border: 1px solid transparent;
}
.trix-picker-item:hover {
    background: #1b1b22;
}
.trix-picker-item.selected {
    background: #1c2536; border-color: #273b54;
}
.trix-item-title {
    color: #d1d1db; font-size: 12px; font-weight: 500;
    display: flex; align-items: center;
}
.trix-item-indicator {
    display: inline-block; width: 6px; height: 6px;
    background-color: #387aff; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
}
.trix-item-meta {
    font-size: 10px; color: #626270; font-family: monospace;
}
.trix-picker-footer {
    padding: 10px 16px; border-top: 1px solid #282830; background: #1b1b22;
    display: flex; justify-content: flex-end; gap: 6px;
}
.trix-btn {
    padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;
    cursor: pointer; outline: none; border: none; transition: background 0.15s;
}
.trix-btn-primary {
    background: #387aff; color: #fff;
}
.trix-btn-primary:hover {
    background: #5c93ff;
}
.trix-btn-secondary {
    background: #25252e; color: #a0a0b0;
}
.trix-btn-secondary:hover {
    background: #2d2d38; color: #ccc;
}
.trix-picker-list::-webkit-scrollbar {
    width: 4px;
}
.trix-picker-list::-webkit-scrollbar-track {
    background: transparent;
}
.trix-picker-list::-webkit-scrollbar-thumb {
    background: #282830; border-radius: 2px;
}
.trix-picker-warning {
    background: rgba(220, 76, 76, 0.08);
    border: 1px solid rgba(220, 76, 76, 0.18);
    padding: 10px 12px;
    margin: 10px 10px 0 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
}
.trix-picker-warning-text {
    color: #ff6b6b;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
}
.trix-picker-warning-actions {
    display: flex;
    gap: 8px;
}
.trix-btn-warning-action {
    padding: 5px 10px;
    font-size: 10px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
    outline: none;
}
.trix-btn-clear-missing {
    background: rgba(220, 76, 76, 0.15);
    color: #ff8888;
}
.trix-btn-clear-missing:hover {
    background: rgba(220, 76, 76, 0.28);
    color: #ffaaaa;
}
.trix-btn-smart-search {
    background: #387aff;
    color: #fff;
}
.trix-btn-smart-search:hover {
    background: #5c93ff;
}
`;

const styleEl = document.createElement("style");
styleEl.innerHTML = TRIX_CSS;
document.head.appendChild(styleEl);

// =========================================================
// 2. WORKSPACE NODE UTILITIES
// =========================================================
function _trixGetInnerGraph(n) {
    if (!n) return null;
    return n.getInnerGraph ? n.getInnerGraph() : (n.innerGraph || n.subgraph || null);
}

function findNodeById(id) {
    id = String(id).trim();
    if (!id) return null;

    if (id.includes(":")) {
        const parts = id.split(":");
        let currentGraph = app.graph;
        let node = null;
        for (const pid of parts) {
            if (!currentGraph) return null;
            node = currentGraph.getNodeById ? currentGraph.getNodeById(parseInt(pid)) : null;
            if (!node) {
                const nodes = currentGraph._nodes || currentGraph.nodes || [];
                node = nodes.find(n => n.id == pid);
            }
            if (!node) return null;
            currentGraph = _trixGetInnerGraph(node);
        }
        return node;
    } else {
        const numericId = parseInt(id);
        if (!isNaN(numericId)) {
            if (app.graph && app.graph.getNodeById) {
                const n = app.graph.getNodeById(numericId);
                if (n) return n;
            }
        }
        return findNodeRecursively(app.graph, id);
    }
}

function _trixJumpToNodes(idsString, e) {
    if (!idsString || !idsString.trim()) return;
    const ids = idsString.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    // 1. Get all nodes with their paths (Root, Root > Node, etc.)
    const allEntries = _trixFindAllNodesRecursively(app.graph);
    
    // 2. Search for target node information
    const targetEntries = [];
    ids.forEach(id => {
        // Search by key (hierarchical ID) or normal ID
        const entry = allEntries.find(ent => ent.key === id || ent.id === id);
        if (entry) targetEntries.push(entry);
    });

    if (targetEntries.length === 0) return;

    // 3. Group by location (path / graph)
    const groups = {};
    targetEntries.forEach(ent => {
        if (!groups[ent.path]) groups[ent.path] = [];
        groups[ent.path].push(ent);
    });

    const paths = Object.keys(groups);

    // Internal function to perform the jump to a specific graph
    const performJump = (path) => {
        const ents = groups[path];
        const firstNodeId = ents[0].key || ents[0].id;
        const targetNode = findNodeById(firstNodeId);
        if (!targetNode) return;
        
        const targetGraph = targetNode.graph || targetNode._graph;
        if (!targetGraph) return;

        const canvas = app.canvas;

        // --- GRAPH SWITCHING ---
        if (canvas.graph !== targetGraph) {
            if (targetGraph === app.graph) {
                // Return to the main Root canvas
                if (canvas.closeSubgraph) {
                    while (canvas.graph !== app.graph && canvas.graph._subgraph_node) {
                        canvas.closeSubgraph();
                    }
                }
                canvas.setGraph(app.graph);
            } else {
                // Dive into the subgraph
                if (canvas.openSubgraph) {
                    canvas.openSubgraph(targetGraph);
                } else {
                    canvas.setGraph(targetGraph);
                }
            }
        }

        // --- BOUNDING BOX CALCULATION AND ZOOM IN NEW GRAPH ---
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let validNodes = 0;

        const nodesList = targetGraph._nodes || targetGraph.nodes || [];

        ents.forEach(ent => {
            const n = targetGraph.getNodeById ? targetGraph.getNodeById(ent.id) : nodesList.find(x => String(x.id) === String(ent.id));
            if (n && n.pos) {
                validNodes++;
                minX = Math.min(minX, n.pos[0]);
                minY = Math.min(minY, n.pos[1]);
                maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 100));
                maxY = Math.max(maxY, n.pos[1] + (n.size ? n.size[1] : 100));
            }
        });

        if (validNodes === 0) return;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const bboxWidth = maxX - minX;
        const bboxHeight = maxY - minY;

        if (validNodes === 1 || (bboxWidth < 200 && bboxHeight < 200)) {
            canvas.ds.scale = 1.0;
        } else {
            const padding = 150;
            const viewW = canvas.canvas.width - padding;
            const viewH = canvas.canvas.height - padding;
            let targetScale = Math.min(viewW / (bboxWidth || 1), viewH / (bboxHeight || 1));
            targetScale = Math.max(0.2, Math.min(targetScale, 1.0));
            canvas.ds.scale = targetScale;
        }

        canvas.ds.offset[0] = (canvas.canvas.width / 2) / canvas.ds.scale - centerX;
        canvas.ds.offset[1] = (canvas.canvas.height / 2) / canvas.ds.scale - centerY;
        canvas.setDirty(true, true);
    };

    // 4. Navigation logic
    if (paths.length === 1) {
        // All nodes are in one location - jump immediately
        performJump(paths[0]);
    } else {
        // Nodes are scattered across different graphs - show menu
        const menuOptions = paths.map(path => {
            return {
                content: `📍 Location: ${path} (${groups[path].length} nodes)`,
                callback: () => performJump(path)
            };
        });
        
        new LiteGraph.ContextMenu(menuOptions, {
            event: e || app.canvas.graph_mouse,
            title: "Select graph to jump",
        });
    }
}

function findNodeRecursively(graph, id) {
    if (!graph) return null;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            const found = findNodeRecursively(inner, id);
            if (found) return found;
        }
    }
    return null;
}

function _trixFindAllNodesRecursively(graph, currentPath = "Root", chain = []) {
    let list = [];
    if (!graph) return list;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (!n.id) continue;
        const comfyClass = n.comfyClass || n.type || "";
        const lowerClass = comfyClass.toLowerCase();
        
        if (lowerClass === "trixbypasser" || lowerClass === "primitive" || lowerClass === "reroute" || lowerClass.includes("note") || lowerClass.includes("remotecontrol") || lowerClass.includes("remotestate") || lowerClass.includes("mutebypass")) {
            continue;
        }
        
        const title = n.title || n.type || `Node ${n.id}`;
        const myChain = [...chain, n.id];
        const key = myChain.join(":");
        
        list.push({
            id: String(n.id),
            key: key,
            title: title,
            type: comfyClass,
            path: currentPath
        });
        
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            const nextPath = currentPath === "Root" ? title : `${currentPath} > ${title}`;
            list = list.concat(_trixFindAllNodesRecursively(inner, nextPath, myChain));
        }
    }
    return list;
}

function _trixGetAllGraphNodes(graph) {
    let list = [];
    if (!graph) return list;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (!n.id) continue;
        list.push(n);
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            list = list.concat(_trixGetAllGraphNodes(inner));
        }
    }
    return list;
}

function _trixResolveNodeTitles(val, node) {
    if (!val || !val.trim()) return "";
    const ids = val.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return "";
    
    if (node && node.properties) {
        if (!node.properties.trixNodeCache) {
            node.properties.trixNodeCache = {};
        }
    }
    
    const activeTitles = [];
    const activeIds = [];
    
    ids.forEach((id) => {
        const targetNode = findNodeById(id);
        if (targetNode) {
            const title = targetNode.title || targetNode.type || `Node ${id}`;
            if (node && node.properties && node.properties.trixNodeCache) {
                const upstream = [];
                if (targetNode.inputs) {
                    targetNode.inputs.forEach((slot, slotIdx) => {
                        if (slot.link !== undefined && slot.link !== null) {
                            const link = app.graph.links ? app.graph.links[slot.link] : null;
                            if (link) {
                                upstream.push({
                                    nodeId: String(link.origin_id),
                                    slot: slotIdx,
                                    type: slot.type
                                });
                            }
                        }
                    });
                }
                
                const downstream = [];
                if (targetNode.outputs) {
                    targetNode.outputs.forEach((slot, slotIdx) => {
                        if (slot.links && slot.links.length > 0) {
                            slot.links.forEach(linkId => {
                                const link = app.graph.links ? app.graph.links[linkId] : null;
                                if (link) {
                                    downstream.push({
                                        nodeId: String(link.target_id),
                                        slot: slotIdx,
                                        type: slot.type
                                    });
                                }
                            });
                        }
                    });
                }

                node.properties.trixNodeCache[id] = {
                    type: targetNode.type || targetNode.comfyClass || "",
                    title: title,
                    inputs: targetNode.inputs?.map(i => i.type) || [],
                    outputs: targetNode.outputs?.map(o => o.type) || [],
                    pos: targetNode.pos ? [targetNode.pos[0], targetNode.pos[1]] : [0, 0],
                    upstream: upstream,
                    downstream: downstream
                };
            }
            activeIds.push(id);
            activeTitles.push(title);
        }
    });
    
    if (activeIds.length === 0) {
        return "";
    }
    
    return `${activeIds.join(", ")} | ${activeTitles.join(", ")}`;
}

function _trixGetScreenPos(canvasX, canvasY) {
    const rect = app.canvas.canvas.getBoundingClientRect();
    const clientPos = app.canvas.convertCanvasToClient([canvasX, canvasY]);
    return {
        x: rect.left + clientPos[0],
        y: rect.top + clientPos[1]
    };
}

// =========================================================
// 3. TARGET PICKER MODAL UI (WITH Blue Dot Indicators)
// =========================================================
// 3. TARGET PICKER MODAL UI (WITH Blue Dot Indicators)
// =========================================================
function _trixGetGlobalUsedNodeIds() {
    const usedNodeIds = new Set();
    const allNodes = _trixGetAllGraphNodes(app.graph);
    allNodes.forEach((n) => {
        if (n.type === "TrixBypasser" && n.properties && n.properties.trixBypasserState) {
            n.properties.trixBypasserState.groups.forEach((g) => {
                g.targets.forEach((t) => {
                    if (t.value) {
                        t.value.split(",").map(s => s.trim()).filter(Boolean).forEach(id => usedNodeIds.add(id));
                    }
                });
            });
        } else if (n.type === "TrixBypasserSimple" && n.properties && n.properties.trixBypasserState) {
            n.properties.trixBypasserState.targets.forEach((t) => {
                if (t.value) {
                    t.value.split(",").map(s => s.trim()).filter(Boolean).forEach(id => usedNodeIds.add(id));
                }
            });
        }
    });
    return usedNodeIds;
}

function _trixScoreCandidate(cachedInfo, candidate, missingId) {
    let score = 0;
    
    // 1. Type Similarity (Exact or Substring / Category)
    const candType = (candidate.type || candidate.comfyClass || "").toLowerCase();
    const cachedType = (cachedInfo.type || "").toLowerCase();
    if (candType && cachedType) {
        if (candType === cachedType) {
            score += 30;
        } else {
            const cleanCand = candType.replace(/[^a-z0-9]/g, "");
            const cleanCached = cachedType.replace(/[^a-z0-9]/g, "");
            if (cleanCand.includes(cleanCached) || cleanCached.includes(cleanCand)) {
                score += 15;
            } else {
                const keywords = ["cfg", "sampler", "vae", "loader", "model", "latent", "image", "upscale", "noise"];
                for (const kw of keywords) {
                    if (candType.includes(kw) && cachedType.includes(kw)) {
                        score += 15;
                        break;
                    }
                }
            }
        }
    }
    
    // 2. Title Match
    const candTitle = (candidate.title || candType).toLowerCase();
    const cachedTitle = (cachedInfo.title || "").toLowerCase();
    if (candTitle && cachedTitle) {
        if (candTitle === cachedTitle) {
            score += 15;
        } else if (candTitle.includes(cachedTitle) || cachedTitle.includes(candTitle)) {
            score += 8;
        }
    }
    
    // 3. Inputs / Outputs signature compatibility
    const candInputs = candidate.inputs?.map(i => i.type) || [];
    const candOutputs = candidate.outputs?.map(o => o.type) || [];
    
    let inputMatches = 0;
    if (cachedInfo.inputs && cachedInfo.inputs.length > 0) {
        cachedInfo.inputs.forEach(inType => {
            if (candInputs.includes(inType)) inputMatches++;
        });
        score += (inputMatches / cachedInfo.inputs.length) * 15;
    }
    
    let outputMatches = 0;
    if (cachedInfo.outputs && cachedInfo.outputs.length > 0) {
        cachedInfo.outputs.forEach(outType => {
            if (candOutputs.includes(outType)) outputMatches++;
        });
        score += (outputMatches / cachedInfo.outputs.length) * 15;
    }
    
    // 4. Coordinates / Geometry Proximity (Distance on canvas)
    if (cachedInfo.pos && candidate.pos) {
        const dx = candidate.pos[0] - cachedInfo.pos[0];
        const dy = candidate.pos[1] - cachedInfo.pos[1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40) {
            score += 30; // Very high probability (replaced exactly in-place)
        } else if (dist < 150) {
            score += 15; // Nearby
        } else if (dist < 400) {
            score += 5;
        }
    }
    
    // 5. ID Proximity (Ordinal sequence similarity)
    if (missingId && candidate.id) {
        const idDiff = Math.abs(parseInt(candidate.id) - parseInt(missingId));
        if (!isNaN(idDiff)) {
            if (idDiff === 1) {
                score += 25; // Sequential ID match (highly likely replacement!)
            } else if (idDiff <= 3) {
                score += 12;
            } else if (idDiff <= 10) {
                score += 6;
            }
        }
    }
    
    // 6. Upstream / Downstream Link Topology
    let topologyScore = 0;
    if (cachedInfo.upstream && cachedInfo.upstream.length > 0) {
        const candUpstreamNodeIds = [];
        if (candidate.inputs) {
            candidate.inputs.forEach(slot => {
                if (slot.link !== undefined && slot.link !== null) {
                    const link = app.graph.links ? app.graph.links[slot.link] : null;
                    if (link) {
                        candUpstreamNodeIds.push(String(link.origin_id));
                    }
                }
            });
        }
        
        cachedInfo.upstream.forEach(up => {
            if (candUpstreamNodeIds.includes(String(up.nodeId))) {
                topologyScore += 15;
            }
        });
    }
    
    if (cachedInfo.downstream && cachedInfo.downstream.length > 0) {
        const candDownstreamNodeIds = [];
        if (candidate.outputs) {
            candidate.outputs.forEach(slot => {
                if (slot.links && slot.links.length > 0) {
                    slot.links.forEach(linkId => {
                        const link = app.graph.links ? app.graph.links[linkId] : null;
                        if (link) {
                            candDownstreamNodeIds.push(String(link.target_id));
                        }
                    });
                }
            });
        }
        
        cachedInfo.downstream.forEach(down => {
            if (candDownstreamNodeIds.includes(String(down.nodeId))) {
                topologyScore += 15;
            }
        });
    }
    score += Math.min(30, topologyScore);
    
    return Math.min(100, Math.round(score));
}

function _trixGetSmartSearchCandidates(bypasserNode, missingId) {
    const cache = bypasserNode.properties?.trixNodeCache || {};
    const cachedInfo = cache[missingId];
    if (!cachedInfo) return [];
    
    const allNodes = _trixGetAllGraphNodes(app.graph);
    const usedIds = _trixGetGlobalUsedNodeIds();
    
    const candidates = [];
    allNodes.forEach((node) => {
        if (node.type === "TrixBypasser" || node.type === "TrixBypasserSimple" || String(node.id) === String(missingId)) {
            return;
        }
        
        const score = _trixScoreCandidate(cachedInfo, node, missingId);
        if (score >= 20) {
            candidates.push({
                node: node,
                score: score,
                isAlreadyTargeted: usedIds.has(String(node.id))
            });
        }
    });
    
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

function _trixShowPickerModal(node, currentVal, onSelect) {
    const entries = _trixFindAllNodesRecursively(app.graph);
    const usedNodeIds = _trixGetGlobalUsedNodeIds();

    const groups = {};
    for (const e of entries) {
        if (!groups[e.path]) groups[e.path] = [];
        groups[e.path].push(e);
    }
    const paths = Object.keys(groups).sort((a, b) => a === "Root" ? -1 : a.localeCompare(b));

    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeyDown);
        overlay.remove();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            const overlays = document.querySelectorAll(".trix-picker-overlay");
            if (overlays.length > 0 && overlays[overlays.length - 1] === overlay) {
                cleanup();
            }
        }
    };
    document.addEventListener("keydown", handleKeyDown);
    
    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    
    const header = document.createElement("div");
    header.className = "trix-picker-header";
    
    const title = document.createElement("h3");
    title.className = "trix-picker-title";
    title.textContent = "Select Target Nodes";
    
    const manualContainer = document.createElement("div");
    manualContainer.className = "trix-picker-manual-container";
    
    const manualLabel = document.createElement("span");
    manualLabel.className = "trix-picker-manual-label";
    manualLabel.textContent = "Selected Node IDs (Comma separated):";
    
    const manualRow = document.createElement("div");
    manualRow.className = "trix-picker-manual-row";
    
    const manualInput = document.createElement("input");
    manualInput.className = "trix-picker-manual-input";
    manualInput.type = "text";
    manualInput.placeholder = "Enter ID or click nodes below...";
    manualInput.value = currentVal || "";
    
    const btnPaste = document.createElement("button");
    btnPaste.className = "trix-btn trix-btn-secondary";
    btnPaste.style.padding = "5px 10px";
    btnPaste.style.fontSize = "11px";
    btnPaste.style.height = "100%";
    btnPaste.style.whiteSpace = "nowrap";
    btnPaste.textContent = "Paste";
    btnPaste.onclick = async (e) => {
        e.preventDefault();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                const pastedIds = text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
                let currentIds = manualInput.value.split(",").map(s => s.trim()).filter(Boolean);
                const merged = Array.from(new Set([...currentIds, ...pastedIds]));
                manualInput.value = merged.join(", ");
                updateWarningAndRender();
            }
        } catch (err) {
            console.error("Failed to read from clipboard:", err);
            alert("Unable to read from clipboard. Please ensure clipboard permission is granted.");
        }
    };
    
    manualRow.appendChild(manualInput);
    manualRow.appendChild(btnPaste);
    
    manualContainer.appendChild(manualLabel);
    manualContainer.appendChild(manualRow);
    
    const search = document.createElement("input");
    search.className = "trix-picker-search";
    search.placeholder = "Search workspace nodes by title or ID...";
    
    header.appendChild(title);
    header.appendChild(manualContainer);
    header.appendChild(search);
    
    const warningContainer = document.createElement("div");
    
    const list = document.createElement("div");
    list.className = "trix-picker-list";
    
    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";
    
    const btnCancel = document.createElement("button");
    btnCancel.className = "trix-btn trix-btn-secondary";
    btnCancel.textContent = "Cancel";
    btnCancel.onclick = () => { cleanup(); };
    
    const btnSelect = document.createElement("button");
    btnSelect.className = "trix-btn trix-btn-primary";
    btnSelect.textContent = "Apply";
    btnSelect.onclick = () => {
        onSelect(manualInput.value.trim());
        cleanup();
    };
    
    footer.appendChild(btnCancel);
    footer.appendChild(btnSelect);
    
    modal.appendChild(header);
    modal.appendChild(warningContainer);
    modal.appendChild(list);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    
    let activeGroup = paths.length === 1 ? paths[0] : "Root";
    let showMissingGroupOpen = true;
    let showSelectedGroupOpen = true;
    
    const getSelectedIds = () => {
        return manualInput.value.split(",").map(s => s.trim()).filter(Boolean);
    };

    const toggleIdInInput = (id) => {
        let ids = getSelectedIds();
        const index = ids.indexOf(id);
        if (index > -1) {
            ids.splice(index, 1);
        } else {
            ids.push(id);
        }
        manualInput.value = ids.join(", ");
        updateWarningAndRender();
    };

    const addItem = (entry, parent) => {
        const item = document.createElement("div");
        item.className = "trix-picker-item";
        
        const selectedIds = getSelectedIds();
        const isSelected = selectedIds.includes(entry.id) || selectedIds.includes(entry.key);
        if (isSelected) {
            item.classList.add("selected");
        }
        
        const isAlreadyUsed = usedNodeIds.has(entry.id) || usedNodeIds.has(entry.key);
        const indicator = isAlreadyUsed ? `<span class="trix-item-indicator" title="Already targeted in this node"></span>` : "";
        
        item.innerHTML = `<div class="trix-item-title">${indicator}${entry.title}</div><div class="trix-item-meta">${entry.type} (ID: ${entry.id})</div>`;
        item.onclick = (e) => {
            e.stopPropagation();
            toggleIdInInput(entry.key || entry.id);
        };
        parent.appendChild(item);
    };

    const updateWarningAndRender = () => {
        const selectedIds = getSelectedIds();
        const missingIds = [];
        const activeSelectedIds = [];
        selectedIds.forEach((id) => {
            if (!findNodeById(id)) {
                missingIds.push(id);
            } else {
                activeSelectedIds.push(id);
            }
        });

        warningContainer.innerHTML = "";
        if (missingIds.length > 0) {
            const warningEl = document.createElement("div");
            warningEl.className = "trix-picker-warning";
            
            const warningText = document.createElement("span");
            warningText.className = "trix-picker-warning-text";
            const names = missingIds.map(id => {
                const cached = node.properties?.trixNodeCache?.[id];
                return cached ? `Node ${id} (${cached.title})` : `Node ${id}`;
            });
            warningText.textContent = `⚠️ Detected missing targets in current selection: ${names.join(", ")}`;
            
            const warningActions = document.createElement("div");
            warningActions.className = "trix-picker-warning-actions";
            
            const btnClear = document.createElement("button");
            btnClear.className = "trix-btn-warning-action trix-btn-clear-missing";
            btnClear.textContent = "Clear Missing";
            btnClear.onclick = (e) => {
                e.stopPropagation();
                let ids = getSelectedIds();
                ids = ids.filter(id => !missingIds.includes(id));
                manualInput.value = ids.join(", ");
                updateWarningAndRender();
            };
            
            const btnRecover = document.createElement("button");
            btnRecover.className = "trix-btn-warning-action trix-btn-smart-search";
            btnRecover.textContent = "Smart Search & Recover";
            btnRecover.onclick = (e) => {
                e.stopPropagation();
                runSmartSearch(missingIds);
            };
            
            warningActions.appendChild(btnClear);
            warningActions.appendChild(btnRecover);
            warningEl.appendChild(warningText);
            warningEl.appendChild(warningActions);
            warningContainer.appendChild(warningEl);
        }

        render(missingIds, activeSelectedIds);
    };

    const render = (missingIds, activeSelectedIds) => {
        const scrollTop = list.scrollTop;
        list.innerHTML = "";
        
        const term = search.value.toLowerCase().trim();
        if (term) {
            const matchedEntries = entries.filter(e => e.title.toLowerCase().includes(term) || e.id.includes(term) || e.type.toLowerCase().includes(term));
            const matchedMissing = missingIds.filter(id => {
                const cached = node.properties?.trixNodeCache?.[id];
                const title = cached ? cached.title : "";
                const type = cached ? cached.type : "";
                return id.includes(term) || title.toLowerCase().includes(term) || type.toLowerCase().includes(term);
            });

            if (matchedEntries.length === 0 && matchedMissing.length === 0) {
                list.innerHTML = `<div style="padding:20px;text-align:center;color:#555;font-size:12px;">No matching nodes found</div>`;
            } else {
                matchedMissing.forEach(id => {
                    const cached = node.properties?.trixNodeCache?.[id];
                    const cachedTitleText = cached ? ` - ${cached.title}` : "";
                    const cachedType = cached ? cached.type : "Unknown type";
                    
                    const item = document.createElement("div");
                    item.className = "trix-picker-item selected";
                    item.innerHTML = `<div class="trix-item-title"><span style="color:#ff6b6b;margin-right:6px;">⚠️</span>Missing Node (ID: ${id})${cachedTitleText}</div><div class="trix-item-meta" style="color:#ff8888;">${cachedType} (Not in graph)</div>`;
                    item.onclick = (e) => {
                        e.stopPropagation();
                        toggleIdInInput(id);
                    };
                    list.appendChild(item);
                });
                
                matchedEntries.forEach(e => addItem(e, list));
            }
            return;
        }

        // 1. Prepend Active Selected Nodes Group
        if (activeSelectedIds && activeSelectedIds.length > 0) {
            const grp = document.createElement("div");
            grp.className = "trix-group-header active";
            grp.style.border = "1px solid rgba(56, 122, 255, 0.3)";
            grp.innerHTML = `<span style="color:#a0c0ff;">Selected Nodes (${activeSelectedIds.length})</span><span class="arrow">${showSelectedGroupOpen ? '▼' : '▶'}</span>`;
            grp.onclick = (e) => {
                e.stopPropagation();
                showSelectedGroupOpen = !showSelectedGroupOpen;
                render(missingIds, activeSelectedIds);
            };
            list.appendChild(grp);

            const content = document.createElement("div");
            content.className = "trix-group-content";
            if (showSelectedGroupOpen) {
                content.classList.add("open");
                activeSelectedIds.forEach((id) => {
                    const targetNode = findNodeById(id);
                    if (targetNode) {
                        const title = targetNode.title || targetNode.type || `Node ${id}`;
                        const type = targetNode.type || targetNode.comfyClass || "";
                        
                        const item = document.createElement("div");
                        item.className = "trix-picker-item selected";
                        
                        const isAlreadyUsed = usedNodeIds.has(String(id)) || (targetNode && usedNodeIds.has(String(targetNode.id)));
                        const indicator = isAlreadyUsed ? `<span class="trix-item-indicator" title="Already targeted in this node"></span>` : "";
                        
                        item.innerHTML = `<div class="trix-item-title">${indicator}${title}</div><div class="trix-item-meta">${type} (ID: ${id})</div>`;
                        item.onclick = (e) => {
                            e.stopPropagation();
                            toggleIdInInput(id);
                        };
                        content.appendChild(item);
                    }
                });
            }
            list.appendChild(content);
        }

        // 2. Prepend Missing Nodes Group
        if (missingIds && missingIds.length > 0) {
            const grp = document.createElement("div");
            grp.className = "trix-group-header active";
            grp.style.border = "1px solid rgba(220, 76, 76, 0.3)";
            grp.innerHTML = `<span style="color:#ff8888;">⚠️ Missing / Disconnected Nodes (${missingIds.length})</span><span class="arrow">${showMissingGroupOpen ? '▼' : '▶'}</span>`;
            grp.onclick = (e) => {
                e.stopPropagation();
                showMissingGroupOpen = !showMissingGroupOpen;
                render(missingIds, activeSelectedIds);
            };
            list.appendChild(grp);

            const content = document.createElement("div");
            content.className = "trix-group-content";
            if (showMissingGroupOpen) {
                content.classList.add("open");
                missingIds.forEach((id) => {
                    const cached = node.properties?.trixNodeCache?.[id];
                    const cachedTitleText = cached ? ` - ${cached.title}` : "";
                    const cachedType = cached ? cached.type : "Unknown type";
                    
                    const item = document.createElement("div");
                    item.className = "trix-picker-item selected";
                    item.innerHTML = `<div class="trix-item-title"><span style="color:#ff6b6b;margin-right:6px;">⚠️</span>Missing Node (ID: ${id})${cachedTitleText}</div><div class="trix-item-meta" style="color:#ff8888;">${cachedType} (Not in graph)</div>`;
                    item.onclick = (e) => {
                        e.stopPropagation();
                        toggleIdInInput(id);
                    };
                    content.appendChild(item);
                });
            }
            list.appendChild(content);
        }
        
        for (const p of paths) {
            const grp = document.createElement("div");
            grp.className = "trix-group-header";
            if (p === activeGroup) grp.classList.add("active");
            grp.innerHTML = `<span>${p}</span><span class="arrow">${p === activeGroup ? '▼' : '▶'}</span>`;
            grp.onclick = (e) => {
                e.stopPropagation();
                activeGroup = (activeGroup === p ? null : p);
                render(missingIds, activeSelectedIds);
            };
            
            const content = document.createElement("div");
            content.className = "trix-group-content";
            if (p === activeGroup) content.classList.add("open");
            
            groups[p].sort((a, b) => a.title.localeCompare(b.title));
            groups[p].forEach(e => addItem(e, content));
            
            list.appendChild(grp);
            list.appendChild(content);
        }
        list.scrollTop = scrollTop;
    };

    const runSmartSearch = (missingIds) => {
        const proposals = [];
        
        missingIds.forEach((missingId) => {
            const cands = _trixGetSmartSearchCandidates(node, missingId);
            if (cands && cands.length > 0) {
                const best = cands[0];
                const cached = node.properties?.trixNodeCache?.[missingId];
                proposals.push({
                    missingId: missingId,
                    cachedTitle: cached ? cached.title : "Node",
                    cachedType: cached ? cached.type : "Unknown",
                    replacementNode: best.node,
                    score: best.score
                });
            }
        });

        if (proposals.length === 0) {
            alert("Smart Search could not find any suitable replacement candidates in the workspace.");
            return;
        }

        const suggestionOverlay = document.createElement("div");
        suggestionOverlay.className = "trix-picker-overlay";
        suggestionOverlay.style.zIndex = "10001";
        
        const suggestionModal = document.createElement("div");
        suggestionModal.className = "trix-picker-modal";
        suggestionModal.style.width = "380px";
        suggestionModal.style.maxHeight = "80vh";
        
        const sugHeader = document.createElement("div");
        sugHeader.className = "trix-picker-header";
        sugHeader.innerHTML = `<h3 class="trix-picker-title">Smart Search Recovery</h3>`;
        
        const sugBody = document.createElement("div");
        sugBody.style.padding = "14px 16px";
        sugBody.style.background = "#141418";
        sugBody.style.color = "#aaa";
        sugBody.style.fontSize = "11px";
        sugBody.style.lineHeight = "1.5";
        sugBody.style.overflowY = "auto";
        sugBody.style.flex = "1";
        
        const bodyTitle = document.createElement("div");
        bodyTitle.style.fontWeight = "bold";
        bodyTitle.style.marginBottom = "10px";
        bodyTitle.style.color = "#eee";
        bodyTitle.textContent = "Found the following replacement candidates in graph:";
        sugBody.appendChild(bodyTitle);
        
        const propList = document.createElement("div");
        propList.style.display = "flex";
        propList.style.flexDirection = "column";
        propList.style.gap = "6px";
        
        proposals.forEach(p => {
            const item = document.createElement("div");
            item.style.padding = "8px 10px";
            item.style.background = "rgba(56, 122, 255, 0.05)";
            item.style.border = "1px solid rgba(56, 122, 255, 0.15)";
            item.style.borderRadius = "4px";
            
            const repTitle = p.replacementNode.title || p.replacementNode.type || `Node ${p.replacementNode.id}`;
            item.innerHTML = `
                <div style="color: #ff8888; font-weight: 600; margin-bottom: 2px;">Replace Missing ID ${p.missingId} (${p.cachedTitle})</div>
                <div style="color: #88ff88; font-weight: 600;">➔ New Candidate: ${repTitle} (ID: ${p.replacementNode.id})</div>
                <div style="font-size: 9px; color: #555; margin-top: 4px; text-align: right;">Match Score: ${p.score}%</div>
            `;
            propList.appendChild(item);
        });
        sugBody.appendChild(propList);
        
        const sugFooter = document.createElement("div");
        sugFooter.className = "trix-picker-footer";
        
        const sugCleanup = () => {
            document.removeEventListener("keydown", handleSugKeyDown);
            suggestionOverlay.remove();
        };
        
        const handleSugKeyDown = (e) => {
            if (e.key === "Escape" || e.keyCode === 27) {
                sugCleanup();
            }
        };
        document.addEventListener("keydown", handleSugKeyDown);

        const btnSugCancel = document.createElement("button");
        btnSugCancel.className = "trix-btn trix-btn-secondary";
        btnSugCancel.textContent = "Cancel";
        btnSugCancel.onclick = () => { sugCleanup(); };
        
        const btnSugApply = document.createElement("button");
        btnSugApply.className = "trix-btn trix-btn-primary";
        btnSugApply.textContent = "Apply Recovery";
        btnSugApply.onclick = () => {
            let currentIds = getSelectedIds();
            proposals.forEach(p => {
                currentIds = currentIds.map(id => id === p.missingId ? String(p.replacementNode.id) : id);
            });
            manualInput.value = currentIds.join(", ");
            sugCleanup();
            updateWarningAndRender();
        };
        
        sugFooter.appendChild(btnSugCancel);
        sugFooter.appendChild(btnSugApply);
        
        suggestionModal.appendChild(sugHeader);
        suggestionModal.appendChild(sugBody);
        suggestionModal.appendChild(sugFooter);
        suggestionOverlay.appendChild(suggestionModal);
        
        document.body.appendChild(suggestionOverlay);
    };

    search.oninput = () => {
        const selected = getSelectedIds();
        render(selected.filter(id => !findNodeById(id)), selected.filter(id => !!findNodeById(id)));
    };
    manualInput.oninput = updateWarningAndRender;
    
    document.body.appendChild(overlay);
    
    updateWarningAndRender();
    setTimeout(() => search.focus(), 50);
}

// =========================================================
// 4. MUTE / BYPASS LOGIC ENFORCEMENT
// =========================================================
function _trixEnforceLogic(node) {
    if (!node.properties || !node.properties.trixBypasserState) return;
    const state = node.properties.trixBypasserState;
    const currentTargets = new Map();
    
    const isSimple = (node.type === "TrixBypasserSimple");

    if (isSimple) {
        if (state.targets) {
            state.targets.forEach((target) => {
                const val = target.value || "";
                if (!val.trim()) return;
                const ids = val.split(",").map(s => s.trim()).filter(Boolean);
                
                let isTargetActive = target.active;
                if (state.selectMode === "single") {
                    const activeTarget = state.targets.find(t => t.active);
                    isTargetActive = activeTarget ? (target === activeTarget) : false;
                }
                
                const requiredMode = isTargetActive ? 0 : (state.muteMode === "mute" ? 2 : 4);
                
                ids.forEach((id) => {
                    if (currentTargets.has(id)) {
                        const existing = currentTargets.get(id);
                        if (existing !== 0 && requiredMode === 0) {
                            currentTargets.set(id, 0);
                        }
                    } else {
                        currentTargets.set(id, requiredMode);
                    }
                });
            });
        }
    } else {
        if (state.groups) {
            state.groups.forEach((group) => {
                let isGroupActive = group.active;
                if (state.selectMode === "single") {
                    const activeGroup = state.groups.find(g => g.active);
                    isGroupActive = activeGroup ? (group.id === activeGroup.id) : false;
                }

                group.targets.forEach((target) => {
                    const val = target.value || "";
                    if (!val.trim()) return;
                    const ids = val.split(",").map(s => s.trim()).filter(Boolean);
                    
                    const isTargetActive = isGroupActive && target.active;
                    const requiredMode = isTargetActive ? 0 : (state.muteMode === "mute" ? 2 : 4);
                    
                    ids.forEach((id) => {
                        if (currentTargets.has(id)) {
                            const existing = currentTargets.get(id);
                            if (existing !== 0 && requiredMode === 0) {
                                currentTargets.set(id, 0);
                            }
                        } else {
                            currentTargets.set(id, requiredMode);
                        }
                    });
                });
            });
        }
    }

    const lastTargeted = node._trixLastTargeted || new Map();
    
    // 1. Restore nodes that are no longer targeted
    for (const [id, oldMode] of lastTargeted.entries()) {
        if (!currentTargets.has(id)) {
            const targetNode = findNodeById(id);
            if (targetNode) {
                const orig = node.properties.trixBypasserOriginalModes[id] ?? 0;
                targetNode.mode = orig;
                if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
            }
            delete node.properties.trixBypasserOriginalModes[id];
        }
    }

    // 2. Apply modes to current targets
    let changed = false;
    for (const [id, reqMode] of currentTargets.entries()) {
        const targetNode = findNodeById(id);
        if (targetNode) {
            if (node.properties.trixBypasserOriginalModes[id] === undefined) {
                node.properties.trixBypasserOriginalModes[id] = targetNode.mode;
            }
            if (targetNode.mode !== reqMode) {
                targetNode.mode = reqMode;
                if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
                changed = true;
            }
        }
    }

    node._trixLastTargeted = currentTargets;
    if (changed && app.canvas) {
        app.canvas.setDirty(true, true);
    }
}

// =========================================================
// 5. CANVAS DRAWING IMPLEMENTATION (MINIMALIST & SLEEK)
// =========================================================
function _trixDrawSwitch(ctx, x, y, w, h, active) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = active ? "#387aff" : "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = active ? "#387aff" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    const knobR = h / 2 - 1.5;
    const knobX = active ? (x + w - h / 2) : (x + h / 2);
    const knobY = y + h / 2;
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
}

function _trixDrawNodeSimple(node, ctx, w_widget, y, h_widget) {
    if (!node.properties || !node.properties.trixBypasserState) return;
    const state = node.properties.trixBypasserState;
    const targets = state.targets || [];
    const w = node.size[0];
    const hideControls = !!node.properties.trixHideControls;
    
    const startY = y || 0; 
    const margin = 10;
    const topGap = 8; // Breathing room under header line
    const headerH = 20;
    const pillW = 75;
    const trashW = 20;
    const addTargetBtnW = w - 2 * margin - 2 * pillW - trashW - 12;
    let curY = startY + topGap;

    node._trixHitAreas = [];

    if (!hideControls) {
        // Draw tray background (solid to top and side edges)
        ctx.beginPath();
        ctx.rect(0, startY, w, curY + headerH + 6 - startY);
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fill();

        // Bottom separator line
        ctx.beginPath();
        ctx.moveTo(0, curY + headerH + 6);
        ctx.lineTo(w, curY + headerH + 6);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Font setting
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";

        // --- Pill 1: Single / Multi ---
        const pill1X = margin;
        const isSingle = state.selectMode === "single";
        
        ctx.beginPath();
        ctx.roundRect(pill1X, curY, pillW, headerH, 4);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pill1X, curY, pillW, headerH, 4);
        ctx.clip();
        ctx.fillStyle = "#33789A";
        if (isSingle) {
            ctx.fillRect(pill1X, curY, pillW / 2, headerH);
        } else {
            ctx.fillRect(pill1X + pillW / 2, curY, pillW / 2, headerH);
        }
        ctx.restore();

        ctx.fillStyle = isSingle ? "#fff" : "#777";
        ctx.fillText("Single", pill1X + pillW / 4, curY + headerH / 2);
        ctx.fillStyle = isSingle ? "#777" : "#fff";
        ctx.fillText("Multi", pill1X + 3 * pillW / 4, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "selectMode",
            mode: "single",
            x: pill1X, y: curY, w: pillW / 2, h: headerH
        });
        node._trixHitAreas.push({
            type: "selectMode",
            mode: "multi",
            x: pill1X + pillW / 2, y: curY, w: pillW / 2, h: headerH
        });

        // --- Add Target Button (Add [Number]) ---
        const addX = pill1X + pillW + 4;
        const nextNum = targets.length + 1;
        const canAddTarget = targets.length < 10;
        
        ctx.beginPath();
        ctx.roundRect(addX, curY, addTargetBtnW, headerH, 4);
        ctx.fillStyle = canAddTarget ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.01)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.fillStyle = canAddTarget ? "#bbb" : "#555";
        ctx.fillText(`Add ${nextNum}`, addX + addTargetBtnW / 2, curY + headerH / 2);

        if (canAddTarget) {
            node._trixHitAreas.push({
                type: "addSimpleTarget",
                x: addX, y: curY, w: addTargetBtnW, h: headerH
            });
        }

        // --- Trash Mode Button ---
        const trashX = addX + addTargetBtnW + 4;
        const isDeleteMode = state.deleteMode;
        ctx.beginPath();
        ctx.roundRect(trashX, curY, trashW, headerH, 4);
        ctx.fillStyle = isDeleteMode ? "#b34d4d" : "rgba(255,255,255,0.06)";
        ctx.fill();
        ctx.strokeStyle = isDeleteMode ? "#e66666" : "rgba(255,255,255,0.1)";
        ctx.stroke();
        
        ctx.fillStyle = "#fff";
        ctx.font = "9px Arial";
        ctx.fillText("🗑", trashX + trashW / 2, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "toggleDeleteMode",
            x: trashX, y: curY, w: trashW, h: headerH
        });

        // --- Pill 2: Mute / Bypass ---
        const pill2X = w - margin - pillW;
        const isMute = state.muteMode === "mute";
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

        ctx.beginPath();
        ctx.roundRect(pill2X, curY, pillW, headerH, 4);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pill2X, curY, pillW, headerH, 4);
        ctx.clip();
        ctx.fillStyle = "#33789A";
        if (isMute) {
            ctx.fillRect(pill2X, curY, pillW / 2, headerH);
        } else {
            ctx.fillRect(pill2X + pillW / 2, curY, pillW / 2, headerH);
        }
        ctx.restore();

        ctx.fillStyle = isMute ? "#fff" : "#777";
        ctx.fillText("Mute", pill2X + pillW / 4, curY + headerH / 2);
        ctx.fillStyle = isMute ? "#777" : "#fff";
        ctx.fillText("Bypass", pill2X + 3 * pillW / 4, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "muteMode",
            mode: "mute",
            x: pill2X, y: curY, w: pillW / 2, h: headerH
        });
        node._trixHitAreas.push({
            type: "muteMode",
            mode: "bypass",
            x: pill2X + pillW / 2, y: curY, w: pillW / 2, h: headerH
        });

        curY += headerH + 10;
    }

    // --- Flat Targets List ---
    let rowY = curY;
    const targetRowH = 22;
    const switchW = 28;
    const switchH = 14;
    const isDeleteMode = !hideControls && state.deleteMode;

    targets.forEach((target, tIndex) => {
        let hasMissing = false;
        if (target.value) {
            const ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
            hasMissing = ids.some(id => !findNodeById(id));
        }

        const rightSpace = 32 + (isDeleteMode ? 18 : 0);
        const jumpW = 18; // Jump button width
        const totalTargetW = w - 2 * margin - rightSpace;
        
        // Measure dynamic label width
        const displayLabel = target.name || `Target ${tIndex + 1}`;
        ctx.save();
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        const textWidth = ctx.measureText(displayLabel).width;
        ctx.restore();
        const maxAllowedLabelW = Math.floor(totalTargetW * 0.5);
        const labelW = Math.min(maxAllowedLabelW, Math.max(75, Math.ceil(textWidth + 16)));
        
        const gap = 4;
        const labelX = margin;
        
        let pickerX, pickerW, jumpX;
        let yellowX, yellowW = 16, yellowH = 18;
        
        if (hasMissing) {
            yellowX = labelX + labelW + 3;
            pickerX = yellowX + yellowW + gap;
            // Reduce picker width by the jump button width
            pickerW = totalTargetW - labelW - (gap*2) - yellowW - 3 - jumpW;
        } else {
            pickerX = labelX + labelW + gap;
            // Reduce picker width by the jump button width
            pickerW = totalTargetW - labelW - (gap*2) - jumpW;
        }

        jumpX = pickerX + pickerW + gap; // Jump button position
        
        // 1. Left Label Box (Renameable Target Label) - border contour removed
        ctx.beginPath();
        ctx.roundRect(labelX, rowY + 2, labelW, 18, 4);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fill();
        
        // Label text hover highlight check
        const isRenameHovered = (node._trixHoveredRenameTargetIndex === tIndex);
        
        // Label text
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = isRenameHovered ? "#387aff" : "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Truncate label if it's too long
        const maxLabelW = labelW - 10;
        let displayLabelText = displayLabel;
        if (ctx.measureText(displayLabelText).width > maxLabelW) {
            while (displayLabelText.length > 3 && ctx.measureText(displayLabelText + "…").width > maxLabelW) {
                displayLabelText = displayLabelText.slice(0, -1);
            }
            displayLabelText += "…";
        }
        ctx.fillText(displayLabelText, labelX + labelW / 2, rowY + 11);
        
        // Draw subtle underline if hovered
        if (isRenameHovered) {
            ctx.strokeStyle = "#387aff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(labelX + 8, rowY + 16);
            ctx.lineTo(labelX + labelW - 8, rowY + 16);
            ctx.stroke();
        }
        
        // Add click area for target renaming
        node._trixHitAreas.push({
            type: "renameTargetLabel",
            targetIndex: tIndex,
            x: labelX, y: rowY, w: labelW, h: targetRowH
        });

        // 1.5 Yellow Warning Button (Only if node is missing)
        if (hasMissing) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(yellowX, rowY + 2, yellowW, yellowH, 4);
            ctx.fillStyle = "#e6a23c";
            ctx.fill();
            
            ctx.fillStyle = "#18181c";
            ctx.font = "bold 11px 'Segoe UI', -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!", yellowX + yellowW / 2, rowY + 2 + yellowH / 2);
            ctx.restore();

            node._trixHitAreas.push({
                type: "clickTargetWarning",
                targetIndex: tIndex,
                groupIndex: null,
                x: yellowX, y: rowY + 2, w: yellowW, h: yellowH
            });
        }

        // 2. Right Picker Box (Displays node IDs & titles, opens search modal)
        ctx.beginPath();
        ctx.roundRect(pickerX, rowY + 2, pickerW, 18, 4);
        ctx.fillStyle = "#0c0c0f";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.02)";
        ctx.stroke();

        // Target IDs & Titles text
        ctx.font = "9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        let textToShow = "";
        const resolved = _trixResolveNodeTitles(target.value, node);
        if (resolved) {
            textToShow = resolved;
            ctx.fillStyle = "#aaa";
        } else {
            textToShow = "Select target nodes...";
            ctx.fillStyle = "#444";
        }
        
        // Truncate text if it's too long
        const maxTextW = pickerW - 12;
        let displayText = textToShow;
        if (ctx.measureText(displayText).width > maxTextW) {
            while (displayText.length > 3 && ctx.measureText(displayText + "…").width > maxTextW) {
                displayText = displayText.slice(0, -1);
            }
            displayText += "…";
        }
        ctx.fillText(displayText, pickerX + 6, rowY + 11);

        // Add click area for target nodes picker
        node._trixHitAreas.push({
            type: "clickTargetBox",
            targetIndex: tIndex,
            x: pickerX, y: rowY, w: pickerW, h: targetRowH
        });

        // --- JUMP BUTTON (NAVIGATION) ---
        const isJumpHovered = (node._trixHoveredJumpTargetIndex === tIndex && 
                              node._trixHoveredJumpGroupIndex === null);
        
        ctx.beginPath();
        ctx.roundRect(jumpX, rowY + 2, jumpW, 18, 4);
        ctx.fillStyle = isJumpHovered ? "#387aff" : "rgba(255,255,255,0.06)";
        ctx.fill();
        
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👁", jumpX + jumpW / 2, rowY + 11);

        node._trixHitAreas.push({
            type: "jumpToTarget",
            groupIndex: null,
            targetIndex: tIndex,
            x: jumpX, y: rowY, w: jumpW, h: targetRowH
        });

        // Row Delete button (sleek red X)
        if (isDeleteMode) {
            const rowTrashX = jumpX + jumpW + 4;
            ctx.fillStyle = "#ff4d4d";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("✕", rowTrashX + 6, rowY + 11);

            node._trixHitAreas.push({
                type: "deleteTarget",
                targetIndex: tIndex,
                x: rowTrashX, y: rowY, w: 12, h: targetRowH
            });
        }

        // Row switch (aligned with the Bypass button's right border)
        const rSwitchX = w - margin - switchW;
        _trixDrawSwitch(ctx, rSwitchX, rowY + (targetRowH - switchH) / 2, switchW, switchH, target.active);

        node._trixHitAreas.push({
            type: "toggleTarget",
            targetIndex: tIndex,
            x: rSwitchX - 4, y: rowY, w: switchW + 8, h: targetRowH
        });

        rowY += targetRowH;
    });

    const neededH = rowY + 6;
    node._trixNeededHeight = neededH;
    if (Math.abs(node.size[1] - neededH) > 2) {
        node.size[1] = neededH;
        node.setDirtyCanvas(true, true);
        const widget = node.widgets?.find(w => w.name === "trix_bypasser_control");
        widget?.triggerDraw?.();
    }

    const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
    if (isVueMode) {
        const targetH = neededH + (LiteGraph.NODE_TITLE_HEIGHT || 30);
        if (node._trixLastSetDOMHeight !== targetH) {
            node._trixLastSetDOMHeight = targetH;
            const el = document.querySelector('[data-node-id="' + node.id + '"]');
            if (el) {
                el.style.height = targetH + "px";
            }
        }
    }
    console.log("[Trix Bypasser] _trixDrawNodeSimple populated hitAreas count:", node._trixHitAreas.length);
}

function _trixDrawNode(node, ctx, w_widget, y, h_widget) {
    // Escape immediately if node is collapsed or hidden
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return;

    if (node.type === "TrixBypasserSimple") {
        _trixDrawNodeSimple(node, ctx, w_widget, y, h_widget);
        return;
    }

    if (!node.properties || !node.properties.trixBypasserState) return;
    const state = node.properties.trixBypasserState;
    const groups = state.groups;
    const w = node.size[0];
    const hideControls = !!node.properties.trixHideControls;
    
    // Completely flush coordinate system
    const startY = y || 0; 
    const margin = 10;
    
    const topGap = 8; // Breathing room under header line
    const headerH = 20;
    const pillW = 75;
    const trashW = 20;
    const addGroupW = w - 2 * margin - 2 * pillW - trashW - 12;
    let curY = startY + topGap;

    node._trixHitAreas = [];

    if (!hideControls) {
        // Draw tray background (solid to top and side edges)
        ctx.beginPath();
        ctx.rect(0, startY, w, curY + headerH + 6 - startY);
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fill();

        // Bottom separator line
        ctx.beginPath();
        ctx.moveTo(0, curY + headerH + 6);
        ctx.lineTo(w, curY + headerH + 6);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Font setting
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";

        // --- Pill 1: Single / Multi ---
        const pill1X = margin;
        const isSingle = state.selectMode === "single";
        
        ctx.beginPath();
        ctx.roundRect(pill1X, curY, pillW, headerH, 4);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pill1X, curY, pillW, headerH, 4);
        ctx.clip();
        ctx.fillStyle = "#33789A";
        if (isSingle) {
            ctx.fillRect(pill1X, curY, pillW / 2, headerH);
        } else {
            ctx.fillRect(pill1X + pillW / 2, curY, pillW / 2, headerH);
        }
        ctx.restore();

        ctx.fillStyle = isSingle ? "#fff" : "#777";
        ctx.fillText("Single", pill1X + pillW / 4, curY + headerH / 2);
        ctx.fillStyle = isSingle ? "#777" : "#fff";
        ctx.fillText("Multi", pill1X + 3 * pillW / 4, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "selectMode",
            mode: "single",
            x: pill1X, y: curY, w: pillW / 2, h: headerH
        });
        node._trixHitAreas.push({
            type: "selectMode",
            mode: "multi",
            x: pill1X + pillW / 2, y: curY, w: pillW / 2, h: headerH
        });

        // --- Add Group Button ---
        const addX = pill1X + pillW + 4;
        const nextLetter = "ABCDEFGHIJ".split("").find(l => !groups.some(g => g.id === l)) || "K";
        const canAddGroup = groups.length < 10;
        
        ctx.beginPath();
        ctx.roundRect(addX, curY, addGroupW, headerH, 4);
        ctx.fillStyle = canAddGroup ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.01)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.fillStyle = canAddGroup ? "#bbb" : "#555";
        ctx.fillText(`Add ${nextLetter}`, addX + addGroupW / 2, curY + headerH / 2);

        if (canAddGroup) {
            node._trixHitAreas.push({
                type: "addGroup",
                letter: nextLetter,
                x: addX, y: curY, w: addGroupW, h: headerH
            });
        }

        // --- Trash Mode Button ---
        const trashX = addX + addGroupW + 4;
        const isDeleteMode = state.deleteMode;
        ctx.beginPath();
        ctx.roundRect(trashX, curY, trashW, headerH, 4);
        ctx.fillStyle = isDeleteMode ? "#b34d4d" : "rgba(255,255,255,0.06)";
        ctx.fill();
        ctx.strokeStyle = isDeleteMode ? "#e66666" : "rgba(255,255,255,0.1)";
        ctx.stroke();
        
        ctx.fillStyle = "#fff";
        ctx.font = "9px Arial";
        ctx.fillText("🗑", trashX + trashW / 2, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "toggleDeleteMode",
            x: trashX, y: curY, w: trashW, h: headerH
        });

        // --- Pill 2: Mute / Bypass ---
        const pill2X = w - margin - pillW;
        const isMute = state.muteMode === "mute";
        ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

        ctx.beginPath();
        ctx.roundRect(pill2X, curY, pillW, headerH, 4);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pill2X, curY, pillW, headerH, 4);
        ctx.clip();
        ctx.fillStyle = "#33789A";
        if (isMute) {
            ctx.fillRect(pill2X, curY, pillW / 2, headerH);
        } else {
            ctx.fillRect(pill2X + pillW / 2, curY, pillW / 2, headerH);
        }
        ctx.restore();

        ctx.fillStyle = isMute ? "#fff" : "#777";
        ctx.fillText("Mute", pill2X + pillW / 4, curY + headerH / 2);
        ctx.fillStyle = isMute ? "#777" : "#fff";
        ctx.fillText("Bypass", pill2X + 3 * pillW / 4, curY + headerH / 2);

        node._trixHitAreas.push({
            type: "muteMode",
            mode: "mute",
            x: pill2X, y: curY, w: pillW / 2, h: headerH
        });
        node._trixHitAreas.push({
            type: "muteMode",
            mode: "bypass",
            x: pill2X + pillW / 2, y: curY, w: pillW / 2, h: headerH
        });

        curY += headerH + 10;
    }

    const isDeleteMode = !hideControls && state.deleteMode;

    // --- 2. GROUPS LIST ---
    groups.forEach((group, gIndex) => {
        const groupHeaderY = curY;
        const groupHeaderH = 24;

        // Expanded/Collapsed dimensions
        const targets = group.targets;
        const targetRowH = 22;
        const canAddTarget = !hideControls && targets.length < 10;
        const addTargetH = canAddTarget ? 18 : 0;
        const containerH = targets.length * targetRowH + addTargetH + 6;
        
        const cardH = group.collapsed ? groupHeaderH : (groupHeaderH + containerH);

        // Highlight color on hover (using semi-transparent black)
        const isHovered = (gIndex === node._trixHoveredGroupIndex);
        const cardBgColor = isHovered ? "rgba(0, 0, 0, 0.18)" : "rgba(0, 0, 0, 0.28)";

        // Unified Card Background & Border
        ctx.beginPath();
        ctx.roundRect(margin, groupHeaderY, w - 2 * margin, cardH, 4);
        ctx.fillStyle = cardBgColor;
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Sub-divider below header if expanded
        if (!group.collapsed) {
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin + 6, groupHeaderY + groupHeaderH);
            ctx.lineTo(w - margin - 6, groupHeaderY + groupHeaderH);
            ctx.stroke();
        }

        // Collapse / Expand arrow (larger size and bold style)
        ctx.fillStyle = "#888899";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        const arrow = group.collapsed ? "▶" : "▼";
        ctx.fillText(arrow, margin + 11, groupHeaderY + groupHeaderH / 2);

        // Group Name Text
        ctx.textAlign = "left";
        ctx.font = "bold 10px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
        
        const prefix = `[${group.id}] `;
        const prefixW = ctx.measureText(prefix).width;
        const nameW = ctx.measureText(group.name).width;
        
        // Draw the prefix "[A] "
        ctx.fillStyle = group.active ? "#eee" : "#777";
        ctx.fillText(prefix, margin + 22, groupHeaderY + groupHeaderH / 2);
        
        // Draw the name text with hover highlight and underline
        const isRenameHovered = (node._trixHoveredRenameGroupIndex === gIndex);
        if (isRenameHovered) {
            ctx.fillStyle = "#387aff"; // Highlight color (blue)
            ctx.fillText(group.name, margin + 22 + prefixW, groupHeaderY + groupHeaderH / 2);
            
            // Draw a subtle underline under the name
            ctx.strokeStyle = "#387aff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin + 22 + prefixW, groupHeaderY + groupHeaderH / 2 + 6);
            ctx.lineTo(margin + 22 + prefixW + nameW, groupHeaderY + groupHeaderH / 2 + 6);
            ctx.stroke();
        } else {
            ctx.fillStyle = group.active ? "#eee" : "#777";
            ctx.fillText(group.name, margin + 22 + prefixW, groupHeaderY + groupHeaderH / 2);
        }

        // PUSH HIT AREAS (Strict Order: GroupTitle, Delete, Toggle, Collapse)
        
        // 1. Rename click area (Only over the group name text)
        node._trixHitAreas.push({
            type: "groupTitle",
            groupIndex: gIndex,
            x: margin + 22 + prefixW - 4,
            y: groupHeaderY,
            w: nameW + 8,
            h: groupHeaderH
        });

        let rightOffset = w - margin - 6;

        // 2. Group Toggle Switch
        const switchW = 28;
        const switchH = 14;
        const switchX = rightOffset - switchW;
        const switchY = groupHeaderY + (groupHeaderH - switchH) / 2;
        _trixDrawSwitch(ctx, switchX, switchY, switchW, switchH, group.active);

        node._trixHitAreas.push({
            type: "toggleGroup",
            groupIndex: gIndex,
            x: switchX - 4, y: groupHeaderY, w: switchW + 8, h: groupHeaderH
        });
        rightOffset = switchX - 6;

        // 3. Minimalist inline delete cross (if Delete Mode is active)
        if (isDeleteMode) {
            const deleteW = 16;
            const deleteBtnX = rightOffset - deleteW;
            ctx.fillStyle = "#ff4d4d";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("✕", deleteBtnX + deleteW / 2, groupHeaderY + groupHeaderH / 2);

            node._trixHitAreas.push({
                type: "deleteGroup",
                groupIndex: gIndex,
                x: deleteBtnX, y: groupHeaderY, w: deleteW, h: groupHeaderH
            });
            rightOffset = deleteBtnX - 4;
        }

        // 4. Group Jump Button
        const jumpGroupW = 18;
        const jumpGroupX = rightOffset - jumpGroupW;
        const isGroupJumpHovered = (node._trixHoveredJumpGroupBtnIndex === gIndex);
        
        ctx.beginPath();
        ctx.roundRect(jumpGroupX, groupHeaderY + 3, jumpGroupW, 18, 4);
        ctx.fillStyle = isGroupJumpHovered ? "#387aff" : "rgba(0, 0, 0, 0.2)";
        ctx.fill();
        
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👁", jumpGroupX + jumpGroupW / 2, groupHeaderY + 12);
        
        node._trixHitAreas.push({
            type: "jumpToGroupTargets",
            groupIndex: gIndex,
            x: jumpGroupX, y: groupHeaderY, w: jumpGroupW, h: groupHeaderH
        });

        // 5. Fallback Collapse/Expand Area (covers remaining empty card area)
        node._trixHitAreas.push({
            type: "toggleCollapse",
            groupIndex: gIndex,
            x: margin, y: groupHeaderY, w: jumpGroupX - margin, h: groupHeaderH
        });

        // Draw targets directly on the seamless group card
        if (!group.collapsed) {
            let rowY = groupHeaderY + groupHeaderH + 3;
            
            targets.forEach((target, tIndex) => {
                let hasMissing = false;
                if (target.value) {
                    const ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
                    hasMissing = ids.some(id => !findNodeById(id));
                }

                const rightSpace = 32 + (isDeleteMode ? 18 : 0);
                const jumpW = 18; // Jump button width
                const totalTargetW = w - 2 * margin - 12 - rightSpace;
                
                // Measure dynamic label width
                const displayLabel = target.name || `Target ${tIndex + 1}`;
                ctx.save();
                ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                const textWidth = ctx.measureText(displayLabel).width;
                ctx.restore();
                const maxAllowedLabelW = Math.floor(totalTargetW * 0.5);
                const labelW = Math.min(maxAllowedLabelW, Math.max(75, Math.ceil(textWidth + 16)));
                
                const gap = 4;
                const labelX = margin + 6;
                
                let pickerX, pickerW, jumpX;
                let yellowX, yellowW = 16, yellowH = 18;
                
                if (hasMissing) {
                    yellowX = labelX + labelW + 3;
                    pickerX = yellowX + yellowW + gap;
                    // Reduce picker width by the jump button width
                    pickerW = totalTargetW - labelW - (gap*2) - yellowW - 3 - jumpW;
                } else {
                    pickerX = labelX + labelW + gap;
                    // Reduce picker width by the jump button width
                    pickerW = totalTargetW - labelW - (gap*2) - jumpW;
                }

                jumpX = pickerX + pickerW + gap; // Jump button position
                
                // 1. Left Label Box (Renameable Target Label) - border contour removed
                ctx.beginPath();
                ctx.roundRect(labelX, rowY + 2, labelW, 18, 4);
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fill();
                
                // Label text hover highlight check
                const isRenameHovered = (node._trixHoveredRenameTargetIndex === tIndex && node._trixHoveredRenameTargetGroupIndex === gIndex);
                
                // Label text
                ctx.font = "bold 9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.fillStyle = isRenameHovered ? "#387aff" : "#ffffff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                
                // Truncate label if it's too long
                const maxLabelW = labelW - 10;
                let displayLabelText = displayLabel;
                if (ctx.measureText(displayLabelText).width > maxLabelW) {
                    while (displayLabelText.length > 3 && ctx.measureText(displayLabelText + "…").width > maxLabelW) {
                        displayLabelText = displayLabelText.slice(0, -1);
                    }
                    displayLabelText += "…";
                }
                ctx.fillText(displayLabelText, labelX + labelW / 2, rowY + 11);
                
                // Draw subtle underline if hovered
                if (isRenameHovered) {
                    ctx.strokeStyle = "#387aff";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(labelX + 8, rowY + 16);
                    ctx.lineTo(labelX + labelW - 8, rowY + 16);
                    ctx.stroke();
                }
                
                // Add click area for target renaming
                node._trixHitAreas.push({
                    type: "renameTargetLabel",
                    groupIndex: gIndex,
                    targetIndex: tIndex,
                    x: labelX, y: rowY, w: labelW, h: targetRowH
                });

                // 1.5 Yellow Warning Button (Only if node is missing)
                if (hasMissing) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(yellowX, rowY + 2, yellowW, yellowH, 4);
                    ctx.fillStyle = "#e6a23c";
                    ctx.fill();
                    
                    ctx.fillStyle = "#18181c";
                    ctx.font = "bold 11px 'Segoe UI', -apple-system, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("!", yellowX + yellowW / 2, rowY + 2 + yellowH / 2);
                    ctx.restore();

                    node._trixHitAreas.push({
                        type: "clickTargetWarning",
                        targetIndex: tIndex,
                        groupIndex: gIndex,
                        x: yellowX, y: rowY + 2, w: yellowW, h: yellowH
                    });
                }

                // 2. Right Picker Box (Displays node IDs & titles, opens search modal)
                ctx.beginPath();
                ctx.roundRect(pickerX, rowY + 2, pickerW, 18, 4);
                ctx.fillStyle = "#0c0c0f";
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.02)";
                ctx.stroke();

                // Target IDs & Titles text
                ctx.font = "9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                
                let textToShow = "";
                const resolved = _trixResolveNodeTitles(target.value, node);
                if (resolved) {
                    textToShow = resolved;
                    ctx.fillStyle = "#aaa";
                } else {
                    textToShow = "Select target nodes...";
                    ctx.fillStyle = "#444";
                }
                
                // Truncate text if it's too long
                const maxTextW = pickerW - 12;
                let displayText = textToShow;
                if (ctx.measureText(displayText).width > maxTextW) {
                    while (displayText.length > 3 && ctx.measureText(displayText + "…").width > maxTextW) {
                        displayText = displayText.slice(0, -1);
                    }
                    displayText += "…";
                }
                ctx.fillText(displayText, pickerX + 6, rowY + 11);

                // Add click area for target nodes picker
                node._trixHitAreas.push({
                    type: "clickTargetBox",
                    groupIndex: gIndex,
                    targetIndex: tIndex,
                    x: pickerX, y: rowY, w: pickerW, h: targetRowH
                });

                // --- JUMP BUTTON (NAVIGATION) ---
                const isJumpHovered = (node._trixHoveredJumpTargetIndex === tIndex && 
                                      node._trixHoveredJumpGroupIndex === gIndex);
                
                ctx.beginPath();
                ctx.roundRect(jumpX, rowY + 2, jumpW, 18, 4);
                ctx.fillStyle = isJumpHovered ? "#387aff" : "rgba(255,255,255,0.06)";
                ctx.fill();
                
                ctx.fillStyle = "#fff";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("👁", jumpX + jumpW / 2, rowY + 11);

                node._trixHitAreas.push({
                    type: "jumpToTarget",
                    groupIndex: gIndex,
                    targetIndex: tIndex,
                    x: jumpX, y: rowY, w: jumpW, h: targetRowH
                });

                // Row Delete button (sleek red X)
                if (isDeleteMode) {
                    const rowTrashX = jumpX + jumpW + 4;
                    ctx.fillStyle = "#ff4d4d";
                    ctx.font = "bold 9px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("✕", rowTrashX + 6, rowY + 11);

                    node._trixHitAreas.push({
                        type: "deleteTarget",
                        groupIndex: gIndex,
                        targetIndex: tIndex,
                        x: rowTrashX, y: rowY, w: 12, h: targetRowH
                    });
                }

                // Row switch
                const rSwitchX = w - margin - 6 - switchW;
                _trixDrawSwitch(ctx, rSwitchX, rowY + (targetRowH - switchH) / 2, switchW, switchH, target.active);

                node._trixHitAreas.push({
                    type: "toggleTarget",
                    groupIndex: gIndex,
                    targetIndex: tIndex,
                    x: rSwitchX - 4, y: rowY, w: switchW + 8, h: targetRowH
                });

                rowY += targetRowH;
            });

            // Square-rounded "+" Button
            if (canAddTarget) {
                const addBtnW = 20;
                const addBtnH = 12;
                const addBtnX = w / 2 - addBtnW / 2;
                const addBtnY = rowY + 3;
                
                ctx.beginPath();
                ctx.roundRect(addBtnX, addBtnY, addBtnW, addBtnH, 2);
                ctx.fillStyle = "#101014";
                ctx.fill();
                ctx.strokeStyle = "#2c2c36";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.font = "9px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.textAlign = "center";
                ctx.fillStyle = "#778";
                ctx.fillText("+", w / 2, addBtnY + addBtnH / 2);

                node._trixHitAreas.push({
                    type: "addTargetRow",
                    groupIndex: gIndex,
                    x: addBtnX - 8, y: rowY, w: addBtnW + 16, h: 16
                });
            }
        }

        curY += cardH + 6;
    });

    const neededH = curY + 2;
    node._trixNeededHeight = neededH;
    if (Math.abs(node.size[1] - neededH) > 2) {
        node.size[1] = neededH;
        node.setDirtyCanvas(true, true);
        const widget = node.widgets?.find(w => w.name === "trix_bypasser_control");
        widget?.triggerDraw?.();
    }

    const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
    if (isVueMode) {
        const targetH = neededH + (LiteGraph.NODE_TITLE_HEIGHT || 30);
        if (node._trixLastSetDOMHeight !== targetH) {
            node._trixLastSetDOMHeight = targetH;
            const el = document.querySelector('[data-node-id="' + node.id + '"]');
            if (el) {
                el.style.height = targetH + "px";
            }
        }
    }
    console.log("[Trix Bypasser] _trixDrawNode populated hitAreas count:", node._trixHitAreas.length);
}

// =========================================================
// 6. EVENT MOUSE DOWN & DBLCLICK IMPLEMENTATION
// =========================================================
function _trixTriggerSmartSearchDirectly(node, groupIndex, targetIndex, missingIds) {
    const proposals = [];
    missingIds.forEach((missingId) => {
        const cands = _trixGetSmartSearchCandidates(node, missingId);
        if (cands && cands.length > 0) {
            const best = cands[0];
            const cached = node.properties?.trixNodeCache?.[missingId];
            proposals.push({
                missingId: missingId,
                cachedTitle: cached ? cached.title : "Node",
                cachedType: cached ? cached.type : "Unknown",
                replacementNode: best.node,
                score: best.score
            });
        }
    });

    if (proposals.length === 0) {
        alert("Smart Search could not find any suitable replacement candidates in the workspace.");
        return;
    }

    const suggestionOverlay = document.createElement("div");
    suggestionOverlay.className = "trix-picker-overlay";
    suggestionOverlay.style.zIndex = "10001";
    
    const suggestionModal = document.createElement("div");
    suggestionModal.className = "trix-picker-modal";
    suggestionModal.style.width = "380px";
    suggestionModal.style.maxHeight = "80vh";
    
    const sugHeader = document.createElement("div");
    sugHeader.className = "trix-picker-header";
    sugHeader.innerHTML = `<h3 class="trix-picker-title">Smart Search Recovery</h3>`;
    
    const sugBody = document.createElement("div");
    sugBody.style.padding = "14px 16px";
    sugBody.style.background = "#141418";
    sugBody.style.color = "#aaa";
    sugBody.style.fontSize = "11px";
    sugBody.style.lineHeight = "1.5";
    sugBody.style.overflowY = "auto";
    sugBody.style.flex = "1";
    
    const bodyTitle = document.createElement("div");
    bodyTitle.style.fontWeight = "bold";
    bodyTitle.style.marginBottom = "10px";
    bodyTitle.style.color = "#eee";
    bodyTitle.textContent = "Found the following replacement candidates in graph:";
    sugBody.appendChild(bodyTitle);
    
    const propList = document.createElement("div");
    propList.style.display = "flex";
    propList.style.flexDirection = "column";
    propList.style.gap = "6px";
    
    proposals.forEach(p => {
        const item = document.createElement("div");
        item.style.padding = "8px 10px";
        item.style.background = "rgba(56, 122, 255, 0.05)";
        item.style.border = "1px solid rgba(56, 122, 255, 0.15)";
        item.style.borderRadius = "4px";
        
        const repTitle = p.replacementNode.title || p.replacementNode.type || `Node ${p.replacementNode.id}`;
        item.innerHTML = `
            <div style="color: #ff8888; font-weight: 600; margin-bottom: 2px;">Replace Missing ID ${p.missingId} (${p.cachedTitle})</div>
            <div style="color: #88ff88; font-weight: 600;">➔ New Candidate: ${repTitle} (ID: ${p.replacementNode.id})</div>
            <div style="font-size: 9px; color: #555; margin-top: 4px; text-align: right;">Match Score: ${p.score}%</div>
        `;
        propList.appendChild(item);
    });
    sugBody.appendChild(propList);
    
    const sugFooter = document.createElement("div");
    sugFooter.className = "trix-picker-footer";
    
    const btnSugCancel = document.createElement("button");
    btnSugCancel.className = "trix-btn trix-btn-secondary";
    btnSugCancel.textContent = "Cancel";
    btnSugCancel.onclick = () => { suggestionOverlay.remove(); };
    
    const btnSugApply = document.createElement("button");
    btnSugApply.className = "trix-btn trix-btn-primary";
    btnSugApply.textContent = "Apply Recovery";
    btnSugApply.onclick = () => {
        const state = node.properties.trixBypasserState;
        let target;
        if (groupIndex === null || groupIndex === undefined) {
            target = state.targets[targetIndex];
        } else {
            target = state.groups[groupIndex].targets[targetIndex];
        }
        if (target) {
            let currentIds = target.value ? target.value.split(",").map(s => s.trim()).filter(Boolean) : [];
            proposals.forEach(p => {
                currentIds = currentIds.map(id => id === p.missingId ? String(p.replacementNode.id) : id);
            });
            target.value = currentIds.join(", ");
            _trixEnforceLogic(node);
            node.setDirtyCanvas(true, true);
        }
        suggestionOverlay.remove();
    };
    
    sugFooter.appendChild(btnSugCancel);
    sugFooter.appendChild(btnSugApply);
    
    suggestionModal.appendChild(sugHeader);
    suggestionModal.appendChild(sugBody);
    suggestionModal.appendChild(sugFooter);
    suggestionOverlay.appendChild(suggestionModal);
    
    suggestionOverlay.onclick = (e) => { if (e.target === suggestionOverlay) suggestionOverlay.remove(); };
    document.body.appendChild(suggestionOverlay);
}

function _trixShowWarningRecoveryModal(node, groupIndex, targetIndex) {
    const state = node.properties.trixBypasserState;
    let target;
    if (groupIndex === null || groupIndex === undefined) {
        target = state.targets[targetIndex];
    } else {
        target = state.groups[groupIndex].targets[targetIndex];
    }
    if (!target) return;
    
    const missingIds = [];
    const selectedIds = target.value ? target.value.split(",").map(s => s.trim()).filter(Boolean) : [];
    selectedIds.forEach(id => {
        if (!findNodeById(id)) {
            missingIds.push(id);
        }
    });
    
    if (missingIds.length === 0) return;
    
    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    modal.style.width = "340px";
    modal.style.maxHeight = "240px";
    
    const header = document.createElement("div");
    header.className = "trix-picker-header";
    
    const title = document.createElement("h3");
    title.className = "trix-picker-title";
    title.textContent = `Target Recovery: ${target.name || ('Target ' + (targetIndex + 1))}`;
    header.appendChild(title);
    
    const body = document.createElement("div");
    body.style.padding = "18px 16px";
    body.style.background = "#141418";
    body.style.color = "#ccc";
    body.style.fontSize = "11px";
    body.style.lineHeight = "1.5";
    
    const names = missingIds.map(id => {
        const cached = node.properties?.trixNodeCache?.[id];
        return cached ? `Node ${id} (${cached.title})` : `Node ${id}`;
    });
    body.innerHTML = `
        <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 8px;">⚠️ Missing targets detected:</div>
        <div style="font-family: monospace; color: #aaa; margin-bottom: 12px; background: #0c0c0f; padding: 6px; border-radius: 4px; max-height: 80px; overflow-y: auto;">
            ${names.join("<br>")}
        </div>
        <div>Choose an action to recover or clean up this target:</div>
    `;
    
    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";
    footer.style.justifyContent = "space-between";
    
    const btnCancel = document.createElement("button");
    btnCancel.className = "trix-btn trix-btn-secondary";
    btnCancel.textContent = "Cancel";
    btnCancel.onclick = () => { overlay.remove(); };
    
    const actionsRight = document.createElement("div");
    actionsRight.style.display = "flex";
    actionsRight.style.gap = "6px";
    
    const btnClear = document.createElement("button");
    btnClear.className = "trix-btn trix-btn-secondary";
    btnClear.style.color = "#ff8888";
    btnClear.style.background = "rgba(220, 76, 76, 0.1)";
    btnClear.textContent = "Clear Missing";
    btnClear.onclick = () => {
        let ids = selectedIds.filter(id => !missingIds.includes(id));
        target.value = ids.join(", ");
        _trixEnforceLogic(node);
        node.setDirtyCanvas(true, true);
        overlay.remove();
    };
    
    const btnRecover = document.createElement("button");
    btnRecover.className = "trix-btn trix-btn-primary";
    btnRecover.textContent = "Smart Search";
    btnRecover.onclick = () => {
        overlay.remove();
        _trixTriggerSmartSearchDirectly(node, groupIndex, targetIndex, missingIds);
    };
    
    actionsRight.appendChild(btnClear);
    actionsRight.appendChild(btnRecover);
    
    footer.appendChild(btnCancel);
    footer.appendChild(actionsRight);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

function _trixShowRenameModal(titleText, currentValue, onApply) {
    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeyDown);
        overlay.remove();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            const overlays = document.querySelectorAll(".trix-picker-overlay");
            if (overlays.length > 0 && overlays[overlays.length - 1] === overlay) {
                cleanup();
            }
        }
    };
    document.addEventListener("keydown", handleKeyDown);
    
    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    modal.style.width = "340px";
    modal.style.maxHeight = "220px";
    
    const header = document.createElement("div");
    header.className = "trix-picker-header";
    
    const title = document.createElement("h3");
    title.className = "trix-picker-title";
    title.textContent = titleText;
    header.appendChild(title);
    
    const body = document.createElement("div");
    body.style.padding = "18px 16px";
    body.style.background = "#141418";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "8px";
    
    const label = document.createElement("span");
    label.className = "trix-picker-manual-label";
    label.textContent = "Enter new name:";
    body.appendChild(label);
    
    const input = document.createElement("input");
    input.className = "trix-picker-manual-input";
    input.type = "text";
    input.value = currentValue;
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.fontFamily = "'Segoe UI', -apple-system, sans-serif";
    body.appendChild(input);
    
    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";
    
    const btnCancel = document.createElement("button");
    btnCancel.className = "trix-btn trix-btn-secondary";
    btnCancel.textContent = "Cancel";
    btnCancel.onclick = () => { cleanup(); };
    
    const btnApply = document.createElement("button");
    btnApply.className = "trix-btn trix-btn-primary";
    btnApply.textContent = "Apply";
    const applyValue = () => {
        const val = input.value.trim();
        if (val) {
            onApply(val);
        }
        cleanup();
    };
    btnApply.onclick = applyValue;
    
    footer.appendChild(btnCancel);
    footer.appendChild(btnApply);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    
    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            applyValue();
        }
    });
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
}

function _trixRenameGroup(node, groupIndex) {
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return;

    const state = node.properties.trixBypasserState;
    const group = state.groups[groupIndex];
    if (!group) return;

    _trixShowRenameModal(`Rename Group [${group.id}]`, group.name, (newName) => {
        group.name = newName;
        _trixEnforceLogic(node);
        node.setDirtyCanvas(true, true);
    });
}

function _trixRenameTarget(node, groupIndex, targetIndex) {
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return;

    const state = node.properties.trixBypasserState;
    let target;
    if (groupIndex === null || groupIndex === undefined) {
        target = state.targets[targetIndex];
    } else {
        const group = state.groups[groupIndex];
        if (!group) return;
        target = group.targets[targetIndex];
    }
    if (!target) return;

    const currentName = target.name || `Target ${targetIndex + 1}`;

    _trixShowRenameModal(`Rename Target ${targetIndex + 1}`, currentName, (newName) => {
        target.name = newName;
        node.setDirtyCanvas(true, true);
    });
}

function _trixMouseDown(node, e, pos) {
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return false;
    if (!node._trixHitAreas) return false;
    console.log("[Trix Bypasser] _trixMouseDown received pos:", pos, "hitAreas count:", node._trixHitAreas.length);
    
    const [px, py] = pos;
    const state = node.properties.trixBypasserState;
    const isSimple = (node.type === "TrixBypasserSimple");

    for (const area of node._trixHitAreas) {
        if (px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h) {
            
            // 1. Single / Multi Mode Switch
            if (area.type === "selectMode") {
                state.selectMode = area.mode;
                if (area.mode === "single") {
                    if (isSimple) {
                        let foundActive = false;
                        state.targets.forEach((t) => {
                            if (t.active && !foundActive) {
                                foundActive = true;
                            } else {
                                t.active = false;
                            }
                        });
                    } else {
                        let foundActive = false;
                        state.groups.forEach((g) => {
                            if (g.active && !foundActive) {
                                foundActive = true;
                            } else {
                                g.active = false;
                            }
                        });
                    }
                }
                _trixEnforceLogic(node);
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 2. Mute / Bypass Mode Switch
            if (area.type === "muteMode") {
                state.muteMode = area.mode;
                _trixEnforceLogic(node);
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 3. Add Group Button
            if (area.type === "addGroup") {
                state.groups.push({
                    id: area.letter,
                    name: `Group ${area.letter}`,
                    active: state.selectMode === "single" ? false : true,
                    collapsed: false,
                    targets: [
                        { value: "", active: true }
                    ]
                });
                _trixEnforceLogic(node);
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 3b. Add Simple Target Button
            if (area.type === "addSimpleTarget") {
                if (state.targets.length < 10) {
                    state.targets.push({
                        name: `Target ${state.targets.length + 1}`,
                        value: "",
                        active: state.selectMode === "single" ? false : true
                    });
                    _trixEnforceLogic(node);
                    node.setDirtyCanvas(true, true);
                }
                return true;
            }

            // 4. Toggle Delete Mode Button
            if (area.type === "toggleDeleteMode") {
                state.deleteMode = !state.deleteMode;
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 5. Expand / Collapse Group Row
            if (area.type === "toggleCollapse") {
                const group = state.groups[area.groupIndex];
                if (group) {
                    group.collapsed = !group.collapsed;
                    node.setDirtyCanvas(true, true);
                }
                return true;
            }

            // 6. Rename click checker (single click on group title)
            if (area.type === "groupTitle") {
                _trixRenameGroup(node, area.groupIndex);
                return true;
            }

            // 6b. Rename target label click (single click on target label)
            if (area.type === "renameTargetLabel") {
                if (isSimple) {
                    _trixRenameTarget(node, null, area.targetIndex);
                } else {
                    _trixRenameTarget(node, area.groupIndex, area.targetIndex);
                }
                return true;
            }

            // 7. Delete Group Button
            if (area.type === "deleteGroup") {
                state.groups.splice(area.groupIndex, 1);
                
                state.groups.forEach((g, idx) => {
                    const alphabet = "ABCDEFGHIJ";
                    const correctId = alphabet[idx] || String.fromCharCode(65 + idx);
                    
                    if (g.name === `Group ${g.id}`) {
                        g.name = `Group ${correctId}`;
                    }
                    g.id = correctId;
                });

                _trixEnforceLogic(node);
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 8. Toggle Group Active switch
            if (area.type === "toggleGroup") {
                const group = state.groups[area.groupIndex];
                if (group) {
                    group.active = !group.active;
                    
                    if (group.active && state.selectMode === "single") {
                        state.groups.forEach((g, idx) => {
                            if (idx !== area.groupIndex) {
                                g.active = false;
                            }
                        });
                    }
                    _trixEnforceLogic(node);
                    node.setDirtyCanvas(true, true);
                }
                return true;
            }

            // 9. Click Target box
            if (area.type === "clickTargetBox") {
                let target;
                if (isSimple) {
                    target = state.targets[area.targetIndex];
                } else {
                    const group = state.groups[area.groupIndex];
                    if (group) {
                        target = group.targets[area.targetIndex];
                    }
                }
                if (target) {
                    _trixShowPickerModal(node, target.value, (newVal) => {
                        target.value = newVal;
                        _trixEnforceLogic(node);
                        node.setDirtyCanvas(true, true);
                    });
                }
                return true;
            }

            // 10. Delete Target Row
            if (area.type === "deleteTarget") {
                if (isSimple) {
                    state.targets.splice(area.targetIndex, 1);
                    if (state.targets.length === 0) {
                        state.targets.push({ name: "Target 1", value: "", active: true });
                    }
                    state.targets.forEach((t, idx) => {
                        if (!t.name || /^Target \d+$/.test(t.name)) {
                            t.name = `Target ${idx + 1}`;
                        }
                    });
                    _trixEnforceLogic(node);
                    node.setDirtyCanvas(true, true);
                } else {
                    const group = state.groups[area.groupIndex];
                    if (group) {
                        group.targets.splice(area.targetIndex, 1);
                        if (group.targets.length === 0) {
                            group.targets.push({ value: "", active: true });
                        }
                        _trixEnforceLogic(node);
                        node.setDirtyCanvas(true, true);
                    }
                }
                return true;
            }

            // 11. Toggle Target Switch
            if (area.type === "toggleTarget") {
                let target;
                if (isSimple) {
                    target = state.targets[area.targetIndex];
                } else {
                    const group = state.groups[area.groupIndex];
                    if (group) {
                        target = group.targets[area.targetIndex];
                    }
                }
                if (target) {
                    target.active = !target.active;
                    if (target.active && state.selectMode === "single") {
                        if (isSimple) {
                            state.targets.forEach((t, idx) => {
                                if (idx !== area.targetIndex) {
                                    t.active = false;
                                }
                            });
                        }
                    }
                    _trixEnforceLogic(node);
                    node.setDirtyCanvas(true, true);
                }
                return true;
            }

            // 12. Add Target Row (+)
            if (area.type === "addTargetRow") {
                const group = state.groups[area.groupIndex];
                if (group && group.targets.length < 10) {
                    group.targets.push({ value: "", active: true });
                    node.setDirtyCanvas(true, true);
                }
                return true;
            }

            // 13. Click Target Warning (exclamation mark)
            if (area.type === "clickTargetWarning") {
                _trixShowWarningRecoveryModal(node, area.groupIndex, area.targetIndex);
                return true;
            }

            // 14. Jump to Target (Navigation)
            if (area.type === "jumpToTarget") {
                let target;
                if (isSimple) {
                    target = state.targets[area.targetIndex];
                } else {
                    const group = state.groups[area.groupIndex];
                    if (group) {
                        target = group.targets[area.targetIndex];
                    }
                }
                if (target && target.value) {
                    _trixJumpToNodes(target.value, e);
                }
                // Clear hover states immediately since the viewport shifts away from under the mouse
                node._trixHoveredJumpTargetIndex = -1;
                node._trixHoveredJumpGroupIndex = null;
                node._trixHoveredJumpGroupBtnIndex = -1;
                node.setDirtyCanvas(true, true);
                return true;
            }

            // 15. Jump to ALL Targets in Group
            if (area.type === "jumpToGroupTargets") {
                const group = state.groups[area.groupIndex];
                if (group && group.targets) {
                    const allIds = group.targets.map(t => t.value || "").filter(Boolean).join(", ");
                    _trixJumpToNodes(allIds, e);
                }
                // Clear hover states immediately since the viewport shifts away from under the mouse
                node._trixHoveredJumpTargetIndex = -1;
                node._trixHoveredJumpGroupIndex = null;
                node._trixHoveredJumpGroupBtnIndex = -1;
                node.setDirtyCanvas(true, true);
                return true;
            }

            return true;
        }
    }
    return false;
}

// =========================================================
function _trixHover(node, px, py) {
    let hoveredIndex = -1;
    let hoveredRenameIndex = -1;
    let hoveredRenameTargetIndex = -1;
    let hoveredRenameTargetGroupIndex = null;
    let hoveredJumpTargetIndex = -1;
    let hoveredJumpGroupIndex = null;
    let hoveredJumpGroupBtnIndex = -1;
    
    if (px !== -1 && py !== -1 && node._trixHitAreas) {
        for (const area of node._trixHitAreas) {
            if (px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h) {
                if (area.type === "renameTargetLabel") {
                    hoveredRenameTargetIndex = area.targetIndex;
                    hoveredRenameTargetGroupIndex = area.groupIndex !== undefined ? area.groupIndex : null;
                } else if (area.type === "jumpToTarget") {
                    hoveredJumpTargetIndex = area.targetIndex;
                    hoveredJumpGroupIndex = area.groupIndex !== undefined ? area.groupIndex : null;
                } else if (area.type === "jumpToGroupTargets") {
                    hoveredJumpGroupBtnIndex = area.groupIndex;
                } else if (area.type === "groupTitle") {
                    hoveredRenameIndex = area.groupIndex;
                    hoveredIndex = area.groupIndex;
                } else if (area.type === "toggleCollapse" || area.type === "toggleGroup" || area.type === "deleteGroup") {
                    hoveredIndex = area.groupIndex;
                }
            }
        }
    }

    let changed = false;
    if (node._trixHoveredGroupIndex !== hoveredIndex) {
        node._trixHoveredGroupIndex = hoveredIndex;
        changed = true;
    }
    if (node._trixHoveredRenameGroupIndex !== hoveredRenameIndex) {
        node._trixHoveredRenameGroupIndex = hoveredRenameIndex;
        changed = true;
    }
    if (node._trixHoveredRenameTargetIndex !== hoveredRenameTargetIndex) {
        node._trixHoveredRenameTargetIndex = hoveredRenameTargetIndex;
        changed = true;
    }
    if (node._trixHoveredRenameTargetGroupIndex !== hoveredRenameTargetGroupIndex) {
        node._trixHoveredRenameTargetGroupIndex = hoveredRenameTargetGroupIndex;
        changed = true;
    }
    if (node._trixHoveredJumpTargetIndex !== hoveredJumpTargetIndex) {
        node._trixHoveredJumpTargetIndex = hoveredJumpTargetIndex;
        changed = true;
    }
    if (node._trixHoveredJumpGroupIndex !== hoveredJumpGroupIndex) {
        node._trixHoveredJumpGroupIndex = hoveredJumpGroupIndex;
        changed = true;
    }
    if (node._trixHoveredJumpGroupBtnIndex !== hoveredJumpGroupBtnIndex) {
        node._trixHoveredJumpGroupBtnIndex = hoveredJumpGroupBtnIndex;
        changed = true;
    }
    if (changed) {
        node.setDirtyCanvas(true, true);
        const widget = node.widgets?.find(w => w.name === "trix_bypasser_control");
        widget?.triggerDraw?.();
    }
}

// =========================================================
// 7. COMPONENT SETUP AND REGISTRATION
// =========================================================
function _trixInitNode(node) {
    if (node._trixInitDone) return;
    node._trixInitDone = true;
    console.log("[Trix Bypasser] Initializing node:", node.id, node.type);

    node.properties = node.properties || {};
    const isSimple = (node.type === "TrixBypasserSimple");
    if (isSimple) {
        if (!node.properties.trixBypasserState) {
            node.properties.trixBypasserState = {
                version: 1,
                selectMode: "multi",
                muteMode: "bypass",
                deleteMode: false,
                targets: [
                    { name: "Target 1", value: "", active: true }
                ]
            };
        }
    } else {
        if (!node.properties.trixBypasserState) {
            node.properties.trixBypasserState = {
                version: 1,
                selectMode: "multi",
                muteMode: "bypass",
                deleteMode: false,
                groups: [
                    {
                        id: "A",
                        name: "Group A",
                        active: true,
                        collapsed: false,
                        targets: [
                            { value: "", active: true }
                        ]
                    }
                ]
            };
        }
    }
    if (!node.properties.trixBypasserOriginalModes) {
        node.properties.trixBypasserOriginalModes = {};
    }

    node.size = node.size || [320, 100];
    node.size[0] = Math.max(node.size[0], 300);
    
    // Add custom legacy widget for Nodes 2.0 rendering fallback
    node.widgets = node.widgets || [];
    let widget = node.widgets.find(w => w.name === "trix_bypasser_control");
    if (!widget) {
        widget = {
            type: "legacy",
            name: "trix_bypasser_control",
            value: {}
        };
    }
    
    // Always overwrite methods to keep them updated
    widget.draw = function(ctx, node, widget_width, y, widget_height) {
        console.log("[Trix Bypasser] widget draw called for node ID:", node?.id, "isVueMode:", !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode)));
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (!isVueMode) return; // Skip widget rendering in LiteGraph mode
        
        // Hook Vue mode hover and click listeners
        if (ctx.canvas && ctx.canvas !== app.canvas?.canvas && !ctx.canvas._trixHoverHooked) {
            ctx.canvas._trixHoverHooked = true;
            ctx.canvas.addEventListener("pointermove", (e) => {
                _trixHover(node, e.offsetX, e.offsetY);
            });
            ctx.canvas.addEventListener("pointerleave", () => {
                _trixHover(node, -1, -1);
            });
            ctx.canvas.addEventListener("pointerdown", (e) => {
                console.log("[Trix Bypasser] local canvas pointerdown:", e.offsetX, e.offsetY);
                const handled = _trixMouseDown(node, e, [e.offsetX, e.offsetY]);
                if (handled) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        }
        
        // Draw everything inside Vue widget canvas (startY = 0)
        if (node.type === "TrixBypasserSimple") {
            _trixDrawNodeSimple(node, ctx, widget_width, 0, widget_height);
        } else {
            _trixDrawNode(node, ctx, widget_width, 0, widget_height);
        }
    };
    
    widget.mouse = function(event, pos, node) {
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (!isVueMode) return false;
        return _trixMouseDown(node, event, pos);
    };
    
    widget.computeSize = function(width) {
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (!isVueMode) return [width, 0];
        return [width, node._trixNeededHeight || 100];
    };

    node.widgets.length = 0;
    node.widgets.push(widget);

    const origDraw = node.onDrawForeground;
    node.onDrawForeground = function(ctx) {
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (isVueMode) return; // Skip in Vue mode

        // Skip drawing when collapsed/hidden
        if (this.flags?.collapsed || this.collapsed || this.flags?.hidden) return;
        
        try {
            _trixDrawNode(this, ctx, this.size[0], 0, this.size[1]);
        } catch (e) {
            console.error("TrixBypasser draw error:", e);
        }
        if (origDraw) origDraw.apply(this, arguments);
    };

    const origDown = node.onMouseDown;
    node.onMouseDown = function(e, pos, canvas) {
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (isVueMode) return false; // Skip in Vue mode

        if (this.flags?.collapsed || this.collapsed || this.flags?.hidden) return false;
        
        try {
            if (_trixMouseDown(this, e, pos)) {
                return true;
            }
        } catch (err) {
            console.error("TrixBypasser click error:", err);
        }
        if (origDown) return origDown.apply(this, arguments);
    };

    // Double click handler removed to avoid conflicts since renaming is single-click.

    // Hover detection hook
    const origMouseMove = node.onMouseMove;
    node.onMouseMove = function(e, pos, canvas) {
        const isVueMode = !!(window.LiteGraph?.vueNodesMode || app.canvas?.vueNodesMode || (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode));
        if (isVueMode) return; // Skip in Vue mode

        if (this.flags?.collapsed || this.collapsed || this.flags?.hidden) return;
        
        _trixHover(this, pos[0], pos[1]);

        if (origMouseMove) origMouseMove.apply(this, arguments);
    };

    const origOnRemoved = node.onRemoved;
    node.onRemoved = function() {
        try {
            const lastTargeted = node._trixLastTargeted || new Map();
            for (const [id, oldMode] of lastTargeted.entries()) {
                const targetNode = findNodeById(id);
                if (targetNode) {
                    const orig = node.properties.trixBypasserOriginalModes[id] ?? 0;
                    targetNode.mode = orig;
                    if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
                }
            }
        } catch (e) {
            console.error("TrixBypasser restore on remove error:", e);
        }
        if (origOnRemoved) origOnRemoved.apply(this, arguments);
    };

    setTimeout(() => {
        try {
            _trixEnforceLogic(node);
        } catch(e) {}
    }, 200);
}

// =========================================================
// 8. LITEGRAPH CONTEXT MENU HOOKS & CLIPBOARD UTILITIES
// =========================================================
function _trixCopyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error("Failed to copy using clipboard API:", err);
            _trixFallbackCopyToClipboard(text);
        });
    } else {
        _trixFallbackCopyToClipboard(text);
    }
}

function _trixFallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
}

function _trixGetSelectedNodeIds() {
    const selectedNodes = [];
    const raw = app.canvas?.selected_nodes;
    if (raw && typeof raw === "object") {
        if (Array.isArray(raw)) {
            for (const item of raw) {
                const node = typeof item === "object" ? item : app.graph.getNodeById(item);
                if (node) selectedNodes.push(node);
            }
        } else {
            for (const [key, value] of Object.entries(raw)) {
                const node = value && typeof value === "object" ? value : app.graph.getNodeById(key);
                if (node) selectedNodes.push(node);
            }
        }
    }
    return selectedNodes.map(n => n.id);
}

function _trixHookContextMenus() {
    // 1. Canvas Context Menu
    const origGetCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function(event) {
        const options = origGetCanvasMenuOptions.apply(this, arguments) || [];
        
        const graphMouse = this.graph_mouse;
        let group = null;
        if (graphMouse && this.graph && this.graph._groups) {
            const x = graphMouse[0];
            const y = graphMouse[1];
            group = this.graph._groups.find(g => {
                return x >= g.pos[0] && x <= g.pos[0] + g.size[0] &&
                       y >= g.pos[1] && y <= g.pos[1] + g.size[1];
            });
        }
        
        const selectedIds = _trixGetSelectedNodeIds();
        
        let addedSeparator = false;
        const addSeparatorIfNeeded = () => {
            if (!addedSeparator) {
                options.push(null);
                addedSeparator = true;
            }
        };
        
        if (group) {
            group.recomputeInsideNodes();
            const nodesInGroup = group._nodes || [];
            if (nodesInGroup.length > 0) {
                addSeparatorIfNeeded();
                options.push({
                    content: `Copy Group Node IDs (${nodesInGroup.length})`,
                    callback: () => {
                        const ids = nodesInGroup.map(n => n.id).join(", ");
                        _trixCopyToClipboard(ids);
                    }
                });
            }
        }
        
        if (selectedIds.length > 1) {
            addSeparatorIfNeeded();
            options.push({
                content: `Copy Selected Node IDs (${selectedIds.length})`,
                callback: () => {
                    _trixCopyToClipboard(selectedIds.join(", "));
                }
            });
        }
        
        return options;
    };

    // 2. Node Context Menu
    const origGetNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions;
    LGraphCanvas.prototype.getNodeMenuOptions = function(node) {
        const options = origGetNodeMenuOptions.apply(this, arguments) || [];
        if (!node) return options;

        const showControlsToggle = app.ui.settings.getSettingValue("Trix.ContextMenu.ShowHideControls") !== false;
        if ((node.type === "TrixBypasser" || node.type === "TrixBypasserSimple") && showControlsToggle) {
            const hide = !!node.properties?.trixHideControls;
            options.unshift({
                content: hide ? "Show controls" : "Hide controls",
                callback: () => {
                    node.properties = node.properties || {};
                    node.properties.trixHideControls = !hide;
                    node.setDirtyCanvas(true, true);
                }
            });
        }

        const selectedIds = _trixGetSelectedNodeIds();
        
        const showCopyId = app.ui.settings.getSettingValue("Trix.ContextMenu.CopyNodeId") !== false;
        const showCopySelected = app.ui.settings.getSettingValue("Trix.ContextMenu.CopySelectedNodeIds") !== false;
        
        if (showCopyId || (showCopySelected && selectedIds.length > 1)) {
            options.push(null);
        }
        
        if (showCopyId) {
            options.push({
                content: `Copy Node ID (${node.id})`,
                callback: () => {
                    _trixCopyToClipboard(String(node.id));
                }
            });
        }
        
        if (showCopySelected && selectedIds.length > 1) {
            options.push({
                content: `Copy Selected Node IDs (${selectedIds.length})`,
                callback: () => {
                    _trixCopyToClipboard(selectedIds.join(", "));
                }
            });
        }
        
        return options;
    };
}

let _trixSubgraphHookDepth = 0;

function _trixHookSubgraphMethod(obj, methodName, hookLogic) {
    if (!obj || !obj[methodName]) return;
    if (obj[methodName]._trixHooked) return;

    const orig = obj[methodName];
    const newFn = function() {
        if (_trixSubgraphHookDepth > 0) {
            return orig.apply(this, arguments);
        }
        _trixSubgraphHookDepth++;
        try {
            return hookLogic.call(this, orig, arguments);
        } finally {
            _trixSubgraphHookDepth--;
        }
    };
    newFn._trixHooked = true;
    obj[methodName] = newFn;
}

function _trixHookConvertToSubgraph(orig, args) {
    const nodesSet = args[0];
    const originalIds = Array.from(nodesSet || []).map(n => String(n.id));

    const result = orig.apply(this, args);

    let subgraphNode = null;
    if (result) {
        if (result.node) {
            subgraphNode = result.node;
        } else if (result.type === "SubgraphNode" || result.subgraph) {
            subgraphNode = result;
        }
    }
    if (!subgraphNode) {
        const allNodes = this._nodes || this.nodes || [];
        subgraphNode = allNodes.find(n => n.subgraph && originalIds.some(oid => {
            const innerNodes = n.subgraph.nodes || n.subgraph._nodes || [];
            return innerNodes.some(inNode => String(inNode.id) === oid);
        }));
    }

    if (subgraphNode) {
        const subgraphNodeId = subgraphNode.id;
        const mapping = {};
        originalIds.forEach(oid => {
            mapping[oid] = `${subgraphNodeId}:${oid}`;
        });

        console.log("[Trix Bypasser] Subgraph convert mapping generated:", mapping);

        const allBypassers = _trixGetAllGraphNodes(this).filter(n => n.properties && n.properties.trixBypasserState);
        
        allBypassers.forEach(bypasser => {
            // If the bypasser is not in the current graph where conversion happened,
            // it means it was collapsed into the subgraph. We should not convert its targets.
            if (bypasser.graph !== this) return;

            if (!bypasser.properties || !bypasser.properties.trixBypasserState) return;
            const state = bypasser.properties.trixBypasserState;
            let changedAny = false;
            
            const updateValue = (val) => {
                if (!val || !val.trim()) return val;
                let ids = val.split(",").map(s => s.trim()).filter(Boolean);
                let changed = false;
                const newIds = ids.map(id => {
                    if (mapping[id]) {
                        changed = true;
                        return mapping[id];
                    }
                    return id;
                });
                if (changed) {
                    changedAny = true;
                    return newIds.join(", ");
                }
                return val;
            };

            if (state.targets) {
                state.targets.forEach(t => {
                    t.value = updateValue(t.value);
                });
            }
            if (state.groups) {
                state.groups.forEach(g => {
                    g.targets.forEach(t => {
                        t.value = updateValue(t.value);
                    });
                });
            }
            
            if (changedAny) {
                _trixEnforceLogic(bypasser);
                if (bypasser.setDirtyCanvas) bypasser.setDirtyCanvas(true, true);
            }
        });
    }

    return result;
}

function _trixHookUnpackSubgraph(orig, args) {
    const subgraphNode = args[0];
    const oldSubgraphId = subgraphNode.id;
    const innerNodes = subgraphNode.subgraph ? (subgraphNode.subgraph.nodes || subgraphNode.subgraph._nodes || []) : [];
    innerNodes.forEach(n => {
        n.properties = n.properties || {};
        n.properties._trixOldInnerId = String(n.id);
    });
    const oldNodeIdsAndTypes = innerNodes.map(n => ({
        innerId: String(n.id),
        type: n.type,
        title: n.title
    }));
    
    const mainNodeIdsBefore = new Set((this._nodes || this.nodes || []).map(n => n.id));

    const result = orig.apply(this, args);

    const mainNodesAfter = this._nodes || this.nodes || [];
    const newNodes = mainNodesAfter.filter(n => !mainNodeIdsBefore.has(n.id));

    const mapping = {};
    const matchedNewNodes = new Set();

    // First pass: try matching using the properties._trixOldInnerId
    newNodes.forEach(candidate => {
        const oldInnerId = candidate.properties?._trixOldInnerId;
        if (oldInnerId) {
            mapping[`${oldSubgraphId}:${oldInnerId}`] = String(candidate.id);
            matchedNewNodes.add(candidate);
            if (candidate.properties && candidate.properties.trixBypasserState) {
                candidate._trixIsUnpackedInner = true;
                candidate._trixUnpackedOldInnerId = oldInnerId;
            }
            delete candidate.properties._trixOldInnerId;
        }
    });

    // Second pass fallback: match remaining by type order
    let newIdx = 0;
    for (let i = 0; i < oldNodeIdsAndTypes.length; i++) {
        const oldInfo = oldNodeIdsAndTypes[i];
        const alreadyMatched = Array.from(matchedNewNodes).some(n => n._trixUnpackedOldInnerId === oldInfo.innerId);
        if (alreadyMatched) continue;

        while (newIdx < newNodes.length) {
            const candidate = newNodes[newIdx];
            newIdx++;
            if (matchedNewNodes.has(candidate)) continue;
            if (candidate.type === oldInfo.type) {
                mapping[`${oldSubgraphId}:${oldInfo.innerId}`] = String(candidate.id);
                matchedNewNodes.add(candidate);
                if (candidate.properties && candidate.properties.trixBypasserState) {
                    candidate._trixIsUnpackedInner = true;
                    candidate._trixUnpackedOldInnerId = oldInfo.innerId;
                }
                break;
            }
        }
    }

    console.log("[Trix Bypasser] Subgraph unpack mapping generated:", mapping);

    const allBypassers = _trixGetAllGraphNodes(this).filter(n => n.properties && n.properties.trixBypasserState);
    
    allBypassers.forEach(bypasser => {
        if (!bypasser.properties || !bypasser.properties.trixBypasserState) return;
        const state = bypasser.properties.trixBypasserState;
        let changedAny = false;
        
        const isUnpackedBypasser = !!bypasser._trixIsUnpackedInner;
        delete bypasser._trixIsUnpackedInner;
        delete bypasser._trixUnpackedOldInnerId;

        const updateValue = (val) => {
            if (!val || !val.trim()) return val;
            let ids = val.split(",").map(s => s.trim()).filter(Boolean);
            let changed = false;
            const newIds = ids.map(id => {
                if (mapping[id]) {
                    changed = true;
                    return mapping[id];
                }
                if (isUnpackedBypasser) {
                    const localHierarchicalId = `${oldSubgraphId}:${id}`;
                    if (mapping[localHierarchicalId]) {
                        changed = true;
                        return mapping[localHierarchicalId];
                    }
                }
                return id;
            });
            if (changed) {
                changedAny = true;
                return newIds.join(", ");
            }
            return val;
        };

        if (state.targets) {
            state.targets.forEach(t => {
                t.value = updateValue(t.value);
            });
        }
        if (state.groups) {
            state.groups.forEach(g => {
                g.targets.forEach(t => {
                    t.value = updateValue(t.value);
                });
            });
        }
        
        if (changedAny) {
            _trixEnforceLogic(bypasser);
            if (bypasser.setDirtyCanvas) bypasser.setDirtyCanvas(true, true);
        }
    });

    return result;
}

function _trixApplySubgraphHooks() {
    if (typeof LGraph !== "undefined" && LGraph.prototype) {
        _trixHookSubgraphMethod(LGraph.prototype, "unpackSubgraph", _trixHookUnpackSubgraph);
        _trixHookSubgraphMethod(LGraph.prototype, "convertToSubgraph", _trixHookConvertToSubgraph);
    }
    if (typeof app !== "undefined" && app.graph) {
        _trixHookSubgraphMethod(app.graph, "unpackSubgraph", _trixHookUnpackSubgraph);
        _trixHookSubgraphMethod(app.graph, "convertToSubgraph", _trixHookConvertToSubgraph);
    }
}

function _trixHookSubgraphMethods() {
    _trixApplySubgraphHooks();
}

app.registerExtension({
    name: "Trix.Bypasser",
    
    setup(app) {
        _trixHookContextMenus();
        _trixHookSubgraphMethods();
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "TrixBypasser" || nodeData.name === "TrixBypasserSimple") {
            const origCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = origCreated ? origCreated.apply(this, arguments) : undefined;
                _trixInitNode(this);
                return r;
            };
        }
    },

    async afterConfigureGraph() {
        _trixApplySubgraphHooks();
        if (app.graph && app.graph._nodes) {
            for (const node of app.graph._nodes) {
                if (node.type === "TrixBypasser" || node.type === "TrixBypasserSimple") {
                    _trixInitNode(node);
                    try {
                        _trixEnforceLogic(node);
                    } catch(e) {}
                }
            }
        }
    }
});
