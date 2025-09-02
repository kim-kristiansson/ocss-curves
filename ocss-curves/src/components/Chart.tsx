import React from "react";

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
    if (data.length < 2) {
        return (
            <div ref={containerRef} className="chart-container">
                Ingen data ännu
            </div>
        );
    }

    const minTime = data[0].time;
    const maxTime = data[data.length - 1].time;
    const padding = 60;

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
        data
            .map(
                (d, i) =>
                    `${i === 0 ? "M" : "L"} ${scaleX(d.time, width, pad)} ${scaleFn(
                        d[key as keyof typeof d] as number,
                        height,
                        pad
                    )}`
            )
            .join(" ");

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

                <rect
                    x={padding}
                    width={chartWidth - padding * 2}
                    y={scaleCarbonY(carbonTarget + alarmMargin, chartHeight, padding)}
                    height={
                        scaleCarbonY(carbonTarget - alarmMargin, chartHeight, padding) -
                        scaleCarbonY(carbonTarget + alarmMargin, chartHeight, padding)
                    }
                    fill="rgba(255, 0, 0, 0.15)"   // red transparent zone
                    stroke="red"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />

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
                {alarmEvents.map((evt, i) => (
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
          max-width: 100vw;
          max-height: 100vh;
          background: #222;
          border: 1px solid #444;
          border-radius: 5px;
          overflow: visible;
        }
      `}</style>
        </div>
    );
}
