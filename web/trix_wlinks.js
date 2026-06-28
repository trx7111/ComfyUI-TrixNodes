import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// Keep track of the currently executing node
let runningNodeId = null;
api.addEventListener("executing", ({ detail }) => {
    runningNodeId = detail;
});

// Helper to get currently executing node ID
function getRunningNodeId() {
    return runningNodeId || app.runningNodeId;
}

// Map settings UI text to internal settings keys
function getColorValue(settingVal) {
    const map = {
        "Cyan/Blue (Default)": "#00b4d8",
        "Match Slot Color": "slot_color",
        "Sunset Red/Coral": "#ff5e62",
        "Neon Orange": "#ff9900",
        "Gold/Yellow": "#ffd700",
        "Neon Green": "#00e676",
        "Bright Cyan": "#00b4d8",
        "Vibrant Blue": "#2979ff",
        "Soft Purple": "#b388ff",
        "Neon Magenta": "#e040fb",
        "Pure White": "#ffffff",
        "Neutral Grey": "#808080"
    };
    return map[settingVal] || "#00b4d8";
}

function getAnimStyle(settingVal) {
    const map = {
        "Pulsation (Pulse)": "pulse",
        "Color Flow (Out-In-Out)": "color_flow",
        "Jelly/Water Wave Warping": "jelly",
        "Neon Plasma Flow": "plasma",
        "Sparkling Electricity": "spark",
        "Floating Particles": "particles",
        "Static (No Animation)": "static"
    };
    return map[settingVal] || "pulse";
}

function getShowMode(settingVal) {
    const map = {
        "Hide Always": "none",
        "Show on Click / Selection": "click",
        "Show on Hover": "hover"
    };
    return map[settingVal] || "none";
}

// Helper to check if a link should be hidden
function isLinkHidden(link, graph) {
    if (!link) return false;
    const originNode = graph.getNodeById(link.origin_id);
    const targetNode = graph.getNodeById(link.target_id);
    
    const originHidden = originNode && originNode.properties && originNode.properties.trix_wlinks_hidden === true;
    const targetHidden = targetNode && targetNode.properties && targetNode.properties.trix_wlinks_hidden === true;
    
    const originShown = originNode && originNode.properties && originNode.properties.trix_wlinks_hidden === false;
    const targetShown = targetNode && targetNode.properties && targetNode.properties.trix_wlinks_hidden === false;
    
    // If one node is hidden and the other is explicitly shown, let the most recently clicked action take priority.
    if (originHidden && targetShown) {
        const originTime = (originNode.properties && originNode.properties.trix_wlinks_updated) || 0;
        const targetTime = (targetNode.properties && targetNode.properties.trix_wlinks_updated) || 0;
        return originTime > targetTime; // Hide if origin hide clicked after target show
    }
    if (targetHidden && originShown) {
        const originTime = (originNode.properties && originNode.properties.trix_wlinks_updated) || 0;
        const targetTime = (targetNode.properties && targetNode.properties.trix_wlinks_updated) || 0;
        return targetTime > originTime; // Hide if target hide clicked after origin show
    }
    
    // Default: hide if either node wants to hide its links (trix_wlinks_hidden === true)
    if (originHidden || targetHidden) {
        return true;
    }
    
    return false;
}

// Helper to check if an input slot has a hidden connection
function isInputSlotHidden(node, slotIndex, graph) {
    if (!node.inputs || !node.inputs[slotIndex]) return false;
    const linkId = node.inputs[slotIndex].link;
    if (linkId == null) return false;
    const link = graph.links[linkId];
    return isLinkHidden(link, graph);
}

// Helper to check if an output slot has any hidden connection
function isOutputSlotHidden(node, slotIndex, graph) {
    if (!node.outputs || !node.outputs[slotIndex]) return false;
    const linkIds = node.outputs[slotIndex].links;
    if (!linkIds || linkIds.length === 0) return false;
    for (const linkId of linkIds) {
        const link = graph.links[linkId];
        if (isLinkHidden(link, graph)) {
            return true;
        }
    }
    return false;
}

// Helper to get slot type color
function getSlotColor(node, isInput, slotIndex) {
    const slot = isInput ? node.inputs[slotIndex] : node.outputs[slotIndex];
    if (!slot) return "#00b4d8";
    
    if (slot.color) return slot.color;
    
    const type = slot.type;
    if (window.LiteGraph && LiteGraph.LINK_TYPE_COLORS && LiteGraph.LINK_TYPE_COLORS[type]) {
        return LiteGraph.LINK_TYPE_COLORS[type];
    }
    if (window.LGraphCanvas && LGraphCanvas.link_type_colors && LGraphCanvas.link_type_colors[type]) {
        return LGraphCanvas.link_type_colors[type];
    }
    
    const upperType = String(type).toUpperCase();
    const fallbacks = {
        "MODEL": "#800080",
        "LATENT": "#ff8c00",
        "VAE": "#ff1493",
        "CLIP": "#00ff00",
        "IMAGE": "#00ffff",
        "MASK": "#1e90ff",
        "CONDITIONING": "#ffd700"
    };
    return fallbacks[upperType] || "#00b4d8";
}

// Convert hex color to rgba helper (with caching to prevent high CPU overhead)
const hexColorCache = {};
function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(0, 180, 216, ${alpha})`;
    const cacheKey = hex + "_" + alpha;
    if (hexColorCache[cacheKey]) return hexColorCache[cacheKey];
    
    let result = `rgba(0, 180, 216, ${alpha})`;
    if (hex.startsWith("rgba")) {
        result = hex;
    } else if (hex.startsWith("#")) {
        let c = hex.substring(1);
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        if (c.length === 6) {
            const num = parseInt(c, 16);
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            result = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }
    hexColorCache[cacheKey] = result;
    return result;
}

// Helper to get bezier points for custom path rendering
function getBezierPoints(ax, ay, bx, by, cp1x, cp1y, cp2x, cp2y, steps = 30) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt*mt*mt * ax + 3 * mt*mt * t * cp1x + 3 * mt * t*t * cp2x + t*t*t * bx;
        const y = mt*mt*mt * ay + 3 * mt*mt * t * cp1y + 3 * mt * t*t * cp2y + t*t*t * by;
        points.push({ x, y, t });
    }
    return points;
}

// Helper to draw custom HUD slot indicators based on settings
function drawExtraSlotCircle(ctx, node, pos, isInput, slotIndex) {
    const localX = pos[0] - node.pos[0];
    const localY = pos[1] - node.pos[1];
    
    ctx.save();
    
    const slotRadius = (window.LiteGraph && LiteGraph.NODE_SLOT_RADIUS) || 5;
    
    // Retrieve setting configurations
    const shapeSetting = app.ui.settings.getSettingValue("Trix.WLinks.Shape", "Dashed Circle");
    const shape = shapeSetting === "WiFi Icon" ? "wifi" : shapeSetting.toLowerCase().replace(" ", "_");
    
    const colorModeSetting = app.ui.settings.getSettingValue("Trix.WLinks.ColorMode", "Cyan/Blue (Default)");
    const colorMode = getColorValue(colorModeSetting);
    
    let color = "#00b4d8";
    if (colorMode === "slot_color") {
        color = getSlotColor(node, isInput, slotIndex);
    } else {
        color = colorMode;
    }
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    
    if (shape === "circle" || shape === "dashed_circle") {
        // Draw outer ring
        ctx.beginPath();
        ctx.arc(localX, localY, slotRadius + 4.5, 0, Math.PI * 2);
        if (shape === "dashed_circle") {
            ctx.setLineDash([2, 2]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.stroke();
        
        // Draw inner thin semi-transparent guide ring
        ctx.beginPath();
        ctx.arc(localX, localY, slotRadius + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(color, 0.4);
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
    } else if (shape === "triangle") {
        ctx.setLineDash([]);
        const r = slotRadius + 4.5;
        ctx.beginPath();
        if (isInput) {
            // Pointing left
            ctx.moveTo(localX - r, localY);
            ctx.lineTo(localX + r * 0.5, localY - r * 0.86);
            ctx.lineTo(localX + r * 0.5, localY + r * 0.86);
        } else {
            // Pointing right
            ctx.moveTo(localX + r, localY);
            ctx.lineTo(localX - r * 0.5, localY - r * 0.86);
            ctx.lineTo(localX - r * 0.5, localY + r * 0.86);
        }
        ctx.closePath();
        ctx.stroke();
    } else if (shape === "wifi") {
        ctx.setLineDash([]);
        // Center dot
        ctx.beginPath();
        ctx.arc(localX, localY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        const startAngle = isInput ? Math.PI * 0.75 : -Math.PI * 0.25;
        const endAngle = isInput ? Math.PI * 1.25 : Math.PI * 0.25;
        
        // First arc
        ctx.beginPath();
        ctx.arc(localX, localY, slotRadius + 1.5, startAngle, endAngle);
        ctx.stroke();
        
        // Second arc
        ctx.beginPath();
        ctx.arc(localX, localY, slotRadius + 5, startAngle, endAngle);
        ctx.stroke();
    }
    
    ctx.restore();
}

app.registerExtension({
    name: "Trix.WLinks",
    
    init() {
        // Register ComfyUI custom settings under "Trix Nodes" category
        if (app.ui && app.ui.settings) {
            app.ui.settings.addSetting({
                id: "Trix.WLinks.Shape",
                name: "Slot Indicator Shape",
                category: ["Trix Nodes", "WLinks", "Shape"],
                type: "combo",
                defaultValue: "WiFi Icon",
                options: ["Dashed Circle", "Circle", "Triangle", "WiFi Icon"],
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.WLinks.ColorMode",
                name: "Color Mode",
                category: ["Trix Nodes", "WLinks", "ColorMode"],
                type: "combo",
                defaultValue: "Match Slot Color",
                options: [
                    "Cyan/Blue (Default)", 
                    "Match Slot Color", 
                    "Sunset Red/Coral", 
                    "Neon Orange", 
                    "Gold/Yellow", 
                    "Neon Green", 
                    "Bright Cyan", 
                    "Vibrant Blue", 
                    "Soft Purple", 
                    "Neon Magenta", 
                    "Pure White", 
                    "Neutral Grey"
                ],
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.WLinks.LiveAnim",
                name: "Live Animation during Generation",
                category: ["Trix Nodes", "WLinks", "LiveAnim"],
                type: "boolean",
                defaultValue: true,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.WLinks.AnimType",
                name: "Animation Style",
                category: ["Trix Nodes", "WLinks", "AnimType"],
                type: "combo",
                defaultValue: "Static (No Animation)",
                options: [
                    "Pulsation (Pulse)", 
                    "Color Flow (Out-In-Out)", 
                    "Jelly/Water Wave Warping", 
                    "Neon Plasma Flow", 
                    "Sparkling Electricity", 
                    "Floating Particles", 
                    "Static (No Animation)"
                ],
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.WLinks.ShowMode",
                name: "Wire Display Mode",
                category: ["Trix Nodes", "WLinks", "ShowMode"],
                type: "combo",
                defaultValue: "Show on Hover",
                options: ["Hide Always", "Show on Click / Selection", "Show on Hover"],
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.WLinks.SmoothGPU",
                name: "Smooth animations (GPU-heavy)",
                category: ["Trix Nodes", "WLinks", "SmoothGPU"],
                type: "boolean",
                defaultValue: false,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            // Register Context Menu Settings
            app.ui.settings.addSetting({
                id: "Trix.ContextMenu.ShowHideLinks",
                name: "Show/Hide links",
                category: ["Trix Nodes", "Context Menu", "ShowHideLinks"],
                type: "boolean",
                defaultValue: true,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.ContextMenu.CopyNodeId",
                name: "Copy Node ID",
                category: ["Trix Nodes", "Context Menu", "CopyNodeId"],
                type: "boolean",
                defaultValue: true,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.ContextMenu.CopySelectedNodeIds",
                name: "Copy Selected Node IDs",
                category: ["Trix Nodes", "Context Menu", "CopySelectedNodeIds"],
                type: "boolean",
                defaultValue: true,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });

            app.ui.settings.addSetting({
                id: "Trix.ContextMenu.ShowHideControls",
                name: "Show/Hide Bypasser controls",
                category: ["Trix Nodes", "Context Menu", "ShowHideControls"],
                type: "boolean",
                defaultValue: true,
                onChange() {
                    if (app.canvas) app.canvas.draw(true, true);
                }
            });
        }

        // Intercept link rendering and slot drawing
        if (window.LiteGraph && window.LiteGraph.LGraphCanvas) {
            const LGraphCanvas = window.LiteGraph.LGraphCanvas;
            
            // Add safety guard to prevent double patching in case of hot-reload
            if (!LGraphCanvas.prototype._trixWLinksPatched) {
                LGraphCanvas.prototype._trixWLinksPatched = true;
                
                // Hook renderLink to hide wires and draw animations
                const origRenderLink = LGraphCanvas.prototype.renderLink;
                LGraphCanvas.prototype.renderLink = function(
                    ctx, a, b, link, skip_border, flow, color, start_dir, end_dir, num_sublines
                ) {
                    if (!link || link.id === undefined || link.id === null || !app.graph) {
                        return origRenderLink.apply(this, arguments);
                    }
                    
                    const isHidden = isLinkHidden(link, app.graph);
                    
                    // Determine visibility override rules
                    const isLiveAnimEnabled = app.ui.settings.getSettingValue("Trix.WLinks.LiveAnim") !== false;
                    const activeNodeId = getRunningNodeId();
                    
                    const isExecutingLink = activeNodeId && (String(link.origin_id) == String(activeNodeId) || String(link.target_id) == String(activeNodeId));
                    
                    const showModeSetting = app.ui.settings.getSettingValue("Trix.WLinks.ShowMode", "Hide Always");
                    const showMode = getShowMode(showModeSetting);
                    let shouldShowTemporarily = false;
                    
                    if (isLiveAnimEnabled && isExecutingLink) {
                        shouldShowTemporarily = true;
                    }
                    
                    if (!shouldShowTemporarily && showMode === "click" && this.selected_nodes) {
                        if (this.selected_nodes[link.origin_id] || this.selected_nodes[String(link.origin_id)] ||
                            this.selected_nodes[link.target_id] || this.selected_nodes[String(link.target_id)]) {
                            shouldShowTemporarily = true;
                        }
                    }
                    
                    if (!shouldShowTemporarily && showMode === "hover" && this.node_over) {
                        if (String(this.node_over.id) == String(link.origin_id) || String(this.node_over.id) == String(link.target_id)) {
                            shouldShowTemporarily = true;
                        }
                    }
                    
                    if (isHidden && !shouldShowTemporarily) {
                        return; // Skip rendering completely (hidden)
                    }
                    
                    // Draw animated connection if temporarily shown (executing, hover or click)
                    if (shouldShowTemporarily) {
                        const animSetting = app.ui.settings.getSettingValue("Trix.WLinks.AnimType", "Pulsation (Pulse)");
                        const animStyle = getAnimStyle(animSetting);
                        const linkColor = color || "#00b4d8";
                        
                        if (animStyle === "static") {
                            return origRenderLink.apply(this, arguments);
                        }
                        
                        // Custom drawing code path to bypass LiteGraph internal stroke overrides
                        const ax = a[0];
                        const ay = a[1];
                        const bx = b[0];
                        const by = b[1];
                        
                        let cp1x = ax;
                        let cp1y = ay;
                        let cp2x = bx;
                        let cp2y = by;
                        
                        const dx = bx - ax;
                        const dy = by - ay;
                        const diff = Math.sqrt(dx*dx + dy*dy);
                        const offset = Math.min(100, diff * 0.5);
                        
                        let s_dir = start_dir;
                        let e_dir = end_dir;
                        if (s_dir === undefined || s_dir === null) s_dir = window.LiteGraph ? LiteGraph.RIGHT : 1;
                        if (e_dir === undefined || e_dir === null) e_dir = window.LiteGraph ? LiteGraph.LEFT : 2;
                        
                        const DIR_RIGHT = window.LiteGraph ? LiteGraph.RIGHT : 1;
                        const DIR_LEFT = window.LiteGraph ? LiteGraph.LEFT : 2;
                        const DIR_UP = window.LiteGraph ? LiteGraph.UP : 3;
                        const DIR_DOWN = window.LiteGraph ? LiteGraph.DOWN : 4;
                        
                        if (s_dir === DIR_RIGHT) cp1x += offset;
                        else if (s_dir === DIR_LEFT) cp1x -= offset;
                        else if (s_dir === DIR_UP) cp1y -= offset;
                        else if (s_dir === DIR_DOWN) cp1y += offset;
                        
                        if (e_dir === DIR_RIGHT) cp2x += offset;
                        else if (e_dir === DIR_LEFT) cp2x -= offset;
                        else if (e_dir === DIR_UP) cp2y -= offset;
                        else if (e_dir === DIR_DOWN) cp2y += offset;
                        
                        // Performance optimization: sample fewer points to reduce computation overhead
                        const points = getBezierPoints(ax, ay, bx, by, cp1x, cp1y, cp2x, cp2y, animStyle === "jelly" ? 30 : 15);
                        
                        if (animStyle === "pulse") {
                            ctx.save();
                            const t = Date.now() * 0.008;
                            const baseWidth = 2.5;
                            const pulse = Math.sin(t) * 1.5;
                            const width = Math.max(1, baseWidth + pulse);
                            
                            // Multi-stroke glow simulation: draw a thick transparent stroke underneath a thin core
                            ctx.lineWidth = width + 4.0;
                            ctx.strokeStyle = hexToRgba(linkColor, 0.25 + Math.sin(t) * 0.1);
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            
                            ctx.lineWidth = width;
                            ctx.strokeStyle = linkColor;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            ctx.restore();
                            return;
                        } else if (animStyle === "color_flow") {
                            ctx.save();
                            const grad = ctx.createLinearGradient(ax, ay, bx, by);
                            const time = (Date.now() * 0.003) % (2 * Math.PI);
                            const flowPos = (Math.sin(time) + 1) / 2;
                            
                            grad.addColorStop(0, linkColor);
                            grad.addColorStop(Math.max(0, flowPos - 0.15), linkColor);
                            grad.addColorStop(flowPos, "#ffffff");
                            grad.addColorStop(Math.min(1, flowPos + 0.15), linkColor);
                            grad.addColorStop(1, linkColor);
                            
                            // Multi-stroke glow gradient
                            const glowGrad = ctx.createLinearGradient(ax, ay, bx, by);
                            glowGrad.addColorStop(0, hexToRgba(linkColor, 0.2));
                            glowGrad.addColorStop(Math.max(0, flowPos - 0.2), hexToRgba(linkColor, 0.2));
                            glowGrad.addColorStop(flowPos, "rgba(255, 255, 255, 0.6)");
                            glowGrad.addColorStop(Math.min(1, flowPos + 0.2), hexToRgba(linkColor, 0.2));
                            glowGrad.addColorStop(1, hexToRgba(linkColor, 0.2));
                            
                            ctx.lineWidth = 6.5;
                            ctx.strokeStyle = glowGrad;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            
                            ctx.lineWidth = 2.5;
                            ctx.strokeStyle = grad;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            ctx.restore();
                            return;
                        } else if (animStyle === "jelly") {
                            ctx.save();
                            
                            // 1. Draw glowing wave underlay
                            ctx.strokeStyle = hexToRgba(linkColor, 0.2);
                            ctx.lineWidth = 6.0;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                const pt = points[i];
                                const prevPt = points[i - 1];
                                let x = pt.x;
                                let y = pt.y;
                                const segmentDx = pt.x - prevPt.x;
                                const segmentDy = pt.y - prevPt.y;
                                const angle = Math.atan2(segmentDy, segmentDx === 0 ? 1 : segmentDx) + Math.PI / 2;
                                const t = pt.t;
                                const freq1 = 10;
                                const freq2 = 5;
                                const speed1 = 0.008;
                                const speed2 = 0.012;
                                const amp1 = 5;
                                const amp2 = 2.5;
                                const w1 = Math.sin(t * freq1 - Date.now() * speed1) * amp1;
                                const w2 = Math.cos(t * freq2 - Date.now() * speed2) * amp2;
                                const fade = Math.sin(t * Math.PI);
                                const totalWave = (w1 + w2) * fade;
                                x += Math.cos(angle) * totalWave;
                                y += Math.sin(angle) * totalWave;
                                ctx.lineTo(x, y);
                            }
                            ctx.stroke();
                            
                            // 2. Draw core wave
                            ctx.strokeStyle = linkColor;
                            ctx.lineWidth = 2.5;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                const pt = points[i];
                                const prevPt = points[i - 1];
                                let x = pt.x;
                                let y = pt.y;
                                const segmentDx = pt.x - prevPt.x;
                                const segmentDy = pt.y - prevPt.y;
                                const angle = Math.atan2(segmentDy, segmentDx === 0 ? 1 : segmentDx) + Math.PI / 2;
                                const t = pt.t;
                                const freq1 = 10;
                                const freq2 = 5;
                                const speed1 = 0.008;
                                const speed2 = 0.012;
                                const amp1 = 5;
                                const amp2 = 2.5;
                                const w1 = Math.sin(t * freq1 - Date.now() * speed1) * amp1;
                                const w2 = Math.cos(t * freq2 - Date.now() * speed2) * amp2;
                                const fade = Math.sin(t * Math.PI);
                                const totalWave = (w1 + w2) * fade;
                                x += Math.cos(angle) * totalWave;
                                y += Math.sin(angle) * totalWave;
                                ctx.lineTo(x, y);
                            }
                            ctx.stroke();
                            ctx.restore();
                            return;
                        } else if (animStyle === "plasma") {
                            ctx.save();
                            const grad = ctx.createLinearGradient(ax, ay, bx, by);
                            const timeOffset = Date.now() * 0.15;
                            for (let i = 0; i <= 5; i++) {
                                const stop = i / 5;
                                const hue = (timeOffset - stop * 360) % 360;
                                grad.addColorStop(stop, `hsl(${hue}, 100%, 60%)`);
                            }
                            
                            // Multi-stroke glow: draw with global opacity for GPU efficiency
                            ctx.lineWidth = 7.0;
                            ctx.globalAlpha = 0.25;
                            ctx.strokeStyle = grad;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            
                            ctx.lineWidth = 3.0;
                            ctx.globalAlpha = 1.0;
                            ctx.strokeStyle = grad;
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            ctx.restore();
                            return;
                        } else if (animStyle === "spark") {
                            ctx.save();
                            // Base wire
                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = hexToRgba(linkColor, 0.4);
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            
                            // Sparks
                            ctx.lineWidth = 2.5;
                            ctx.strokeStyle = "#ffffff";
                            ctx.shadowColor = "#00e5ff";
                            ctx.shadowBlur = 10;
                            
                            const speed = 0.005;
                            const len = 0.12;
                            const timeSeed = Date.now() * speed;
                            
                            for (let sparkIdx = 0; sparkIdx < 2; sparkIdx++) {
                                const startT = (timeSeed + sparkIdx * 0.5) % 1.2 - 0.2;
                                
                                // 1. Spark outer glow
                                ctx.lineWidth = 5.5;
                                ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
                                ctx.beginPath();
                                let started = false;
                                for (let i = 0; i < points.length; i++) {
                                    const pt = points[i];
                                    const t = pt.t;
                                    if (t >= startT && t <= startT + len) {
                                        const jitterFreq = 150;
                                        const jitterAmp = 2.0;
                                        const offsetVal = Math.sin(t * jitterFreq + Date.now() * 0.05) * jitterAmp;
                                        const angle = Math.cos(t * jitterFreq + Date.now() * 0.05) * Math.PI * 2;
                                        const ox = Math.cos(angle) * offsetVal;
                                        const oy = Math.sin(angle) * offsetVal;
                                        
                                        if (!started) {
                                            ctx.moveTo(pt.x + ox, pt.y + oy);
                                            started = true;
                                        } else {
                                            ctx.lineTo(pt.x + ox, pt.y + oy);
                                        }
                                    }
                                }
                                ctx.stroke();
                                
                                // 2. Spark core (white)
                                ctx.lineWidth = 2.0;
                                ctx.strokeStyle = "#ffffff";
                                ctx.beginPath();
                                started = false;
                                for (let i = 0; i < points.length; i++) {
                                    const pt = points[i];
                                    const t = pt.t;
                                    if (t >= startT && t <= startT + len) {
                                        const jitterFreq = 150;
                                        const jitterAmp = 2.0;
                                        const offsetVal = Math.sin(t * jitterFreq + Date.now() * 0.05) * jitterAmp;
                                        const angle = Math.cos(t * jitterFreq + Date.now() * 0.05) * Math.PI * 2;
                                        const ox = Math.cos(angle) * offsetVal;
                                        const oy = Math.sin(angle) * offsetVal;
                                        
                                        if (!started) {
                                            ctx.moveTo(pt.x + ox, pt.y + oy);
                                            started = true;
                                        } else {
                                            ctx.lineTo(pt.x + ox, pt.y + oy);
                                        }
                                    }
                                }
                                ctx.stroke();
                            }
                            ctx.restore();
                            return;
                        } else if (animStyle === "particles") {
                            ctx.save();
                            // Base wire
                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = hexToRgba(linkColor, 0.4);
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                            
                            // Particles
                            const speed = 0.0015;
                            const numParticles = 4;
                            
                            for (let p = 0; p < numParticles; p++) {
                                const t = (Date.now() * speed + p / numParticles) % 1;
                                const mt = 1 - t;
                                const x = mt*mt*mt * ax + 3 * mt*mt * t * cp1x + 3 * mt * t*t * cp2x + t*t*t * bx;
                                const y = mt*mt*mt * ay + 3 * mt*mt * t * cp1y + 3 * mt * t*t * cp2y + t*t*t * by;
                                
                                // Outer glow dot
                                ctx.fillStyle = hexToRgba(linkColor, 0.3);
                                ctx.beginPath();
                                ctx.arc(x, y, 7.5, 0, Math.PI * 2);
                                ctx.fill();
                                
                                // Core white dot
                                ctx.fillStyle = "#ffffff";
                                ctx.beginPath();
                                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                                ctx.fill();
                            }
                            ctx.restore();
                            return;
                        }
                    }
                    
                    return origRenderLink.apply(this, arguments);
                };
                
                // Hook drawNode to render custom HUD slot indicators
                const origDrawNode = LGraphCanvas.prototype.drawNode;
                LGraphCanvas.prototype.drawNode = function(node, ctx) {
                    origDrawNode.apply(this, arguments);
                    
                    if (node.flags && node.flags.collapsed) {
                        return;
                    }
                    
                    if (node.inputs && app.graph && typeof node.getConnectionPos === "function") {
                        for (let i = 0; i < node.inputs.length; ++i) {
                            if (isInputSlotHidden(node, i, app.graph)) {
                                const pos = node.getConnectionPos(true, i);
                                if (pos) {
                                    drawExtraSlotCircle(ctx, node, pos, true, i);
                                }
                            }
                        }
                    }
                    if (node.outputs && app.graph && typeof node.getConnectionPos === "function") {
                        for (let i = 0; i < node.outputs.length; ++i) {
                            if (isOutputSlotHidden(node, i, app.graph)) {
                                const pos = node.getConnectionPos(false, i);
                                if (pos) {
                                    drawExtraSlotCircle(ctx, node, pos, false, i);
                                }
                            }
                        }
                    }
                };
            }
        }
        
        // Start animation frame loop with dynamically throttled FPS based on settings
        let animFrameId = null;
        let lastRedrawTime = 0;
        
        function animLoop(timestamp) {
            const isLiveAnimEnabled = app.ui.settings.getSettingValue("Trix.WLinks.LiveAnim") !== false;
            const activeNode = getRunningNodeId();
            const showModeSetting = app.ui.settings.getSettingValue("Trix.WLinks.ShowMode", "Show on Hover");
            const showMode = getShowMode(showModeSetting);
            const animSetting = app.ui.settings.getSettingValue("Trix.WLinks.AnimType", "Static (No Animation)");
            const animStyle = getAnimStyle(animSetting);
            const smoothGpu = app.ui.settings.getSettingValue("Trix.WLinks.SmoothGPU") === true;
            
            let shouldRedraw = false;
            
            if (animStyle !== "static") {
                if (activeNode && isLiveAnimEnabled) {
                    shouldRedraw = true;
                } else if (app.canvas) {
                    if (showMode === "hover" && app.canvas.node_over) {
                        shouldRedraw = true;
                    } else if (showMode === "click" && app.canvas.selected_nodes && Object.keys(app.canvas.selected_nodes).length > 0) {
                        shouldRedraw = true;
                    }
                }
            }
            
            if (shouldRedraw && app.canvas) {
                if (smoothGpu) {
                    // Maximum smoothness: draw both foreground and background canvas on every requestAnimationFrame tick
                    app.canvas.draw(true, true);
                } else {
                    // Resource saving mode: throttle background and foreground redraw to ~15 FPS
                    const now = timestamp || performance.now();
                    const elapsed = now - lastRedrawTime;
                    const frameTime = 1000 / 15;
                    if (elapsed >= frameTime) {
                        app.canvas.draw(true, true);
                        lastRedrawTime = now - (elapsed % frameTime);
                    }
                }
            }
            animFrameId = requestAnimationFrame(animLoop);
        }
        animLoop();
    },
    
    getNodeMenuItems(node) {
        // Hook setting to show/hide links menu option
        const showLinksMenu = app.ui.settings.getSettingValue("Trix.ContextMenu.ShowHideLinks") !== false;
        if (!showLinksMenu) return [];
        
        if (!node) return [];
        
        node.properties = node.properties || {};
        const isHidden = !!node.properties.trix_wlinks_hidden;
        
        return [
            {
                content: isHidden ? "🌊 Trix Show Links" : "🌊 Trix Hide Links",
                callback: () => {
                    const nextHidden = !isHidden;
                    const canvas = app.canvas;
                    const selectedNodes = canvas && canvas.selected_nodes;
                    const now = Date.now();
                    
                    if (selectedNodes && selectedNodes[node.id]) {
                        for (const id in selectedNodes) {
                            const n = selectedNodes[id];
                            n.properties = n.properties || {};
                            n.properties.trix_wlinks_hidden = nextHidden;
                            n.properties.trix_wlinks_updated = now;
                        }
                    } else {
                        node.properties.trix_wlinks_hidden = nextHidden;
                        node.properties.trix_wlinks_updated = now;
                    }
                    
                    if (canvas) {
                        canvas.draw(true, true);
                    }
                }
            }
        ];
    }
});
