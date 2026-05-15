import * as lambda from 'aws-lambda';
import { z } from 'zod';
import {
  TavilySearchResult, // type/src/agent.d.ts
  WebSearchResponse,
  WebSearchResultItem, // defined in type/src/protocol.d.ts:214
} from 'generative-ai-use-cases';

const MAX_RESULTS = 5;

const webSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
});

const searchUsingTavily = async ( // ask Tavily to search, reshape into WebSearchResultItem[]
  query: string
): Promise<WebSearchResultItem[]> => {
  const searchUrl = 'https://api.tavily.com/search';
  const searchApiKey = process.env.SEARCH_API_KEY || '';
  const response = await fetch(searchUrl, { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${searchApiKey}`,
    },
    body: JSON.stringify({ // what we send
      query,
      search_depth: 'basic',
      include_answer: false,
      include_images: false,
      include_raw_content: false,
      max_results: MAX_RESULTS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily Search API failed: ${response.status}`);
  }
  const data = await response.json(); // parse Tavily's JSON string into a JS object
  return (data.results ?? []).map(
    (result: TavilySearchResult): WebSearchResultItem => ({ // arg is of type TavilySearchResult
      title: result.title,
      url: result.url,
      content: result.content ?? '',
    })
  );
};

export const handler = async ( // Node.js auto-discovers and runs this; deployed as a Lambda by CDK
  event: lambda.APIGatewayProxyEvent
): Promise<lambda.APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',   
    'Access-Control-Allow-Origin': '*', // CORS support
  };

  try {
    const searchApiKey = process.env.SEARCH_API_KEY || '';
    if (!searchApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            'SEARCH_API_KEY is not configured. Set TAVILY_API_KEY in .env.',
        }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'request body is required' }),
      };
    }

    const parseResult = webSearchRequestSchema.safeParse(
      JSON.parse(event.body)
    );
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid request format',
          details: parseResult.error.issues,
        }),
      };
    }

    const query = parseResult.data.query.trim();
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'query is required' }),
      };
    }
 
    const items = await searchUsingTavily(query); // raw data comes back

    const response: WebSearchResponse = { items }; 

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
    };
  }
};
