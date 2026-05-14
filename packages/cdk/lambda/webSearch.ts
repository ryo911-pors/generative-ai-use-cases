import * as lambda from 'aws-lambda';
import {
  TavilySearchResult,
  WebSearchRequest,
  WebSearchResponse,
  WebSearchResultItem,  // src/protocol.d.ts:214で定義
} from 'generative-ai-use-cases';

const MAX_RESULTS = 5;

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

export const handler = async (  //handlerはNodejsが自動的に見つけて実行。CDK側でlambdaとしてデプロイしてる。
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
            'SEARCH_API_KEY is not configured. Set TAVILY_API_KEY in .env.',
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

    const items = await searchUsingTavily(query);

    const response: WebSearchResponse = { items }; //不明点

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
