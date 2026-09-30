import { User } from "../../src/users/user.entity";
import { Settings } from "../../src/settings/settings.entity";
import "reflect-metadata";
import { DataSource, EntitySchema } from "typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UsersService } from "../../src/users/users.service";
import { CreateUserDto } from "../../src/users/dto/create-user.dto";
const payload = {
  fullName: "Camille",
  email: "camille@example.test",
  password: "Password123!",
};
describe("Registration notification preferences", () => {
  let db: DataSource;
  let service: UsersService;
  beforeEach(async () => {
    db = await new DataSource({
      type: "sqlite",
      database: ":memory:",
      synchronize: true,
      entities: [
        new EntitySchema({
          name: "User",
          target: User,
          columns: {
            id: { type: Number, primary: true, generated: true },
            email: { type: String, unique: true },
            fullName: { type: String },
            password: { type: String },
          },
        }),
        new EntitySchema({
          name: "Settings",
          target: Settings,
          columns: {
            id: { type: Number, primary: true, generated: true },
            ...Object.fromEntries(
              [
                "notificationsEnabled",
                "emailNotifications",
                "pushNotifications",
                "taskReminders",
                "automaticNotifications",
                "newsAndUpdates",
              ].map((key) => [key, { type: Boolean }]),
            ),
          },
          relations: {
            user: { type: "one-to-one", target: "User", joinColumn: true },
          },
        }),
      ],
    }).initialize();
    service = Object.create(UsersService.prototype);
    (service as any).repo = db.getRepository("User");
  });
  afterEach(async () => {
    await db.destroy();
  });
  it.each([
    {
      taskReminders: false,
      automaticNotifications: false,
      newsAndUpdates: false,
    },
    {
      taskReminders: true,
      automaticNotifications: false,
      newsAndUpdates: false,
    },
    {
      taskReminders: false,
      automaticNotifications: true,
      newsAndUpdates: true,
    },
  ])(
    "persists exact choices and derives email activation: %p",
    async (preferences) => {
      const user = await service.create({
        ...payload,
        notificationPreferences: preferences,
      });
      const settings = await db
        .getRepository("Settings")
        .findOne({
          where: { user: { id: user.id } },
          relations: { user: true },
        });
      expect(settings).toMatchObject({
        ...preferences,
        notificationsEnabled: Object.values(preferences).some(Boolean),
        emailNotifications: Object.values(preferences).some(Boolean),
        pushNotifications: false,
      });
    },
  );
  it("rolls back the account if settings cannot be saved", async () => {
    await db.query("DROP TABLE settings");
    await expect(
      service.create({
        ...payload,
        notificationPreferences: {
          taskReminders: true,
          automaticNotifications: false,
          newsAndUpdates: false,
        },
      }),
    ).rejects.toThrow();
    expect(await db.getRepository("User").count()).toBe(0);
  });
  it("accepts older clients that omit preferences", async () => {
    await expect(service.create(payload)).resolves.toMatchObject({
      email: payload.email,
    });
  });
  it.each([
    {
      taskReminders: "true",
      automaticNotifications: false,
      newsAndUpdates: false,
    },
    { taskReminders: true },
    "yes",
    [],
  ])("rejects malformed choices: %p", async (preferences) => {
    const errors = await validate(
      plainToInstance(CreateUserDto, {
        ...payload,
        notificationPreferences: preferences,
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
