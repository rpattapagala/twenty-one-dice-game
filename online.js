const $ = id => document.getElementById(id);
const message = text => { $('online-message').textContent = text; };
let session, stream, room, connected = false, pending = false, offset = 0;
const cursors = new Map();
const palette = ['#ffad66', '#75d5ff', '#ed9fff', '#ffe680', '#4ecca3', '#ff8fa3', '#bbc1ff', '#a5e681'];
const code = new URL(location.href).searchParams.get('room');
if (code) $('room-code').value = code;

async function api(path, body = {}) {
    let response;
    try {
        response = await fetch(`/api/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
            body: JSON.stringify(body)
        });
    } catch { throw new Error('Cannot reach the game server. Run npm start and open http://localhost:3000.'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Online play needs the Node server. Run npm start and open http://localhost:3000.'); }
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
}

function clearCursors() { cursors.forEach(el => el.remove()); cursors.clear(); }
function render() {
    if (!room) return;
    const game = room.game;
    $('room-label').textContent = `Room ${room.code} · ${room.seconds}s per turn`;
    $('room-players').textContent = room.players.map(p => `${p.name}${p.id === session.id ? ' (you)' : ''}${p.id === room.host ? ' · host' : ''}${p.connected ? '' : ' · reconnecting'}`).join(' / ');
    $('online-start').hidden = Boolean(game);
    $('online-start').disabled = !connected || session.id !== room.host || room.players.length < 2 || room.players.some(p => !p.connected);
    document.querySelector('.board').hidden = !game;
    $('next-round').hidden = !game?.roundOver;
    $('next-round').disabled = !connected || pending || session.id !== room.host;
    const canPlay = connected && !pending && game && !game.roundOver && !game.rolling.length && game.players[game.current].id === session.id;
    ['button1', 'button2', 'button3', 'button4'].forEach(id => {
        $(id).disabled = !canPlay || (id !== 'button2' && !game.rolls);
    });
    for (const [id, cursor] of cursors) {
        if (!room.players.some(p => p.id === id && p.connected)) { cursor.remove(); cursors.delete(id); }
    }
    if (!game) { message(connected ? 'Share the invite link. The host can start with 2–8 connected players.' : 'Reconnecting…'); return; }
    const current = game.players[game.current];
    const score = game.rolls || game.roundOver ? current.score : null;
    $('roll-score').textContent = score === 21 ? 'Twenty One!' : score ?? '—';
    document.querySelectorAll('.dice img').forEach((img, i) => {
        img.src = `./images/dice${game.dice[i]}.png`;
        img.alt = `Die ${i + 1}: ${game.dice[i]}`;
        img.classList.toggle('is-rolling', game.rolling.includes(i));
    });
    $('status-board').replaceChildren();
    if (game.message) {
        const el = document.createElement('div'); el.className = 'status-message'; el.textContent = game.message; $('status-board').append(el);
    }
    game.players.forEach((p, i) => {
        const badge = document.createElement('div');
        badge.className = `player-badge${!game.roundOver && i === game.current ? ' is-active' : ''}`;
        const name = document.createElement('div'); name.className = 'player-badge__name'; name.textContent = p.name;
        const stats = document.createElement('div'); stats.className = 'player-badge__stats';
        [`${p.wins} Wins`, `${i === game.current && !game.roundOver ? `${game.rolls}/${game.limit}` : p.turns} Rolls`, `${p.score} Score`].forEach(text => {
            const chip = document.createElement('span'); chip.className = 'player-chip'; chip.textContent = text; stats.append(chip);
        });
        badge.append(name, stats); $('status-board').append(badge);
    });
    message(!connected ? 'Reconnecting… Controls will return when connected.' : game.roundOver ? 'The host can start the next round.' : current.id === session.id ? (game.rolls ? 'Your turn.' : 'Your turn. Roll both dice first.') : `${current.name} is playing.`);
}

function attach() {
    document.body.dataset.online = 'true';
    $('local-panel').hidden = true;
    $('online-setup').hidden = true; $('online-room').hidden = false;
    stream = new EventSource(`/api/events?token=${encodeURIComponent(session.token)}`);
    stream.addEventListener('state', event => {
        connected = true; room = JSON.parse(event.data); offset = room.serverTime - Date.now(); render();
    });
    stream.addEventListener('cursor', event => {
        const data = JSON.parse(event.data);
        if (data.id === session.id) return;
        const player = room?.players.find(p => p.id === data.id);
        if (!player) return;
        if (data.hidden) { cursors.get(data.id)?.remove(); cursors.delete(data.id); return; }
        let cursor = cursors.get(data.id);
        if (!cursor) {
            cursor = document.createElement('div'); cursor.className = 'live-cursor'; cursor.setAttribute('aria-hidden', 'true');
            cursor.style.color = palette[room.players.indexOf(player) % palette.length];
            const arrow = document.createElement('span'); arrow.textContent = '➤'; arrow.className = 'cursor-arrow';
            const label = document.createElement('span'); label.textContent = player.name;
            cursor.append(arrow, label); document.querySelector('.container').append(cursor); cursors.set(data.id, cursor);
        }
        cursor.style.left = `${data.x * 100}%`; cursor.style.top = `${data.y * 100}%`;
    });
    stream.onerror = async () => {
        connected = false; clearCursors(); render();
        // Check whether this session still exists while EventSource retries.
        try { await api('cursor', { hidden: true }); }
        catch (error) { if (error.message.includes('expired')) { reset(); message(error.message); } }
    };
}

function reset() {
    stream?.close(); stream = null; session = null; room = null; connected = false; pending = false;
    sessionStorage.removeItem('twenty-one-session'); clearCursors();
    delete document.body.dataset.online;
    $('online-setup').hidden = false; $('online-room').hidden = true;
    $('local-panel').hidden = false;
    document.querySelector('.board').hidden = true; $('next-round').hidden = true;
    message('');
}

async function connect(create) {
    if (pending) return;
    const select = $('turn-limit'); const custom = $('custom-turn-limit');
    if (create && select.value === 'custom' && !custom.reportValidity()) return;
    pending = true; $('create-room').disabled = $('join-room').disabled = true;
    try {
        session = await api('connect', { create, name: $('online-name').value, code: $('room-code').value,
            seconds: Number(select.value === 'custom' ? custom.value : select.value) });
        sessionStorage.setItem('twenty-one-session', JSON.stringify(session)); attach();
    } catch (error) { message(error.message); }
    finally { pending = false; $('create-room').disabled = $('join-room').disabled = false; }
}
$('create-room').onclick = () => connect(true);
$('join-room').onclick = () => connect(false);
$('leave-room').onclick = async () => {
    try { await api('leave'); reset(); }
    catch (error) { message(error.message); }
};
$('copy-invite').onclick = async () => {
    const url = new URL(location.href); url.searchParams.set('room', session.code);
    try { await navigator.clipboard.writeText(url.href); message('Invite link copied!'); }
    catch { message(`Invite link: ${url.href}`); }
};
async function command(path, body) {
    if (!connected || pending) return;
    pending = true; render();
    try { await api(path, body); }
    catch (error) { message(error.message); }
    finally { pending = false; render(); }
}
$('online-start').onclick = () => command('start');
for (const [id, action] of Object.entries({ button1: 'left', button2: 'both', button3: 'right', button4: 'end' })) {
    $(id).addEventListener('click', () => { if (session) command('action', { action }); });
}
$('next-round').addEventListener('click', () => { if (session) command('next'); });
setInterval(() => {
    if (!room?.game) return;
    const remaining = Math.max(0, room.game.deadline - Date.now() - offset);
    $('turn-timer').textContent = room.game.roundOver ? 'Round complete' : `${(remaining / 1000).toFixed(1)}s remaining`;
    $('turn-timer').classList.toggle('is-urgent', !room.game.roundOver && remaining <= 1000);
}, 100);
let lastCursor = 0;
const surface = document.querySelector('.container');
surface.addEventListener('pointermove', event => {
    if (!session || !connected || Date.now() - lastCursor < 65) return;
    lastCursor = Date.now();
    const rect = surface.getBoundingClientRect();
    api('cursor', { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }).catch(() => {});
});
function hideCursor() { if (session && connected) api('cursor', { hidden: true }).catch(() => {}); }
surface.addEventListener('pointerleave', hideCursor);
window.addEventListener('blur', hideCursor);
document.addEventListener('visibilitychange', () => { if (document.hidden) hideCursor(); });
try {
    session = JSON.parse(sessionStorage.getItem('twenty-one-session'));
    if (session?.token && session?.id) attach(); else session = null;
} catch { session = null; }
