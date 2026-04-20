import { WebSearchRequest, WebSearchResponse } from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useWebSearchApi = () => {
  const http = useHttp();
  return {
    search: (query: string) => {
      return http.post<WebSearchResponse, WebSearchRequest>('/web-search', {
        query,
      });
    },
  };
};

export default useWebSearchApi;
