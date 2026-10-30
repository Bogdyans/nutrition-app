import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
};

const createHost = (type: 'http' | 'ws' = 'http') => {
  // Тело ответа собирается в типизированную переменную: jest.Mock#mock.calls
  // вырождается в `any` и тянет за собой no-unsafe-member-access.
  let sent: ErrorBody | undefined;

  const json = jest.fn((payload: ErrorBody) => {
    sent = payload;
  });
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/api/meals',
        method: 'GET',
        requestId: 'req-42',
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    status,
    body: () => sent,
  };
};

const catchWith = (
  exception: unknown,
  { isProduction = false }: { isProduction?: boolean } = {},
) => {
  const filter = new AllExceptionsFilter(isProduction);
  const { host, status, body } = createHost();

  filter.catch(exception, host);

  return { status, body: body() };
};

beforeAll(() => {
  // Фильтр логирует каждое исключение — в выводе тестов это лишний шум.
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('AllExceptionsFilter — HttpException', () => {
  it('сохраняет статус и сообщение', () => {
    const { status, body } = catchWith(
      new ForbiddenException('Нет доступа к группе'),
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(body?.statusCode).toBe(403);
    expect(body?.message).toBe('Нет доступа к группе');
  });

  it('сохраняет массив сообщений от ValidationPipe', () => {
    const { body } = catchWith(
      new BadRequestException(['поле date обязательно', 'лимит слишком велик']),
    );

    expect(body?.message).toEqual([
      'поле date обязательно',
      'лимит слишком велик',
    ]);
  });

  it('добавляет путь и requestId для связи с логами', () => {
    const { body } = catchWith(new ForbiddenException());

    expect(body?.path).toBe('/api/meals');
    expect(body?.requestId).toBe('req-42');
    expect(body?.timestamp).toBeDefined();
  });
});

describe('AllExceptionsFilter — ошибки Prisma', () => {
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('ошибка БД', {
      code,
      clientVersion: '7.7.0',
    });

  it('нарушение уникальности превращает в 409, а не в 500', () => {
    const { status, body } = catchWith(prismaError('P2002'));

    expect(status).toHaveBeenCalledWith(409);
    expect(body?.error).toBe('Conflict');
  });

  it('отсутствующую запись превращает в 404', () => {
    const { status } = catchWith(prismaError('P2025'));

    expect(status).toHaveBeenCalledWith(404);
  });

  it('нарушение внешнего ключа превращает в 400', () => {
    const { status } = catchWith(prismaError('P2003'));

    expect(status).toHaveBeenCalledWith(400);
  });

  it('незнакомый код Prisma не раскрывает деталей в проде', () => {
    const { status, body } = catchWith(prismaError('P2099'), {
      isProduction: true,
    });

    expect(status).toHaveBeenCalledWith(500);
    expect(body?.message).toBe('Внутренняя ошибка сервера');
  });
});

describe('AllExceptionsFilter — неизвестные ошибки', () => {
  it('в проде не отдаёт текст ошибки наружу', () => {
    const { status, body } = catchWith(
      new Error('connect ECONNREFUSED 10.0.0.5:5432'),
      { isProduction: true },
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(body?.message).toBe('Внутренняя ошибка сервера');
  });

  it('вне прода отдаёт текст ошибки для отладки', () => {
    const { body } = catchWith(new Error('что-то сломалось'), {
      isProduction: false,
    });

    expect(body?.message).toBe('что-то сломалось');
  });

  it('переживает выброшенную не-ошибку', () => {
    const { status } = catchWith('строка вместо ошибки');

    expect(status).toHaveBeenCalledWith(500);
  });
});

describe('AllExceptionsFilter — не-HTTP контекст', () => {
  it('не пытается отвечать на WebSocket-исключение', () => {
    const filter = new AllExceptionsFilter(false);
    const { host, status } = createHost('ws');

    filter.catch(new Error('сбой сокета'), host);

    expect(status).not.toHaveBeenCalled();
  });
});
