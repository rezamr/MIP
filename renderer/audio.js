import { RendererAudio } from "./audio/controller.js";
import { normalizeRecipe, validateEffectiveRecipe } from "../public/audio-core.js";

export { RendererAudio };

export function validateRecipeForUI(recipe) {
  try {
    const effective = normalizeRecipe(recipe);
    const validation = validateEffectiveRecipe(effective);
    return { ...validation, recipe: effective };
  } catch (error) {
    return { valid: false, errors: [error.message], recipe: null };
  }
}
