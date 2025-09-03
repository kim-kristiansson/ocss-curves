import React from "react";

export default function Sliders({
                                    carbonTarget,
                                    setCarbonTarget,
                                    responsiveness,
                                    setResponsiveness,
                                    noise,
                                    setNoise,
                                    offset,
                                    setOffset,
                                    alarmMargin,
                                    setAlarmMargin,
                                    avgWindow,
                                    setAvgWindow,
                                }) {
    return (
        <div className="sliders">
            <label>
                Börvärde kolhalt: {carbonTarget.toFixed(2)}
                <input type="range" min="0" max="2" step="0.01" value={carbonTarget} onChange={(e) => setCarbonTarget(+e.target.value)} />
            </label>
            <label>
                Responsivitet: {responsiveness.toFixed(2)}
                <input type="range" min="0.01" max="0.5" step="0.01" value={responsiveness} onChange={(e) => setResponsiveness(+e.target.value)} />
            </label>
            <label>
                Brus: {noise.toFixed(2)}
                <input type="range" min="0" max="0.2" step="0.01" value={noise} onChange={(e) => setNoise(+e.target.value)} />
            </label>
            <label>
                Förskjutning: {offset.toFixed(2)}
                <input type="range" min="-1" max="1" step="0.01" value={offset} onChange={(e) => setOffset(+e.target.value)} />
            </label>
            <label>
                Larmmarginal: ±{alarmMargin.toFixed(2)}
                <input type="range" min="0.05" max="0.5" step="0.01" value={alarmMargin} onChange={(e) => setAlarmMargin(+e.target.value)} />
            </label>
            <label>
                Medelperiod: {avgWindow.toFixed(0)}s
                <input type="range" min="1" max="60" step="1" value={avgWindow} onChange={(e) => setAvgWindow(+e.target.value)} />
            </label>
        </div>
    );
}
