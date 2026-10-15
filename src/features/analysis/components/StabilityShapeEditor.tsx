import { useEffect, useState } from "react";
import type { StabilityShape } from "../model/types";
import type { StabilityFsiShapeOption } from "../model/stabilityShape";
import { Button } from "../../../shared/ui/Button";
import { RowActions } from "../../../shared/ui/table/RowActions";
import { DeleteConfirmationDialog } from "../../../shared/ui/table/DeleteConfirmationDialog";

interface Props {
  allowFsi?: boolean;
  shape?: StabilityShape;
  semiSpan: number;
  defaultAxis: number;
  fsiShapes: readonly StabilityFsiShapeOption[];
  onChange: (shape: StabilityShape) => void;
}

export function StabilityShapeEditor({ allowFsi = true, shape, semiSpan, defaultAxis, fsiShapes, onChange }: Props) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const kind = shape?.kind ?? "rigid";
  const switchKind = (value: string) => {
    if (value === "manual") onChange({ kind: "manual", elasticAxisChordFraction: defaultAxis,
      points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: semiSpan, deflection: 0, twist: 0 }] });
    else if (value === "fsi" && fsiShapes[0]) onChange(structuredClone(fsiShapes[0].shape));
    else onChange({ kind: "rigid" });
  };
  return <section className="space-y-3 sm:col-span-2" aria-label="安定性の評価形状">
    <label className="grid gap-1 text-sm text-slate-700"><span>評価形状</span><select className="rounded-md border border-slate-300 px-3 py-2" value={kind} onChange={(e) => switchKind(e.target.value)}>
      <option value="rigid">剛体（比較基準）</option><option value="manual">簡易評価（仮のたわみ）</option>{allowFsi ? <option value="fsi" disabled={!fsiShapes.length && kind !== "fsi"}>FSI後評価（固定形状）</option> : null}
    </select></label>
    <p className="text-xs text-slate-500">たわみ・ねじりは主翼に左右対称で適用します。尾翼は設定済みの形状を使います。解析中は変形形状を固定し、迎角・横滑りによる追加変形と動安定性は含みません。</p>
    {shape?.kind === "manual" ? <>
      <NumberField label="ねじり軸位置 (%翼弦)" value={shape.elasticAxisChordFraction * 100} onChange={(v) => onChange({ ...shape, elasticAxisChordFraction: v / 100 })} />
      <div className="rounded-md border border-slate-200">
        <div className="flex items-center justify-between gap-2 border-b p-2"><h3 className="text-sm font-semibold">仮のたわみ・ねじり分布</h3><Button size="sm" variant="secondary" onClick={() => {
          const points = [...shape.points];
          const a = points[points.length - 2]; const b = points[points.length - 1];
          points.splice(points.length - 1, 0, { yPosition: (a.yPosition + b.yPosition) / 2, deflection: (a.deflection + b.deflection) / 2, twist: (a.twist + b.twist) / 2 });
          onChange({ ...shape, points });
        }}>分布点を追加</Button></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">位置 m</th><th>たわみ m</th><th>ねじり °</th><th className="pr-2 text-right">操作</th></tr></thead><tbody>{shape.points.map((point, index) => <tr key={index} className="border-t border-slate-100">
          {(["yPosition", "deflection", "twist"] as const).map((field) => <td key={field} className="p-1"><NumberField label={`点${index + 1} ${field === "yPosition" ? "翼幅位置 (m)" : field === "deflection" ? "たわみ (m)" : "ねじり (°)"}`} value={point[field]} readOnly={field === "yPosition" && (index === 0 || index === shape.points.length - 1)} compact onChange={(v) => onChange({ ...shape, points: shape.points.map((p, i) => i === index ? { ...p, [field]: v } : p) })} /></td>)}
          <td className="pr-2 text-right"><RowActions entityLabel={`点${index + 1}`} delete={{ disabled: index === 0 || index === shape.points.length - 1, disabledReason: "翼根と翼端の点は必要です", onAction: () => setPendingDelete(index) }} /></td>
        </tr>)}</tbody></table></div>
      </div>
      <p className="text-xs text-slate-500">翼根から翼端まで線形補間します。たわみは上方、ねじりは迎角増加側が正です。点は翼幅位置の昇順で指定してください。</p>
    </> : null}
    {shape?.kind === "fsi" ? <>
      <label className="grid gap-1 text-sm"><span>FSI結果</span><select className="rounded-md border border-slate-300 px-3 py-2" value={shape.resultId} onChange={(e) => {
        const option = fsiShapes.find((item) => item.shape.resultId === e.target.value);
        if (option) onChange(structuredClone(option.shape));
      }}>
        {!fsiShapes.some((item) => item.shape.resultId === shape.resultId) ? <option value={shape.resultId}>保存済み形状: {shape.resultId}（現在の候補一覧にはありません）</option> : null}
        {fsiShapes.map((option) => <option key={option.shape.resultId} value={option.shape.resultId}>{option.label}</option>)}
      </select></label>
      <p className="text-xs text-slate-500">元のFSI条件: {shape.speed} m/s・迎角 {shape.alphaDegrees}°。取得日時: {shape.createdAt}。形状はケースに保存され、元結果の更新では自動置換しません。</p>
    </> : null}
    {allowFsi && !fsiShapes.length && kind !== "fsi" ? <p className="text-xs text-slate-500">選択可能な収束済み・最新のFSI結果はありません。簡易評価はFSIなしで実行できます。</p> : null}
    <DeleteConfirmationDialog open={pendingDelete !== null} title="分布点を削除しますか？" description="隣接する分布点を線形補間する形状に変わります。" onCancel={() => setPendingDelete(null)} onConfirm={() => {
      if (shape?.kind === "manual" && pendingDelete !== null) onChange({ ...shape, points: shape.points.filter((_, i) => i !== pendingDelete) });
      setPendingDelete(null);
    }} />
  </section>;
}

function NumberField({ label, value, readOnly, compact, onChange }: { label: string; value: number; readOnly?: boolean; compact?: boolean; onChange: (value: number) => void }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => { if (Number.isFinite(value)) setText((current) => Number(current) === value ? current : String(value)); }, [value]);
  return <label className="grid gap-1 text-sm"><span className={compact ? "sr-only" : "text-slate-700"}>{label}</span><input type="number" step="any" className={`${compact ? "w-24" : "w-36"} rounded border border-slate-300 px-2 py-1`} value={text} readOnly={readOnly} onChange={(e) => { setText(e.target.value); onChange(e.target.value === "" ? Number.NaN : Number(e.target.value)); }} /></label>;
}
