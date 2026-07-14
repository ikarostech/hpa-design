import { describe, expect, it } from "vitest";
import { transitionJob } from "./jobState";

const runningJob = {
  id: "job-1",
  kind: "analysis",
  name: "Analysis",
  status: "running" as const,
  createdAt: "2026-07-15T00:00:00.000Z",
};

describe("transitionJob", () => {
  it("does not allow a cancelled job to become completed", () => {
    const cancelled = transitionJob({ ...runningJob, status: "cancelled" }, "completed");

    expect(cancelled.status).toBe("cancelled");
  });

  it("moves an active job to cancelled", () => {
    expect(transitionJob(runningJob, "cancelled")).toMatchObject({ status: "cancelled" });
  });
});
