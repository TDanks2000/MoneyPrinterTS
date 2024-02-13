import { spawn } from 'child_process';
import colors from 'colors';
import ffmpegPath from 'ffmpeg-static';
import Jimp from 'jimp';
import fs from 'node:fs';
import path from 'node:path';
import { cleanDir } from '.';

//  FIXME: This whole function needs fixing

class Crop {
  inputFilePath: string;
  outputFilePath: string;

  private frameDir: string;

  constructor(inputFilePath: string, outputFilePath: string) {
    this.inputFilePath = inputFilePath;
    this.outputFilePath = outputFilePath;

    this.frameDir = path.join(this.inputFilePath, '/temp');
  }

  async start(resolution: { width: number; height: number }, format: 'jpg' | 'png' | 'bmp' = 'png') {
    try {
      await this.cleanFrames();
      await this.createFrames(format);
      await this.cropFrames(resolution);
      await this.framesToVideo();
      await this.cleanFrames();
    } catch (error) {
      console.log(error);
    }
  }

  private async createFrames(format: 'jpg' | 'png' | 'bmp' = 'png'): Promise<void> {
    try {
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath!, [
          '-i',
          this.inputFilePath,
          '-vsync',
          '0', // Pass through frames without drops or duplicates
          '-f',
          'image2',
          `${this.frameDir}/frame-%03d.${format}`,
        ]);

        ffmpeg.stdout.on('data', (data) => console.log(colors.green(`stdout: ${data}`))); // Colorize stdout
        ffmpeg.stderr.on('data', (data) => console.error(colors.red(`stderr: ${data}`))); // Colorize stderr

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve(undefined);
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      console.error(colors.red(`Error exporting frames: ${(error as Error).message}`)); // Colorize error message
    }
  }

  private async cropFrames(resolution: { width: number; height: number }) {
    const files = fs.readdirSync(this.inputFilePath);

    const promises = files.map(async (file) => {
      const filePath = path.join(this.inputFilePath, file);
      const image = await Jimp.read(filePath);

      // Crop image to specified resolution
      image.crop(0, 0, resolution.width, resolution.height);

      // Overwrite the original image
      await image.writeAsync(filePath);
      console.log(colors.yellow(`Cropped and saved: ${filePath}`)); // Colorize message
    });

    await Promise.all(promises);
  }

  private async framesToVideo(fps: number = 30) {
    return new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpegPath!, [
        '-framerate',
        fps.toString(),
        '-pattern_type',
        'glob',
        '-i',
        `${this.frameDir}/*.{jpg,png,bmp}`, // Allow various frame formats
        '-c:v',
        'libx264', // Use efficient H.264 codec
        this.inputFilePath,
      ]);

      ffmpegProcess.stdout.on('data', (data) => console.log(`ffmpeg stdout: ${data}`));
      ffmpegProcess.stderr.on('data', (data) => console.error(`ffmpeg stderr: ${data}`));

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        reject(error);
      });
    }).catch((error) => {
      console.error('Error combining frames to video:', error);
    });
  }

  private async cleanFrames() {
    try {
      console.log(colors.yellow('Cleaning frames...'));
      cleanDir(this.frameDir);
    } catch (error) {
      console.error(colors.red(`Error cleaning frames: ${(error as Error).message}`));
    }
  }
}

export default Crop;
