type Props = {
    alarm: boolean;
    avgCarbon: number;
    alarmMargin: number;
    onAcknowledge: () => void;
};

export default function Alarm({ alarm, avgCarbon, alarmMargin, onAcknowledge }: Props) {
    if (!alarm) return null;

    return (
        <div className="alarm">
            🚨 LARM: Kolkurvans 10s-medel ({avgCarbon.toFixed(2)}) utanför bör ± {alarmMargin.toFixed(2)} (Temp inom ±5)
            <br/>
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
