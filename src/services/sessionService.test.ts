import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser } from './sessionService';

const API = 'http://api.test';

function mockMe(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSessionUser', () => {
  it('returns the customer id for customer accounts', async () => {
    const fetchMock = mockMe({ customerId: 3, role: 'customer' });

    const user = await getSessionUser(API, 'token');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API}/me`);
    expect(user).toEqual({ isAdmin: false, customerId: 3 });
  });

  it('returns no customer id for staff accounts', async () => {
    mockMe({ staffID: 9, role: 'admin' });

    expect(await getSessionUser(API, 'token')).toEqual({
      isAdmin: true,
      customerId: undefined,
    });
  });

  it.each([0, -1, 1.5, '3', null])(
    'ignores an invalid customer id of %s',
    async (customerId) => {
      mockMe({ customerId, role: 'customer' });

      expect((await getSessionUser(API, 'token'))?.customerId).toBeUndefined();
    },
  );

  it('returns null when the token is rejected', async () => {
    mockMe({ error: 'Invalid or expired access token' }, 401);

    expect(await getSessionUser(API, 'token')).toBeNull();
  });
});
