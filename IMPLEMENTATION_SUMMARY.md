# Реализация системы прав доступа к проектам

## ✅ Что было сделано

### 1. Добавлены типы данных
**Файл:** `src/lib/types.ts`

```typescript
export interface ProjectAccessEntry {
  allowedUserIds: string[];
}

export interface ProjectAccessRules {
  adminUserIds: string[];
  projectAccess: Record<string, ProjectAccessEntry>;
  updatedAt?: string;
}
```

### 2. Создан модуль управления правами
**Файл:** `src/lib/storage/project-access-store.ts`

Функции:
- `getProjectAccessRules()` - чтение правил
- `saveProjectAccessRules()` - сохранение правил
- `canUserAccessProject(userId, projectId)` - проверка доступа
- `getAccessibleProjects(allProjects, userId)` - фильтрация проектов
- `getFirstAccessibleProject(allProjects, userId)` - первый доступный проект
- `addUserToProject(userId, projectId)` - добавить пользователя
- `removeUserFromProject(userId, projectId)` - удалить пользователя
- `addAdminUser(userId)` - сделать админом
- `removeAdminUser(userId)` - убрать из админов

### 3. Создана начальная конфигурация
**Файл:** `~/.eggent/data/settings/project-access.json`

```json
{
  "adminUserIds": ["476496854"],
  "projectAccess": {
    "c646d643": {
      "allowedUserIds": ["476496854", "535387230", "1157186062", "5226029084"]
    },
    "8e6932df": {
      "allowedUserIds": ["476496854"]
    },
    "ai": {
      "allowedUserIds": ["476496854"]
    }
  }
}
```

### 4. Интегрирована проверка прав в Telegram webhook
**Файл:** `src/app/api/integrations/telegram/route.ts`

- Добавлен импорт функций из `project-access-store.ts`
- Обновлена `resolveTelegramProjectContext()` - теперь принимает `userId` и фильтрует проекты
- Обновлена `ensureTelegramExternalChatContext()` - теперь принимает `userId`
- Добавлена проверка прав для текстовых сообщений
- При отсутствии доступных проектов пользователю показывается сообщение

### 5. Обратная совместимость
- Если файл `project-access.json` не существует → все пользователи имеют доступ ко всем проектам (старое поведение)
- Настройки хранятся в `data/settings/`, которая сохраняется при обновлениях

## 📁 Измененные файлы

```
src/lib/types.ts                                  # Добавлены типы
src/lib/storage/project-access-store.ts           # Новый модуль
src/app/api/integrations/telegram/route.ts        # Интеграция проверки прав
data/settings/project-access.json                 # Конфигурация прав доступа
PROJECT_ACCESS.md                                 # Документация
```

## 🚀 Как использовать

### Для изменения прав доступа:

Отредактируйте файл `~/.eggent/data/settings/project-access.json`:

```bash
nano ~/.eggent/data/settings/project-access.json
```

### Добавить нового пользователя:

```json
{
  "projectAccess": {
    "c646d643": {
      "allowedUserIds": [
        "476496854",
        "535387230",
        "1157186062",
        "5226029084",
        "НОВЫЙ_USER_ID"
      ]
    }
  }
}
```

### Сделать пользователя админом:

```json
{
  "adminUserIds": [
    "476496854",
    "НОВЫЙ_ADMIN_USER_ID"
  ]
}
```

## ✅ Текущие права

| User ID | Admin | Проекты |
|---------|-------|---------|
| 476496854 | ✅ | Все (Семья, Работа, ai) |
| 535387230 | ❌ | Семья |
| 1157186062 | ❌ | Семья |
| 5226029084 | ❌ | Семья |

## 🔒 Безопасность

- ✅ Проверка прав на серверной стороне
- ✅ Настройки сохраняются при обновлениях (в `data/`)
- ✅ Обратная совместимость
- ✅ Понятные сообщения об ошибках

## 📝 Документация

Полная документация: `~/.eggent/PROJECT_ACCESS.md`
