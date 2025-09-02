import React, { useState, useRef, useEffect } from "react";
import { useSimulation } from "./hooks/useSimulation";
import Chart from "./components/Chart";
import Controls from "./components/Controls";
import Sliders from "./components/Sliders";
import Alarm from "./components/Alarm";

export default function App() {
    const sim = useSimulation(860);

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
