import { AdvancedSectionPropertyBrowserAdapter } from "@/server/tools/advanced-section-property-browser-adapter";
import { DesignActionsBrowserAdapter } from "@/server/tools/design-actions-browser-adapter";
import { RcMomentCapacityBrowserAdapter } from "@/server/tools/rc-moment-capacity-browser-adapter";
import { RcShearCapacityBrowserAdapter } from "@/server/tools/rc-shear-capacity-browser-adapter";
import { RealDesignActionsAdapter } from "@/server/tools/real-design-actions-adapter";
import { SectionPropertiesCalcBrowserAdapter } from "@/server/tools/section-properties-calc-browser-adapter";
import { TimberMemberBrowserAdapter } from "@/server/tools/timber-member-browser-adapter";

export type StructuralToolKey =
  | "design_actions_browser"
  | "design_actions_http"
  | "rc_moment_browser"
  | "rc_shear_browser"
  | "timber_member_browser"
  | "advanced_section_property_browser"
  | "section_properties_calc_browser";

export interface StructuralToolDefinition {
  key: StructuralToolKey;
  workflowIds: string[];
  mode: "browser" | "http";
  label: string;
  allowedOrigins: string[];
  env: {
    enabledVar?: string;
    urlVar: string;
    apiKeyVar?: string;
  };
}

export const structuralToolRegistry: StructuralToolDefinition[] = [
  {
    key: "design_actions_browser",
    workflowIds: ["rc_beam_design", "design_actions"],
    mode: "browser",
    label: "Design Actions Browser Tool",
    allowedOrigins: ["https://designactionspremium.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL",
      urlVar: "STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL",
    },
  },
  {
    key: "design_actions_http",
    workflowIds: ["rc_beam_design", "design_actions"],
    mode: "http",
    label: "Design Actions HTTP Tool",
    allowedOrigins: [],
    env: {
      urlVar: "STRUCTURAL_DESIGN_ACTIONS_URL",
      apiKeyVar: "STRUCTURAL_TOOL_API_KEY",
    },
  },
  {
    key: "rc_moment_browser",
    workflowIds: ["rc_beam_design"],
    mode: "browser",
    label: "RC Moment Capacity Browser Tool",
    allowedOrigins: ["https://rcmomentcapacity.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL",
      urlVar: "STRUCTURAL_RC_MOMENT_TOOL_URL",
    },
  },
  {
    key: "rc_shear_browser",
    workflowIds: ["rc_beam_design"],
    mode: "browser",
    label: "RC Shear Capacity Browser Tool",
    allowedOrigins: ["https://concreteshearstrength.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL",
      urlVar: "STRUCTURAL_RC_SHEAR_TOOL_URL",
    },
  },
  {
    key: "timber_member_browser",
    workflowIds: ["timber_member_design"],
    mode: "browser",
    label: "Timber Member Capacity Browser Tool",
    allowedOrigins: ["https://timbercapacityprem.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL",
      urlVar: "STRUCTURAL_TIMBER_TOOL_URL",
    },
  },
  {
    key: "advanced_section_property_browser",
    workflowIds: ["section_property_analysis"],
    mode: "browser",
    label: "Advanced Section Property Browser Tool",
    allowedOrigins: ["https://advancedsectionproperty.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_ADVANCED_SECTION_PROPERTY_BROWSER_TOOL",
      urlVar: "STRUCTURAL_ADVANCED_SECTION_PROPERTY_TOOL_URL",
    },
  },
  {
    key: "section_properties_calc_browser",
    workflowIds: ["section_property_analysis"],
    mode: "browser",
    label: "Section Properties Calc Browser Tool",
    allowedOrigins: ["https://sectionpropertiescalc.netlify.app"],
    env: {
      enabledVar: "STRUCTURAL_ENABLE_SECTION_PROPERTIES_CALC_BROWSER_TOOL",
      urlVar: "STRUCTURAL_SECTION_PROPERTIES_CALC_TOOL_URL",
    },
  },
];

export function getToolDefinition(
  key: StructuralToolKey,
): StructuralToolDefinition | undefined {
  return structuralToolRegistry.find((definition) => definition.key === key);
}

export function createDesignActionsAdapterFromRegistry() {
  const browserDefinition = getToolDefinition("design_actions_browser");
  if (
    browserDefinition?.env.enabledVar &&
    process.env[browserDefinition.env.enabledVar] === "true"
  ) {
    const url =
      process.env[browserDefinition.env.urlVar] ??
      browserDefinition.allowedOrigins[0];

    enforceAllowedOrigin(browserDefinition, url);
    return new DesignActionsBrowserAdapter({ url });
  }

  const httpDefinition = getToolDefinition("design_actions_http");
  if (httpDefinition) {
    const url = process.env[httpDefinition.env.urlVar];
    if (url) {
      return new RealDesignActionsAdapter({
        endpoint: url,
        apiKey: httpDefinition.env.apiKeyVar
          ? process.env[httpDefinition.env.apiKeyVar]
          : undefined,
      });
    }
  }

  return undefined;
}

export function createRcMomentCapacityAdapterFromRegistry() {
  const definition = getToolDefinition("rc_moment_browser");
  if (
    !definition?.env.enabledVar ||
    process.env[definition.env.enabledVar] !== "true"
  ) {
    return undefined;
  }

  const url = process.env[definition.env.urlVar] ?? definition.allowedOrigins[0];
  enforceAllowedOrigin(definition, url);
  return new RcMomentCapacityBrowserAdapter({ url });
}

export function createRcShearCapacityAdapterFromRegistry() {
  const definition = getToolDefinition("rc_shear_browser");
  if (
    !definition?.env.enabledVar ||
    process.env[definition.env.enabledVar] !== "true"
  ) {
    return undefined;
  }

  const url = process.env[definition.env.urlVar] ?? definition.allowedOrigins[0];
  enforceAllowedOrigin(definition, url);
  return new RcShearCapacityBrowserAdapter({ url });
}

export function createTimberMemberAdapterFromRegistry() {
  const definition = getToolDefinition("timber_member_browser");
  if (
    !definition?.env.enabledVar ||
    process.env[definition.env.enabledVar] !== "true"
  ) {
    return undefined;
  }

  const url = process.env[definition.env.urlVar] ?? definition.allowedOrigins[0];
  enforceAllowedOrigin(definition, url);
  return new TimberMemberBrowserAdapter({ url });
}

export function createAdvancedSectionPropertyAdapterFromRegistry() {
  const definition = getToolDefinition("advanced_section_property_browser");
  if (
    !definition?.env.enabledVar ||
    process.env[definition.env.enabledVar] !== "true"
  ) {
    return undefined;
  }

  const url = process.env[definition.env.urlVar] ?? definition.allowedOrigins[0];
  enforceAllowedOrigin(definition, url);
  return new AdvancedSectionPropertyBrowserAdapter({ url });
}

export function createSectionPropertiesCalcAdapterFromRegistry() {
  const definition = getToolDefinition("section_properties_calc_browser");
  if (
    !definition?.env.enabledVar ||
    process.env[definition.env.enabledVar] !== "true"
  ) {
    return undefined;
  }

  const url = process.env[definition.env.urlVar] ?? definition.allowedOrigins[0];
  enforceAllowedOrigin(definition, url);
  return new SectionPropertiesCalcBrowserAdapter({ url });
}

function enforceAllowedOrigin(
  definition: StructuralToolDefinition,
  url: string,
): void {
  if (definition.allowedOrigins.length === 0) {
    return;
  }

  const origin = new URL(url).origin;
  if (!definition.allowedOrigins.includes(origin)) {
    throw new Error(
      `${definition.label} URL origin ${origin} is not in the approved allowlist.`,
    );
  }
}
