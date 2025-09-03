import { type ScenarioStep, DEFAULTS } from "../hooks/useSimulation";

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
            {
                duration: 10,
                tempFrom: 0,
                tempTo: 0,
                carbonFrom: 0,
                carbonTo: 0,
                responsivenessFrom: DEFAULTS.responsiveness,
                responsivenessTo: DEFAULTS.responsiveness,
                noiseFrom: DEFAULTS.noise,
                noiseTo: DEFAULTS.noise,
                offsetFrom: DEFAULTS.offset,
                offsetTo: DEFAULTS.offset,
                alarmMarginFrom: DEFAULTS.alarmMargin,
                alarmMarginTo: DEFAULTS.alarmMargin,
            },
        ]);

    const fieldDefs: {
        from: keyof ScenarioStep;
        to: keyof ScenarioStep;
        label: string;
        step?: string;
    }[] = [
        { from: "tempFrom", to: "tempTo", label: "Temp" },
        { from: "carbonFrom", to: "carbonTo", label: "Kolhalt", step: "0.01" },
        {
            from: "responsivenessFrom",
            to: "responsivenessTo",
            label: "Respons",
            step: "0.01",
        },
        { from: "noiseFrom", to: "noiseTo", label: "Brus", step: "0.01" },
        { from: "offsetFrom", to: "offsetTo", label: "Offset", step: "0.01" },
        {
            from: "alarmMarginFrom",
            to: "alarmMarginTo",
            label: "Alarm-marginal",
            step: "0.01",
        },
    ];

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
                    {fieldDefs.map(({ from, to, label, step: stepVal }) => (
                        <div key={from} className="field-pair">
                            <label>
                                {label} från:
                                <input
                                    type="number"
                                    step={stepVal}
                                    value={
                                        (step as Record<
                                            keyof ScenarioStep,
                                            number | undefined
                                        >)[from] ?? 0
                                    }
                                    onChange={(e) =>
                                        updateStep(
                                            i,
                                            from as keyof ScenarioStep,
                                            +e.target.value
                                        )
                                    }
                                />
                            </label>
                            <label>
                                {label} till:
                                <input
                                    type="number"
                                    step={stepVal}
                                    value={
                                        (step as Record<
                                            keyof ScenarioStep,
                                            number | undefined
                                        >)[to] ?? 0
                                    }
                                    onChange={(e) =>
                                        updateStep(
                                            i,
                                            to as keyof ScenarioStep,
                                            +e.target.value
                                        )
                                    }
                                />
                            </label>
                        </div>
                    ))}
                    <button onClick={() => removeStep(i)}>Ta bort</button>
                </div>
            ))}
            <button onClick={addStep}>Lägg till steg</button>
        </div>
    );
}
