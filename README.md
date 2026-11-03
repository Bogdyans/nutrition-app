# PerekusovNET — backend

![CI](https://github.com/Bogdyans/nutrition-app/actions/workflows/ci.yml/badge.svg)

REST + WebSocket API для мобильного приложения-дневника питания: учёт приёмов пищи с распознаванием блюд по фото через AI, аналитика по калориям/БЖУ и весу, отслеживание пищевых реакций, персонализированные рекомендации на основе истории питания, семейные группы и чаты.

## Стек

- **Платформа:** NestJS 11, TypeScript, Node.js 24
- **Данные:** PostgreSQL, Prisma ORM (driver adapter `@prisma/adapter-pg`)
- **Аутентификация:** Passport (JWT + local), bcrypt, access/refresh-токены с ротацией
- **Sockets:** Socket.IO (`@nestjs/websockets`) — чаты
- **AI:** OpenAI SDK поверх OpenRouter (распознавание блюд по фото, текстовые рекомендации), Google Gemini как альтернативный провайдер рекомендаций
- **Почта:** Resend / Brevo HTTP API 
- **Инфраструктура:** Docker, docker-compose, Caddy, GitHub Actions CI
- **Качество:** ESLint, Prettier, Jest

## Структура

```
src/
├── config/              # валидация env (Joi)
├── modules/
│   ├── core/             # auth, prisma, mail — инфраструктурный слой
│   ├── closed/           # users — внутренние сервисы без публичного API
│   └── open/              # публичные фичи: meals, stats, recognition,
│                          # recommendations, family, chats, reactions, ...
├── shared/               # guards, interceptors, filters, decorators, utils
└── tasks/                # cron-задачи 
```

В модулях `recognition` и `recommendations` код разделён на `domain` (чистая логика, без зависимостей от Nest/Prisma) и `infrastructure` (адаптеры к внешним AI-провайдерам).

## Быстрый старт

```bash
git clone https://github.com/Bogdyans/nutrition-app.git
cd nutrition-app
npm install
cp .env.example .env
```

Инициализируйте `.env` переменные в корне проекта, затем:

```bash
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API будет доступно на `http://localhost:3001/api`, Swagger-документация — на `http://localhost:3001/docs` (только вне `production`).

### Переменные окружения

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | да | строка подключения к PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | да | ≥32 символов, должны отличаться друг от друга |
| `GEMINI_API_KEY` | да | провайдер рекомендаций Google Gemini |
| `RECOMMENDATION_OPENROUTER_API_KEY/URL/MODEL` | да | провайдер текстовых рекомендаций через OpenRouter |
| `VISION_OPENROUTER_API_KEY/URL/MODEL` | да | распознавание блюд на фото |
| `PORT`, `NODE_ENV` | нет | по умолчанию `3001` / `development` |
| `RESEND_API_KEY` или `BREVO_API_KEY` | нет | отправка писем с кодом подтверждения; без ключей код просто пишется в лог (режим разработки) |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | нет | отправитель писем |

Полный пример — [.env.example](.env.example).

## Тесты и качество кода

```bash
npm run lint    # ESLint (type-aware), --fix
npm test        # unit-тесты (Jest)
npm run build   # сборка (nest build)
```

Юнит-тесты покрывают прежде всего логику с реальным риском ошибок: границы суток в разных таймзонах, парсинг ответа vision-модели, скоринг при сопоставлении продуктов, обработку ошибок. На каждый push/PR эти три шага гоняются в GitHub Actions — см. [.github/workflows/ci.yml](.github/workflows/ci.yml).

## API

- Swagger UI — `/docs` (dev/staging)
- Коллекция Postman — [nutrition-app.postman_collection.json](nutrition-app.postman_collection.json)

## Деплой

`Dockerfile` — многоступенчатая сборка: зависимости → сборка → минимальный production-образ; миграции применяются при старте контейнера. `docker-compose.yml` поднимает приложение, PostgreSQL и Caddy одной командой:

```bash
docker compose up -d --build
```

Автор: Богдан Барыкин — [bogdya2004@gmail.com](mailto:bogdya2004@gmail.com), Telegram [@Bogdyan2](https://t.me/Bogdyan2)
