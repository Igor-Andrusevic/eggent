"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Workflow,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { Project, PipelineConfig, PipelineStep } from "@/lib/types";

interface ProjectPipelineSectionProps {
  project: Project;
  onUpdate?: (updated: Project) => void;
}

const COMMON_MODELS = [
  "claude-opus-4-6-thinking",
  "claude-opus-5-5-high",
  "claude-sonnet-4-6",
  "gemini-3.8-flash-high",
  "gemini-3.7-flash-high",
  "deepseek-v4-flash",
  "gpt-4o",
  "gpt-4o-mini",
];

const DEFAULT_SQL_STEPS: PipelineStep[] = [
  {
    id: "architect",
    name: "Архитектор (ТЗ и черновик SQL)",
    description: "Анализ запроса, схема данных, составление ТЗ и черновой код",
    model: {
      provider: "cliproxy",
      model: "claude-opus-4-6-thinking",
      temperature: 0.3,
      maxTokens: 8192,
    },
    skillName: "sql-pipeline",
    systemPrompt:
      "Твоя задача — проанализировать запрос пользователя, составить детальное ТЗ и подготовить черновой SQL-код по проектным правилам (ПРАВИЛА 0-7, латышские алиасы, SARGability, совместимость с SQL Server 2016). Обязательно укажи все индексы на #Temp и проверь источники схемы.",
  },
  {
    id: "auditor",
    name: "Аудитор (Безопасность и MK 555)",
    description: "Глубокая проверка ПРАВИЛА 5, нормативов, планов и коллировок",
    model: {
      provider: "cliproxy",
      model: "claude-opus-5-5-high",
      temperature: 0.2,
      maxTokens: 8192,
    },
    skillName: "sql-pipeline",
    loopBack: {
      toStepId: "architect",
      triggerPattern: "VERDICT:\\s*REVISE",
      maxRounds: 1,
    },
    systemPrompt:
      "Твоя задача — провести жесткий аудит чернового SQL: абсолютный запрет деструктивных операций (ПРАВИЛО 5), соответствие схеме стационара [AB3].[AB3] (у D3_HOSPITALIZATION нет CONT_ID), отсутствие конфликтов коллировок (ПРАВИЛО 7), SARGable условия, индексы #Temp. Если есть ошибки — верни VERDICT: REVISE со списком. Если всё корректно — верни VERDICT: OK.",
  },
  {
    id: "finalizer",
    name: "Финализатор (Оформление и чистый SQL)",
    description: "Латышские алиасы, верхний регистр ключевых слов, выдача одного ```sql блока",
    model: {
      provider: "cliproxy",
      model: "gemini-3.8-flash-high",
      temperature: 0.1,
      maxTokens: 8192,
    },
    skillName: "sql-pipeline",
    systemPrompt:
      "Твоя задача — привести проверенный SQL-код к идеальному оформлению: все ключевые слова строго в ВЕРХНЕМ РЕГИСТРЕ, четкие отступы в 4 пробела, все алиасы строго латышские по словарю, расчет долей с алиасом [Īpatsvars, %]. Выдай СТРОГО один блок ```sql без вводных и заключительных слов.",
  },
];

export function ProjectPipelineSection({
  project,
  onUpdate,
}: ProjectPipelineSectionProps) {
  const initialPipeline: PipelineConfig = project.pipeline || {
    enabled: false,
    steps: DEFAULT_SQL_STEPS,
  };

  const [pipeline, setPipeline] = useState<PipelineConfig>(initialPipeline);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

  function handleToggleEnabled() {
    setPipeline((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      steps: prev.steps.length > 0 ? prev.steps : DEFAULT_SQL_STEPS,
    }));
  }

  function handleLoadSqlPreset() {
    setPipeline({
      enabled: true,
      steps: DEFAULT_SQL_STEPS,
    });
    setStatus("Загружен эталонный 3-фазный шаблон SQL конвейера.");
    setStatusTone("success");
  }

  function handleAddStep() {
    const newStepIndex = pipeline.steps.length + 1;
    const newStep: PipelineStep = {
      id: `step-${Date.now()}`,
      name: `Шаг ${newStepIndex}`,
      description: "Новый этап конвейера",
      model: {
        provider: "cliproxy",
        model: "gemini-3.8-flash-high",
        temperature: 0.3,
        maxTokens: 8192,
      },
      systemPrompt: "",
    };
    setPipeline((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
  }

  function handleRemoveStep(index: number) {
    if (pipeline.steps.length <= 1) return;
    setPipeline((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function handleUpdateStep(index: number, updates: Partial<PipelineStep>) {
    setPipeline((prev) => {
      const nextSteps = [...prev.steps];
      nextSteps[index] = { ...nextSteps[index], ...updates };
      return { ...prev, steps: nextSteps };
    });
  }

  function handleUpdateStepModel(index: number, modelName: string) {
    setPipeline((prev) => {
      const nextSteps = [...prev.steps];
      const existingModel = nextSteps[index].model || {
        provider: "cliproxy",
        model: "",
      };
      nextSteps[index] = {
        ...nextSteps[index],
        model: {
          ...existingModel,
          model: modelName.trim(),
        },
      };
      return { ...prev, steps: nextSteps };
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setStatus(null);
      setStatusTone(null);

      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline }),
      });

      const updated = (await res.json()) as Project | { error?: string };
      if (!res.ok) {
        throw new Error(
          "error" in updated && typeof updated.error === "string"
            ? updated.error
            : "Не удалось сохранить настройки конвейера"
        );
      }

      if (onUpdate) {
        onUpdate(updated as Project);
      }
      setStatus("Конвейер успешно сохранен!");
      setStatusTone("success");
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Не удалось сохранить конвейер"
      );
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Workflow className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">
              Многоагентный конвейер (AI Pipeline)
            </h3>
            <p className="text-xs text-muted-foreground">
              Последовательный запуск специализированных агентов с выделенными моделями
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleLoadSqlPreset}
            className="text-xs gap-1.5"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            Шаблон 3-фазного SQL
          </Button>

          <Button
            type="button"
            size="sm"
            variant={pipeline.enabled ? "default" : "outline"}
            onClick={handleToggleEnabled}
            className="text-xs"
          >
            {pipeline.enabled ? "Конвейер ВКЛЮЧЕН" : "Конвейер ОТКЛЮЧЕН"}
          </Button>
        </div>
      </div>

      {status && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            statusTone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {statusTone === "error" ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0" />
          )}
          <span>{status}</span>
        </div>
      )}

      {pipeline.enabled ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Схема конвейера:</span>
            {pipeline.steps.map((st, i) => (
              <span key={st.id} className="flex items-center gap-1">
                <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                  {st.name.split(" ")[0]} ({st.model?.model?.split("-")[0] || "def"})
                </span>
                {i < pipeline.steps.length - 1 && (
                  <ArrowRight className="size-3 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            {pipeline.steps.map((step, idx) => (
              <div
                key={step.id || idx}
                className="rounded-lg border bg-muted/30 p-4 space-y-3 relative group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {step.name}
                    </span>
                    {step.loopBack && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono">
                        LoopBack → {step.loopBack.toStepId}
                      </span>
                    )}
                  </div>

                  {pipeline.steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveStep(idx)}
                      title="Удалить шаг"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Название этапа</Label>
                    <Input
                      value={step.name}
                      onChange={(e) => handleUpdateStep(idx, { name: e.target.value })}
                      placeholder="Например: Архитектор (ТЗ и код)"
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Модель ИИ для этого шага (cliproxy / openrouter / etc.)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={step.model?.model || ""}
                        onChange={(e) => handleUpdateStepModel(idx, e.target.value)}
                        placeholder="claude-opus-4-6-thinking"
                        className="h-8 text-xs font-mono bg-background"
                      />
                      <select
                        className="h-8 text-xs rounded-md border bg-background px-2 text-muted-foreground"
                        value={step.model?.model || ""}
                        onChange={(e) => handleUpdateStepModel(idx, e.target.value)}
                      >
                        <option value="">(Выбрать)</option>
                        {COMMON_MODELS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Подключаемый навык (Skill Name)
                    </Label>
                    <Input
                      value={step.skillName || ""}
                      onChange={(e) => handleUpdateStep(idx, { skillName: e.target.value })}
                      placeholder="sql-pipeline"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Описание роли (для логов)
                    </Label>
                    <Input
                      value={step.description || ""}
                      onChange={(e) => handleUpdateStep(idx, { description: e.target.value })}
                      placeholder="Краткое описание обязанностей"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Специальные инструкции шага (System Prompt)
                  </Label>
                  <textarea
                    value={step.systemPrompt || ""}
                    onChange={(e) => handleUpdateStep(idx, { systemPrompt: e.target.value })}
                    placeholder="Инструкции и критерии приемки для этой роли..."
                    className="min-h-[70px] w-full rounded-md border bg-background p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddStep}
              className="text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              Добавить шаг
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPipeline(initialPipeline)}
                disabled={saving}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Сбросить
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-xs gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить конвейер"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          Конвейер отключен. Сообщения обрабатываются одним агентом на стандартной модели проекта.
          Нажмите кнопку «Конвейер ВКЛЮЧЕН» выше, чтобы активировать многоагентный режим с разными моделями.
        </div>
      )}
    </div>
  );
}
