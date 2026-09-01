const bridge = () => window.mip;

export class LibraryService {
  profiles(options = {}) { return bridge()?.getProfiles?.(options) ?? []; }
  profile(id, version) { return bridge()?.getProfile?.({ id, ...(version === undefined ? {} : { version }) }); }
  profileVersions(id) { return bridge()?.getProfileVersions?.({ id }) ?? []; }
  recipes(options = {}) { return bridge()?.getAudioPresets?.(options) ?? []; }
  recipe(id, version) { return bridge()?.getRecipe?.({ id, ...(version === undefined ? {} : { version }) }); }
  recipeVersions(id) { return bridge()?.getRecipeVersions?.({ id }) ?? []; }
  calibrationHistory(filters = {}) { return bridge()?.calibrationHistory?.(filters) ?? []; }
  calibrationDetail(id) { return bridge()?.calibrationDetail?.({ id }); }
  audioHealthHistory(filters = {}) { return bridge()?.audioHealthHistory?.(filters) ?? []; }
  audioHealthDetail(id) { return bridge()?.audioHealthDetail?.({ id }); }
}

export const libraryService = new LibraryService();
export default LibraryService;
