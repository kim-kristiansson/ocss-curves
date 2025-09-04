import { useState, useRef, useEffect } from "react";

export type AlarmEvent = { time: number; value: number };

export type ScenarioEffect = {
    start: number; // minutes from step start
    duration: number; // minutes this effect applies
    responsiveness: number;
    noise: number;
    offset: number;
    alarmMargin: number;
};

export type ScenarioStep =
    | {
          type: "temperature";
          target: number; // desired setpoint
          ramp: number; // minutes to reach target
          duration: number; // minutes to hold after ramp
      }
    | {
          type: "carbon";
          target: number;
          ramp: number;
          duration: number;
          effects?: ScenarioEffect[];
      };

export type Scenario = {
    startTemp: number;
    startCarbon: number;
    steps: ScenarioStep[];
};

export const DEFAULTS = {
    carbonTarget: 1.2,
    responsiveness: 0.1,
    noise: 0.05,
    offset: 0,
    alarmMargin: 0.2,
};

export function useSimulation(
    initialTemp: number = 860,
    initialCarbon: number = DEFAULTS.carbonTarget,
    stepMs: number = 100,
    scenario: ScenarioStep[] = []
) {
    const [data, setData] = useState<
        { time: number; carbon: number; temperature: number; carbonAvg: number }[]
    >([]);
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(1);

    const [targetTemp, setTargetTemp] = useState(initialTemp);
    const targetTempRef = useRef(targetTemp);
    useEffect(() => {
        targetTempRef.current = targetTemp;
    }, [targetTemp]);
    useEffect(() => {
        targetTempRef.current = initialTemp;
        setTargetTemp(initialTemp);
    }, [initialTemp]);

    const [carbonTarget, setCarbonTarget] = useState(initialCarbon);
    const carbonTargetRef = useRef(carbonTarget);
    useEffect(() => {
        carbonTargetRef.current = carbonTarget;
    }, [carbonTarget]);
    useEffect(() => {
        carbonTargetRef.current = initialCarbon;
        setCarbonTarget(initialCarbon);
    }, [initialCarbon]);
    const [currentTemp, setCurrentTemp] = useState(0);
    const [currentCarbon, setCurrentCarbon] = useState(0);
    const [avgCarbon, setAvgCarbon] = useState(0);

    const [responsiveness, setResponsiveness] = useState(DEFAULTS.responsiveness);
    const [noise, setNoise] = useState(DEFAULTS.noise);
    const [offset, setOffset] = useState(DEFAULTS.offset);

    const [alarmMargin, setAlarmMargin] = useState(DEFAULTS.alarmMargin);
    const responsivenessRef = useRef(responsiveness);
    useEffect(() => {
        responsivenessRef.current = responsiveness;
    }, [responsiveness]);
    const noiseRef = useRef(noise);
    useEffect(() => {
        noiseRef.current = noise;
    }, [noise]);
    const offsetRef = useRef(offset);
    const prevOffsetRef = useRef(offset);
    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);
    const alarmMarginRef = useRef(alarmMargin);
    useEffect(() => {
        alarmMarginRef.current = alarmMargin;
    }, [alarmMargin]);
    const [alarm, setAlarm] = useState(false);
    const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);

    const simTimeRef = useRef(0);
    type TempStep = Extract<ScenarioStep, { type: "temperature" }> & { start: number };
    type CarbonStep = Extract<ScenarioStep, { type: "carbon" }> & { start: number };

    const tempStepsRef = useRef<TempStep[]>([]);
    const carbonStepsRef = useRef<CarbonStep[]>([]);

    useEffect(() => {
        let tempT = 0;
        let carbonT = 0;
        const temps: TempStep[] = [];
        const carbons: CarbonStep[] = [];

        scenario.forEach((s) => {
            if (s.type === "temperature") {
                temps.push({ ...s, start: tempT });
                tempT += s.ramp + s.duration;
            } else if (s.type === "carbon") {
                carbons.push({ ...s, start: carbonT });
                carbonT += s.ramp + s.duration;
            }
        });

        tempStepsRef.current = temps;
        carbonStepsRef.current = carbons;
    }, [scenario]);

    const acknowledgeAlarm = () => setAlarm(false);

    const setDefaults = () => {
        setCarbonTarget(DEFAULTS.carbonTarget);
        setResponsiveness(DEFAULTS.responsiveness);
        setNoise(DEFAULTS.noise);
        setOffset(DEFAULTS.offset);
        setAlarmMargin(DEFAULTS.alarmMargin);
    };

    // Simulation loop (interval speeds up with `speed`)
    useEffect(() => {
        if (!running) return;

        const tick = () => {
            setData((prev) => {
                const lastCarbon = prev.length ? prev[prev.length - 1].carbon : 0;
                const lastTemp = prev.length ? prev[prev.length - 1].temperature : 0;

                simTimeRef.current += stepMs;

                let setTemp = targetTempRef.current;
                let baseCarbon = carbonTargetRef.current;
                let setCarbon = baseCarbon;
                let respVal = DEFAULTS.responsiveness;
                let noiseVal = DEFAULTS.noise;
                let marginVal = DEFAULTS.alarmMargin;
                let offsetVal = DEFAULTS.offset;

                if (
                    tempStepsRef.current.length > 0 ||
                    carbonStepsRef.current.length > 0
                ) {
                    let tempBase = initialTemp;
                    tempStepsRef.current.forEach((step) => {
                        const startMs = step.start * 60 * 1000;
                        if (simTimeRef.current < startMs) return;
                        const rampMs = step.ramp * 60 * 1000;
                        const progress = Math.min(
                            1,
                            (simTimeRef.current - startMs) /
                                Math.max(1, rampMs)
                        );
                        setTemp =
                            tempBase + (step.target - tempBase) * progress;
                        if (simTimeRef.current >= startMs + rampMs) {
                            tempBase = step.target;
                        } else {
                            tempBase =
                                tempBase +
                                (step.target - tempBase) * progress;
                        }
                    });
                    targetTempRef.current = setTemp;
                    setTargetTemp(setTemp);

                    let carbonBase = initialCarbon;
                    carbonStepsRef.current.forEach((step) => {
                        const startMs = step.start * 60 * 1000;
                        const rampMs = step.ramp * 60 * 1000;
                        if (simTimeRef.current < startMs) return;
                        const progress = Math.min(
                            1,
                            (simTimeRef.current - startMs) /
                                Math.max(1, rampMs)
                        );
                        baseCarbon =
                            carbonBase + (step.target - carbonBase) * progress;
                        if (simTimeRef.current >= startMs + rampMs) {
                            carbonBase = step.target;
                        } else {
                            carbonBase =
                                carbonBase +
                                (step.target - carbonBase) * progress;
                        }

                        if (step.effects) {
                            for (const eff of step.effects) {
                                const effStart =
                                    startMs + eff.start * 60 * 1000;
                                const effEnd =
                                    effStart + eff.duration * 60 * 1000;
                                if (
                                    simTimeRef.current >= effStart &&
                                    simTimeRef.current < effEnd
                                ) {
                                    respVal = eff.responsiveness;
                                    noiseVal = eff.noise;
                                    marginVal = eff.alarmMargin;
                                    offsetVal = eff.offset;
                                    break;
                                }
                            }
                        }
                        setCarbon = baseCarbon;
                    });
                    carbonTargetRef.current = setCarbon;
                    setCarbonTarget(setCarbon);
                } else {
                    const rampTime = 60 * 1000;
                    const progress = Math.min(
                        1,
                        simTimeRef.current / rampTime
                    );
                    setTemp = progress * targetTempRef.current;
                    baseCarbon = progress * carbonTargetRef.current;
                    carbonTargetRef.current = baseCarbon;
                    setCarbonTarget(baseCarbon);
                }

                offsetRef.current = offsetVal;
                setOffset(offsetVal);

                responsivenessRef.current = respVal;
                setResponsiveness(respVal);
                noiseRef.current = noiseVal;
                setNoise(noiseVal);
                alarmMarginRef.current = marginVal;
                setAlarmMargin(marginVal);

                const prevOffset = prevOffsetRef.current;
                const currentOffset = offsetRef.current;
                prevOffsetRef.current = currentOffset;

                const setCarbonVal = carbonTargetRef.current;

                // Temperature (gentle approach to setpoint)
                let measuredTemp = lastTemp + (setTemp - lastTemp) * (stepMs / 5000);
                if (Math.random() < 0.02) measuredTemp += Math.random() * 4 - 2;

                // Carbon with noise
                const drift =
                    1 - Math.exp(-responsivenessRef.current * (stepMs / 1000));
                const baseLast = lastCarbon - prevOffset;
                const carbonDrift = (setCarbonVal - baseLast) * drift;

                const randomShock = (Math.random() * 2 - 1) * noiseRef.current;

                const measuredCarbon =
                    baseLast + carbonDrift + randomShock + currentOffset;

                // 10s moving average
                const windowMs = 10 * 1000;
                const cutoff = simTimeRef.current - windowMs;
                const slice = prev.filter((d) => d.time >= cutoff);
                const avg =
                    slice.reduce((sum, d) => sum + d.carbon, 0) / (slice.length || 1);

                const newPoint = {
                    time: simTimeRef.current,
                    carbon: measuredCarbon,
                    temperature: measuredTemp,
                    carbonAvg: avg,
                };

                setCurrentTemp(measuredTemp);
                setCurrentCarbon(measuredCarbon);
                setAvgCarbon(avg);

                // Return new array (append 1 point per tick)
                return [...prev, newPoint];
            });
        };

        const interval = setInterval(tick, stepMs / Math.max(1, speed));
        return () => clearInterval(interval);
    }, [running, speed, stepMs, initialTemp, initialCarbon]);

    // Alarm check
    useEffect(() => {
        if (data.length === 0) return;

        const latest = data[data.length - 1];
        const avg = latest.carbonAvg ?? 0;

        const tempInRange =
            currentTemp >= targetTemp - 5 && currentTemp <= targetTemp + 5;

        if (!tempInRange) return;

        if (avg > carbonTarget + alarmMargin || avg < carbonTarget - alarmMargin) {
            if (!alarm) {
                setAlarm(true);
                setAlarmEvents((evts) => [...evts, { time: latest.time, value: avg }]);
            }
        }
    }, [data, carbonTarget, alarmMargin, currentTemp, targetTemp, alarm]);

    return {
        data,
        running,
        setRunning,
        speed,
        setSpeed,
        targetTemp,
        setTargetTemp,
        carbonTarget,
        setCarbonTarget,
        currentTemp,
        currentCarbon,
        avgCarbon,
        responsiveness,
        setResponsiveness,
        noise,
        setNoise,
        offset,
        setOffset,
        alarmMargin,
        setAlarmMargin,
        alarm,
        acknowledgeAlarm,
        setDefaults,
        alarmEvents,
        reset: () => {
            setData([]);
            simTimeRef.current = 0;
            targetTempRef.current = initialTemp;
            setTargetTemp(initialTemp);
            carbonTargetRef.current = initialCarbon;
            setCarbonTarget(initialCarbon);
            setRunning(true);
            setAlarm(false);
            setAlarmEvents([]);
        },
    };
}
