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
            <p className="drag-hint">Dra och släpp stegen för att ändra ordning</p>
            {scenario.steps.map((step, i) => (
                <div
                    key={i}
                    className={`scenario-step ${dragIndex === i ? "dragging" : ""}`}
                    onDragOver={allowDrop}
                    onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(i);
                    }}
                >
                    <div
                        className="drag-handle"
                        title="Dra för att flytta"
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragEnd={() => setDragIndex(null)}
                    />
                    <div className="step-body">
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
                                        effects: undefined,
                                    } as ScenarioStep);
                                }}
                            >
                                <option value="carbon">Kolhalt</option>
                                <option value="temperature">Temperatur</option>
                            </select>
                        </label>
                        {(step.type === "carbon" || step.type === "temperature") && (
                            <>
                                <div className="field-pair">
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
                                </div>
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
                                        {step.effects?.map((eff, j) => (
                                            <div key={j} className="controls-fields">
                                                <div className="field-pair">
                                                    <label>
                                                        Start (min):
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={step.ramp + step.duration}
                                                            value={eff.start}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    start: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
                                                        />
                                                    </label>
                                                    <label>
                                                        Varaktighet (min):
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={eff.duration}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    duration: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                                <div className="field-pair">
                                                    <label>
                                                        Responsiveness:
                                                        <input
                                                            type="number"
                                                            step={0.01}
                                                            min={0}
                                                            max={1}
                                                            value={eff.responsiveness}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    responsiveness: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
                                                        />
                                                    </label>
                                                    <label>
                                                        Noise:
                                                        <input
                                                            type="number"
                                                            step={0.01}
                                                            min={0}
                                                            max={1}
                                                            value={eff.noise}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    noise: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
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
                                                            value={eff.offset}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    offset: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
                                                        />
                                                    </label>
                                                    <label>
                                                        Alarm-marginal:
                                                        <input
                                                            type="number"
                                                            step={0.01}
                                                            min={0}
                                                            max={1}
                                                            value={eff.alarmMargin}
                                                            onChange={(e) => {
                                                                const effects = [...(step.effects ?? [])];
                                                                effects[j] = {
                                                                    ...effects[j],
                                                                    alarmMargin: +e.target.value,
                                                                };
                                                                updateStep(i, { effects });
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const effects = [...(step.effects ?? [])];
                                                        effects.splice(j, 1);
                                                        updateStep(i, { effects });
                                                    }}
                                                >
                                                    Ta bort manipulering
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const effects = [...(step.effects ?? [])];
                                                effects.push({
                                                    start: 0,
                                                    duration: 0,
                                                    responsiveness: DEFAULTS.responsiveness,
                                                    noise: DEFAULTS.noise,
                                                    offset: DEFAULTS.offset,
                                                    alarmMargin: DEFAULTS.alarmMargin,
                                                });
                                                updateStep(i, { effects });
                                            }}
                                        >
                                            Lägg till manipulering
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        <button onClick={() => removeStep(i)}>Ta bort</button>
                    </div>
                </div>
            ))}
            <button onClick={addStep}>Lägg till steg</button>
        </div>
    );
}
