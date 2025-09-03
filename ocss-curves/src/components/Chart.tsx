import React, {useState, useEffect, useCallback} from "react";

type AlarmEvent = { time: number; value: number };

type Props = {
    data: {
        time: number;
        carbon: number;
        temperature: number;
        carbonAvg: number;
        targetTemp: number;
        carbonTarget: number;
        alarmMargin: number;
    }[];
    chartWidth: number;
    chartHeight: number;
    containerRef: React.RefObject<HTMLDivElement>;
    alarmEvents: AlarmEvent[];
};

export default function Chart({
                                  data,
                                  chartWidth,
                                  chartHeight,
                                  containerRef,
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

    const TEMP_MAX = 1000;
    const scaleTempY = (val: number, height: number, pad: number) =>
        height - (val / TEMP_MAX) * (height - pad * 2);

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

    const buildStepPath = (
        key: "targetTemp" | "carbonTarget" | "alarmTop" | "alarmBottom",
        scaleFn: (v: number, h: number, p: number) => number,
        width: number,
        height: number,
        pad: number
    ) => {
        if (visibleData.length === 0) return "";
        const pts: string[] = [];
        for (let i = 0; i < visibleData.length; i++) {
            const d = visibleData[i];
            const x = scaleX(d.time, width, pad);
            const y = scaleFn(
                key === "alarmTop"
                    ? d.carbonTarget + d.alarmMargin
                    : key === "alarmBottom"
                        ? d.carbonTarget - d.alarmMargin
                        : (d[key] as number),
                height,
                pad
            );
            if (i === 0) {
                pts.push(`M ${x} ${y}`);
            } else {
                const prev = visibleData[i - 1];
                const prevY = scaleFn(
                    key === "alarmTop"
                        ? prev.carbonTarget + prev.alarmMargin
                        : key === "alarmBottom"
                            ? prev.carbonTarget - prev.alarmMargin
                            : (prev[key] as number),
                    height,
                    pad
                );
                pts.push(`L ${x} ${prevY}`);
                pts.push(`L ${x} ${y}`);
            }
        }
        return pts.join(" ");
    };

    const buildAlarmArea = (
        width: number,
        height: number,
        pad: number
    ) => {
        if (visibleData.length === 0) return "";
        const top: [number, number][] = [];
        const bottom: [number, number][] = [];
        for (let i = 0; i < visibleData.length; i++) {
            const d = visibleData[i];
            const x = scaleX(d.time, width, pad);
            const topY = scaleCarbonY(
                d.carbonTarget + d.alarmMargin,
                height,
                pad
            );
            const bottomY = scaleCarbonY(
                d.carbonTarget - d.alarmMargin,
                height,
                pad
            );
            if (i > 0) {
                const prev = visibleData[i - 1];
                const prevTop = scaleCarbonY(
                    prev.carbonTarget + prev.alarmMargin,
                    height,
                    pad
                );
                const prevBottom = scaleCarbonY(
                    prev.carbonTarget - prev.alarmMargin,
                    height,
                    pad
                );
                top.push([x, prevTop]);
                bottom.unshift([x, prevBottom]);
            }
            top.push([x, topY]);
            bottom.unshift([x, bottomY]);
        }
        const commands = [
            `M ${top[0][0]} ${top[0][1]}`,
            ...top.slice(1).map(([x, y]) => `L ${x} ${y}`),
            ...bottom.map(([x, y]) => `L ${x} ${y}`),
            "Z",
        ];
        return commands.join(" ");
    };

    const legendItems = [
        {label: "Temperatur", color: "red"},
        {label: "Kolhalt", color: "green"},
        {label: "Kolhalt (medel)", color: "blue", dash: "5,5"},
    ];
    const labelFontSize = 32;
    const legendSpacing = labelFontSize + 12;

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

                {/* Carbon avg */}
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

                {/* Alarm zone */}
                <path
                    d={buildAlarmArea(chartWidth, chartHeight, padding)}
                    fill="rgba(255,0,0,0.15)"
                    stroke="red"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                />

                {/* Target lines */}
                <path
                    d={buildStepPath("targetTemp", scaleTempY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="red"
                    strokeDasharray="4,4"
                />
                <path
                    d={buildStepPath("carbonTarget", scaleCarbonY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="green"
                    strokeDasharray="4,4"
                />

                {/* Alarm margin lines */}
                <path
                    d={buildStepPath("alarmTop", scaleCarbonY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="red"
                    strokeDasharray="4,4"
                />
                <path
                    d={buildStepPath("alarmBottom", scaleCarbonY, chartWidth, chartHeight, padding)}
                    fill="none"
                    stroke="red"
                    strokeDasharray="4,4"
                />

                {/* Alarm label */}
                {(() => {
                    const latest = visibleData[visibleData.length - 1];
                    const y = scaleCarbonY(
                        latest.carbonTarget + latest.alarmMargin,
                        chartHeight,
                        padding
                    );
                    return (
                        <text
                            x={chartWidth - padding - 150}
                            y={y + labelFontSize}
                            fill="red"
                            fontSize={labelFontSize}
                        >
                            Larmzon
                        </text>
                    );
                })()}

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
