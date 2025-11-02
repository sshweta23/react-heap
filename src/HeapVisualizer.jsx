import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

// Heap Visualizer Component
// - Min-heap using 0-based array indexing
// - Shows array view (left) and binary tree (right) side-by-side
// - Animates insert (bubble-up) and delete-min (bubble-down)
// - Controls: insert value, random insert, delete-min, play/pause, speed

export default function HeapVisualizer() {
  const [heap, setHeap] = useState([]);
  const [value, setValue] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(600); // ms per step
  const [highlight, setHighlight] = useState({}); // { type: 'swap'|'compare'|'remove', indices: [] }
  const stepsRef = useRef([]);
  const timerRef = useRef(null);
  const stepIndexRef = useRef(0);

  // Utility: swap in a copied array
//   const swap = (arr, i, j) => {
//     const c = arr.slice();
//     const tmp = c[i];
//     c[i] = c[j];
//     c[j] = tmp;
//     return c;
//   };

  // Generate steps for bubble-up (insert)
  function generateInsertSteps(startHeap, insertedValue) {
    const arr = startHeap.slice();
    const steps = [];
    // push value
    arr.push(insertedValue);
    steps.push({ type: "push", arr: arr.slice(), info: { index: arr.length - 1 } });

    let i = arr.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      steps.push({ type: "compare", arr: arr.slice(), info: { i, parent } });
      if (arr[i] < arr[parent]) {
        // swap
        // const before = arr.slice();
        const valI = arr[i];
        arr[i] = arr[parent];
        arr[parent] = valI;
        steps.push({ type: "swap", arr: arr.slice(), info: { i, parent } });
        i = parent;
      } else break;
    }
    steps.push({ type: "done", arr: arr.slice() });
    return steps;
  }

  // Generate steps for delete-min (remove root)
  function generateDeleteMinSteps(startHeap) {
    const arr = startHeap.slice();
    const steps = [];
    if (arr.length === 0) return steps;
    // swap root and last
    const lastIndex = arr.length - 1;
    steps.push({ type: "removeRoot", arr: arr.slice(), info: { root: 0, last: lastIndex } });
    if (lastIndex === 0) {
      // only one element
      arr.pop();
      steps.push({ type: "done", arr: arr.slice() });
      return steps;
    }
    // swap root and last
    const rootVal = arr[0];
    arr[0] = arr[lastIndex];
    arr[lastIndex] = rootVal;
    steps.push({ type: "swap", arr: arr.slice(), info: { i: 0, j: lastIndex } });
    // remove last
    arr.pop();
    steps.push({ type: "pop", arr: arr.slice(), info: { removedIndex: lastIndex } });

    // bubble down from root
    let i = 0;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left >= arr.length) break;
      let smaller = left;
      if (right < arr.length && arr[right] < arr[left]) smaller = right;
      steps.push({ type: "compare", arr: arr.slice(), info: { i, smaller } });
      if (arr[smaller] < arr[i]) {
        const tmp = arr[i];
        arr[i] = arr[smaller];
        arr[smaller] = tmp;
        steps.push({ type: "swap", arr: arr.slice(), info: { i, j: smaller } });
        i = smaller;
      } else break;
    }
    steps.push({ type: "done", arr: arr.slice() });
    return steps;
  }

  // Start a sequence of steps (insert or delete-min)
  function startSteps(steps) {
    if (!steps || steps.length === 0) return;
    stepsRef.current = steps;
    stepIndexRef.current = 0;
    setRunning(true);
    setHighlight({});
    // immediate first render
    setHeap(steps[0].arr);
    stepIndexRef.current = 1;
    timerRef.current = setInterval(() => runStep(), speed);
  }

  // Run a single step from stepsRef
  function runStep() {
    const steps = stepsRef.current;
    const idx = stepIndexRef.current;
    if (!steps || idx >= steps.length) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
      setHighlight({});
      return;
    }
    const s = steps[idx];
    setHeap(s.arr);
    // set highlight based on step type
    if (s.type === "compare") {
      setHighlight({ type: "compare", indices: [s.info.i, s.info.parent ?? s.info.smaller] });
    } else if (s.type === "swap") {
      setHighlight({ type: "swap", indices: [s.info.i, s.info.j ?? s.info.parent] });
    } else if (s.type === "push") {
      setHighlight({ type: "push", indices: [s.info.index] });
    } else if (s.type === "pop") {
      setHighlight({ type: "pop", indices: [s.info.removedIndex] });
    } else if (s.type === "removeRoot") {
      setHighlight({ type: "removeRoot", indices: [s.info.root, s.info.last] });
    } else if (s.type === "done") {
      setHighlight({ type: "done", indices: [] });
    } else {
      setHighlight({});
    }
    stepIndexRef.current = idx + 1;
  }

  // Controls: insert value
  function handleInsert() {
    const v = Number(value);
    const steps = generateInsertSteps(heap, v);
    startSteps(steps);
  }

  function handleRandomInsert() {
    const v = Math.floor(Math.random() * 100);
    const steps = generateInsertSteps(heap, v);
    startSteps(steps);
  }

  function handleDeleteMin() {
    const steps = generateDeleteMinSteps(heap);
    startSteps(steps);
  }

  // Pause/Resume
  function toggleRunning() {
    if (!running) {
      // resume if we have pending steps
      if (stepsRef.current && stepIndexRef.current < stepsRef.current.length) {
        timerRef.current = setInterval(() => runStep(), speed);
        setRunning(true);
      }
    } else {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
    }
  }

  // Speed change: restart timer if running
  useEffect(() => {
    if (running) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => runStep(), speed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  // Tree layout: compute (x,y) positions for nodes in a simple binary-tree manner
  function computeTreePositions(arr, width = 600) {
    const positions = [];
    if (!arr || arr.length === 0) return positions;
    const layerY = 70;
    for (let i = 0; i < arr.length; i++) {
      const level = Math.floor(Math.log2(i + 1));
      const indexInLevel = i - (2 ** level - 1);
      const nodesInLevel = 2 ** level;
      const segment = width / (nodesInLevel + 1);
      const x = segment * (indexInLevel + 1);
      const y = 30 + level * layerY;
      positions.push({ x, y });
    }
    return positions;
  }

  const positions = computeTreePositions(heap);

  // Helper styles for highlighted nodes
  function nodeClass(i) {
    if (!highlight || !highlight.indices) return "";
    if (highlight.indices.includes(i)) {
      if (highlight.type === "swap") return "ring-4 ring-offset-2 ring-yellow-300";
      if (highlight.type === "compare") return "ring-4 ring-offset-2 ring-blue-300";
      if (highlight.type === "push") return "ring-4 ring-offset-2 ring-green-300";
      if (highlight.type === "pop") return "opacity-50 line-through";
      if (highlight.type === "removeRoot") return "ring-4 ring-offset-2 ring-red-300";
    }
    return "";
  }

  return (
    <div className="p-4 min-h-screen bg-slate-50">
      <h1 className="text-2xl font-semibold mb-4">Heap Visualizer — Min-Heap (Insert / Delete-Min)</h1>
      <div className="flex gap-6">
        {/* Controls + array view */}
        <div className="w-1/3 bg-white rounded-2xl shadow p-4">
          <div className="flex gap-2 items-center mb-3">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border p-2 rounded w-24"
            />
            <button onClick={handleInsert} className="px-3 py-2 bg-indigo-600 text-white rounded">Insert</button>
            <button onClick={handleRandomInsert} className="px-3 py-2 bg-green-600 text-white rounded">Insert Random</button>
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={handleDeleteMin} className="px-3 py-2 bg-red-600 text-white rounded">Delete Min</button>
            <button onClick={toggleRunning} className="px-3 py-2 bg-slate-700 text-white rounded">{running ? 'Pause' : 'Resume'}</button>
            <label className="flex items-center gap-2 ml-2">
              Speed
              <input type="range" min="100" max="1200" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            </label>
          </div>

          <div className="mb-3">
            <h3 className="font-medium">Array view (level order)</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {heap.map((v, i) => (
                <motion.div
                  layout
                  key={`node-${i}`}
                  className={`w-14 h-14 rounded-xl border flex items-center justify-center text-lg font-medium bg-white shadow ${nodeClass(i)}`}
                  transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                >
                  {v}
                  <div className="text-xs absolute translate-y-6">{i}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="text-sm text-slate-600">
            <h4 className="font-semibold">Legend</h4>
            <ul className="list-disc pl-5">
              <li><span className="font-medium">Blue</span>: comparing nodes (bubble-up / bubble-down)</li>
              <li><span className="font-medium">Yellow</span>: swapping nodes</li>
              <li><span className="font-medium">Green</span>: newly pushed node</li>
              <li><span className="font-medium">Red</span>: root being removed</li>
            </ul>
          </div>
        </div>

        {/* Binary tree view */}
        <div className="w-2/3 bg-white rounded-2xl shadow p-4">
          <h3 className="font-medium mb-3">Binary tree (visual)</h3>
          <div className="relative bg-slate-50 rounded p-2" style={{ minHeight: 280 }}>
            {/* Edges (lines) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {heap.map((_, i) => {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                const p = positions[i];
                if (!p) return null;
                return (
                  <g key={`edges-${i}`}>
                    {left < heap.length && positions[left] && (
                      <line x1={p.x} y1={p.y} x2={positions[left].x} y2={positions[left].y} strokeWidth={2} stroke="#cbd5e1" />
                    )}
                    {right < heap.length && positions[right] && (
                      <line x1={p.x} y1={p.y} x2={positions[right].x} y2={positions[right].y} strokeWidth={2} stroke="#cbd5e1" />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {heap.map((v, i) => {
              const p = positions[i];
              if (!p) return null;
              return (
                <motion.div
                  layout
                  key={`tree-node-${i}`}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                  style={{ left: p.x - 24, top: p.y - 24, position: 'absolute' }}
                >
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center text-sm font-semibold bg-white shadow ${nodeClass(i)}`}>
                    {v}
                  </div>
                  <div className="text-xs text-center mt-1">{i}</div>
                </motion.div>
              );
            })}

            {/* Explanation box */}
            <div className="absolute right-4 bottom-4 w-80 bg-white border rounded p-3 text-sm shadow">
              <h4 className="font-semibold">What's happening</h4>
              <p className="text-slate-600 text-sm">
                The array view shows the heap in level-order (index labels under each value). The tree shows the binary structure.
                During insert the new value is appended (push) then <span className="font-medium">bubble-up</span> repeatedly comparing with its parent and swapping if smaller.
                During delete-min the root is swapped with the last element, removed, then <span className="font-medium">bubble-down</span> (sift-down) to restore the heap property.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white p-4 rounded shadow">
        <h3 className="font-semibold">Explanation & algorithmic notes</h3>
        <ol className="list-decimal pl-5 text-slate-700">
          <li>Insert: append value to end of array (O(1)), then bubble-up swapping with parent while smaller — O(log n) worst-case.</li>
          <li>Delete-min: swap root with last, pop last (O(1)), then bubble-down (sift-down) root to correct position — O(log n) worst-case.</li>
          <li>The visualizer animates each compare and swap as a separate step — use speed slider to slow down or speed up.</li>
          <li>Array view (left) maps directly to indices used by the tree view (right). Index labels are shown under each node.</li>
        </ol>
      </div>
    </div>
  );
}
