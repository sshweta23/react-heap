import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

// Heap Visualizer Component — cleaned & fixed
// - Single animation engine (setInterval) with Play / Pause / Next Step
// - Python-like pseudocode shown in Tree view
// - Speed slider 1..10 mapped to ms delay

export default function HeapVisualizer() {
  const [heap, setHeap] = useState([]);
  const [value, setValue] = useState(0);
  const [pseudo, setPseudo] = useState("");
  const [running, setRunning] = useState(false); // playing state (interval running)
  const [speedLevel, setSpeedLevel] = useState(5); // 1..10 UI
  const [speedMs, setSpeedMs] = useState(600); // actual ms per step
  const [highlight, setHighlight] = useState({}); // { type, indices }

  // Steps storage (mutable refs so timer callback reads latest)
  const stepsRef = useRef([]);
  const stepIndexRef = useRef(0);
  const timerRef = useRef(null);

  // Convert speedLevel -> ms
  useEffect(() => {
    const newSpeed = 1200 - (speedLevel - 1) * ((1200 - 100) / 9);
    setSpeedMs(Math.round(newSpeed));
  }, [speedLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
        const tmp = arr[i];
        arr[i] = arr[parent];
        arr[parent] = tmp;
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

    const lastIndex = arr.length - 1;
    steps.push({ type: "removeRoot", arr: arr.slice(), info: { root: 0, last: lastIndex } });

    if (lastIndex === 0) {
      arr.pop();
      steps.push({ type: "done", arr: arr.slice() });
      return steps;
    }

    // swap root and last
    const rootVal = arr[0];
    arr[0] = arr[lastIndex];
    arr[lastIndex] = rootVal;
    steps.push({ type: "swap", arr: arr.slice(), info: { i: 0, j: lastIndex } });

    // pop
    arr.pop();
    steps.push({ type: "pop", arr: arr.slice(), info: { removedIndex: lastIndex } });

    // bubble down
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

  // Start a new sequence of steps
  function startSteps(steps) {
    if (!steps || steps.length === 0) return;
    // stop any running timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    stepsRef.current = steps;
    // show initial state (first step arr) and set next index to 1 so runStep processes step 1
    setHeap(steps[0].arr.slice());

    // ====== FIX: immediately show pseudo & highlight for the first step ======
    applyStep(steps[0]);

    stepIndexRef.current = 1;
    setHighlight((h) => h); // keep whatever applyStep set
    setRunning(false); // start paused; user chooses Play / Next
  }

  // Apply a single step (highlight + pseudo + set heap)
  function applyStep(s) {
    if (!s) return;
    setHeap(s.arr.slice());

    if (s.type === "compare") {
      // compare: either (i,parent) or (i,smaller)
      const a = s.info.i;
      const b = s.info.parent ?? s.info.smaller;
      setHighlight({ type: "compare", indices: [a, b] });
      setPseudo(`# compare child & parent\nif heap[${a}] < heap[${b}]:\n    # swap on next step`);
    } else if (s.type === "swap") {
      const a = s.info.i;
      const b = s.info.j ?? s.info.parent;
      setHighlight({ type: "swap", indices: [a, b] });
      setPseudo(`# swap\nswap(heap[${a}], heap[${b}])`);
    } else if (s.type === "push") {
      const idx = s.info.index;
      setHighlight({ type: "push", indices: [idx] });
      setPseudo(`# insert new value\nheap.append(${s.arr[idx]})`);
    } else if (s.type === "pop") {
      setHighlight({ type: "pop", indices: [s.info.removedIndex] });
      setPseudo(`# remove last\nheap.pop()`);
    } else if (s.type === "removeRoot") {
      setHighlight({ type: "removeRoot", indices: [s.info.root, s.info.last] });
      setPseudo(`# delete-min begins\nswap(heap[0], heap[${s.info.last}])`);
    } else if (s.type === "done") {
      setHighlight({ type: "done", indices: [] });
      setPseudo(`# heap property restored`);
    } else {
      setHighlight({});
      setPseudo("");
    }
  }

  // Run a single step (used by Next Step and by interval)
  function runStep() {
    const steps = stepsRef.current;
    const idx = stepIndexRef.current;
    if (!steps || idx >= steps.length) {
      // finished
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRunning(false);
      setHighlight({});
      return;
    }

    const s = steps[idx];
    applyStep(s);

    // advance index
    stepIndexRef.current = idx + 1;
  }

  // Play: start interval timer
  function handlePlay() {
    if (running) return;
    // ensure there are steps
    const steps = stepsRef.current;
    if (!steps || stepIndexRef.current >= steps.length) return;

    setRunning(true);
    // clear any existing timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      runStep();
    }, speedMs);
  }

  // Pause
  function handlePause() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }

  // Next Step (manual)
  function handleNext() {
    // ensure not running (or allow stepping while running?) — we'll allow manual step regardless
    if (running && timerRef.current) {
      // if running, pause first so user sees single step control
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
    }
    runStep();
  }

  // Controls to start insert/delete flows
  function handleInsert() {
    const v = Number(value);
    if (Number.isNaN(v)) return;
    const steps = generateInsertSteps(heap.slice(), v);
    startSteps(steps);
  }

  function handleRandomInsert() {
    const v = Math.floor(Math.random() * 100);
    const steps = generateInsertSteps(heap.slice(), v);
    startSteps(steps);
  }

  function handleDeleteMin() {
    const steps = generateDeleteMinSteps(heap.slice());
    startSteps(steps);
  }

  // Restart interval when speed changes while running
  useEffect(() => {
    if (!running) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => runStep(), speedMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedMs]);

  // Tree layout
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

  // ====== NEW: inline style fallback so highlight is visible even if Tailwind ring utilities are missing ======
  function nodeStyle(i) {
    if (!highlight || !highlight.indices) return {};
    if (!highlight.indices.includes(i)) return {};
    const map = {
      swap: "rgba(250,204,21,0.30)", // yellow-ish
      compare: "rgba(59,130,246,0.22)", // blue-ish
      push: "rgba(34,197,94,0.22)", // green-ish
      pop: "rgba(148,163,184,0.18)", // grey-ish
      removeRoot: "rgba(239,68,68,0.22)", // red-ish
    };
    const color = map[highlight.type] || "rgba(99,102,241,0.2)";
    return { boxShadow: `0 0 0 8px ${color}` };
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

          <div className="flex gap-2 mb-3 items-center">
            <button onClick={handleDeleteMin} className="px-3 py-2 bg-red-600 text-white rounded">Delete Min</button>

            <button onClick={handlePlay} className="px-3 py-2 bg-slate-700 text-white rounded">Play</button>
            <button onClick={handlePause} className="px-3 py-2 bg-slate-500 text-white rounded">Pause</button>

            <button onClick={handleNext} className="px-3 py-2 bg-indigo-600 text-white rounded">Next Step</button>

            <div className="flex flex-col ml-2 w-full">
              <label className="font-medium mb-1">Speed</label>
              <input
                type="range"
                min="1"
                max="10"
                value={speedLevel}
                onChange={(e) => setSpeedLevel(Number(e.target.value))}
                className="w-full"
                list="speed-ticks"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>Slow</span>
                <span>Fast</span>
              </div>
              <datalist id="speed-ticks">
                <option value="1" />
                <option value="2" />
                <option value="3" />
                <option value="4" />
                <option value="5" />
                <option value="6" />
                <option value="7" />
                <option value="8" />
                <option value="9" />
                <option value="10" />
              </datalist>
            </div>
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
                  style={nodeStyle(i)} // <- apply inline highlight fallback here
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
                  <div
                    className={`w-12 h-12 rounded-full border flex items-center justify-center text-sm font-semibold bg-white shadow ${nodeClass(i)}`}
                    style={nodeStyle(i)} // <- fallback here too
                  >
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

          {/* Pseudo Code Box (inside tree view) */}
          <div className="mt-4 bg-white rounded shadow p-3">
            <h3 className="font-semibold text-sm mb-1">Current Step (Pseudo Code)</h3>
            <pre className="text-sm text-indigo-700 whitespace-pre-wrap leading-tight">{pseudo}</pre>
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
