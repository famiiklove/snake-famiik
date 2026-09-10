import { useRef, useState } from 'react';

interface ArcSliderProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

export default function ArcSlider({ value, onChange, size = 64 }: ArcSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const center = size / 2;
  const radius = size / 2 - 8;

  const startAngle = 135;
  const endAngle = 405;
  const sweep = endAngle - startAngle;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const polarToCartesian = (angle: number) => {
    const rad = degToRad(angle);
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const describeArc = (startA: number, endA: number) => {
    const start = polarToCartesian(endA);
    const end = polarToCartesian(startA);
    const largeArcFlag = endA - startA <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const fullArcPath = describeArc(startAngle, endAngle);
  const currentAngle = startAngle + value * sweep;
  const valueArcPath = describeArc(startAngle, currentAngle);
  const thumbPos = polarToCartesian(currentAngle);

  const getAngleFromEvent = (clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - center;
    const y = clientY - rect.top - center;
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    let normalized = angle - startAngle;
    if (normalized < 0) normalized += 360;
    if (normalized > sweep) {
      if (normalized > sweep / 2 + 45) normalized = 0;
      else normalized = sweep;
    }
    return Math.max(0, Math.min(1, normalized / sweep));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const newValue = getAngleFromEvent(e.clientX, e.clientY);
    if (newValue !== null) onChange(newValue);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const newValue = getAngleFromEvent(e.clientX, e.clientY);
    if (newValue !== null) onChange(newValue);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const cx = center;
  const cy = center;

  const renderIcon = () => {
    if (value === 0) {
      return (
        <g stroke="#64748b" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d={`M ${cx - 8} ${cy - 3} L ${cx - 4} ${cy - 3} L ${cx} ${cy - 7} L ${cx} ${cy + 7} L ${cx - 4} ${cy + 3} L ${cx - 8} ${cy + 3} Z`} fill="#64748b" />
          <line x1={cx + 4} y1={cy - 3} x2={cx + 10} y2={cy + 3} />
          <line x1={cx + 10} y1={cy - 3} x2={cx + 4} y2={cy + 3} />
        </g>
      );
    }
    const color = value < 0.4 ? '#4ade80' : value < 0.7 ? '#22d3ee' : '#f472b6';
    return (
      <g stroke={color} strokeWidth="1.5" fill={color} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
        <path d={`M ${cx - 8} ${cy - 3} L ${cx - 4} ${cy - 3} L ${cx} ${cy - 7} L ${cx} ${cy + 7} L ${cx - 4} ${cy + 3} L ${cx - 8} ${cy + 3} Z`} />
        {value > 0 && (
          <path d={`M ${cx + 3} ${cy - 3} Q ${cx + 6} ${cy} ${cx + 3} ${cy + 3}`} fill="none" />
        )}
        {value > 0.4 && (
          <path d={`M ${cx + 5} ${cy - 5} Q ${cx + 9} ${cy} ${cx + 5} ${cy + 5}`} fill="none" />
        )}
        {value > 0.7 && (
          <path d={`M ${cx + 7} ${cy - 7} Q ${cx + 12} ${cy} ${cx + 7} ${cy + 7}`} fill="none" />
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="arc-slider-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>

      <path d={fullArcPath} className="arc-slider-track" />

      {value > 0.005 && (
        <path d={valueArcPath} className="arc-slider-fill" />
      )}

      <circle
        cx={thumbPos.x}
        cy={thumbPos.y}
        r={dragging ? 5 : 4}
        className="arc-slider-thumb"
      />

      {renderIcon()}
    </svg>
  );
}
