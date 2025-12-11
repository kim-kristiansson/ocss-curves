import React, { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { compileScenario, exampleScenario, type Step, type CompiledScenario } from "./scenario";
import "./App.css";
import { ScenarioEditor } from "./ScenarioEditor";

// ---- effect intensity tuning ----
const TEMP_NOISE_BASE = 0.5;      // tiny default noise (°C)
const CARBON_NOISE_BASE = 0.015;
// ---------------------------------

/** Deterministisk RNG (valfritt för instant) */
function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967295;
    };
}

/** --- Interval helper that avoids stale closures --- **/
function useInterval(fn: () => void, ms: number, running: boolean) {
    const saved = useRef(fn);
    useEffect(() => {
        saved.current = fn;
    }, [fn]);
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => saved.current(), ms);
        return () => clearInterval(id);
    }, [ms, running]);
}

/** Debounced effect (for instant preview while dragging sliders) */
function useDebouncedEffect(effect: () => void, deps: any[], delay = 100) {
    const cleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (cleanup.current) clearTimeout(cleanup.current);
        cleanup.current = setTimeout(() => effect(), delay);
        return () => {
            if (cleanup.current) clearTimeout(cleanup.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

/** --- Types --- **/
interface Point {
    t: number;
    temp: number;
    carbon: number;
    tempTarget: number;
    carbonTarget: number;
}
interface RampTrack {
    from: number;
    to: number;
    start: number; // minuter
    end: number; // minuter
}
interface State {
    running: boolean;
    speed: number;
    dt: number;
    samplesPerMin: number;
    t: number;
    temp: number;
    tempTarget: number;
    carbon: number;
    carbonTarget: number;
    data: Point[];
    scenarioTotal: number;
    finished: boolean;
    tempTrack?: RampTrack;
    carbonTrack?: RampTrack;
    startTemp: number;
    startCarbon: number;
}

type Action =
    | { type: "TOGGLE" }
    | { type: "SET_SPEED"; speed: number }
    | { type: "SET_DT"; dt: number }
    | { type: "SET_SPM"; spm: number }
    | { type: "RESET" }
    | { type: "TICK"; compiled: CompiledScenario }
    | { type: "INSTANT"; compiled: CompiledScenario }
    | { type: "SET_START_TEMP"; value: number }
    | { type: "SET_START_CARBON"; value: number };

const initial: State = {
    running: false,
    speed: 1,
    dt: 0.2,
    samplesPerMin: 2,
    t: 0,
    startTemp: 200,
    startCarbon: 0.2,
    temp: 200,
    carbon: 0.2,
    tempTarget: 200,
    carbonTarget: 0.2,
    data: [],
    scenarioTotal: 0,
    finished: false,
};

function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
}

/* -------------------- stepOnce (render-only noise; integrating drift; applies offset) -------------------- */
function stepOnce(
    state: {
        tPrev: number;
        dtMin: number;
        temp: number;
        carbon: number;
        tempTargetPrev: number;
        carbonTargetPrev: number;
        tempTrack?: RampTrack;
        carbonTrack?: RampTrack;
    },
    compiled: CompiledScenario,
    randFn?: () => number
) {
    const rand = randFn ?? Math.random;

    const { tPrev, dtMin } = state;
    const endT = compiled.totalDuration;
    const tNext = Math.min(tPrev + dtMin, endT);
    const EPS = 1e-12;

    // Targets / effects (read-only) and one-shot impulses (spikes, offsets) for this tick
    const { tempTarget, carbonTarget } = compiled.getTargetsAt(tNext);
    const effLegacy = compiled.getDisturbanceAt(tNext);  // legacy: drift is a *rate*
    const fx        = compiled.getEffectsAt(tNext);      // windows: driftPerMin is a *rate*
    const spikes    = compiled.getSpikesIfBoundaryCrossed(tPrev, tNext); // includes offsets as one-shot spikes

    // Deadlines / settle windows -> ramp windows
    const { tempDeadlineMin, carbonDeadlineMin } = compiled.getDeadlinesAt(tNext);
    const settleEnds = compiled.getSettleEndsIfTargetChanged(tPrev, tNext);

    const tempEnd   = (settleEnds.tempSettleEnd   ?? tempDeadlineMin   ?? state.tempTrack?.end   ?? tNext);
    const carbonEnd = (settleEnds.carbonSettleEnd ?? carbonDeadlineMin ?? state.carbonTrack?.end ?? tNext);

    // (Re)start ramp tracks if target changed
    let tempTrack = state.tempTrack;
    let carbonTrack = state.carbonTrack;

    const tempChanged   = Math.abs(tempTarget   - state.tempTargetPrev)   > EPS;
    const carbonChanged = Math.abs(carbonTarget - state.carbonTargetPrev) > EPS;

    function startTrack(
        prev: RampTrack | undefined,
        from: number,
        to: number,
        start: number,
        end: number
    ): RampTrack {
        if (Math.abs(to - from) < EPS) return prev ?? { from, to, start, end };
        const safeEnd = end <= start ? start + 1e-6 : end; // avoid zero-length
        return { from, to, start, end: safeEnd };
    }

    if (tempChanged || settleEnds.tempSettleEnd !== undefined) {
        tempTrack = startTrack(tempTrack, state.temp, tempTarget, tNext, tempEnd);
    }
    if (carbonChanged || settleEnds.carbonSettleEnd !== undefined) {
        carbonTrack = startTrack(carbonTrack, state.carbon, carbonTarget, tNext, carbonEnd);
    }

    // Baseline interpolation
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
    const progress = (track?: RampTrack): number => {
        if (!track) return 1;
        if (tNext <= track.start) return 0;
        if (tNext >= track.end) return 1;
        return (tNext - track.start) / Math.max(EPS, track.end - track.start);
    };

    const uT = progress(tempTrack);

    // Temperature: use track interpolation (no drift effects on temp)
    let baseTemp = tempTrack ? lerp(tempTrack.from, tempTrack.to, uT) : state.temp;

    // Snap temp at ramp end
    if (tempTrack && tNext >= tempTrack.end) {
        baseTemp = tempTarget;
        tempTrack = undefined;
    }

    // ---------- Carbon: always build from state to allow drift accumulation ----------
    const legacyCarbonDriftRate = effLegacy?.carbon?.drift ?? 0;
    const fxCarbonDriftRate     = fx?.carbon?.driftPerMin ?? 0;
    const driftRate = legacyCarbonDriftRate + fxCarbonDriftRate;

    // Spikes: includes legacy spikes + one-shot offsets injected by compiler
    const legacyCarbonSpike = effLegacy?.carbon?.spike ?? 0;
    const tbSpike           = spikes?.carbonSpike ?? 0;

    // Flatline freezes carbon state
    const isCarbonFlatline = !!(effLegacy?.carbon?.flatline) || !!(fx?.carbon?.flatline);

    let baseCarbon: number;
    if (isCarbonFlatline) {
        baseCarbon = state.carbon;
    } else if (carbonTrack && tNext < carbonTrack.end) {
        // During ramp: move from current state toward target at ramp-determined rate
        // NO drift during ramp - drift only applies during hold
        const timeRemaining = Math.max(EPS, carbonTrack.end - tNext);
        const valueRemaining = carbonTarget - state.carbon;
        const rampMove = (valueRemaining / timeRemaining) * dtMin;
        baseCarbon = state.carbon + rampMove;
    } else {
        // No active ramp (hold phase): apply drift
        const driftDelta = driftRate * dtMin;
        baseCarbon = state.carbon + driftDelta;
    }

    // Snap carbon at ramp end
    if (carbonTrack && tNext >= carbonTrack.end) {
        // Don't snap to target - keep accumulated drift by using current calculated value
        carbonTrack = undefined;
    }

    // Add spikes
    baseCarbon += legacyCarbonSpike + tbSpike;

    const nextTempState = clamp(baseTemp, 0, 1100);
    const nextCarbonState = clamp(baseCarbon, 0, 1.6);

    // ---------- DISPLAY noise (does not affect state) ----------
    const noiseScale = Math.sqrt(Math.max(dtMin, 1 / 60)); // ≥1s baseline

    // Temp: tiny render-only noise
    const tempNoise = (rand() - 0.5) * TEMP_NOISE_BASE * noiseScale;

    // Carbon noise enabled when either source requests it
    const carbonNoiseFactor = Math.max(
        effLegacy?.carbon?.noiseFactor ?? 0,
        fx?.carbon?.noiseFactor ?? 0
    );
    const carbonNoise = carbonNoiseFactor > 0
        ? (rand() - 0.5) * (CARBON_NOISE_BASE * carbonNoiseFactor) * noiseScale
        : 0;

    const displayTemp   = clamp(nextTempState   + tempNoise,   0, 1100);
    const displayCarbon = clamp(nextCarbonState + carbonNoise, 0, 1.6);

    const point: Point = {
        t: tNext,
        temp: displayTemp,
        carbon: displayCarbon,
        tempTarget,
        carbonTarget,
    };

    const reachedEnd = tNext >= endT;

    return {
        t: tNext,
        temp: nextTempState,       // state (noise-free)
        carbon: nextCarbonState,   // state (noise-free)
        tempTarget,
        carbonTarget,
        tempTrack,
        carbonTrack,
        point,                     // display point (with noise)
        reachedEnd,
    };
}

/* ---------------- end stepOnce -------------------- */

/** Hjälpare: hitta "övergångsmarkörer" nära t för adaptiv sampling */
function onTransitionWindow(compiled: CompiledScenario, t: number) {
    const { tempDeadlineMin, carbonDeadlineMin } = compiled.getDeadlinesAt(t);
    const s = compiled.getSettleEndsIfTargetChanged(t - 1e-6, t + 1e-6);
    const marks: number[] = [];
    if (tempDeadlineMin !== undefined) marks.push(tempDeadlineMin);
    if (carbonDeadlineMin !== undefined) marks.push(carbonDeadlineMin);
    if (s.tempSettleEnd !== undefined) marks.push(s.tempSettleEnd);
    if (s.carbonSettleEnd !== undefined) marks.push(s.carbonSettleEnd);
    return marks;
}

function simulateInstant(s: State, compiled: CompiledScenario, baseSpm: number) {
    const total = compiled.totalDuration;
    let tPrev = 0;
    let temp = s.startTemp;
    let carbon = s.startCarbon;

    const set0 = compiled.getTargetsAt(0);
    let tempTargetPrev = s.startTemp;
    let carbonTargetPrev = s.startCarbon;

    let tempTrack: RampTrack | undefined;
    let carbonTrack: RampTrack | undefined;

    const data: Point[] = [{ t: 0, temp, carbon, tempTarget: set0.tempTarget, carbonTarget: set0.carbonTarget }];

    // Deterministisk RNG
    const rng = mulberry32(1337);
    const rand = () => rng();

    // Denser instant sampling so spikes/noise look closer to live
    const MIN_SPM = Math.max(3, baseSpm);
    const MAX_SPM = Math.max(baseSpm, baseSpm * 12);

    while (tPrev < total) {
        // Heuristik för aktivitet
        const targets = compiled.getTargetsAt(tPrev);
        const rampingTemp = !!tempTrack || Math.abs(targets.tempTarget - tempTargetPrev) > 1e-9;
        const rampingC = !!carbonTrack || Math.abs(targets.carbonTarget - carbonTargetPrev) > 1e-9;

        const distT = Math.min(1, Math.abs(targets.tempTarget - temp) / 50);
        const distC = Math.min(1, Math.abs(targets.carbonTarget - carbon) / 0.05);

        const marks = onTransitionWindow(compiled, tPrev);
        const nearMark = marks.some((m) => Math.abs(m - tPrev) < 0.5);

        const activity = (rampingTemp ? 1 : 0) + (rampingC ? 1 : 0) + (nearMark ? 1 : 0) + distT + distC;
        const spm = clamp(MIN_SPM + activity * (MAX_SPM - MIN_SPM), MIN_SPM, MAX_SPM);
        const dt = 1 / spm;

        const step = stepOnce(
            {
                tPrev,
                dtMin: Math.min(dt, total - tPrev),
                temp,
                carbon,
                tempTargetPrev,
                carbonTargetPrev,
                tempTrack,
                carbonTrack,
            },
            compiled,
            rand
        );

        data.push(step.point);           // noisy display point
        tPrev = step.t;
        temp = step.temp;                // state (noise-free)
        carbon = step.carbon;            // state (noise-free)
        tempTargetPrev = step.tempTarget;
        carbonTargetPrev = step.carbonTarget;
        tempTrack = step.tempTrack;
        carbonTrack = step.carbonTrack;
        if (step.reachedEnd) break;
    }

    return { data, t: total, temp, carbon, tempTarget: tempTargetPrev, carbonTarget: carbonTargetPrev };
}

function reducer(s: State, a: Action): State {
    switch (a.type) {
        case "SET_START_TEMP":
            return { ...s, startTemp: a.value };
        case "SET_START_CARBON":
            return { ...s, startCarbon: a.value };
        case "SET_SPEED":
            return { ...s, speed: a.speed };
        case "SET_DT":
            return { ...s, dt: a.dt };
        case "SET_SPM":
            return { ...s, samplesPerMin: Math.max(0.1, a.spm) };
        case "TOGGLE":
            return { ...s, running: !s.running };
        case "RESET":
            return {
                ...s,
                running: false,
                finished: false,
                t: 0,
                temp: s.startTemp,
                carbon: s.startCarbon,
                tempTarget: s.startTemp,
                carbonTarget: s.startCarbon,
                data: [{ t: 0, temp: s.startTemp, carbon: s.startCarbon, tempTarget: s.startTemp, carbonTarget: s.startCarbon }],
                tempTrack: undefined,
                carbonTrack: undefined,
            };

        case "TICK": {
            const dtMin = s.dt * s.speed;
            const step = stepOnce(
                {
                    tPrev: s.t,
                    dtMin,
                    temp: s.temp,
                    carbon: s.carbon,
                    tempTargetPrev: s.tempTarget,
                    carbonTargetPrev: s.carbonTarget,
                    tempTrack: s.tempTrack,
                    carbonTrack: s.carbonTrack,
                },
                a.compiled
            );

            const maxPoints = 20000;
            const data = s.data.length >= maxPoints ? [...s.data.slice(-maxPoints + 1), step.point] : [...s.data, step.point];

            return {
                ...s,
                t: step.t,
                temp: step.temp,                 // state (noise-free)
                carbon: step.carbon,             // state (noise-free)
                tempTarget: step.tempTarget,
                carbonTarget: step.carbonTarget,
                tempTrack: step.tempTrack,
                carbonTrack: step.carbonTrack,
                data,
                running: step.reachedEnd ? false : s.running,
                finished: step.reachedEnd ? true : s.finished,
            };
        }

        case "INSTANT": {
            const res = simulateInstant(s, a.compiled, s.samplesPerMin);
            return {
                ...s,
                running: false,
                finished: true,
                t: res.t,
                temp: res.temp,                 // state (noise-free)
                carbon: res.carbon,             // state (noise-free)
                tempTarget: res.tempTarget,
                carbonTarget: res.carbonTarget,
                data: res.data,                 // noisy display points
            };
        }

        default:
            return s;
    }
}

export default function App() {
    const [scenario, setScenario] = useState<Step[]>(exampleScenario);
    const [s, dispatch] = useReducer(reducer, initial);
    const [instantPreview, setInstantPreview] = useState<boolean>(false);

    // Defer heavy stuff under slider drags
    const deferredScenario = useDeferredValue(scenario);

    const compiled = useMemo(
        () => compileScenario(deferredScenario, { temp: s.startTemp, carbon: s.startCarbon }),
        [deferredScenario, s.startTemp, s.startCarbon]
    );

    // starta om när scenario eller startvärden ändras
    useEffect(() => {
        dispatch({ type: "RESET" });
    }, [deferredScenario, s.startTemp, s.startCarbon]);

    // Live ticks
    useInterval(() => dispatch({ type: "TICK", compiled }), 200, s.running);

    // Auto-recalc instant när preview är på (debounced)
    useDebouncedEffect(() => {
        if (!instantPreview) return;
        dispatch({ type: "INSTANT", compiled });
    }, [instantPreview, deferredScenario, s.startTemp, s.startCarbon, s.samplesPerMin, compiled], 80);

    // Defer the data fed to the chart for smoother paints
    const deferredData = useDeferredValue(s.data);

    return (
        <div className="app">
            <h1>Värmebehandling POC — Temperatur & Kolhalt</h1>

            <div className="controls" style={{ flexWrap: "wrap", gap: 12 }}>
                <button onClick={() => dispatch({ type: "TOGGLE" })} disabled={s.finished}>
                    {s.running ? "Pausa (live)" : "Starta (live)"}
                </button>
                <button onClick={() => dispatch({ type: "RESET" })}>Starta om</button>

                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Live: hastighet
                    <input
                        type="range"
                        min="0.25"
                        max="8"
                        step="0.25"
                        value={s.speed}
                        onChange={(e) => dispatch({ type: "SET_SPEED", speed: Number(e.target.value) })}
                    />
                    <span>{s.speed.toFixed(2)}×</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Live: dt (min/tick)
                    <input
                        type="number"
                        min={0.02}
                        step={0.02}
                        value={s.dt}
                        onChange={(e) => dispatch({ type: "SET_DT", dt: Number(e.target.value) })}
                        style={{ width: 80 }}
                    />
                </label>

                <span>
          t={s.t.toFixed(2)} / {compiled.totalDuration.toFixed(2)} min {s.finished && "• klart"}
        </span>
            </div>

            <div className="controls" style={{ flexWrap: "wrap", gap: 12 }}>
                <label>
                    Starttemp (°C)
                    <input
                        type="number"
                        min={0}
                        max={1100}
                        step={5}
                        value={s.startTemp}
                        onChange={(e) => dispatch({ type: "SET_START_TEMP", value: Number(e.target.value) })}
                        style={{ marginLeft: 6, width: 100 }}
                    />
                </label>
                <label>
                    Startkolhalt (%)
                    <input
                        type="number"
                        min={0}
                        max={1.6}
                        step={0.01}
                        value={s.startCarbon}
                        onChange={(e) => dispatch({ type: "SET_START_CARBON", value: Number(e.target.value) })}
                        style={{ marginLeft: 6, width: 100 }}
                    />
                </label>

                <label>
                    Instant: upplösning (punkter/min)
                    <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={s.samplesPerMin}
                        onChange={(e) => dispatch({ type: "SET_SPM", spm: Number(e.target.value) })}
                        style={{ marginLeft: 6, width: 120 }}
                    />
                </label>

                <button
                    onClick={() => {
                        setInstantPreview(true);
                        dispatch({ type: "INSTANT", compiled });
                    }}
                    title="Beräkna hela serien direkt"
                >
                    Beräkna direkt
                </button>

                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={instantPreview} onChange={(e) => setInstantPreview(e.target.checked)} />
                    Direkt-förhandsvisning
                </label>
            </div>

            {/* Scenario-editor */}
            <ScenarioEditor scenario={scenario} onChange={setScenario} />

            {/* Diagram (deferred data) */}
            <div style={{ marginTop: 8 }}>
                <MultiLineChart data={deferredData} />
            </div>

            <div className="status">
                <strong>Nu:</strong> temp={s.temp.toFixed(1)}°C (→{s.tempTarget}°C), kolhalt={s.carbon.toFixed(3)}% (→{s.carbonTarget}%)
            </div>
        </div>
    );
}

/* --- Chart --- */
interface MultiChartProps {
    data: Point[];
    width?: number;
    height?: number;
    pad?: number;
    tempRange?: [number, number];
    carbonRange?: [number, number];
}

function MultiLineChart({
                            data,
                            width = 900,
                            height = 320,
                            pad = 36,
                            tempRange = [0, 1100],
                            carbonRange = [0, 1.6],
                        }: MultiChartProps) {
    if (data.length === 0) return <svg viewBox={`0 0 ${width} ${height}`} className="chart" />;

    const xMin = data[0].t;
    const xMax = data[data.length - 1].t;

    const [tMin, tMax] = tempRange;
    const [cMin, cMax] = carbonRange;

    const toX = (x: number) => pad + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (width - pad * 2);
    const toYTemp = (y: number) => height - pad - ((y - tMin) / (tMax - tMin)) * (height - pad * 2);
    const toYCarbon = (y: number) => height - pad - ((y - cMin) / (cMax - cMin)) * (height - pad * 2);

    const pathLinear = (yKey: keyof Point, toY: (y: number) => number): string =>
        data.reduce((acc, p, i) => {
            const X = toX(p.t);
            const Y = toY(p[yKey] as number);
            return acc + (i === 0 ? `M ${X} ${Y}` : ` L ${X} ${Y}`);
        }, "");

    const pathStep = (yKey: keyof Point, toY: (y: number) => number): string => {
        if (!data.length) return "";
        let d = `M ${toX(data[0].t)} ${toY(data[0][yKey] as number)}`;
        for (let i = 1; i < data.length; i++) {
            const x = toX(data[i].t);
            const yPrev = toY(data[i - 1][yKey] as number);
            const yNow = toY(data[i][yKey] as number);
            d += ` L ${x} ${yPrev}`;
            if (yNow !== yPrev) d += ` L ${x} ${yNow}`;
        }
        return d;
    };

    const dTemp = pathLinear("temp", toYTemp);
    const dCarbon = pathLinear("carbon", toYCarbon);
    const dTempTarget = pathStep("tempTarget", toYTemp);
    const dCarbonTarget = pathStep("carbonTarget", toYCarbon);

    const gridLines = [];
    const hTicks = 5;
    for (let i = 0; i <= hTicks; i++) {
        const y = pad + (i * (height - pad * 2)) / hTicks;
        gridLines.push(<line key={`h${i}`} x1={pad} y1={y} x2={width - pad} y2={y} stroke="#eee" />);
    }

    // Vertical grid lines for time
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
        const x = pad + (i * (width - pad * 2)) / xTicks;
        gridLines.push(<line key={`v${i}`} x1={x} y1={pad} x2={x} y2={height - pad} stroke="#eee" />);
    }

    const leftTicks: number[] = [];
    const rightTicks: number[] = [];
    for (let i = 0; i <= hTicks; i++) {
        leftTicks.push(tMin + ((tMax - tMin) * i) / hTicks);
        rightTicks.push(cMin + ((cMax - cMin) * i) / hTicks);
    }

    // Time tick values
    const timeTicks: number[] = [];
    for (let i = 0; i <= xTicks; i++) {
        timeTicks.push(xMin + ((xMax - xMin) * i) / xTicks);
    }

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="chart">
            <rect x={pad} y={pad} width={width - pad * 2} height={height - pad * 2} fill="none" stroke="#ddd" />
            {gridLines}

            <path d={dTemp} fill="none" stroke="#1b73e8" strokeWidth={1.6} />
            <path d={dCarbon} fill="none" stroke="#e86a1b" strokeWidth={1.6} />
            <path d={dTempTarget} fill="none" stroke="#1b73e8" strokeWidth={1.2} strokeDasharray="6 6" />
            <path d={dCarbonTarget} fill="none" stroke="#e86a1b" strokeWidth={1.2} strokeDasharray="6 6" />

            {/* Left axis (Temperature) */}
            <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#aaa" />
            {leftTicks.map((v, i) => {
                const y = toYTemp(v);
                return (
                    <g key={`lt${i}`}>
                        <line x1={pad - 4} y1={y} x2={pad} y2={y} stroke="#aaa" />
                        <text x={pad - 6} y={y + 3} fontSize="10" textAnchor="end">
                            {Math.round(v)}
                        </text>
                    </g>
                );
            })}
            <text x={pad} y={pad - 10} fontSize="11" textAnchor="start" fill="#1b73e8">
                Temperatur (°C)
            </text>

            {/* Right axis (Carbon) */}
            <line x1={width - pad} y1={pad} x2={width - pad} y2={height - pad} stroke="#aaa" />
            {rightTicks.map((v, i) => {
                const y = toYCarbon(v);
                return (
                    <g key={`rt${i}`}>
                        <line x1={width - pad} y1={y} x2={width - pad + 4} y2={y} stroke="#aaa" />
                        <text x={width - pad + 6} y={y + 3} fontSize="10" textAnchor="start">
                            {v.toFixed(2)}
                        </text>
                    </g>
                );
            })}
            <text x={width - pad} y={pad - 10} fontSize="11" textAnchor="end" fill="#e86a1b">
                Kolhalt (%)
            </text>

            {/* X-axis (Time) */}
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#aaa" />
            {timeTicks.map((v, i) => {
                const x = toX(v);
                return (
                    <g key={`xt${i}`}>
                        <line x1={x} y1={height - pad} x2={x} y2={height - pad + 4} stroke="#aaa" />
                        <text x={x} y={height - pad + 14} fontSize="10" textAnchor="middle">
                            {v.toFixed(1)}
                        </text>
                    </g>
                );
            })}
            <text x={width / 2} y={height - 4} fontSize="11" textAnchor="middle">
                tid (min)
            </text>

            {/* Legend */}
            <g transform={`translate(${pad + 8}, ${pad + 14})`}>
                <circle r="4" fill="#1b73e8" />
                <text x="10" y="3" fontSize="11">
                    Temperatur
                </text>
            </g>
            <g transform={`translate(${pad + 80}, ${pad + 14})`}>
                <circle r="4" fill="#e86a1b" />
                <text x="10" y="3" fontSize="11">
                    Kolhalt
                </text>
            </g>
            <g transform={`translate(${pad + 160}, ${pad + 14})`}>
                <line x1="0" y1="0" x2="12" y2="0" stroke="#1b73e8" strokeWidth="1.2" strokeDasharray="6 6" />
                <text x="16" y="3" fontSize="11">
                    Målvärde temperatur
                </text>
            </g>
            <g transform={`translate(${pad + 300}, ${pad + 14})`}>
                <line x1="0" y1="0" x2="12" y2="0" stroke="#e86a1b" strokeWidth="1.2" strokeDasharray="6 6" />
                <text x="16" y="3" fontSize="11">
                    Målvärde kolhalt
                </text>
            </g>
        </svg>
    );
}