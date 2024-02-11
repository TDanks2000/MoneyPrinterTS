class Search {
  async search_for_stock_videos(query: string, it: number, min_dur: number): Promise<string[]> {
    const api_key = process.env.PEXELS_API_KEY!;

    const headers: RequestInit['headers'] = {
      Authorization: api_key,
    };

    const r = await fetch(`https://api.pexels.com/videos/search?query=${query}&per_page=${it}`, {
      headers,
    });

    const response = await r.json();

    const rawUrls: any[] = [];
    const videoUrls: string[] = [];
    let videoRes: number = 0;

    try {
      for (let i = 0; i < it; i++) {
        if (response['videos'][i]['duration'] < min_dur) {
          continue;
        }

        rawUrls.length = 0; // Clear the array before reusing
        rawUrls.push(...response['videos'][i]['video_files']); // Spread operator to push all elements

        let tempVideoUrl = '';

        for (const video of rawUrls) {
          if (video['link'].includes('.com/external')) {
            const resolution = video['width'] * video['height'];
            if (resolution > videoRes) {
              tempVideoUrl = video['link'];
              videoRes = resolution;
            }
          }
        }

        if (tempVideoUrl !== '') {
          videoUrls.push(tempVideoUrl);
        }
      }
    } catch (error) {
      console.log('\x1b[31m[-] No Videos found.\x1b[0m');
      console.log('\x1b[31m' + error + '\x1b[0m');
    }

    console.log(`\x1b[36m\t=> "${query}" found ${videoUrls.length} Videos\x1b[0m`);
    return videoUrls;
  }
}

export default new Search();
