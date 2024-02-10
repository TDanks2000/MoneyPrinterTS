import colors from 'colors';
import fs from 'node:fs';
import path from 'node:path';
import uuid from 'uuid';
import { assemblyai } from '../utils';

class Video {
  /**
   * Saves a video from a given URL and returns the path to the video.
   *
   * @param {string} video_url - The URL of the video to save.
   * @param {string} [directory="../temp"] - The path of the temporary directory to save the video to.
   * @returns {string} The path to the saved video.
   */
  async save_video(video_url: string, directory: string = '../temp'): Promise<string> {
    const video_id: string = uuid.v4();
    const video_path: string = path.join(directory, `${video_id}.mp4`);
    const response = await fetch(video_url);
    const video_data = await response.arrayBuffer();
    fs.writeFileSync(video_path, Buffer.from(video_data));
    return video_path;
  }

  /**
   * Generates subtitles from a given audio file and returns the path to the subtitles.
   *
   * @param {string} audio_path - The path to the audio file to generate subtitles from.
   * @returns {string} The generated subtitles.
   */

  async __generate_subtitles_assemblyai(audio_path: string): Promise<string> {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: audio_path,
    });

    if (transcript.status === 'error') {
      throw new Error(transcript.error);
    }

    const url = `https://api.assemblyai.com/v2/transcript/${transcript.id}/srt`;

    const r = await fetch(url, {
      headers: {
        authorization: process.env.ASSEMBLY_AI_API_KEY,
      },
    });

    const subtitles = await r.text();
    return subtitles;
  }

  /**
   * Generates subtitles from a given audio file and returns the path to the subtitles.
   *
   * @param {string[]} sentences - All the sentences said out loud in the audio clips.
   * @param {any[]} audio_clips - All the individual audio clips which will make up the final audio track.
   * @returns {string} The generated subtitles.
   */
  async __generate_subtitles_locally(sentences: string[], audio_clips: any[]): Promise<string> {
    const convertToSrtTimeFormat = (totalSeconds: number): string =>
      totalSeconds === 0 ? '0:00:00,0' : new Date(totalSeconds * 1000).toISOString().substr(11, 12).replace('.', ',');

    let start_time: number = 0;
    let subtitles: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const audio_clip = audio_clips[i];
      const duration = audio_clip.duration;
      const end_time = start_time + duration;

      // Format: subtitle index, start time --> end time, sentence
      const subtitleEntry = `${i + 1}\n${convertToSrtTimeFormat(start_time)} --> ${convertToSrtTimeFormat(
        end_time,
      )}\n${sentence}\n`;
      subtitles.push(subtitleEntry);

      start_time += duration; // Update start time for the next subtitle
    }

    return subtitles.join('\n');
  }

  /**
   * Generates subtitles from a given audio file and returns the path to the subtitles.
   *
   * @param {string} audio_path - The path to the audio file to generate subtitles from.
   * @param {string[]} sentences - All the sentences said out loud in the audio clips.
   * @param {any[]} audio_clips - All the individual audio clips which will make up the final audio track.
   * @returns {string} The path to the generated subtitles.
   */
  async generate_subtitles(audio_path: string, sentences: string[], audio_clips: any[]): Promise<string> {
    const subtitles_path = `../subtitles/${uuid.v4()}.srt`;
    let subtitles: string;

    if (process.env.ASSEMBLY_AI_API_KEY !== '') {
      console.log(colors.blue('[+] Creating subtitles using AssemblyAI'));
      subtitles = await this.__generate_subtitles_assemblyai(audio_path);
    } else {
      console.log(colors.blue('[+] Creating subtitles locally'));
      subtitles = await this.__generate_subtitles_locally(sentences, audio_clips);
      // console.log(colored("[-] Local subtitle generation has been disabled for the time being.", "red"));
      // console.log(colored("[-] Exiting.", "red"));
      // process.exit(1);
    }

    try {
      await fs.promises.writeFile(subtitles_path, subtitles);
    } catch (error) {
      console.log(colors.red(`[-] Error writing subtitles to file: ${error}`));
      return `Error writing subtitles to file: ${error}`;
    }

    console.log(colors.green('[+] Subtitles created successfully'));
    return subtitles_path;
  }

  /**
   * Combines a list of videos into one video and returns the path to the combined video.
   *
   * @param {string[]} video_paths - A list of paths to the videos to combine.
   * @param {number} max_duration - The maximum duration of the combined video.
   * @param {number} max_clip_duration - The maximum duration of each clip.
   * @returns {string} The path to the combined video.
   */
  async combine_videos(video_paths: string[], max_duration: number, max_clip_duration: number): Promise<string> {
    //  TODO: Implement this function to combine a list of videos into one video.
    throw new Error('Method not implemented');
  }

  /**
   * This function creates the final video, with subtitles and audio.
   *
   * @param {string} combined_video_path - The path to the combined video.
   * @param {string} tts_path - The path to the text-to-speech audio.
   * @param {string} subtitles_path - The path to the subtitles.
   * @returns {string} The path to the final video.
   */
  async generate_video(combined_video_path: string, tts_path: string, subtitles_path: string): Promise<string> {
    // TODO: Implement this function to generate the final video with subtitles and audio.
    throw new Error('Method not implemented');
  }
}
