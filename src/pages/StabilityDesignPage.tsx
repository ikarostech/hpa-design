import { Link } from "react-router-dom";
import { Badge } from "../shared/ui/Badge";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { AnalysisPage, type AnalysisPageProps } from "./AnalysisPage";
type StabilityDesignPageProps = Omit<AnalysisPageProps,
  "scope" | "introduction" | "stabilityFsiShapes" | "stabilityPhase" | "fixedFsiShape" | "creationDisabledReason" | "comparisonResults">;

export function StabilityDesignPage(analysisProps: StabilityDesignPageProps) {
  return <AnalysisPage {...analysisProps} scope="aircraft" stabilityPhase="pre-fsi" introduction={
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">FSI前の簡易評価</h2><Badge tone="blue">仮の変形・剛体</Badge></CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>構造が未確定でも、解析ケースで仮のたわみ・ねじり分布を入力して確認できます。剛体形状を比較基準にして、重心位置や尾翼の面積・配置・取付角を検討します。</p>
          <Link className="font-medium text-blue-700 underline" to="/aerodynamics/tails">尾翼の形状・取付角を調整</Link>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold text-slate-950">FSI後の評価はFSIページへ</h2></CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-700">
          <p>FSIページで、表示中の収束結果を引き継いだ固定形状の静安定性評価を行います。このページの初期検討結果も、FSIページで比較できます。</p>
          <p className="text-slate-500">保存済みのFSI後の評価ケースと結果も、FSIページから確認できます。</p>
          <div className="flex flex-wrap gap-4"><Link className="font-medium text-blue-700 underline" to="/structures">構造設計を開く</Link><Link className="font-medium text-blue-700 underline" to="/fsi">FSIで変形を確認</Link></div>
        </CardBody>
      </Card>
    </div>
  } />;
}
