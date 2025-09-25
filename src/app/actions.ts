'use server';

import {
  suggestResistanceValues,
  type SuggestResistanceValuesInput,
} from '@/ai/flows/suggest-resistance-values';

export async function getAiSuggestion(input: SuggestResistanceValuesInput) {
  try {
    const result = await suggestResistanceValues(input);
    return { success: true, suggestion: result.suggestions };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to get suggestion from AI: ${errorMessage}` };
  }
}
