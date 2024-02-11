import colors from 'colors';
import fs from 'node:fs';

import playsound from 'play-sound';
const player = playsound();

export const VOICES: string[] = [
  // DISNEY VOICES
  'en_us_ghostface', // Ghost Face
  'en_us_chewbacca', // Chewbacca
  'en_us_c3po', // C3PO
  'en_us_stitch', // Stitch
  'en_us_stormtrooper', // Stormtrooper
  'en_us_rocket', // Rocket
  // ENGLISH VOICES
  'en_au_001', // English AU - Female
  'en_au_002', // English AU - Male
  'en_uk_001', // English UK - Male 1
  'en_uk_003', // English UK - Male 2
  'en_us_001', // English US - Female (Int. 1)
  'en_us_002', // English US - Female (Int. 2)
  'en_us_006', // English US - Male 1
  'en_us_007', // English US - Male 2
  'en_us_009', // English US - Male 3
  'en_us_010', // English US - Male 4
  // EUROPE VOICES
  'fr_001', // French - Male 1
  'fr_002', // French - Male 2
  'de_001', // German - Female
  'de_002', // German - Male
  'es_002', // Spanish - Male
  // AMERICA VOICES
  'es_mx_002', // Spanish MX - Male
  'br_001', // Portuguese BR - Female 1
  'br_003', // Portuguese BR - Female 2
  'br_004', // Portuguese BR - Female 3
  'br_005', // Portuguese BR - Male
  // ASIA VOICES
  'id_001', // Indonesian - Female
  'jp_001', // Japanese - Female 1
  'jp_003', // Japanese - Female 2
  'jp_005', // Japanese - Female 3
  'jp_006', // Japanese - Male
  'kr_002', // Korean - Male 1
  'kr_003', // Korean - Female
  'kr_004', // Korean - Male 2
  // SINGING VOICES
  'en_female_f08_salut_damour', // Alto
  'en_male_m03_lobby', // Tenor
  'en_female_f08_warmy_breeze', // Warmy Breeze
  'en_male_m03_sunshine_soon', // Sunshine Soon
  // OTHER
  'en_male_narration', // narrator
  'en_male_funny', // wacky
  'en_female_emotional', // peaceful
];

const ENDPOINTS: string[] = [
  'https://tiktok-tts.weilnet.workers.dev/api/generation',
  'https://tiktoktts.com/api/tiktok-tts',
];

class TikTokVoice {
  current_endpoint: number = 0;
  TEXT_BYTE_LIMIT: number = 300;

  split_string(string: string, chunkSize: number): string[] {
    const words: string[] = string.split(' ');
    const result: string[] = [];
    let currentChunk: string = '';

    for (const word of words) {
      if (currentChunk.length + word.length + 1 <= chunkSize) {
        currentChunk += ` ${word}`;
      } else {
        if (currentChunk) {
          result.push(currentChunk.trim());
        }
        currentChunk = word;
      }
    }

    if (currentChunk) {
      result.push(currentChunk.trim());
    }

    return result;
  }

  async get_api_response(): Promise<Response> {
    const url: string = ENDPOINTS[this.current_endpoint].split('/a')[0];
    const response: Response = await fetch(url);
    return response;
  }

  async save_audio_file(base64Data: string, filename: string = 'output.mp3'): Promise<void> {
    const audioBytes: Buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filename, audioBytes);
  }

  async generate_audio(text: string, voice: string): Promise<Buffer> {
    const url: string = ENDPOINTS[this.current_endpoint];
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };
    const data: { text: string; voice: string } = { text, voice };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return buffer;
  }

  async tts(
    text: string,
    voice: string = 'none',
    filename: string = 'output.mp3',
    play_sound: boolean = false,
  ): Promise<void> {
    // Checking if the website is available
    const response = await this.get_api_response();
    if (response.status === 200) {
      console.log(colors.green('[+] TikTok TTS Service available!'));
    } else {
      this.current_endpoint = (this.current_endpoint + 1) % 2;
      if ((await this.get_api_response()).status === 200) {
        console.log(colors.green('[+] TTS Service available!'));
      } else {
        console.log(
          colors.red('[-] TTS Service not available and probably temporarily rate limited, try again later...'),
        );
        return;
      }
    }

    // Checking if arguments are valid
    if (voice === 'none') {
      console.log(colors.red('[-] Please specify a voice'));
      return;
    }

    if (!VOICES.includes(voice)) {
      console.log(colors.red('[-] Voice not available'));
      return;
    }

    if (!text) {
      console.log(colors.red('[-] Please specify a text'));
      return;
    }

    // Creating the audio file
    try {
      let audioBase64Data: string;
      if (text.length < this.TEXT_BYTE_LIMIT) {
        const audio = await this.generate_audio(text, voice);
        if (this.current_endpoint === 0) {
          audioBase64Data = audio.toString().split('"')[5];
        } else {
          audioBase64Data = audio.toString().split('"')[3].split(',')[1];
        }

        if (audioBase64Data === 'error') {
          console.log(colors.red('[-] This voice is unavailable right now'));
          return;
        }
      } else {
        // Split longer text into smaller parts
        const textParts = this.split_string(text, 299);
        const audioBase64DataArray: string[] = Array(textParts.length).fill(null);

        const that = this;
        // Define a function to generate audio for each text part
        async function generate_audio_thread(text_part: string, index: number): Promise<void> {
          const audio = await that.generate_audio(text_part, voice);
          let base64Data: string;
          if (that.current_endpoint === 0) {
            base64Data = audio.toString().split('"')[5];
          } else {
            base64Data = audio.toString().split('"')[3].split(',')[1];
          }

          if (base64Data === 'error') {
            console.log(colors.red('[-] This voice is unavailable right now'));
            return;
          }

          audioBase64DataArray[index] = base64Data;
        }

        // Create and start a new thread for each text part
        const threads: Promise<void>[] = [];
        for (let index = 0; index < textParts.length; index++) {
          threads.push(generate_audio_thread(textParts[index], index));
        }

        // Wait for all threads to complete
        await Promise.all(threads);

        // Concatenate the base64 data in the correct order
        audioBase64Data = audioBase64DataArray.join('');
      }

      await this.save_audio_file(audioBase64Data, filename);
      console.log(colors.green("[+] Audio file saved successfully as '" + filename + "'"));
      if (play_sound) {
        player.play(filename);
      }
    } catch (error) {
      console.log(colors.red('[-] An error occurred during TTS: ' + (error as Error).message));
    }
  }
}

export default new TikTokVoice();
