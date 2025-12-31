export const mailServiceMock = {
  sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
  sendResetPassword: jest.fn().mockResolvedValue(undefined),
};
