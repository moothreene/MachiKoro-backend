import express, { Express, Request, Response } from 'express';
import { createServer, get } from 'node:http';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { UserModel } from './models/User';
import { GameModel } from './models/Games';

dotenv.config();
const app: Express = express();
const port = process.env.PORT || 3000;
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN },
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

  socket.on('host', async (gameData) => {
    const id = getRandomId();
    socket.join(id);
    try {
      await UserModel.create({ socketId: socket.id, roomId: id });
    } catch (err) {
      io.to(socket.id).emit('host_error', err);
    }
    try {
      await GameModel.create({ roomId: id, gameData, playerOne: socket.id });
    } catch (err) {
      console.log(err);
    }
    io.to(socket.id).emit('hosted', id);
  });

  socket.on('join', async (roomId: string) => {
    const userCount = await UserModel.countDocuments({ roomId: roomId });
    if (userCount === 0) {
      return io.to(socket.id).emit('invalidRoom');
    } else if (userCount > 1) {
      return io.to(socket.id).emit('roomFull');
    }

    socket.join(roomId);
    try {
      await UserModel.create({ socketId: socket.id, roomId: roomId });
    } catch (err) {
      console.log(err);
    }
    const gameDoc = await GameModel.findOne({ roomId: roomId });
    const gameData = gameDoc?.gameData;
    const player = gameDoc?.playerOne ? 2 : 1;
    if (player === 2) {
      await GameModel.updateOne({ roomId: roomId }, { playerTwo: socket.id });
    } else {
      await GameModel.updateOne({ roomId: roomId }, { playerOne: socket.id });
    }
    io.to(socket.id).emit('joined', { roomId, gameData, player });
    io.to(roomId).emit('startGame');
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

  socket.on('updateGame', async (gameState) => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    try {
      await GameModel.updateOne(
        { roomId: userDoc?.roomId },
        { gameData: gameState }
      );
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('nextTurn', async (amount) => {
    const userDoc = await UserModel.findOne({ socketId: socket.id });
    if (userDoc) {
      try {
        GameModel.updateOne(
          { roomId: userDoc?.roomId },
          { $inc: { currentMove: amount }, $set: { stage: 0 } }
        );
      } catch (err) {
        console.log(err);
      }
      io.to(userDoc.roomId).emit('nextTurn', amount);
    }
  });

  socket.on('disconnect', async () => {
    await UserModel.deleteOne({ socketId: socket.id });
    await GameModel.updateOne({ playerOne: socket.id }, { playerOne: '' });
    await GameModel.updateOne({ playerTwo: socket.id }, { playerTwo: '' });
    const roomMap = io.sockets.adapter.rooms;
    const arr = Array.from(roomMap.keys());
    await GameModel.deleteMany({ roomId: { $nin: arr } });
    console.log('a user disconnected');
  });
});

mongoose.connect(process.env.DATABASE_URL as string).then(() => {
  server.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
});
