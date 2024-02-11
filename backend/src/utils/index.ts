import AdmZip from 'adm-zip'; // Using adm-zip for unzipping
import { AssemblyAI } from 'assemblyai';
import colors from 'colors';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY!,
});

export const cleanDir = (cleanFilePath: string): void => {
  try {
    if (!fs.existsSync(cleanFilePath)) {
      fs.mkdirSync(cleanFilePath);
      console.info(colors.green(`Created directory: ${cleanFilePath}`));
    }

    const files = fs.readdirSync(cleanFilePath);
    for (const file of files) {
      const filePath = path.join(cleanFilePath, file);
      fs.unlinkSync(filePath);
      console.info(colors.green(`Removed file: ${filePath}`));
    }

    console.info(colors.green(`Cleaned ${cleanFilePath} directory`));
  } catch (error) {
    console.error(colors.red(`Error occurred while cleaning directory ${cleanFilePath}: ${(error as Error).message}`));
  }
};

export const fetchSongs = (zipUrl: string): void => {
  try {
    console.info(colors.magenta(' => Fetching songs...'));

    const filesDir = path.join(__dirname, '..', 'Songs'); // Use path.join for path construction
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir);
      console.info(colors.green(`Created directory: ${filesDir}`));
    }

    // Download songs
    fetch(zipUrl)
      .then(async (response) => {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }) // Read response as buffer
      .then((buffer) => {
        fs.writeFileSync(path.join(filesDir, 'songs.zip'), buffer);

        // Unzip the file
        const zip = new AdmZip(path.join(filesDir, 'songs.zip'));
        zip.extractAllTo(filesDir);
        fs.unlinkSync(path.join(filesDir, 'songs.zip'));

        console.info(colors.green(' => Downloaded Songs to ../Songs.'));
      })
      .catch((error) => {
        console.error(colors.red(`Error downloading songs: ${(error as Error).message}`));
      });
  } catch (error) {
    console.error(colors.red(`Error occurred while fetching songs: ${(error as Error).message}`));
  }
};

export const chooseRandomSong = (): string => {
  try {
    const songsDir = path.join(__dirname, '..', 'Songs'); // Use path.join for path construction
    const songs = fs.readdirSync(songsDir);

    if (songs.length === 0) {
      throw new Error('No songs found in the Songs directory.');
    }

    const randomIndex = Math.floor(Math.random() * songs.length);
    const song = songs[randomIndex];
    console.info(colors.green(`Chose song: ${song}`));
    return path.join(songsDir, song);
  } catch (error) {
    console.error(colors.red(`Error occurred while choosing random song: ${(error as Error).message}`));
    throw error; // Re-throw to propagate the error
  }
};
