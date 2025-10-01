import { useMemo, useState } from "react";

type Strength = 1 | 2 | 3 | 4;

type Enemy = {
  id: number; // etykieta
  strength: Strength; // 1/2/3/4
};

type Segment = {
  enemyId: number;
  enemyStrength: Strength;
  segIndex: number; // 1..strength
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
  // Kolejność segmentów na torze: najpierw wszyscy S4 (4 segmenty każdy), potem S3 (3), S2 (2), S1 (1)
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

// Losowy wróg z podanej puli (równomiernie)
function pickRandomEnemy(enemies: Enemy[]): Enemy {
  return enemies[Math.floor(Math.random() * enemies.length)];
}

// Indeks pierwszego segmentu danego wroga na torze
function firstSegmentIndexOfEnemy(track: Segment[], enemyId: number): number {
  return track.findIndex((seg) => seg.enemyId === enemyId);
}

export default function App() {
  // Formularz startowy
  const [c4, setC4] = useState(0);
  const [c3, setC3] = useState(0);
  const [c2, setC2] = useState(0);
  const [c1, setC1] = useState(0);

  // Stan gry
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [track, setTrack] = useState<Segment[]>([]);
  const [cursor, setCursor] = useState<number>(0); // indeks w "track"
  const [aliveRoundTouched, setAliveRoundTouched] = useState<Set<number>>(
    new Set()
  );
  const [roundCount, setRoundCount] = useState(1);
  const [needsRoundStart, setNeedsRoundStart] = useState<boolean>(false);

  // Input rzutu (bez krytyków)
  const [roll, setRoll] = useState<number>(1);

  // Pomocnicze
  const totalLen = track.length;
  const currentSeg = track[cursor];

  // >>> Wyświetlaj przeciwników posortowanych: S malejąco, potem id rosnąco.
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

    // Spróbuj zachować obecnego wroga
    if (track.length > 0) {
      const currentEnemyId = track[cursor]?.enemyId;
      const pos = t.findIndex((s) => s.enemyId === currentEnemyId);
      if (pos >= 0) {
        setCursor(pos);
        setAliveRoundTouched(new Set([currentEnemyId]));
        return;
      }
    }

    // Fallback – początek
    setCursor(0);
    setAliveRoundTouched(new Set([t[0].enemyId]));
  }

  function handleReady() {
    const counts: Record<Strength, number> = { 4: c4, 3: c3, 2: c2, 1: c1 };
    const init = buildEnemies(counts);
    if (init.length === 0) {
      resetBoardOnly();
      return;
    }
    setEnemies(init);
    const t = buildTrack(init);
    setTrack(t);

    // Start: po prostu losowy wróg z całej puli
    const chosen = pickRandomEnemy(init);
    const pos = firstSegmentIndexOfEnemy(t, chosen.id);
    setCursor(pos >= 0 ? pos : 0);
    setAliveRoundTouched(new Set([chosen.id]));
    setRoundCount(1);
    setNeedsRoundStart(false);
  }

  // --- Reset ---
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
    setC4(0);
    setC3(0);
    setC2(0);
    setC1(0);
  }

  // Start nowej rundy (losowy wróg)
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

    const step = Math.max(0, Math.floor(roll)) + 1; // bez krytyków
    const lastIndex = totalLen - 1;

    const willWrap = cursor + step > lastIndex;
    const dest = (cursor + step) % totalLen;

    // Zbiór dotkniętych W TEJ rundzie (przed ewentualnym wrapem)
    const touchedThisRound = new Set(aliveRoundTouched);

    if (!willWrap) {
      // Normalny ruch w obrębie tej samej puli segmentów
      setCursor(dest);
      if (track[dest]) touchedThisRound.add(track[dest].enemyId);
      setAliveRoundTouched(touchedThisRound);
      return;
    }

    // --- KONIEC RUNDY (wrap) ---
    // UWAGA: NIE dodajemy track[dest].enemyId – to już byłaby „nowa runda”.
    setCursor(dest);

    // Czy w tej rundzie działał jakikolwiek S4?
    const anyS4Touched =
      hasPotenzni &&
      [...touchedThisRound].some((id) =>
        enemies.find((e) => e.id === id && e.strength === 4)
      );

    console.log("hasPotenzni", hasPotenzni);
    console.log("anyS4Touched", anyS4Touched);

    if (hasPotenzni && !anyS4Touched) {
      console.log("Potężny nie reagiwał w tej rundzie - wymuszenie!");
      // Wymuszenie: losowy S4, zaznacz go jako „dotknięty” w TEJ (właśnie kończonej) rundzie
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
      // Nowa runda wystartuje przy następnym kliknięciu
      setNeedsRoundStart(true);
    } else {
      // Nie trzeba wymuszać → od razu start nowej rundy
      console.log("Nie trzeba wymuszać → od razu start nowej rundy.");
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

    // Losowy nowy cel i skok na jego 1. segment
    const chosen = pickRandomEnemy(remaining);
    rebuildTrackAndClampCursor(remaining, chosen.id);
  }

  function addEnemy(strength: Strength) {
    const nextId = (enemies.reduce((m, e) => Math.max(m, e.id), 0) || 0) + 1;
    const next = enemies.concat([{ id: nextId, strength }]);

    // „Posegreguj istniejących” po dodaniu: nie zmieniamy ID, ale
    // lista wyświetlana i tor i tak są porządkowane (tor już przez buildTrack).
    setEnemies(next);
    rebuildTrackAndClampCursor(next);
  }

  // ----- Widok kart przeciwników -----
  function renderEnemyColumns() {
    if (enemies.length === 0) return null;

    // Aktywna komórka: enemyId = currentSeg.enemyId, segIndex = currentSeg.segIndex
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
            <div className="seq" aria-label={`Segmenty wroga #${e.id}`}>
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
                usuń ×
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Który wróg reaguje</h1>

      <div className="row">
        <label>
          Potężny (4):
          <input
            type="number"
            min={0}
            value={c4}
            onChange={(e) => setC4(parseInt(e.target.value || "0"))}
          />
        </label>
        <label>
          Silny (3):
          <input
            type="number"
            min={0}
            value={c3}
            onChange={(e) => setC3(parseInt(e.target.value || "0"))}
          />
        </label>
        <label>
          Zwykły (2):
          <input
            type="number"
            min={0}
            value={c2}
            onChange={(e) => setC2(parseInt(e.target.value || "0"))}
          />
        </label>
        <label>
          Łatwy (1):
          <input
            type="number"
            min={0}
            value={c1}
            onChange={(e) => setC1(parseInt(e.target.value || "0"))}
          />
        </label>
        <button onClick={handleReady}>Ready</button>
        <button onClick={resetAll}>Zresetuj</button>
      </div>

      <hr />

      <div>
        <strong>Wrogowie:</strong>
        {enemies.length === 0 ? (
          <span className="small">
            {" "}
            brak (ustaw liczby powyżej i kliknij Ready).
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
            Runda: {roundCount} • Pozycja kursora: {cursor + 1}/{totalLen}
            {needsRoundStart
              ? " • (następne kliknięcie: start nowej rundy)"
              : ""}
          </div>

          <hr />
          <div className="row">
            <label>
              Wynik głównej kości:
              <input
                type="number"
                min={0}
                value={roll}
                onChange={(e) => setRoll(parseInt(e.target.value || "0"))}
              />
            </label>
            <button onClick={applyRoll}>Zatwierdź rzut → przesuń</button>
          </div>
          <div className="small">
            Przesunięcie = (wynik + 1). Po przejściu całej puli: jeśli w tej
            rundzie żaden S4 nie działał, wymusimy losowego S4 i pokażemy to na
            znaczniku. Nowa runda wystartuje przy następnym kliknięciu.
          </div>
        </>
      )}
    </div>
  );
}
