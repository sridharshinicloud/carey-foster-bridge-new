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
  prompt: `You are an expert in electrical engineering, specifically with Carey Foster bridges.

You will receive initial measurements from an experiment, including l1, l2, R, and X. Your goal is to suggest adjustments to the known resistance value (R) to optimize the experiment for accuracy and clarity.

Here's the data from the initial measurements:
- l1: {{{l1}}}
- l2: {{{l2}}}
- R: {{{R}}}
- X: {{{X}}}

Based on this data, provide specific recommendations for adjusting the value of R. Explain why these adjustments are likely to improve the experiment's results. Focus on strategies to achieve a more distinct null point and minimize the impact of end resistances.
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
