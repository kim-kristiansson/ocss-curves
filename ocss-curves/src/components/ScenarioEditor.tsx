import { useState } from "react";
import { type ScenarioStep, DEFAULTS, type Scenario } from "../hooks/useSimulation";

type Props = {
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
};

export default function ScenarioEditor({ scenario, setScenario }: Props) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const updateStep = (index: number, changes: Partial<ScenarioStep>) => {
        const updated = scenario.steps.map((s, i) =>
            i === index ? { ...s, ...changes } : s
        ) as ScenarioStep[];
        setScenario({ ...scenario, steps: updated });
    };

    const addStep = () =>
        setScenario({
            ...scenario,
            steps: [
                ...scenario.steps,
                {
                    type: "carbon",
                    target: scenario.startCarbon,
                    ramp: 10,
                    duration: 0,
                } as ScenarioStep,
            ],
        });

    const removeStep = (index: number) =>
        setScenario({
            ...scenario,
            steps: scenario.steps.filter((_, i) => i !== index),
        });

    const handleDragStart = (index: number) => setDragIndex(index);

    const handleDrop = (index: number) => {
        if (dragIndex === null || dragIndex === index) return;
        const reordered = [...scenario.steps];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(index, 0, moved);
        setScenario({ ...scenario, steps: reordered });
        setDragIndex(null);
    };

    const allowDrop = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

    return (
        <div
            className="scenario-editor"
            onDragOver={allowDrop}
            onDrop={() => {
                if (dragIndex !== null) handleDrop(scenario.steps.length);
            }}
        >
            <h3>Scenario</h3>
            <div className="field-pair">
                <label>
                    Starttemperatur:
                    <input
                        type="number"
                        min={0}
                        max={1600}
                        value={scenario.startTemp}
                        onChange={(e) =>
                            setScenario({
                                ...scenario,
                                startTemp: +e.target.value,
                            })
                        }
                    />
                </label>
                <label>
                    Startkolhalt:
                    <input
                        type="number"
                        step={0.01}
                        min={0}
                        max={1.6}
                        value={scenario.startCarbon}
                        onChange={(e) =>
                            setScenario({
                                ...scenario,
                                startCarbon: +e.target.value,
                            })
                        }
                    />
                </label>
            </div>
            {scenario.steps.map((step, i) => (
                <div
                    key={i}
                    className="scenario-step"
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={allowDrop}
                    onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(i);
                    }}
                >
                    <label>
                        Typ:
                        <select
                            value={step.type}
                            onChange={(e) => {
                                const type = e.target.value as ScenarioStep["type"];
                                updateStep(i, {
                                    type,
                                    target: 0,
                                    ramp: 0,
                                    duration: 0,
                                    effect: undefined,
                                } as ScenarioStep);
                            }}
                        >
                            <option value="carbon">Kolhalt</option>
                            <option value="temperature">Temperatur</option>
                        </select>
                    </label>
                    {(step.type === "carbon" || step.type === "temperature") && (
                        <>
                            <label>
                                Tid till börvärde (min):
                                <input
                                    type="number"
                                    value={step.ramp}
                                    onChange={(e) =>
                                        updateStep(i, { ramp: +e.target.value })
                                    }
                                />
                            </label>
                            <label>
                                Varaktighet (min):
                                <input
                                    type="number"
                                    value={step.duration}
                                    onChange={(e) =>
                                        updateStep(i, { duration: +e.target.value })
                                    }
                                />
                            </label>
                            <label>
                                Börvärde:
                                <input
                                    type="number"
                                    step={step.type === "carbon" ? 0.01 : 1}
                                    min={0}
                                    max={step.type === "carbon" ? 1.6 : 1600}
                                    value={step.target}
                                    onChange={(e) =>
                                        updateStep(i, { target: +e.target.value })
                                    }
                                />
                            </label>
                            {step.type === "carbon" && (
                                <>
                                    <label>
                                        Manipulering från (min):
                                        <input
                                            type="number"
                                            min={0}
                                            max={step.ramp + step.duration}
                                            value={step.effect?.start ?? 0}
                                            onChange={(e) =>
                                                updateStep(i, {
                                                    effect: {
                                                        ...(step.effect ?? {
                                                            responsiveness:
                                                                DEFAULTS.responsiveness,
                                                            noise: DEFAULTS.noise,
                                                            offset: DEFAULTS.offset,
                                                            alarmMargin:
                                                                DEFAULTS.alarmMargin,
                                                        }),
                                                        start: +e.target.value,
                                                    },
                                                })
                                            }
                                        />
                                    </label>
                                    <div className="controls-fields">
                                        <div className="field-pair">
                                            <label>
                                                Responsiveness:
                                                <input
                                                    type="number"
                                                    step={0.01}
                                                    min={0}
                                                    max={1}
                                                    value={step.effect?.responsiveness ?? DEFAULTS.responsiveness}
                                                    onChange={(e) =>
                                                        updateStep(i, {
                                                            effect: {
                                                                ...(step.effect ?? {
                                                                    start: 0,
                                                                    noise:
                                                                        DEFAULTS.noise,
                                                                    offset:
                                                                        DEFAULTS.offset,
                                                                    alarmMargin:
                                                                        DEFAULTS.alarmMargin,
                                                                }),
                                                                responsiveness:
                                                                    +e.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Noise:
                                                <input
                                                    type="number"
                                                    step={0.01}
                                                    min={0}
                                                    max={1}
                                                    value={step.effect?.noise ?? DEFAULTS.noise}
                                                    onChange={(e) =>
                                                        updateStep(i, {
                                                            effect: {
                                                                ...(step.effect ?? {
                                                                    start: 0,
                                                                    responsiveness:
                                                                        DEFAULTS.responsiveness,
                                                                    offset:
                                                                        DEFAULTS.offset,
                                                                    alarmMargin:
                                                                        DEFAULTS.alarmMargin,
                                                                }),
                                                                noise: +e.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                        <div className="field-pair">
                                            <label>
                                                Offset:
                                                <input
                                                    type="number"
                                                    step={0.01}
                                                    min={-1}
                                                    max={1}
                                                    value={step.effect?.offset ?? DEFAULTS.offset}
                                                    onChange={(e) =>
                                                        updateStep(i, {
                                                            effect: {
                                                                ...(step.effect ?? {
                                                                    start: 0,
                                                                    responsiveness:
                                                                        DEFAULTS.responsiveness,
                                                                    noise: DEFAULTS.noise,
                                                                    alarmMargin:
                                                                        DEFAULTS.alarmMargin,
                                                                }),
                                                                offset: +e.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Alarm-marginal:
                                                <input
                                                    type="number"
                                                    step={0.01}
                                                    min={0}
                                                    max={1}
                                                    value={step.effect?.alarmMargin ?? DEFAULTS.alarmMargin}
                                                    onChange={(e) =>
                                                        updateStep(i, {
                                                            effect: {
                                                                ...(step.effect ?? {
                                                                    start: 0,
                                                                    responsiveness:
                                                                        DEFAULTS.responsiveness,
                                                                    noise: DEFAULTS.noise,
                                                                    offset:
                                                                        DEFAULTS.offset,
                                                                }),
                                                                alarmMargin:
                                                                    +e.target.value,
                                                            },
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    <button onClick={() => removeStep(i)}>Ta bort</button>
                </div>
            ))}
            <button onClick={addStep}>Lägg till steg</button>
        </div>
    );
}
