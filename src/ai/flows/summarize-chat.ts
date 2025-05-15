
'use server';

/**
 * @fileOverview A chat history summarization AI agent.
 *
 * - summarizeChatHistory - A function that handles the chat history summarization process.
 * - SummarizeChatHistoryInput - The input type for the summarizeChatHistory function.
 * - SummarizeChatHistoryOutput - The return type for the summarizeChatHistory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeChatHistoryInputSchema = z.object({
  chatHistory: z.string().describe('The complete chat history to summarize.'),
});
export type SummarizeChatHistoryInput = z.infer<typeof SummarizeChatHistoryInputSchema>;

const SummarizeChatHistoryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the chat history.'),
});
export type SummarizeChatHistoryOutput = z.infer<typeof SummarizeChatHistoryOutputSchema>;

export async function summarizeChatHistory(input: SummarizeChatHistoryInput): Promise<SummarizeChatHistoryOutput> {
  return summarizeChatHistoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeChatHistoryPrompt',
  input: {schema: SummarizeChatHistoryInputSchema},
  output: {schema: SummarizeChatHistoryOutputSchema},
  prompt: `You are an AI expert specializing in summarizing chat histories.  Please provide a concise summary of the chat history below, focusing on the key topics discussed.  The summary should be no more than three sentences.

Chat History:
{{{chatHistory}}}`,
});

const summarizeChatHistoryFlow = ai.defineFlow(
  {
    name: 'summarizeChatHistoryFlow',
    inputSchema: SummarizeChatHistoryInputSchema,
    outputSchema: SummarizeChatHistoryOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input); // prompt() returns GenerateResult<OutputSchema> which is { output: OutputSchema | undefined, ... }
      
      if (!output || typeof output.summary !== 'string') {
        // This case handles if the model generates nothing, if it's filtered by safety settings,
        // or if the output structure is unexpectedly different (though schema validation should catch most of this).
        console.error("Summarization flow: LLM did not produce a valid summary output.", output);
        return { summary: "The AI could not produce a summary. This might be due to the chat content or model limitations." };
      }
      return output;
    } catch (flowError) {
        console.error("Error in summarizeChatHistoryFlow:", flowError);
        // Re-throw the error to be caught by the client, or return a structured error
        // For client to get a clearer message, re-throwing is often better.
        // If the error is already an Error instance, just rethrow.
        if (flowError instanceof Error) {
            throw flowError;
        }
        // Otherwise, wrap it in an error.
        throw new Error(`Summarization flow failed: ${String(flowError)}`);
    }
  }
);

