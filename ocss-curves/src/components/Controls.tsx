import React from "react";

export default function Controls({ onStart, onStop, setSpeed, onDefaults }) {
    return (
        <div className="controls">
            <button
                onClick={() => {
                    onDefaults(); // återställ sliders
                    onStart();    // starta simuleringen
                }}
            >
                Starta
            </button>

            <button onClick={onStop}>Stoppa</button>

            <button onClick={onDefaults}>Återställ standardvärden</button>

            <div className="speed-controls">
                <button onClick={() => setSpeed(1)}>x1</button>
                <button onClick={() => setSpeed(2)}>x2</button>
                <button onClick={() => setSpeed(5)}>x5</button>
                <button onClick={() => setSpeed(10)}>x10</button>
            </div>
        </div>
    );
}
