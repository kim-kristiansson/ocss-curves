import { useState, useRef, useEffect } from "react";

export type AlarmEvent = { time: number; value: number };

export type ScenarioStep = {
    duration: number; // minutes
    tempFrom: number;
    tempTo: number;
    carbonFrom: number;
    carbonTo: number;
};

const DEFAULTS = {
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
                let setCarbon = carbonTargetRef.current + offset;

                const steps = scenarioRef.current;
                if (steps.length > 0) {
                    const step = steps[scenarioIndexRef.current];
                    const durationMs = step.duration * 60 * 1000;
                    const progress = Math.min(
                        1,
                        scenarioElapsedRef.current / durationMs
                    );
                    setTemp =
                        step.tempFrom +
                        (step.tempTo - step.tempFrom) * progress;
                    setCarbon =
                        step.carbonFrom +
                        (step.carbonTo - step.carbonFrom) * progress +
                        offset;
                    scenarioElapsedRef.current += stepMs;
                    if (
                        progress >= 1 &&
                        scenarioIndexRef.current < steps.length - 1
                    ) {
                        scenarioIndexRef.current++;
                        scenarioElapsedRef.current = 0;
                    }
                    targetTempRef.current = setTemp;
                    carbonTargetRef.current = setCarbon - offset;
                    setTargetTemp(setTemp);
                    setCarbonTarget(setCarbon - offset);
                } else {
                    const rampTime = 60 * 1000;
                    const progress = Math.min(
                        1,
                        simTimeRef.current / rampTime
                    );
                    setTemp = progress * targetTempRef.current;
                    setCarbon = progress * carbonTargetRef.current + offset;
                }

                // Temperature (gentle approach to setpoint)
                let measuredTemp = lastTemp + (setTemp - lastTemp) * (stepMs / 5000);
                if (Math.random() < 0.02) measuredTemp += Math.random() * 4 - 2;

                // Carbon with filtered noise
                const drift = 1 - Math.exp(-responsiveness * (stepMs / 1000));
                const carbonDrift = (setCarbon - lastCarbon) * drift;

                const randomShock = (Math.random() * 2 - 1) * noise;
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
    }, [running, speed, responsiveness, noise, offset, stepMs]);

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
