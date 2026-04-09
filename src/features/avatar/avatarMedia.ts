import { useEffect, useRef, useState } from "react";
import { loadGifClip, preloadGifClip } from "./gifPlayback";
import type { AvatarManifest, AvatarRenderModel } from "./types";

function collectAvatarSources(manifest: AvatarManifest) {
  const sources = new Set<string>();

  for (const loopAssets of Object.values(manifest.loops)) {
    for (const asset of loopAssets) {
      sources.add(asset.src);
    }
  }

  for (const asset of Object.values(manifest.transitions)) {
    sources.add(asset.src);
    if (asset.reverseSrc) {
      sources.add(asset.reverseSrc);
    }
  }

  return [...sources];
}

export function usePreloadedAvatarAssets(manifest: AvatarManifest) {
  useEffect(() => {
    const sources = collectAvatarSources(manifest);
    for (const src of sources) {
      preloadGifClip(src);
    }
  }, [manifest]);
}

export function useStableAvatarRenderModel(renderModel: AvatarRenderModel) {
  const [visibleModel, setVisibleModel] = useState<AvatarRenderModel>(renderModel);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!renderModel) {
      requestRef.current += 1;
      setVisibleModel(null);
      return;
    }

    const requestId = ++requestRef.current;

    const commit = () => {
      if (requestId === requestRef.current) {
        setVisibleModel(renderModel);
      }
    };

    if (renderModel.mediaKind === "gif") {
      loadGifClip(renderModel.src).then(commit, commit);
      return;
    }

    commit();
  }, [renderModel]);

  return visibleModel;
}
