import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationalEvent } from "./entities/operational-event.entity";

@Injectable()
export class AdminOperationsService {
  constructor(
    @InjectRepository(OperationalEvent)
    private readonly events: Repository<OperationalEvent>,
  ) {}

  async list(query: {
    range?: string;
    type?: string;
    page?: string;
    route?: string;
  }) {
    if (
      Object.values(query).some(
        (value) => typeof value !== "string" && value !== undefined,
      )
    ) {
      throw new BadRequestException("Filtres de journal invalides.");
    }
    const range = query.range ?? "7d";
    const type = query.type ?? "all";
    const page = Number(query.page ?? "1");
    const route = query.route?.trim() ?? "";
    const days: Record<string, number> = {
      "1d": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    if (
      !Object.prototype.hasOwnProperty.call(days, range) ||
      ![
        "all",
        "API_ERROR",
        "STRIPE_FAILURE",
        "PAYPAL_FAILURE",
        "EMAIL_FAILURE",
      ].includes(type) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      route.length > 180
    ) {
      throw new BadRequestException("Filtres de journal invalides.");
    }
    try {
      const qb = this.events
        .createQueryBuilder("event")
        .where("event.createdAt >= :from", {
          from: new Date(Date.now() - days[range] * 86400000),
        });
      if (type !== "all") qb.andWhere("event.type = :type", { type });
      if (route)
        qb.andWhere("event.route LIKE :route", { route: `%${route}%` });
      const [items, total] = await qb
        .orderBy("event.createdAt", "DESC")
        .addOrderBy("event.id", "DESC")
        .skip((page - 1) * 25)
        .take(25)
        .getManyAndCount();
      return {
        items,
        total,
        page,
        pageSize: 25,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException(
        "Le journal applicatif est momentanément indisponible.",
      );
    }
  }
}
