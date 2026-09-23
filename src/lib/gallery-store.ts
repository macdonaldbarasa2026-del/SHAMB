import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Photo, StudioSettings } from "./types";

const MAX_LIBRARY = 48;

export const defaultSettings: StudioSettings = {
  aspectRatio: "2:3",
  resolution: "2k",
  style: "photo",
  reduceMotion: false,
  plan: "studio",
  videoDuration: 6,
};

type GalleryState = {
  photos: Photo[];
  settings: StudioSettings;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  replaceLibrary: (photos: Photo[]) => void;
  clearLibrary: () => void;
  patchSettings: (patch: Partial<StudioSettings>) => void;
};

function normalizePhoto(photo: Photo): Photo {
  return {
    ...photo,
    kind: photo.kind === "video" ? "video" : "photo",
  };
}

export const useGallery = create<GalleryState>()(
  persist(
    (set) => ({
      photos: [],
      settings: defaultSettings,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      addPhoto: (photo) =>
        set((state) => ({
          photos: [normalizePhoto(photo), ...state.photos].slice(0, MAX_LIBRARY),
        })),
      removePhoto: (id) =>
        set((state) => ({
          photos: state.photos.filter((photo) => photo.id !== id),
        })),
      replaceLibrary: (photos) =>
        set({
          photos: photos.map(normalizePhoto).slice(0, MAX_LIBRARY),
        }),
      clearLibrary: () => set({ photos: [] }),
      patchSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
    }),
    {
      name: "lumina-studio",
      partialize: (state) => ({
        photos: state.photos,
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<GalleryState>;
        return {
          ...currentState,
          ...persisted,
          settings: { ...defaultSettings, ...persisted.settings },
          photos: (persisted.photos ?? currentState.photos).map(normalizePhoto),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.settings = { ...defaultSettings, ...state.settings };
        state.photos = state.photos.map(normalizePhoto);
        state.setHydrated(true);
      },
    },
  ),
);

export function sphereSlots(userPhotos: Photo[], studioPhotos: Photo[], count = 10): Photo[] {
  const seen = new Set<string>();
  const slots: Photo[] = [];
  for (const photo of [...userPhotos, ...studioPhotos]) {
    if (seen.has(photo.src)) continue;
    seen.add(photo.src);
    slots.push(photo);
    if (slots.length >= count) break;
  }
  return slots;
}
