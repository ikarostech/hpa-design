import type { ReactNode } from "react";
import type { MultiSelection } from "@/shared/model";
import type { Airfoil, AirfoilPolar } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";

interface AirfoilTargetTableProps {
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  selectedId?: string;
  analysisTargets: MultiSelection<string>;
  minWidth?: string;
  actions?: (airfoil: Airfoil, state: { hasPolar: boolean; isSelected: boolean }) => ReactNode;
}

export function AirfoilTargetTable({
  airfoils,
  airfoilPolars,
  selectedId,
  analysisTargets,
  minWidth = "min-w-[800px]",
  actions,
}: AirfoilTargetTableProps) {
  const headings = actions
    ? ["解析対象", "翼型", "厚み比", "最大キャンバー", "LE半径", "TE厚", "状態", ""]
    : ["解析対象", "翼型", "厚み比", "最大キャンバー", "状態"];

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} text-left text-sm`}>
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            {headings.map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {airfoils.map((airfoil) => {
            const isSelected = selectedId === airfoil.id;
            const hasPolar = airfoilPolars.some((polar) => polar.airfoilId === airfoil.id);
            const isAnalysisTarget = analysisTargets.isSelected(airfoil.id);

            return (
              <tr key={airfoil.id} className={isSelected ? "bg-blue-50/60" : undefined}>
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={isAnalysisTarget}
                    aria-label={`${airfoil.name}を解析対象にする`}
                    onChange={() => analysisTargets.toggle(airfoil.id)}
                  />
                </td>
                <td className="px-2 py-3 font-semibold text-slate-950">{airfoil.name}</td>
                <td className="px-2 py-3">{airfoil.thicknessRatio}%</td>
                <td className="px-2 py-3">{airfoil.maxCamber}%</td>
                {actions ? (
                  <>
                    <td className="px-2 py-3">{airfoil.leadingEdgeRadius}%</td>
                    <td className="px-2 py-3">{airfoil.trailingEdgeThickness}%</td>
                  </>
                ) : null}
                <td className="px-2 py-3">
                  {hasPolar ? <Badge tone="green">Polarあり</Badge> : <Badge tone="amber">未解析</Badge>}
                </td>
                {actions ? (
                  <td className="px-2 py-3">{actions(airfoil, { hasPolar, isSelected })}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
