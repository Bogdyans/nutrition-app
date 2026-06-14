import * as Joi from 'joi';

/**
 * Validated at boot by ConfigModule — the app refuses to start with missing or
 * malformed configuration instead of failing opaquely on the first request
 * (e.g. a quoted URL or a short/reused JWT secret).
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid(Joi.ref('JWT_ACCESS_SECRET'))
    .required()
    .messages({
      'any.invalid': 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
    }),

  GEMINI_API_KEY: Joi.string().required(),

  RECOMMENDATION_OPENROUTER_API_KEY: Joi.string().required(),
  RECOMMENDATION_OPENROUTER_API_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  RECOMMENDATION_OPENROUTER_MODEL: Joi.string().required(),

  VISION_OPENROUTER_API_KEY: Joi.string().required(),
  VISION_OPENROUTER_API_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  VISION_OPENROUTER_MODEL: Joi.string().required(),

  // SMTP (email confirmation). Optional: without it the verification code is
  // logged to the console instead of being emailed (dev fallback).
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().default(465),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().optional(),
});

/** Show every config problem at once; ignore unrelated OS env vars. */
export const envValidationOptions = {
  allowUnknown: true,
  abortEarly: false,
};
