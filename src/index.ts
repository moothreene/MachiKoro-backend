import express, { Express, Request, Response } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { UserModel } from './models/User';

const app: Express = express();
const port = process.env.PORT || 3000;
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: (process.env.CORS_ORIGIN || 'http://localhost:3000') },
  connectionStateRecovery: {},
});

function getRandomId() {
  return Math.random().toString(36).substring(7);
}

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server ');
});

io.on('connection', async (socket) => {
  console.log('a user connected', socket.id);
  socket.on('chat message', async (msg) => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      io.to(userDoc.roomId).emit('chat message', msg);
    }
  });

  socket.on('host', async () => {
    const id = getRandomId();
    socket.join(id);
    try {
      await UserModel.create({ socketId: socket.id, roomId: id });
    } catch (err) {
      console.log(err);
    }
    socket.emit('hosted', id);
  });

  socket.on('join', async (id: string) => {
    const UserDoc = await UserModel.findOne({ roomId: id });
    console.log(UserDoc);
    if (!UserDoc) return socket.emit('invalidRoom');
    socket.join(id);
    try {
      await UserModel.create({ socketId: socket.id, roomId: id });
    } catch (err) {
      console.log(err);
    }
    socket.emit('joined', id);
    try {
      const userCount = await UserModel.countDocuments({ roomId: id });
      if (userCount === 2) {
        io.to(id).emit('startGame');
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('roll', async (msg) => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      io.to(userDoc.roomId).emit('roll', msg);
    }
  });

  socket.on('confirmRoll', async () => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      io.to(userDoc.roomId).emit('confirmRoll');
    }
  });

  socket.on('buy', async (msg) => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      io.to(userDoc.roomId).emit('buy', msg);
    }
  });

  socket.on('nextTurn', async () => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      io.to(userDoc.roomId).emit('nextTurn');
    }
  });

  socket.on('disconnect', async () => {
    const roomMap = io.sockets.adapter.rooms;
    const arr = Array.from(roomMap.keys());
    await UserModel.deleteMany({ roomId: { $nin: arr } });
    console.log('a user disconnected');
  });
});

mongoose.connect(process.env.DATABASE_URL as string).then(() => {
  server.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
});
