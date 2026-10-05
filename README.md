# IBA CRM Case

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5b463402-f69d-463c-a386-d9fad5c50c58).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Environment variables

Copy `.env.example` to a local `.env` file before starting the application:

```sh
cp .env.example .env
```

In PowerShell:

```powershell
Copy-Item .env.example .env
```

The application requires these public Supabase connection values:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

- Server-side application code uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- Variables prefixed with `VITE_` are included in the client bundle and must never contain secrets.
- `SUPABASE_SERVICE_ROLE_KEY` is needed only for trusted server-side administrative operations. Never expose it through a `VITE_` variable.
- `DATABASE_URL` is needed only when applying database migrations.

The local `.env` file is ignored by Git. Only the placeholder-only `.env.example` template belongs in the repository.
