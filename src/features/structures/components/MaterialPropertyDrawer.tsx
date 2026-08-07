import type { InspectorController } from "../../../shared/model";
import { InspectorDrawer } from "../../../shared/ui/inspector/InspectorDrawer";
import type { CarbonMaterial } from "../model/types";

interface MaterialPropertyDrawerProps {
  material: CarbonMaterial;
  inspector: InspectorController<string>;
  onChange: (material: CarbonMaterial) => void;
}

export function MaterialPropertyDrawer({ material, inspector, onChange }: MaterialPropertyDrawerProps) {
  if (!inspector.state.open) return null;
  const patch = (value: Partial<CarbonMaterial>) => onChange({ ...material, ...value });

  return <InspectorDrawer open={inspector.state.open} title="材料プロパティ" subtitle={material.name} closeLabel="材料プロパティを閉じる" backLabel="材料一覧に戻る" width="wide" onClose={inspector.close}>
        <p className="mb-4 text-sm text-slate-500">変更は材料ライブラリへ即時保存されます。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-500">名称<input aria-label="材料名" value={material.name} onChange={(event) => patch({ name: event.target.value })} className="mt-1 h-9 w-full rounded border px-2 text-sm text-slate-900" /></label>
          <MaterialField label="E1" value={material.e1 / 1e9} unit="GPa" onChange={(value) => patch({ e1: value * 1e9 })} />
          <MaterialField label="E2" value={material.e2 / 1e9} unit="GPa" onChange={(value) => patch({ e2: value * 1e9 })} />
          <MaterialField label="G12" value={material.g12 / 1e9} unit="GPa" onChange={(value) => patch({ g12: value * 1e9 })} />
          <MaterialField label="ν12" value={material.nu12} unit="" onChange={(value) => patch({ nu12: value })} />
          <MaterialField label="繊維引張強度" value={material.tensileStrength1 / 1e6} unit="MPa" onChange={(value) => patch({ tensileStrength1: value * 1e6 })} />
          <MaterialField label="繊維圧縮強度" value={material.compressiveStrength1 / 1e6} unit="MPa" onChange={(value) => patch({ compressiveStrength1: value * 1e6 })} />
          <MaterialField label="横引張強度" value={material.tensileStrength2 / 1e6} unit="MPa" onChange={(value) => patch({ tensileStrength2: value * 1e6 })} />
          <MaterialField label="横圧縮強度" value={material.compressiveStrength2 / 1e6} unit="MPa" onChange={(value) => patch({ compressiveStrength2: value * 1e6 })} />
          <MaterialField label="せん断強度" value={material.shearStrength12 / 1e6} unit="MPa" onChange={(value) => patch({ shearStrength12: value * 1e6 })} />
          <MaterialField label="密度" value={material.density} unit="kg/m³" onChange={(value) => patch({ density: value })} />
          <MaterialField label="1層厚さ" value={material.plyThickness * 1000} unit="mm" onChange={(value) => patch({ plyThickness: value / 1000 })} />
          <MaterialField label="低減係数" value={material.reductionFactor} unit="" onChange={(value) => patch({ reductionFactor: value })} />
        </div>
  </InspectorDrawer>;
}

function MaterialField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-slate-500">{label}<span className="mt-1 flex items-center gap-1"><input aria-label={label} type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 min-w-0 flex-1 rounded border px-2 text-sm text-slate-900" /><span>{unit}</span></span></label>;
}
