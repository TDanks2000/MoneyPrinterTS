import { exec } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe';
import { path as ffprobePath } from 'ffprobe-static';
import ora from 'ora';
import { promisify } from 'util';
import Crop from './crop';

interface VideoInfo {
  duration: number;
  fps: number;
  width: number;
  height: number;
  [x: string]: string | number;
}

class VideoProcessor {
  inputFilePath: string;
  outputFilePath: string;

  duration: number | null = null;
  fps: number | null = null;
  width: number | null = null;
  height: number | null = null;

  constructor(inputFilePath: string, outputFilePath: string) {
    this.inputFilePath = inputFilePath;
    this.outputFilePath = outputFilePath;
  }

  async getVideoInfo(): Promise<VideoInfo> {
    const info = await ffprobe(this.inputFilePath, { path: ffprobePath });
    const stream = info.streams[0]; // Assuming the first stream is the video stream

    return {
      duration: parseFloat(stream.duration ?? '0'),
      fps: parseFloat(stream.r_frame_rate),
      width: stream.width ?? 0,
      height: stream.height ?? 0,
      bit_rate: stream.bit_rate ?? 0,
    };
  }

  async cropVideoTo1920x1080(): Promise<void> {
    try {
      const crop = new Crop(this.inputFilePath, this.inputFilePath);
      await crop.start({ width: 1920, height: 1080 });
      return;
    } catch (error) {
      throw error;
    }
  }

  async subclip(t_start: number | string, t_end?: number | string): Promise<string | null> {
    const spinner = ora(`clipping ${this.inputFilePath}`).start();
    try {
      let start_sec: number = typeof t_start === 'string' ? this.convertTimeStringToSeconds(t_start) : t_start;
      let end_sec: number;

      const duration_command = `${ffmpeg} -i ${this.inputFilePath} -hide_banner -f null -`;
      const { stderr: duration_output } = await promisify(exec)(duration_command);

      const duration_match = duration_output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
      if (!duration_match) {
        throw new Error('Failed to parse duration');
      }

      const hours = parseInt(duration_match[1]);
      const minutes = parseInt(duration_match[2]);
      const seconds = parseFloat(duration_match[3]);
      const clip_duration = hours * 3600 + minutes * 60 + seconds;

      if (t_end !== undefined) {
        end_sec = typeof t_end === 'string' ? this.convertTimeStringToSeconds(t_end) : t_end;
        if (end_sec < 0) {
          end_sec = clip_duration + end_sec;
        }
      } else {
        end_sec = clip_duration;
      }

      let command = `${ffmpeg} -i ${this.inputFilePath} -ss ${start_sec} -c copy -y`;
      if (end_sec !== undefined) {
        command += ` -to ${end_sec}`;
      }
      command += ` ${this.outputFilePath}`;

      if (end_sec <= start_sec - 1) return this.inputFilePath;
      await promisify(exec)(command);

      this.duration = end_sec - start_sec;
      console.log('Subclip created successfully!');
      spinner.succeed('Subclip created successfully!');

      return this.outputFilePath;
    } catch (error) {
      throw error;
    }
  }

  async setFPS(fps: number): Promise<void> {
    const command = `${ffmpeg} -i ${this.inputFilePath} -vf "fps=${fps}" -c:a copy ${this.outputFilePath} -y`;
    await promisify(exec)(command);

    this.fps = fps;
    console.log('FPS set successfully!');
  }

  async removeAudio(): Promise<void> {
    const spinner = ora(`Removing audio from ${this.inputFilePath}`).start();
    try {
      const command = `${ffmpeg} -i ${this.inputFilePath} -c:v copy -an ${this.outputFilePath} -y`;
      await promisify(exec)(command);

      console.log('Audio removed successfully!');
      spinner.succeed('Audio removed successfully!');
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }

  private parseDuration(outputLines: string[]): number {
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

  private parseFPS(outputLines: string[]): number {
    const fpsLine = outputLines.find((line) => line.includes('fps'));
    if (!fpsLine) {
      throw new Error('FPS information not found');
    }
    const fpsMatch = fpsLine.match(/(\d+(?:\.\d+)?) fps/);
    if (!fpsMatch) {
      throw new Error('Failed to parse FPS');
    }
    return parseFloat(fpsMatch[1]);
  }

  private parseWidth(outputLines: string[]): number {
    const streamLine = outputLines.find((line) => line.includes('Video'));
    if (!streamLine) {
      throw new Error('Video stream information not found');
    }
    const dimensionMatch = streamLine.match(/\b(\d+)x(\d+)\b/);
    if (!dimensionMatch) {
      throw new Error('Failed to parse video dimension');
    }
    return parseInt(dimensionMatch[1]);
  }

  private parseHeight(outputLines: string[]): number {
    const streamLine = outputLines.find((line) => line.includes('Video'));
    if (!streamLine) {
      throw new Error('Video stream information not found');
    }
    const dimensionMatch = streamLine.match(/\b(\d+)x(\d+)\b/);
    if (!dimensionMatch) {
      throw new Error('Failed to parse video dimension');
    }
    return parseInt(dimensionMatch[2]);
  }

  private convertTimeStringToSeconds = (time_string: string): number => {
    const [hours, minutes, seconds] = time_string.split(':').map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  };

  async hasAudio(): Promise<boolean> {
    const command = `${ffmpeg} -i ${this.inputFilePath} -f null -`;
    const { stderr } = await promisify(exec)(command);
    return this.checkHasAudio(stderr.split('\n'));
  }

  private checkHasAudio(outputLines: string[]): boolean {
    for (const line of outputLines) {
      if (line.includes('Audio')) {
        return true;
      }
    }
    return false;
  }
}

export default VideoProcessor;
