// --- Typer ---
export type Minutes = number;

// Bas-info (utan duration – vissa steg beräknar sin totala tid själva)
export type StepBase = { id: string; label?: string };

// Legacy-steg (behåll om du vill blanda)
export type TempStep =
    | ({ kind: "HoldTemp"; target: number; duration: Minutes } & StepBase)
    | ({ kind: "RampTemp"; to: number; duration: Minutes } & StepBase);

export type CarbonStep =
    | ({ kind: "HoldCarbon"; target: number; duration: Minutes } & StepBase)
    | ({ kind: "RampCarbon"; to: number; duration: Minutes } & StepBase);

export type DualStep =
    | ({ kind: "Soak"; tempTarget: number; carbonTarget: number; duration: Minutes } & StepBase)
    | ({ kind: "RampBoth"; tempTo: number; carbonTo: number; duration: Minutes } & StepBase);

// ⭐ Nya setpoint-steg
export type SetTemp = ({ kind: "SetTemp"; to: number; settleMin: Minutes; holdMin: Minutes } & StepBase);
export type SetCarbon = ({ kind: "SetCarbon"; to: number; settleMin: Minutes; holdMin: Minutes } & StepBase);
export type SetBoth = ({
    kind: "SetBoth";
    tempTo: number;
    carbonTo: number;
    tempSettleMin: Minutes;
    carbonSettleMin: Minutes;
    holdMin: Minutes;
} & StepBase);

// (Legacy) Disturbances
export type Disturbance =
    | ({ kind: "Spike"; signal: "temp" | "carbon"; delta: number; duration: Minutes } & StepBase)
    | ({ kind: "Drift"; signal: "temp" | "carbon"; perMinute: number; duration: Minutes } & StepBase)
    | ({ kind: "NoiseBurst"; signal: "temp" | "carbon"; factor: number; duration: Minutes } & StepBase)
    | ({ kind: "Flatline"; signal: "temp" | "carbon"; duration: Minutes } & StepBase);

// ---- Effekter (endast kolhalt) ----
export type ChannelEffects = {
    noiseFactor?: number;   // enables render-only noise if > 0
    driftPerMin?: number;   // per-minute rate added to legacy rate (only during hold phase)
    spikeAtStart?: number;  // spike at window/step start
    flatline?: boolean;     // freeze value
    offset?: number;        // constant additive bias (applied to STATE)
};

export type Effects = { carbon?: ChannelEffects };

export type EffectsWindow = {
    id: string;
    startMin: Minutes;
    duration: Minutes;
    carbon?: ChannelEffects;
};

export type Step =
    | (TempStep | CarbonStep | DualStep | Disturbance | SetTemp | SetCarbon | SetBoth) & {
    effects?: Effects;
    effectsWindows?: EffectsWindow[];
};

// ----------------------------------------------------------------

export interface CompiledScenario {
    totalDuration: number;
    getTargetsAt(t: number): { tempTarget: number; carbonTarget: number };
    getDisturbanceAt(t: number): {
        temp: { spike: number; drift: number; noiseFactor: number; flatline: boolean };   // drift = per-minute RATE
        carbon: { spike: number; drift: number; noiseFactor: number; flatline: boolean }; // drift = per-minute RATE
    };
    getEffectsAt(t: number): {
        temp: { driftPerMin: number; noiseFactor: number; flatline: boolean; offset: number };
        carbon: { driftPerMin: number; noiseFactor: number; flatline: boolean; offset: number };
    };
    getSpikesIfBoundaryCrossed(tPrev: number, tNow: number): { tempSpike: number; carbonSpike: number };
    getDynamicsAt(t: number): { tempTauMin: number; carbonTauMin: number };
    getDeadlinesAt(t: number): { tempDeadlineMin?: number; carbonDeadlineMin?: number };
    getSettleEndsIfTargetChanged(tPrev: number, tNow: number): {
        tempSettleEnd?: number;
        carbonSettleEnd?: number;
    };
    getSnapIfBoundaryCrossed(tPrev: number, tNow: number): {
        snapTemp?: number;
        snapCarbon?: number;
        reachedEnd: boolean;
    };
}

// ----------------------------------------------------------------
// Interna hjälp-typer

type TimelineItem<T extends Step> = T & { tStart: number; tEnd: number };
type AnyStep = Step;

function findAt<T extends AnyStep>(items: Array<TimelineItem<T>>, t: number) {
    return items.find((s) => t >= s.tStart && t < s.tEnd);
}

function durationForStep(s: Step, channel: "temp" | "carbon"): number {
    switch (s.kind) {
        case "SetTemp":
            return channel === "temp" ? s.settleMin + s.holdMin : 0;
        case "SetCarbon":
            return channel === "carbon" ? s.settleMin + s.holdMin : 0;
        case "SetBoth":
            return Math.max(s.tempSettleMin, s.carbonSettleMin) + s.holdMin;

        case "HoldTemp":
        case "RampTemp":
            return channel === "temp" ? s.duration : 0;
        case "HoldCarbon":
        case "RampCarbon":
            return channel === "carbon" ? s.duration : 0;

        case "Soak":
        case "RampBoth":
            return s.duration;

        case "Spike":
        case "Drift":
        case "NoiseBurst":
        case "Flatline":
            return "signal" in s && s.signal === (channel === "temp" ? "temp" : "carbon") ? s.duration : 0;

        default:
            return 0;
    }
}

// ----------------------------------------------------------------

export function compileScenario(steps: Step[], initial: { temp: number; carbon: number }): CompiledScenario {
    const tempItems: Array<TimelineItem<AnyStep>> = [];
    const carbonItems: Array<TimelineItem<AnyStep>> = [];

    let tTemp = 0;
    let tCarbon = 0;

    const push = <T extends AnyStep>(arr: Array<TimelineItem<T>>, s: T, tStart: number) =>
        arr.push({ ...s, tStart, tEnd: tStart + durationForStep(s, arr === tempItems ? "temp" : "carbon") });

    for (const s of steps) {
        switch (s.kind) {
            case "HoldTemp":
            case "RampTemp":
            case "SetTemp": {
                const dur = durationForStep(s, "temp");
                push(tempItems, s, tTemp);
                tTemp += dur;
                break;
            }
            case "HoldCarbon":
            case "RampCarbon":
            case "SetCarbon": {
                const dur = durationForStep(s, "carbon");
                push(carbonItems, s, tCarbon);
                tCarbon += dur;
                break;
            }
            case "Soak":
            case "RampBoth":
            case "SetBoth": {
                const start = Math.max(tTemp, tCarbon);
                const dT = durationForStep(s, "temp");
                const dC = durationForStep(s, "carbon");
                push(tempItems, s, start);
                push(carbonItems, s, start);
                tTemp = start + dT;
                tCarbon = start + dC;
                break;
            }
            case "Spike":
            case "Drift":
            case "NoiseBurst":
            case "Flatline": {
                if (s.signal === "temp") {
                    push(tempItems, s, tTemp);
                    tTemp += s.duration;
                } else {
                    push(carbonItems, s, tCarbon);
                    tCarbon += s.duration;
                }
                break;
            }
        }
    }

    const totalDuration = Math.max(
        tempItems.length ? tempItems[tempItems.length - 1].tEnd : 0,
        carbonItems.length ? carbonItems[carbonItems.length - 1].tEnd : 0
    );

    function getTargetsAt(t: number) {
        let tempTarget = initial.temp;
        for (const s of tempItems) {
            if (t < s.tStart) break;
            switch (s.kind) {
                case "HoldTemp":
                    tempTarget = s.target;
                    break;
                case "RampTemp":
                    tempTarget = s.to;
                    break;
                case "Soak":
                    tempTarget = s.tempTarget;
                    break;
                case "RampBoth":
                    tempTarget = s.tempTo;
                    break;
                case "SetTemp":
                    tempTarget = s.to;
                    break;
                case "SetBoth":
                    tempTarget = s.tempTo;
                    break;
            }
        }

        let carbonTarget = initial.carbon;
        for (const s of carbonItems) {
            if (t < s.tStart) break;
            switch (s.kind) {
                case "HoldCarbon":
                    carbonTarget = s.target;
                    break;
                case "RampCarbon":
                    carbonTarget = s.to;
                    break;
                case "Soak":
                    carbonTarget = s.carbonTarget;
                    break;
                case "RampBoth":
                    carbonTarget = s.carbonTo;
                    break;
                case "SetCarbon":
                    carbonTarget = s.to;
                    break;
                case "SetBoth":
                    carbonTarget = s.carbonTo;
                    break;
            }
        }

        return { tempTarget, carbonTarget };
    }

    function getDisturbanceAt(t: number) {
        // IMPORTANT: drift is returned as a *rate* (per minute), not accumulated delta.
        const temp = { spike: 0, drift: 0, noiseFactor: 0, flatline: false };
        const carbon = { spike: 0, drift: 0, noiseFactor: 0, flatline: false };

        for (const s of tempItems) {
            if (t < s.tStart || t >= s.tEnd) continue;
            if (s.kind === "Spike" && s.signal === "temp") temp.spike += s.delta;
            if (s.kind === "Drift" && s.signal === "temp") temp.drift += s.perMinute; // rate
            if (s.kind === "NoiseBurst" && s.signal === "temp") temp.noiseFactor = Math.max(temp.noiseFactor, s.factor ?? 0);
            if (s.kind === "Flatline" && s.signal === "temp") temp.flatline = true;
        }

        for (const s of carbonItems) {
            if (t < s.tStart || t >= s.tEnd) continue;
            if (s.kind === "Spike" && s.signal === "carbon") carbon.spike += s.delta;
            if (s.kind === "Drift" && s.signal === "carbon") carbon.drift += s.perMinute; // rate
            if (s.kind === "NoiseBurst" && s.signal === "carbon") carbon.noiseFactor = Math.max(carbon.noiseFactor, s.factor ?? 0);
            if (s.kind === "Flatline" && s.signal === "carbon") carbon.flatline = true;
        }

        return { temp, carbon };
    }

    // ⬇️ Includes `offset`
    function getEffectsAt(t: number) {
        const def = { driftPerMin: 0, noiseFactor: 0, flatline: false, offset: 0 };
        const sC = findAt(carbonItems, t);
        if (!sC) return { temp: def, carbon: def };

        let drift = sC.effects?.carbon?.driftPerMin ?? 0;
        let noise = sC.effects?.carbon?.noiseFactor ?? 0; // default 0 = no noise
        let flat  = !!sC.effects?.carbon?.flatline;
        let offset = sC.effects?.carbon?.offset ?? 0;

        if (sC.effectsWindows?.length) {
            const rel = t - sC.tStart;
            for (const w of sC.effectsWindows) {
                const wStart = w.startMin;
                const wEnd = w.startMin + w.duration;
                if (rel >= wStart && rel < wEnd && w.carbon) {
                    if (w.carbon.driftPerMin !== undefined) drift += w.carbon.driftPerMin;
                    if (w.carbon.noiseFactor !== undefined) noise = Math.max(noise, w.carbon.noiseFactor);
                    if (w.carbon.flatline) flat = true;
                    if (w.carbon.offset !== undefined) offset += w.carbon.offset; // additive offsets
                }
            }
        }

        // No temp-side effects in this POC
        return {
            temp: def,
            carbon: { driftPerMin: drift, noiseFactor: noise, flatline: flat, offset }
        };
    }

    function getSpikesIfBoundaryCrossed(tPrev: number, tNow: number) {
        const EPS = 1e-9;
        let carbonSpike = 0;

        for (const s of carbonItems) {
            // Fire on step start even when it begins at t=0 (inclusive on left, strict on right)
            if (tPrev <= s.tStart + EPS && tNow > s.tStart + EPS) {
                carbonSpike += s.effects?.carbon?.spikeAtStart ?? 0;
                carbonSpike += (s as any).effects?.carbon?.offset ?? 0; // one-shot step offset
            }

            // If interval doesn't overlap step at all, skip windows
            if (!(tNow > s.tStart - EPS && tPrev < s.tEnd + EPS)) continue;

            if (s.effectsWindows?.length) {
                const relPrev = tPrev - s.tStart;
                const relNow  = tNow  - s.tStart;

                for (const w of s.effectsWindows) {
                    const wStart = w.startMin;
                    // Same rule for window start
                    if (relPrev <= wStart + EPS && relNow > wStart + EPS) {
                        carbonSpike += w.carbon?.spikeAtStart ?? 0;
                        carbonSpike += w.carbon?.offset ?? 0; // one-shot window offset
                    }
                }
            }
        }

        return { tempSpike: 0, carbonSpike };
    }



    function getDynamicsAt(t: number) {
        const sT = findAt(tempItems, t);
        const sC = findAt(carbonItems, t);
        const tauFrom = (settle: number) => Math.max(0.01, settle / 3);

        const tempTauMin = !sT
            ? 2
            : sT.kind === "SetTemp"
                ? tauFrom(sT.settleMin)
                : sT.kind === "SetBoth"
                    ? tauFrom(sT.tempSettleMin)
                    : sT.kind === "RampTemp" || sT.kind === "RampBoth"
                        ? tauFrom((sT as any).duration)
                        : 2;

        const carbonTauMin = !sC
            ? 2
            : sC.kind === "SetCarbon"
                ? tauFrom(sC.settleMin)
                : sC.kind === "SetBoth"
                    ? tauFrom(sC.carbonSettleMin)
                    : sC.kind === "RampCarbon" || sC.kind === "RampBoth"
                        ? tauFrom((sC as any).duration)
                        : 2;

        return { tempTauMin, carbonTauMin };
    }

    function getDeadlinesAt(t: number) {
        const sT = findAt(tempItems, t);
        const sC = findAt(carbonItems, t);

        const tempDeadlineMin =
            sT?.kind === "SetTemp"
                ? sT.tStart + sT.settleMin
                : sT?.kind === "SetBoth"
                    ? sT.tStart + sT.tempSettleMin
                    : sT?.kind === "RampTemp" || sT?.kind === "HoldTemp" || sT?.kind === "Soak" || sT?.kind === "RampBoth"
                        ? sT.tEnd
                        : undefined;

        const carbonDeadlineMin =
            sC?.kind === "SetCarbon"
                ? sC.tStart + sC.settleMin
                : sC?.kind === "SetBoth"
                    ? sC.tStart + sC.carbonSettleMin
                    : sC?.kind === "RampCarbon" || sC?.kind === "HoldCarbon" || sC?.kind === "Soak" || sC?.kind === "RampBoth"
                        ? sC.tEnd
                        : undefined;

        return { tempDeadlineMin, carbonDeadlineMin };
    }

    function getSettleEndsIfTargetChanged(tPrev: number, tNow: number) {
        const out: { tempSettleEnd?: number; carbonSettleEnd?: number } = {};

        for (const s of tempItems) {
            if (tPrev < s.tStart && tNow >= s.tStart) {
                switch (s.kind) {
                    case "SetTemp":
                        out.tempSettleEnd = s.tStart + s.settleMin;
                        break;
                    case "SetBoth":
                        out.tempSettleEnd = s.tStart + s.tempSettleMin;
                        break;
                    case "HoldTemp":
                    case "RampTemp":
                    case "Soak":
                    case "RampBoth":
                        out.tempSettleEnd = s.tEnd;
                        break;
                }
                break;
            }
        }
        for (const s of carbonItems) {
            if (tPrev < s.tStart && tNow >= s.tStart) {
                switch (s.kind) {
                    case "SetCarbon":
                        out.carbonSettleEnd = s.tStart + s.settleMin;
                        break;
                    case "SetBoth":
                        out.carbonSettleEnd = s.tStart + s.carbonSettleMin;
                        break;
                    case "HoldCarbon":
                    case "RampCarbon":
                    case "Soak":
                    case "RampBoth":
                        out.carbonSettleEnd = s.tEnd;
                        break;
                }
                break;
            }
        }
        return out;
    }

    function getSnapIfBoundaryCrossed(tPrev: number, tNow: number) {
        let snapTemp: number | undefined;
        let snapCarbon: number | undefined;

        for (const s of tempItems) {
            if (tPrev < s.tEnd && tNow >= s.tEnd) {
                switch (s.kind) {
                    case "HoldTemp":
                        snapTemp = s.target;
                        break;
                    case "RampTemp":
                        snapTemp = s.to;
                        break;
                    case "Soak":
                        snapTemp = s.tempTarget;
                        break;
                    case "RampBoth":
                        snapTemp = s.tempTo;
                        break;
                    case "SetTemp":
                        snapTemp = s.to;
                        break;
                    case "SetBoth":
                        snapTemp = s.tempTo;
                        break;
                }
            }
        }
        for (const s of carbonItems) {
            if (tPrev < s.tEnd && tNow >= s.tEnd) {
                switch (s.kind) {
                    case "HoldCarbon":
                        snapCarbon = s.target;
                        break;
                    case "RampCarbon":
                        snapCarbon = s.to;
                        break;
                    case "Soak":
                        snapCarbon = s.carbonTarget;
                        break;
                    case "RampBoth":
                        snapCarbon = s.carbonTo;
                        break;
                    case "SetCarbon":
                        snapCarbon = s.to;
                        break;
                    case "SetBoth":
                        snapCarbon = s.carbonTo;
                        break;
                }
            }
        }

        return { snapTemp, snapCarbon, reachedEnd: tNow >= totalDuration };
    }

    return {
        totalDuration,
        getTargetsAt,
        getDisturbanceAt,
        getEffectsAt,
        getSpikesIfBoundaryCrossed,
        getDynamicsAt,
        getDeadlinesAt,
        getSettleEndsIfTargetChanged,
        getSnapIfBoundaryCrossed,
    };
}

// ----------------------------------------------------------------
export const exampleScenario: Step[] = [
    { id: "s1", kind: "SetTemp", to: 920, settleMin: 10, holdMin: 30, label: "Värm upp till 920" },
    {
        id: "s2",
        kind: "SetCarbon",
        to: 0.6,
        settleMin: 10,
        holdMin: 60,
        label: "Sätt kolhalt 0.60",
        effects: { carbon: { noiseFactor: 1.2 } },
        effectsWindows: [
            { id: "w1", startMin: 0, duration: 5, carbon: { noiseFactor: 2, offset: +0.01 } },
            { id: "w2", startMin: 15, duration: 30, carbon: { driftPerMin: 0.0002 } },  // subtle drift during hold
        ],
    },
    {
        id: "s3",
        kind: "SetCarbon",
        to: 1.2,
        settleMin: 1,
        holdMin: 120,
        label: "Berika snabbt till 1.20",
        effectsWindows: [{ id: "w3", startMin: 0, duration: 3, carbon: { spikeAtStart: 0.03, noiseFactor: 1.5 } }],
    },
    {
        id: "s4",
        kind: "SetCarbon",
        to: 0.7,
        settleMin: 1,
        holdMin: 120,
        label: "Diffundera till 0.70",
        effectsWindows: [{ id: "w4", startMin: 5, duration: 100, carbon: { driftPerMin: -0.0001 } }],  // slow negative drift
    },
    { id: "s5", kind: "SetTemp", to: 860, settleMin: 30, holdMin: 30, label: "Sänk till 860" },
];