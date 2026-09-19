# 翼幅方向分布の共通化設計

> 実装状況（2026-08-19）: Slice 1〜5を実装済み。VLM/LLTの迎角別分布、実分布からの構造荷重生成、統合グラフ、JSON検証、CSV出力に適用している。

## 目的

空力解析と構造解析が持つ翼幅方向の結果を、同じ座標規約、補間規則、表示境界で扱えるようにする。

共通化の対象は「一次元座標上の標本点列」であり、揚力、抗力、曲げモーメント、安全率などの物理量は各featureが所有する。これにより、`app -> pages -> features -> shared` の依存方向と、shared契約をドメイン非依存に保つ原則を維持する。

## 既存契約では不足する理由

`src/shared/model` の既存契約は、selection、inspector、form、job、table、repository、result view、import/exportの境界を扱う。以下はどの契約にも含まれない。

- 一次元座標と標本値の対応
- 標本点の並び順、不在値、単位の規約
- 異なる計算格子間の補間と重ね合わせ
- 分布データをグラフへ渡すfeature横断境界

既存契約へ無理に追加すると責務が混ざるため、新しい汎用カテゴリ `distribution` が必要である。実装開始前に、この新規sharedカテゴリの追加について確認を得る。

## 設計原則

1. sharedは物理量名を知らない。
2. featureの永続化モデルと、グラフへ渡す共通モデルを分離する。
3. 値が計算できない場合は `null` とし、物理的なゼロと区別する。
4. 座標は有限値、昇順、重複なしとする。
5. 補間は明示的に行い、グラフコンポーネント内で暗黙に行わない。
6. SI単位を計算・永続化の標準とし、表示単位への変換はUI側で行う。
7. 半翼・全翼、座標原点、左右の規約をデータに明記する。

## shared契約案

配置候補: `src/shared/model/distribution.ts`

```ts
export type DistributionValue = number | null;

export interface DistributionAxis {
  key: string;
  unit: string;
  label?: string;
}

export interface DistributionSample<TValues> {
  position: number;
  values: Readonly<TValues>;
}

export interface OneDimensionalDistribution<TValues> {
  axis: DistributionAxis;
  samples: readonly DistributionSample<TValues>[];
}
```

この契約には `lift`、`drag`、`yPosition` などの航空・構造固有語を入れない。`label` はデータの意味を説明するための任意情報に留め、色、線種、左右軸などのグラフ表現は含めない。

## feature固有モデル

### 空力解析

配置候補: `src/features/analysis/model/spanwiseDistribution.ts`

```ts
export interface AerodynamicSpanValues {
  stationWidth: number;
  chord: number;
  circulation: number;
  localLiftCoefficient: number;
  liftPerLength: number;
  inducedDragPerLength: number;
  profileDragPerLength: number;
  dragPerLength: number;
  pitchingMomentPerLength: number;
  torqueAboutElasticAxisPerLength: number;
}

export interface AerodynamicSpanDistribution
  extends OneDimensionalDistribution<AerodynamicSpanValues> {
  axis: DistributionAxis & { key: "semi-span"; unit: "m" };
  reference: {
    side: "right";
    origin: "centerline";
    alphaDegrees: number;
    speed: number;
    density: number;
    elasticAxisChordFraction: number;
  };
}
```

`AnalysisResult.rows` のインライン型は `AnalysisResultRow` として名前を付け、各迎角行に後方互換な任意フィールドを追加する。

```ts
export interface AnalysisResultRow {
  caseId: string;
  alpha: number;
  cl: number;
  cd: number;
  cm: number;
  ld: number;
  status: AnalysisCaseStatus;
  spanwise?: AerodynamicSpanDistribution;
}
```

分布は迎角によって変わるため、`AnalysisResult`直下ではなく各rowに所属させる。

### 構造解析

既存の `StructuralResultPoint` は永続化形式として維持する。直ちにフィールド名を変更すると既存JSONの移行範囲が大きいため、共通分布への変換関数を構造featureに置く。

配置候補: `src/features/structures/services/structuralResultDistribution.ts`

```ts
export interface StructuralSpanValues {
  distributedLift: number;
  shearForce: number;
  bendingMoment: number;
  bendingMomentCapacity: number | null;
  bendingReserveFactor: number | null;
  torque: number;
  torqueCapacity: number | null;
  torsionReserveFactor: number | null;
  deflection: number;
  rotation: number;
  twist: number;
  axialStress: number;
  shearStress: number;
  combinedReserveFactor: number;
}

export function toStructuralSpanDistribution(
  result: StructuralAnalysisResult,
): OneDimensionalDistribution<StructuralSpanValues>;
```

変換関数は `yPosition` を共通契約の `position` へ写像し、旧形式で存在しない耐荷重値は `null` にする。

## 座標規約

MVPでは以下に固定する。

| 項目 | 規約 |
|---|---|
| 対象 | 右半翼 |
| 原点 | 機体中心線 |
| 正方向 | 翼根から翼端 |
| 範囲 | `0 <= position <= span / 2` |
| 長さ単位 | m |
| 分布荷重 | N/m |
| モーメント | Nm |
| 単位長さ当たりモーメント | Nm/m |
| 角度 | 公開結果・永続化・UI表示はdeg。三角関数などの局所計算のみrad |

左翼や非対称解析へ拡張する場合は、feature側の `reference.side` を `left | right | full` に広げる。初期実装で負の翼幅座標と正の半翼座標を混在させない。

## 共通操作

配置候補: `src/shared/lib/distribution.ts`

```ts
validateDistribution(distribution)
interpolateDistribution(distribution, position)
resampleDistribution(distribution, positions)
mergeDistributionCoordinates(distributions)
```

規則:

- 線形補間を既定とする。
- 定義域外への外挿は行わず `null` を返す。
- 不連続点や集中荷重位置は必ず出力座標へ含める。
- `null`を挟む区間は補間しない。
- 入力配列を変更せず、新しいreadonlyデータを返す。

## グラフ境界

グラフのseries定義はsharedの永続化契約へ含めない。結果ページで空力・構造の分布を受け取り、表示専用データへ変換する。

```ts
interface PlotSeries<TValues> {
  key: keyof TValues;
  label: string;
  unit: string;
  axis: "left" | "right";
  color: string;
}
```

`PlotSeries`はページコンポーネントまたは表示用コンポーネントが所有する。これにより、計算モデルがRechartsや画面デザインへ依存しない。

## データフロー

```text
LLT / VLM
  -> AerodynamicSpanDistribution（迎角ごと）
  -> AnalysisResultRow.spanwise
  -> 選択した迎角の実分布
  -> StructuralLoadCaseへ変換
  -> StructuralAnalysisResult.points
  -> OneDimensionalDistributionへ変換
  -> pages層で座標を統合・補間
  -> 統合グラフ
```

空力featureから構造featureを直接importしない。空力結果から構造荷重ケースを作る既存の明示的依存は構造feature側に置き、結果ページでの重ね合わせはpages層で行う。

## 整合性検証

空力分布には以下の保存則テストを設ける。

- `sum(liftPerLength * stationWidth)` と半翼揚力の一致
- `sum(dragPerLength * stationWidth)` と半翼抗力の一致
- `inducedDragPerLength + profileDragPerLength = dragPerLength`
- 弾性軸回りトルクの積分値と空力モーメントの整合

構造分布には以下を設ける。

- 荷重積分値と翼根せん断力の一致
- 荷重一次モーメントと翼根曲げモーメントの一致
- 分布トルク積分値と翼根トルクの一致
- `position`の昇順、有限値、半翼範囲内を検証

統合表示には以下を設ける。

- 異なる空力・構造格子を同じ座標へ補間できる
- 定義域外や旧結果の欠損値を0として描画しない
- 選択した空力迎角と構造荷重ケースの参照が一致する

## 永続化と移行

- `spanwise`は当初optionalとして追加し、旧設計JSONを読み込めるようにする。
- 新規解析結果では必ず`spanwise`を生成する。
- clone、import validation、JSON export、CSV exportを同じスライスで更新する。
- 空力分布を持たない旧結果から構造荷重を作る場合のみ、既存の楕円分布生成を「旧結果用フォールバック」として明示する。
- 旧結果を画面表示するときは「翼幅分布なし。再解析が必要」と表示し、推定値を実計算値と同じ見た目にしない。

## 実装スライス案

### Slice 1: 共通契約と変換

- `shared/model/distribution.ts`
- `shared/lib/distribution.ts`
- 構造結果から共通分布への変換
- 座標検証、補間、再標本化のテスト

### Slice 2: VLM分布

- VLMパネル荷重をストリップへ集約
- 迎角rowへ分布を保存
- 揚力、抗力、トルクの保存則テスト

### Slice 3: 構造荷重への受け渡し

- 空力結果と迎角を選択
- 楕円近似を使わず実分布から荷重ケースを作成
- `aerodynamicResultId`に加えて迎角をスナップショットへ保存

### Slice 4: 統合表示と入出力

- 空力・構造格子の統合
- 揚力、抗力、曲げ、耐荷重、安全率、ねじりのグラフ
- clone、import validation、CSV/JSON export、旧データ表示

### Slice 5: LLT分布

- Fourier係数から循環分布を復元
- VLMと同じfeature固有分布型へ格納
- 全機係数との保存則テスト

## 今回決めないこと

- 抗力を構造解析の前後方向荷重として解く二軸梁モデル
- 左右非対称翼と全翼分布
- 非線形補間、高次補間
- 時系列分布、非定常解析
- 連成反復履歴を共通分布契約へ含めること

これらは一次元分布契約の上に将来追加できるが、MVPの共通契約には含めない。
