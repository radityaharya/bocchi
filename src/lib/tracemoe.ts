import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';

export type TraceMoeResultItem = {
  anilist: number;
  filename: string;
  episode: number | null;
  from: number;
  to: number;
  similarity: number;
  video: string;
  image: string;
};

export type TraceMoeResult = {
  frameCount: number;
  error: string;
  result: TraceMoeResultItem[];
  limit: {
    limit: number;
    remaining: number;
    reset: number;
  };
};

async function processImage(imageSource: Buffer | string) {
  return await sharp(imageSource).resize({ width: 500 }).jpeg().toBuffer();
}

function appendImageToFormData(formData: FormData, imageBuffer: Buffer) {
  formData.append('image', imageBuffer, {
    filename: 'blob',
    contentType: 'image/jpeg',
  });
}
export async function getAnimeSauce({
  tempFilePath,
  base64Image,
}: {
  tempFilePath?: string;
  base64Image?: string;
}): Promise<TraceMoeResult> {
  const formData = new FormData();
  let imageBuffer: Buffer;

  if (base64Image) {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    imageBuffer = Buffer.from(base64Data, 'base64');
  } else if (tempFilePath) {
    imageBuffer = fs.readFileSync(tempFilePath);
  } else {
    throw new Error('Either a file path or a base64 string must be provided');
  }

  try {
    const resizedBuffer = await processImage(imageBuffer);
    appendImageToFormData(formData, resizedBuffer);
  } catch (err) {
    console.error('Error processing image data:', err);
    console.error('Base64 string:', base64Image);
  }

  const traceResponse = (await axios.post(
    'https://api.trace.moe/search?cutBorders',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        'Accept-Encoding': 'gzip, deflate',
      },
    },
  )) as {
    status: number;
    data: TraceMoeResult;
    headers: Record<string, string>;
  };

  if (traceResponse.status !== 200) {
    console.error(traceResponse.data);
    throw new Error('Failed to get anime sauce');
  }

  if (tempFilePath) {
    fs.unlink(tempFilePath, (err) => {
      if (err) {
        console.error('Failed to delete temp file:', err);
      }
    });
  }

  return {
    ...traceResponse.data,
    limit: {
      limit: Number(traceResponse.headers['x-ratelimit-limit']),
      remaining: Number(traceResponse.headers['x-ratelimit-remaining']),
      reset: Number(traceResponse.headers['x-ratelimit-reset']),
    },
  };
}

interface Title {
  romaji: string;
  english: string;
  native: string;
}

interface Date {
  year: number;
  month: number;
  day: number;
}

interface NextAiringEpisode {
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
}

interface Tag {
  name: string;
  description: string;
  category: string;
}

interface Name {
  full: string;
  native: string;
}

interface CharacterNode {
  gender: string;
  description: string | null;
  name: Name;
}

interface CharacterEdge {
  node: CharacterNode;
}

interface StudioNode {
  name: string;
}

interface StudioEdge {
  node: StudioNode;
}

interface RelationNode {
  id: number;
  type: string;
  title: Title;
}

interface RelationEdge {
  node: RelationNode;
}

interface Media {
  id: number;
  idMal: number;
  title: Title;
  startDate: Date;
  endDate: Date;
  season: string;
  seasonYear: number;
  format: string;
  status: string;
  episodes: number;
  duration: number;
  chapters: number | null;
  volumes: number | null;
  genres: string[];
  isAdult: boolean;
  averageScore: number;
  popularity: number;
  favourites: number;
  nextAiringEpisode: NextAiringEpisode;
  description: string;
  tags: Tag[];
  characters: {
    edges: CharacterEdge[];
  };
  studios: {
    edges: StudioEdge[];
  };
  relations: {
    edges: RelationEdge[];
  };
}

interface Data {
  Media: Media;
}

export interface AnilistResponse {
  data: Data;
}

export async function getAnimeDetails(
  anilistId: number,
): Promise<AnilistResponse> {
  console.log('🚀 ~ getAnimeDetails ~ getAnimeDetails:', anilistId);
  const anilistResponse = (await axios.post(
    'https://graphql.anilist.co',
    {
      query: `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          season
          seasonYear
          format
          status
          episodes
          duration
          chapters
          volumes
          genres
          isAdult
          averageScore
          popularity
          favourites
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          description(asHtml: false)
          tags {
            name
            description
            category
          }
          characters {
            edges {
              node {
                gender
                description
                name {
                  full
                  native 
                }
              }
            }
          }
          studios {
            edges {
              node {
                name
              }
            }
          }
          relations {
            edges {
              node {
                id
                type
                title {
                  english
                  native
                  romaji
                }
              }
            }
          }
        }
    }
    `,
      variables: {
        id: anilistId,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate', //https://github.com/oven-sh/bun/issues/267#issuecomment-2044596837
      },
    },
  )) as {
    status: number;
    data: AnilistResponse;
  };
  if (anilistResponse.status !== 200)
    throw new Error('Failed to get anime details');
  return anilistResponse.data;
}
