import { Send } from "lucide-react";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

const nextSteps = ["主翼に割り当てる", "解析ケースを追加", "翼型を比較"];

export function AirfoilNextStepsCard() {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">次の推奨ステップ</h2>
      </CardHeader>
      <CardBody className="space-y-2">
        {nextSteps.map((step) => (
          <button key={step} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-blue-50">
            {step}<Send size={14} className="text-blue-600" />
          </button>
        ))}
      </CardBody>
    </Card>
  );
}
