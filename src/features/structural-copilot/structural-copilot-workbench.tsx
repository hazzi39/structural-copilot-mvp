"use client";

import { useState } from "react";

import type {
  ResultRow,
  StructuralCopilotErrorResponse,
  StructuralCopilotResponse,
} from "@/types/structural";
import styles from "./structural-copilot-workbench.module.css";

const examplePrompt =
  "Find an optimal section size and reinforcement for a reinforced concrete beam. The section must span 5 metres and is fixed at both ends supporting a 10 kN/m applied load. Check moment capacity and shear capacity. Provide an alternative steel section.";

export function StructuralCopilotWorkbench() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const [result, setResult] = useState<StructuralCopilotResponse | null>(null);
  const [error, setError] = useState<StructuralCopilotErrorResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data =
        (await response.json()) as
          | StructuralCopilotResponse
          | StructuralCopilotErrorResponse;

      if (!response.ok) {
        setResult(null);
        setError(data as StructuralCopilotErrorResponse);
        return;
      }

      setResult(data as StructuralCopilotResponse);
    } catch {
      setResult(null);
      setError({
        error: "The request could not be completed. Check the local server and try again.",
        code: "INTERNAL_ERROR",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleUseExample() {
    setPrompt(examplePrompt);
  }

  return (
    <section className={styles.workbench}>
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.panelHeader}>
            <h2>Input</h2>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleUseExample}
            >
              Load example
            </button>
          </div>

          <label className={styles.promptField}>
            Prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={7}
              placeholder="Describe the structural engineering task to run."
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Running structural workflow..." : "Run structural workflow"}
            </button>
          </div>
        </form>

        <div className={styles.resultsPane}>
          <div className={styles.panelHeader}>
            <h2>Output</h2>
          </div>
          {error ? <ErrorState error={error} /> : null}
          {result ? <ResultView result={result} /> : null}
          {!error && !result ? <EmptyState /> : null}
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <h3>No result yet</h3>
    </div>
  );
}

function ErrorState({ error }: { error: StructuralCopilotErrorResponse }) {
  return (
    <article className={styles.errorCard}>
      <span className={styles.errorBadge}>{error.code}</span>
      <h3>Request rejected</h3>
      <p>{error.error}</p>
      {error.details?.length ? (
        <ul className={styles.list}>
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ResultView({ result }: { result: StructuralCopilotResponse }) {
  const maxValue = Math.max(...result.visualisations.items.map((item) => item.y), 1);

  return (
    <div className={styles.resultStack}>
      <article className={styles.resultCard}>
        <span className={styles.workflowBadge}>{result.workflowId}</span>
        <h3>Problem summary</h3>
        <p>{result.summary}</p>
      </article>

      <section className={styles.splitGrid}>
        <article className={styles.resultCard}>
          <h3>Parsed inputs</h3>
          <div className={styles.metricGrid}>
            {result.parsedInputs.map((input) => (
              <div className={styles.metricCard} key={`${input.label}-${input.value}`}>
                <span>{input.label}</span>
                <strong>{input.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.resultCard}>
          <h3>Assumptions</h3>
          <ul className={styles.list}>
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </article>

        <article className={styles.resultCard}>
          <h3>Key outputs</h3>
          <div className={styles.summaryGrid}>
            {result.keyOutputs.map((output) => (
              <div
                className={styles.summaryCard}
                key={`${output.label}-${output.value}`}
                data-status={getRowStatus(output)}
              >
                <span>{output.label}</span>
                <strong>
                  {formatRowValue(output)}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      {result.designOutputs.length ? (
        <section className={styles.resultCard}>
          <h3>Engineering results</h3>
          <div className={styles.designOutputStack}>
            {result.designOutputs.map((group) => (
              <div className={styles.designOutputGroup} key={group.title}>
                <h4>{group.title}</h4>
                <div className={styles.designOutputTable} role="table" aria-label={group.title}>
                  <div className={styles.designOutputHeader} role="row">
                    <span>Parameter</span>
                    <span>Value</span>
                    <span>Status</span>
                  </div>
                  {group.items.map((item) => {
                    const status = getRowStatus(item);

                    return (
                      <div
                        className={styles.designOutputRow}
                        key={`${group.title}-${item.label}-${item.value}`}
                        data-status={status}
                        role="row"
                      >
                        <span>{item.label}</span>
                        <strong>{formatRowValue(item)}</strong>
                        <em className={styles.statusBadge} data-status={status}>
                          {formatStatusLabel(status)}
                        </em>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {result.comparisonTables.length ? (
        <section className={styles.resultCard}>
          <h3>Option comparison</h3>
          <div className={styles.comparisonStack}>
            {result.comparisonTables.map((table) => (
              <article className={styles.comparisonCard} key={table.title}>
                <h4>{table.title}</h4>
                <div className={styles.comparisonScroll}>
                  <table className={styles.comparisonTable}>
                    <thead>
                      <tr>
                        {table.columns.map((column) => (
                          <th
                            key={column.key}
                            className={styles[`align${capitalize(column.align ?? "left")}`]}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr key={row.id} data-status={row.status ?? "feasible"}>
                          {table.columns.map((column) => (
                            <td
                              key={`${row.id}-${column.key}`}
                              className={styles[`align${capitalize(column.align ?? "left")}`]}
                            >
                              {column.key === "status" ? (
                                <span
                                  className={styles.tableStatusBadge}
                                  data-status={row.status ?? "feasible"}
                                >
                                  {row.values[column.key]}
                                </span>
                              ) : (
                                row.values[column.key]
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.splitGrid}>
        <article className={styles.resultCard}>
          <h3>Recommended option</h3>
          <p>{result.recommendedOption}</p>
          <h4>Engineering commentary</h4>
          <ul className={styles.list}>
            {result.commentary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className={styles.resultCard}>
          <h3>Alternative options</h3>
          {result.alternatives.length ? (
            <ul className={styles.list}>
              {result.alternatives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No alternatives were requested for this run.</p>
          )}
          <h4>Warnings</h4>
          <ul className={styles.list}>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      </section>

      <article className={styles.resultCard}>
        <h3>Visualisations</h3>
        <ResultVisualisations result={result} maxValue={maxValue} />
      </article>

      <article className={styles.disclaimerCard}>
        <h3>Engineer review disclaimer</h3>
        <p>{result.engineerReviewDisclaimer}</p>
      </article>
    </div>
  );
}

function ResultVisualisations({
  result,
  maxValue,
}: {
  result: StructuralCopilotResponse;
  maxValue: number;
}) {
  if (result.workflowId === "rc_beam_design") {
    return <RcVisualisations result={result} maxValue={maxValue} />;
  }

  if (result.workflowId === "timber_member_design") {
    return <TimberVisualisations result={result} maxValue={maxValue} />;
  }

  if (result.workflowId === "section_property_analysis") {
    return <SectionPropertyVisualisations result={result} maxValue={maxValue} />;
  }

  return <GenericVisualisation result={result} maxValue={maxValue} />;
}

function RcVisualisations({
  result,
  maxValue,
}: {
  result: StructuralCopilotResponse;
  maxValue: number;
}) {
  const momentPair = getDemandCapacityPair(result, "Moment verification");
  const shearPair = getDemandCapacityPair(result, "Shear verification");
  const sectionSize = getGroupValue(result, "Selected RC design", "Section size");
  const mainReo = getGroupValue(result, "Selected RC design", "Main reinforcement");
  const ligatures = getGroupValue(result, "Selected RC design", "Ligatures");

  return (
    <div className={styles.visualStack}>
      <div className={styles.visualGrid}>
        {momentPair ? (
          <CapacityPanel
            title="Moment demand vs capacity"
            demandLabel="Mu"
            demandValue={momentPair.demand}
            capacityLabel="phiMn"
            capacityValue={momentPair.capacity}
            unit="kN.m"
          />
        ) : null}
        {shearPair ? (
          <CapacityPanel
            title="Shear demand vs capacity"
            demandLabel="Vu"
            demandValue={shearPair.demand}
            capacityLabel="phiVu"
            capacityValue={shearPair.capacity}
            unit="kN"
          />
        ) : null}
      </div>

      <div className={styles.visualGrid}>
        <article className={styles.diagramCard}>
          <h4>RC section sketch</h4>
          <div className={styles.sectionSketch}>
            <div className={styles.sectionFrame}>
              <div className={styles.rebarRow}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className={styles.stirrupFrame} />
              <div className={styles.rebarRowBottom}>
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className={styles.diagramMeta}>
            <div>
              <span>Section</span>
              <strong>{sectionSize ?? "Not reported"}</strong>
            </div>
            <div>
              <span>Main bars</span>
              <strong>{mainReo ?? "Not reported"}</strong>
            </div>
            <div>
              <span>Ligatures</span>
              <strong>{ligatures ?? "Not reported"}</strong>
            </div>
          </div>
        </article>

        <article className={styles.diagramCard}>
          <h4>{result.visualisations.title}</h4>
          <GenericVisualisation result={result} maxValue={maxValue} compact />
        </article>
      </div>
    </div>
  );
}

function TimberVisualisations({
  result,
  maxValue,
}: {
  result: StructuralCopilotResponse;
  maxValue: number;
}) {
  const bendingPair = getGroupPair(
    result,
    "Timber capacity tool",
    "Bending demand Mx",
    "Bending capacity phiMx",
  );
  const shearPair = getGroupPair(
    result,
    "Timber capacity tool",
    "Shear demand",
    "Shear capacity phiV",
  );

  return (
    <div className={styles.visualStack}>
      <div className={styles.visualGrid}>
        {bendingPair ? (
          <CapacityPanel
            title="Timber bending check"
            demandLabel="Mx"
            demandValue={bendingPair.left}
            capacityLabel="phiMx"
            capacityValue={bendingPair.right}
            unit="kNm"
          />
        ) : null}
        {shearPair ? (
          <CapacityPanel
            title="Timber shear check"
            demandLabel="V"
            demandValue={shearPair.left}
            capacityLabel="phiV"
            capacityValue={shearPair.right}
            unit="kN"
          />
        ) : null}
      </div>
      <article className={styles.diagramCard}>
        <h4>{result.visualisations.title}</h4>
        <GenericVisualisation result={result} maxValue={maxValue} compact />
      </article>
    </div>
  );
}

function SectionPropertyVisualisations({
  result,
  maxValue,
}: {
  result: StructuralCopilotResponse;
  maxValue: number;
}) {
  const width = getParsedNumeric(result, "Width");
  const height = getParsedNumeric(result, "Height");
  const radius = getParsedNumeric(result, "Radius");
  const centroidX = getGroupNumeric(
    result,
    "Primary section properties",
    "Centroid X-coordinate",
  );
  const centroidY = getGroupNumeric(
    result,
    "Primary section properties",
    "Centroid Y-coordinate",
  );

  return (
    <div className={styles.visualStack}>
      <div className={styles.visualGrid}>
        <article className={styles.diagramCard}>
          <h4>Section geometry</h4>
          <div className={styles.sectionPropertySketch}>
            {radius ? (
              <div className={styles.circleSketch}>
                <div className={styles.centroidDot} />
              </div>
            ) : (
              <div className={styles.rectSketch}>
                <div className={styles.centroidDot} />
              </div>
            )}
          </div>
          <div className={styles.diagramMeta}>
            {width && height ? (
              <div>
                <span>Dimensions</span>
                <strong>
                  {width.toFixed(0)} x {height.toFixed(0)} mm
                </strong>
              </div>
            ) : null}
            {radius ? (
              <div>
                <span>Radius</span>
                <strong>{radius.toFixed(0)} mm</strong>
              </div>
            ) : null}
            {centroidX !== undefined && centroidY !== undefined ? (
              <div>
                <span>Centroid</span>
                <strong>
                  x={centroidX.toFixed(2)} mm, y={centroidY.toFixed(2)} mm
                </strong>
              </div>
            ) : null}
          </div>
        </article>

        <article className={styles.diagramCard}>
          <h4>{result.visualisations.title}</h4>
          <GenericVisualisation result={result} maxValue={maxValue} compact />
        </article>
      </div>
    </div>
  );
}

function GenericVisualisation({
  result,
  maxValue,
  compact = false,
}: {
  result: StructuralCopilotResponse;
  maxValue: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.compactChart : styles.chart}>
      {result.visualisations.items.map((item) => (
        <div className={styles.chartRow} key={`${item.x}-${item.y}`}>
          <div className={styles.chartLabel}>
            <span>{item.x}</span>
            {item.label ? <em>{item.label}</em> : null}
          </div>
          <div className={styles.chartTrack}>
            <div
              className={styles.chartBar}
              style={{ width: `${Math.max((item.y / maxValue) * 100, 6)}%` }}
            />
          </div>
          <strong>{item.y.toFixed(0)}</strong>
        </div>
      ))}
    </div>
  );
}

function CapacityPanel({
  title,
  demandLabel,
  demandValue,
  capacityLabel,
  capacityValue,
  unit,
}: {
  title: string;
  demandLabel: string;
  demandValue: number;
  capacityLabel: string;
  capacityValue: number;
  unit: string;
}) {
  const ratio = capacityValue > 0 ? demandValue / capacityValue : 0;
  const demandWidth = capacityValue > 0 ? Math.min((demandValue / capacityValue) * 100, 100) : 0;

  return (
    <article className={styles.diagramCard}>
      <h4>{title}</h4>
      <div className={styles.capacityPanel}>
        <div className={styles.capacityMeta}>
          <div>
            <span>{demandLabel}</span>
            <strong>
              {demandValue.toFixed(2)} {unit}
            </strong>
          </div>
          <div>
            <span>{capacityLabel}</span>
            <strong>
              {capacityValue.toFixed(2)} {unit}
            </strong>
          </div>
          <div>
            <span>Utilization</span>
            <strong>{ratio.toFixed(3)}</strong>
          </div>
        </div>
        <div className={styles.capacityGauge}>
          <div className={styles.capacityGaugeBase} />
          <div className={styles.capacityGaugeFill} style={{ width: `${Math.max(demandWidth, 4)}%` }} />
        </div>
        <div className={styles.capacityScale}>
          <span>0</span>
          <span>{capacityValue.toFixed(0)} {unit}</span>
        </div>
      </div>
    </article>
  );
}

function formatRowValue(item: ResultRow) {
  return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
}

function getRowStatus(item: ResultRow): "pass" | "warn" | "info" {
  const label = item.label.toLowerCase();
  const numericValue = Number(item.value);

  if (
    !Number.isNaN(numericValue) &&
    (label.includes("utilization") || label.includes("unity ratio"))
  ) {
    return numericValue <= 1 ? "pass" : "warn";
  }

  if (label.includes("demand / capacity")) {
    const parts = item.value.split("/").map((part) => Number(part.trim()));
    if (parts.length === 2 && parts.every((part) => !Number.isNaN(part))) {
      return parts[0] <= parts[1] ? "pass" : "warn";
    }
  }

  if (
    item.value.toLowerCase().includes("pass") ||
    item.value.toLowerCase().includes("ok")
  ) {
    return "pass";
  }

  if (
    item.value.toLowerCase().includes("fail") ||
    item.value.toLowerCase().includes("ng")
  ) {
    return "warn";
  }

  return "info";
}

function formatStatusLabel(status: "pass" | "warn" | "info") {
  if (status === "pass") return "Pass";
  if (status === "warn") return "Check";
  return "Reported";
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getGroup(
  result: StructuralCopilotResponse,
  title: string,
) {
  return result.designOutputs.find((group) => group.title === title);
}

function getGroupValue(
  result: StructuralCopilotResponse,
  title: string,
  label: string,
) {
  return getGroup(result, title)?.items.find((item) => item.label === label)?.value;
}

function getGroupNumeric(
  result: StructuralCopilotResponse,
  title: string,
  label: string,
) {
  const raw = getGroupValue(result, title, label);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getParsedNumeric(result: StructuralCopilotResponse, label: string) {
  const raw = result.parsedInputs.find((item) => item.label === label)?.value;
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getDemandCapacityPair(
  result: StructuralCopilotResponse,
  title: string,
) {
  const group = getGroup(result, title);
  if (!group) return undefined;
  const demandRow = group.items.find((item) => item.label.toLowerCase().includes("demand"));
  const capacityRow = group.items.find((item) => item.label.toLowerCase().includes("capacity"));
  if (!demandRow || !capacityRow) return undefined;
  const demand = Number(demandRow.value);
  const capacity = Number(capacityRow.value);
  if (Number.isNaN(demand) || Number.isNaN(capacity)) return undefined;
  return { demand, capacity };
}

function getGroupPair(
  result: StructuralCopilotResponse,
  title: string,
  leftLabel: string,
  rightLabel: string,
) {
  const group = getGroup(result, title);
  if (!group) return undefined;
  const left = Number(group.items.find((item) => item.label === leftLabel)?.value);
  const right = Number(group.items.find((item) => item.label === rightLabel)?.value);
  if (Number.isNaN(left) || Number.isNaN(right)) return undefined;
  return { left, right };
}
