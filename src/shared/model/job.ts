export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  completed: number;
  total: number;
  message?: string;
}

export interface Job<TId, TResult = unknown, TSettings = unknown> {
  id: TId;
  kind: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: JobProgress;
  settings?: TSettings;
  errorMessage?: string;
  result?: TResult;
}

export interface JobController<TSettings, TJob extends Job<unknown>> {
  jobs: readonly TJob[];
  currentJob: TJob | null;
  run: (settings: TSettings) => Promise<TJob>;
  cancel: (jobId: TJob["id"]) => Promise<void>;
  clearCompleted: () => void;
}
