import type { AircraftGeometry } from "../../aircraft/model/types";
import type { WingAnalysisMesh, WingMeshNode } from "./wingAnalysisMesh";

interface Vector { x: number; y: number; z: number }

interface VortexPanel {
  start: Vector;
  end: Vector;
  control: Vector;
  normal: Vector;
}

export interface VlmCoefficients {
  cl: number;
  cdi: number;
  cm: number;
}

export function calculateVlmCoefficients(
  aircraft: AircraftGeometry,
  mesh: WingAnalysisMesh,
  alphaDegrees: number,
): VlmCoefficients {
  const panels = mesh.panels.map(createVortexPanel);
  if (!panels.length) return { cl: 0, cdi: 0, cm: 0 };

  const alpha = (alphaDegrees + aircraft.incidence) * Math.PI / 180;
  const freestream = { x: Math.cos(alpha), y: 0, z: Math.sin(alpha) };
  const wakeLength = Math.max(aircraft.span * 1_000, 1_000);
  const matrix = panels.map((target) => panels.map((source) => dot(
    horseshoeVelocity(target.control, source.start, source.end, wakeLength),
    target.normal,
  )));
  const rhs = panels.map((panel) => -dot(freestream, panel.normal));
  const circulation = solveLinearSystem(matrix, rhs);

  let lift = 0;
  let inducedDrag = 0;
  let pitchingMoment = 0;
  const referenceX = aircraft.mac / 4;
  panels.forEach((panel, index) => {
    const spanVector = subtract(panel.end, panel.start);
    const spanWidth = spanVector.y;
    const panelLift = 2 * circulation[index] * spanWidth * Math.cos(alpha);
    lift += panelLift;
    pitchingMoment -= panelLift * (((panel.start.x + panel.end.x) / 2) - referenceX) / Math.max(aircraft.mac, 1e-9);

    const boundMidpoint = scale(add(panel.start, panel.end), 0.5);
    const induced = panels.reduce<Vector>((velocity, source, sourceIndex) => {
      return add(velocity, scale(wakeVelocity(boundMidpoint, source.start, source.end, wakeLength), circulation[sourceIndex]));
    }, { x: 0, y: 0, z: 0 });
    inducedDrag += -2 * circulation[index] * spanWidth * induced.z;
  });

  const area = Math.max(aircraft.wingArea, 1e-9);
  return {
    cl: lift / area,
    cdi: Math.max(0, inducedDrag / area),
    cm: pitchingMoment / area,
  };
}

function wakeVelocity(point: Vector, start: Vector, end: Vector, wakeLength: number): Vector {
  const farStart = { ...start, x: start.x + wakeLength };
  const farEnd = { ...end, x: end.x + wakeLength };
  return add(segmentVelocity(point, farStart, start), segmentVelocity(point, end, farEnd));
}

function createVortexPanel(panel: WingAnalysisMesh["panels"][number]): VortexPanel {
  const [leadingInboard, leadingOutboard, trailingOutboard, trailingInboard] = panel.corners;
  const quarterInboard = interpolateNode(leadingInboard, trailingInboard, 0.25);
  const quarterOutboard = interpolateNode(leadingOutboard, trailingOutboard, 0.25);
  const controlInboard = interpolateNode(leadingInboard, trailingInboard, 0.75);
  const controlOutboard = interpolateNode(leadingOutboard, trailingOutboard, 0.75);
  const [start, end] = quarterInboard.y <= quarterOutboard.y
    ? [quarterInboard, quarterOutboard]
    : [quarterOutboard, quarterInboard];
  const chord = scale(add(
    subtract(trailingInboard, leadingInboard),
    subtract(trailingOutboard, leadingOutboard),
  ), 0.5);
  const span = subtract(end, start);
  return {
    start,
    end,
    control: scale(add(controlInboard, controlOutboard), 0.5),
    normal: normalize(cross(chord, span)),
  };
}

function horseshoeVelocity(point: Vector, start: Vector, end: Vector, wakeLength: number): Vector {
  const farStart = { ...start, x: start.x + wakeLength };
  const farEnd = { ...end, x: end.x + wakeLength };
  return add(
    add(segmentVelocity(point, farStart, start), segmentVelocity(point, start, end)),
    segmentVelocity(point, end, farEnd),
  );
}

function segmentVelocity(point: Vector, start: Vector, end: Vector): Vector {
  const r1 = subtract(point, start);
  const r2 = subtract(point, end);
  const segment = subtract(end, start);
  const crossProduct = cross(r1, r2);
  const crossSquared = dot(crossProduct, crossProduct);
  const r1Length = magnitude(r1);
  const r2Length = magnitude(r2);
  if (crossSquared < 1e-16 || r1Length < 1e-9 || r2Length < 1e-9) return { x: 0, y: 0, z: 0 };
  const factor = dot(segment, subtract(scale(r1, 1 / r1Length), scale(r2, 1 / r2Length))) / (4 * Math.PI * crossSquared);
  return scale(crossProduct, factor);
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) throw new Error("VLM influence matrix is singular.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let entry = column; entry <= size; entry += 1) rows[column][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry <= size; entry += 1) rows[row][entry] -= factor * rows[column][entry];
    }
  }
  return rows.map((row) => row[size]);
}

function interpolateNode(start: WingMeshNode, end: WingMeshNode, ratio: number): Vector {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
    z: start.z + (end.z - start.z) * ratio,
  };
}

function add(left: Vector, right: Vector): Vector { return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }; }
function subtract(left: Vector, right: Vector): Vector { return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }; }
function scale(vector: Vector, factor: number): Vector { return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor }; }
function dot(left: Vector, right: Vector) { return left.x * right.x + left.y * right.y + left.z * right.z; }
function cross(left: Vector, right: Vector): Vector { return { x: left.y * right.z - left.z * right.y, y: left.z * right.x - left.x * right.z, z: left.x * right.y - left.y * right.x }; }
function magnitude(vector: Vector) { return Math.sqrt(dot(vector, vector)); }
function normalize(vector: Vector): Vector { const length = magnitude(vector); return length ? scale(vector, 1 / length) : { x: 0, y: 0, z: 0 }; }
