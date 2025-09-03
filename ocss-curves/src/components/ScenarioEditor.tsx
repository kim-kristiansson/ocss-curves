import { type ScenarioStep } from "../hooks/useSimulation";

type Props = {
    scenario: ScenarioStep[];
    setScenario: (steps: ScenarioStep[]) => void;
};

export default function ScenarioEditor({ scenario, setScenario }: Props) {
    const updateStep = (index: number, changes: Partial<ScenarioStep>) => {
        const updated = scenario.map((s, i) => (i === index ? { ...s, ...changes } : s));
        setScenario(updated);
    };

    const addStep = () =>
        setScenario([
            ...scenario,
            { type: "carbon", duration: 10, from: 0, to: 0 } as ScenarioStep,
        ]);

    const removeStep = (index: number) =>
        setScenario(scenario.filter((_, i) => i !== index));

    return (
        <div className="scenario-editor">
            <h3>Scenario</h3>
            {scenario.map((step, i) => (
                <div key={i} className="scenario-step">
                    <label>
                        Typ:
                        <select
                            value={step.type}
                            onChange={(e) =>
                                updateStep(i, {
                                    type: e.target.value as ScenarioStep["type"],
                                })
                            }
                        >
                            <option value="carbon">Kolhalt</option>
                            <option value="temperature">Temperatur</option>
                            <option value="value">Kolvärde</option>
                        </select>
                    </label>
                    <label>
                        Tid (min):
                        <input
                            type="number"
                            value={step.duration}
                            onChange={(e) =>
                                updateStep(i, { duration: +e.target.value })
                            }
                        />
                    </label>
                    {(step.type === "carbon" || step.type === "temperature") && (
                        <div className="field-pair">
                            <label>
                                Från:
                                <input
                                    type="number"
                                    step={step.type === "carbon" ? 0.01 : 1}
                                    min={0}
                                    max={step.type === "carbon" ? 1.6 : 1600}
                                    value={step.from}
                                    onChange={(e) =>
                                        updateStep(i, { from: +e.target.value })
                                    }
                                />
                            </label>
                            <label>
                                Till:
                                <input
                                    type="number"
                                    step={step.type === "carbon" ? 0.01 : 1}
                                    min={0}
                                    max={step.type === "carbon" ? 1.6 : 1600}
                                    value={step.to}
                                    onChange={(e) =>
                                        updateStep(i, { to: +e.target.value })
                                    }
                                />
                            </label>
                        </div>
                    )}
                    {step.type === "value" && (
                        <div className="field-pair">
                            <label>
                                Från:
                                <input
                                    type="number"
                                    step={0.01}
                                    min={-1}
                                    max={1}
                                    value={step.from}
                                    onChange={(e) =>
                                        updateStep(i, { from: +e.target.value })
                                    }
                                />
                            </label>
                            <label>
                                Till:
                                <input
                                    type="number"
                                    step={0.01}
                                    min={-1}
                                    max={1}
                                    value={step.to}
                                    onChange={(e) =>
                                        updateStep(i, { to: +e.target.value })
                                    }
                                />
                            </label>
                        </div>
                    )}
                    <button onClick={() => removeStep(i)}>Ta bort</button>
                </div>
            ))}
            <button onClick={addStep}>Lägg till steg</button>
        </div>
    );
}
