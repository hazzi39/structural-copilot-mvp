"use client";

import "katex/dist/katex.min.css";

import katex from "katex";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";

import {
  analyzeRcFatigue,
  getConcreteBoundaryPoints,
  getSteelBoundaryPoints,
  getSteelDefinitionSummary,
  type EtaCMode,
  type RcFatigueInput,
  type StrengthGainType,
  type VariableAmplitudeRowInput,
} from "@/features/rc-fatigue/calc";
import styles from "@/features/rc-fatigue/rc-fatigue-workbench.module.css";

type FormState = Record<string, string>;

interface SavedResultRow {
  id: string;
  timestamp: string;
  sectionLabel: string;
  concreteStatus: string;
  steelStatus: string;
  governingUtilisation: number;
  deltaSigmaS: number;
  sigmaCMax: number;
}

interface StatusRowItem {
  name: string;
  value: string;
  tooltip?: string;
}

const STORAGE_KEY = "rc-fatigue-saved-results";

const defaultVariableRows: VariableAmplitudeRowInput[] = [
  { id: "row-1", label: "Band 1", mMaxKnM: 180, mMinKnM: 45, cycles: 120000 },
  { id: "row-2", label: "Band 2", mMaxKnM: 150, mMinKnM: 20, cycles: 80000 },
];

const defaultForm: FormState = {
  b: "300",
  h: "600",
  d_t: "540",
  d_c: "60",
  e_c: "30000",
  e_s: "200000",
  f_c: "40",
  f_y: "500",
  phi_c_fat: "0.65",
  phi_s_fat: "0.85",
  tensionBarCount: "4",
  compressionBarCount: "2",
  db_t: "24",
  db_c: "20",
  steelCategory: "B",
  mandrelDiameter: "100",
  marineEnvironment: "",
  weldedDetail: "",
  mMaxKnM: "180",
  mMinKnM: "45",
  n_sc: "200000",
  includeVariableAmplitude: "",
  t0: "28",
  strengthGainType: "normal",
  etaCMode: "calculated",
};

const equations = [
  {
    title: "Neutral axis depth",
    tex: String.raw`0.5\,b\,d_n^2 + (nA_{sc}+nA_{st})\,d_n - nA_{sc}d_c - nA_{st}d_t = 0`,
  },
  {
    title: "Cracked transformed inertia",
    tex: String.raw`I_{cr} = \frac{b d_n^3}{3} + nA_{sc}(d_n-d_c)^2 + nA_{st}(d_t-d_n)^2`,
  },
  {
    title: "Concrete fatigue stress level",
    tex: String.raw`S_{cd,\max} = \frac{\eta_c \sigma_{c,\max}}{\phi_{c,fat} f_{c,fat}}`,
  },
  {
    title: "Steel range capacity",
    tex: String.raw`\Delta\sigma_{capacity} = \phi_{s,fat}\,\Delta\sigma_{Rsk,n}`,
  },
];

export function RcFatigueWorkbench() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [variableRows, setVariableRows] =
    useState<VariableAmplitudeRowInput[]>(defaultVariableRows);
  const [savedResults, setSavedResults] = useState<SavedResultRow[]>(loadSavedResults);
  const deferredForm = useDeferredValue(form);
  const deferredRows = useDeferredValue(variableRows);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedResults));
  }, [savedResults]);

  const parsed = parseFormState(deferredForm, deferredRows);
  const analysis = parsed.values ? analyzeRcFatigue(parsed.values) : null;
  const steelDefinition = parsed.values ? getSteelDefinitionSummary(parsed.values) : null;
  const concretePlot = analysis
    ? getConcreteBoundaryPoints(analysis.concrete.sCdMin || 0)
    : [];
  const steelPlot =
    steelDefinition && parsed.values
      ? getSteelBoundaryPoints(steelDefinition, parsed.values.phi_s_fat)
      : [];

  const mainResult = analysis ? getGoverningResult(analysis) : null;
  const canSave = Boolean(analysis);
  const autoAreaSummary = getAutoAreaSummary(form);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    const nextValue =
      type === "checkbox" && event.target instanceof HTMLInputElement
        ? event.target.checked
          ? "true"
          : ""
        : value;

    setForm((current) => ({ ...current, [name]: nextValue }));
  }

  function updateVariableRow(
    id: string,
    key: keyof VariableAmplitudeRowInput,
    value: string,
  ) {
    setVariableRows((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }

        if (key === "label") {
          return { ...row, label: value };
        }

        const numeric = Number.parseFloat(value);
        return { ...row, [key]: Number.isFinite(numeric) ? numeric : 0 };
      }),
    );
  }

  function addVariableRow() {
    setVariableRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        label: `Band ${current.length + 1}`,
        mMaxKnM: 120,
        mMinKnM: 20,
        cycles: 50000,
      },
    ]);
  }

  function removeVariableRow(id: string) {
    setVariableRows((current) => current.filter((row) => row.id !== id));
  }

  function saveResult() {
    if (!analysis || !mainResult) {
      return;
    }

    startTransition(() => {
      setSavedResults((current) => [
        {
          id: `${Date.now()}`,
          timestamp: new Intl.DateTimeFormat("en-AU", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date()),
          sectionLabel: `${form.b} x ${form.h} mm`,
          concreteStatus: analysis.concrete.status.toUpperCase(),
          steelStatus: analysis.steel.pass ? "PASS" : "FAIL",
          governingUtilisation: mainResult.value,
          deltaSigmaS: analysis.steel.deltaSigmaS,
          sigmaCMax: analysis.concrete.sigmaCMax,
        },
        ...current,
      ].slice(0, 8));
    });
  }

  function resetToDefaults() {
    setForm(defaultForm);
    setVariableRows(defaultVariableRows);
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>RC Fatigue Tool</span>
            <h1 className={styles.title}>Fatigue Assessment for RC Beams</h1>
            <p className={styles.subtitle}>Transformed-section and fatigue analysis to AS3600.</p>
          </div>
          <div className={styles.headerMeta}>
            <div className={styles.metaPill}>Internal units: mm, mmÂ², MPa, Nmm</div>
          </div>
        </header>

        <section className={styles.topPlots}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardLabel}>S-N Curves</div>
                <h2 className={styles.cardTitle}>Concrete and steel fatigue plots</h2>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.plotGrid}>
                <div className={styles.plotCard}>
                  <div className={styles.plotTitle}>Concrete fatigue boundary</div>
                  <div className={styles.plotHint}>log10(N) versus Scd,max with applied point overlay</div>
                  <FatiguePlot
                    xLabel="log10(N)"
                    yLabel="Scd,max"
                    points={concretePlot.map((point) => ({
                      x: point.logN,
                      y: point.sCdMax,
                    }))}
                    appliedPoint={
                      analysis
                        ? {
                            x: Math.log10(parsed.values?.n_sc ?? 1),
                            y: analysis.concrete.sCdMax,
                          }
                        : undefined
                    }
                    color="#2a7cf7"
                  />
                </div>
                <div className={styles.plotCard}>
                  <div className={styles.plotTitle}>Steel S-N curve</div>
                  <div className={styles.plotHint}>log10(N) versus steel stress range with applied point overlay</div>
                  <FatiguePlot
                    xLabel="log10(N)"
                    yLabel="Î”Ïƒ_s"
                    points={steelPlot.map((point) => ({
                      x: point.logN,
                      y: point.deltaSigma,
                    }))}
                    appliedPoint={
                      analysis
                        ? {
                            x: Math.log10(parsed.values?.n_sc ?? 1),
                            y: analysis.steel.deltaSigmaS,
                          }
                        : undefined
                    }
                    color="#12b5cb"
                  />
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className={styles.mainGrid}>

          <div className={styles.stack}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardLabel}>Visualisation</div>
                  <h2 className={styles.cardTitle}>Live cracked-section diagram</h2>
                </div>
                <div className={styles.vizLegend}>
                  <span className={styles.legendItem}>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: "#2a7cf7" }}
                    />
                    compression zone
                  </span>
                  <span className={styles.legendItem}>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: "#12b5cb" }}
                    />
                    neutral axis
                  </span>
                  <span className={styles.legendItem}>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: "#eb7e3a" }}
                    />
                    reinforcement
                  </span>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.vizStage}>
                  <SectionVisualisation form={parsed.values} analysis={analysis} />
                </div>
              </div>
            </article>

            <article className={`${styles.card} ${styles.resultCard}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardLabel}>Result</div>
                  <h2 className={styles.cardTitle}>Governing fatigue result</h2>
                </div>
                <span
                  className={`${styles.resultStatus} ${
                    mainResult
                      ? mainResult.pass
                        ? styles.pass
                        : styles.fail
                      : styles.neutral
                  }`}
                >
                  {mainResult ? (mainResult.pass ? "Pass" : "Fail") : "Awaiting valid input"}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.resultHero}>
                  <div className={styles.resultValue}>
                    <strong className={styles.resultNumber}>
                      {mainResult ? formatNumber(mainResult.value, 3) : "â€”"}
                    </strong>
                    <span className={styles.resultUnit}>utilisation</span>
                  </div>
                  <p className={styles.resultHint}>
                    {mainResult
                      ? `${mainResult.label} governs.`
                      : "Complete the required fields to unlock live stresses, fatigue checks, plots, and saved results."}
                  </p>
                </div>
                <div className={styles.metricGrid}>
                  <MetricTile
                    label="Concrete fatigue"
                    value={
                      analysis
                        ? `${analysis.concrete.status.toUpperCase()} Â· ${formatNumber(
                            analysis.concrete.utilisation,
                            3,
                          )}`
                        : "â€”"
                    }
                  />
                  <MetricTile
                    label="Steel fatigue"
                    value={
                      analysis
                        ? `${analysis.steel.pass ? "PASS" : "FAIL"} Â· ${formatNumber(
                            analysis.steel.utilisation,
                            3,
                          )}`
                        : "â€”"
                    }
                  />
                  <MetricTile
                    label="Neutral axis d_n"
                    value={
                      analysis
                        ? `${formatNumber(analysis.section.neutralAxisDepth, 1)} mm`
                        : "â€”"
                    }
                  />
                  <MetricTile
                    label="Steel range Î”Ïƒ_s"
                    value={
                      analysis
                        ? `${formatNumber(analysis.steel.deltaSigmaS, 1)} MPa`
                        : "â€”"
                    }
                  />
                </div>
                <div className={styles.saveRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={saveResult}
                    disabled={!canSave}
                  >
                    Save Result
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={resetToDefaults}
                  >
                    Reset defaults
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div className={styles.stack}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardLabel}>Inputs</div>
                  <h2 className={styles.cardTitle}>Geometry, materials, reinforcement, loading</h2>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.formGrid}>
                  <InputSection title="Geometry" hint="Compression face is taken at the top of the section.">
                    <div className={styles.fieldGrid}>
                      <NumberField form={form} errors={parsed.errors} name="b" label="Section width" symbol="b" unit="mm" tooltip="Overall beam width used for concrete compression block area and inertia." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="h" label="Total depth" symbol="h" unit="mm" tooltip="Overall section depth from top compression face to bottom face." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="d_t" label="Tension steel depth" symbol="d_t" unit="mm" tooltip="Depth from the top compression face to the centroid of tensile reinforcement." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="d_c" label="Compression steel depth" symbol="d_c" unit="mm" tooltip="Depth from the top compression face to the centroid of compression reinforcement." onChange={handleFieldChange} />
                    </div>
                  </InputSection>

                  <InputSection title="Materials" hint="Concrete and steel elastic moduli are used for the transformed cracked-section analysis.">
                    <div className={styles.fieldGrid}>
                      <NumberField form={form} errors={parsed.errors} name="e_c" label="Concrete modulus" symbol="E_c" unit="MPa" tooltip="Elastic modulus of concrete used for modular ratio n = E_s / E_c." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="e_s" label="Steel modulus" symbol="E_s" unit="MPa" tooltip="Elastic modulus of reinforcement steel." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="f_c" label="Concrete strength" symbol="f?_c" unit="MPa" tooltip="Characteristic compressive strength used in the concrete fatigue strength expression." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="f_y" label="Steel yield strength" symbol="f_y" unit="MPa" tooltip="Nominal steel yield strength used for the stress cap check at load extrema." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="phi_c_fat" label="Concrete fatigue factor" symbol="Ï†_c,fat" unit="" tooltip="Reduction factor applied to concrete fatigue strength." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="phi_s_fat" label="Steel fatigue factor" symbol="Ï†_s,fat" unit="" tooltip="Reduction factor applied to steel stress-range capacity." onChange={handleFieldChange} />
                    </div>
                  </InputSection>

                  <InputSection title="Reinforcement" hint="Use the tensile bar size for category selection unless a project-specific detail requires a different governing bar.">
                    <div className={styles.fieldGrid}>
                      <NumberField form={form} errors={parsed.errors} name="db_t" label="Tension bar diameter" symbol="d_b,t" unit="mm" tooltip="Diameter of the tensile reinforcement used for fatigue category and area calculation." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="db_c" label="Compression bar diameter" symbol="d_b,c" unit="mm" tooltip="Diameter of the compression reinforcement used for area calculation." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="tensionBarCount" label="Tension bar count" symbol="n_t" unit="bars" tooltip="Number of tensile bars when auto-calculating A_st." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="compressionBarCount" label="Compression bar count" symbol="n_c" unit="bars" tooltip="Number of compression bars when auto-calculating A_sc." onChange={handleFieldChange} />
                      <SelectField form={form} name="steelCategory" label="Steel fatigue category" symbol="Cat." tooltip="Select the AS 3600-style reinforcing-steel fatigue category governing the detail." onChange={handleFieldChange} options={[
                        ["A", "A Â· straight, db â‰¤ 16"],
                        ["B", "B Â· straight, db > 16"],
                        ["C", "C Â· bent, db â‰¤ 16"],
                        ["D", "D Â· bent, db > 16"],
                        ["E", "E Â· welded / mesh"],
                        ["F", "F Â· mechanical connectors"],
                        ["G", "G Â· marine environment"],
                      ]} />
                      <NumberField form={form} errors={parsed.errors} name="mandrelDiameter" label="Mandrel diameter" symbol="d_i" unit="mm" tooltip="Inside bend diameter used to derive k_d for bent reinforcement categories." onChange={handleFieldChange} />
                    </div>
                    <div className={styles.metricGrid}>
                      <MetricTile
                        label="Derived A_st"
                        value={`${formatNumber(autoAreaSummary.tensionArea, 0)} mmÂ²`}
                      />
                      <MetricTile
                        label="Derived A_sc"
                        value={`${formatNumber(autoAreaSummary.compressionArea, 0)} mmÂ²`}
                      />
                    </div>
                    <div className={styles.checkboxRow}>
                      <CheckboxField form={form} name="marineEnvironment" label="Marine environment flag" onChange={handleFieldChange} />
                      <CheckboxField form={form} name="weldedDetail" label="Welded / special detail flag" onChange={handleFieldChange} />
                    </div>
                  </InputSection>

                  <InputSection title="Fatigue loading" hint="Moments are entered in kN.m for convenience and converted to Nmm internally.">
                    <div className={styles.fieldGrid}>
                      <NumberField form={form} errors={parsed.errors} name="mMaxKnM" label="Maximum fatigue moment" symbol="M_max" unit="kN.m" tooltip="Upper bending-moment extreme for the constant-amplitude stress range." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="mMinKnM" label="Minimum fatigue moment" symbol="M_min" unit="kN.m" tooltip="Lower bending-moment extreme for the constant-amplitude stress range." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="n_sc" label="Constant-amplitude cycles" symbol="n_sc" unit="cycles" tooltip="Applied number of cycles for the constant-amplitude check." onChange={handleFieldChange} />
                      <NumberField form={form} errors={parsed.errors} name="t0" label="Age at first cyclic loading" symbol="t_0" unit="days" tooltip="Concrete age at the commencement of cyclic loading for Î²cc(t0)." onChange={handleFieldChange} />
                    </div>
                    <div className={styles.toggleRow}>
                      <ToggleButton
                        active={form.strengthGainType === "highEarly"}
                        onClick={() =>
                          setForm((current) => ({ ...current, strengthGainType: "highEarly" }))
                        }
                        label="High early"
                      />
                      <ToggleButton
                        active={form.strengthGainType === "normal"}
                        onClick={() =>
                          setForm((current) => ({ ...current, strengthGainType: "normal" }))
                        }
                        label="Normal"
                      />
                      <ToggleButton
                        active={form.strengthGainType === "delayed"}
                        onClick={() =>
                          setForm((current) => ({ ...current, strengthGainType: "delayed" }))
                        }
                        label="Delayed"
                      />
                    </div>
                    <div className={styles.toggleRow}>
                      <ToggleButton
                        active={form.etaCMode === "conservative"}
                        onClick={() =>
                          setForm((current) => ({ ...current, etaCMode: "conservative" }))
                        }
                        label="Î·c = 1.0"
                      />
                      <ToggleButton
                        active={form.etaCMode === "calculated"}
                        onClick={() =>
                          setForm((current) => ({ ...current, etaCMode: "calculated" }))
                        }
                        label="Calculated Î·c"
                      />
                    </div>
                  </InputSection>

                  <InputSection title="Variable amplitude table" hint="Each row runs a full stress analysis before Miner damage is accumulated.">
                    <div className={styles.checkboxRow}>
                      <CheckboxField form={form} name="includeVariableAmplitude" label="Include variable-amplitude fatigue assessment" onChange={handleFieldChange} />
                    </div>
                    {form.includeVariableAmplitude ? (
                      <>
                        <div className={styles.variableTable}>
                          {variableRows.map((row) => (
                            <div key={row.id} className={styles.variableRow}>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Label</span>
                                <input
                                  className={styles.input}
                                  value={row.label}
                                  onChange={(event) =>
                                    updateVariableRow(row.id, "label", event.target.value)
                                  }
                                />
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Mmax</span>
                                <div className={styles.controlWrap}>
                                  <input
                                    className={styles.input}
                                    value={row.mMaxKnM}
                                    onChange={(event) =>
                                      updateVariableRow(row.id, "mMaxKnM", event.target.value)
                                    }
                                  />
                                  <span className={styles.unit}>kN.m</span>
                                </div>
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Mmin</span>
                                <div className={styles.controlWrap}>
                                  <input
                                    className={styles.input}
                                    value={row.mMinKnM}
                                    onChange={(event) =>
                                      updateVariableRow(row.id, "mMinKnM", event.target.value)
                                    }
                                  />
                                  <span className={styles.unit}>kN.m</span>
                                </div>
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldLabel}>Cycles</span>
                                <div className={styles.controlWrap}>
                                  <input
                                    className={styles.input}
                                    value={row.cycles}
                                    onChange={(event) =>
                                      updateVariableRow(row.id, "cycles", event.target.value)
                                    }
                                  />
                                  <span className={styles.unit}>n</span>
                                </div>
                              </label>
                              <button
                                type="button"
                                className={styles.tinyButton}
                                onClick={() => removeVariableRow(row.id)}
                                disabled={variableRows.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <button type="button" className={styles.ghostButton} onClick={addVariableRow}>
                          Add variable row
                        </button>
                      </>
                    ) : (
                      <p className={styles.assistText}>
                        Variable-amplitude Miner damage is removed from the active assessment until this toggle is turned back on.
                      </p>
                    )}
                  </InputSection>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <details className={styles.details}>
                <summary className={styles.detailsSummary}>
                  <div>
                    <div className={styles.cardLabel}>Secondary Properties</div>
                    <h2 className={styles.cardTitle}>Equations, section properties, and checks</h2>
                  </div>
                  <span className={styles.detailsChevron}>â–¼</span>
                </summary>
                <div className={styles.cardBody}>
                <div className={styles.plotGrid}>
                  {equations.map((equation) => (
                    <div key={equation.title} className={styles.equationBlock}>
                      <details className={styles.details}>
                        <summary className={styles.detailsSummary}>
                          <span className={styles.formulaTitle}>{equation.title}</span>
                          <span className={styles.detailsChevron}>â–¼</span>
                        </summary>
                        <div className={styles.detailsBody}>
                          <div
                            className={styles.katexShell}
                            dangerouslySetInnerHTML={{
                              __html: katex.renderToString(equation.tex, {
                                throwOnError: false,
                                displayMode: true,
                              }),
                            }}
                          />
                        </div>
                      </details>
                    </div>
                  ))}
                </div>

                <StatusList
                  title="Cracked transformed section properties"
                  rows={
                    analysis
                      ? [
                          { name: "Modular ratio n", value: `${formatNumber(analysis.section.modularRatio, 3)}`, tooltip: "Ratio of steel to concrete elastic modulus, n = Es / Ec." },
                          { name: "Neutral axis depth d_n", value: `${formatNumber(analysis.section.neutralAxisDepth, 1)} mm`, tooltip: "Depth from top face to the cracked transformed neutral axis." },
                          { name: "Cracked second moment I_cr", value: `${formatScientific(analysis.section.crackedSecondMoment)} mmâ´`, tooltip: "Second moment of area of the cracked transformed section about the neutral axis." },
                          { name: "nA_sc", value: `${formatNumber(analysis.section.transformedCompressionSteelArea, 0)} mmÂ²`, tooltip: "Transformed compression steel area used in the cracked-section analysis." },
                          { name: "nA_st", value: `${formatNumber(analysis.section.transformedTensionSteelArea, 0)} mmÂ²`, tooltip: "Transformed tension steel area used in the cracked-section analysis." },
                        ]
                      : [{ name: "State", value: "Waiting for valid input" }]
                  }
                />

                <StatusList
                  title="Stress results"
                  rows={
                    analysis
                      ? [
                          { name: "Ïƒc,top at Mmax", value: `${formatNumber(analysis.stressStates.max.sigmaCTop, 2)} MPa`, tooltip: "Extreme concrete fibre stress at the top face for Mmax. Compression is positive." },
                          { name: "Ïƒc,top at Mmin", value: `${formatNumber(analysis.stressStates.min.sigmaCTop, 2)} MPa`, tooltip: "Extreme concrete fibre stress at the top face for Mmin. Tension reads negative before fatigue compression flooring." },
                          { name: "Ïƒc,300 at governing compression case", value: `${formatNumber(analysis.concrete.sigmaC300, 2)} MPa`, tooltip: "Concrete stress at a fibre 300 mm below the compression face in the governing maximum-compression case." },
                          { name: "Ïƒst at Mmax", value: `${formatNumber(analysis.stressStates.max.sigmaSt, 2)} MPa`, tooltip: "Elastic stress in the tensile reinforcement at Mmax." },
                          { name: "Ïƒst at Mmin", value: `${formatNumber(analysis.stressStates.min.sigmaSt, 2)} MPa`, tooltip: "Elastic stress in the tensile reinforcement at Mmin." },
                          { name: "Î”Ïƒs", value: `${formatNumber(analysis.steel.deltaSigmaS, 2)} MPa`, tooltip: "Steel tensile stress range used for the reinforcement fatigue check." },
                        ]
                      : [{ name: "State", value: "Waiting for valid input" }]
                  }
                />

                <StatusList
                  title="Concrete compression fatigue"
                  rows={
                    analysis
                      ? [
                          { name: "Screening result", value: analysis.concrete.screeningPass ? "PASS" : "Detailed check required", tooltip: "Initial screening against 0.45 Ï†c,fat f?_c,fat with Î·c included." },
                          { name: "Detailed result", value: analysis.concrete.detailedRequired ? (analysis.concrete.detailedPass ? "PASS" : "FAIL") : "Not required", tooltip: "Outcome of the detailed concrete fatigue resistance calculation when screening does not govern." },
                          { name: "Ïƒc,max", value: `${formatNumber(analysis.concrete.sigmaCMax, 2)} MPa`, tooltip: "Maximum compressive concrete stress for fatigue assessment." },
                          { name: "Ïƒc,min", value: `${formatNumber(analysis.concrete.sigmaCMin, 2)} MPa`, tooltip: "Minimum compressive concrete stress for fatigue assessment after flooring tension to zero." },
                          { name: "Î²cc(t0)", value: `${formatNumber(analysis.concrete.betaCcT0, 3)}`, tooltip: "Concrete strength gain factor at first cyclic loading age." },
                          { name: "f?_c,fat", value: `${formatNumber(analysis.concrete.fCFat, 2)} MPa`, tooltip: "Concrete fatigue strength derived from Î²cc(t0) and f'c." },
                          { name: "Î·c", value: `${formatNumber(analysis.concrete.etaC, 3)}`, tooltip: "Concrete stress-gradient factor, either conservative 1.0 or calculated." },
                          { name: "S_cd,max", value: `${formatNumber(analysis.concrete.sCdMax, 3)}`, tooltip: "Non-dimensional maximum concrete fatigue stress level." },
                          { name: "S_cd,min", value: `${formatNumber(analysis.concrete.sCdMin, 3)}`, tooltip: "Non-dimensional minimum concrete fatigue stress level, capped at 0.8 if required." },
                          { name: "N_resist", value: analysis.concrete.nResist ? formatScientific(analysis.concrete.nResist) : "Screening governs", tooltip: "Concrete resisting cycles from the fatigue equation when detailed analysis is required." },
                          { name: "Utilisation", value: `${formatNumber(analysis.concrete.utilisation, 3)}`, tooltip: "Applied-to-capacity ratio for the constant-amplitude concrete fatigue check." },
                          { name: "Variable damage D_Ed", value: parsed.values?.variableAmplitudeRows.length ? `${formatNumber(analysis.concreteVariable.totalDamage, 3)} Â· ${analysis.concreteVariable.pass ? "PASS" : "FAIL"}` : "Not included", tooltip: "Miner damage sum for all active variable-amplitude concrete intervals." },
                        ]
                      : [{ name: "State", value: "Waiting for valid input" }]
                  }
                />

                <StatusList
                  title="Steel reinforcement fatigue"
                  rows={
                    analysis && steelDefinition
                      ? [
                          { name: "Screening result", value: analysis.steel.screeningPass ? "PASS" : "Detailed check required", tooltip: "Initial steel fatigue screening against 70 MPa or 35 MPa depending on detail type." },
                          { name: "Category", value: form.steelCategory, tooltip: "Selected reinforcing-steel fatigue category used to define the S-N curve." },
                          { name: "N_Rsk", value: formatScientific(steelDefinition.nRsk), tooltip: "Reference cycle count attached to the selected fatigue category." },
                          { name: "Î”Ïƒ_Rsk at N_Rsk", value: `${formatNumber(steelDefinition.deltaSigmaRskAtNRsk, 2)} MPa`, tooltip: "Characteristic stress range corresponding to N_Rsk for the selected category." },
                          { name: "Capacity", value: analysis.steel.deltaSigmaCapacity ? `${formatNumber(analysis.steel.deltaSigmaCapacity, 2)} MPa` : "Screening governs", tooltip: "Design stress-range capacity at the applied constant-amplitude cycle count." },
                          { name: "Utilisation", value: `${formatNumber(analysis.steel.utilisation, 3)}`, tooltip: "Applied-to-capacity ratio for the constant-amplitude steel fatigue check." },
                          { name: "Variable damage D_Ed", value: parsed.values?.variableAmplitudeRows.length ? `${formatNumber(analysis.steelVariable.totalDamage, 3)} Â· ${analysis.steelVariable.pass ? "PASS" : "FAIL"}` : "Not included", tooltip: "Miner damage sum for all active variable-amplitude steel intervals." },
                          { name: "Yield check", value: `${analysis.yieldCheck.pass ? "PASS" : "FAIL"} Â· ${formatNumber(analysis.yieldCheck.maximumStress, 2)} MPa max`, tooltip: "Maximum absolute steel stress across the extrema compared with the entered yield strength." },
                        ]
                      : [{ name: "State", value: "Waiting for valid input" }]
                  }
                />

                <div>
                  <div className={styles.cardLabel}>Warnings</div>
                  <div className={styles.warningList}>
                    {parsed.summaryErrors.length > 0 ? (
                      parsed.summaryErrors.map((message) => (
                        <div key={message} className={styles.warningItem}>
                          {message}
                        </div>
                      ))
                    ) : analysis ? (
                      analysis.warnings.map((warning) => (
                        <div key={warning.code} className={styles.warningItem}>
                          {warning.message}
                        </div>
                      ))
                    ) : (
                      <div className={styles.warningItem}>
                        Validation errors are shown inline and results remain disabled until the
                        mandatory engineering inputs are valid.
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </details>
            </article>
          </div>
        </section>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardLabel}>Saved Results</div>
              <h2 className={styles.cardTitle}>Calculation register</h2>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Section</th>
                    <th>Concrete</th>
                    <th>Steel</th>
                    <th>Governing utilisation</th>
                    <th>Î”Ïƒs</th>
                    <th>Ïƒc,max</th>
                  </tr>
                </thead>
                <tbody>
                  {savedResults.length === 0 ? (
                    <tr>
                      <td colSpan={7}>No saved results yet.</td>
                    </tr>
                  ) : (
                    savedResults.map((row) => (
                      <tr key={row.id}>
                        <td>{row.timestamp}</td>
                        <td>{row.sectionLabel}</td>
                        <td>{row.concreteStatus}</td>
                        <td>{row.steelStatus}</td>
                        <td>{formatNumber(row.governingUtilisation, 3)}</td>
                        <td>{formatNumber(row.deltaSigmaS, 1)} MPa</td>
                        <td>{formatNumber(row.sigmaCMax, 1)} MPa</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function InputSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.formSection}>
      <div>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <p className={styles.sectionHint}>{hint}</p>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  form,
  errors,
  name,
  label,
  symbol,
  unit,
  tooltip,
  assistText,
  readOnly = false,
  onChange,
}: {
  form: FormState;
  errors: Record<string, string>;
  name: string;
  label: string;
  symbol: string;
  unit: string;
  tooltip?: string;
  assistText?: string;
  readOnly?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const error = errors[name];

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        <span className={styles.fieldLabelMain}>
          <span>{label}</span>
          {tooltip ? <InfoTip text={tooltip} /> : null}
        </span>
        <code>{symbol}</code>
      </span>
      <div className={styles.controlWrap}>
        <input
          className={`${styles.input} ${error ? styles.inputError : ""}`}
          name={name}
          value={form[name]}
          onChange={onChange}
          inputMode="decimal"
          readOnly={readOnly}
        />
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      {error ? <span className={styles.errorText}>{error}</span> : null}
      {!error && assistText ? <span className={styles.assistText}>{assistText}</span> : null}
    </label>
  );
}

function SelectField({
  form,
  name,
  label,
  symbol,
  tooltip,
  onChange,
  options,
}: {
  form: FormState;
  name: string;
  label: string;
  symbol: string;
  tooltip?: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        <span className={styles.fieldLabelMain}>
          <span>{label}</span>
          {tooltip ? <InfoTip text={tooltip} /> : null}
        </span>
        <code>{symbol}</code>
      </span>
      <div className={styles.controlWrap}>
        <select className={styles.select} name={name} value={form[name]} onChange={onChange}>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function CheckboxField({
  form,
  name,
  label,
  onChange,
}: {
  form: FormState;
  name: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={styles.checkboxPill}>
      <input
        type="checkbox"
        name={name}
        checked={Boolean(form[name])}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.toggleButton} ${active ? styles.toggleActive : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricTile}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function StatusList({ title, rows }: { title: string; rows: StatusRowItem[] }) {
  return (
    <div>
      <div className={styles.cardLabel}>{title}</div>
      <div className={styles.statusList}>
        {rows.map((row) => (
          <div key={`${row.name}-${row.value}`} className={styles.statusRow}>
            <span className={styles.statusName}>
              {row.name}
              {row.tooltip ? <InfoTip text={row.tooltip} /> : null}
            </span>
            <strong className={styles.statusValue}>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionVisualisation({
  form,
  analysis,
}: {
  form: RcFatigueInput | null;
  analysis: ReturnType<typeof analyzeRcFatigue> | null;
}) {
  const width = form?.b ?? 300;
  const depth = form?.h ?? 600;
  const dt = form?.d_t ?? 540;
  const dc = form?.d_c ?? 60;
  const na = analysis?.section.neutralAxisDepth ?? depth * 0.32;
  const ratio = 260 / Math.max(depth, width * 1.1);
  const rectWidth = width * ratio;
  const rectHeight = depth * ratio;
  const offsetX = 90;
  const offsetY = 36;
  const topSteelY = offsetY + dc * ratio;
  const bottomSteelY = offsetY + dt * ratio;
  const naY = offsetY + na * ratio;
  const centroidY = offsetY + rectHeight / 2;
  const rightX = offsetX + rectWidth;

  return (
    <svg viewBox="0 0 420 360" role="img" aria-label="RC beam cracked section visualisation">
      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 Z" fill="#60728b" />
        </marker>
      </defs>
      <rect x="0" y="0" width="420" height="360" rx="20" fill="rgba(255,255,255,0.34)" />
      <rect
        x={offsetX}
        y={offsetY}
        width={rectWidth}
        height={rectHeight}
        rx="8"
        fill="rgba(42,124,247,0.08)"
        stroke="#274974"
        strokeWidth="2"
      />
      <rect
        x={offsetX}
        y={offsetY}
        width={rectWidth}
        height={Math.max(naY - offsetY, 2)}
        rx="8"
        fill="rgba(42,124,247,0.16)"
      />
      <line
        x1={offsetX - 20}
        y1={naY}
        x2={rightX + 20}
        y2={naY}
        stroke="#12b5cb"
        strokeDasharray="8 6"
        strokeWidth="2.5"
      />
      <line
        x1={offsetX + rectWidth / 2}
        y1={offsetY - 14}
        x2={offsetX + rectWidth / 2}
        y2={offsetY + rectHeight + 14}
        stroke="#6e7f96"
        strokeDasharray="6 6"
      />
      <line
        x1={offsetX - 16}
        y1={centroidY}
        x2={rightX + 16}
        y2={centroidY}
        stroke="#b35b3f"
        strokeDasharray="4 5"
      />
      <circle cx={offsetX + rectWidth / 2} cy={centroidY} r="5" fill="#b35b3f" />
      {Array.from({ length: 4 }).map((_, index) => (
        <circle
          key={`bottom-${index}`}
          cx={offsetX + rectWidth * (0.2 + index * 0.2)}
          cy={bottomSteelY}
          r="8"
          fill="#eb7e3a"
          stroke="#b95f22"
        />
      ))}
      {Array.from({ length: 2 }).map((_, index) => (
        <circle
          key={`top-${index}`}
          cx={offsetX + rectWidth * (0.33 + index * 0.34)}
          cy={topSteelY}
          r="7"
          fill="#eb7e3a"
          stroke="#b95f22"
        />
      ))}
      <path
        d={`M ${offsetX - 40} ${offsetY + 10} C ${offsetX - 14} ${offsetY + 40}, ${offsetX - 14} ${
          offsetY + rectHeight - 40
        }, ${offsetX - 40} ${offsetY + rectHeight - 10}`}
        fill="none"
        stroke="#2a7cf7"
        strokeWidth="3"
      />
      <path
        d={`M ${rightX + 40} ${offsetY + 10} C ${rightX + 14} ${offsetY + 40}, ${rightX + 14} ${
          offsetY + rectHeight - 40
        }, ${rightX + 40} ${offsetY + rectHeight - 10}`}
        fill="none"
        stroke="#12b5cb"
        strokeWidth="3"
      />
      <line x1={54} y1={offsetY} x2={54} y2={offsetY + rectHeight} stroke="#60728b" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <line x1={offsetX} y1={offsetY + rectHeight + 32} x2={rightX} y2={offsetY + rectHeight + 32} stroke="#60728b" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <text x={48} y={offsetY + rectHeight / 2} transform={`rotate(-90 48 ${offsetY + rectHeight / 2})`} fill="#60728b" fontSize="12" fontWeight="700">
        h = {formatNumber(depth, 0)} mm
      </text>
      <text x={offsetX + rectWidth / 2} y={offsetY + rectHeight + 28} textAnchor="middle" fill="#60728b" fontSize="12" fontWeight="700">
        b = {formatNumber(width, 0)} mm
      </text>
      <text x={rightX + 26} y={naY - 8} fill="#0891b2" fontSize="12" fontWeight="700">
        N.A. = {formatNumber(na, 1)} mm
      </text>
      <text x={rightX + 26} y={topSteelY + 4} fill="#b95f22" fontSize="12" fontWeight="700">
        d_c = {formatNumber(dc, 0)} mm
      </text>
      <text x={rightX + 26} y={bottomSteelY + 4} fill="#b95f22" fontSize="12" fontWeight="700">
        d_t = {formatNumber(dt, 0)} mm
      </text>
      <text x={offsetX + rectWidth / 2 + 12} y={centroidY - 10} fill="#8a4d37" fontSize="12" fontWeight="700">
        centroid axis
      </text>
    </svg>
  );
}

function FatiguePlot({
  points,
  appliedPoint,
  xLabel,
  yLabel,
  color,
}: {
  points: Array<{ x: number; y: number }>;
  appliedPoint?: { x: number; y: number };
  xLabel: string;
  yLabel: string;
  color: string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    kind: "curve" | "applied";
  } | null>(null);
  const width = 308;
  const height = 188;
  const padding = { top: 12, right: 14, bottom: 28, left: 38 };
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xMin = Math.min(...xValues, appliedPoint?.x ?? 4, 4);
  const xMax = Math.max(...xValues, appliedPoint?.x ?? 8, 8);
  const yMin = 0;
  const yMax = Math.max(...yValues, appliedPoint?.y ?? 1, 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const projectX = (value: number) =>
    padding.left + ((value - xMin) / Math.max(xMax - xMin, 1e-6)) * innerWidth;
  const projectY = (value: number) =>
    padding.top + innerHeight - ((value - yMin) / Math.max(yMax - yMin, 1e-6)) * innerHeight;

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${projectX(point.x)} ${projectY(point.y)}`)
    .join(" ");

  return (
    <div className={styles.plotFigure}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${yLabel} plot`}
        className={styles.plotSvg}
      >
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#f8fbfe" />
        {Array.from({ length: 5 }).map((_, index) => {
          const y = padding.top + (innerHeight * index) / 4;
          return <line key={`gy-${index}`} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(96,114,139,0.12)" />;
        })}
        {Array.from({ length: 6 }).map((_, index) => {
          const x = padding.left + (innerWidth * index) / 5;
          return <line key={`gx-${index}`} y1={padding.top} y2={height - padding.bottom} x1={x} x2={x} stroke="rgba(96,114,139,0.12)" />;
        })}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} stroke="#7b8aa2" />
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#7b8aa2" />
        {points.length > 1 ? <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" /> : null}
        {points.map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle
              cx={projectX(point.x)}
              cy={projectY(point.y)}
              r="5"
              fill={color}
              fillOpacity="0.16"
              stroke={color}
              strokeWidth="2"
              onMouseEnter={() => setHoveredPoint({ x: point.x, y: point.y, kind: "curve" })}
              onMouseLeave={() => setHoveredPoint((current) => (current?.kind === "curve" ? null : current))}
            />
          </g>
        ))}
        {appliedPoint ? (
          <g>
            <circle
              cx={projectX(appliedPoint.x)}
              cy={projectY(appliedPoint.y)}
              r="6"
              fill="#eb7e3a"
              stroke="#ffffff"
              strokeWidth="2"
              onMouseEnter={() =>
                setHoveredPoint({ x: appliedPoint.x, y: appliedPoint.y, kind: "applied" })
              }
              onMouseLeave={() => setHoveredPoint((current) => (current?.kind === "applied" ? null : current))}
            />
            <circle cx={projectX(appliedPoint.x)} cy={projectY(appliedPoint.y)} r="12" fill="rgba(235,126,58,0.14)" pointerEvents="none" />
          </g>
        ) : null}
        <text x={width / 2} y={height - 8} textAnchor="middle" fill="#60728b" fontSize="11" fontWeight="700">
          {xLabel}
        </text>
        <text x="15" y={height / 2} transform={`rotate(-90 15 ${height / 2})`} textAnchor="middle" fill="#60728b" fontSize="11" fontWeight="700">
          {yLabel}
        </text>
      </svg>
      <div className={styles.plotReadout}>
        {hoveredPoint ? (
          <span>
            <strong>{hoveredPoint.kind === "applied" ? "Applied point" : "Curve point"}:</strong>{" "}
            {xLabel} = {formatNumber(hoveredPoint.x, 3)}, {yLabel} = {formatNumber(hoveredPoint.y, 3)}
          </span>
        ) : (
          <span>Hover over a plotted point to inspect the current {xLabel} and {yLabel} values.</span>
        )}
      </div>
    </div>
  );
}

function parseFormState(form: FormState, variableRows: VariableAmplitudeRowInput[]) {
  const errors: Record<string, string> = {};
  const includeVariableAmplitude = Boolean(form.includeVariableAmplitude);

  const b = parsePositive(form, "b", errors);
  const h = parsePositive(form, "h", errors);
  const d_t = parsePositive(form, "d_t", errors);
  const d_c = parsePositive(form, "d_c", errors);
  const e_c = parsePositive(form, "e_c", errors);
  const e_s = parsePositive(form, "e_s", errors);
  const f_c = parsePositive(form, "f_c", errors);
  const f_y = parsePositive(form, "f_y", errors);
  const phi_c_fat = parsePositive(form, "phi_c_fat", errors);
  const phi_s_fat = parsePositive(form, "phi_s_fat", errors);
  const db_t = parsePositive(form, "db_t", errors);
  const db_c = parsePositive(form, "db_c", errors);
  const tensionBarCount = parsePositive(form, "tensionBarCount", errors);
  const compressionBarCount = parsePositive(form, "compressionBarCount", errors);
  const a_st =
    db_t !== null && tensionBarCount !== null
      ? calculateBarArea(db_t, tensionBarCount)
      : null;
  const a_sc =
    db_c !== null && compressionBarCount !== null
      ? calculateBarArea(db_c, compressionBarCount)
      : null;
  const mandrelDiameter = parseOptionalPositive(form, "mandrelDiameter", errors);
  const mMaxKnM = parseNumber(form, "mMaxKnM", errors, { allowNegative: true });
  const mMinKnM = parseNumber(form, "mMinKnM", errors, { allowNegative: true });
  const n_sc = parsePositive(form, "n_sc", errors);
  const t0 = parsePositive(form, "t0", errors);

  if (b !== null && h !== null && b > 5000) {
    errors.b = "Section width looks out of range for this beam-focused tool.";
  }

  if (h !== null && h > 5000) {
    errors.h = "Section depth looks out of range for this beam-focused tool.";
  }

  if (d_t !== null && h !== null && d_t >= h) {
    errors.d_t = "Tension steel depth must be less than the total depth.";
  }

  if (d_c !== null && h !== null && d_c >= h) {
    errors.d_c = "Compression steel depth must be less than the total depth.";
  }

  if (mMaxKnM !== null && mMinKnM !== null && mMaxKnM < mMinKnM) {
    errors.mMaxKnM = "Mmax should be greater than or equal to Mmin.";
  }

  const summaryErrors = Object.values(errors);

  if (summaryErrors.length > 0) {
    return { values: null, errors, summaryErrors };
  }

  const values: RcFatigueInput = {
    b: b!,
    h: h!,
    d_t: d_t!,
    d_c: d_c!,
    e_c: e_c!,
    e_s: e_s!,
    f_c: f_c!,
    f_y: f_y!,
    phi_c_fat: phi_c_fat!,
    phi_s_fat: phi_s_fat!,
    a_st: a_st!,
    a_sc: a_sc!,
    db_t: db_t!,
    db_c: db_c ?? undefined,
    steelCategory: form.steelCategory as RcFatigueInput["steelCategory"],
    mandrelDiameter: mandrelDiameter ?? undefined,
    marineEnvironment: Boolean(form.marineEnvironment),
    weldedDetail: Boolean(form.weldedDetail),
    mMaxKnM: mMaxKnM!,
    mMinKnM: mMinKnM!,
    n_sc: n_sc!,
    variableAmplitudeRows: includeVariableAmplitude ? variableRows : [],
    t0: t0!,
    strengthGainType: form.strengthGainType as StrengthGainType,
    etaCMode: form.etaCMode as EtaCMode,
  };

  return { values, errors, summaryErrors };
}

function parsePositive(
  form: FormState,
  name: string,
  errors: Record<string, string>,
) {
  const value = parseNumber(form, name, errors, { allowNegative: false });
  if (value === null) {
    return null;
  }

  if (value <= 0) {
    errors[name] = "Value must be greater than zero.";
    return null;
  }

  return value;
}

function parseOptionalPositive(
  form: FormState,
  name: string,
  errors: Record<string, string>,
) {
  if (!form[name].trim()) {
    return null;
  }

  return parsePositive(form, name, errors);
}

function parseNumber(
  form: FormState,
  name: string,
  errors: Record<string, string>,
  options: { allowNegative: boolean },
) {
  const raw = form[name]?.trim();
  if (!raw) {
    errors[name] = "This field is required.";
    return null;
  }

  const numericPattern = options.allowNegative
    ? /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i
    : /^(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

  if (!numericPattern.test(raw)) {
    errors[name] = "Enter a valid numeric value.";
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors[name] = "Enter a valid numeric value.";
    return null;
  }

  if (!options.allowNegative && value < 0) {
    errors[name] = "Negative values are not valid here.";
    return null;
  }

  return value;
}

function getGoverningResult(analysis: ReturnType<typeof analyzeRcFatigue>) {
  const concreteValue = analysis.concrete.utilisation;
  const steelValue = analysis.steel.utilisation;

  if (concreteValue >= steelValue) {
    return {
      label: "Concrete fatigue utilisation",
      value: concreteValue,
      pass: analysis.concrete.status === "pass",
    };
  }

  return {
    label: "Steel fatigue utilisation",
    value: steelValue,
    pass: analysis.steel.pass,
  };
}

function formatNumber(value: number, digits: number) {
  if (!Number.isFinite(value)) {
    return "â€”";
  }

  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatScientific(value: number) {
  if (!Number.isFinite(value)) {
    return "â€”";
  }

  return value.toExponential(2);
}

function calculateBarArea(diameter: number, count: number) {
  return count * Math.PI * diameter ** 2 * 0.25;
}

function getAutoAreaSummary(form: FormState) {
  const tensionCount = Number.parseFloat(form.tensionBarCount || "0");
  const compressionCount = Number.parseFloat(form.compressionBarCount || "0");
  const tensionDia = Number.parseFloat(form.db_t || "0");
  const compressionDia = Number.parseFloat(form.db_c || "0");

  return {
    tensionArea:
      Number.isFinite(tensionCount) && Number.isFinite(tensionDia)
        ? calculateBarArea(tensionDia, tensionCount)
        : 0,
    compressionArea:
      Number.isFinite(compressionCount) && Number.isFinite(compressionDia)
        ? calculateBarArea(compressionDia, compressionCount)
        : 0,
  };
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className={styles.tooltip} data-tip={text} tabIndex={0} aria-label={text}>
      ?
    </span>
  );
}

function loadSavedResults() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as SavedResultRow[];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

