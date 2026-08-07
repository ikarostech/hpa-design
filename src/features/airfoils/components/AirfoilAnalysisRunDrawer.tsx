import type { Airfoil, AirfoilAnalysisRun } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { InspectorDrawer } from "../../../shared/ui/inspector/InspectorDrawer";

interface AirfoilAnalysisRunDrawerProps {
  open: boolean;
  run: AirfoilAnalysisRun | null;
  airfoils: readonly Airfoil[];
  onClose: () => void;
}

export function AirfoilAnalysisRunDrawer({ open, run, airfoils, onClose }: AirfoilAnalysisRunDrawerProps) {
  if (!open || !run) return null;
  const airfoilNames = run.airfoilIds.map((id) => airfoils.find((airfoil) => airfoil.id === id)?.name ?? id);

  return <InspectorDrawer open={open} title={run.name} subtitle="解析Runの詳細" closeLabel="解析Runの詳細を閉じる" backLabel="一覧に戻る" onClose={onClose}><div className="space-y-4"><div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"><span className="text-sm text-slate-600">状態</span><Badge tone={run.status === "complete" ? "green" : "amber"}>{run.status === "complete" ? "完了" : "要確認"}</Badge></div><Details label="作成日時" value={new Date(run.createdAt).toLocaleString()} /><Details label="対象翼型" value={airfoilNames.join(", ")} /><Details label="条件" value={`Re ${run.reynolds.toLocaleString()} / Mach ${run.mach} / α ${run.alphaStart}° to ${run.alphaEnd}° (${run.alphaStep}° step)`} /><Details label="Ncrit / 反復回数" value={`${run.ncrit ?? 9} / ${run.iterations ?? 100}`} /><Details label="生成Polar" value={run.polarIds.length ? run.polarIds.join(", ") : "なし"} />{run.failures?.length ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><p className="font-medium">失敗した対象</p><ul className="mt-2 list-disc space-y-1 pl-5">{run.failures.map((failure) => <li key={failure.airfoilId}>{airfoils.find((airfoil) => airfoil.id === failure.airfoilId)?.name ?? failure.airfoilId}: {failure.message}</li>)}</ul></div> : null}</div></InspectorDrawer>;
}

function Details({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>; }
