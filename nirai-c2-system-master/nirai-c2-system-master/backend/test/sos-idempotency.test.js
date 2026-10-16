import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { mock } from 'node:test';
import { WebSocket } from 'ws';

test('SOS creation is idempotent and cancellation remains terminal', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nirai-sos-test-'));
  const caseStorePath = join(temporaryDirectory, 'cases.json');
  process.env.NIRAI_CASES_FILE = caseStorePath;
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';

  mock.module('../firebaseAdmin.js', {
    namedExports: {
      adminAuth: {
        verifyIdToken: async () => ({ uid: 'test-operator', niraiRole: 'operator' })
      },
      db: null
    },
    defaultExport: null
  });

  let socket;
  let server;
  try {
    ({ server } = await import('../server.js'));
    if (!server.listening || !server.address()) {
      await once(server, 'listening');
    }
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const events = [];

    socket = new WebSocket(`ws://127.0.0.1:${address.port}?token=test-token`);
    socket.on('message', message => {
      events.push(JSON.parse(message.toString()));
    });
    await once(socket, 'open');
    await waitFor(() => events.some(event => event.type === 'INITIAL_STATE'));

    const caseId = `case-test-${Date.now()}`;
    const firstPayload = {
      caseId,
      lat: 13.0827,
      lng: 80.2707,
      reporterName: 'Regression Test',
      address: 'Test-only location'
    };

    const firstResponse = await postJson(`${baseUrl}/v1/sos`, firstPayload);
    assert.equal(firstResponse.status, 201);
    assert.equal(firstResponse.body.success, true);
    assert.equal(firstResponse.body.caseId, caseId);

    const persistedAfterCreate = JSON.parse(await readFile(caseStorePath, 'utf8'));
    assert.equal(persistedAfterCreate.filter(item => item.id === caseId).length, 1);
    await waitFor(() =>
      events.some(event => event.type === 'CASE_CREATED' && event.payload.id === caseId) &&
      events.some(event =>
        event.type === 'AUDIT_LOG_ADDED' &&
        event.payload.action === 'SOS_TRIGGERED' &&
        event.payload.target === caseId
      )
    );

    const retryResponse = await postJson(`${baseUrl}/v1/sos`, {
      ...firstPayload,
      lat: 13.5,
      lng: 80.9,
      reporterName: 'Changed retry'
    });
    assert.equal(retryResponse.status, 200);
    assert.equal(retryResponse.body.caseId, caseId);

    const retryCase = retryResponse.body.case;
    assert.equal(retryCase.status, 'raised');
    assert.deepEqual(retryCase.location, { lat: firstPayload.lat, lng: firstPayload.lng });
    assert.equal(retryCase.reporterName, firstPayload.reporterName);
    const persistedAfterRetry = JSON.parse(await readFile(caseStorePath, 'utf8'));
    assert.equal(persistedAfterRetry.filter(item => item.id === caseId).length, 1);
    await waitForQuietPeriod(events);
    assert.equal(countCaseCreated(events, caseId), 1);
    assert.equal(countAudit(events, 'SOS_TRIGGERED', caseId), 1);

    const cancellationResponse = await postJson(
      `${baseUrl}/v1/cases/${encodeURIComponent(caseId)}/cancel`,
      {}
    );
    assert.equal(cancellationResponse.status, 200);
    assert.equal(cancellationResponse.body.case.status, 'false_alarm');
    await waitFor(() =>
      events.some(event =>
        event.type === 'CASE_UPDATED' &&
        event.payload.id === caseId &&
        event.payload.status === 'false_alarm'
      )
    );

    const retryAfterCancellation = await postJson(`${baseUrl}/v1/sos`, firstPayload);
    assert.equal(retryAfterCancellation.status, 200);
    assert.equal(retryAfterCancellation.body.caseId, caseId);
    assert.equal(retryAfterCancellation.body.case.status, 'false_alarm');
    assert.deepEqual(retryAfterCancellation.body.case.location, {
      lat: firstPayload.lat,
      lng: firstPayload.lng
    });

    const persistedAfterCancellation = JSON.parse(await readFile(caseStorePath, 'utf8'));
    assert.equal(persistedAfterCancellation.filter(item => item.id === caseId).length, 1);
    assert.equal(
      persistedAfterCancellation.find(item => item.id === caseId).status,
      'false_alarm'
    );
    await waitForQuietPeriod(events);
    assert.equal(countCaseCreated(events, caseId), 1);
    assert.equal(countAudit(events, 'SOS_TRIGGERED', caseId), 1);
    assert.equal(countAudit(events, 'CASE_CANCELLED', caseId), 1);
  } finally {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
      await once(socket, 'close');
    }
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
    delete process.env.NIRAI_CASES_FILE;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
  }
});

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function countCaseCreated(events, caseId) {
  return events.filter(event =>
    event.type === 'CASE_CREATED' && event.payload.id === caseId
  ).length;
}

function countAudit(events, action, caseId) {
  return events.filter(event =>
    event.type === 'AUDIT_LOG_ADDED' &&
    event.payload.action === action &&
    event.payload.target === caseId
  ).length;
}

async function waitFor(assertion, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(assertion(), 'Timed out waiting for the expected backend event.');
}

async function waitForQuietPeriod(events, quietPeriodMs = 100) {
  const initialLength = events.length;
  await new Promise(resolve => setTimeout(resolve, quietPeriodMs));
  assert.equal(events.length, initialLength, 'Unexpected WebSocket events during quiet period.');
}
