import React, {useState, useEffect, useCallback} from "react";

type AlarmEvent = { time: number; value: number };

type Props = {
    data: { time: number; carbon: number; temperature: number; carbonAvg: number }[];
    chartWidth: number;
    chartHeight: number;
    containerRef: React.RefObject<HTMLDivElement>;
    targetTemp: number;
    carbonTarget: number;
    alarmMargin: number;
    alarmEvents: AlarmEvent[]; // new
};

export default function Chart({
                                  data,
                                  chartWidth,
                                  chartHeight,
                                  containerRef,
                                  targetTemp,
                                  carbonTarget,
                                  alarmMargin,
                                  alarmEvents,
                              }: Props) {
    const [windowMs, setWindowMs] = useState<number | null>(null);

    const hasData = data.length >= 2;
    const padding = 60;

    const fullMinTime = hasData ? data[0].time : 0;
    const fullMaxTime = hasData ? data[data.length - 1].time : 0;

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();
            const fullRange = fullMaxTime - fullMinTime;
            const current = windowMs ?? fullRange;
            if (e.deltaY < 0) {
                const next = Math.max(1000, current * 0.9);
                setWindowMs(next);
            } else {
                const next = current * 1.1;
                if (next >= fullRange) setWindowMs(null);
                else setWindowMs(next);
            }
        },
        [fullMaxTime, fullMinTime, windowMs]
    );

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        node.addEventListener("wheel", handleWheel, {passive: false});
        return () => {
            node.removeEventListener("wheel", handleWheel);
        };
    }, [containerRef, handleWheel]);

    if (!hasData) {
        return (
            <div ref={containerRef} className="chart-container">
                Ingen data ännu
            </div>
        );
    }

    const maxTime = fullMaxTime;
    const minTime =
        windowMs == null
            ? fullMinTime
            : Math.max(fullMaxTime - windowMs, fullMinTime);

    const visibleData = data.filter((d) => d.time >= minTime);

    const scaleX = (t: number, width: number, pad: number) =>
        ((t - minTime) / (maxTime - minTime)) * (width - pad * 2) + pad;

    const scaleTempY = (val: number, height: number, pad: number) =>
        height - ((val - 0) / targetTemp) * (height - pad * 2);

    const scaleCarbonY = (val: number, height: number, pad: number) =>
        height - ((val - 0) / 2) * (height - pad * 2);

    const buildPath = (
        key: "temperature" | "carbon" | "carbonAvg",
        scaleFn: (v: number, h: number, p: number) => number,
        width: number,
        height: number,
        pad: number
    ) =>
        visibleData
            .map(
                (d, i) =>
                    `${i === 0 ? "M" : "L"} ${scaleX(d.time, width, pad)} ${scaleFn(
                        d[key as keyof typeof d] as number,
                        height,
                        pad
                    )}`
            )
            .join(" ");

    const legendItems = [
        {label: "Temperatur", color: "red"},
        {label: "Kolhalt", color: "green"},
        {label: "Kolhalt (medel)", color: "blue", dash: "5,5"},
    ];
    const labelFontSize = 32;
    const legendSpacing = labelFontSize + 12;

    const alarmTop = scaleCarbonY(carbonTarget + alarmMargin, chartHeight, padding);
    const alarmBottom = scaleCarbonY(carbonTarget - alarmMargin, chartHeight, padding);

    return (
        <div className="chart-container" ref={containerRef}>
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{width: "100%", height: "100%", display: "block"}}
            >
                {/* Temperature */}
                <path
                    d={buildPath("temperature", scaleTempY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="red"
                    strokeWidth={2}
                />

                {/* Carbon */}
                <path
                    d={buildPath("carbon", scaleCarbonY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="green"
                    strokeWidth={2}
                />

                {/* Carbon avg (10s) */}
                <path
                    d={buildPath("carbonAvg", scaleCarbonY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="blue"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                />

                {/* Legend */}
                <g className="legend">
                    {legendItems.map((item, idx) => (
                        <g
                            key={item.label}
                            transform={`translate(${padding + 10}, ${padding + idx * legendSpacing})`}
                        >
                            <line
                                x1={0}
                                x2={20}
                                y1={labelFontSize / 2}
                                y2={labelFontSize / 2}
                                stroke={item.color}
                                strokeWidth={2}
                                strokeDasharray={item.dash}
                            />
                            <text x={25} y={labelFontSize} fill="#fff" fontSize={labelFontSize}>
                                {item.label}
                            </text>
                        </g>
                    ))}
                </g>

                <rect
                    x={padding}
                    width={chartWidth - padding * 2}
                    y={alarmTop}
                    height={alarmBottom - alarmTop}
                    fill="rgba(255, 0, 0, 0.15)"   // red transparent zone
                    stroke="red"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />

                <text
                    x={chartWidth - padding - 150}
                    y={alarmTop + labelFontSize}
                    fill="red"
                    fontSize={labelFontSize}
                >
                    Larmzon
                </text>

                {/* Target lines */}
                <line
                    x1={padding}
                    x2={chartWidth - padding}
                    y1={scaleTempY(targetTemp, chartHeight, padding)}
                    y2={scaleTempY(targetTemp, chartHeight, padding)}
                    stroke="red"
                    strokeDasharray="4,4"
                />
                <line
                    x1={padding}
                    x2={chartWidth - padding}
                    y1={scaleCarbonY(carbonTarget, chartHeight, padding)}
                    y2={scaleCarbonY(carbonTarget, chartHeight, padding)}
                    stroke="green"
                    strokeDasharray="4,4"
                />

                {/* Alarm markers */}
                {alarmEvents
                    .filter((evt) => evt.time >= minTime)
                    .map((evt, i) => (
                        <circle
                            key={i}
                            cx={scaleX(evt.time, chartWidth, padding)}
                            cy={scaleCarbonY(evt.value, chartHeight, padding)}
                            r={5}
                            fill="yellow"
                            stroke="black"
                            strokeWidth={1}
                        />
                    ))}
            </svg>

            <style>{`
        .chart-container {
          width: 100%;
          height: 60vh;
          background: #222;
          border: 1px solid #444;
          border-radius: 5px;
          overflow: visible;
        }
      `}</style>
        </div>
    );
}
