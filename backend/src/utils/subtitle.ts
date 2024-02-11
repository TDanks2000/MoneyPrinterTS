import * as fs from 'fs';

interface Subtitle {
  text: string;
  startTime: number;
  endTime: number;
}

class Subtitle {
  subtitles: Subtitle[] = [];
  filePath: string = '';
  font?: string;

  constructor(subtitles: Subtitle[], filePath: string, font?: string) {
    this.subtitles = subtitles;
    this.filePath = filePath;
    this.font = font;
  }

  createSRTFile(): void {
    let srtContent = '';

    // If custom font is provided, add font information
    if (this.font) {
      srtContent += `1\n<font color="white" face="${this.font}">.\n\n`;
    }

    // Add subtitles
    this.subtitles.forEach((subtitle, index) => {
      const subtitleIndex = this.font ? index + 2 : index + 1;
      srtContent += `${subtitleIndex}\n${this.formatTime(subtitle.startTime)} --> ${this.formatTime(
        subtitle.endTime,
      )}\n${subtitle.text}\n\n`;
    });

    fs.writeFileSync(this.filePath, srtContent);
    console.log(`SRT file saved at ${this.filePath}`);
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(remainingSeconds)},000`;
  }

  padZero(num: number): string {
    return num.toString().padStart(2, '0');
  }
}

export default Subtitle;
