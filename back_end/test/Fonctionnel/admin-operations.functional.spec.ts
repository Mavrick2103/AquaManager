import "reflect-metadata";
import { DataSource } from "typeorm";
import { AdminOperationsService } from "../../src/admin/admin-operations.service";
import { OperationalEvent } from "../../src/admin/entities/operational-event.entity";
import { AdminMetricsController } from "../../src/admin/admin-metrics.controller";
import { Reflector } from "@nestjs/core";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";

describe("Admin journal: access, real queries and pagination", () => {
  let db: DataSource;
  let service: AdminOperationsService;
  beforeAll(async () => {
    db = await new DataSource({
      type: "sqlite",
      database: ":memory:",
      entities: [OperationalEvent],
      synchronize: true,
    }).initialize();
    service = new AdminOperationsService(db.getRepository(OperationalEvent));
    await db
      .getRepository(OperationalEvent)
      .save(
        Array.from({ length: 31 }, (_, i) => ({
          type: "API_ERROR" as const,
          route: "/aquariums/:id",
          statusCode: 500,
          createdAt: new Date(Date.now() - i * 1000),
        })),
      );
    await db
      .getRepository(OperationalEvent)
      .save({
        type: "PAYPAL_FAILURE",
        route: "/billing/paypal/refresh",
        statusCode: 503,
        createdAt: new Date(),
      });
    await db
      .getRepository(OperationalEvent)
      .save({
        type: "API_ERROR",
        route: "/old",
        statusCode: 500,
        createdAt: new Date(Date.now() - 100 * 86400000),
      });
  });
  afterAll(async () => {
    await db?.destroy();
  });
  it("restricts both technical endpoints to authenticated admins", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminMetricsController),
    ).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    for (const method of ["operationsList", "operationsHealth"])
      for (const role of ["USER", "EDITOR", undefined, "ADMIN"]) {
        const context: any = {
          getHandler: () => AdminMetricsController.prototype[method],
          getClass: () => AdminMetricsController,
          switchToHttp: () => ({
            getRequest: () => ({ user: role ? { role } : undefined }),
          }),
        };
        const check = () =>
          new RolesGuard(new Reflector()).canActivate(context);
        if (role === "ADMIN") expect(check()).toBe(true);
        else expect(check).toThrow();
      }
  });
  it("paginates deterministically without duplicating entries", async () => {
    const first = await service.list({});
    const second = await service.list({ page: "2" });
    expect(first.total).toBe(32);
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(7);
    expect(
      new Set([...first.items, ...second.items].map((e) => e.id)).size,
    ).toBe(32);
  });
  it("combines time, category and route filters", async () => {
    const result = await service.list({
      type: "PAYPAL_FAILURE",
      route: "paypal",
      range: "1d",
    });
    expect(result.total).toBe(1);
    expect(result.items[0].statusCode).toBe(503);
    expect((await service.list({ route: "' OR 1=1 --" })).total).toBe(0);
  });
  it.each([
    { page: "0" },
    { page: "1.2" },
    { page: "Infinity" },
    { range: "all" },
    { type: "PASSWORD" },
    { route: "x".repeat(181) },
    { route: ["bad"] },
  ])("rejects invalid filters %p", async (query) => {
    await expect(service.list(query as any)).rejects.toMatchObject({
      status: 400,
    });
  });
  it("reports unavailable storage instead of an empty successful journal", async () => {
    const broken = new AdminOperationsService({
      createQueryBuilder: () => {
        throw new Error("secret db password");
      },
    } as any);
    await expect(broken.list({})).rejects.toMatchObject({
      status: 503,
      message: "Le journal applicatif est momentanément indisponible.",
    });
  });
});
