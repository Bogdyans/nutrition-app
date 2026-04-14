import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductSource, ProductVisibility } from '@prisma/client';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto) {
    const visibility = dto.visibility ?? ProductVisibility.PRIVATE;

    if (visibility === ProductVisibility.PUBLIC) {
      throw new BadRequestException('Users cannot create PUBLIC products');
    }

    const name = dto.name.trim();

    return this.prisma.product.create({
      data: {
        name,
        calories: dto.calories ?? 0,
        proteins: dto.proteins ?? 0,
        fats: dto.fats ?? 0,
        carbs: dto.carbs ?? 0,
        source: ProductSource.MANUAL,
        visibility,
        ownerId: userId,
      },
    });
  }

  async findAvailableForUser(userId: string, dto: GetProductsDto) {
    const query = dto.query?.trim();
    const cursor = dto.cursor;
    const limit = dto.limit ?? 20;

    const items = await this.prisma.product.findMany({
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,

      where: {
        deletedAt: null,
        name: query ? { contains: query, mode: 'insensitive' } : undefined,

        OR: [
          { ownerId: userId },
          { visibility: ProductVisibility.SHARED },
          { visibility: ProductVisibility.PUBLIC },
        ],
      },

      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    });

    let nextCursor: string | undefined = undefined;

    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: items,
      meta: {
        nextCursor,
        hasNextPage: !!nextCursor,
      },
    };
  }

  async updateVisibility(
    userId: string,
    productId: string,
    visibility: ProductVisibility,
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.ownerId !== userId) {
      throw new BadRequestException('No access to this product');
    }

    if (visibility === ProductVisibility.PUBLIC) {
      throw new BadRequestException('Cannot set PUBLIC visibility');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { visibility },
    });
  }

  async delete(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.ownerId !== userId) {
      throw new BadRequestException('No access to this product');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
