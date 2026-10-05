# Финпланер CRM

CRM для отдела продаж: клиенты, сделки, платежи, планы и показатели команды.

## Локальный запуск

Требуется Node.js 20.19 или новее.

```sh
npm install
npm run dev
```

Приложение откроется по адресу `http://localhost:8080`.

## Переменные окружения

Скопируйте `.env.example` в локальный файл `.env` и заполните значения:

```sh
cp .env.example .env
```

В PowerShell:

```powershell
Copy-Item .env.example .env
```

Для запуска приложения нужны четыре публичные переменные подключения к Supabase:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

- `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY` используются серверной частью приложения.
- Переменные с префиксом `VITE_` попадают в клиентскую сборку и поэтому не должны содержать секреты.
- `SUPABASE_SERVICE_ROLE_KEY` нужен только для доверенных серверных административных операций. Его нельзя передавать в браузер или называть с префиксом `VITE_`.
- `DATABASE_URL` нужен только для применения миграций через `npm run db:migrate`.

Файл `.env` исключён из Git. В репозиторий добавляется только безопасный шаблон `.env.example` без настоящих ключей.

## Команды

- `npm run dev` — локальный сервер разработки;
- `npm run build` — production-сборка;
- `npm run preview` — локальный просмотр production-сборки;
- `npm run db:migrate` — применение миграций Drizzle.
