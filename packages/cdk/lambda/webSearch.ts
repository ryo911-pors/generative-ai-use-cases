import * as lambda from 'aws-lambda';
import {
  BraveSearchResult,
  TavilySearchResult,
  WebSearchRequest,
  WebSearchResponse,
  WebSearchResultItem,
} from 'generative-ai-use-cases';
import { StackInput } from '../lib/stack-input';

const MAX_RESULTS = 5;

const searchUsingBrave = async (
  query: string
): Promise<WebSearchResultItem[]> => {
  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    query
  )}&count=${MAX_RESULTS}&text_decorations=0`;
  const searchApiKey = process.env.SEARCH_API_KEY || '';
  const response = await fetch(searchUrl, {
    headers: {
      'X-Subscription-Token': searchApiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`Brave Search API failed: ${response.status}`);
  }
  const data = await response.json();
  return (data.web?.results ?? []).map(
    (result: BraveSearchResult): WebSearchResultItem => ({
      title: result.title,
      url: result.url,
      content: [result.description, ...(result.extra_snippets ?? [])]
        .filter(Boolean)
        .join(' '),
    })
  );
};

const searchUsingTavily = async (
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
    body: JSON.stringify({
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
  const data = await response.json();
  return (data.results ?? []).map(
    (result: TavilySearchResult): WebSearchResultItem => ({
      title: result.title,
      url: result.url,
      content: result.content ?? '',
    })
  );
};

export const handler = async (
  event: lambda.APIGatewayProxyEvent
): Promise<lambda.APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const searchApiKey = process.env.SEARCH_API_KEY || '';
    if (!searchApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            'SEARCH_API_KEY is not configured. Set searchApiKey in cdk.json.',
        }),
      };
    }

    const req = JSON.parse(event.body!) as WebSearchRequest;
    const query = req.query?.trim();

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'query is required' }),
      };
    }

    const searchEngine = (process.env.SEARCH_ENGINE ||
      'Tavily') as StackInput['searchEngine'];

    const items =
      searchEngine === 'Brave'
        ? await searchUsingBrave(query)
        : await searchUsingTavily(query);

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
