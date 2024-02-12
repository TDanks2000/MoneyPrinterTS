import { exec } from 'child_process';
import ffmpeg from 'ffmpeg-static';

interface VideoInfo {
  duration: number;
  fps: number;
  width: number;
  height: number;
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

  getVideoInfo(): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const command = `${ffmpeg} -i ${this.inputFilePath} -f null -`;

      exec(command, (error, stdout, stderr) => {
        console.log('stderr');
        console.log({ stderr });
        if (error) {
          console.error('Error occurred while getting video info:', error);
          reject(error);
          return;
        }

        const outputLines = stderr.split('\n');
        const info: VideoInfo = {
          duration: this.parseDuration(outputLines),
          fps: this.parseFPS(outputLines),
          width: this.parseWidth(outputLines),
          height: this.parseHeight(outputLines),
        };

        this.duration = info.duration;
        this.fps = info.fps;
        this.width = info.width;
        this.height = info.height;

        resolve(info);
      });
    });
  }

  cropVideoTo1920x1080(): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `${ffmpeg} -i ${this.inputFilePath} -vf "crop=1920:1080" -c:a copy -c:v libx264 -preset veryfast ${this.outputFilePath} -y`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Error occurred while cropping the video:', error);
          reject(error);
        } else {
          this.width = 1920;
          this.height = 1080;
          console.log('Video cropped successfully!');
          resolve();
        }
      });
    });
  }

  subclip = (t_start: number | string, t_end?: number | string): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      let start_sec: number = typeof t_start === 'string' ? this.convertTimeStringToSeconds(t_start) : t_start;
      let end_sec: number;

      const duration_command = `${ffmpeg} -i ${this.inputFilePath} -hide_banner -f null -`;
      exec(duration_command, (error, stdout, stderr) => {
        if (error) {
          console.error('Error occurred while fetching duration:', error);
          reject(error);
          return;
        }

        const duration_output = stderr.toString();
        const duration_match = duration_output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
        if (!duration_match) {
          console.error('Failed to parse duration from FFmpeg output:', duration_output);
          reject(new Error('Failed to parse duration'));
          return;
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
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error('Error occurred while creating subclip:', error);
            reject(error);
          } else {
            this.duration = end_sec - start_sec;
            console.log('Subclip created successfully!');
            resolve(this.outputFilePath);
          }
        });
      });
    });
  };

  convertTimeStringToSeconds = (time_string: string): number => {
    const [hours, minutes, seconds] = time_string.split(':').map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  };

  setFPS(fps: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `${ffmpeg} -i ${this.inputFilePath} -vf "fps=${fps}" -c:a copy ${this.outputFilePath} -y`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Error occurred while setting fps:', error);
          reject(error);
        } else {
          this.fps = fps;
          console.log('FPS set successfully!');
          resolve();
        }
      });
    });
  }

  removeAudio(): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `${ffmpeg} -i ${this.inputFilePath} -c:v copy -an ${this.outputFilePath} -y`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Error occurred while removing audio:', error);
          reject(error);
        } else {
          console.log('Audio removed successfully!');
          resolve(undefined);
        }
      });
    });
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
}

export default VideoProcessor;
