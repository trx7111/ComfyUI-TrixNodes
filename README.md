# ComfyUI-TrixNodes

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](README.md) [![Русский](https://img.shields.io/badge/Язык-Русский-red?style=for-the-badge)](README_RU.md)

An elegant, premium, high-performance suite of workflow management nodes for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Organize complex workflows, bypass/mute nodes and groups remotely, navigate instantly across your canvas, and declutter "spaghetti" wires with gorgeous, GPU-optimized connection animations.

![ComfyUI-TrixNodes Overview](assets/workflow_overview.jpg)

---

## 📌 Table of Contents
1. [🌟 Core Features](#-core-features)
2. [📦 Included Nodes](#-included-nodes)
   - [🎛️ Trix Bypass Nodes w Groups by ID](#️-trix-bypass-nodes-w-groups-by-id)
   - [🎚️ Trix Bypass Nodes by ID](#️-trix-bypass-nodes-by-id)
3. [🔌 Visual Wire Management (WLinks)](#-visual-wire-management-wlinks)
4. [⚖️ Comparison with Standard Nodes](#️-comparison-with-standard-nodes)
5. [⚙️ Global Settings](#️-global-settings)
6. [🛠️ Installation](#️-installation)

---

## 🌟 Core Features

- **Consolidated Control Deck**: Manage multiple nodes and custom groups remotely from a single elegant interface.
- **Instant Canvas Navigation**: Click the eye icon `👁` next to any target or group to center the camera view on it instantly.
- **Hidden Connection Wires (WLinks)**: Hide selected connection lines to eliminate wire clutter ("spaghetti"), while retaining dynamic on-hover or on-click animated guides.
- **Bilingual & Premium UI**: Clean dark-mode cards with zero-configuration toggles, tab groups, delete controls, and a fully polished aesthetic.
- **Customizable Wire Animations**: Multiple animation styles (Pulsation, Neon Plasma, Wave Warping) operating at low resource levels (15 FPS) or buttery smooth framerates (60+ FPS / native monitor Hz).

---

## 📦 Included Nodes

### 🎛️ Trix Bypass Nodes w Groups by ID

Allows you to group node targets under custom group categories (e.g. `[A] Group`, `[B] Group B`). You can toggle bypass/mute states for the entire group at once or control individual target nodes inside them.

![Bypasser w Groups Node](assets/node_main.jpg)

#### Node Features:
* **Single / Multi Select**: Quickly switch between toggling a single group at a time (muting all other groups) or controlling multiple groups independently.
- **Add / Remove Targets**: Simply input node IDs or drag to append targets dynamically. Use the delete mode (`✕` button) to clean up targets.
- **Group Collapsing**: Collapse group headers to keep your control node compact.

---

### 🎚️ Trix Bypass Nodes by ID

A streamlined, linear control node that displays a flat list of target nodes without grouping. Ideal for quick remote control of key generators, loaders, or savers in your workflow.

![Bypasser Simple Node](assets/node_simple.jpg)

#### Interactive Video Walkthrough:
Below is a video demonstrating remote node control, multi-selection toggles, and instant eye-navigation:

<video src="assets/example_bypass.mp4" controls width="100%"></video>

---

## 🔌 Visual Wire Management (WLinks)

WLinks is an integrated extension that cleans up your ComfyUI workspace. You can selectively hide wire connections for specific nodes and have them reappear with smooth glowing animations when needed.

| Context Menu Hide Links | Glowing Wire Animations |
| :---: | :---: |
| ![Context Menu](assets/context_menu.jpg) | ![Animated Wires](assets/animation_glow.jpg) |

#### Features:
* **Right-Click Hide**: Right-click any node and select `🌊 Trix Hide Links` to hide all its input/output wires.
- **Dynamic Reveal**: Hover over or click on nodes to temporarily reveal their hidden connections.
- **Customizable Indicators**: Customize the shapes (Dashed Circle, Circle, Triangle, WiFi Icon) and colors of input/output slot indicators.

#### Slot Shapes & Indicators:
![Slot Shapes & Indicators](assets/slot_shapes.jpg)

#### Animated Connections Video:
Watch the wire animation style and dynamic on-hover guides in action:

<video src="assets/example_w_links.mp4" controls width="100%"></video>

---

## ⚖️ Comparison with Standard Nodes

| Feature | Standard ComfyUI Nodes | TrixNodes Suite |
| :--- | :---: | :---: |
| **Control UI** | Bulky, manual, scattered toggles | Sleek, unified dark-mode deck |
| **Target Management** | Static, hard to change | Dynamic adding/deleting inline |
| **Viewport Navigation** | Manual panning and scrolling | Instant centering with `👁` button |
| **Wire Management** | Global binary visibility (All or None) | Selective hidden wires (WLinks) |
| **Interactive Wires** | Static, non-responsive lines | Dynamic animations on hover/click |
| **Performance Tuning** | Fixed redraw rates | GPU-optimized dual framerates (15 / 60+ Hz) |

---

## ⚙️ Global Settings

Configure preferences globally via the ComfyUI settings dialog under the **`Trix Nodes`** tab:

![Settings Panel](assets/settings_panel.jpg)

- **Slot Indicator Shape**: Choose from `Dashed Circle`, `Circle`, `Triangle`, or `WiFi Icon`.
- **Color Mode**: Customize wire colors (`Match Slot Color` or neon presets).
- **Animation Style**: Select animation styles (`Pulsation (Pulse)`, `Color Flow`, `Jelly/Water Wave Warping`, `Neon Plasma Flow`, `Sparkling Electricity`, `Floating Particles`, or `Static`).
- **Wire Display Mode**: Set when hidden wires should show (`Hide Always`, `Show on Click / Selection`, or `Show on Hover`).
- **Smooth animations (GPU-heavy)**:
  - **OFF (Default)**: Restricts animations to 15 FPS to conserve CPU/GPU resources.
  - **ON**: Runs animations at a buttery smooth 60 FPS or native monitor refresh rate.
- **Context Menu Toggle Switches**: Enable or disable custom right-click items (`Show/Hide Bypasser controls`, `Copy Node ID`, `Copy Selected Node IDs`, and `Show/Hide links`).

---

## 🛠️ Installation

1. Navigate to your ComfyUI custom nodes directory:
   ```bash
   cd ComfyUI/custom_nodes/
   ```
2. Clone the repository:
   ```bash
   git clone https://github.com/pixaroma/ComfyUI-TrixNodes.git TrixNodes
   ```
3. Restart ComfyUI and refresh your browser.
