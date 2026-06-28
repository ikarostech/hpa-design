import { CheckCircle2 } from "lucide-react";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilAnalysisSettingsCardProps {
  polarReady: boolean;
  onCreatePolar: () => void;
}

export function AirfoilAnalysisSettingsCard({ polarReady, onCreatePolar }: AirfoilAnalysisSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">2D解析設定</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <Input label="Re数" value="300000" />
        <Input label="Mach数" value="0.04" />
        <Input label="α範囲" value="-6° to 18°" />
        <Input label="Ncrit" value="9" />
        <Input label="遷移モデル" value="eN簡易モデル" />
        <Button className="w-full" variant={polarReady ? "success" : "primary"} onClick={onCreatePolar}>
          <CheckCircle2 size={16} />
          Polarを作成
        </Button>
      </CardBody>
    </Card>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" defaultValue={value} /></label>;
}
