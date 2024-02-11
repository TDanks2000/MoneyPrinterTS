declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
      ASSEMBLY_AI_API_KEY: string;
      TIKTOK_SESSION_ID: string;
      PEXELS_API_KEY: string;
    }
  }
}
export {};
