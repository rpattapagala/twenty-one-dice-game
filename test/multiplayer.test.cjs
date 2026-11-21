const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../game.cjs');
const { createServer } = require('../server.cjs');

test('turn ownership, first roll, roll limit, and twenty one winner', async () => {
    const values = [2, 1, 6, 6];
    const game = new Game([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }], 30, () => {}, () => values.shift());
    try {
        assert.equal(game.action('b', 'both'), false);
        assert.equal(game.action('a', 'left'), false);
        assert.equal(game.action('a', 'end'), false);
        assert.equal(game.action('a', 'constructor'), false);
        assert.equal(game.action('a', 'both'), true);
        assert.equal(game.action('a', 'both'), false);
        await new Promise(resolve => setTimeout(resolve, 620));
        assert.equal(game.current, 1);
        assert.equal(game.limit, 1);
        assert.equal(game.action('b', 'both'), true);
        await new Promise(resolve => setTimeout(resolve, 620));
        assert.equal(game.roundOver, true);
        assert.equal(game.players[0].wins, 1);
        game.nextRound();
        assert.equal(game.current, 0);
        assert.equal(game.players[0].score, 0);
        assert.equal(game.players[0].wins, 1);
    } finally { game.dispose(); }
});

test('room isolation, shared events, cursors, authorization, reconnect, and host transfer', async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const controllers = [];
    async function post(path, body, token) {
        const response = await fetch(`${base}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify(body || {}) });
        return { status: response.status, data: await response.json() };
    }
    async function events(token) {
        const controller = new AbortController(); controllers.push(controller);
        const response = await fetch(`${base}/api/events?token=${token}`, { signal: controller.signal });
        const reader = response.body.getReader(); let buffer = ''; const queue = [];
        return { controller, async next(type) {
            const timeout = setTimeout(() => controller.abort(), 3000);
            try {
                while (true) {
                    const index = queue.findIndex(event => event.type === type);
                    if (index >= 0) return queue.splice(index, 1)[0].data;
                    const chunk = await reader.read();
                    if (chunk.done) throw new Error('Stream closed');
                    buffer += new TextDecoder().decode(chunk.value);
                    let split;
                    while ((split = buffer.indexOf('\n\n')) >= 0) {
                        const block = buffer.slice(0, split); buffer = buffer.slice(split + 2);
                        const match = block.match(/^event: (\w+)\ndata: (.+)$/);
                        if (match) queue.push({ type: match[1], data: JSON.parse(match[2]) });
                    }
                }
            } finally { clearTimeout(timeout); }
        } };
    }
    try {
        const alice = (await post('connect', { create: true, name: 'Alice', seconds: 30 })).data;
        const a = await events(alice.token); await a.next('state');
        const bob = (await post('connect', { name: 'Bob', code: alice.code })).data;
        const b = await events(bob.token); assert.equal((await b.next('state')).players.length, 2);
        const other = (await post('connect', { create: true, name: 'Other', seconds: 30 })).data;
        const c = await events(other.token); assert.equal((await c.next('state')).players.length, 1);
        assert.equal((await post('start', {}, bob.token)).status, 409);
        assert.equal((await post('action', { action: 'both' })).status, 401);
        await post('cursor', { x: 0.3, y: 0.7 }, alice.token);
        assert.deepEqual(await b.next('cursor'), { id: alice.id, x: 0.3, y: 0.7 });
        assert.equal((await post('start', {}, alice.token)).status, 200);
        let shared; do { shared = await b.next('state'); } while (!shared.game);
        assert.equal(shared.game.players[0].id, alice.id);
        assert.equal((await post('action', { action: 'both' }, bob.token)).status, 409);
        assert.equal((await post('connect', { name: 'Late', code: alice.code })).status, 409);
        const reconnected = await events(bob.token);
        assert.ok((await reconnected.next('state')).game);
        await post('leave', {}, alice.token);
        const lobby = await reconnected.next('state');
        assert.equal(lobby.host, bob.id); assert.equal(lobby.game, null);
    } finally { controllers.forEach(c => c.abort()); server.shutdown(); }
});
