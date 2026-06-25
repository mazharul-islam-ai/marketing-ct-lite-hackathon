import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";

export type BuilderArtifactVariant = "agent" | "automation";

interface BuilderArtifactCardProps {
  variant: BuilderArtifactVariant;
  header: ReactNode;
  metaStrip: ReactNode;
  skeleton: ReactNode;
  models: ReactNode;
  stats: ReactNode;
  footer: ReactNode;
  isCompiling?: boolean;
  isRunActive?: boolean;
  justRevealed?: boolean;
  reducedMotion?: boolean;
  hasFlow?: boolean;
}

export function BuilderArtifactCard({
  variant,
  header,
  metaStrip,
  skeleton,
  models,
  stats,
  footer,
  isCompiling = false,
  isRunActive = false,
  justRevealed = false,
  reducedMotion = false,
  hasFlow = true,
}: BuilderArtifactCardProps) {
  const isAgent = variant === "agent";

  return (
    <div className={cn("flex flex-col items-center", ab.cardWidth)}>
      <div
        className={cn(
          ab.cardShell,
          ab.cardShell3d,
          "w-full overflow-hidden transition-shadow duration-300",
          isCompiling &&
            (reducedMotion
              ? isAgent
                ? ab.cardCompilingShimmerStatic
                : ab.cardCompilingShimmerAutoStatic
              : isAgent
                ? ab.cardCompilingShimmer
                : ab.cardCompilingShimmerAuto),
          !isCompiling &&
            isRunActive &&
            (isAgent ? ab.cardRunningGlow : ab.cardRunningGlowAuto),
          !isCompiling && !isRunActive && justRevealed && ab.cardRevealFlash,
        )}
      >
        <div
          className={cn(
            isAgent ? ab.agentCardHeader : ab.automationCardHeader,
            ab.cardHeader,
            "relative overflow-hidden",
          )}
        >
          {header}
        </div>

        {metaStrip}

        <div className={ab.cardBody}>
          {!hasFlow ? (
            <p className="text-xs text-slate-400 italic min-h-[288px] flex items-center">
              No nodes yet — describe your workflow in the chat
            </p>
          ) : (
            <>
              {skeleton}
              <div className={ab.cardModelsRow}>{models}</div>
              <div className={ab.cardStatsRow}>{stats}</div>
            </>
          )}
        </div>

        <div className={ab.cardFooter}>{footer}</div>
      </div>
    </div>
  );
}
