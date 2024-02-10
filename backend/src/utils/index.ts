import { AssemblyAI } from 'assemblyai';
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY,
});
