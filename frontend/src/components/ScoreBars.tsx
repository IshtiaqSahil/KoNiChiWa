import { scoreColor } from "../scoreColor";

export interface BarItem {
  key: string;
  label: string;
  score: number;
}

interface Props {
  items: BarItem[];
  // Marks the lowest bar - used on the language breakdown, where "which
  // language is this agent worst in" is the point of the chart rather than an
  // incidental detail. Only takes effect when there is a real gap to point
  // at; see WEAKEST_MIN_GAP.
  highlightWeakest?: boolean;
  weakestNote?: string;
}

// Below this spread, calling a bar "weakest" is noise: an agent scoring
// 92/92/92 across three languages has no weak language, and painting one of
// them red says the opposite of what the chart is for. Above it, every bar
// sharing the lowest score is flagged - an English-only agent typically
// bottoms out in Chinese *and* Japanese at the same score, and marking only
// one of them would hide half the finding.
const WEAKEST_MIN_GAP = 1;

function findWeakestKeys(items: BarItem[]): Set<string> {
  if (items.length < 2) return new Set();

  const scores = items.map((item) => item.score);
  const lowest = Math.min(...scores);
  if (Math.max(...scores) - lowest < WEAKEST_MIN_GAP) return new Set();

  return new Set(items.filter((item) => item.score === lowest).map((item) => item.key));
}

export function ScoreBars({ items, highlightWeakest = false, weakestNote }: Props) {
  const weakestKeys = highlightWeakest ? findWeakestKeys(items) : new Set<string>();

  return (
    <div>
      {items.map((item) => {
        const isWeakest = weakestKeys.has(item.key);
        return (
          <div key={item.key} className={`bar-row${isWeakest ? " weakest" : ""}`}>
            <span className="bar-label" title={isWeakest && weakestNote ? weakestNote : item.label}>
              {item.label}
            </span>
            {/* div, not span: a percentage `width` has no effect on an
                inline element, which silently rendered every fill at 0px
                regardless of score - only the number next to it was ever
                visible. */}
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, item.score))}%`,
                  background: scoreColor(item.score),
                }}
              />
            </div>
            <span className="bar-value">{Math.round(item.score)}</span>
          </div>
        );
      })}
    </div>
  );
}
