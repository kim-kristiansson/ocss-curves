import React, { useState, useRef, useEffect } from "react";
import { useSimulation } from "./hooks/useSimulation";
import Chart from "./components/Chart";
import Controls from "./components/Controls";
import Sliders from "./components/Sliders";
import Alarm from "./components/Alarm";

export default function App() {
    const sim = useSimulation();

    const [chartWidth, setChartWidth] = useState(1200);
    const [chartHeight, setChartHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setChartWidth(w);
            setChartHeight(Math.round(h * 0.6));
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="app">
            <h2>Simulering</h2>

            <Chart
                data={sim.data}
                chartWidth={chartWidth}
                chartHeight={chartHeight}
                containerRef={containerRef}
                alarmEvents={sim.alarmEvents}
            />

            <Controls
                onStart={sim.reset}
                onStop={() => sim.setRunning(false)}
                setSpeed={sim.setSpeed}
                onDefaults={sim.setDefaults}
            />

            <div>
                <p>Temperatur – Bör: {sim.targetTemp}°C | Är: {sim.currentTemp.toFixed(1)}°C</p>
                <p>
                    Kolhalt – Bör: {sim.carbonTarget.toFixed(2)} | Är: {sim.currentCarbon.toFixed(2)} |
                    Medelvärde (inom {sim.avgWindow.toFixed(0)}s): {sim.avgCarbon.toFixed(2)}
                </p>
            </div>

            <Sliders
                targetTemp={sim.targetTemp}
                setTargetTemp={sim.setTargetTemp}
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
                avgWindow={sim.avgWindow}
                setAvgWindow={sim.setAvgWindow}
            />

            <Alarm
                alarm={sim.alarm}
                avgCarbon={sim.avgCarbon}
                carbonTarget={sim.carbonTarget}
                alarmMargin={sim.alarmMargin}
                avgWindow={sim.avgWindow}
                onAcknowledge={sim.acknowledgeAlarm}
            />

            <style>{`
        .app {
          font-family: sans-serif;
          padding: 0;
          color: white;
          background: #111;
          width: 100%;
          height: 100%;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
      `}</style>
        </div>
    );
}
