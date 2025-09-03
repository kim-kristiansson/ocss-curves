import { useState, useRef, useEffect } from "react";

export type AlarmEvent = { time: number; value: number };

export type ScenarioStep = {
    duration: number; // minutes
    tempFrom?: number;
    tempTo?: number;
    carbonFrom?: number;
    carbonTo?: number;
    responsivenessFrom?: number;
    responsivenessTo?: number;
    noiseFrom?: number;
    noiseTo?: number;
    offsetFrom?: number;
    offsetTo?: number;
    alarmMarginFrom?: number;
    alarmMarginTo?: number;
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

    const [carbonTarget, setCarbonTarget] = useState(DEFAULTS.carbonTarget);
    const carbonTargetRef = useRef(carbonTarget);
    useEffect(() => {
        carbonTargetRef.current = carbonTarget;
    }, [carbonTarget]);
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
    const noiseStateRef = useRef(0);
    const scenarioRef = useRef<ScenarioStep[]>(scenario);
    const scenarioIndexRef = useRef(0);
    const scenarioElapsedRef = useRef(0);

    useEffect(() => {
        scenarioRef.current = scenario;
        scenarioIndexRef.current = 0;
        scenarioElapsedRef.current = 0;
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
                let offsetVal = offsetRef.current;

                const steps = scenarioRef.current;
                if (steps.length > 0) {
                    const step = steps[scenarioIndexRef.current];
                    const durationMs = step.duration * 60 * 1000;
                    const progress = Math.min(
                        1,
                        scenarioElapsedRef.current / durationMs
                    );

                    if (
                        step.offsetFrom !== undefined &&
                        step.offsetTo !== undefined
                    ) {
                        offsetVal =
                            step.offsetFrom +
                            (step.offsetTo - step.offsetFrom) * progress;
                        offsetRef.current = offsetVal;
                        setOffset(offsetVal);
                    }

                    if (step.tempFrom !== undefined && step.tempTo !== undefined) {
                        setTemp =
                            step.tempFrom +
                            (step.tempTo - step.tempFrom) * progress;
                        targetTempRef.current = setTemp;
                        setTargetTemp(setTemp);
                    }

                    if (
                        step.carbonFrom !== undefined &&
                        step.carbonTo !== undefined
                    ) {
                        baseCarbon =
                            step.carbonFrom +
                            (step.carbonTo - step.carbonFrom) * progress;
                        carbonTargetRef.current = baseCarbon;
                        setCarbonTarget(baseCarbon);
                    }

                    if (
                        step.responsivenessFrom !== undefined &&
                        step.responsivenessTo !== undefined
                    ) {
                        const val =
                            step.responsivenessFrom +
                            (step.responsivenessTo - step.responsivenessFrom) *
                                progress;
                        responsivenessRef.current = val;
                        setResponsiveness(val);
                    }

                    if (step.noiseFrom !== undefined && step.noiseTo !== undefined) {
                        const val =
                            step.noiseFrom +
                            (step.noiseTo - step.noiseFrom) * progress;
                        noiseRef.current = val;
                        setNoise(val);
                    }

                    if (
                        step.alarmMarginFrom !== undefined &&
                        step.alarmMarginTo !== undefined
                    ) {
                        const val =
                            step.alarmMarginFrom +
                            (step.alarmMarginTo - step.alarmMarginFrom) *
                                progress;
                        alarmMarginRef.current = val;
                        setAlarmMargin(val);
                    }

                    scenarioElapsedRef.current += stepMs;
                    if (
                        progress >= 1 &&
                        scenarioIndexRef.current < steps.length - 1
                    ) {
                        scenarioIndexRef.current++;
                        scenarioElapsedRef.current = 0;
                    }
                } else {
                    const rampTime = 60 * 1000;
                    const progress = Math.min(
                        1,
                        simTimeRef.current / rampTime
                    );
                    setTemp = progress * targetTempRef.current;
                    baseCarbon = progress * carbonTargetRef.current;
                }

                const setCarbon = baseCarbon + offsetVal;

                // Temperature (gentle approach to setpoint)
                let measuredTemp = lastTemp + (setTemp - lastTemp) * (stepMs / 5000);
                if (Math.random() < 0.02) measuredTemp += Math.random() * 4 - 2;

                // Carbon with filtered noise
                const drift =
                    1 - Math.exp(-responsivenessRef.current * (stepMs / 1000));
                const carbonDrift = (setCarbon - lastCarbon) * drift;

                const randomShock = (Math.random() * 2 - 1) * noiseRef.current;
                noiseStateRef.current =
                    noiseStateRef.current * 0.9 + randomShock * 0.1;

                const measuredCarbon =
                    lastCarbon + carbonDrift + noiseStateRef.current;

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
    }, [running, speed, stepMs]);

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
            noiseStateRef.current = 0;
            scenarioIndexRef.current = 0;
            scenarioElapsedRef.current = 0;
            setRunning(true);
            setAlarm(false);
            setAlarmEvents([]);
        },
    };
}
