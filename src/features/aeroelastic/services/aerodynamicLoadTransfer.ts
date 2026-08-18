import type { AircraftGeometry } from "../../aircraft/model/types";
import type { VlmPanelLoad } from "../../analysis/services/vlmSolver";
import type { WingAnalysisMesh, WingMeshNode } from "../../analysis/services/wingAnalysisMesh";
import type { AerodynamicLoadTransferResult } from "../model/types";

export function transferVlmLoadsToBeam({
  aircraft,
  mesh,
  panelLoads,
  density,
  speed,
  elasticAxisChordFraction,
  sectionMomentCoefficients,
}: {
  aircraft: AircraftGeometry;
  mesh: WingAnalysisMesh;
  panelLoads: readonly VlmPanelLoad[];
  density: number;
  speed: number;
  elasticAxisChordFraction: number;
  sectionMomentCoefficients?: readonly number[];
}): AerodynamicLoadTransferResult {
  if (!(density > 0) || !(speed >= 0)) throw new Error("空気密度は正、速度は0以上で指定してください。");
  if (elasticAxisChordFraction < 0 || elasticAxisChordFraction > 1) throw new Error("弾性軸位置は0から1の範囲で指定してください。");
  if (sectionMomentCoefficients && sectionMomentCoefficients.length !== mesh.strips.length) throw new Error("断面モーメント係数の数が翼幅ストリップ数と一致しません。");
  const dynamicPressure = density * speed ** 2 / 2;
  const dynamicPressureArea = density * speed ** 2 * aircraft.wingArea / 2;
  let sourceLift = 0;
  let sourceTorque = 0;

  const points = mesh.strips.map((strip, stripIndex) => {
    const loads = panelLoads.filter((load) => load.side === "right" && load.stripIndex === stripIndex);
    const panels = mesh.panels.filter((panel) => panel.side === "right" && panel.stripIndex === stripIndex);
    const elasticAxisX = chordPointX(panels.flatMap((panel) => panel.corners), elasticAxisChordFraction);
    const lift = loads.reduce((sum, load) => sum + dynamicPressureArea * load.cl, 0);
    const drag = loads.reduce((sum, load) => sum + dynamicPressureArea * load.cdi, 0);
    const forceArmTorque = loads.reduce((sum, load) => {
      return sum + (elasticAxisX - load.applicationPoint.x) * dynamicPressureArea * load.cl;
    }, 0);
    const width = strip.yEnd - strip.yStart;
    const sectionTorque = dynamicPressure * strip.chord ** 2 * width * (sectionMomentCoefficients?.[stripIndex] ?? 0);
    const torque = forceArmTorque + sectionTorque;
    sourceLift += lift;
    sourceTorque += torque;
    return {
      yPosition: strip.centerY,
      width,
      circulation: loads.reduce((sum, load) => sum + load.circulation * speed, 0),
      liftPerLength: lift / Math.max(width, 1e-12),
      dragPerLength: drag / Math.max(width, 1e-12),
      torquePerLength: torque / Math.max(width, 1e-12),
    };
  });

  const transferredLift = points.reduce((sum, point) => sum + point.liftPerLength * point.width, 0);
  const transferredTorque = points.reduce((sum, point) => sum + point.torquePerLength * point.width, 0);
  return {
    points,
    forceBalanceError: Math.abs(sourceLift - transferredLift),
    momentBalanceError: Math.abs(sourceTorque - transferredTorque),
  };
}

function chordPointX(nodes: readonly WingMeshNode[], chordFraction: number) {
  const leading = nodes.filter((node) => Math.abs(node.chordFraction) < 1e-10);
  const trailing = nodes.filter((node) => Math.abs(node.chordFraction - 1) < 1e-10);
  if (!leading.length || !trailing.length) throw new Error("空力パネルから翼弦端を特定できません。");
  const leadingX = leading.reduce((sum, node) => sum + node.x, 0) / leading.length;
  const trailingX = trailing.reduce((sum, node) => sum + node.x, 0) / trailing.length;
  return leadingX + (trailingX - leadingX) * chordFraction;
}
