import { Activity, ChevronDown, CircleAlert, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppJob } from "./JobProvider";
import { useJobs } from "./JobProvider";

export function JobStatusButton() {
  const [open, setOpen] = useState(false);
  const { jobs, clearCompleted } = useJobs();
  const runningJobs = jobs.filter((job) => job.status === "running");
  const queuedJobs = jobs.filter((job) => job.status === "queued");
  const recentJobs = jobs.filter((job) => job.status !== "running" && job.status !== "queued").slice(0, 6);
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const latestActiveJob = runningJobs[0] ?? queuedJobs[0] ?? null;
  const latestProgress = latestActiveJob ? getProgressPercent(latestActiveJob) : 0;

  const label = useMemo(() => {
    if (runningJobs.length > 0) {
      return `解析中 ${runningJobs.length}`;
    }
    if (queuedJobs.length > 0) {
      return `待機中 ${queuedJobs.length}`;
    }
    if (failedCount > 0) {
      return `失敗 ${failedCount}`;
    }
    return "ジョブ";
  }, [failedCount, queuedJobs.length, runningJobs.length]);

  return (
    <div className="relative">
      <button
        className="flex h-9 min-w-[112px] items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 hover:bg-slate-50"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {failedCount > 0 && runningJobs.length === 0 ? <CircleAlert size={16} className="text-red-500" /> : <Activity size={16} className={runningJobs.length > 0 ? "text-blue-600" : "text-slate-500"} />}
          <span className="truncate font-medium">{label}</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>
      {latestActiveJob ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${latestProgress}%` }} />
        </div>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-950">ジョブ</p>
              <p className="text-xs text-slate-500">解析・出力などの実行状況</p>
            </div>
            {recentJobs.length > 0 ? (
              <button className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100" onClick={clearCompleted}>
                完了を消去
              </button>
            ) : null}
          </div>
          <div className="max-h-[460px] overflow-y-auto p-2">
            <JobGroup title="実行中" jobs={runningJobs} emptyText="実行中のジョブはありません" />
            <JobGroup title="待機中" jobs={queuedJobs} emptyText="待機中のジョブはありません" compact />
            <JobGroup title="最近のジョブ" jobs={recentJobs} emptyText="最近のジョブはありません" compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JobGroup({ title, jobs, emptyText, compact = false }: { title: string; jobs: readonly AppJob[]; emptyText: string; compact?: boolean }) {
  return (
    <section className="py-1">
      <h3 className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">{title}</h3>
      {jobs.length > 0 ? (
        <div className="space-y-1">
          {jobs.map((job) => <JobRow key={job.id} job={job} compact={compact} />)}
        </div>
      ) : (
        <p className="px-2 py-2 text-xs text-slate-400">{emptyText}</p>
      )}
    </section>
  );
}

function JobRow({ job, compact }: { job: AppJob; compact: boolean }) {
  const progressPercent = getProgressPercent(job);
  const status = getStatusLabel(job.status);

  return (
    <div className="rounded-md px-2 py-2 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{job.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock3 size={12} />
            {formatJobTime(job)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(job.status)}`}>{status}</span>
      </div>
      {!compact || job.status === "running" ? (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{job.progress?.message ?? getProgressText(job)}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${job.status === "failed" ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      {job.status === "failed" && job.errorMessage ? (
        <p className="mt-2 truncate text-xs text-red-600">{job.errorMessage}</p>
      ) : null}
    </div>
  );
}

function getProgressPercent(job: AppJob) {
  if (job.progress && job.progress.total > 0) {
    return Math.round((job.progress.completed / job.progress.total) * 100);
  }
  return job.status === "completed" ? 100 : 0;
}

function getProgressText(job: AppJob) {
  if (job.progress && job.progress.total > 0) {
    return `${job.progress.completed}/${job.progress.total}件`;
  }
  return getStatusLabel(job.status);
}

function getStatusLabel(status: AppJob["status"]) {
  switch (status) {
    case "queued":
      return "待機中";
    case "running":
      return "実行中";
    case "completed":
      return "完了";
    case "failed":
      return "失敗";
    case "cancelled":
      return "取消";
  }
}

function getStatusClass(status: AppJob["status"]) {
  switch (status) {
    case "running":
      return "bg-blue-50 text-blue-700";
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "cancelled":
      return "bg-slate-100 text-slate-500";
    case "queued":
      return "bg-amber-50 text-amber-700";
  }
}

function formatJobTime(job: AppJob) {
  const timestamp = job.finishedAt ?? job.startedAt ?? job.createdAt;
  return new Date(timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
