import { Injectable } from '@angular/core';
import { DashboardAccountModel } from '../domain/dashboard-account.model';

export interface SvgPoint {
  x: number;
  y: number;
  label: string;
  /** Balance in major currency units (EUR). */
  value: number;
}

export interface AccountChartData {
  points: SvgPoint[];
  dLine: string;
  dFill: string;
  /** Average % change over the last ≤3 intervals, or null if not computable. */
  pctChange: number | null;
  /** Projected next value in major units, or null if not computable. */
  forecastValue: number | null;
}

/** Viewport constants for the inline SVG chart. */
const SVG_WIDTH = 100;
const SVG_HEIGHT = 30;
const SVG_CENTER_Y = SVG_HEIGHT / 2;

@Injectable({ providedIn: 'root' })
export class AccountChartService {

  /**
   * Builds chart data for a single account card.
   *
   * When `balanceHistoryMinor` is empty, a synthetic flat line is rendered at
   * `currentBalanceMinor` so the chart is always visible.
   */
  buildChartData(acc: DashboardAccountModel): AccountChartData {
    const rawMinor =
      acc.balanceHistoryMinor?.length
        ? acc.balanceHistoryMinor
        : [acc.currentBalanceMinor, acc.currentBalanceMinor];

    const pctChange = this.calcAveragePctChange(rawMinor);
    const lastMinor = rawMinor.at(-1) ?? 0;
    const forecastValue =
      pctChange !== null
        ? Math.round(lastMinor * (1 + pctChange / 100)) / 100
        : null;

    const { points, dLine, dFill } = this.buildSvgPaths(rawMinor);
    return { points, dLine, dFill, pctChange, forecastValue };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private calcAveragePctChange(data: number[]): number | null {
    const n = Math.min(data.length - 1, 3);
    if (n <= 0) return null;

    const changes: number[] = [];
    for (let i = data.length - n; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      if (prev !== 0) {
        changes.push(((curr - prev) / prev) * 100);
      } else if (curr !== 0) {
        changes.push(curr > 0 ? 100 : -100);
      }
      // Both 0 → no meaningful change, skip
    }

    if (changes.length === 0) return null;
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  private buildSvgPaths(dataMinor: number[]): {
    points: SvgPoint[];
    dLine: string;
    dFill: string;
  } {
    const len = dataMinor.length;
    const max = Math.max(...dataMinor, 0);
    const min = Math.min(...dataMinor, 0);
    const range = max - min;
    const stepX = SVG_WIDTH / (len > 1 ? len - 1 : 1);
    const scaleY = range > 0 ? SVG_HEIGHT / range : 1;

    const points: SvgPoint[] = dataMinor.map((v, i) => ({
      x: i * stepX,
      // When all values are equal (flat history) place the line in the centre.
      y: range > 0 ? SVG_HEIGHT - (v - min) * scaleY : SVG_CENTER_Y,
      label: i === len - 1 ? 'Jetzt' : `-${len - 1 - i}M`,
      value: v / 100,
    }));

    if (points.length === 0) {
      return { points, dLine: '', dFill: '' };
    }

    let dLine = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      dLine += ` Q${p0.x},${p0.y} ${cx},${cy}`;
    }
    if (points.length > 1) {
      dLine += ` T${points[points.length - 1].x},${points[points.length - 1].y}`;
    }

    const last = points[points.length - 1];
    const dFill = `${dLine} L${last.x},${SVG_HEIGHT} L0,${SVG_HEIGHT} Z`;

    return { points, dLine, dFill };
  }
}
