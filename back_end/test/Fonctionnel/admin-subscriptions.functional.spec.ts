import "reflect-metadata";
import { DataSource, EntitySchema } from "typeorm";
import { PaypalAdminService } from "../../src/billing/paypal/paypal-admin.service";
import { PaypalSubscription } from "../../src/billing/paypal/paypal-subscription.entity";
import { User } from "../../src/users/user.entity";
const userSchema = new EntitySchema<User>({
  name: "User",
  target: User,
  tableName: "users",
  columns: {
    id: { type: Number, primary: true },
    email: { type: String },
    fullName: { type: String },
    subscriptionPlan: { type: String },
    subscriptionStatus: { type: String },
    subscriptionEndsAt: { type: Date, nullable: true },
    billingProvider: { type: String, nullable: true },
    paypalSubscriptionId: { type: String, nullable: true },
  },
});
const subscriptionSchema = new EntitySchema<PaypalSubscription>({
  name: "PaypalSubscription",
  target: PaypalSubscription,
  tableName: "paypal_subscriptions",
  columns: {
    id: { type: String, primary: true },
    userId: { type: Number },
    paypalId: { type: String },
    environment: { type: String },
    status: { type: String },
    paidUntil: { type: Date, nullable: true },
    syncedAt: { type: Date, nullable: true },
    createdAt: { type: Date },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "userId" },
    },
  },
});
describe("Admin subscription overview (real queries)", () => {
  let db: DataSource;
  let service: PaypalAdminService;
  beforeAll(async () => {
    db = await new DataSource({
      type: "sqlite",
      database: ":memory:",
      entities: [userSchema, subscriptionSchema],
      synchronize: true,
    }).initialize();
    service = new PaypalAdminService(
      db,
      {} as any,
      { environment: "live", configured: true } as any,
    );
    await db
      .getRepository(User)
      .save({
        id: 1,
        email: "demo@example.test",
        fullName: "Camille",
        subscriptionPlan: "CLASSIC",
        subscriptionStatus: "none",
      });
    for (let i = 0; i < 30; i++)
      await db
        .getRepository(PaypalSubscription)
        .save({
          id: String(i).padStart(3, "0"),
          userId: 1,
          paypalId: "I-" + i,
          environment: i < 28 ? "live" : "sandbox",
          status: i % 2 === 0 ? "ACTIVE" : "CANCELLED",
          createdAt: new Date("2026-09-30T00:00:00Z"),
          syncedAt: new Date(),
          paidUntil: new Date(Date.now() + 86400000),
        });
  });
  afterAll(async () => {
    await db?.destroy();
  });
  it("does not mix sandbox subscriptions with real subscriptions", async () => {
    const result = await service.list("", 1, "live");
    expect(result.total).toBe(28);
    expect(result.overview).toMatchObject({
      total: 28,
      active: 14,
      cancelled: 14,
    });
    expect(result.items).toHaveLength(25);
    expect(result.items.every((i) => i.environment === "live")).toBe(true);
    expect((await service.list("", 2, "live")).items).toHaveLength(3);
  });
  it("applies status and search to rows while preserving the matching overview", async () => {
    const result = await service.list("Camille", 1, "live", false, "CANCELLED");
    expect(result.total).toBe(14);
    expect(result.overview.total).toBe(28);
    expect(result.items.every((i) => i.status === "CANCELLED")).toBe(true);
    expect((await service.list("' OR 1=1 --", 1, "live")).total).toBe(0);
  });
  it("rejects unsupported statuses", async () => {
    await expect(
      service.list("", 1, "live", false, "BAD"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
