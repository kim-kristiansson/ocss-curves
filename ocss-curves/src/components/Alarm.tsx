import React from "react";

export default function Alarm({
    alarm,
    avgCarbon,
    carbonTarget,
    alarmMargin,
    avgWindow,
    onAcknowledge,
}) {
    if (!alarm) return null;

    const direction = avgCarbon > carbonTarget ? "för hög" : "för låg";

    return (
        <div className="alarm">
            🚨 LARM: Kolkurvans {avgWindow.toFixed(0)}s-medel ({avgCarbon.toFixed(2)}) är {direction} (bör {carbonTarget.toFixed(2)} ± {alarmMargin.toFixed(2)}; Temp inom ±5)
            <br />
            <button onClick={onAcknowledge}>Kvittera larm</button>

            <style>{`
        .alarm {
          background: #b00020;
          color: white;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          font-weight: bold;
        }
        @keyframes blink {
          50% { opacity: 0.4; }
        }
      `}</style>
        </div>
    );
}
