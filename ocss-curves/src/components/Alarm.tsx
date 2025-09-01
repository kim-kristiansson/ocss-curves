import React from "react";

export default function Alarm({ alarm, avgCarbon, alarmMargin, onAcknowledge }) {
    if (!alarm) return null;

    return (
        <div className="alarm">
            🚨 LARM: Kolkurvans 10s-medel ({avgCarbon.toFixed(2)}) utanför bör ± {alarmMargin.toFixed(2)} (Temp inom ±5)
            <br />
            <button onClick={onAcknowledge}>Kvittera larm</button>
        </div>
    );
}
