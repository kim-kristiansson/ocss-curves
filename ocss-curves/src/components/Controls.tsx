type Props = {
    onStart: () => void;
    onStop: () => void;
    setSpeed: (v: number) => void;
    onDefaults: () => void;
};

export default function Controls({ onStart, onStop, setSpeed, onDefaults }: Props) {
    return (
        <div className="controls">
            <button
                onClick={() => {
                    onDefaults(); // återställ sliders
                    onStart();    // starta simuleringen
                }}
            >
                Start
            </button>

            <button onClick={onStop}>Stop</button>

            <button onClick={onDefaults}>Återställ till default</button>

            <div className="speed-controls">
                <button onClick={() => setSpeed(1)}>x1</button>
                <button onClick={() => setSpeed(2)}>x2</button>
                <button onClick={() => setSpeed(5)}>x5</button>
                <button onClick={() => setSpeed(10)}>x10</button>
            </div>
        </div>
    );
}
