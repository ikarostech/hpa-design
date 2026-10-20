import type { AircraftGeometry } from "../../aircraft/model/types";
import type { WingAnalysisMesh, WingMeshNode } from "./wingAnalysisMesh";
import type { AircraftAnalysisMesh } from "./aircraftAnalysisMesh";

interface Vector { x: number; y: number; z: number }

export interface AircraftVlmCondition {
  alpha: number;
  beta: number;
  reference: { area: number; span: number; chord: number; point: Vector };
}

export interface AircraftVlmPanelLoad {
  surfaceId: string;
  side: "left" | "right";
  stripIndex: number;
  chordIndex: number;
  applicationPoint: Vector;
  circulation: number;
  /** Force and moment divided by dynamic pressure, in m² and m³. */
  force: Vector;
  moment: Vector;
}

export interface AircraftVlmCoefficients {
  cl: number;
  cy: number;
  cdi: number;
  cm: number;
  cr: number;
  cn: number;
  force: Vector;
  moment: Vector;
  panelLoads: AircraftVlmPanelLoad[];
}

/** Inviscid thin-surface solution. Incidence must already be encoded in mesh nodes. */
export function calculateAircraftVlmCoefficients(mesh: AircraftAnalysisMesh, condition: AircraftVlmCondition): AircraftVlmCoefficients {
  validateAircraftVlmCondition(condition);
  return prepareAircraftVlmSolver(mesh, condition.reference)(condition);
}

function validateAircraftVlmCondition({ alpha, beta, reference }: AircraftVlmCondition) {
  if (![reference.area, reference.span, reference.chord].every((value) => Number.isFinite(value) && value > 0)
    || ![alpha, beta, reference.point.x, reference.point.y, reference.point.z].every(Number.isFinite)) {
    throw new Error("VLM requires finite angles and positive reference dimensions with a finite reference point.");
  }
}

/** Prepare one fixed shape/reference for a sweep. No global cache: a new shape gets a new solver. */
export function prepareAircraftVlmSolver(mesh: AircraftAnalysisMesh, inputReference: AircraftVlmCondition["reference"]) {
  const reference = { ...inputReference, point: { ...inputReference.point } };
  validateAircraftVlmCondition({ alpha: 0, beta: 0, reference });
  const panels = mesh.panels.map(createVortexPanel);
  const extent = mesh.nodes.reduce((maximum, node) => Math.max(maximum, Math.abs(node.x), Math.abs(node.y), Math.abs(node.z)), reference.span);
  const wakeLength = Math.max(1_000, extent * 1_000);

  // The wake stays aligned with X in this model, so A is independent of alpha/beta.
  // Solve A * gamma = -normal dot U for the three unit inflows in one elimination.
  const matrix = createInfluenceMatrix(panels, wakeLength);
  const [gammaX, gammaY, gammaZ] = solveLinearSystems(matrix,
    (["x", "y", "z"] as const).map((axis) => panels.map((panel) => -panel.normal[axis])));
  const preparedPanels = panels.map((panel, index) => {
    const applicationPoint = scale(add(panel.start, panel.end), 0.5);
    const inducedX = { x: 0, y: 0, z: 0 };
    const inducedY = { x: 0, y: 0, z: 0 };
    const inducedZ = { x: 0, y: 0, z: 0 };
    panels.forEach((source, sourceIndex) => {
      const velocity = wakeVelocity(applicationPoint, source.start, source.end, wakeLength);
      for (const axis of ["x", "y", "z"] as const) {
        inducedX[axis] += velocity[axis] * gammaX[sourceIndex];
        inducedY[axis] += velocity[axis] * gammaY[sourceIndex];
        inducedZ[axis] += velocity[axis] * gammaZ[sourceIndex];
      }
    });
    const source = mesh.panels[index];
    return { surfaceId: source.surfaceId, side: source.side, stripIndex: source.stripIndex, chordIndex: source.chordIndex,
      applicationPoint, span: subtract(panel.end, panel.start), inducedX, inducedY, inducedZ };
  });

  return ({ alpha: alphaDegrees, beta: betaDegrees }: Pick<AircraftVlmCondition, "alpha" | "beta">): AircraftVlmCoefficients => {
    validateAircraftVlmCondition({ alpha: alphaDegrees, beta: betaDegrees, reference });
    const alpha = alphaDegrees * Math.PI / 180;
    const beta = betaDegrees * Math.PI / 180;
    const freestream = { x: Math.cos(alpha) * Math.cos(beta), y: Math.sin(beta), z: Math.sin(alpha) * Math.cos(beta) };
    const liftAxis = { x: -Math.sin(alpha), y: 0, z: Math.cos(alpha) };
    let inducedDrag = 0;
    const panelLoads = preparedPanels.map((panel, index): AircraftVlmPanelLoad => {
      const circulation = gammaX[index] * freestream.x + gammaY[index] * freestream.y + gammaZ[index] * freestream.z;
      const force = scale(cross(freestream, panel.span), 2 * circulation);
      const moment = cross(subtract(panel.applicationPoint, reference.point), force);
      const induced = add(add(scale(panel.inducedX, freestream.x), scale(panel.inducedY, freestream.y)), scale(panel.inducedZ, freestream.z));
      inducedDrag += dot(scale(cross(induced, panel.span), 2 * circulation), freestream);
      return { surfaceId: panel.surfaceId, side: panel.side, stripIndex: panel.stripIndex, chordIndex: panel.chordIndex,
        applicationPoint: { ...panel.applicationPoint }, circulation, force, moment };
    });
    const force = panelLoads.reduce((sum, load) => add(sum, load.force), { x: 0, y: 0, z: 0 });
    const moment = panelLoads.reduce((sum, load) => add(sum, load.moment), { x: 0, y: 0, z: 0 });
    return {
      cl: dot(force, liftAxis) / reference.area, cy: force.y / reference.area,
      cdi: Math.max(0, inducedDrag / reference.area),
      cm: moment.y / (reference.area * reference.chord),
      cr: moment.x / (reference.area * reference.span), cn: moment.z / (reference.area * reference.span),
      force, moment, panelLoads,
    };
  };
}

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
  panelLoads: VlmPanelLoad[];
}

export interface VlmPanelLoad {
  side: "left" | "right";
  stripIndex: number;
  chordIndex: number;
  applicationPoint: Vector;
  circulation: number;
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
  if (!panels.length) return { cl: 0, cdi: 0, cm: 0, panelLoads: [] };

  const alpha = (alphaDegrees + aircraft.incidence) * Math.PI / 180;
  const freestream = { x: Math.cos(alpha), y: 0, z: Math.sin(alpha) };
  const wakeLength = Math.max(aircraft.span * 1_000, 1_000);
  const circulation = solveCirculation(panels, freestream, wakeLength);

  let lift = 0;
  let inducedDrag = 0;
  let pitchingMoment = 0;
  const referenceX = aircraft.mac / 4;
  const area = Math.max(aircraft.wingArea, 1e-9);
  const panelLoads: VlmPanelLoad[] = [];
  panels.forEach((panel, index) => {
    const spanVector = subtract(panel.end, panel.start);
    const spanWidth = spanVector.y;
    const panelLift = 2 * circulation[index] * spanWidth * Math.cos(alpha);
    lift += panelLift;
    const panelPitchingMoment = -panelLift * (((panel.start.x + panel.end.x) / 2) - referenceX) / Math.max(aircraft.mac, 1e-9);
    pitchingMoment += panelPitchingMoment;

    const boundMidpoint = scale(add(panel.start, panel.end), 0.5);
    const induced = panels.reduce<Vector>((velocity, source, sourceIndex) => {
      return add(velocity, scale(wakeVelocity(boundMidpoint, source.start, source.end, wakeLength), circulation[sourceIndex]));
    }, { x: 0, y: 0, z: 0 });
    const panelInducedDrag = -2 * circulation[index] * spanWidth * induced.z;
    inducedDrag += panelInducedDrag;
    panelLoads.push({
      side: mesh.panels[index].side,
      stripIndex: mesh.panels[index].stripIndex,
      chordIndex: mesh.panels[index].chordIndex,
      applicationPoint: boundMidpoint,
      circulation: circulation[index],
      cl: panelLift / area,
      cdi: panelInducedDrag / area,
      cm: panelPitchingMoment / area,
    });
  });

  if (inducedDrag < 0) panelLoads.forEach((load) => { load.cdi = 0; });
  return {
    cl: lift / area,
    cdi: Math.max(0, inducedDrag / area),
    cm: pitchingMoment / area,
    panelLoads,
  };
}

function solveCirculation(panels: readonly VortexPanel[], freestream: Vector, wakeLength: number) {
  return solveLinearSystems(createInfluenceMatrix(panels, wakeLength),
    [panels.map((panel) => -dot(freestream, panel.normal))])[0];
}

function createInfluenceMatrix(panels: readonly VortexPanel[], wakeLength: number) {
  return panels.map((target) => panels.map((source) => dot(
    horseshoeVelocity(target.control, source.start, source.end, wakeLength), target.normal,
  )));
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
  const spanAxis = Math.abs(quarterOutboard.z - quarterInboard.z) > Math.abs(quarterOutboard.y - quarterInboard.y) ? "z" : "y";
  const [start, end] = quarterInboard[spanAxis] <= quarterOutboard[spanAxis]
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

function solveLinearSystems(matrix: number[][], rightHandSides: number[][]): number[][] {
  const size = matrix.length;
  const width = size + rightHandSides.length;
  const rows = matrix.map((row, index) => [...row, ...rightHandSides.map((values) => values[index])]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) throw new Error("VLM influence matrix is singular.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let entry = column; entry < width; entry += 1) rows[column][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry < width; entry += 1) rows[row][entry] -= factor * rows[column][entry];
    }
  }
  return rightHandSides.map((_, index) => rows.map((row) => row[size + index]));
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
