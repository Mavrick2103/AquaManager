import { OperationalEventsInterceptor } from "../../src/admin/operational-events.interceptor";
import { lastValueFrom, throwError } from "rxjs";

describe("Operational event privacy", () => {
  it("records PayPal failures without query strings or credentials", async () => {
    const save = jest.fn().mockResolvedValue({});
    const interceptor = new OperationalEventsInterceptor({
      create: (x) => x,
      save,
    } as any);
    const context: any = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => ({
          route: { path: "/billing/paypal/:id" },
          path: "/billing/paypal/secret?token=password",
          body: { password: "secret" },
        }),
      }),
    };
    const error = new Error("Sensitive provider details");
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);
    expect(save).toHaveBeenCalledWith({
      type: "PAYPAL_FAILURE",
      route: "/billing/paypal/:id",
      statusCode: 500,
    });
  });
  it("does not classify validation failures as server incidents", async () => {
    const save = jest.fn();
    const interceptor = new OperationalEventsInterceptor({
      create: (x) => x,
      save,
    } as any);
    const context: any = { getType: () => "http" };
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => ({ status: 400 })),
        }),
      ),
    ).rejects.toEqual({ status: 400 });
    expect(save).not.toHaveBeenCalled();
  });
});
