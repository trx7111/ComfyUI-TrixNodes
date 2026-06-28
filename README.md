# ComfyUI-TrixNodes

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](README.md) [![Русский](https://img.shields.io/badge/Язык-Русский-red?style=for-the-badge)](README_RU.md)

An elegant, premium, high-performance workflow management node suite for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Organize complex workflows, remotely bypass or mute nodes and groups, navigate instantly across your canvas, and declutter connection wires with beautiful, GPU-optimized animations.

---

## 📌 Table of Contents
1. [🌟 Core Features](#-core-features)
2. [📦 Nodes Overview](#-nodes-overview)
3. [🎥 Visual Demonstration](#-visual-demonstration)
4. [🔌 Wire Management & Hidden Links (WLinks)](#-wire-management--hidden-links-wlinks)
5. [⚙️ Global Settings](#️-global-settings)
6. [⚖️ Comparison & Pros](#️-comparison--pros)
7. [🛠️ Installation](#-installation)

---

## 🌟 Core Features

- **Unified Control Cards**: Remotely toggle bypass/mute states for nodes and groups.
- **Instant Canvas Navigation**: Click the `👁` eye button to immediately center your screen on the target nodes.
- **Hidden Connection Wires (WLinks)**: Hide connection wires via right-click to declutter the canvas. They reappear dynamically on hover or click with glowing particle animations.
- **GPU Performance Switch**: Toggle between energy-saving (15 FPS) and high-performance native refresh rate (60+ FPS) animations.

---

## 📦 Nodes Overview

### 1. Visual Representation of the Nodes
The package includes two main bypasser nodes: `Trix Bypass Nodes w Groups by ID` (with group grouping and collapsible decks) and `Trix Bypass Nodes by ID` (streamlined linear list).

![Bypassers Overview](assets/1.jpg)

### 2. Collapsible Layout (Show/Hide Controls)
You can toggle showing or hiding control buttons directly on the node layout to make the visual interface simpler and cleaner.

![Simplified Node Layout](assets/2.jpg)

### 3. Add Targets Submenu
Double-click or click **Add C** to open the custom submenu popup where you can easily search and pick nodes to target.

![Picker Submenu](assets/3.jpg)

### 4. Configured Targets and IDs
Once targets are added, they are listed inside the picker submenu with their corresponding names and IDs.

![Configured Target List](assets/4.jpg)

### 5. Smart Connection Recovery
If a target node's ID is lost or disconnected, the node displays a smart warning indicator (`⚠️`). Clicking it opens a recovery modal to easily repair the connection.

![Connection Recovery](assets/5.jpg)

---

## 🎥 Visual Demonstration

Below are interactive video walkthroughs showing the nodes and animations in real-world application:

### Remote Control & Navigation Walkthrough:



https://github.com/user-attachments/assets/94c87505-834d-490c-9dd2-0dbb3939eab4



### Animated Connections & WLinks Walkthrough:



https://github.com/user-attachments/assets/d48afabc-fd94-458b-841e-f1e1efa07974



---

## 🔌 Wire Management & Hidden Links (WLinks)

WLinks lets you selectively clean up wire spaghetti by hiding connections, rendering them dynamically with animations when you interact with the nodes.

### 1. Animated Invisible Links
Once connections are hidden via right-click `🌊 Trix Hide Links`, they render with smooth glowing particle flows on hover or selection.

![Hidden Wires Overview](assets/6.jpg)

### 2. Close-up View of Glowing Wires
A close-up view showing the animated particles, custom slot indicator shapes, and slot colors.

![Hidden Wires Close Up](assets/7.jpg)

---

## ⚙️ Global Settings

Configure your preferences globally in the ComfyUI Settings panel under the **`Trix Nodes`** tab. You can customize slot indicator shapes, neon color schemes, animation styles, display modes, FPS throttling limits, or toggle context menu right-click options.

![Settings Panel](assets/8.jpg)

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
