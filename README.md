# Nutrition App — backend

![CI](https://github.com/Bogdyans/nutrition-app/actions/workflows/ci.yml/badge.svg)

REST + WebSocket API для мобильного приложения-дневника питания: учёт приёмов пищи с распознаванием блюд по фото через AI, аналитика по калориям/БЖУ и весу, отслеживание пищевых реакций, персонализированные рекомендации на основе истории питания, семейные группы и чаты.

Изначально сделан как выпускная квалификационная работа (ГУ «Дубна», 09.03.04), сейчас дорабатывается как pet/портфолио-проект.

## Стек

- **Платформа:** NestJS 11, TypeScript, Node.js 24
- **Данные:** PostgreSQL, Prisma ORM (driver adapter `@prisma/adapter-pg`)
- **Аутентификация:** Passport (JWT + local), bcrypt, access/refresh-токены с ротацией
- **Realtime:** Socket.IO (`@nestjs/websockets`) — чаты
- **AI:** OpenAI SDK поверх OpenRouter (распознавание блюд по фото, текстовые рекомендации), Google Gemini как альтернативный провайдер рекомендаций
- **Почта:** Resend / Brevo HTTP API (без исходящего SMTP)
- **Инфраструктура:** Docker (multi-stage build), docker-compose, Caddy (TLS-терминация), GitHub Actions CI
- **Качество:** ESLint (type-aware, `@typescript-eslint/recommendedTypeChecked`), Prettier, Jest

## Инженерные решения, которые стоит отметить

Короткий список того, что в проекте сделано не «для галочки», а осознанно — в коде рядом с каждым пунктом есть комментарий, объясняющий «почему»:

- **Ротация refresh-токенов с отзывом по `jti`.** Токены хранятся в БД хэшированными (bcrypt), при логауте/смене пароля отзываются явно; смена пароля инвалидирует все остальные сессии, кроме текущей — [token.service.ts](src/modules/core/auth/token/token.service.ts), [profile.service.ts](src/modules/open/profile/profile.service.ts)
- **Аутентификация WebSocket через Socket.IO middleware**, а не только через декоратор на отдельных хендлерах — соединение проверяется JWT до того, как сокет считается подключённым — [chats.gateway.ts](src/modules/open/chats/chats.gateway.ts)
- **Пессимистичные блокировки (`SELECT … FOR UPDATE`)** на изменении приёма пищи — защита от гонок при параллельном редактировании одного и того же приёма — [meals.service.ts](src/modules/open/meals/meals.service.ts)
- **AI-провайдер скрыт за интерфейсом** (`RecommendationAiProvider`), OpenRouter/Gemini — взаимозаменяемые реализации; ответ vision-модели валидируется как untrusted input перед использованием — [recommendation-ai.provider.ts](src/modules/open/recommendations/domain/recommendation-ai.provider.ts), [vision-output.validator.ts](src/modules/open/recognition/domain/vision-output.validator.ts)
- **Единая обработка ошибок и сквозная трассировка запроса**: глобальный exception filter нормализует ошибки Prisma в предсказуемый HTTP-ответ, каждый запрос получает `x-request-id`, попадающий и в логи, и в тело ошибки — [all-exceptions.filter.ts](src/shared/filters/all-exceptions.filter.ts), [request-id.middleware.ts](src/shared/middleware/request-id.middleware.ts)
- **Таймзона пользователя учитывается при расчёте границ суток** в статистике и списке приёмов пищи, а не только в UTC — покрыто unit-тестами на граничные случаи
- **Валидация переменных окружения при старте** (Joi) — приложение не поднимется с отсутствующим секретом или одинаковыми access/refresh JWT-секретами, вместо непонятной ошибки на первом запросе

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
└── tasks/                # cron-задачи (очистка просроченных токенов)
```

В модулях `recognition` и `recommendations` код разделён на `domain` (чистая логика, без зависимостей от Nest/Prisma) и `infrastructure` (адаптеры к внешним AI-провайдерам).

## Быстрый старт

```bash
git clone https://github.com/Bogdyans/nutrition-app.git
cd nutrition-app
npm install
```

Создайте `.env` в корне проекта (см. таблицу переменных ниже), затем:

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

Полный пример — [.env.production.example](.env.production.example).

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

`Dockerfile` — многоступенчатая (multi-stage) сборка: зависимости → сборка → минимальный production-образ; миграции применяются при старте контейнера. `docker-compose.yml` поднимает приложение, PostgreSQL и Caddy (TLS-терминация, см. [Caddyfile](Caddyfile)) одной командой:

```bash
docker compose up -d --build
```

## Лицензия

Пока без открытой лицензии (`package.json` → `UNLICENSED`, `private`) — код опубликован для портфолио/ревью, но не размечен как свободный для реиспользования. Если нужно явно разрешить реиспользование, самый простой вариант — добавить `LICENSE` (например MIT) и поменять поле `license` в `package.json`.

Автор: Богдан Барыкин — [bogdya2004@gmail.com](mailto:bogdya2004@gmail.com), Telegram [@Bogdyan2](https://t.me/Bogdyan2)
