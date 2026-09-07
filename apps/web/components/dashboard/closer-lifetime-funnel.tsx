import type { CloserDashboardData } from "@orbit/contracts";
import { Card } from "@orbit/ui";

import styles from "./closer-lifetime-funnel.module.css";

type CloserLifetimeFunnelProps = {
  totals: CloserDashboardData["lifetimeFunnel"];
};

const bands = [styles.bandOne, styles.bandTwo, styles.bandThree, styles.bandFour];

function count(value: number): string {
  return value.toLocaleString();
}

function conversion(from: number, to: number): string {
  return from > 0 ? `${Math.round((to / from) * 100)}%` : "—";
}

function smoothCurve(points: Array<{ x: number; y: number }>): string {
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function bandPath(heights: number[], xPositions: number[], bandIndex: number): string {
  const center = 130;
  const bandStart = bandIndex / 4;
  const bandEnd = (bandIndex + 1) / 4;
  const upper = heights.map((height, index) => ({
    x: xPositions[index],
    y: center - height / 2 + height * bandStart,
  }));
  const lower = heights.map((height, index) => ({
    x: xPositions[index],
    y: center - height / 2 + height * bandEnd,
  })).reverse();
  return `${smoothCurve(upper)} L ${lower[0].x} ${lower[0].y} ${smoothCurve(lower).replace(/^M [\d.]+ [\d.]+/, "")} Z`;
}

export function closerStageThickness(value: number, largestValue: number): number {
  if (value <= 0 || largestValue <= 0) return 0;
  return 156 * Math.min(value / largestValue, 1);
}

export function CloserLifetimeFunnel({ totals }: CloserLifetimeFunnelProps) {
  const stages = [
    { label: "Applications handled", value: totals.applicationsHandled, href: "/leads" },
    { label: "Interviews scheduled", value: totals.interviewsScheduled, href: "/leads?pipelineStage=INTERVIEW" },
    { label: "Calls attended", value: totals.callsAttended, href: "/leads?pipelineStage=INTERVIEW" },
    { label: "Offers", value: totals.offers, href: "/leads?pipelineStage=OFFER" },
    { label: "Placements", value: totals.placements, href: "/leads?pipelineStage=PLACEMENT" },
  ];
  const values = stages.map((stage) => stage.value);
  const largestValue = Math.max(1, ...values);
  const xPositions = stages.map((_, index) => 50 + index * 225);
  const firstZeroIndex = values.findIndex((value) => value === 0);
  const visibleStageCount = firstZeroIndex === -1 ? stages.length : firstZeroIndex;
  const visibleHeights = values
    .slice(0, visibleStageCount)
    .map((value) => closerStageThickness(value, largestValue));
  const visibleXPositions = xPositions.slice(0, visibleStageCount);
  if (firstZeroIndex > 0) {
    visibleHeights.push(0);
    visibleXPositions.push((xPositions[firstZeroIndex - 1] + xPositions[firstZeroIndex]) / 2);
  }
  const flowLabel = `Placement flow: ${stages.map((stage) => `${stage.label} ${count(stage.value)}`).join(", ")}`;

  return (
    <Card aria-label="Closer lifetime placement funnel" className={styles.card}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Lifetime view</p>
          <h2 className={styles.title}>Placement journey</h2>
        </div>
        <span className={styles.scope}>All time</span>
      </header>

      <div className={styles.scrollArea}>
        <div className={styles.flow} data-testid="closer-lifetime-flow">
          <svg aria-label={flowLabel} preserveAspectRatio="none" role="img" viewBox="0 0 1000 260">
            <title>Closer lifetime placement journey</title>
            <desc>Stream thickness is proportional to unique applications at each stage. The stream ends before the first zero-valued stage.</desc>
            {visibleHeights.length > 0 ? bands.map((className, bandIndex) => (
              <path className={`${styles.band} ${className}`} d={bandPath(visibleHeights, visibleXPositions, bandIndex)} key={className} />
            )) : null}
            {visibleXPositions.map((x) => <line className={styles.checkpoint} key={x} x1={x} x2={x} y1="28" y2="232" />)}
          </svg>

          <div className={styles.labels}>
            {stages.map((stage, index) => {
              const alignment = index === 0 ? "start" : index === stages.length - 1 ? "end" : "center";
              const alignmentClass = alignment === "start" ? styles.stageStart : alignment === "end" ? styles.stageEnd : styles.stageCenter;
              return (
                <a
                  className={`${styles.stage} ${index % 2 === 0 ? styles.stageTop : styles.stageBottom} ${alignmentClass}`}
                  data-alignment={alignment}
                  href={stage.href}
                  key={stage.label}
                  style={{ left: `${xPositions[index] / 10}%` }}
                >
                  <span>{stage.label}</span>
                  <strong>{count(stage.value)}</strong>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <dl aria-label="Adjacent stage conversions" className={styles.conversions}>
        {stages.slice(1).map((stage, index) => (
          <div key={stage.label}>
            <dt>{stages[index].label} → {stage.label}</dt>
            <dd>{conversion(stages[index].value, stage.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
