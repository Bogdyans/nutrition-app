import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
};

type NormalizedError = {
  status: number;
  message: string | string[];
  error: string;
};

const GENERIC_MESSAGE = 'Внутренняя ошибка сервера';

// Числом, а не HttpStatus: status здесь — обычный number, и сравнение с
// членом enum ловится правилом no-unsafe-enum-comparison.
const SERVER_ERROR_THRESHOLD = 500;

/**
 * Единая точка превращения исключений в HTTP-ответ.
 *
 * Даёт три вещи, которых не было: стабильную форму тела ошибки, привязку
 * ошибки к requestId (иначе по логам не найти конкретный запрос) и защиту от
 * утечки внутренних деталей — текст неизвестной ошибки в прод не уходит.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // WebSocket-исключения приходят сюда же, но у них нет HTTP-ответа.
    if (host.getType() !== 'http') {
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, message, error } = this.normalize(exception);

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    this.log(exception, request, status);

    response.status(status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Nest отдаёт либо строку, либо объект — у ValidationPipe это объект с
      // массивом сообщений, который важно сохранить как есть.
      if (typeof payload === 'string') {
        return { status, message: payload, error: exception.name };
      }

      const record = payload as Record<string, unknown>;

      return {
        status,
        message: (record.message ?? exception.message) as string | string[],
        error: (record.error ?? exception.name) as string,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrisma(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.isProduction
        ? GENERIC_MESSAGE
        : exception instanceof Error
          ? exception.message
          : String(exception),
      error: 'Internal Server Error',
    };
  }

  private normalizePrisma(
    exception: Prisma.PrismaClientKnownRequestError,
  ): NormalizedError {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Запись с такими данными уже существует',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Запись не найдена',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Ссылка на несуществующую запись',
          error: 'Bad Request',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: this.isProduction
            ? GENERIC_MESSAGE
            : `Ошибка базы данных: ${exception.code}`,
          error: 'Internal Server Error',
        };
    }
  }

  private log(exception: unknown, request: Request, status: number) {
    const context = `${request.method} ${request.url} -> ${status} [${request.requestId ?? '-'}]`;

    // 4xx — это ожидаемые отказы (валидация, права), они не должны шуметь
    // на уровне error и поднимать алерты.
    if (status < SERVER_ERROR_THRESHOLD) {
      this.logger.warn(context);
      return;
    }

    this.logger.error(
      context,
      exception instanceof Error ? exception.stack : String(exception),
    );
  }
}
