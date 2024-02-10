import { GPTModel } from '../types/types';
import { openai } from '../utils';

import colors from 'colors';

class GPT {
  async generate_response(prompt: string, ai_model: GPTModel): Promise<string> {
    try {
      switch (ai_model) {
        case 'gpt3.5-turbo':
        case 'gpt4':
          return (
            (
              await openai.chat.completions.create({
                model: ai_model === 'gpt3.5-turbo' ? 'gpt-3.5-turbo' : 'gpt-4-1106-preview',
                messages: [{ role: 'user', content: prompt }],
              })
            ).choices[0].message.content ?? ''
          );
        default:
          return '';
      }
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  async generate_script(video_subject: string, total_paragraphs: number, ai_model: GPTModel): Promise<string> {
    const prompt: string = `
Generate a script for a video, depending on the subject of the video.
Subject: ${video_subject}
Number of paragraphs: ${total_paragraphs}


The script is to be returned as a string with the specified number of paragraphs.

Here is an example of a string:
"This is an example string."

Do not under any circumstance reference this prompt in your response.

Get straight to the point, don't start with unnecessary things like, "welcome to this video".

Obviously, the script should be related to the subject of the video.

YOU MUST NOT INCLUDE ANY TYPE OF MARKDOWN OR FORMATTING IN THE SCRIPT, NEVER USE A TITLE.
ONLY RETURN THE RAW CONTENT OF THE SCRIPT. DO NOT INCLUDE "VOICEOVER", "NARRATOR" OR SIMILAR INDICATORS OF WHAT SHOULD BE SPOKEN AT THE BEGINNING OF EACH PARAGRAPH OR LINE. YOU MUST NOT MENTION THE PROMPT, OR ANYTHING ABOUT THE SCRIPT ITSELF. ALSO, NEVER TALK ABOUT THE AMOUNT OF PARAGRAPHS OR LINES. JUST WRITE THE SCRIPT.
`;

    let response = await this.generate_response(prompt, ai_model);

    console.log(colors.cyan(response));

    if (response.length > 0) {
      return this.cleanScript(response, total_paragraphs);
    } else {
      console.log(colors.red('[-] GPT returned an empty response.'));

      // Return an error message if GPT returns an empty response. This should never happen, but it's better to handle it gracefully than to crash the server.
      return 'Error: GPT returned an empty response.';
    }
  }

  async get_search_terms(video_subject: string, amount: number, script: string, ai_model: GPTModel): Promise<string[]> {
    // Build prompt
    const prompt: string = `
Generate ${amount} search terms for stock videos,
depending on the subject of a video.
Subject: ${video_subject}

The search terms are to be returned as
a JSON-Array of strings.

Each search term should consist of 1-3 words,
always add the main subject of the video.

YOU MUST ONLY RETURN THE JSON-ARRAY OF STRINGS.
YOU MUST NOT RETURN ANYTHING ELSE. 
YOU MUST NOT RETURN THE SCRIPT.

The search terms must be related to the subject of the video.
Here is an example of a JSON-Array of strings:
["search term 1", "search term 2", "search term 3"]

For context, here is the full text:
${script}
`;

    // Generate search terms
    const response: string = await this.generate_response(prompt, ai_model);

    // Parse response into a list of search terms
    let searchTerms: string[] = [];

    try {
      searchTerms = JSON.parse(response);
      if (!Array.isArray(searchTerms) || !searchTerms.every((term) => typeof term === 'string')) {
        throw new Error('Response is not a list of strings.');
      }
    } catch (error) {
      console.log('[*] GPT returned an unformatted response. Attempting to clean...', (error as Error).message);

      // Attempt to extract list-like string and convert to list
      const match = response.match(/\["(?:[^"\\]|\\.)*"(?:,\s*"[^"\\]*")*\]/);
      if (match) {
        try {
          searchTerms = JSON.parse(match[0]);
        } catch (error) {
          console.log('[-] Could not parse response.', (error as Error).message);
          return [];
        }
      }
    }

    // Let user know
    console.log(`\nGenerated ${searchTerms.length} search terms: ${searchTerms.join(', ')}`);

    // Return search terms
    return searchTerms;
  }

  async generate_metadata(
    video_subject: string,
    script: string,
    ai_model: GPTModel,
  ): Promise<[string, string, string[]]> {
    // Build prompt for title
    const titlePrompt: string = `
        Generate a catchy and SEO-friendly title for a YouTube shorts video about ${video_subject}.
        `;

    // Generate title
    const title: string = (await this.generate_response(titlePrompt, ai_model)).trim();

    // Build prompt for description
    const descriptionPrompt: string = `
        Write a brief and engaging description for a YouTube shorts video about ${video_subject}.
        The video is based on the following script:
        ${script}
        `;

    // Generate description
    const description: string = (await this.generate_response(descriptionPrompt, ai_model)).trim();

    // Generate keywords
    const keywords: string[] = await this.get_search_terms(video_subject, 6, script, ai_model);

    return [title, description, keywords];
  }

  private cleanScript(response: string, total_paragraphs: number): string {
    // Clean the script
    // Remove asterisks, hashes
    let cleanedResponse = response.replace('*', '').replace('#', '');

    // Remove markdown syntax
    cleanedResponse = cleanedResponse.replace(/\[.*\]/g, '').replace(/\(.*\)/g, '');

    // Split the script into paragraphs
    const paragraphs = cleanedResponse.split('\n\n');

    // Select the specified number of paragraphs
    const selectedParagraphs = paragraphs.slice(0, total_paragraphs);

    // Join the selected paragraphs into a single string
    const finalScript = selectedParagraphs.join('\n\n');

    // Print to console the number of paragraphs used
    console.log(colors.green(`Number of paragraphs used: ${selectedParagraphs.length}`));

    return finalScript;
  }
}
