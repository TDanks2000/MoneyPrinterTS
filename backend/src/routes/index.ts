import { FastifyInstance, FastifyReply, FastifyRequest, RegisterOptions } from 'fastify';
import { GPTModel } from '../types/types';

import colors from 'colors';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe';
import { path as ffprobePath } from 'ffprobe-static';
import { exec } from 'node:child_process';
import path from 'node:path';
import * as uuid from 'uuid';
import gpt from '../modules/gpt';
import search from '../modules/search';
import tiktokvoice from '../modules/tiktokvoice';
import video from '../modules/video';
import { cleanDir, fetchSongs } from '../utils';

const TIKTOK_SESSION_ID = process.env.TIKTOK_SESSION_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Constants
const AMOUNT_OF_STOCK_VIDEOS: number = 5;
let GENERATING: boolean = false;

interface Data {
  paragraphNumber?: number;
  aiModel?: GPTModel;
  useMusic?: boolean;
  zipUrl?: string;
  voice?: string;
  videoSubject: string;
}

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  fastify.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let body = request.body as Data;
      let data: Data = {
        aiModel: 'gpt3.5-turbo',
        paragraphNumber: 1,
        useMusic: false,
        zipUrl: 'https://filebin.net/2avx134kdibc4c3q/drive-download-20240209T180019Z-001.zip',
        voice: 'en_us_001',
        ...body,
      };

      if (GENERATING) return reply.status(400).send({ message: 'Generating' });
      GENERATING = true;

      const tempLoc = path.join(__dirname, '../../temp/');
      const subtitleLoc = path.join(__dirname, '../../subtitles/');

      cleanDir(tempLoc);
      cleanDir(subtitleLoc);

      if (data.useMusic) fetchSongs(data.zipUrl!);

      //  Print little information about the video which is to be generated
      console.log(colors.blue('[Video to be generated]\n'));
      console.log(colors.blue('Subject: ' + data['videoSubject']) + '\n');
      console.log(colors.blue('AI Model: ' + data.aiModel)); // Print the AI model being used

      if (!GENERATING) {
        return JSON.stringify({
          status: 'error',
          message: 'Video generation was cancelled.',
          data: [],
        });
      }

      // Generate a script
      const script = await gpt.generate_script(data['videoSubject'], data.paragraphNumber!, data.aiModel!, data.voice!);

      // Generate search terms
      const searchTerms = await gpt.get_search_terms(
        data['videoSubject'],
        AMOUNT_OF_STOCK_VIDEOS,
        script,
        data.aiModel!,
      );

      //Search for a video of the given search term
      let video_urls: string[] = [];

      // Defines how many results it should query and search through
      let it = 15;

      // Defines the minimum duration of each clip
      let min_dur = 10;

      // Loop through all search terms,
      // and search for a video of the given search term
      for (const searchTerm of searchTerms) {
        if (!GENERATING) {
          return JSON.stringify({
            status: 'error',
            message: 'Video generation was cancelled.',
            data: [],
          });
        }

        const foundUrls = await search.search_for_stock_videos(searchTerm, it, min_dur); // Assuming searchForStockVideos is implemented

        for (const url of foundUrls) {
          if (!video_urls.includes(url)) {
            video_urls.push(url);
            break; // Add and break to avoid duplicates
          }
        }
      }

      //Define video_paths
      let video_paths: string[] = [];

      console.log(colors.blue(`[+] Downloading ${video_urls.length} videos...`));

      //Save the videos
      for (const video_url of video_urls) {
        if (!GENERATING) {
          return JSON.stringify({
            status: 'error',
            message: 'Video generation was cancelled.',
            data: [],
          });
        }
        try {
          const saved_video_path = await video.save_video(video_url, tempLoc);
          video_paths.push(saved_video_path);
        } catch (error) {
          console.error(colors.red(`[-] Could not download video: ${video_url}`));
          console.error(error);
        }
      }

      // Let user know
      console.log(colors.green('[+] Videos downloaded!'));

      // Let user know
      console.log(colors.green('[+] Script generated!\n'));

      if (!GENERATING) {
        return JSON.stringify({
          status: 'error',
          message: 'Video generation was cancelled.',
          data: [],
        });
      }

      // Split script into sentences
      let sentences: string[] = script.split('. ');

      // Remove empty strings
      sentences = sentences.filter((x) => x !== '');
      let paths: string[] = [];

      // Generate TTS for every sentence
      for (const sentence of sentences) {
        if (!GENERATING) {
          return JSON.stringify({
            status: 'error',
            message: 'Video generation was cancelled.',
            data: [],
          });
        }

        let current_tts_path: string = path.join(tempLoc, `${uuid.v4()}.mp3`);
        await tiktokvoice.tts(sentence, data.voice, current_tts_path);
        paths.push(current_tts_path);
      }

      // Combine all TTS files
      const tts_path = path.join(tempLoc, `${uuid.v4()}.mp3`);
      await concatenateAudioClips(paths, tts_path);

      let subtitle_path: string;
      try {
        subtitle_path = await video.generate_subtitles(tts_path, sentences, paths);
      } catch (error) {
        console.log(colors.red(`[-] Error generating subtitles: ${error}`));
        subtitle_path = '';
      }

      // Concatenate videos
      const temp_audio = await getAudioInfo(tts_path);
      let combined_video_path = await video.combine_videos(video_paths, temp_audio.duration, 5);

      // Put Everything Together
      let final_video_path: string;
      try {
        final_video_path = await video.generate_video(combined_video_path, tts_path, subtitle_path);
      } catch (error) {
        console.error(colors.red(`[-] Error generating final video: ${error}`));
        final_video_path = '';
      }

      GENERATING = false;

      return JSON.stringify({
        status: 'success',
        message: 'Video generated! See MoneyPrinter/output.mp4 for result.',
        data: final_video_path,
      });
    } catch (error) {
      GENERATING = false;
      return {
        error: (error as Error).message,
        stacktrace: JSON.stringify((error as Error).stack),
      };
    }
  });
};

export { routes };

function concatenateAudioClips(inputFilePaths: string[], outputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const inputFiles = inputFilePaths.map((path) => `-i ${path}`).join(' ');
    const filter = inputFilePaths.map((_, index) => `[${index}:a:0]`).join('');
    const command = `${ffmpegPath} ${inputFiles} -filter_complex "${filter}concat=n=${inputFilePaths.length}:v=0:a=1[a]" -map "[a]" ${outputFilePath} -y`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error occurred while concatenating audio clips:', error);
        reject(error);
      } else {
        console.log('Audio clips concatenated successfully!');
        resolve();
      }
    });
  });
}

interface AudioInfo {
  duration: number;
  sampleRate: number;
}

async function getAudioInfo(inputFilePath: string): Promise<AudioInfo> {
  try {
    const audioInfo = await ffprobe(inputFilePath, { path: ffprobePath });

    const audioStream = audioInfo.streams.find((stream) => stream.codec_type === 'audio');

    if (!audioStream) {
      throw new Error('Audio stream not found in the file.');
    }

    return {
      duration: parseFloat(audioStream.duration ?? '0'),
      sampleRate: audioStream.sample_rate ?? 0,
    };
  } catch (error) {
    console.error('Error occurred while getting audio info:', error);
    throw error;
  }
}

function parseDuration(outputLines: string[]): number {
  const durationLine = outputLines.find((line) => line.includes('Duration'));
  if (!durationLine) {
    throw new Error('Duration information not found');
  }
  const durationMatch = durationLine.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!durationMatch) {
    throw new Error('Failed to parse duration');
  }
  const hours = parseInt(durationMatch[1]);
  const minutes = parseInt(durationMatch[2]);
  const seconds = parseFloat(durationMatch[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseSampleRate(outputLines: string[]): number {
  const streamLine = outputLines.find((line) => line.includes('Audio') && line.includes('Hz'));
  if (!streamLine) {
    throw new Error('Audio stream information not found');
  }
  const sampleRateMatch = streamLine.match(/(\d+) Hz/);
  if (!sampleRateMatch) {
    throw new Error('Failed to parse sample rate');
  }
  return parseInt(sampleRateMatch[1]);
}
