import { ArrowRight, FilePlus2, Library, Plane, PlayCircle, Radar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { projects, templates } from "../mocks/mockData";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";

export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">翼型から解析結果まで、次の作業が分かる設計ワークスペースです。</p>
        </div>
        <Button onClick={() => navigate("/airfoils")}>
          翼型を追加
          <ArrowRight size={16} />
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardBody className="grid gap-6 bg-gradient-to-br from-blue-600 to-sky-500 p-6 text-white md:grid-cols-[1fr_280px]">
              <div>
                <Badge tone="green">MVP1</Badge>
                <h2 className="mt-5 text-3xl font-semibold">AeroLabで航空機設計を始めましょう</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">
                  翼型の選択、Polar作成、主翼設計、VLM風の結果確認までを一つの導線で確認できます。
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => navigate("/aircraft")}>
                    <FilePlus2 size={16} />
                    新規プロジェクト
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/airfoils")}>テンプレートから作成</Button>
                </div>
              </div>
              <div className="rounded-lg border border-white/20 bg-white/10 p-4">
                <p className="text-sm font-semibold">設計フロー</p>
                {["翼型", "翼設計", "機体解析", "結果確認"].map((step, index) => (
                  <div key={step} className="mt-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-blue-700">
                      {index + 1}
                    </div>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="保存済み翼型" value="18" detail="6件が最近更新" icon={<Library size={18} />} />
            <MetricCard label="解析実行数" value="42" detail="今週 +5" icon={<Radar size={18} />} />
            <MetricCard label="最新の結果" value="L/D 23.8" detail="Cruise_20mps" icon={<PlayCircle size={18} />} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-slate-950">最近のプロジェクト</h2>
              </CardHeader>
              <CardBody className="space-y-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    onClick={() => navigate("/aircraft")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{project.name}</p>
                      <Badge tone={project.status === "解析済み" ? "green" : "blue"}>{project.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{project.use} / 更新 {project.updatedAt}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${project.progress}%` }} />
                    </div>
                  </button>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold text-slate-950">テンプレート</h2>
              </CardHeader>
              <CardBody className="grid gap-3">
                {templates.map((template) => (
                  <button
                    key={template.name}
                    className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-slate-50"
                    onClick={() => navigate("/aircraft")}
                  >
                    <div className="flex items-center gap-3">
                      <Plane className="text-blue-600" size={18} />
                      <p className="font-medium text-slate-900">{template.name}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{template.description}</p>
                  </button>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-950">新規プロジェクト作成</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {["基本設定", "翼型", "機体", "解析"].map((step, index) => (
                  <div key={step} className="text-center">
                    <div className={`mx-auto h-7 w-7 rounded-full text-xs font-semibold leading-7 ${index === 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {index + 1}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{step}</p>
                  </div>
                ))}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                プロジェクト名
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" defaultValue="New_UAV_Concept" />
              </label>
              <FormRow label="用途" value="UAV" />
              <FormRow label="単位系" value="SI" />
              <FormRow label="解析対象" value="空力特性（定常解析）" />
              <Button className="w-full" onClick={() => navigate("/airfoils")}>次へ</Button>
            </CardBody>
          </Card>

          <NextSteps />
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" defaultValue={value}>
        <option>{value}</option>
        <option>グライダー</option>
        <option>RC機</option>
      </select>
    </label>
  );
}

function NextSteps() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">次の推奨ステップ</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        {[
          { label: "翼型を追加", path: "/airfoils" },
          { label: "Polarを作成", path: "/airfoils" },
          { label: "主翼を定義", path: "/aircraft" },
        ].map((step) => (
          <button key={step.label} onClick={() => navigate(step.path)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-blue-50">
            {step.label}
            <ArrowRight size={15} className="text-blue-600" />
          </button>
        ))}
      </CardBody>
    </Card>
  );
}
