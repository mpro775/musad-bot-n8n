// src/app.module.spec.ts
describe('AppModule (compile)', () => {
  it('should compile the Nest testing module', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_MINIMAL_BOOT = '1';

    // لتجنّب أخطاء مفاتيح JWT إذا استُخدمت في أي مكان
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

    jest.resetModules(); // مهم قبل import

    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close(); // يمنع "Jest did not exit..."
  });
});
