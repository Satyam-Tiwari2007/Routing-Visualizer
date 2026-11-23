// 1. Hexagonal Mesh Topology: 6 Outer Routers + 1 Central Core Router (R7)
const nodes = [
  { id: "R1", x: 120, y: 200 },
  { id: "R2", x: 250, y: 70 },
  { id: "R3", x: 510, y: 70 },
  { id: "R4", x: 640, y: 200 },
  { id: "R5", x: 510, y: 330 },
  { id: "R6", x: 250, y: 330 },
  { id: "R7", x: 380, y: 200 }
];

const edges = [
  // Outer Hexagon Ring
  { from: "R1", to: "R2", weight: 2, active: true },
  { from: "R2", to: "R3", weight: 2, active: true },
  { from: "R3", to: "R4", weight: 2, active: true },
  { from: "R4", to: "R5", weight: 4, active: true },
  { from: "R5", to: "R6", weight: 3, active: true },
  { from: "R6", to: "R1", weight: 3, active: true },

  // Inner Spokes to Core Router (R7)
  { from: "R1", to: "R7", weight: 9, active: true },
  { from: "R7", to: "R4", weight: 8, active: true },
  { from: "R2", to: "R7", weight: 5, active: true },
  { from: "R3", to: "R7", weight: 6, active: true },
  { from: "R5", to: "R7", weight: 2, active: true },
  { from: "R6", to: "R7", weight: 4, active: true }
];

// Snapshot default weights so Reset restores everything cleanly
const defaultWeights = edges.map(e => e.weight);

// 2. Dijkstra's Algorithm (OSPF - Lowest Link Cost)
function runDijkstra(startId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set();

  nodes.forEach(node => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    unvisited.add(node.id);
  }); 
  distances[startId] = 0;

  while (unvisited.size > 0) {
    let current = null;
    for (let id of unvisited) {
      if (current === null || distances[id] < distances[current]) {
        current = id;
      }
    }

    if (distances[current] === Infinity) break;
    unvisited.delete(current);

    edges.forEach(edge => {
      if (!edge.active) return;

      let neighbor = null;
      if (edge.from === current) neighbor = edge.to;
      else if (edge.to === current) neighbor = edge.from;

      if (neighbor && unvisited.has(neighbor)) {
        const newDist = distances[current] + edge.weight;
        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          previous[neighbor] = current;
        }
      }
    });
  }

  return { distances, previous };
}

// 3. Bellman-Ford Algorithm (RIP - Fewest Hops)
function runBellmanFord(startId) {
  const distances = {};
  const previous = {};

  nodes.forEach(node => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
  });
  distances[startId] = 0;

  const hopCost = 1; // Real-world RIP uses hop count, ignoring link weights

  for (let i = 0; i < nodes.length - 1; i++) {
    edges.forEach(edge => {
      if (!edge.active) return;

      if (distances[edge.from] + hopCost < distances[edge.to]) {
        distances[edge.to] = distances[edge.from] + hopCost;
        previous[edge.to] = edge.from;
      }
      if (distances[edge.to] + hopCost < distances[edge.from]) {
        distances[edge.from] = distances[edge.to] + hopCost;
        previous[edge.from] = edge.to;
      }
    });
  }

  return { distances, previous };
}

function getPath(previous, endId) {
  const path = [];
  let current = endId;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }
  return path;
}

// 4. DOM References
const canvasLayer = document.getElementById("canvasLayer");
const algoSelect = document.getElementById("algoSelect");
const startSelect = document.getElementById("startSelect");
const endSelect = document.getElementById("endSelect");
const tableBody = document.getElementById("routingTableBody");
const metricHeader = document.getElementById("metricHeader");
const tableSourceTag = document.getElementById("tableSourceTag");
const eventLog = document.getElementById("eventLog");

const kpiPath = document.getElementById("kpiPath");
const kpiMetricLabel = document.getElementById("kpiMetricLabel");
const kpiMetricValue = document.getElementById("kpiMetricValue");
const kpiLinks = document.getElementById("kpiLinks");
const kpiLatency = document.getElementById("kpiLatency");

// Modal elements
const weightModal = document.getElementById("weightModal");
const modalLinkTitle = document.getElementById("modalLinkTitle");
const weightInput = document.getElementById("weightInput");
const saveWeightBtn = document.getElementById("saveWeightBtn");
const cancelWeightBtn = document.getElementById("cancelWeightBtn");
let editingEdge = null;

// Populate Router Dropdowns
nodes.forEach(n => {
  startSelect.innerHTML += `<option value="${n.id}">${n.id}</option>`;
  endSelect.innerHTML += `<option value="${n.id}">${n.id}</option>`;
});
startSelect.value = "R1";
endSelect.value = "R4";

function createSVG(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (let key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function logEvent(tag, message, type = "info") {
  const now = new Date();
  const time = now.toTimeString().split(" ")[0];
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-tag-${type}">${tag}</span><span>${message}</span>`;
  eventLog.prepend(entry);
}

// Custom Modal Helpers
function openWeightModal(edge) {
  editingEdge = edge;
  modalLinkTitle.textContent = `Edit Cost: ${edge.from} ↔ ${edge.to}`;
  weightInput.value = edge.weight;
  weightModal.classList.add("open");
  weightInput.focus();
  weightInput.select();
}

function closeWeightModal() {
  weightModal.classList.remove("open");
  editingEdge = null;
}

function applyWeightChange() {
  if (!editingEdge) return;
  const val = parseInt(weightInput.value, 10);
  if (!isNaN(val) && val > 0 && val <= 999) {
    const oldVal = editingEdge.weight;
    editingEdge.weight = val;
    logEvent("WEIGHT_MOD", `${editingEdge.from}–${editingEdge.to}: ${oldVal} → ${val}`, "warn");
    render();
  }
  closeWeightModal();
}

saveWeightBtn.addEventListener("click", applyWeightChange);
cancelWeightBtn.addEventListener("click", closeWeightModal);
weightInput.addEventListener("keydown", e => {
  if (e.key === "Enter") applyWeightChange();
  if (e.key === "Escape") closeWeightModal();
});
weightModal.addEventListener("click", e => {
  if (e.target === weightModal) closeWeightModal();
});

// 5. Main Render Pipeline
function render() {
  canvasLayer.innerHTML = "";
  const startId = startSelect.value;
  const endId = endSelect.value;
  const isOSPF = algoSelect.value === "dijkstra";

  const t0 = performance.now();
  const result = isOSPF ? runDijkstra(startId) : runBellmanFord(startId);
  const elapsed = (performance.now() - t0).toFixed(2);

  const isReachable = result.distances[endId] !== Infinity;
  const bestPath = isReachable ? getPath(result.previous, endId) : [];

  function isEdgeInPath(a, b) {
    for (let i = 0; i < bestPath.length - 1; i++) {
      if ((bestPath[i] === a && bestPath[i + 1] === b) ||
          (bestPath[i] === b && bestPath[i + 1] === a)) {
        return true;
      }
    }
    return false;
  }

  // Update KPIs
  const activeCount = edges.filter(e => e.active).length;
  kpiLinks.textContent = `${activeCount} / ${edges.length}`;
  kpiLatency.textContent = `${elapsed} ms`;
  kpiMetricLabel.textContent = isOSPF ? "Total Path Cost (OSPF)" : "Total Hop Count (RIP)";
  metricHeader.textContent = isOSPF ? "Cost" : "Hops";
  tableSourceTag.textContent = `SRC: ${startId}`;

  if (isReachable) {
    kpiPath.textContent = bestPath.join(" → ");
    kpiPath.className = "kpi-value accent-green";
    kpiMetricValue.textContent = isOSPF
      ? `${result.distances[endId]} cost`
      : `${result.distances[endId]} hops`;
    kpiMetricValue.className = "kpi-value";
  } else {
    kpiPath.textContent = "UNREACHABLE";
    kpiPath.className = "kpi-value accent-rose";
    kpiMetricValue.textContent = "∞";
    kpiMetricValue.className = "kpi-value accent-rose";
  }

  // Draw Cables & Interactive Hit Targets
  edges.forEach(edge => {
    const n1 = nodes.find(n => n.id === edge.from);
    const n2 = nodes.find(n => n.id === edge.to);
    const inPath = edge.active && isEdgeInPath(edge.from, edge.to);

    // Wide invisible hit area so thin cables are effortless to click
    const hitLine = createSVG("line", {
      x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
      stroke: "transparent", "stroke-width": 16,
      class: "edge-hit"
    });

    hitLine.addEventListener("click", () => {
      edge.active = !edge.active;
      logEvent(
        edge.active ? "LINK_UP" : "LINK_DOWN",
        `${edge.from}–${edge.to} ${edge.active ? "restored" : "severed"}`,
        edge.active ? "ok" : "err"
      );
      render();
    });

    const visibleLine = createSVG("line", {
      x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
      stroke: !edge.active ? "#f43f5e" : (inPath ? "#10b981" : "#3f3f46"),
      "stroke-width": inPath ? 4 : 2.5,
      "stroke-dasharray": edge.active ? "none" : "5,5",
      filter: inPath ? "url(#glow-green)" : "none",
      class: "edge-line"
    });

    canvasLayer.appendChild(hitLine);
    canvasLayer.appendChild(visibleLine);

    // Subtle animated directional flow along optimal path
    if (inPath) {
      const flowLine = createSVG("line", {
        x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
        stroke: "#6ee7b7", "stroke-width": 2,
        class: "flow-line"
      });
      canvasLayer.appendChild(flowLine);
    }

    // Weight Badge
    const midX = (n1.x + n2.x) / 2;
    const midY = (n1.y + n2.y) / 2;
    const g = createSVG("g", { class: "weight-group" });

    const badge = createSVG("circle", {
      cx: midX, cy: midY, r: 12,
      fill: "#111114",
      stroke: !edge.active ? "#f43f5e" : (inPath ? "#10b981" : "#3f3f46"),
      "stroke-width": 1.5
    });

    const label = createSVG("text", {
      x: midX, y: midY + 4,
      fill: !edge.active ? "#f43f5e" : (inPath ? "#fafafa" : "#a1a1aa"),
      "font-family": "JetBrains Mono, Consolas, monospace",
      "font-size": "11", "font-weight": "600",
      "text-anchor": "middle",
      style: "user-select: none;"
    });
    label.textContent = edge.active ? (isOSPF ? edge.weight : "1") : "×";

    g.addEventListener("click", e => {
      e.stopPropagation();
      if (!edge.active) {
        edge.active = true;
        logEvent("LINK_UP", `${edge.from}–${edge.to} restored`, "ok");
        render();
      } else {
        openWeightModal(edge);
      }
    });

    g.appendChild(badge);
    g.appendChild(label);
    canvasLayer.appendChild(g);
  });

  // Draw Routers
  nodes.forEach(node => {
    const isStart = node.id === startId;
    const isEnd = node.id === endId;
    const inPath = bestPath.includes(node.id);

    const fill = isStart ? "#2563eb" : (isEnd ? "#059669" : "#18181b");
    const stroke = isStart ? "#60a5fa" : (isEnd ? "#34d399" : (inPath ? "#10b981" : "#52525b"));

    const circle = createSVG("circle", {
      cx: node.x, cy: node.y, r: 21,
      fill, stroke, "stroke-width": 2.2
    });
    canvasLayer.appendChild(circle);

    const text = createSVG("text", {
      x: node.x, y: node.y + 4,
      fill: "#fafafa",
      "font-family": "JetBrains Mono, Consolas, monospace",
      "font-size": "12.5", "font-weight": "700",
      "text-anchor": "middle",
      style: "user-select: none;"
    });
    text.textContent = node.id;
    canvasLayer.appendChild(text);
  });

  // Update Live Routing Table
  tableBody.innerHTML = "";
  nodes.forEach(node => {
    const cost = result.distances[node.id];
    const isSelectedDest = node.id === endId;
    const pathStr = cost === Infinity
      ? `<span class="unreachable">Unreachable</span>`
      : getPath(result.previous, node.id).join(" → ");

    tableBody.innerHTML += `
      <tr class="${isSelectedDest ? "active-row" : ""}">
        <td class="mono"><b>${node.id}</b></td>
        <td class="cost-cell ${cost === Infinity ? "unreachable" : ""}">${cost === Infinity ? "∞" : cost}</td>
        <td class="mono">${pathStr}</td>
      </tr>`;
  });
}

// 6. Controls & Packet Animation
algoSelect.addEventListener("change", () => {
  const mode = algoSelect.value === "dijkstra" ? "OSPF (Dijkstra)" : "RIP (Bellman-Ford)";
  logEvent("PROTOCOL", `Switched control plane to ${mode}`, "info");
  render();
});

startSelect.addEventListener("change", () => {
  logEvent("ROUTE_REQ", `Source changed to ${startSelect.value}`, "info");
  render();
});

endSelect.addEventListener("change", () => {
  logEvent("ROUTE_REQ", `Destination changed to ${endSelect.value}`, "info");
  render();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  edges.forEach((e, i) => {
    e.active = true;
    e.weight = defaultWeights[i];
  });
  logEvent("TOPOLOGY_RESET", "All 12 links repaired and weights restored", "ok");
  render();
});

document.getElementById("sendPacketBtn").addEventListener("click", () => {
  const startId = startSelect.value;
  const endId = endSelect.value;
  const isOSPF = algoSelect.value === "dijkstra";
  const result = isOSPF ? runDijkstra(startId) : runBellmanFord(startId);

  if (result.distances[endId] === Infinity) {
    logEvent("PACKET_DROP", `No valid route from ${startId} to ${endId}`, "err");
    return;
  }

  const path = getPath(result.previous, endId);
  if (path.length < 2) {
    logEvent("PACKET_LOCAL", `Source and destination are identical (${startId})`, "warn");
    return;
  }

  logEvent("PACKET_TX", `Forwarding via ${path.join(" → ")}`, "info");

  const startNode = nodes.find(n => n.id === path[0]);
  const packet = createSVG("circle", {
    cx: startNode.x, cy: startNode.y, r: 7,
    fill: "#f59e0b", stroke: "#fef3c7", "stroke-width": 2,
    filter: "url(#glow-amber)"
  });
  canvasLayer.appendChild(packet);

  let step = 0;
  let progress = 0;

  function animate() {
    const from = nodes.find(n => n.id === path[step]);
    const to = nodes.find(n => n.id === path[step + 1]);

    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;
    packet.setAttribute("cx", x);
    packet.setAttribute("cy", y);

    progress += 0.032;
    if (progress >= 1) {
      progress = 0;
      step++;
      if (step >= path.length - 1) {
        logEvent("PACKET_ACK", `Delivered to ${endId} (${path.length - 1} hops)`, "ok");
        setTimeout(() => packet.remove(), 300);
        return;
      }
    }
    requestAnimationFrame(animate);
  }

  animate();
});

// Initial boot
logEvent("SYSTEM_INIT", "Hexagonal mesh loaded (7 routers, 12 links)", "ok");
render();
