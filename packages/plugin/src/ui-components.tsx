/* eslint-disable react-refresh/only-export-components */
import React, {
  Component,
  type ComponentType,
  type ReactNode,
  createContext,
  useContext,
  memo,
} from "react";
import type {
  UIFillContribution,
  UISurfaceContribution,
  UIReplaceContribution,
  UIWrapContribution,
} from "./ui-types";

export interface UIContextValue {
  getFillsForSlot: (
    slotId: string,
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ) => UIFillContribution[];
  getSurface: (surfaceId: string) => UISurfaceContribution | undefined;
  getSurfacesForPlacement: (
    placement: string,
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ) => UISurfaceContribution[];
  getActiveReplace: (
    targetId: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
      selectedPluginId?: string;
    },
  ) => UIReplaceContribution | undefined;
  getWrapsForTarget: (
    targetId: string,
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ) => UIWrapContribution[];
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIContextProvider({
  value,
  children,
}: {
  value: UIContextValue;
  children: ReactNode;
}) {
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUIContext must be used within UIContextProvider");
  }
  return ctx;
}

export interface SlotProps {
  slotId: string;
  filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> };
}

export const Slot = memo(function Slot({ slotId, filters }: SlotProps) {
  const { getFillsForSlot } = useUIContext();
  const fills = getFillsForSlot(slotId, filters);

  if (fills.length === 0) return null;

  return (
    <>
      {fills.map((fill, index) => {
        const FillComponent = fill.component as ComponentType<unknown>;
        return <FillComponent key={`${slotId}-${fill.pluginId}-${index}`} />;
      })}
    </>
  );
});

export interface SurfaceOutletProps {
  placement: string;
  activeSurfaceId?: string;
  filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> };
  fallback?: ReactNode;
}

export const SurfaceOutlet = memo(function SurfaceOutlet({
  placement,
  activeSurfaceId,
  filters,
  fallback,
}: SurfaceOutletProps) {
  const { getSurface, getSurfacesForPlacement } = useUIContext();

  if (activeSurfaceId) {
    const surface = getSurface(activeSurfaceId);
    if (surface) {
      const RenderComponent = surface.render;
      return <RenderComponent />;
    }
    return fallback ?? null;
  }

  const surfaces = getSurfacesForPlacement(placement, filters);

  if (surfaces.length === 0) {
    return fallback ?? null;
  }

  const firstSurface = surfaces[0];
  const RenderComponent = firstSurface.render;
  return <RenderComponent />;
});

export interface ReplaceableSurfaceProps {
  targetId: string;
  fallback: ReactNode;
  filters?: {
    enabledFeatures?: Set<string>;
    enabledPlugins?: Set<string>;
    selectedPluginId?: string;
  };
}

export const ReplaceableSurface = memo(function ReplaceableSurface({
  targetId,
  fallback,
  filters,
}: ReplaceableSurfaceProps) {
  const { getActiveReplace } = useUIContext();
  const replacement = getActiveReplace(targetId, filters);

  if (!replacement) {
    return fallback;
  }

  const ReplaceComponent = replacement.component;
  return <ReplaceComponent />;
});

export interface WrapTargetProps {
  targetId: string;
  children: ReactNode;
  filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> };
}

export const WrapTarget = memo(function WrapTarget({
  targetId,
  children,
  filters,
}: WrapTargetProps) {
  const { getWrapsForTarget } = useUIContext();
  const wraps = getWrapsForTarget(targetId, filters);

  if (wraps.length === 0) {
    return children;
  }

  let wrapped = children;
  for (const wrap of wraps) {
    const Wrapper = wrap.wrapper;
    wrapped = <Wrapper>{wrapped}</Wrapper>;
  }

  return wrapped;
});

export interface PluginErrorBoundaryProps {
  children: ReactNode;
  pluginId?: string;
  fallback?: ReactNode;
}

interface PluginErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, PluginErrorBoundaryState> {
  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const pluginId = this.props.pluginId;
    console.error(
      `[PluginErrorBoundary] Plugin "${pluginId ?? "unknown"}" threw an error:`,
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: "1rem", color: "red" }}>
            Plugin error: {this.state.error?.message ?? "Unknown error"}
          </div>
        )
      );
    }

    return this.props.children;
  }
}
