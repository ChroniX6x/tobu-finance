import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { BSON } from 'mongodb';

/** Test-only plain Mongo wire proxy: lose an ACTUALLY successful commit reply, not the request. */
export async function mongoReplyProxy(target) {
    const host = target.hostname,
        port = Number(target.port);
    const sockets = new Set();
    let armed = false,
        dropped = 0;
    const server = createServer((downstream) => {
        const upstream = connect(port, host);
        sockets.add(downstream);
        sockets.add(upstream);
        for (const socket of [downstream, upstream]) {
            socket.on('error', () => {
                downstream.destroy();
                upstream.destroy();
            });
            socket.on('close', () => {
                sockets.delete(socket);
                downstream.destroy();
                upstream.destroy();
            });
        }
        const commits = new Set();
        const frame = (source, sink, outgoing) => {
            let buffer = Buffer.alloc(0);
            source.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                while (buffer.length >= 4 && buffer.length >= buffer.readInt32LE(0)) {
                    const size = buffer.readInt32LE(0);
                    if (size < 16 || size > 48 * 1024 * 1024) throw new Error('Invalid test wire frame');
                    const message = buffer.subarray(0, size);
                    buffer = buffer.subarray(size);
                    const opcode = message.readInt32LE(12);
                    let body;
                    if (opcode === 2013 && message[20] === 0) body = BSON.deserialize(message.subarray(21, 21 + message.readInt32LE(21)));
                    if (outgoing && body?.commitTransaction) commits.add(message.readInt32LE(4));
                    if (!outgoing && armed && commits.has(message.readInt32LE(8)) && body?.ok === 1 && !body.writeConcernError) {
                        armed = false;
                        dropped++;
                        downstream.destroy();
                        upstream.destroy();
                        return;
                    }
                    sink.write(message);
                }
            });
        };
        frame(downstream, upstream, true);
        frame(upstream, downstream, false);
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    return {
        port: server.address().port,
        arm: () => {
            armed = true;
        },
        dropped: () => dropped,
        close: async () => {
            for (const socket of sockets) socket.destroy();
            await new Promise((done) => server.close(done));
        }
    };
}
