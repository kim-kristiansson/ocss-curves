import { useState, useRef, useEffect, useMemo } from "react";
import { useSimulation, type Scenario, DEFAULTS } from "./hooks/useSimulation";
import Chart from "./components/Chart";
import Controls from "./components/Controls";
import Sliders from "./components/Sliders";
import Alarm from "./components/Alarm";
import ScenarioEditor from "./components/ScenarioEditor";

export default function App() {
    const [scenario, setScenario] = useState<Scenario>({
        startTemp: 0,
        startCarbon: DEFAULTS.carbonTarget,
        steps: [],
    });
    const [editingScenario, setEditingScenario] = useState(false);
    const sim = useSimulation(
        scenario.startTemp,
        scenario.startCarbon,
        100,
        scenario.steps
    );

    const scenarioPoints = useMemo(() => {
        type Pt = { time: number; temperature: number; carbon: number };
        const tempEvents: { time: number; temperature: number }[] = [];
        const carbonEvents: { time: number; carbon: number }[] = [];

        let temp = scenario.startTemp;
        let carbon = scenario.startCarbon;

        tempEvents.push({ time: 0, temperature: temp });
        carbonEvents.push({ time: 0, carbon });

        let tempTime = 0;
        let carbonTime = 0;

        scenario.steps.forEach((s) => {
            if (s.type === "temperature") {
                const start = tempTime * 60 * 1000;
                tempEvents.push({ time: start, temperature: temp });
                const rampEnd = start + s.ramp * 60 * 1000;
                temp = s.target;
                tempEvents.push({ time: rampEnd, temperature: temp });
                const end = rampEnd + s.duration * 60 * 1000;
                tempEvents.push({ time: end, temperature: temp });
                tempTime += s.ramp + s.duration;
            } else if (s.type === "carbon") {
                const start = carbonTime * 60 * 1000;
                carbonEvents.push({ time: start, carbon });
                const rampEnd = start + s.ramp * 60 * 1000;
                carbon = s.target;
                carbonEvents.push({ time: rampEnd, carbon });
                const end = rampEnd + s.duration * 60 * 1000;
                carbonEvents.push({ time: end, carbon });
                carbonTime += s.ramp + s.duration;
            }
        });

        const times = Array.from(
            new Set([
                ...tempEvents.map((e) => e.time),
                ...carbonEvents.map((e) => e.time),
            ])
        ).sort((a, b) => a - b);

        const pts: Pt[] = [];
        let ti = 0;
        let ci = 0;
        let lastTemp = scenario.startTemp;
        let lastCarbon = scenario.startCarbon;
        times.forEach((t) => {
            while (ti < tempEvents.length && tempEvents[ti].time <= t) {
                lastTemp = tempEvents[ti].temperature;
                ti++;
            }
            while (ci < carbonEvents.length && carbonEvents[ci].time <= t) {
                lastCarbon = carbonEvents[ci].carbon;
                ci++;
            }
            pts.push({ time: t, temperature: lastTemp, carbon: lastCarbon });
        });

        return pts;
    }, [scenario]);

    const [chartWidth, setChartWidth] = useState(1200);
    const [chartHeight, setChartHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const w = containerRef.current.clientWidth;
                setChartWidth(w);
                setChartHeight(Math.round(w * 0.6));
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="app">
            <h2>Simulering</h2>

            <div ref={containerRef}>
                <Chart
                    data={sim.data}
                    scenario={scenarioPoints}
                    chartWidth={chartWidth}
                    chartHeight={chartHeight}
                    containerRef={containerRef}
                    targetTemp={sim.targetTemp}
                    carbonTarget={sim.carbonTarget}
                    alarmMargin={sim.alarmMargin}
                    alarmEvents={sim.alarmEvents}
                />
            </div>

            <Controls
                onStart={sim.reset}
                onStop={() => sim.setRunning(false)}
                setSpeed={sim.setSpeed}
                onDefaults={sim.setDefaults}
            />

            <div>
                <p>🌡️ Temperatur – Bör: {sim.targetTemp}°C | Är: {sim.currentTemp.toFixed(1)}°C</p>
                <p>
                    🟢 Kolhalt – Bör: {sim.carbonTarget.toFixed(2)} | Är: {sim.currentCarbon.toFixed(2)} |
                    Medel (10s): {sim.avgCarbon.toFixed(2)}
                </p>
            </div>

            <Sliders
                carbonTarget={sim.carbonTarget}
                setCarbonTarget={sim.setCarbonTarget}
                responsiveness={sim.responsiveness}
                setResponsiveness={sim.setResponsiveness}
                noise={sim.noise}
                setNoise={sim.setNoise}
                offset={sim.offset}
                setOffset={sim.setOffset}
                alarmMargin={sim.alarmMargin}
                setAlarmMargin={sim.setAlarmMargin}
            />

            {editingScenario ? (
                <div>
                    <ScenarioEditor scenario={scenario} setScenario={setScenario} />
                    <button onClick={() => setEditingScenario(false)}>Stäng scenario</button>
                </div>
            ) : (
                <button onClick={() => setEditingScenario(true)}>Skapa scenario</button>
            )}

            <Alarm alarm={sim.alarm} avgCarbon={sim.avgCarbon} alarmMargin={sim.alarmMargin} onAcknowledge={sim.acknowledgeAlarm} />

            <style>{`
        .app {
          font-family: sans-serif;
          padding: 10px;
          color: white;
          background: #111;
          max-width: 100vw;
          max-height: 100vh;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
      `}</style>
        </div>
    );
}
