# ComfyUI-TrixNodes

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](README.md) [![Русский](https://img.shields.io/badge/Язык-Русский-red?style=for-the-badge)](README_RU.md)

An elegant, premium, high-performance workflow management node suite for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Organize complex workflows, remotely bypass or mute nodes and groups, navigate instantly across your canvas, and declutter connection wires with beautiful, GPU-optimized animations.

---

## 📌 Table of Contents
1. [🌟 Core Features](#-core-features)
2. [🎛️ Nodes Overview](#️-nodes-overview)
3. [🔌 Visual Connection Control (WLinks)](#-visual-connection-control-wlinks)
4. [⚙️ Global settings](#️-global-settings)
5. [⚖️ Comparison & Pros](#️-comparison--pros)
6. [🛠️ Installation](#-installation)

---

## 🌟 Core Features

- **Unified Control Cards**: Remotely toggle bypass/mute states for nodes and groups.
- **Instant Camera Navigation**: Click the `👁` eye button to immediately center your screen on the target nodes.
- **Hidden Connection Wires (WLinks)**: Hide connection wires via right-click to declutter the canvas. They reappear dynamically on hover or click with glowing particle animations.
- **GPU Performance Switch**: Toggle between energy-saving (15 FPS) and high-performance native refresh rate (60+ FPS) animations.

---

## 🎛️ Nodes Overview

### 1. Trix Bypass Nodes w Groups by ID
A grouped remote bypass control node. Allows category grouping (e.g. `[A] Group`, `[B] Group B`), group collapsing, and single/multi selection modes.

![Bypasser w Groups](assets/1.jpg)

### 2. Trix Bypass Nodes by ID
A linear control node showing a direct list of target nodes. Ideal for quick remote toggling of generators, loaders, or savers.

![Bypasser Simple](assets/2.jpg)

#### Remote Control and Navigation Demo:
Watch how easily you can bypass nodes and focus the viewport:

<video src="https://github.com/trx7111/ComfyUI-TrixNodes/raw/main/assets/example_bypass.mp4" width="100%" controls></video>

---

## 🔌 Visual Connection Control (WLinks)

WLinks lets you selectively clean up wire spaghetti.

### 1. Selective Hiding
Right-click any node and select `🌊 Trix Hide Links` to hide all its input/output wires.

![Right Click Hide](assets/3.jpg)

### 2. Dynamic Hover Reveal
Hovering or clicking on a node shows its hidden connections temporarily.

![Hover Reveal](assets/4.jpg)

### 3. Glow Wire Animations
Customize connection guides with smooth glowing particle flows.

![Glow Wires](assets/5.jpg)

### 4. Customizable Slot Indicators
Choose shapes (WiFi Icon, Circle, Dashed Circle, Triangle) and color schemes.

![Slot Indicators](assets/6.jpg)

#### WLinks Animation Demo:
Watch the wire animation styles and hover guides in action:

<video src="https://github.com/trx7111/ComfyUI-TrixNodes/raw/main/assets/example_w_links.mp4" width="100%" controls></video>

---

## ⚙️ Global settings

Configure settings globally via ComfyUI Settings under the **`Trix Nodes`** tab:

![Settings Panel 1](assets/7.jpg)

![Settings Panel 2](assets/8.jpg)

- **Slot Indicator Shape**: WiFi Icon, Circle, Dashed Circle, or Triangle.
- **Color Mode**: Match Slot Color or neon presets.
- **Animation Style**: Pulsation, Color Flow, Jelly Wave, Neon Plasma, Spark, Particles, or Static.
- **Wire Display Mode**: Hide Always, Show on Click, or Show on Hover.
- **Smooth animations (GPU-heavy)**: Toggle between low GPU usage (15 FPS) and native monitor refresh rate (60+ Hz).
- **Context Menu Toggle Switches**: Toggle visibility of right-click items (`Show/Hide Bypasser controls`, `Copy Node ID`, `Copy Selected Node IDs`, and `Show/Hide links`).

---

## ⚖️ Comparison & Pros

- **Clean Canvas**: Replaces the standard ComfyUI spaghetti wires with responsive, on-demand visual links.
- **Instant Focus**: Centering nodes with the eye button is much faster than manually searching through massive workflows.
- **Flexible Muting**: Toggle individual nodes, single groups, or multiple groups from a single node placed anywhere.

---

## 🛠️ Installation

1. Open your terminal in the custom nodes directory:
   ```bash
   cd ComfyUI/custom_nodes/
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/pixaroma/ComfyUI-TrixNodes.git
   ```
3. Restart ComfyUI and refresh the page.
