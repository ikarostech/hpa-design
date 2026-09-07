import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Job, JobStatus } from "@/shared/model";
import { transitionJob } from "./jobState";

export type AppJob = Job<string, unknown, unknown>;

type CreateJobInput<TJob extends AppJob = AppJob> =
  Omit<TJob, "id" | "createdAt" | "status"> & {
    id?: string;
    createdAt?: string;
    status?: JobStatus;
  };

type JobPatch<TJob extends AppJob> = Partial<Omit<TJob, "id" | "kind" | "status" | "createdAt">>;

interface JobToast {
  id: string;
  jobId: string;
  tone: "green" | "red";
  title: string;
  message?: string;
}

interface JobContextValue {
  jobs: readonly AppJob[];
  createJob: <TJob extends AppJob>(job: CreateJobInput<TJob>) => TJob;
  updateJob: <TJob extends AppJob>(jobId: string, patch: JobPatch<TJob>) => void;
  completeJob: <TJob extends AppJob>(jobId: string, patch?: JobPatch<TJob>) => void;
  failJob: (jobId: string, errorMessage: string) => void;
  cancelJob: (jobId: string) => void;
  clearCompleted: (kind?: string) => void;
  dismissToast: (toastId: string) => void;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<AppJob[]>([]);
  const jobsRef = useRef<AppJob[]>([]);
  const [toasts, setToasts] = useState<JobToast[]>([]);

  const pushToast = (toast: Omit<JobToast, "id">) => {
    const id = `toast-${toast.jobId}-${Date.now()}`;
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5000);
  };

  const value = useMemo<JobContextValue>(() => ({
    jobs,
    createJob: <TJob extends AppJob>(job: CreateJobInput<TJob>) => {
      const createdJob = {
        ...job,
        id: job.id ?? `job-${Date.now()}`,
        status: job.status ?? "queued",
        createdAt: job.createdAt ?? new Date().toISOString(),
      } as AppJob;

      jobsRef.current = [createdJob, ...jobsRef.current];
      setJobs(jobsRef.current);
      return createdJob as TJob;
    },
    updateJob: <TJob extends AppJob>(jobId: string, patch: JobPatch<TJob>) => {
      jobsRef.current = jobsRef.current.map((job) => job.id === jobId ? { ...job, ...patch } : job);
      setJobs(jobsRef.current);
    },
    completeJob: <TJob extends AppJob>(jobId: string, patch: JobPatch<TJob> = {}) => {
      const jobName = jobsRef.current.find((job) => job.id === jobId)?.name;
      jobsRef.current = jobsRef.current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }
        const transitioned = transitionJob(job, "completed");
        if (transitioned === job) {
          return job;
        }
        return {
          ...transitioned,
          ...patch,
          status: "completed",
          finishedAt: new Date().toISOString(),
        };
      });
      setJobs(jobsRef.current);
      if (jobName) {
        pushToast({
          jobId,
          tone: "green",
          title: `${jobName}が完了しました`,
        });
      }
    },
    failJob: (jobId, errorMessage) => {
      const jobName = jobsRef.current.find((job) => job.id === jobId)?.name;
      jobsRef.current = jobsRef.current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }
        const transitioned = transitionJob(job, "failed");
        if (transitioned === job) {
          return job;
        }
        return {
          ...transitioned,
          status: "failed",
          finishedAt: new Date().toISOString(),
          errorMessage,
        };
      });
      setJobs(jobsRef.current);
      if (jobName) {
        pushToast({
          jobId,
          tone: "red",
          title: `${jobName}に失敗しました`,
          message: errorMessage,
        });
      }
    },
    cancelJob: (jobId) => {
      jobsRef.current = jobsRef.current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }
        const transitioned = transitionJob(job, "cancelled");
        return transitioned === job ? job : { ...transitioned, finishedAt: new Date().toISOString() };
      });
      setJobs(jobsRef.current);
    },
    clearCompleted: (kind) => {
      jobsRef.current = jobsRef.current.filter((job) => (
        job.status !== "completed"
        && job.status !== "cancelled"
      ) || (kind !== undefined && job.kind !== kind));
      setJobs(jobsRef.current);
    },
    dismissToast: (toastId) => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    },
  }), [jobs]);

  return (
    <JobContext.Provider value={value}>
      {children}
      <JobToasts toasts={toasts} onDismiss={value.dismissToast} />
    </JobContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error("useJobs must be used within JobProvider");
  }
  return context;
}

function JobToasts({ toasts, onDismiss }: { toasts: readonly JobToast[]; onDismiss: (toastId: string) => void }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-[70] w-[min(360px,calc(100vw-2rem))] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border bg-white px-3 py-2 shadow-lg ${toast.tone === "green" ? "border-emerald-200" : "border-red-200"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${toast.tone === "green" ? "text-emerald-700" : "text-red-700"}`}>{toast.title}</p>
              {toast.message ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{toast.message}</p> : null}
            </div>
            <button className="rounded-md px-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => onDismiss(toast.id)}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
