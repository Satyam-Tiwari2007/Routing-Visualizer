// 1. Network Topology: Routers (Nodes) & Cables (Edges)
const nodes = [
  { id: "R1", x: 100, y: 200 },
  { id: "R2", x: 250, y: 80 },
  { id: "R3", x: 250, y: 320 },
  { id: "R4", x: 450, y: 200 },
  { id: "R5", x: 650, y: 200 }
];

const edges = [
  { from: "R1", to: "R2", weight: 4, active: true },
  { from: "R1", to: "R3", weight: 2, active: true },
  { from: "R2", to: "R4", weight: 5, active: true },
  { from: "R3", to: "R4", weight: 1, active: true },
  { from: "R2", to: "R3", weight: 3, active: true },
  { from: "R4", to: "R5", weight: 3, active: true },
  { from: "R2", to: "R5", weight: 10, active: true }
];

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

// Helper: Reconstruct shortest path from previous-node map
function getPath(previous, endId) {
  const path = [];
  let current = endId;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }
  return path;
}

// 4. Interactive SVG Visualizer & Live Routing Table
const svg = document.getElementById("networkCanvas");
const algoSelect = document.getElementById("algoSelect");
const startSelect = document.getElementById("startSelect");
const endSelect = document.getElementById("endSelect");
const tableBody = document.getElementById("routingTableBody");

nodes.forEach(n => {
  startSelect.innerHTML += `<option value="${n.id}">${n.id}</option>`;
  endSelect.innerHTML += `<option value="${n.id}">${n.id}</option>`;
});
startSelect.value = "R1";
endSelect.value = "R5";

function createSVG(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (let key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function render() {
  svg.innerHTML = "";
  const startId = startSelect.value;
  const endId = endSelect.value;

  const result = algoSelect.value === "dijkstra"
    ? runDijkstra(startId)
    : runBellmanFord(startId);

  const bestPath = result.distances[endId] === Infinity ? [] : getPath(result.previous, endId);

  function isEdgeInPath(a, b) {
    for (let i = 0; i < bestPath.length - 1; i++) {
      if ((bestPath[i] === a && bestPath[i + 1] === b) ||
          (bestPath[i] === b && bestPath[i + 1] === a)) {
        return true;
      }
    }
    return false;
  }

  // Draw cables & editable weight badges
  edges.forEach(edge => {
    const n1 = nodes.find(n => n.id === edge.from);
    const n2 = nodes.find(n => n.id === edge.to);
    const inPath = edge.active && isEdgeInPath(edge.from, edge.to);

    const line = createSVG("line", {
      x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
      stroke: !edge.active ? "#ef4444" : (inPath ? "#22c55e" : "#64748b"),
      "stroke-width": inPath ? 5 : 3,
      "stroke-dasharray": edge.active ? "none" : "6,6",
      style: "cursor: pointer;"
    });

    // Click cable to cut or repair
    line.addEventListener("click", () => {
      edge.active = !edge.active;
      render();
    });
    svg.appendChild(line);

    const midX = (n1.x + n2.x) / 2;
    const midY = (n1.y + n2.y) / 2;

    // Clickable badge behind the weight number
    const badge = createSVG("circle", {
      cx: midX, cy: midY, r: 12,
      fill: "#0f172a",
      stroke: edge.active ? (inPath ? "#22c55e" : "#475569") : "#ef4444",
      "stroke-width": 1.5,
      style: "cursor: pointer;"
    });

    const label = createSVG("text", {
      x: midX, y: midY + 4,
      fill: edge.active ? "#f8fafc" : "#ef4444",
      "font-size": "12", "font-weight": "bold", "text-anchor": "middle",
      style: "cursor: pointer; user-select: none;"
    });
    label.textContent = edge.active ? edge.weight : "X";

    // Click badge or number to edit weight live (or repair if 'X')
    const editWeight = () => {
      if (!edge.active) {
        edge.active = true;
        render();
        return;
      }
      const input = prompt(`Enter new cost for link ${edge.from} – ${edge.to}:`, edge.weight);
      const newWeight = parseInt(input, 10);
      if (!isNaN(newWeight) && newWeight > 0) {
        edge.weight = newWeight;
        render();
      }
    };

    badge.addEventListener("click", editWeight);
    label.addEventListener("click", editWeight);

    svg.appendChild(badge);
    svg.appendChild(label);
  });

  // Draw routers
  nodes.forEach(node => {
    const isStart = node.id === startId;
    const isEnd = node.id === endId;
    const circle = createSVG("circle", {
      cx: node.x, cy: node.y, r: 22,
      fill: isStart ? "#3b82f6" : (isEnd ? "#22c55e" : "#0f172a"),
      stroke: "#f8fafc", "stroke-width": 2.5
    });
    svg.appendChild(circle);

    const text = createSVG("text", {
      x: node.x, y: node.y + 5, fill: "#ffffff",
      "font-size": "14", "font-weight": "bold", "text-anchor": "middle"
    });
    text.textContent = node.id;
    svg.appendChild(text);
  });

  // Update Live Routing Table
  tableBody.innerHTML = "";
  nodes.forEach(node => {
    const cost = result.distances[node.id];
    const pathStr = cost === Infinity ? "Unreachable" : getPath(result.previous, node.id).join(" → ");
    tableBody.innerHTML += `
      <tr>
        <td><b>${node.id}</b></td>
        <td>${cost === Infinity ? "∞" : cost}</td>
        <td>${pathStr}</td>
      </tr>`;
  });
}

// 5. Event Listeners & Packet Animation
algoSelect.addEventListener("change", render);
startSelect.addEventListener("change", render);
endSelect.addEventListener("change", render);

document.getElementById("resetBtn").addEventListener("click", () => {
  edges.forEach(e => e.active = true);
  render();
});

document.getElementById("sendPacketBtn").addEventListener("click", () => {
  const startId = startSelect.value;
  const endId = endSelect.value;
  const result = algoSelect.value === "dijkstra"
    ? runDijkstra(startId)
    : runBellmanFord(startId);

  if (result.distances[endId] === Infinity) {
    alert("No route available! Repair a link first.");
    return;
  }

  const path = getPath(result.previous, endId);
  if (path.length < 2) return;

  const startNode = nodes.find(n => n.id === path[0]);
  const packet = createSVG("circle", {
    cx: startNode.x, cy: startNode.y, r: 9,
    fill: "#facc15", stroke: "#ffffff", "stroke-width": 2
  });
  svg.appendChild(packet);

  let step = 0;
  let progress = 0;

  function animate() {
    const from = nodes.find(n => n.id === path[step]);
    const to = nodes.find(n => n.id === path[step + 1]);

    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;
    packet.setAttribute("cx", x);
    packet.setAttribute("cy", y);

    progress += 0.03;
    if (progress >= 1) {
      progress = 0;
      step++;
      if (step >= path.length - 1) {
        setTimeout(() => packet.remove(), 400);
        return;
      }
    }
    requestAnimationFrame(animate);
  }

  animate();
});

render();