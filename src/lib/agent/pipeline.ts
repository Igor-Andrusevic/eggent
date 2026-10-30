import {
  streamText,
  generateText,
  stepCountIs,
  hasToolCall,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createModel } from "@/lib/providers/llm-provider";
import { loadSkillInstructions } from "@/lib/storage/project-store";
import { getChat, saveChat } from "@/lib/storage/chat-store";
import { publishUiSyncEvent } from "@/lib/realtime/event-bus";
import type {
  Project,
  PipelineConfig,
  PipelineStep,
  AppSettings,
  ModelConfig,
} from "@/lib/types";
import {
  resolveModelProviderOptions,
  logLLMRequest,
  convertModelMessageToChatMessages,
  getLastAssistantText,
  getLastResponseToolText,
} from "@/lib/agent/agent";

const MAX_PIPELINE_TOOL_STEPS = 15;

/**
 * Resolve effective ModelConfig for a specific pipeline step,
 * inheriting provider keys, endpoints, and fallbacks from AppSettings.
 */
export function resolveStepModelConfig(
  stepModel: ModelConfig | undefined,
  settings: AppSettings,
  fallbackModel: ModelConfig
): ModelConfig {
  if (!stepModel || !stepModel.model) {
    return fallbackModel;
  }
  const provider = stepModel.provider || fallbackModel.provider;
  return {
    provider,
    model: stepModel.model,
    apiKey:
      stepModel.apiKey ||
      settings.apiKeysByProvider?.[provider] ||
      (provider === fallbackModel.provider ? fallbackModel.apiKey : undefined),
    baseUrl:
      stepModel.baseUrl ||
      (provider === fallbackModel.provider ? fallbackModel.baseUrl : undefined),
    authMethod:
      stepModel.authMethod ||
      (provider === fallbackModel.provider ? fallbackModel.authMethod : undefined),
    temperature: stepModel.temperature ?? fallbackModel.temperature ?? 0.3,
    maxTokens: stepModel.maxTokens ?? fallbackModel.maxTokens ?? 8192,
  };
}

/**
 * Enrich system prompt with step-specific role instructions and preload skills.
 */
export async function buildStepSystemPrompt(
  step: PipelineStep,
  basePrompt: string,
  projectId?: string
): Promise<string> {
  let prompt = basePrompt;
  if (step.skillName && projectId) {
    try {
      const skill = await loadSkillInstructions(projectId, step.skillName);
      if (skill?.body) {
        prompt += `\n\n## Инструкции профильного навыка [${skill.name}]:\n${skill.body}`;
      }
    } catch (e) {
      console.warn(`[pipeline] Failed to load skill ${step.skillName}:`, e);
    }
  }
  if (step.systemPrompt) {
    prompt += `\n\n## Роль и специальные требования шага [${step.name}]:\n${step.systemPrompt}`;
  }
  return prompt;
}

function formatStepInput(
  step: PipelineStep,
  userMessage: string,
  previousOutput: string,
  initialDraft?: string
): string {
  if (step.id === "auditor") {
    return `ЗАДАЧА ОТ ПОЛЬЗОВАТЕЛЯ:\n${userMessage}\n\nЧЕРНОВИК АРХИТЕКТОРА ДЛЯ АУДИТА:\n${previousOutput}`;
  }
  if (step.id === "finalizer") {
    return `ЗАДАЧА ОТ ПОЛЬЗОВАТЕЛЯ:\n${userMessage}\n\nПРОВЕРЕННЫЙ SQL И МАТЕРИАЛЫ:\n${initialDraft || previousOutput}\n\nПожалуйста, оформи финальный production-SQL строго по правилам форматирования и латышских алиасов в один блок \`\`\`sql без вводного и заключительного текста.`;
  }
  return `ЗАДАЧА ОТ ПОЛЬЗОВАТЕЛЯ:\n${userMessage}\n\nДАННЫЕ ПРЕДЫДУЩЕГО ЭТАПА:\n${previousOutput}`;
}

export interface RunPipelineStreamParams {
  project: Project;
  pipeline: PipelineConfig;
  chatId: string;
  userMessage: string;
  currentPath?: string;
  settings: AppSettings;
  tools: ToolSet;
  baseSystemPrompt: string;
  historyMessages: ModelMessage[];
  ensureUserMessageSaved: () => Promise<void>;
  persistAssistantTurn: (payload: {
    responseMessages: ModelMessage[];
    continuationText?: string;
    fallbackText?: string;
  }) => Promise<"none" | "continued" | "fallback" | "finished">;
  cleanupMcpIfNeeded: () => Promise<void>;
}

/**
 * Execute pipeline in streaming mode for UI chats.
 * Intermediate steps run via generateText, the final step streams via streamText.
 */
export async function runPipelineStream(params: RunPipelineStreamParams) {
  await params.ensureUserMessageSaved();

  const steps = params.pipeline.steps;
  let currentOutput = "";
  let architectDraft = "";
  let auditorFeedback = "";

  // Intermediate steps: 0 through steps.length - 2
  for (let i = 0; i < steps.length - 1; i += 1) {
    const step = steps[i];
    const stepModelConfig = resolveStepModelConfig(
      step.model,
      params.settings,
      params.settings.chatModel
    );
    const providerOptions = resolveModelProviderOptions(stepModelConfig.provider);
    const model = createModel(stepModelConfig, {
      projectId: params.project.id,
      currentPath: params.currentPath,
    });
    const system = await buildStepSystemPrompt(
      step,
      params.baseSystemPrompt,
      params.project.id
    );

    const stepMessages: ModelMessage[] =
      i === 0
        ? [...params.historyMessages, { role: "user" as const, content: params.userMessage }]
        : [
            {
              role: "user" as const,
              content: formatStepInput(step, params.userMessage, currentOutput, architectDraft),
            },
          ];

    logLLMRequest({
      model: `${stepModelConfig.provider}/${stepModelConfig.model}`,
      system,
      messages: stepMessages,
      toolNames: Object.keys(params.tools),
      temperature: stepModelConfig.temperature,
      maxTokens: stepModelConfig.maxTokens,
      label: `Pipeline Step [${step.id}] (generateText)`,
    });

    publishUiSyncEvent({
      topic: "chat",
      projectId: params.project.id,
      chatId: params.chatId,
      reason: `pipeline_step_${step.id}_started`,
    });

    const res = await generateText({
      model,
      system,
      messages: stepMessages,
      providerOptions,
      tools: params.tools,
      stopWhen: [stepCountIs(MAX_PIPELINE_TOOL_STEPS), hasToolCall("response")],
      temperature: stepModelConfig.temperature ?? 0.3,
      maxOutputTokens: stepModelConfig.maxTokens ?? 8192,
    });

    const responseMessages = (res as unknown as { response?: { messages?: ModelMessage[] } })
      .response?.messages || [];
    const stepText =
      res.text ||
      getLastAssistantText(responseMessages) ||
      getLastResponseToolText(responseMessages);

    if (i === 0) {
      architectDraft = stepText;
    }
    if (step.id === "auditor") {
      auditorFeedback = stepText;
    }
    currentOutput = stepText;

    // Check for loopBack
    if (
      step.loopBack?.triggerPattern &&
      new RegExp(step.loopBack.triggerPattern, "i").test(stepText)
    ) {
      const targetStep = steps.find((s) => s.id === step.loopBack!.toStepId);
      if (targetStep) {
        publishUiSyncEvent({
          topic: "chat",
          projectId: params.project.id,
          chatId: params.chatId,
          reason: `pipeline_loopback_${targetStep.id}`,
        });

        const targetModelConfig = resolveStepModelConfig(
          targetStep.model,
          params.settings,
          params.settings.chatModel
        );
        const targetModel = createModel(targetModelConfig, {
          projectId: params.project.id,
          currentPath: params.currentPath,
        });
        const targetSystem = await buildStepSystemPrompt(
          targetStep,
          params.baseSystemPrompt,
          params.project.id
        );

        const revisionMessages: ModelMessage[] = [
          ...params.historyMessages,
          { role: "user", content: params.userMessage },
          { role: "assistant", content: architectDraft },
          {
            role: "user",
            content: `Аудитор провел проверку кода и вернул следующие замечания:\n\n${stepText}\n\nПожалуйста, устрани все замечания и предоставь исправленный вариант ТЗ и SQL.`,
          },
        ];

        const revRes = await generateText({
          model: targetModel,
          system: targetSystem,
          messages: revisionMessages,
          providerOptions: resolveModelProviderOptions(targetModelConfig.provider),
          tools: params.tools,
          stopWhen: [stepCountIs(MAX_PIPELINE_TOOL_STEPS), hasToolCall("response")],
          temperature: targetModelConfig.temperature ?? 0.3,
          maxOutputTokens: targetModelConfig.maxTokens ?? 8192,
        });

        const revMessages =
          (revRes as unknown as { response?: { messages?: ModelMessage[] } }).response
            ?.messages || [];
        const revText =
          revRes.text ||
          getLastAssistantText(revMessages) ||
          getLastResponseToolText(revMessages);

        architectDraft = revText || architectDraft;
        currentOutput = revText || currentOutput;
      }
    }
  }

  // Final Step: streamText
  const finalStep = steps[steps.length - 1];
  const finalModelConfig = resolveStepModelConfig(
    finalStep.model,
    params.settings,
    params.settings.chatModel
  );
  const finalProviderOptions = resolveModelProviderOptions(finalModelConfig.provider);
  const finalModel = createModel(finalModelConfig, {
    projectId: params.project.id,
    currentPath: params.currentPath,
  });
  const finalSystem = await buildStepSystemPrompt(
    finalStep,
    params.baseSystemPrompt,
    params.project.id
  );

  const finalContent =
    steps.length === 1
      ? params.userMessage
      : `ЗАДАЧА ОТ ПОЛЬЗОВАТЕЛЯ:\n${params.userMessage}\n\nПРОВЕРЕННЫЙ И СОГЛАСОВАННЫЙ SQL-КОД ДЛЯ ОФОРМЛЕНИЯ:\n${architectDraft || currentOutput}\n\n${auditorFeedback ? `ЗАКЛЮЧЕНИЕ АУДИТОРА:\n${auditorFeedback}\n\n` : ""}Оформи итоговый результат СТРОГО в виде одного чистого блока \`\`\`sql без пояснений.`;

  const finalMessages: ModelMessage[] =
    steps.length === 1
      ? [...params.historyMessages, { role: "user", content: finalContent }]
      : [{ role: "user", content: finalContent }];

  logLLMRequest({
    model: `${finalModelConfig.provider}/${finalModelConfig.model}`,
    system: finalSystem,
    messages: finalMessages,
    toolNames: [],
    temperature: finalModelConfig.temperature,
    maxTokens: finalModelConfig.maxTokens,
    label: `Pipeline Final Step [${finalStep.id}] (streamText)`,
  });

  publishUiSyncEvent({
    topic: "chat",
    projectId: params.project.id,
    chatId: params.chatId,
    reason: `pipeline_step_${finalStep.id}_streaming`,
  });

  return streamText({
    model: finalModel,
    system: finalSystem,
    messages: finalMessages,
    providerOptions: finalProviderOptions,
    temperature: finalModelConfig.temperature ?? 0.2,
    maxOutputTokens: finalModelConfig.maxTokens ?? 8192,
    onFinish: async (event) => {
      await params.cleanupMcpIfNeeded();
      await params.persistAssistantTurn({
        responseMessages: event.response.messages,
      });

      publishUiSyncEvent({
        topic: "chat",
        projectId: params.project.id ?? null,
        chatId: params.chatId,
        reason: "pipeline_finished",
      });
      publishUiSyncEvent({
        topic: "files",
        projectId: params.project.id ?? null,
        reason: "agent_turn_finished",
      });
    },
  });
}

export interface RunPipelineTextParams {
  project: Project;
  pipeline: PipelineConfig;
  chatId: string;
  userMessage: string;
  currentPath?: string;
  runtimeData?: Record<string, unknown>;
  settings: AppSettings;
  tools: ToolSet;
  baseSystemPrompt: string;
  historyMessages: ModelMessage[];
  effectiveModel: ModelConfig;
}

/**
 * Execute pipeline in non-streaming mode for Telegram and background tasks.
 */
export async function runPipelineText(params: RunPipelineTextParams): Promise<string> {
  const steps = params.pipeline.steps;
  let currentOutput = "";
  let architectDraft = "";
  let auditorFeedback = "";

  for (let i = 0; i < steps.length - 1; i += 1) {
    const step = steps[i];
    const stepModelConfig = resolveStepModelConfig(
      step.model,
      params.settings,
      params.effectiveModel
    );
    const providerOptions = resolveModelProviderOptions(stepModelConfig.provider);
    const model = createModel(stepModelConfig, {
      projectId: params.project.id,
      currentPath: params.currentPath,
    });
    const system = await buildStepSystemPrompt(
      step,
      params.baseSystemPrompt,
      params.project.id
    );

    const stepMessages: ModelMessage[] =
      i === 0
        ? [...params.historyMessages, { role: "user" as const, content: params.userMessage }]
        : [
            {
              role: "user" as const,
              content: formatStepInput(step, params.userMessage, currentOutput, architectDraft),
            },
          ];

    const res = await generateText({
      model,
      system,
      messages: stepMessages,
      providerOptions,
      tools: params.tools,
      stopWhen: [stepCountIs(MAX_PIPELINE_TOOL_STEPS), hasToolCall("response")],
      temperature: stepModelConfig.temperature ?? 0.3,
      maxOutputTokens: stepModelConfig.maxTokens ?? 8192,
    });

    const responseMessages = (res as unknown as { response?: { messages?: ModelMessage[] } })
      .response?.messages || [];
    const stepText =
      res.text ||
      getLastAssistantText(responseMessages) ||
      getLastResponseToolText(responseMessages);

    if (i === 0) {
      architectDraft = stepText;
    }
    if (step.id === "auditor") {
      auditorFeedback = stepText;
    }
    currentOutput = stepText;

    if (
      step.loopBack?.triggerPattern &&
      new RegExp(step.loopBack.triggerPattern, "i").test(stepText)
    ) {
      const targetStep = steps.find((s) => s.id === step.loopBack!.toStepId);
      if (targetStep) {
        const targetModelConfig = resolveStepModelConfig(
          targetStep.model,
          params.settings,
          params.effectiveModel
        );
        const targetModel = createModel(targetModelConfig, {
          projectId: params.project.id,
          currentPath: params.currentPath,
        });
        const targetSystem = await buildStepSystemPrompt(
          targetStep,
          params.baseSystemPrompt,
          params.project.id
        );

        const revisionMessages: ModelMessage[] = [
          ...params.historyMessages,
          { role: "user", content: params.userMessage },
          { role: "assistant", content: architectDraft },
          {
            role: "user",
            content: `Аудитор провел проверку кода и вернул следующие замечания:\n\n${stepText}\n\nПожалуйста, устрани все замечания и предоставь исправленный вариант ТЗ и SQL.`,
          },
        ];

        const revRes = await generateText({
          model: targetModel,
          system: targetSystem,
          messages: revisionMessages,
          providerOptions: resolveModelProviderOptions(targetModelConfig.provider),
          tools: params.tools,
          stopWhen: [stepCountIs(MAX_PIPELINE_TOOL_STEPS), hasToolCall("response")],
          temperature: targetModelConfig.temperature ?? 0.3,
          maxOutputTokens: targetModelConfig.maxTokens ?? 8192,
        });

        const revMessages =
          (revRes as unknown as { response?: { messages?: ModelMessage[] } }).response
            ?.messages || [];
        const revText =
          revRes.text ||
          getLastAssistantText(revMessages) ||
          getLastResponseToolText(revMessages);

        architectDraft = revText || architectDraft;
        currentOutput = revText || currentOutput;
      }
    }
  }

  // Final step
  const finalStep = steps[steps.length - 1];
  const finalModelConfig = resolveStepModelConfig(
    finalStep.model,
    params.settings,
    params.effectiveModel
  );
  const finalModel = createModel(finalModelConfig, {
    projectId: params.project.id,
    currentPath: params.currentPath,
  });
  const finalSystem = await buildStepSystemPrompt(
    finalStep,
    params.baseSystemPrompt,
    params.project.id
  );

  const finalContent =
    steps.length === 1
      ? params.userMessage
      : `ЗАДАЧА ОТ ПОЛЬЗОВАТЕЛЯ:\n${params.userMessage}\n\nПРОВЕРЕННЫЙ И СОГЛАСОВАННЫЙ SQL-КОД ДЛЯ ОФОРМЛЕНИЯ:\n${architectDraft || currentOutput}\n\n${auditorFeedback ? `ЗАКЛЮЧЕНИЕ АУДИТОРА:\n${auditorFeedback}\n\n` : ""}Оформи итоговый результат СТРОГО в виде одного чистого блока \`\`\`sql без пояснений.`;

  const finalMessages: ModelMessage[] =
    steps.length === 1
      ? [...params.historyMessages, { role: "user", content: finalContent }]
      : [{ role: "user", content: finalContent }];

  const finalRes = await generateText({
    model: finalModel,
    system: finalSystem,
    messages: finalMessages,
    providerOptions: resolveModelProviderOptions(finalModelConfig.provider),
    temperature: finalModelConfig.temperature ?? 0.2,
    maxOutputTokens: finalModelConfig.maxTokens ?? 8192,
  });

  const finalResponseMessages =
    (finalRes as unknown as { response?: { messages?: ModelMessage[] } }).response
      ?.messages || [];
  const finalResultText =
    finalRes.text ||
    getLastAssistantText(finalResponseMessages) ||
    getLastResponseToolText(finalResponseMessages);

  // Persist to chat
  try {
    const latest = await getChat(params.chatId);
    if (latest) {
      const now = new Date().toISOString();
      latest.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: params.userMessage,
        createdAt: now,
      });

      if (finalResponseMessages.length > 0) {
        for (const msg of finalResponseMessages) {
          latest.messages.push(...convertModelMessageToChatMessages(msg, now));
        }
      } else {
        latest.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalResultText,
          createdAt: now,
        });
      }

      latest.updatedAt = now;
      await saveChat(latest);
    }
  } catch (saveErr) {
    console.error("[pipeline] Failed to save chat messages:", saveErr);
  }

  return finalResultText;
}
