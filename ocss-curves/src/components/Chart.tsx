import type { RefObject } from "react";

const MAX_TEMP = 1600;
const MAX_CARBON = 1.6;

type AlarmEvent = { time: number; value: number };

type ScenarioPoint = { time: number; temperature: number; carbon: number };

type Props = {
    data: {
        time: number;
        carbon: number;
        temperature: number;
        carbonAvg: number;
    }[];
    scenario?: ScenarioPoint[];
    chartWidth: number;
    chartHeight: number;
    containerRef: RefObject<HTMLDivElement | null>;
    targetTemp: number;
    carbonTarget: number;
    alarmMargin: number;
    alarmEvents: AlarmEvent[];
};

export default function Chart({
                                  data,
                                  scenario = [],
                                  chartWidth,
                                  chartHeight,
                                  containerRef,
                                  targetTemp,
                                  carbonTarget,
                                  alarmMargin,
                                  alarmEvents,
                              }: Props) {
    if (data.length < 2 && scenario.length < 2) {
        return (
            <div ref={containerRef} className="chart-container">
                Ingen data ännu
            </div>
        );
    }

    const allTimes = [
        ...(data.length ? [data[0].time, data[data.length - 1].time] : []),
        ...(scenario.length
            ? [scenario[0].time, scenario[scenario.length - 1].time]
            : []),
    ];
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const padding = 60;

    const scaleX = (t: number, width: number, pad: number) =>
        ((t - minTime) / (maxTime - minTime)) * (width - pad * 2) + pad;

    const scaleTempY = (val: number, height: number, pad: number) =>
        height - ((val - 0) / MAX_TEMP) * (height - pad * 2);

    const scaleCarbonY = (val: number, height: number, pad: number) =>
        height - ((val - 0) / MAX_CARBON) * (height - pad * 2);

    const tempTicks = Array.from({ length: 5 }, (_, i) => (MAX_TEMP / 4) * i);
    const carbonTicks = Array.from({ length: 5 }, (_, i) => (MAX_CARBON / 4) * i);

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

    const buildScenarioPath = (
        key: "temperature" | "carbon",
        scaleFn: (v: number, h: number, p: number) => number,
        width: number,
        height: number,
        pad: number
    ) =>
        scenario
            .map(
                (d, i) =>
                    `${i === 0 ? "M" : "L"} ${scaleX(d.time, width, pad)} ${scaleFn(
                        d[key as keyof typeof d],
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
                {/* Axes */}
                <line
                    x1={padding}
                    x2={padding}
                    y1={padding}
                    y2={chartHeight - padding}
                    stroke="#555"
                />
                <line
                    x1={chartWidth - padding}
                    x2={chartWidth - padding}
                    y1={padding}
                    y2={chartHeight - padding}
                    stroke="#555"
                />

                {tempTicks.map((t) => (
                    <text
                        key={`temp-${t}`}
                        x={padding - 10}
                        y={scaleTempY(t, chartHeight, padding) + 4}
                        fontSize={12}
                        fill="red"
                        textAnchor="end"
                    >
                        {t}
                    </text>
                ))}

                {carbonTicks.map((c) => (
                    <text
                        key={`carbon-${c}`}
                        x={chartWidth - padding + 10}
                        y={scaleCarbonY(c, chartHeight, padding) + 4}
                        fontSize={12}
                        fill="green"
                        textAnchor="start"
                    >
                        {c.toFixed(1)}
                    </text>
                ))}

                {scenario.length > 0 && (
                    <>
                        <path
                            d={buildScenarioPath(
                                "temperature",
                                scaleTempY,
                                chartWidth,
                                chartHeight,
                                padding
                            )}
                            fill="none"
                            stroke="orange"
                            strokeWidth={1}
                            strokeDasharray="4,2"
                        />
                        <path
                            d={buildScenarioPath(
                                "carbon",
                                scaleCarbonY,
                                chartWidth,
                                chartHeight,
                                padding
                            )}
                            fill="none"
                            stroke="lime"
                            strokeWidth={1}
                            strokeDasharray="4,2"
                        />
                    </>
                )}
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
