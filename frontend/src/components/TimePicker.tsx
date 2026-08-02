// A 12-hour time picker (hour : minute : AM/PM) that always shows AM/PM,
// regardless of the browser locale. Emits/consumes 24-hour "HH:MM" strings.

interface Props {
  value: string; // "HH:MM" 24-hour
  onChange: (value: string) => void;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function parse(value: string) {
  const [hRaw, mRaw] = value.split(":").map(Number);
  const h = Number.isFinite(hRaw) ? hRaw : 9;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12, minute: m, ampm };
}

function to24(h12: number, minute: number, ampm: "AM" | "PM") {
  let h = h12 % 12; // 12 -> 0
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function TimePicker({ value, onChange }: Props) {
  const { h12, minute, ampm } = parse(value);
  // Ensure the current minute is selectable even if it's not a 5-min step.
  const minuteOptions = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => a - b);

  return (
    <div className="time-picker">
      <select
        value={h12}
        onChange={(e) => onChange(to24(Number(e.target.value), minute, ampm))}
        aria-label="Hour"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="tp-colon">:</span>
      <select
        value={minute}
        onChange={(e) => onChange(to24(h12, Number(e.target.value), ampm))}
        aria-label="Minute"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        className="tp-ampm"
        value={ampm}
        onChange={(e) =>
          onChange(to24(h12, minute, e.target.value as "AM" | "PM"))
        }
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
