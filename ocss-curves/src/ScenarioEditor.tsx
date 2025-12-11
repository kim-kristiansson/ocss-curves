import React, { useCallback, useMemo, useState } from "react";
import { type Step, type ChannelEffects, type EffectsWindow } from "./scenario";

const affectsCarbon = (s: Step) =>
    s.kind === "SetCarbon" ||
    s.kind === "SetBoth" ||
    s.kind === "HoldCarbon" ||
    s.kind === "RampCarbon" ||
    s.kind === "Soak" ||
    s.kind === "RampBoth";

type Props = {
    scenario: Step[];
    onChange: (next: Step[]) => void;
};

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

// Standardsteg
const Defaults = {
    HoldTemp: (): Step => ({ id: uid(), kind: "HoldTemp", target: 800, duration: 5 }),
    RampTemp: (): Step => ({ id: uid(), kind: "RampTemp", to: 920, duration: 10 }),
    HoldCarbon: (): Step => ({ id: uid(), kind: "HoldCarbon", target: 0.8, duration: 5 }),
    RampCarbon: (): Step => ({ id: uid(), kind: "RampCarbon", to: 0.9, duration: 10 }),
    Soak: (): Step => ({ id: uid(), kind: "Soak", tempTarget: 920, carbonTarget: 0.8, duration: 15 }),
    RampBoth: (): Step => ({ id: uid(), kind: "RampBoth", tempTo: 780, carbonTo: 0.7, duration: 8 }),
    SetTemp: (): Step => ({ id: uid(), kind: "SetTemp", to: 900, settleMin: 30, holdMin: 60 }),
    SetCarbon: (): Step => ({ id: uid(), kind: "SetCarbon", to: 0.6, settleMin: 10, holdMin: 30 }),
    SetBoth: (): Step => ({
        id: uid(),
        kind: "SetBoth",
        tempTo: 880,
        carbonTo: 0.9,
        tempSettleMin: 30,
        carbonSettleMin: 10,
        holdMin: 20,
    }),
};

export function ScenarioEditor({ scenario, onChange }: Props) {
    const add = useCallback((s: Step) => onChange([...scenario, s]), [onChange, scenario]);

    const update = useCallback(
        (id: string, patch: Partial<Step>) => {
            onChange(scenario.map((s) => (s.id === id ? ({ ...s, ...patch } as Step) : s)));
        },
        [onChange, scenario]
    );

    const removeAt = useCallback(
        (idx: number) => {
            const next = scenario.slice();
            next.splice(idx, 1);
            onChange(next);
        },
        [onChange, scenario]
    );

    // Drag & drop state
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    // Handle-only dragging: li is NOT draggable
    function handleDragStart(e: React.DragEvent, index: number) {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", scenario[index].id);
        const img = document.createElement("div");
        img.style.width = "1px";
        img.style.height = "1px";
        document.body.appendChild(img);
        e.dataTransfer.setDragImage(img, 0, 0);
        setTimeout(() => document.body.removeChild(img), 0);
    }

    function onDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        if (overIndex !== index) setOverIndex(index);
        e.dataTransfer.dropEffect = "move";
    }

    function onDrop(e: React.DragEvent, index: number) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            setOverIndex(null);
            return;
        }
        const next = scenario.slice();
        const [item] = next.splice(dragIndex, 1);
        next.splice(index, 0, item);
        onChange(next);
        setDragIndex(null);
        setOverIndex(null);
    }

    function onDragEnd() {
        setDragIndex(null);
        setOverIndex(null);
    }

    const isDragging = useCallback((i: number) => dragIndex === i, [dragIndex]);
    const isOver = useCallback((i: number) => overIndex === i, [overIndex]);

    // Prevent controls from initiating drag (extra safety)
    const stopDragFromControls = useMemo(
        () => ({
            onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
            onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
            onDragStart: (e: React.DragEvent) => e.stopPropagation(),
        }),
        []
    );

    return (
        <div>
            <h3>Scenario</h3>

            <div className="controls" style={{ flexWrap: "wrap" }}>
                <strong>Lägg till:</strong>
                <button onClick={() => add(Defaults.SetTemp())}>Sätt temp</button>
                <button onClick={() => add(Defaults.SetCarbon())}>Sätt kolhalt</button>
                <button onClick={() => add(Defaults.SetBoth())}>Sätt båda</button>
                <button onClick={() => add(Defaults.HoldTemp())}>Håll temp</button>
                <button onClick={() => add(Defaults.RampTemp())}>Ramp temp</button>
                <button onClick={() => add(Defaults.HoldCarbon())}>Håll kolhalt</button>
                <button onClick={() => add(Defaults.RampCarbon())}>Ramp kolhalt</button>
                <button onClick={() => add(Defaults.Soak())}>Håll båda (legacy)</button>
                <button onClick={() => add(Defaults.RampBoth())}>Ramp båda (legacy)</button>
            </div>

            <ul
                style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {scenario.map((s, idx) => (
                    <ScenarioRow
                        key={s.id}
                        s={s}
                        idx={idx}
                        update={update}
                        removeAt={removeAt}
                        handleDragStart={handleDragStart}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onDragEnd={onDragEnd}
                        isDragging={isDragging}
                        isOver={isOver}
                        stopDragFromControls={stopDragFromControls}
                    />
                ))}
            </ul>
        </div>
    );
}

/* --- Memoized row --- */
const ScenarioRow = React.memo(function ScenarioRow({
                                                        s,
                                                        idx,
                                                        update,
                                                        removeAt,
                                                        handleDragStart,
                                                        onDragOver,
                                                        onDrop,
                                                        onDragEnd,
                                                        isDragging,
                                                        isOver,
                                                        stopDragFromControls,
                                                    }: {
    s: Step;
    idx: number;
    update: (id: string, patch: Partial<Step>) => void;
    removeAt: (i: number) => void;
    handleDragStart: (e: React.DragEvent, i: number) => void;
    onDragOver: (e: React.DragEvent, i: number) => void;
    onDrop: (e: React.DragEvent, i: number) => void;
    onDragEnd: () => void;
    isDragging: (i: number) => boolean;
    isOver: (i: number) => boolean;
    stopDragFromControls: any;
}) {
    const windows = ((s as any).effectsWindows as EffectsWindow[] | undefined) ?? [];
    const hasWindows = windows.length > 0;

    return (
        <li
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={(e) => onDrop(e, idx)}
            onDragEnd={onDragEnd}
            style={{
                border: "1px solid #eee",
                borderRadius: 6,
                padding: 8,
                background: isDragging(idx) ? "#f5faff" : isOver(idx) ? "#fafafa" : "white",
            }}
        >
            <div className="controls" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* draggable HANDLE only */}
                    <span
                        role="button"
                        aria-label="Dra för att flytta"
                        title="Dra för att flytta"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        style={{ cursor: "grab", userSelect: "none", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}
                    >
            ⋮⋮
          </span>

                    <strong>{s.kind}</strong>

                    {"duration" in s && (
                        <label {...stopDragFromControls}>
                            tid (min)
                            <input
                                type="number"
                                min={0.01}
                                step={0.25}
                                value={s.duration as number}
                                onChange={(e) => update(s.id, { duration: Number(e.target.value) })}
                                style={{ width: 90, marginLeft: 6 }}
                            />
                        </label>
                    )}

                    {/* Set* */}
                    {s.kind === "SetTemp" && (
                        <>
                            <Num label="mål °C" value={s.to} onChange={(v) => update(s.id, { to: v })} stopDrag={stopDragFromControls} />
                            <Num label="tid till mål (min)" value={s.settleMin} onChange={(v) => update(s.id, { settleMin: v })} stopDrag={stopDragFromControls} />
                            <Num label="hålltid (min)" value={s.holdMin} onChange={(v) => update(s.id, { holdMin: v })} stopDrag={stopDragFromControls} />
                        </>
                    )}
                    {s.kind === "SetCarbon" && (
                        <>
                            <Num label="mål kolhalt %" step={0.01} value={s.to} onChange={(v) => update(s.id, { to: v })} stopDrag={stopDragFromControls} />
                            <Num label="tid till mål (min)" value={s.settleMin} onChange={(v) => update(s.id, { settleMin: v })} stopDrag={stopDragFromControls} />
                            <Num label="hålltid (min)" value={s.holdMin} onChange={(v) => update(s.id, { holdMin: v })} stopDrag={stopDragFromControls} />
                        </>
                    )}
                    {s.kind === "SetBoth" && (
                        <>
                            <Num label="temp °C" value={s.tempTo} onChange={(v) => update(s.id, { tempTo: v })} stopDrag={stopDragFromControls} />
                            <Num label="kolhalt %" step={0.01} value={s.carbonTo} onChange={(v) => update(s.id, { carbonTo: v })} stopDrag={stopDragFromControls} />
                            <Num label="temp: tid till mål" value={s.tempSettleMin} onChange={(v) => update(s.id, { tempSettleMin: v })} stopDrag={stopDragFromControls} />
                            <Num label="kol: tid till mål" value={s.carbonSettleMin} onChange={(v) => update(s.id, { carbonSettleMin: v })} stopDrag={stopDragFromControls} />
                            <Num label="hålltid (min)" value={s.holdMin} onChange={(v) => update(s.id, { holdMin: v })} stopDrag={stopDragFromControls} />
                        </>
                    )}

                    {/* Legacy single channel */}
                    {s.kind === "HoldTemp" && <Num label="mål °C" value={s.target} onChange={(v) => update(s.id, { target: v })} stopDrag={stopDragFromControls} />}
                    {s.kind === "RampTemp" && <Num label="till °C" value={s.to} onChange={(v) => update(s.id, { to: v })} stopDrag={stopDragFromControls} />}
                    {s.kind === "HoldCarbon" && (
                        <Num label="mål kolhalt %" step={0.01} value={s.target} onChange={(v) => update(s.id, { target: v })} stopDrag={stopDragFromControls} />
                    )}
                    {s.kind === "RampCarbon" && (
                        <Num label="till kolhalt %" step={0.01} value={s.to} onChange={(v) => update(s.id, { to: v })} stopDrag={stopDragFromControls} />
                    )}
                    {s.kind === "Soak" && (
                        <>
                            <Num label="måltemp °C" value={s.tempTarget} onChange={(v) => update(s.id, { tempTarget: v })} stopDrag={stopDragFromControls} />
                            <Num label="mål kolhalt %" step={0.01} value={s.carbonTarget} onChange={(v) => update(s.id, { carbonTarget: v })} stopDrag={stopDragFromControls} />
                        </>
                    )}
                    {s.kind === "RampBoth" && (
                        <>
                            <Num label="temp → °C" value={s.tempTo} onChange={(v) => update(s.id, { tempTo: v })} stopDrag={stopDragFromControls} />
                            <Num label="kolhalt → %" step={0.01} value={s.carbonTo} onChange={(v) => update(s.id, { carbonTo: v })} stopDrag={stopDragFromControls} />
                        </>
                    )}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => removeAt(idx)}>Ta bort</button>
                </div>
            </div>

            {/* --- Carbon effects: ONLY time-boxed items; add/remove individually --- */}
            {affectsCarbon(s) && (
                <div style={{ marginTop: 8 }} {...stopDragFromControls}>
                    {hasWindows ? (
                        <TimeboxedEffectsList
                            windows={windows}
                            onChange={(next) => update(s.id, { effectsWindows: next })}
                        />
                    ) : (
                        <div>
                            <button
                                onClick={() => {
                                    const first: EffectsWindow = { id: uid(), startMin: 0, duration: 5, carbon: {} };
                                    update(s.id, { effectsWindows: [first] });
                                }}
                            >
                                + Lägg till effekter
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
});

/* --- Controls --- */

function Num({
                 label,
                 value,
                 onChange,
                 step = 1,
                 stopDrag,
             }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    step?: number;
    stopDrag?: {
        onMouseDown: (e: React.MouseEvent) => void;
        onPointerDown: (e: React.PointerEvent) => void;
        onDragStart: (e: React.DragEvent) => void;
    };
}) {
    const onNum = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)), [onChange]);
    return (
        <label {...(stopDrag ?? {})}>
            {label}
            <input type="number" step={step} value={value} onChange={onNum} style={{ width: 110, marginLeft: 6 }} />
        </label>
    );
}

/** Slider group (used per time-boxed effect) */
function CarbonEffectsSliderPanel({
                                      fx,
                                      onChange,
                                      compact = false,
                                  }: {
    fx?: ChannelEffects;
    onChange: (next: ChannelEffects) => void;
    compact?: boolean;
}) {
    const [local, setLocal] = useState<ChannelEffects>(fx ?? {});
    React.useEffect(() => {
        setLocal(fx ?? {});
    }, [fx]);

    const rowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 8,
        margin: compact ? "6px 0" : "8px 0",
    };

    // Prevent DnD when interacting with sliders
    const block = useMemo(
        () => ({
            onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
            onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
            onDragStart: (e: React.DragEvent) => e.stopPropagation(),
        }),
        []
    );

    const onRange = (patch: Partial<ChannelEffects>) => setLocal((prev) => ({ ...prev, ...patch }));
    const onUp = () => onChange(local);

    return (
        <fieldset style={{border: "1px dashed #ddd", borderRadius: 6, padding: compact ? 6 : 8}} {...block}
                  onPointerUp={onUp}>
            <legend style={{fontSize: 12, color: "#555"}}>{compact ? "Effekt" : "Effekt"}</legend>

            <div style={rowStyle}>
                <span>brusfaktor</span>
                <input
                    type="range"
                    min={0}
                    max={50}
                    step={0.1}
                    value={local.noiseFactor ?? 1}
                    onChange={(e) => onRange({noiseFactor: Number(e.target.value)})}
                />
                <code>{(local.noiseFactor ?? 1).toFixed(1)}</code>
            </div>

            <div style={rowStyle}>
                <span>drift/min</span>
                <input
                    type="range"
                    min={-0.1}
                    max={0.1}
                    step={0.005}
                    value={local.driftPerMin ?? 0}
                    onChange={(e) => onRange({driftPerMin: Number(e.target.value)})}
                />
                <code>{(local.driftPerMin ?? 0).toFixed(4)}</code>
            </div>

            <div style={rowStyle}>
                <span>spik@start</span>
                <input
                    type="range"
                    min={0}
                    max={0.2}
                    step={0.005}
                    value={local.spikeAtStart ?? 0}
                    onChange={(e) => onRange({spikeAtStart: Number(e.target.value)})}
                />
                <code>{(local.spikeAtStart ?? 0).toFixed(3)}</code>
            </div>

            <div style={rowStyle}>
                <span>offset (%)</span>
                <input
                    type="range"
                    min={-0.2}
                    max={0.2}
                    step={0.001}
                    value={local.offset ?? 0}
                    onChange={(e) => onRange({offset: Number(e.target.value)})}
                />
                <code>{(local.offset ?? 0).toFixed(3)}</code>
            </div>

            <div style={{display: "flex", alignItems: "center", gap: 8}}>
                <label style={{display: "flex", alignItems: "center", gap: 6}}>
                    <input type="checkbox" checked={!!local.flatline}
                           onChange={(e) => onRange({flatline: e.target.checked})}/>
                    fast linje
                </label>
            </div>
        </fieldset>
    );
}

/** Tidsbegränsade effekter, med full redigering & Ta bort per rad */
function TimeboxedEffectsList({
                                  windows,
                                  onChange,
                              }: {
    windows: EffectsWindow[];
    onChange: (next: EffectsWindow[]) => void;
}) {
    return (
        <div>
            <small style={{ color: "#666" }}>Tidsbegränsade effekter</small>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {windows.map((w, wi) => (
                    <div key={w.id} style={{ border: "1px dashed #ddd", borderRadius: 6, padding: 8 }}>
                        <div className="controls" style={{ flexWrap: "wrap", gap: 8 }}>
                            <Num
                                label="start (min)"
                                value={w.startMin}
                                onChange={(v) => {
                                    const next = [...windows];
                                    next[wi] = { ...w, startMin: v };
                                    onChange(next);
                                }}
                            />
                            <Num
                                label="längd (min)"
                                value={w.duration}
                                onChange={(v) => {
                                    const next = [...windows];
                                    next[wi] = { ...w, duration: v };
                                    onChange(next);
                                }}
                            />
                            <button
                                onClick={() => {
                                    const next = [...windows];
                                    next.splice(wi, 1);
                                    onChange(next);
                                }}
                            >
                                Ta bort
                            </button>
                        </div>

                        <CarbonEffectsSliderPanel
                            fx={w.carbon}
                            compact
                            onChange={(nextFx) => {
                                const next = [...windows];
                                next[wi] = { ...w, carbon: nextFx };
                                onChange(next);
                            }}
                        />
                    </div>
                ))}

                <button
                    onClick={() => {
                        const next = [...windows];
                        next.push({ id: uid(), startMin: 0, duration: 5, carbon: {} });
                        onChange(next);
                    }}
                >
                    + Lägg till effekt
                </button>
            </div>
        </div>
    );
}
