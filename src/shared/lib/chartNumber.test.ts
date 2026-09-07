import { describe, expect, it } from "vitest";
import { formatChartNumber } from "./chartNumber";

describe("formatChartNumber", () => {
  it("rounds chart labels to at most two decimal places", () => {
    expect(formatChartNumber(0.0774)).toBe("0.08");
    expect(formatChartNumber(12.345)).toBe("12.35");
    expect(formatChartNumber(12.5)).toBe("12.5");
    expect(formatChartNumber(12)).toBe("12");
  });

  it("does not show negative zero after rounding", () => {
    expect(formatChartNumber(-0.004)).toBe("0");
  });
});
