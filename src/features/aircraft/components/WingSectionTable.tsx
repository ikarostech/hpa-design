import type { WingSection } from "../model/types";

interface WingSectionTableProps {
  sections: WingSection[];
  airfoilNames?: Readonly<Record<string, string>>;
}

export function WingSectionTable({ sections, airfoilNames = {} }: WingSectionTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {["Span位置", "Chord", "Twist", "Dihedral", "Airfoil", "Control Surface"].map((header) => (
              <th key={header} className="px-3 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sections.map((section) => (
            <tr key={section.id}>
              <td className="px-3 py-3">{section.spanPosition.toFixed(2)} m</td>
              <td className="px-3 py-3">{section.chord.toFixed(2)} m</td>
              <td className="px-3 py-3">{section.twist}°</td>
              <td className="px-3 py-3">{section.dihedral}°</td>
              <td className="px-3 py-3 font-medium text-slate-900">{airfoilNames[section.airfoilId] ?? section.airfoilId}</td>
              <td className="px-3 py-3">{section.controlSurface}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
