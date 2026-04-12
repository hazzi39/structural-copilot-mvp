"use client";

import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import type {
  ComparisonColumn,
  ComparisonRow,
  ResultRow,
  StructuralCopilotErrorResponse,
  StructuralCopilotResponse,
} from "@/types/structural";

const examplePrompt =
  "Find an optimal section size and reinforcement for a reinforced concrete beam. The section must span 5 metres and is fixed at both ends supporting a 10 kN/m applied load. Check moment capacity and shear capacity. Provide an alternative steel section.";

const surfaceClass =
  "rounded-[28px] border border-white/80 bg-white/78 shadow-[0_20px_60px_rgba(21,44,59,0.08),0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-xl";
const innerCardClass =
  "rounded-[24px] border border-slate-200/80 bg-white/88 shadow-[0_14px_28px_rgba(16,32,51,0.06)]";

interface RecentRun {
  id: string;
  workflowId: StructuralCopilotResponse["workflowId"];
  prompt: string;
  recommendedOption: string;
  summary: string;
  timestampLabel: string;
}

export function StructuralCopilotWorkbench() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const deferredPrompt = useDeferredValue(prompt);
  const [result, setResult] = useState<StructuralCopilotResponse | null>(null);
  const [error, setError] = useState<StructuralCopilotErrorResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  const promptMeta = useMemo(() => {
    const trimmed = deferredPrompt.trim();
    if (!trimmed) {
      return { characters: 0, words: 0, lines: 0 };
    }

    return {
      characters: trimmed.length,
      words: trimmed.split(/\s+/).length,
      lines: trimmed.split(/\n+/).length,
    };
  }, [deferredPrompt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data =
        (await response.json()) as
          | StructuralCopilotResponse
          | StructuralCopilotErrorResponse;

      if (!response.ok) {
        startTransition(() => {
          setResult(null);
          setError(data as StructuralCopilotErrorResponse);
        });
        return;
      }

      const structuredResult = data as StructuralCopilotResponse;
      startTransition(() => {
        setResult(structuredResult);
        setRecentRuns((current) => [
          {
            id: `${structuredResult.workflowId}-${Date.now()}`,
            workflowId: structuredResult.workflowId,
            prompt,
            recommendedOption: structuredResult.recommendedOption,
            summary: structuredResult.summary,
            timestampLabel: new Intl.DateTimeFormat("en-AU", {
              hour: "numeric",
              minute: "2-digit",
              day: "numeric",
              month: "short",
            }).format(new Date()),
          },
          ...current,
        ].slice(0, 6));
      });
    } catch {
      startTransition(() => {
        setResult(null);
        setError({
          error:
            "The request could not be completed. Check the local server and try again.",
          code: "INTERNAL_ERROR",
        });
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)] lg:items-start">
        <form className={`${surfaceClass} overflow-hidden`} onSubmit={handleSubmit}>
          <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(235,245,246,0.68))] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700/80">
                  Structural Copilot
                </p>
                <h1 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950 sm:text-[1.55rem]">
                  Premium engineering calculator workspace
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Natural-language input, constrained workflow routing, and structured engineering outputs in one calm work surface.
                </p>
              </div>

              <button
                className="inline-flex shrink-0 rounded-full border border-teal-200 bg-white/90 px-3 py-2 text-xs font-semibold text-teal-800 transition duration-200 hover:border-teal-300 hover:bg-teal-50"
                type="button"
                onClick={() => setPrompt(examplePrompt)}
              >
                Load example
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-5">
            <article className={`${innerCardClass} overflow-hidden`}>
              <div className="border-b border-slate-200/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Main calculator card
                </p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">
                  Structural engineering prompt
                </h2>
              </div>

              <div className="grid gap-3 p-4">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prompt
                  </span>
                  <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(250,252,252,0.95),rgba(244,248,249,0.92))] shadow-inner">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-50" />
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={11}
                      placeholder="Describe the structural engineering task to run."
                      className="relative min-h-[280px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                </label>

                <div className="grid gap-2 sm:grid-cols-3">
                  <MiniMetaCard label="Characters" value={promptMeta.characters.toString()} />
                  <MiniMetaCard label="Words" value={promptMeta.words.toString()} />
                  <MiniMetaCard label="Lines" value={promptMeta.lines.toString()} />
                </div>
              </div>
            </article>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_55%,#10b981_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,118,110,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_rgba(15,118,110,0.34)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Running structural workflow..." : "Run structural workflow"}
              </button>

              <div className="rounded-full border border-teal-100 bg-teal-50/80 px-4 py-3 text-center text-xs font-medium text-teal-800 sm:text-left">
                Prompt-only input. Tools, reasoning, and guarded routing stay private.
              </div>
            </div>
          </div>
        </form>

        <div className="grid gap-4">
          <HeroResultCard result={result} error={error} />
          <TopVisualCard result={result} />
        </div>
      </div>

      <div className={`${surfaceClass} overflow-hidden`}>
        <div className="border-b border-slate-200/80 bg-white/65 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Output
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Engineering results
              </h2>
            </div>
            {result ? (
              <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                {result.workflowId.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5">
          {error ? <ErrorState error={error} /> : null}
          {!error && result ? <ResultView result={result} recentRuns={recentRuns} /> : null}
          {!error && !result ? <EmptyState recentRuns={recentRuns} /> : null}
        </div>
      </div>
    </section>
  );
}

function HeroResultCard({
  result,
  error,
}: {
  result: StructuralCopilotResponse | null;
  error: StructuralCopilotErrorResponse | null;
}) {
  if (error) {
    return (
      <article className="rounded-[28px] border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,241,242,0.96))] p-5 shadow-[0_22px_50px_rgba(136,19,55,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-700">
          Validation state
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-rose-950">
          Request rejected before tool execution
        </h3>
        <p className="mt-3 text-sm leading-6 text-rose-900">{error.error}</p>
        <div className="mt-4 flex items-center gap-2">
          <StatusPill status="warn" label={error.code.replaceAll("_", " ")} />
        </div>
      </article>
    );
  }

  if (!result) {
    return (
      <article className="rounded-[28px] border border-white/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.94),rgba(241,248,249,0.9))] p-5 shadow-[0_24px_56px_rgba(26,54,73,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700/80">
          Highlighted summary card
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          No active engineering result
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Submit a structural prompt to populate the premium result card, visual checks, compact design properties, and recent-run register.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetricTile label="Workflow" value="Awaiting run" accent="teal" />
          <SummaryMetricTile label="Output state" value="Ready" accent="slate" />
          <SummaryMetricTile label="Guard layer" value="Active" accent="teal" />
        </div>
      </article>
    );
  }

  const headlineOutputs = result.keyOutputs.slice(0, 4);

  return (
      <article className="relative overflow-hidden rounded-[28px] border border-teal-100/90 bg-[linear-gradient(155deg,rgba(255,255,255,0.96),rgba(228,245,243,0.94)_58%,rgba(239,248,245,0.98)_100%)] p-5 shadow-[0_30px_70px_rgba(15,118,110,0.12)]">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(rgba(13,148,136,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(13,148,136,0.04)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
              Highlighted summary card
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {result.recommendedOption}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-3 shadow-[0_12px_26px_rgba(15,118,110,0.1)]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Workflow
            </span>
            <strong className="mt-1 block text-sm font-semibold text-slate-950">
              {result.workflowId.replaceAll("_", " ")}
            </strong>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {headlineOutputs.map((output, index) => (
            <SummaryMetricTile
              key={`${output.label}-${output.value}`}
              label={output.label}
              value={formatRowValue(output)}
              accent={index < 2 ? "teal" : "slate"}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function TopVisualCard({ result }: { result: StructuralCopilotResponse | null }) {
  if (!result) {
    return (
      <article className={`${surfaceClass} overflow-hidden p-4 sm:p-5`}>
        <div className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Live diagram card
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Visualisation preview
          </h3>
          <div className="mt-4 grid min-h-56 place-items-center rounded-[24px] border border-slate-200 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:24px_24px]">
            <div className="grid gap-3 text-center">
              <div className="mx-auto h-20 w-20 rounded-[24px] border border-teal-200 bg-[radial-gradient(circle_at_30%_30%,rgba(20,184,166,0.2),rgba(255,255,255,0.95))]" />
              <p className="text-sm text-slate-500">
                Demand-capacity charts and section sketches will render here after a run.
              </p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`${surfaceClass} overflow-hidden p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Live diagram card
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            {result.visualisations.title}
          </h3>
        </div>
        <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          visual checks
        </span>
      </div>

      <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(243,249,249,0.9))] p-4">
        <ResultVisualisations
          result={result}
          maxValue={Math.max(...result.visualisations.items.map((item) => item.y), 1)}
        />
      </div>
    </article>
  );
}

function EmptyState({ recentRuns }: { recentRuns: RecentRun[] }) {
  return (
    <div className="grid gap-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,250,0.92))] p-6 text-center">
        <div className="mx-auto grid max-w-xl gap-4">
          <div className="mx-auto h-16 w-16 rounded-[22px] border border-teal-200 bg-[radial-gradient(circle_at_30%_30%,rgba(20,184,166,0.2),rgba(255,255,255,0.95))]" />
          <div>
            <p className="text-sm font-semibold text-slate-950">Ready for the next calculation</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Results will appear as a highlighted recommendation card, compact property summaries, engineering tables, and a recent-run register.
            </p>
          </div>
        </div>
      </article>
      <SavedResultsTable recentRuns={recentRuns} />
    </div>
  );
}

function ErrorState({ error }: { error: StructuralCopilotErrorResponse }) {
  return (
    <article className="rounded-[24px] border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,241,242,0.96))] p-5 shadow-[0_20px_44px_rgba(190,24,93,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
            Validation state
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-rose-950">
            Request rejected
          </h3>
        </div>
        <StatusPill status="warn" label={error.code.replaceAll("_", " ")} />
      </div>
      <p className="mt-3 text-sm leading-6 text-rose-900">{error.error}</p>
      {error.details?.length ? (
        <ul className="mt-4 grid gap-2 pl-4 text-sm text-rose-900">
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ResultView({
  result,
  recentRuns,
}: {
  result: StructuralCopilotResponse;
  recentRuns: RecentRun[];
}) {
  const supportingOutputs = result.keyOutputs.slice(4);

  return (
    <div className="grid gap-4">
      {supportingOutputs.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {supportingOutputs.map((output, index) => (
            <SummaryMetricTile
              key={`${output.label}-${output.value}`}
              label={output.label}
              value={formatRowValue(output)}
              accent={index % 3 === 0 ? "teal" : "slate"}
              compact
            />
          ))}
        </section>
      ) : null}

      <CollapsibleSection
        title="Engineering results"
        subtitle="Primary tool outputs and normalized design properties"
        defaultOpen={true}
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {result.designOutputs.map((group) => (
            <article key={group.title} className={`${innerCardClass} overflow-hidden`}>
              <div className="border-b border-slate-200/70 bg-slate-50/70 px-4 py-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
                  {group.title}
                </h4>
              </div>
              <div className="grid gap-2 p-4">
                {group.items.map((item) => {
                  const status = getRowStatus(item);
                  return (
                    <div
                      key={`${group.title}-${item.label}-${item.value}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2.5 transition duration-200 hover:border-teal-100 hover:bg-white"
                    >
                      <span className="text-xs text-slate-500">{item.label}</span>
                      <strong className="text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatRowValue(item)}
                      </strong>
                      <StatusPill status={status} label={formatStatusLabel(status)} />
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Option comparison"
        subtitle="Candidate sizing, alternatives, and cross-tool comparison"
        defaultOpen={true}
      >
        {result.comparisonTables.length ? (
          <div className="grid gap-3">
            {result.comparisonTables.map((table) => (
              <ComparisonTableView
                key={table.title}
                title={table.title}
                columns={table.columns}
                rows={table.rows}
              />
            ))}
          </div>
        ) : (
          <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">
              This workflow did not return comparison rows, so only the primary recommendation is shown.
            </p>
          </article>
        )}
      </CollapsibleSection>

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <CollapsibleSection
          title="Engineering commentary"
          subtitle="Parsed inputs, assumptions, and rationale"
          defaultOpen={false}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <article className={`${innerCardClass} p-4`}>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
                Parsed inputs
              </h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.parsedInputs.map((input) => (
                  <InfoStat key={`${input.label}-${input.value}`} label={input.label} value={input.value} />
                ))}
              </div>
            </article>

            <article className={`${innerCardClass} p-4`}>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
                Commentary
              </h4>
              <ul className="mt-3 grid gap-2 pl-4 text-sm leading-6 text-slate-600">
                {result.commentary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className={`${innerCardClass} p-4 sm:col-span-2`}>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
                Assumptions
              </h4>
              <ul className="mt-3 grid gap-2 pl-4 text-sm leading-6 text-slate-600">
                {result.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </article>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Supporting cards"
          subtitle="Alternatives, warnings, and review controls"
          defaultOpen={false}
        >
          <div className="grid gap-3">
            <SupportCard title="Alternatives">
              {result.alternatives.length ? (
                <ul className="grid gap-2 pl-4 text-sm leading-6 text-slate-600">
                  {result.alternatives.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  No alternatives were returned for this run.
                </p>
              )}
            </SupportCard>

            <SupportCard title="Warnings">
              <ul className="grid gap-2 pl-4 text-sm leading-6 text-slate-600">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </SupportCard>

            <SupportCard title="Engineer review disclaimer">
              <p className="text-sm leading-6 text-slate-600">
                {result.engineerReviewDisclaimer}
              </p>
            </SupportCard>
          </div>
        </CollapsibleSection>
      </div>

      <SavedResultsTable recentRuns={recentRuns} />
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,249,250,0.92))] shadow-[0_12px_28px_rgba(16,32,51,0.05)]"
      open={defaultOpen}
    >
      <summary className="list-none cursor-pointer px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition duration-200 group-open:rotate-180 group-open:border-teal-200 group-open:text-teal-700">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M5 8l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

function SupportCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={`${innerCardClass} p-4`}>
      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
        {title}
      </h4>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function SavedResultsTable({ recentRuns }: { recentRuns: RecentRun[] }) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,250,0.92))] shadow-[0_14px_28px_rgba(16,32,51,0.05)]">
      <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Saved-results table
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
          Recent runs in this session
        </h3>
      </div>
      {recentRuns.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/90">
                {["Run", "Workflow", "Recommendation", "Timestamp"].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id} className="bg-white/70 transition duration-200 hover:bg-teal-50/40">
                  <td className="border-b border-slate-100 px-4 py-3 align-top">
                    <div className="grid gap-1">
                      <strong className="text-sm text-slate-900">
                        {truncate(run.summary, 72)}
                      </strong>
                      <span className="text-xs text-slate-500">{truncate(run.prompt, 92)}</span>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 align-top text-sm text-slate-600">
                    {run.workflowId.replaceAll("_", " ")}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 align-top text-sm font-medium text-slate-800">
                    {truncate(run.recommendedOption, 88)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 align-top text-sm text-slate-500">
                    {run.timestampLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500 sm:px-5">
          Session history will appear here after the first successful workflow run.
        </div>
      )}
    </section>
  );
}

function ComparisonTableView({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/92 shadow-[0_12px_28px_rgba(16,32,51,0.05)]">
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
          {title}
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-slate-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${alignClass(column.align)}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.status === "selected"
                    ? "bg-teal-50/60"
                    : row.status === "governing"
                      ? "bg-amber-50/60"
                      : "bg-white/80"
                }
              >
                {columns.map((column) => (
                  <td
                    key={`${row.id}-${column.key}`}
                    className={`border-b border-slate-100 px-3 py-3 text-slate-700 ${alignClass(column.align)}`}
                  >
                    {column.key === "status" ? (
                      <StatusPill
                        status={mapComparisonStatus(row.status)}
                        label={row.values[column.key]}
                      />
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
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-2">
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

      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <article className={`${innerCardClass} p-4`}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
            RC section sketch
          </h4>
          <div className="mt-3 grid min-h-56 place-items-center rounded-[22px] border border-slate-200 bg-[linear-gradient(rgba(15,118,110,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,0.05)_1px,transparent_1px)] bg-[size:22px_22px]">
            <div className="relative h-40 w-40 rounded-sm border-[6px] border-teal-800/90 bg-teal-700/5">
              <div className="absolute inset-4 border-[3px] border-dashed border-slate-400" />
              <div className="absolute left-4 right-4 top-4 flex justify-between">
                {[0, 1, 2, 3].map((item) => (
                  <span
                    key={`top-${item}`}
                    className="h-3.5 w-3.5 rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.16)]"
                  />
                ))}
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                {[0, 1, 2, 3].map((item) => (
                  <span
                    key={`bottom-${item}`}
                    className="h-3.5 w-3.5 rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.16)]"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <InfoStat label="Section" value={sectionSize ?? "Not reported"} />
            <InfoStat label="Main bars" value={mainReo ?? "Not reported"} />
            <InfoStat label="Ligatures" value={ligatures ?? "Not reported"} />
          </div>
        </article>

        <article className={`${innerCardClass} p-4`}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
            {result.visualisations.title}
          </h4>
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
  const grade = getGroupValue(result, "Timber capacity tool", "Timber grade");
  const size = getGroupValue(result, "Timber capacity tool", "Section size");

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-2">
        {bendingPair ? (
          <CapacityPanel
            title="Bending demand vs capacity"
            demandLabel="Mx"
            demandValue={bendingPair.demand}
            capacityLabel="phiMx"
            capacityValue={bendingPair.capacity}
            unit="kNm"
          />
        ) : null}
        {shearPair ? (
          <CapacityPanel
            title="Shear demand vs capacity"
            demandLabel="V"
            demandValue={shearPair.demand}
            capacityLabel="phiV"
            capacityValue={shearPair.capacity}
            unit="kN"
          />
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.88fr_1.12fr]">
        <article className={`${innerCardClass} p-4`}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
            Timber section sketch
          </h4>
          <div className="mt-3 grid min-h-56 place-items-center rounded-[22px] border border-slate-200 bg-[linear-gradient(rgba(180,122,54,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(180,122,54,0.04)_1px,transparent_1px)] bg-[size:22px_22px]">
            <div className="relative h-36 w-24 rounded-sm border-4 border-amber-900/80 bg-[repeating-linear-gradient(135deg,rgba(180,122,54,0.18)_0_10px,rgba(152,101,41,0.08)_10px_20px)]">
              <div className="absolute inset-x-[-20px] top-1/2 h-px border-t-2 border-dashed border-amber-700/60" />
              <div className="absolute left-full top-1/2 ml-3 -translate-y-1/2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Neutral axis
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoStat label="Grade" value={grade ?? "Not reported"} />
            <InfoStat label="Section" value={size ?? "Not reported"} />
          </div>
        </article>

        <article className={`${innerCardClass} p-4`}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
            {result.visualisations.title}
          </h4>
          <GenericVisualisation result={result} maxValue={maxValue} compact />
        </article>
      </div>
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
  const centroidX = getGroupNumeric(result, "Primary section properties", "Centroid X-coordinate");
  const centroidY = getGroupNumeric(result, "Primary section properties", "Centroid Y-coordinate");
  const isCircular = radius !== undefined;

  return (
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <article className={`${innerCardClass} p-4`}>
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
          Section geometry sketch
        </h4>
        <div className="mt-3 grid min-h-56 place-items-center rounded-[22px] border border-slate-200 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:22px_22px]">
          <div
            className={`relative border-4 border-teal-700/80 bg-teal-500/8 ${
              isCircular ? "h-36 w-36 rounded-full" : "h-28 w-40 rounded-sm"
            }`}
          >
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rose-600 bg-rose-400/90" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-slate-500/50" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 border-t border-dashed border-slate-500/50" />
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {isCircular ? (
            <InfoStat label="Radius" value={radius ? `${radius.toFixed(0)} mm` : "Not reported"} />
          ) : (
            <>
              <InfoStat label="Width" value={width ? `${width.toFixed(0)} mm` : "Not reported"} />
              <InfoStat label="Height" value={height ? `${height.toFixed(0)} mm` : "Not reported"} />
            </>
          )}
          <InfoStat
            label="Centroid"
            value={
              centroidX !== undefined && centroidY !== undefined
                ? `${centroidX.toFixed(1)}, ${centroidY.toFixed(1)} mm`
                : "Not reported"
            }
          />
        </div>
      </article>

      <article className={`${innerCardClass} p-4`}>
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
          {result.visualisations.title}
        </h4>
        <GenericVisualisation result={result} maxValue={maxValue} compact />
      </article>
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
    <div className={`grid ${compact ? "gap-2.5" : "gap-3"}`}>
      {result.visualisations.items.map((item) => {
        const ratio = maxValue > 0 ? Math.max(item.y / maxValue, 0.04) : 0.04;
        return (
          <div
            key={`${item.x}-${item.y}`}
            className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3 transition duration-200 hover:border-teal-100 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.x}</p>
                {item.label ? (
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                ) : null}
              </div>
              <strong className="text-sm font-semibold tabular-nums text-slate-700">
                {item.y.toFixed(3)}
              </strong>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-700 via-cyan-500 to-emerald-400 transition-[width] duration-500"
                style={{ width: `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
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
  const utilization = capacityValue > 0 ? demandValue / capacityValue : 0;
  const status = utilization <= 1 ? "pass" : "warn";
  const width = `${Math.min(utilization * 100, 100)}%`;

  return (
    <article className={`${innerCardClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Demand-capacity comparison from the current structured result.
          </p>
        </div>
        <StatusPill status={status} label={utilization <= 1 ? "Pass" : "Check"} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InfoStat label={demandLabel} value={`${demandValue.toFixed(2)} ${unit}`} />
        <InfoStat label={capacityLabel} value={`${capacityValue.toFixed(2)} ${unit}`} />
        <InfoStat label="Utilization" value={utilization.toFixed(3)} />
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Demand ratio</span>
          <span>{utilization.toFixed(3)}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              utilization <= 1
                ? "bg-gradient-to-r from-emerald-600 to-teal-400"
                : "bg-gradient-to-r from-amber-500 to-rose-500"
            }`}
            style={{ width }}
          />
        </div>
      </div>
    </article>
  );
}

function SummaryMetricTile({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string;
  value: string;
  accent: "teal" | "slate";
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-[22px] border px-4 py-3 ${
        accent === "teal"
          ? "border-teal-100 bg-white/90 shadow-[0_12px_22px_rgba(13,148,136,0.08)]"
          : "border-slate-200 bg-white/85 shadow-[0_10px_20px_rgba(16,32,51,0.05)]"
      }`}
    >
      <span
        className={`block text-[11px] font-semibold uppercase tracking-[0.16em] ${
          accent === "teal" ? "text-teal-700" : "text-slate-500"
        }`}
      >
        {label}
      </span>
      <strong
        className={`mt-2 block font-semibold tracking-tight text-slate-950 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {value}
      </strong>
    </article>
  );
}

function MiniMetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/80 px-3 py-3">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <strong className="mt-1 block text-sm font-semibold text-slate-950">{value}</strong>
    </div>
  );
}

function InfoStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <strong className="mt-1 block text-sm font-semibold text-slate-900">{value}</strong>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: "pass" | "warn" | "info";
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        status === "pass"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : status === "warn"
            ? "border border-amber-200 bg-amber-50 text-amber-800"
            : "border border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function formatRowValue(item: ResultRow) {
  return item.unit ? `${item.value} ${item.unit}` : item.value;
}

function getRowStatus(item: ResultRow): "pass" | "warn" | "info" {
  const value = item.value.toLowerCase();
  const label = item.label.toLowerCase();
  const numeric = Number.parseFloat(item.value);
  const includesUtilization =
    label.includes("utilization") ||
    label.includes("unity ratio") ||
    label.includes("demand / capacity") ||
    label.includes("ratio");

  if (Number.isFinite(numeric) && includesUtilization) {
    return numeric <= 1 ? "pass" : "warn";
  }

  if (value.includes("pass") || value.includes("ok") || value.includes("selected")) {
    return "pass";
  }

  if (
    value.includes("fail") ||
    value.includes("check") ||
    value.includes("revise") ||
    value.includes("ng")
  ) {
    return "warn";
  }

  return "info";
}

function formatStatusLabel(status: "pass" | "warn" | "info") {
  if (status === "pass") {
    return "Pass";
  }

  if (status === "warn") {
    return "Check";
  }

  return "Reported";
}

function alignClass(align?: ComparisonColumn["align"]) {
  if (align === "right") {
    return "text-right";
  }

  if (align === "center") {
    return "text-center";
  }

  return "text-left";
}

function mapComparisonStatus(status?: ComparisonRow["status"]): "pass" | "warn" | "info" {
  if (status === "selected") {
    return "pass";
  }

  if (status === "governing") {
    return "warn";
  }

  return "info";
}

function getGroup(result: StructuralCopilotResponse, title: string) {
  return result.designOutputs.find((group) => group.title === title);
}

function getGroupValue(result: StructuralCopilotResponse, title: string, label: string) {
  return getGroup(result, title)?.items.find((item) => item.label === label)?.value;
}

function getGroupNumeric(result: StructuralCopilotResponse, title: string, label: string) {
  const value = getGroupValue(result, title, label);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getParsedNumeric(result: StructuralCopilotResponse, label: string) {
  const value = result.parsedInputs.find((item) => item.label === label)?.value;
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getDemandCapacityPair(result: StructuralCopilotResponse, title: string) {
  const group = getGroup(result, title);
  if (!group) {
    return undefined;
  }

  const demandItem = group.items.find((item) => /demand/i.test(item.label));
  const capacityItem = group.items.find((item) => /capacity/i.test(item.label));

  if (!demandItem || !capacityItem) {
    return undefined;
  }

  const demand = Number.parseFloat(demandItem.value);
  const capacity = Number.parseFloat(capacityItem.value);

  if (!Number.isFinite(demand) || !Number.isFinite(capacity)) {
    return undefined;
  }

  return { demand, capacity };
}

function getGroupPair(
  result: StructuralCopilotResponse,
  title: string,
  demandLabel: string,
  capacityLabel: string,
) {
  const demand = getGroupNumeric(result, title, demandLabel);
  const capacity = getGroupNumeric(result, title, capacityLabel);

  if (demand === undefined || capacity === undefined) {
    return undefined;
  }

  return { demand, capacity };
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
