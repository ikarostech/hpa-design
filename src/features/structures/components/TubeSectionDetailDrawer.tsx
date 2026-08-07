import { Plus, Trash2 } from "lucide-react";
import type { InspectorController } from "../../../shared/model";
import { Button } from "../../../shared/ui/Button";
import { InspectorDrawer } from "../../../shared/ui/inspector/InspectorDrawer";
import type { CarbonMaterial, LaminatePly, StructuralTubeSection } from "../model/types";
import { calculateLaminate } from "../services/structuralAnalysis";

interface TubeSectionDetailDrawerProps {
  section: StructuralTubeSection;
  start: number;
  end: number;
  materials: readonly CarbonMaterial[];
  inspector: InspectorController<string>;
  onChange: (section: StructuralTubeSection) => void;
}

export function TubeSectionDetailDrawer({ section, start, end, materials, inspector, onChange }: TubeSectionDetailDrawerProps) {
  if (!inspector.state.open) return null;

  const materialById = new Map(materials.map((material) => [material.id, material]));
  const summary = getSectionSummary(section, materialById);
  const totalPlyCount = section.plies.reduce((sum, ply) => sum + ply.count, 0);
  const updatePly = (plyId: string, patch: Partial<LaminatePly>) => onChange({ ...section, plies: section.plies.map((ply) => ply.id === plyId ? { ...ply, ...patch } : ply) });

  return <InspectorDrawer open={inspector.state.open} title="パイプ詳細" subtitle={section.id} closeLabel="パイプ詳細を閉じる" backLabel="パイプ一覧に戻る" width="wide" onClose={inspector.close}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-950">パイプ寸法</h3>
          <dl className="grid grid-cols-2 gap-3">
            <DetailValue label="範囲" value={`${start.toFixed(3)}–${end.toFixed(3)} m`} />
            <DetailValue label="長さ" value={`${section.length.toFixed(3)} m`} />
            <DetailValue label="外径" value={`${(section.outerDiameter * 1000).toFixed(1)} mm`} />
            <DetailValue label="総層数" value={`${totalPlyCount} ply`} />
            {summary ? <>
              <DetailValue label="積層厚さ" value={`${(summary.thickness * 1000).toFixed(3)} mm`} />
              <DetailValue label="内径" value={`${(summary.innerDiameter * 1000).toFixed(2)} mm`} />
            </> : null}
          </dl>
        </section>

        <section>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">このパイプの積層構成</h3>
              <p className="mt-1 text-xs text-slate-500">内側から外側への積層順です。変更は設計へ即時保存されます。</p>
            </div>
            <Button size="sm" onClick={() => onChange({ ...section, plies: [...section.plies, { id: createPlyId(), materialId: materials[0]?.id ?? "", angle: 0, count: 1 }] })} disabled={!materials.length}><Plus size={15} />積層を追加</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">順序</th><th>材料</th><th>角度</th><th>層数</th><th className="text-right">操作</th></tr></thead>
              <tbody>{section.plies.map((ply, index) => <tr key={ply.id} className="border-t">
                <td className="px-3 py-2">{index + 1}</td>
                <td><select aria-label={`${ply.id}の詳細材料`} value={ply.materialId} onChange={(event) => updatePly(ply.id, { materialId: event.target.value })} className="h-8 max-w-44 rounded border bg-white px-2">{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></td>
                <td><select aria-label={`${ply.id}の詳細角度`} value={ply.angle} onChange={(event) => updatePly(ply.id, { angle: Number(event.target.value) as LaminatePly["angle"] })} className="h-8 rounded border bg-white px-2">{[0, 45, -45, 90].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}</select></td>
                <td><input aria-label={`${ply.id}の詳細層数`} type="number" min={1} value={ply.count} onChange={(event) => updatePly(ply.id, { count: Math.max(1, Number(event.target.value)) })} className="h-8 w-16 rounded border px-2" /></td>
                <td className="text-right"><Button variant="destructive" size="icon" aria-label={`${ply.id}の詳細積層を削除`} title={`${ply.id}の積層を削除`} disabled={section.plies.length <= 1} onClick={() => onChange({ ...section, plies: section.plies.filter((item) => item.id !== ply.id) })}><Trash2 size={15} /></Button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
  </InspectorDrawer>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border px-3 py-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd></div>;
}

function getSectionSummary(section: StructuralTubeSection, materials: ReadonlyMap<string, CarbonMaterial>) {
  try {
    const laminate = calculateLaminate(section.plies, materials);
    return { thickness: laminate.thickness, innerDiameter: section.outerDiameter - 2 * laminate.thickness };
  } catch {
    return null;
  }
}

function createPlyId() {
  return `ply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
