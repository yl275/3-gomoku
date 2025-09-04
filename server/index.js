// server/index.js
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { customAlphabet } = require("nanoid");
const path = require('path');
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const app = express();

// CORS配置 - 允许前端域名
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", 
  "https://your-frontend-app.onrender.com", // 替换为你的前端Render域名
  process.env.FRONTEND_URL // 环境变量中的前端URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（比如移动端应用）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json());

// 健康检查端点 - Render需要这个
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 根路径响应
app.get("/", (req, res) => {
  res.json({ 
    message: "Gomoku Game Server is running!",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      createRoom: "/api/create-room"
    }
  });
});

app.use(express.static(path.join(__dirname, 'client/build')));

app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const server = createServer(app);
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 4000;

// 内存中的房间数据：不持久化，服务重启就清空
// 结构： rooms[roomId] = { players: { black: socketId|null, white: socketId|null, third: socketId|null }, board, turn, settings }
const rooms = new Map();

function createEmptyBoard(size = 15) {
  return Array.from({ length: size }, () => Array(size).fill(0)); // 0空，1黑，2白，3第三玩家
}

function getOppositeTurn(turn, playerCount = 2) {
  if (playerCount === 2) {
    return turn === 1 ? 2 : 1;
  } else {
    return turn === 1 ? 2 : turn === 2 ? 3 : 1;
  }
}

function inBounds(x, y, size = 15) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

// 简单五连检测：从落子点向4个方向数连续同色
function checkWin(board, x, y, winCondition = 5) {
  const target = board[y][x];
  if (target === 0) return false;

  const dirs = [
    [1, 0],  // 横
    [0, 1],  // 竖
    [1, 1],  // 斜 \
    [1, -1], // 斜 /
  ];

  for (const [dx, dy] of dirs) {
    let count = 1;

    // 正向
    let nx = x + dx, ny = y + dy;
    while (inBounds(nx, ny, board.length) && board[ny][nx] === target) {
      count++; nx += dx; ny += dy;
    }
    // 反向
    nx = x - dx; ny = y - dy;
    while (inBounds(nx, ny, board.length) && board[ny][nx] === target) {
      count++; nx -= dx; ny -= dy;
    }
    if (count >= winCondition) return true;
  }
  return false;
}

// 检查是否平局：棋盘是否已满
function checkDraw(board) {
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] === 0) {
        return false; // 还有空位，不是平局
      }
    }
  }
  return true; // 棋盘已满，平局
}

// 创建房间：返回 roomId
app.post("/api/create-room", (req, res) => {
  let roomId = nanoid();
  while (rooms.has(roomId)) roomId = nanoid();

  // 获取游戏设置，使用默认值
  const { playerCount = 2, winCondition = 5, boardSize = 15 } = req.body;

  rooms.set(roomId, {
    players: { 
      black: null, 
      white: null, 
      third: playerCount === 3 ? null : undefined 
    },
    board: createEmptyBoard(boardSize),
    turn: 1, // 1黑先手，2白，3第三玩家
    settings: {
      playerCount,
      winCondition,
      boardSize
    }
  });

  res.json({ roomId });
});

// Socket 逻辑
io.on("connection", (socket) => {
  console.log('New client connected:', socket.id);

  // 加入房间
  socket.on("join_room", ({ roomId }) => {
    console.log('Client', socket.id, 'joining room:', roomId);
    if (!roomId) return;

    // 如果房间不存在（比如别人直接访问链接），自动创建
    if (!rooms.has(roomId)) {
      console.log('Creating new room:', roomId);
      rooms.set(roomId, {
        players: { black: null, white: null },
        board: createEmptyBoard(15),
        turn: 1,
        settings: {
          playerCount: 2,
          winCondition: 5,
          boardSize: 15
        }
      });
    }

    const room = rooms.get(roomId);
    const { playerCount } = room.settings;

    // 分配阵营：先来黑，后到白，第三个是第三玩家或观战
    let side = "spectator";
    if (!room.players.black) {
      room.players.black = socket.id;
      side = "black";
      console.log('Client', socket.id, 'assigned as black');
    } else if (!room.players.white) {
      room.players.white = socket.id;
      side = "white";
      console.log('Client', socket.id, 'assigned as white');
    } else if (playerCount === 3 && !room.players.third) {
      room.players.third = socket.id;
      side = "green";
      console.log('Client', socket.id, 'assigned as green player');
    } else {
      console.log('Client', socket.id, 'assigned as spectator');
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.side = side;

    // 通知本人加入结果
    socket.emit("joined", {
      roomId,
      side,
      turn: room.turn,
      board: room.board,
      settings: room.settings
    });

    // 通知房间内所有人当前状态
    io.to(roomId).emit("room_state", {
      players: {
        black: !!room.players.black,
        white: !!room.players.white,
        third: playerCount === 3 ? !!room.players.third : undefined
      },
      turn: room.turn,
      settings: room.settings
    });

    console.log('Room', roomId, 'players:', room.players);
    console.log('Current turn:', room.turn);
    console.log('Settings:', room.settings);
  });

  // 获取房间状态
  socket.on("get_room_state", ({ roomId }) => {
    console.log('Client', socket.id, 'requesting room state for:', roomId);
    const room = rooms.get(roomId);
    if (!room) return;

    socket.emit("room_state", {
      players: {
        black: !!room.players.black,
        white: !!room.players.white,
      },
      turn: room.turn,
    });
  });

  // 下子
  socket.on("place_piece", ({ roomId, x, y }) => {
    console.log('Client', socket.id, 'placing piece at', x, y, 'in room', roomId);
    const room = rooms.get(roomId);
    if (!room) return;

    // 只有落到棋手才允许下子
    const side = socket.data.side;
    if (side !== "black" && side !== "white" && side !== "green") {
      console.log('Client', socket.id, 'is spectator, cannot place piece');
      return;
    }

    const playerNum = side === "black" ? 1 : side === "white" ? 2 : 3;

    // 轮到谁
    if (room.turn !== playerNum) {
      console.log('Not client', socket.id, 'turn. Current turn:', room.turn, 'Client player:', playerNum);
      return;
    }

    // 合法性
    if (!inBounds(x, y, room.settings.boardSize)) return;
    if (room.board[y][x] !== 0) return;

    console.log('Valid move by', socket.id, 'placing', side, 'at', x, y);

    // 落子
    room.board[y][x] = playerNum;

    // 是否胜利
    if (checkWin(room.board, x, y, room.settings.winCondition)) {
      console.log('Game over!', side, 'wins!');
      io.to(roomId).emit("piece_placed", { x, y, player: side });
      io.to(roomId).emit("game_over", { winner: side });
      return;
    }

    // 检查是否平局
    if (checkDraw(room.board)) {
      console.log('Game over! It\'s a draw!');
      io.to(roomId).emit("piece_placed", { x, y, player: side });
      io.to(roomId).emit("game_over", { winner: null, draw: true });
      return;
    }

    // 切换回合
    room.turn = getOppositeTurn(room.turn, room.settings.playerCount);

    // 广播落子 & 当前轮次
    io.to(roomId).emit("piece_placed", { x, y, player: side });
    io.to(roomId).emit("turn_changed", {
      turn: room.turn === 1 ? "black" : room.turn === 2 ? "white" : "green",
    });
    
    // 同时发送房间状态更新
    io.to(roomId).emit("room_state", {
      players: {
        black: !!room.players.black,
        white: !!room.players.white,
        third: room.settings.playerCount === 3 ? !!room.players.third : undefined
      },
      turn: room.turn,
      settings: room.settings
    });

    console.log('Turn changed to:', room.turn === 1 ? 'black' : room.turn === 2 ? 'white' : 'green');
    console.log('Room state sent to all players');
  });

  // 重开一局
  socket.on("reset_game", ({ roomId }) => {
    console.log('Client', socket.id, 'resetting game for room:', roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    room.board = createEmptyBoard(room.settings.boardSize);
    room.turn = 1;
    io.to(roomId).emit("reset_done", { board: room.board, turn: "black" });
    
    // 同时发送房间状态更新
    io.to(roomId).emit("room_state", {
      players: {
        black: !!room.players.black,
        white: !!room.players.white,
        third: room.settings.playerCount === 3 ? !!room.players.third : undefined
      },
      turn: room.turn,
      settings: room.settings
    });
    
    console.log('Game reset, turn set to black (1)');
  });

  // 断开
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.players.black === socket.id) room.players.black = null;
    if (room.players.white === socket.id) room.players.white = null;
    if (room.players.third === socket.id) room.players.third = null;

    io.to(roomId).emit("room_state", {
      players: {
        black: !!room.players.black,
        white: !!room.players.white,
        third: room.settings.playerCount === 3 ? !!room.players.third : undefined
      },
      turn: room.turn,
      settings: room.settings
    });

    // 如果房间空无一人，清理
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      rooms.delete(roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
