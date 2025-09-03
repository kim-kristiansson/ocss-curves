import { type ScenarioStep } from "../hooks/useSimulation";

type Props = {
    scenario: ScenarioStep[];
    setScenario: (steps: ScenarioStep[]) => void;
};

export default function ScenarioEditor({ scenario, setScenario }: Props) {
    const updateStep = (
        index: number,
        field: keyof ScenarioStep,
        value: number
    ) => {
        const updated = scenario.map((step, i) =>
            i === index ? { ...step, [field]: value } : step
        );
        setScenario(updated);
    };

    const addStep = () =>
        setScenario([
            ...scenario,
            { duration: 10, tempFrom: 0, tempTo: 0, carbonFrom: 0, carbonTo: 0 },
        ]);

    const removeStep = (index: number) =>
        setScenario(scenario.filter((_, i) => i !== index));

    return (
        <div className="scenario-editor">
            <h3>Scenario</h3>
            {scenario.map((step, i) => (
                <div key={i} className="scenario-step">
                    <label>
                        Tid (min):
                        <input
                            type="number"
                            value={step.duration}
                            onChange={(e) =>
                                updateStep(i, "duration", +e.target.value)
                            }
                        />
                    </label>
                    <label>
                        Temp från:
                        <input
                            type="number"
                            value={step.tempFrom}
                            onChange={(e) =>
                                updateStep(i, "tempFrom", +e.target.value)
                            }
                        />
                    </label>
                    <label>
                        Temp till:
                        <input
                            type="number"
                            value={step.tempTo}
                            onChange={(e) =>
                                updateStep(i, "tempTo", +e.target.value)
                            }
                        />
                    </label>
                    <label>
                        Kolhalt från:
                        <input
                            type="number"
                            step="0.01"
                            value={step.carbonFrom}
                            onChange={(e) =>
                                updateStep(i, "carbonFrom", +e.target.value)
                            }
                        />
                    </label>
                    <label>
                        Kolhalt till:
                        <input
                            type="number"
                            step="0.01"
                            value={step.carbonTo}
                            onChange={(e) =>
                                updateStep(i, "carbonTo", +e.target.value)
                            }
                        />
                    </label>
                    <button onClick={() => removeStep(i)}>Ta bort</button>
                </div>
            ))}
            <button onClick={addStep}>Lägg till steg</button>
        </div>
    );
}
