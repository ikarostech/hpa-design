import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JobProvider, useJobs } from "./JobProvider";
import { JobStatusButton } from "./JobStatusButton";

describe("JobStatusButton", () => {
  it("shows the empty job states when opened", async () => {
    const user = userEvent.setup();
    render(<JobProvider><JobStatusButton /></JobProvider>);

    await user.click(screen.getByRole("button", { name: "ジョブ" }));

    expect(screen.getByText("実行中のジョブはありません")).toBeTruthy();
    expect(screen.getByText("最近のジョブはありません")).toBeTruthy();
  });

  it("shows a completion notification when a newly created job completes", async () => {
    const user = userEvent.setup();
    render(<JobProvider><CompleteJob /></JobProvider>);

    await user.click(screen.getByRole("button", { name: "解析を開始" }));

    expect(screen.getByText("テスト解析が完了しました")).toBeTruthy();
  });
});

function CompleteJob() {
  const jobs = useJobs();
  return <button onClick={() => {
    const job = jobs.createJob({ kind: "test", name: "テスト解析", status: "running" });
    jobs.completeJob(job.id);
  }}>解析を開始</button>;
}
