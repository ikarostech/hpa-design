import type { Job, JobStatus } from "../model";

const terminalStatuses: readonly JobStatus[] = ["completed", "failed", "cancelled"];

export function transitionJob<TJob extends Job<unknown>>(job: TJob, nextStatus: JobStatus): TJob {
  if (terminalStatuses.includes(job.status)) {
    return job;
  }
  return { ...job, status: nextStatus };
}
