import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import useChat from '../hooks/useChat';
import useWebSearchChat from '../hooks/useWebSearchChat';
import useSystemContextApi from '../hooks/useSystemContextApi';
import ChatMessage from '../components/ChatMessage';
import Button from '../components/Button';
import ModalDialog from '../components/ModalDialog';
import ModalSystemContext from '../components/ModalSystemContext';
import ExpandableField from '../components/ExpandableField';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import {
  PiArrowClockwiseBold,
  PiMagnifyingGlass,
  PiPlus,
} from 'react-icons/pi';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { WebSearchChatPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import useFiles from '../hooks/useFiles';
import {
  AdditionalModelRequestFields,
  FileLimit,
  SystemContext,
} from 'generative-ai-use-cases';
import ModelParameters from '../components/ModelParameters';
import { AcceptedDotExtensions } from '../utils/MediaUtils';
import { useTranslation } from 'react-i18next';

const fileLimit: FileLimit = {
  accept: AcceptedDotExtensions,
  maxFileCount: 5,
  maxFileSizeMB: 4.5,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 3.75,
  maxVideoFileCount: 1,
  maxVideoFileSizeMB: 1000,
};

const DEFAULT_REASONING_BUDGET = 4096;

type StateType = {
  content: string;
  inputSystemContext: string;
  saveSystemContext: string;
  saveSystemContextTitle: string;
  setContent: (c: string) => void;
  setInputSystemContext: (c: string) => void;
  setSaveSystemContext: (c: string) => void;
  setSaveSystemContextTitle: (c: string) => void;
};

const useWebSearchChatPageState = create<StateType>((set) => {
  return {
    content: '',
    inputSystemContext: '',
    saveSystemContext: '',
    saveSystemContextTitle: '',
    setContent: (s: string) => {
      set(() => ({ content: s }));
    },
    setInputSystemContext: (s: string) => {
      set(() => ({ inputSystemContext: s }));
    },
    setSaveSystemContext: (s: string) => {
      set(() => ({ saveSystemContext: s }));
    },
    setSaveSystemContextTitle: (s: string) => {
      set(() => ({ saveSystemContextTitle: s }));
    },
  };
});

const WebSearchChatPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    content,
    inputSystemContext,
    saveSystemContext,
    saveSystemContextTitle,
    setContent,
    setInputSystemContext,
    setSaveSystemContext,
    setSaveSystemContextTitle,
  } = useWebSearchChatPageState();
  const { pathname, search } = useLocation();
  const { chatId } = useParams();
  const {
    clear: clearFiles,
    uploadedFiles,
    uploadFiles,
    base64Cache,
  } = useFiles(pathname);

  const { listSystemContexts, deleteSystemContext, updateSystemContextTitle } =
    useSystemContextApi();
  const [systemContextList, setSystemContextList] = useState<SystemContext[]>(
    []
  );
  const { data: systemContextResponse, mutate } = listSystemContexts();
  useEffect(() => {
    setSystemContextList(systemContextResponse ? systemContextResponse : []);
  }, [systemContextResponse, setSystemContextList]);

  const {
    getModelId,
    setModelId,
    updateSystemContext,
    updateSystemContextByModel,
    getCurrentSystemContext,
    forceToStop,
  } = useChat(pathname, chatId);
  const { postMessage, clear, loading, writing, messages, isEmpty } =
    useWebSearchChat(pathname, chatId);
  const { createSystemContext } = useSystemContextApi();
  const { scrollableContainer, setFollowing } = useFollow();
  const { allModelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const [overrideModelParameters, setOverrideModelParameters] =
    useState<AdditionalModelRequestFields>({
      reasoningConfig: {
        type: 'disabled',
        budgetTokens: DEFAULT_REASONING_BUDGET,
      },
    });
  const [showSetting, setShowSetting] = useState(false);
  const [showSystemContextModal, setShowSystemContextModal] = useState(false);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    // When viewing a resumed chat, keep the stored system context as-is
    if (!chatId) {
      updateSystemContextByModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompter]);

  const accept = useMemo(() => {
    if (!modelId) return [];
    const feature = MODELS.getModelMetadata(modelId);
    return [
      ...(feature.flags.doc ? fileLimit.accept.doc : []),
      ...(feature.flags.image ? fileLimit.accept.image : []),
      ...(feature.flags.video ? fileLimit.accept.video : []),
    ];
  }, [modelId]);
  const fileUpload = useMemo(() => {
    return accept.length > 0;
  }, [accept]);
  const reasoning = useMemo(() => {
    return MODELS.getModelMetadata(modelId).flags.reasoning ?? false;
  }, [modelId]);
  const adaptiveThinking = useMemo(() => {
    return MODELS.getModelMetadata(modelId).flags.adaptiveThinking ?? false;
  }, [modelId]);
  const reasoningEnabled = useMemo(() => {
    return (
      overrideModelParameters.reasoningConfig.type === 'enabled' ||
      overrideModelParameters.reasoningConfig.type === 'adaptive'
    );
  }, [overrideModelParameters]);
  const setting = useMemo(() => {
    return reasoning;
  }, [reasoning]);

  useEffect(() => {
    if (reasoningEnabled) {
      const newType = adaptiveThinking ? 'adaptive' : 'enabled';
      if (overrideModelParameters.reasoningConfig.type !== newType) {
        setOverrideModelParameters({
          ...overrideModelParameters,
          reasoningConfig: {
            ...overrideModelParameters.reasoningConfig,
            type: newType,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaptiveThinking]);

  const currentSystemContext = useMemo(() => {
    return getCurrentSystemContext();
  }, [getCurrentSystemContext]);

  useEffect(() => {
    setInputSystemContext(currentSystemContext);
  }, [currentSystemContext, setInputSystemContext]);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as WebSearchChatPageQueryParams;
      setContent(params.content ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, setContent, availableModels, pathname]);

  const onSend = useCallback(async () => {
    setFollowing(true);
    const savedContent = content;
    setContent('');
    clearFiles();
    await postMessage(
      savedContent,
      fileUpload ? uploadedFiles : undefined,
      base64Cache,
      overrideModelParameters
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    base64Cache,
    fileUpload,
    setFollowing,
    overrideModelParameters,
    uploadedFiles,
  ]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  const onStop = useCallback(() => {
    forceToStop();
  }, [forceToStop]);

  const onCreateSystemContext = useCallback(async () => {
    try {
      await createSystemContext(saveSystemContextTitle, saveSystemContext);
    } catch (e) {
      console.error(e);
    } finally {
      setShowSystemContextModal(false);
      setInputSystemContext(saveSystemContext);
      setSaveSystemContextTitle('');
      mutate();
      setSystemContextList(systemContextResponse ?? []);
    }
  }, [
    saveSystemContextTitle,
    saveSystemContext,
    systemContextResponse,
    createSystemContext,
    setShowSystemContextModal,
    setInputSystemContext,
    setSaveSystemContextTitle,
    mutate,
    setSystemContextList,
  ]);

  const onClickDeleteSystemContext = async (systemContextId: string) => {
    try {
      const idx = systemContextList.findIndex(
        (item) => item.systemContextId === systemContextId
      );
      if (idx >= 0) {
        setSystemContextList(systemContextList.filter((_, i) => i !== idx));
      }
      await deleteSystemContext(systemContextId);
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  const onClickUpdateSystemContext = async (
    systemContextId: string,
    title: string
  ) => {
    try {
      const idx = systemContextList.findIndex(
        (item) => item.systemContextId === systemContextId
      );
      if (idx >= 0) {
        setSystemContextList(
          systemContextList.map((item, i) => {
            if (i === idx) {
              return { ...item, systemContextTitle: title };
            }
            return item;
          })
        );
      }
      await updateSystemContextTitle(systemContextId, title);
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  void onClickDeleteSystemContext;

  void onClickUpdateSystemContext;

  const onReasoningSwitched = useCallback(() => {
    if (reasoningEnabled) {
      setOverrideModelParameters({
        ...overrideModelParameters,
        reasoningConfig: {
          ...overrideModelParameters.reasoningConfig,
          type: 'disabled',
        },
      });
    } else {
      setOverrideModelParameters({
        ...overrideModelParameters,
        reasoningConfig: {
          ...overrideModelParameters.reasoningConfig,
          type: adaptiveThinking ? 'adaptive' : 'enabled',
        },
      });
    }
  }, [
    reasoningEnabled,
    adaptiveThinking,
    overrideModelParameters,
    setOverrideModelParameters,
  ]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(false);
    if (event.dataTransfer.files) {
      uploadFiles(Array.from(event.dataTransfer.files), fileLimit, accept);
    }
  };

  return (
    <>
      <div
        onDragOver={fileUpload ? handleDragOver : undefined}
        className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('webSearchChat.title')}
        </div>

        {isOver && fileUpload && (
          <div
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="fixed bottom-0 left-0 right-0 top-0 z-[999] bg-slate-300 p-10 text-center">
            <div className="flex h-full w-full items-center justify-center outline-dashed">
              <div className="font-bold">{t('chat.drop_files')}</div>
            </div>
          </div>
        )}

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0 print:hidden">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m) => {
              return { value: m, label: modelDisplayName(m) };
            })}
          />
        </div>

        {isEmpty && (
          <div className="relative flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
            <div className="flex items-center gap-x-3">
              <PiMagnifyingGlass className="size-[64px] text-gray-400" />
              <PiPlus className="text-2xl text-gray-400" />
              <BedrockIcon className="fill-gray-400" />
            </div>
          </div>
        )}

        <div ref={scrollableContainer}>
          {messages.map((chat, idx) => (
            <div key={idx}>
              <ChatMessage
                idx={idx}
                chatContent={chat}
                loading={loading && idx === messages.length - 1}
                setSaveSystemContext={setSaveSystemContext}
                setShowSystemContextModal={setShowSystemContextModal}
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          {isEmpty && (
            <ExpandableField
              label={t('chat.system_prompt')}
              className="relative w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
              <>
                <div className="absolute -top-2 right-0 mb-2 flex justify-end">
                  <Button
                    outlined
                    className="text-xs"
                    onClick={() => {
                      clear();
                      setInputSystemContext(currentSystemContext);
                    }}>
                    {t('chat.initialize')}
                  </Button>
                  <Button
                    outlined
                    className="ml-1 text-xs"
                    onClick={() => {
                      setSaveSystemContext(inputSystemContext);
                      setShowSystemContextModal(true);
                    }}>
                    {t('chat.save')}
                  </Button>
                </div>

                <InputChatContent
                  disableMarginBottom={true}
                  content={inputSystemContext}
                  onChangeContent={setInputSystemContext}
                  fullWidth={true}
                  resetDisabled={true}
                  disabled={inputSystemContext === currentSystemContext}
                  sendIcon={<PiArrowClockwiseBold />}
                  onSend={() => {
                    updateSystemContext(inputSystemContext);
                  }}
                  hideReset={true}
                />
              </>
            </ExpandableField>
          )}
          <InputChatContent
            content={content}
            disabled={loading && !writing}
            onChangeContent={setContent}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            fileUpload={fileUpload}
            fileLimit={fileLimit}
            accept={accept}
            reasoning={reasoning}
            onReasoningSwitched={onReasoningSwitched}
            reasoningEnabled={reasoningEnabled}
            setting={setting}
            onSetting={() => {
              setShowSetting(true);
            }}
            canStop={writing}
          />
        </div>
      </div>

      <ModalSystemContext
        showSystemContextModal={showSystemContextModal}
        saveSystemContext={saveSystemContext}
        saveSystemContextTitle={saveSystemContextTitle}
        setShowSystemContextModal={setShowSystemContextModal}
        setSaveSystemContext={setSaveSystemContext}
        setSaveSystemContextTitle={setSaveSystemContextTitle}
        onCreateSystemContext={onCreateSystemContext}
      />

      <ModalDialog
        isOpen={showSetting}
        onClose={() => {
          setShowSetting(false);
        }}
        title={t('chat.advanced_options')}>
        {setting && (
          <div className="">
            <ModelParameters
              modelFeatureFlags={MODELS.getModelMetadata(modelId).flags}
              overrideModelParameters={overrideModelParameters}
              setOverrideModelParameters={setOverrideModelParameters}
            />
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => {
              setShowSetting(false);
            }}>
            {t('chat.settings')}
          </Button>
        </div>
      </ModalDialog>
    </>
  );
};

export default WebSearchChatPage;
