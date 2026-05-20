import React from "react";
import { BottomDockRegistry } from "@openchamber/plugin";

let registry: BottomDockRegistry | null = null;

export function getBottomDockRegistry(): BottomDockRegistry {
  if (!registry) {
    registry = new BottomDockRegistry();
  }

  return registry;
}

export function renderBottomDockSurface(surfaceId: string): React.ReactNode | null {
  const reg = getBottomDockRegistry();
  const surface = reg.getSurface(surfaceId);
  if (!surface) return null;

  const RenderComponent = surface.render;
  return (
    <React.Suspense fallback={null}>
      <RenderComponent />
    </React.Suspense>
  );
}

export function useBottomDockSurfaces() {
  const reg = getBottomDockRegistry();

  const surfaces = React.useMemo(() => {
    return reg.getAllSuraces();
  }, [reg]);

  return surfaces;
}
