import { CunguClient } from '../cungu.client';

/**
 * Integration test stub for the Cungu client.
 * Marked as skipped until WAN connectivity to the Cungu API is available.
 */
describe.skip('CunguClient (integration)', () => {
  it('performs login and sample GetIssueDocWMS call', async () => {
    const client = new CunguClient();
    const documents = await client.postGet<any>({
      method: 'GetIssueDocWMS',
      filters: {
        'm.adDate': { operator: '>=', value: new Date().toISOString().slice(0, 10) },
      },
      limit: 1,
    });

    expect(documents).toBeDefined();
  });
});



