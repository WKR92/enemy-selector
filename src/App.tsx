import { useEffect, useMemo, useState } from "react";

type Strength = 1 | 2 | 3 | 4;

type Enemy = {
  id: number;
  strength: Strength;
};

type Segment = {
  enemyId: number;
  enemyStrength: Strength;
  segIndex: number;
};

const strengthOrderDesc: Strength[] = [4, 3, 2, 1];

function buildEnemies(counts: Record<Strength, number>): Enemy[] {
  let idCounter = 1;
  const list: Enemy[] = [];
  for (const s of strengthOrderDesc) {
    for (let i = 0; i < (counts[s] ?? 0); i++) {
      list.push({ id: idCounter++, strength: s });
    }
  }
  return list;
}

function buildTrack(enemies: Enemy[]): Segment[] {
  const ordered = enemies
    .slice()
    .sort((a, b) => b.strength - a.strength || a.id - b.id);
  const segs: Segment[] = [];
  for (const e of ordered) {
    for (let i = 1; i <= e.strength; i++) {
      segs.push({ enemyId: e.id, enemyStrength: e.strength, segIndex: i });
    }
  }
  return segs;
}

function pickRandomEnemy(enemies: Enemy[]): Enemy {
  return enemies[Math.floor(Math.random() * enemies.length)];
}

function firstSegmentIndexOfEnemy(track: Segment[], enemyId: number): number {
  return track.findIndex((seg) => seg.enemyId === enemyId);
}

// --- helpers for localStorage ---
function saveState(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // inputs
  const [c4, setC4] = useState<string>(() => loadState("c4", ""));
  const [c3, setC3] = useState<string>(() => loadState("c3", ""));
  const [c2, setC2] = useState<string>(() => loadState("c2", ""));
  const [c1, setC1] = useState<string>(() => loadState("c1", ""));

  // game state
  const [enemies, setEnemies] = useState<Enemy[]>(() =>
    loadState("enemies", [])
  );
  const [track, setTrack] = useState<Segment[]>(() => loadState("track", []));
  const [cursor, setCursor] = useState<number>(() => loadState("cursor", 0));
  const [aliveRoundTouched, setAliveRoundTouched] = useState<Set<number>>(
    () => new Set(loadState("aliveRoundTouched", []))
  );
  const [roundCount, setRoundCount] = useState<number>(() =>
    loadState("roundCount", 1)
  );
  const [needsRoundStart, setNeedsRoundStart] = useState<boolean>(() =>
    loadState("needsRoundStart", false)
  );

  const [roll, setRoll] = useState<string>(() => loadState("roll", ""));

  // save to localStorage on change
  useEffect(() => saveState("c4", c4), [c4]);
  useEffect(() => saveState("c3", c3), [c3]);
  useEffect(() => saveState("c2", c2), [c2]);
  useEffect(() => saveState("c1", c1), [c1]);
  useEffect(() => saveState("roll", roll), [roll]);
  useEffect(() => saveState("enemies", enemies), [enemies]);
  useEffect(() => saveState("track", track), [track]);
  useEffect(() => saveState("cursor", cursor), [cursor]);
  useEffect(() => saveState("roundCount", roundCount), [roundCount]);
  useEffect(
    () => saveState("needsRoundStart", needsRoundStart),
    [needsRoundStart]
  );
  useEffect(
    () => saveState("aliveRoundTouched", Array.from(aliveRoundTouched)),
    [aliveRoundTouched]
  );

  const totalLen = track.length;
  const currentSeg = track[cursor];

  const orderedDisplay = useMemo(
    () =>
      enemies.slice().sort((a, b) => b.strength - a.strength || a.id - b.id),
    [enemies]
  );
  const hasPotenzni = useMemo(
    () => enemies.some((e) => e.strength === 4),
    [enemies]
  );

  function rebuildTrackAndClampCursor(
    nextEnemies: Enemy[],
    preferredEnemyId?: number
  ) {
    const t = buildTrack(nextEnemies);
    setTrack(t);

    if (t.length === 0) {
      setCursor(0);
      setAliveRoundTouched(new Set());
      setRoundCount(0);
      setNeedsRoundStart(false);
      return;
    }

    if (preferredEnemyId != null) {
      const pos = firstSegmentIndexOfEnemy(t, preferredEnemyId);
      if (pos >= 0) {
        setCursor(pos);
        setAliveRoundTouched(new Set([preferredEnemyId]));
        return;
      }
    }

    if (track.length > 0) {
      const currentEnemyId = track[cursor]?.enemyId;
      const pos = t.findIndex((s) => s.enemyId === currentEnemyId);
      if (pos >= 0) {
        setCursor(pos);
        setAliveRoundTouched(new Set([currentEnemyId]));
        return;
      }
    }

    setCursor(0);
    setAliveRoundTouched(new Set([t[0].enemyId]));
  }

  function handleReady() {
    const toInt = (v: string) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const counts: Record<Strength, number> = {
      4: toInt(c4),
      3: toInt(c3),
      2: toInt(c2),
      1: toInt(c1),
    };

    const init = buildEnemies(counts);
    if (init.length === 0) {
      resetBoardOnly();
      return;
    }
    setEnemies(init);
    const t = buildTrack(init);
    setTrack(t);

    const chosen = pickRandomEnemy(init);
    const pos = firstSegmentIndexOfEnemy(t, chosen.id);
    setCursor(pos >= 0 ? pos : 0);
    setAliveRoundTouched(new Set([chosen.id]));
    setRoundCount(1);
    setNeedsRoundStart(false);
  }

  function resetBoardOnly() {
    setEnemies([]);
    setTrack([]);
    setCursor(0);
    setAliveRoundTouched(new Set());
    setRoundCount(0);
    setNeedsRoundStart(false);
  }

  function resetAll() {
    resetBoardOnly();
    setC4("");
    setC3("");
    setC2("");
    setC1("");
    setRoll("");
  }

  function selectNewRoundStart(): number {
    const chosen = pickRandomEnemy(enemies);
    const pos = firstSegmentIndexOfEnemy(track, chosen.id);
    if (pos >= 0) setCursor(pos);
    setAliveRoundTouched(new Set([chosen.id]));
    setRoundCount((rc) => rc + 1);
    return chosen.id;
  }

  function applyRoll() {
    if (track.length === 0) return;
    if (needsRoundStart) {
      selectNewRoundStart();
      setNeedsRoundStart(false);
    }

    const parsed = Math.floor(Number(roll));
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

    const step = Math.max(0, safe) + 1;
    const lastIndex = totalLen - 1;
    const willWrap = cursor + step > lastIndex;
    const dest = (cursor + step) % totalLen;
    const touchedThisRound = new Set(aliveRoundTouched);

    if (!willWrap) {
      setCursor(dest);
      if (track[dest]) touchedThisRound.add(track[dest].enemyId);
      setAliveRoundTouched(touchedThisRound);
      return;
    }

    setCursor(dest);
    const anyS4Touched =
      hasPotenzni &&
      [...touchedThisRound].some((id) =>
        enemies.find((e) => e.id === id && e.strength === 4)
      );

    if (hasPotenzni && !anyS4Touched) {
      const s4pool = enemies.filter((e) => e.strength === 4);
      if (s4pool.length > 0) {
        const chosenS4 = pickRandomEnemy(s4pool);
        const posS4 = firstSegmentIndexOfEnemy(track, chosenS4.id);
        if (posS4 >= 0) {
          setCursor(posS4);
          touchedThisRound.add(chosenS4.id);
          setAliveRoundTouched(touchedThisRound);
        }
      }
      setNeedsRoundStart(true);
    } else {
      selectNewRoundStart();
    }
  }

  function killEnemy(enemyId: number) {
    const remaining = enemies.filter((e) => e.id !== enemyId);
    if (remaining.length === 0) {
      resetBoardOnly();
      return;
    }
    setEnemies(remaining);

    const chosen = pickRandomEnemy(remaining);
    rebuildTrackAndClampCursor(remaining, chosen.id);
  }

  function addEnemy(strength: Strength) {
    const nextId = (enemies.reduce((m, e) => Math.max(m, e.id), 0) || 0) + 1;
    const next = enemies.concat([{ id: nextId, strength }]);
    setEnemies(next);
    rebuildTrackAndClampCursor(next);
  }

  function renderEnemyColumns() {
    if (enemies.length === 0) return null;

    const activeEnemyId = currentSeg?.enemyId;
    const activeSegIndex = currentSeg?.segIndex;

    return (
      <div className="enemy-row">
        {orderedDisplay.map((e) => (
          <div key={e.id} className="col">
            <div className="col-head">
              <span className="col-id">#{e.id}</span>
              <span className="col-meta">S{e.strength}</span>
            </div>
            <div className="seq">
              {Array.from({ length: e.strength }, (_, i) => i + 1).map(
                (n, idx) => (
                  <span key={n}>
                    <span
                      className={
                        "num" +
                        (e.id === activeEnemyId && n === activeSegIndex
                          ? " active"
                          : "")
                      }
                    >
                      {n}
                    </span>
                    {idx < e.strength - 1 && <span className="comma">,</span>}
                  </span>
                )
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              <button className="small" onClick={() => killEnemy(e.id)}>
                remove ×
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Which Enemy Reacts</h1>

      <div className="controls">
        <label className="control">
          Powerful (4)
          <input
            type="number"
            min={0}
            value={c4}
            placeholder="0"
            onChange={(e) => setC4(e.target.value)}
          />
        </label>
        <label className="control">
          Strong (3)
          <input
            type="number"
            min={0}
            value={c3}
            placeholder="0"
            onChange={(e) => setC3(e.target.value)}
          />
        </label>
        <label className="control">
          Regular (2)
          <input
            type="number"
            min={0}
            value={c2}
            placeholder="0"
            onChange={(e) => setC2(e.target.value)}
          />
        </label>
        <label className="control">
          Easy (1)
          <input
            type="number"
            min={0}
            value={c1}
            placeholder="0"
            onChange={(e) => setC1(e.target.value)}
          />
        </label>
        <div className="controls-actions">
          <button onClick={handleReady}>Ready</button>
          <button onClick={resetAll}>Reset</button>
        </div>
      </div>

      <hr />

      <div>
        <strong>Enemies:</strong>
        {enemies.length === 0 ? (
          <span className="small">
            {" "}
            none (set counts above and click Ready).
          </span>
        ) : (
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => addEnemy(4)}>+ S4</button>
            <button onClick={() => addEnemy(3)}>+ S3</button>
            <button onClick={() => addEnemy(2)}>+ S2</button>
            <button onClick={() => addEnemy(1)}>+ S1</button>
          </div>
        )}
      </div>

      {track.length > 0 && (
        <>
          <hr />
          {renderEnemyColumns()}

          <div style={{ height: 12 }} />
          <div className="small">
            Round: {roundCount} • Cursor: {cursor + 1}/{totalLen}
            {needsRoundStart ? " • (next click: start new round)" : ""}
          </div>

          <hr />
          <div className="row roll-row">
            <label className="roll-label">
              Main die result
              <input
                type="number"
                min={0}
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
              />
            </label>
            <button onClick={applyRoll}>Apply roll → advance</button>
          </div>
          <div className="small shift-help">
            Shift = (result + 1). When wrapping past the end: if no S4 acted
            this round, we force a random S4 to act and mark it. The button click
            calculates enemies reaction order.
          </div>
        </>
      )}
    </div>
  );
}
