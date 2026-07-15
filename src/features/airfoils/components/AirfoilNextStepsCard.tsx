import { Send } from "lucide-react";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilNextStepsCardProps {
  onAssignToWing: () => void;
  onAddAnalysisCase: () => void;
  onCompareAirfoils: () => void;
}

export function AirfoilNextStepsCard({ onAssignToWing, onAddAnalysisCase, onCompareAirfoils }: AirfoilNextStepsCardProps) {
  const nextSteps = [
    { label: "主翼に割り当てる", onClick: onAssignToWing },
    { label: "解析ケースを追加", onClick: onAddAnalysisCase },
    { label: "翼型を比較", onClick: onCompareAirfoils },
  ];
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">次の推奨ステップ</h2>
      </CardHeader>
      <CardBody className="space-y-2">
        {nextSteps.map((step) => (
          <button key={step.label} onClick={step.onClick} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-blue-50">
            {step.label}<Send size={14} className="text-blue-600" />
          </button>
        ))}
      </CardBody>
    </Card>
  );
}
