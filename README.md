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

Создайте `.env` и задайте параметры подключения к Supabase:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
```

`DATABASE_URL` используется только для запуска миграций через `npm run db:migrate`.

## Команды

- `npm run dev` — локальный сервер разработки;
- `npm run build` — production-сборка;
- `npm run preview` — локальный просмотр production-сборки;
- `npm run db:migrate` — применение миграций Drizzle.
