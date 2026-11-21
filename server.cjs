const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Game } = require('./game.cjs');

function createServer() {
    let shuttingDown = false;
    const rooms = new Map(), sessions = new Map();
    const send = (p, event, data) => p.stream?.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const broadcast = (room, event, data) => room.players.forEach(p => send(p, event, data));
    const state = room => broadcast(room, 'state', {
        code: room.code, host: room.host, seconds: room.seconds, serverTime: Date.now(),
        players: room.players.map(p => ({ id: p.id, name: p.name, connected: Boolean(p.stream) })),
        game: room.game?.snapshot() ?? null
    });
    function remove(p) {
        clearTimeout(p.cleanup);
        p.stream?.end();
        sessions.delete(p.token);
        const room = p.room;
        room.game?.dispose(); room.game = null;
        room.players = room.players.filter(other => other !== p);
        broadcast(room, 'cursor', { id: p.id, hidden: true });
        if (!room.players.length) rooms.delete(room.code);
        else {
            if (room.host === p.id) room.host = room.players[0].id;
            state(room);
        }
    }
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
        if (url.pathname === '/api/events' && req.method === 'GET') {
            const p = sessions.get(url.searchParams.get('token'));
            if (!p) return json(401, { error: 'Room session expired. Join again.' });
            clearTimeout(p.cleanup);
            p.stream?.end();
            p.stream = res;
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
            res.write(': connected\n\n');
            state(p.room);
            req.on('close', () => {
                if (shuttingDown || p.stream !== res || !sessions.has(p.token)) return;
                p.stream = null;
                broadcast(p.room, 'cursor', { id: p.id, hidden: true });
                state(p.room);
                p.cleanup = setTimeout(() => remove(p), 15000);
            });
            return;
        }
        if (url.pathname.startsWith('/api/') && req.method === 'POST') {
            try {
                let raw = '';
                for await (const chunk of req) {
                    raw += chunk;
                    if (raw.length > 4096) return json(413, { error: 'Request too large.' });
                }
                const body = JSON.parse(raw || '{}');
                if (url.pathname === '/api/connect') {
                    const name = String(body.name || '').trim().slice(0, 32);
                    if (!name) return json(400, { error: 'Enter your name.' });
                    let room;
                    if (body.create) {
                        if (rooms.size >= 100) return json(429, { error: 'Server full. Try again later.' });
                        const seconds = Number(body.seconds);
                        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) return json(400, { error: 'Choose a whole number from 1 to 3600 seconds.' });
                        let code;
                        do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
                        room = { code, seconds, players: [], game: null };
                        rooms.set(code, room);
                    } else {
                        room = rooms.get(String(body.code || '').trim().toUpperCase());
                        if (!room) return json(404, { error: 'Room not found.' });
                        if (room.game) return json(409, { error: 'This game has already started.' });
                        if (room.players.length >= 8) return json(409, { error: 'Room is full (8 players maximum).' });
                    }
                    const p = { id: randomBytes(8).toString('hex'), token: randomBytes(24).toString('hex'), name, room };
                    room.players.push(p); room.host ??= p.id;
                    sessions.set(p.token, p);
                    p.cleanup = setTimeout(() => remove(p), 15000);
                    state(room);
                    return json(200, { token: p.token, id: p.id, code: room.code });
                }
                const p = sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
                if (!p) return json(401, { error: 'Room session expired. Join again.' });
                const room = p.room;
                if (url.pathname === '/api/leave') { remove(p); return json(200, {}); }
                if (url.pathname === '/api/cursor') {
                    const now = Date.now();
                    if (body.hidden || now - (p.lastCursor || 0) >= 40) {
                        p.lastCursor = now;
                        if (body.hidden) broadcast(room, 'cursor', { id: p.id, hidden: true });
                        else if (Number.isFinite(body.x) && Number.isFinite(body.y)) broadcast(room, 'cursor', { id: p.id, x: Math.max(0, Math.min(1, body.x)), y: Math.max(0, Math.min(1, body.y)) });
                    }
                    return json(200, {});
                }
                if (url.pathname === '/api/start') {
                    if (p.id !== room.host || room.players.length < 2 || room.players.some(p => !p.stream) || room.game) return json(409, { error: 'The host can start once at least two players are connected.' });
                    room.game = new Game(room.players, room.seconds, () => state(room)); state(room);
                } else if (url.pathname === '/api/next') {
                    if (p.id !== room.host || !room.game?.roundOver) return json(409, { error: 'Wait for the host to start the next round.' });
                    room.game.nextRound(); state(room);
                } else if (url.pathname === '/api/action') {
                    if (!room.game?.action(p.id, body.action)) return json(409, { error: 'Wait for your turn or the current roll to finish.' });
                } else return json(404, { error: 'Not found.' });
                return json(200, {});
            } catch { return json(400, { error: 'Invalid request.' }); }
        }
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (req.method !== 'GET' || !(/^(index\.html|styles\.css|player\.js|menu\.js|dice\.js|online\.js|images\/[a-zA-Z0-9_.-]+\.png)$/.test(file))) { res.writeHead(404); return res.end('Not found'); }
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        fs.readFile(path.join(__dirname, file), (error, data) => {
            res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)], 'X-Content-Type-Options': 'nosniff' });
            res.end(error ? 'Not found' : data);
        });
    });
    const heartbeat = setInterval(() => sessions.forEach(p => p.stream?.write(': heartbeat\n\n')), 10000);
    server.on('close', () => { clearInterval(heartbeat); rooms.forEach(r => r.game?.dispose()); sessions.forEach(p => clearTimeout(p.cleanup)); });
    server.shutdown = () => { shuttingDown = true; sessions.forEach(p => p.stream?.end()); server.close(); server.closeAllConnections(); };
    return server;
}
if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    createServer().listen(port, '0.0.0.0', () => console.log(`Twenty One running at http://localhost:${port}`));
}
module.exports = { createServer };
