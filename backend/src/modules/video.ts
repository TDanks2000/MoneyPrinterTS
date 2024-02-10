import fs from 'node:fs';
import path from 'node:path';
import uuid from 'uuid';
import { assemblyai } from '../utils';

class Video {
  async save_video(video_url: string, directory: string = '../temp'): Promise<string> {
    const videoId: string = uuid.v4();
    const videoPath: string = path.join(directory, `${videoId}.mp4`);
    const response = await fetch(video_url);
    const videoData = await response.arrayBuffer();
    fs.writeFileSync(videoPath, Buffer.from(videoData));
    return videoPath;
  }

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
}
