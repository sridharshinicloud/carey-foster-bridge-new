'use server';

/**
 * @fileOverview A flow that suggests optimal resistance values for a Carey Foster bridge experiment.
 *
 * - suggestResistanceValues - A function that takes initial measurements and suggests resistance adjustments.
 * - SuggestResistanceValuesInput - The input type for the suggestResistanceValues function.
 * - SuggestResistanceValuesOutput - The return type for the suggestResistanceValues function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestResistanceValuesInputSchema = z.object({
  l1: z.number().describe('The first balance length measurement (l1).'),
  l2: z.number().describe('The second balance length measurement (l2).'),
  R: z.number().describe('The known resistance value (R).'),
  X: z.number().describe('The approximate value of the unknown resistance (X).'),
});
export type SuggestResistanceValuesInput = z.infer<
  typeof SuggestResistanceValuesInputSchema
>;

const SuggestResistanceValuesOutputSchema = z.object({
  suggestions: z
    .string()
    .describe(
      'AI suggestions for adjusting resistance values to improve the accuracy and clarity of the experiment.'
    ),
});
export type SuggestResistanceValuesOutput = z.infer<
  typeof SuggestResistanceValuesOutputSchema
>;

export async function suggestResistanceValues(
  input: SuggestResistanceValuesInput
): Promise<SuggestResistanceValuesOutput> {
  return suggestResistanceValuesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestResistanceValuesPrompt',
  input: {schema: SuggestResistanceValuesInputSchema},
  output: {schema: SuggestResistanceValuesOutputSchema},
  prompt: `You are an expert physics lab assistant, specializing in the Carey Foster bridge.

You will receive an initial measurement from a user's experiment. Your goal is to provide clear, actionable advice to help them perform the experiment correctly and get an accurate result.

The user's data for one of their readings is:
- Known Resistance (R): {{{R}}} Ω
- Balance Point (l1): {{{l1}}} cm
- Approximate Unknown Resistance (X): {{{X}}} Ω

Based on this data, provide helpful suggestions. Consider the following:
1.  **The Goal of Swapping:** Explain clearly *why* they need to take a second reading after swapping the positions of R and X. Mention that this is the key to eliminating end-resistances and getting an accurate result.
2.  **Ideal Balance Point:** The most accurate readings are obtained when the balance point (l1) is near the center of the wire (around 50 cm). If the user's l1 is far from the center, advise them to adjust the known resistance R to be closer to the unknown resistance X.
3.  **Procedure Checklist:** Provide a simple, step-by-step procedure for the user to follow, like this:
    - Step 1: Set R, find balance point l1, and record.
    - Step 2: Swap R and X.
    - Step 3: Find the new balance point l1', and record.
    - Step 4: Explain how to use the two readings to calculate the final value of X.

Keep the tone encouraging and helpful.
`,
});

const suggestResistanceValuesFlow = ai.defineFlow(
  {
    name: 'suggestResistanceValuesFlow',
    inputSchema: SuggestResistanceValuesInputSchema,
    outputSchema: SuggestResistanceValuesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
