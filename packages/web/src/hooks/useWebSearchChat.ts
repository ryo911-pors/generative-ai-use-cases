import { useMemo } from 'react';
import useChat from './useChat';
import useChatApi from './useChatApi';
import useWebSearchApi from './useWebSearchApi';
import {
  AdditionalModelRequestFields,
  ShownMessage,
  UploadedFileType,
  WebSearchResultItem,
} from 'generative-ai-use-cases';
import { findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import { useTranslation } from 'react-i18next';

const useWebSearchChat = (id: string, chatId?: string) => {
  const { t } = useTranslation();
  const {
    getModelId,
    messages,
    postChat,
    clear,
    loading,
    writing,
    setLoading,
    updateSystemContext,
    popMessage,
    pushMessage,
    isEmpty,
  } = useChat(id, chatId);

  const modelId = getModelId();
  const { search } = useWebSearchApi();
  const { predict } = useChatApi();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  return {
    isEmpty,
    clear,
    loading,
    writing,
    messages,
    postMessage: async (
      content: string,
      uploadedFiles?: UploadedFileType[],
      base64Cache?: Record<string, string>,
      overrideModelParameters?: AdditionalModelRequestFields
    ) => {
      const model = findModelByModelId(modelId);
      if (!model) {
        console.error(`model not found for ${modelId}`);
        return;
      }

      const prevQueries = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      setLoading(true);
      pushMessage('user', content);
      pushMessage('assistant', t('webSearchChat.searching'));

      // Step 1: Generate a search query using the LLM
      let query: string;
      try {
        query = await predict({
          model,
          messages: [
            {
              role: 'user',
              content: prompter.webSearchPrompt({
                promptType: 'RETRIEVE',
                retrieveQueries: [...prevQueries, content],
              }),
            },
          ],
          id,
        });
      } catch (error) {
        console.error(error);
        popMessage();
        pushMessage('assistant', t('webSearchChat.errorSearch'));
        setLoading(false);
        return;
      }

      // Step 2: Call the web search API
      let items: WebSearchResultItem[] = [];
      try {
        const res = await search(query);
        items = res.data.items ?? [];
      } catch (error) {
        console.error(error);
        popMessage();
        pushMessage('assistant', t('webSearchChat.errorSearch'));
        setLoading(false);
        return;
      }

      if (items.length === 0) {
        popMessage();
        pushMessage('assistant', t('webSearchChat.noResults'));
        setLoading(false);
        return;
      }

      // Step 3: Inject search results into the system context
      updateSystemContext(
        prompter.webSearchPrompt({
          promptType: 'SYSTEM_CONTEXT',
          referenceItems: items,
        })
      );

      // Step 4: Remove the placeholder and run the normal chat
      popMessage();
      popMessage();
      postChat(
        content,
        false,
        (msgs: ShownMessage[]) => {
          // Preprocess: remove previous footnote and citation markers from history
          return msgs.map((m) => ({
            ...m,
            content: m.content
              .replace(/\[\^0\]:[\s\S]*/s, '')
              .replace(/\[\^(\d+)\]/g, '')
              .trim(),
          }));
        },
        (message: string) => {
          // Postprocess: append markdown footnotes for cited sources only
          const footnote = items
            .map((item, idx) => {
              if (!message.includes(`[^${idx}]`)) return '';
              const meta = [item.author, item.publishedDate]
                .filter((x) => x)
                .join(', ');
              const suffix = meta ? ` — ${meta}` : '';
              return `[^${idx}]: [${item.title}](${item.url})${suffix}`;
            })
            .filter((x) => x)
            .join('\n');
          return footnote ? `${message}\n\n${footnote}` : message;
        },
        undefined, // sessionId
        uploadedFiles,
        undefined, // extraData
        undefined, // overrideModelType
        undefined, // setSessionId
        base64Cache,
        overrideModelParameters
      );
    },
  };
};

export default useWebSearchChat;
