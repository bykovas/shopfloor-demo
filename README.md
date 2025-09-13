# ShopfloorPilot Demo — Rete.js v2 Flow Editor

This repository contains an **interactive demo** of the **ShopfloorPilot** workflow editor,  
implemented with **Rete.js v2**, Vue renderer, and ELK auto-arrange.  
It demonstrates how Lauresta’s production tech rules and formulas can be represented as a **graph** of nodes and connections.

---

## ✨ Features

- **Node types**
  - **Start** — *Job Received*, entry point (blue)
  - **Finish** — *Assemble & Complete Product • Print Label*, terminal (green)
  - **Task** — configurable production step (orange)

- **Visual design**
  - Distinctive colors, high-contrast text
  - Animated dashed connectors with arrowheads
  - Zoom-to-fit for any graph size

- **Toolbar actions**
  - ➕ Add Task
  - 🔄 Auto layout (ELK.js)
  - ❌ Delete last node
  - 💾 Export JSON (graph + runtime metadata)

---

## 🖼️ Preview

### Overview
![Overview](https://raw.githubusercontent.com/bykovas/shopfloor-demo/main/.docs/demo-overview.png)


---

## 📄 Example export

```json
{
  "productCode": "ROLLER_STD",
  "graph": {
    "nodes": [
      { "id": "1", "title": "Job Received", "kind": "start", "wc": "SYS" },
      { "id": "2", "title": "Assemble & Complete Product • Print Label", "kind": "finish", "wc": "SYS" },
      { "id": "3", "title": "Task", "kind": "task", "taskType": "CUT_FABRIC", "wc": "FAB" }
    ],
    "edges": [
      { "from": "1", "to": "3" },
      { "from": "3", "to": "2" }
    ]
  },
  "runtime": {
    "tasks": [
      {
        "taskType": "CUT_FABRIC",
        "wc": "FAB",
        "isTerminal": false,
        "dependsOn": ["START"]
      }
    ],
    "formulasByTask": {
      "CUT_FABRIC": {
        "fabric_length_mm": "CEILING((height_mm + 20) * 1.01, 1)"
      }
    }
  }
}
```

---

## 🛠️ Tech stack

- [Rete.js v2](https://rete.js.org/)  
- [Vue renderer plugin](https://github.com/retejs/vue-render-plugin)  
- [Connection plugin](https://github.com/retejs/connection-plugin)  
- [Auto-Arrange plugin](https://github.com/retejs/auto-arrange-plugin)  
- [ELK.js](https://github.com/kieler/elkjs)  

---

## 🚀 Getting started

```bash
npm install
npm run dev
# open http://localhost:5173
```

---

👉 This demo is a **proof of concept** for how production workflows can be authored visually and exported as structured JSON for execution in the ShopfloorPilot system.
