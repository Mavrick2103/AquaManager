import "reflect-metadata";
import { DataSource, EntitySchema } from "typeorm";
import {
  AdminUserDossierService,
  DOSSIER_SECTIONS,
} from "../../src/users/admin-user-dossier.service";
import { AdminUsersController } from "../../src/users/admin-users.controller";
import { Reflector } from "@nestjs/core";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";
const schema = (name: string, fields: string[]) =>
  new EntitySchema({
    name,
    columns: Object.fromEntries(
      ["id", ...fields].map((f) => [
        f,
        f === "id"
          ? { type: Number, primary: true }
          : f === "userId" || f === "aquariumId"
            ? { type: Number, nullable: true }
            : { type: String, nullable: true },
      ]),
    ),
  });
describe("Admin user dossier boundaries", () => {
  let db: DataSource;
  let service: AdminUserDossierService;
  beforeAll(async () => {
    db = await new DataSource({
      type: "sqlite",
      database: ":memory:",
      synchronize: true,
      entities: [
        schema(
          "User",
          "fullName email pendingEmail role subscriptionPlan subscriptionStatus subscriptionEndsAt billingProvider paypalSubscriptionId paypalRenewalActive stripeCustomerId stripeSubscriptionId createdAt emailVerifiedAt lastActivityAt password refreshHash".split(
            " ",
          ),
        ),
        schema("Aquarium", [
          "userId",
          ...DOSSIER_SECTIONS.aquariums.fields.filter((f) => f !== "id"),
        ]),
        schema(
          "WaterMeasurement",
          DOSSIER_SECTIONS.measurements.fields.filter((f) => f !== "id"),
        ),
      ],
    }).initialize();
    service = new AdminUserDossierService(db);
    await db.getRepository("User").save([
      { id: 1, email: "one@example.test", password: "never-return" },
      { id: 2, email: "two@example.test" },
    ]);
    await db.getRepository("Aquarium").save([
      {
        id: 1,
        userId: 1,
        name: "Own",
        createdAt: "2026-09-01",
        archivedAt: "2026-09-20",
      },
      { id: 2, userId: 2, name: "Other", createdAt: "2026-09-01" },
    ]);
    await db
      .getRepository("WaterMeasurement")
      .save(
        Array.from({ length: 28 }, (_, i) => ({
          id: i + 1,
          aquariumId: i === 27 ? 2 : 1,
          ph: "7",
          measuredAt: "2026-09-01",
        })),
      );
  });
  afterAll(async () => {
    await db?.destroy();
  });
  it("restricts dossier endpoints to authenticated admins", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminUsersController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, RolesGuard]),
    );
    for (const method of ["dossierOverview", "dossierRecords"])
      for (const role of ["USER", "EDITOR", undefined, "ADMIN"]) {
        const context: any = {
          getHandler: () => AdminUsersController.prototype[method],
          getClass: () => AdminUsersController,
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
  it("paginates all owned records deterministically and excludes other accounts", async () => {
    const a = await service.records(1, "measurements", {}),
      b = await service.records(1, "measurements", { page: "2" });
    expect(a.total).toBe(27);
    expect(a.items).toHaveLength(25);
    expect(b.items).toHaveLength(2);
    expect(new Set([...a.items, ...b.items].map((r) => r.id)).size).toBe(27);
    expect(
      (await service.records(1, "measurements", { aquariumId: "2" })).total,
    ).toBe(0);
    expect(
      (await service.records(1, "aquariums", {})).items[0].archivedAt,
    ).toBe("2026-09-20");
  });
  it.each([
    ["__proto__", {}],
    ["constructor", {}],
    ["measurements", { page: "0" }],
    ["measurements", { aquariumId: "1 OR 1=1" }],
    ["measurements", { page: ["1", "2"] }],
  ] as any[])(
    "rejects invalid section or filters %s",
    async (section, query) => {
      await expect(service.records(1, section, query)).rejects.toMatchObject({
        status: 400,
      });
    },
  );
  it("rejects missing and invalid users", async () => {
    await expect(service.records(999, "aquariums", {})).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.records(NaN, "aquariums", {})).rejects.toMatchObject({
      status: 400,
    });
  });
});
