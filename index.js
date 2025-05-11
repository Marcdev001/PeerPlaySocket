const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://peerplay.space"
];

const io = new Server(httpServer, {
  cors: {
    origin: function(origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

// Add users store
const roomUsers = new Map();

io.on("connect", (socket) => {
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`user with id-${socket.id} joined room - ${roomId}`);
    
    // Track user joining
    const username = socket.handshake.query.username;
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    roomUsers.get(roomId).set(socket.id, username);
    
    // Broadcast updated users list
    io.to(roomId).emit("users_update", {
      users: Array.from(roomUsers.get(roomId)).map(([id, name]) => ({
        id,
        username: name
      }))
    });
  });

  socket.on("create_play", (data) => {
    console.log(data)
  })

  socket.on("send_msg", (data) => {
    console.log(data, "DATA", socket.id);
  
    socket.broadcast.to(data.roomId).emit("receive_msg", data);
  });

  socket.on("chat", (data) => {
    console.log(data, "Chat", socket.id);
  
    socket.to(data.roomId).emit("chat", data);
  });

  socket.on("seek", (data) => {
    console.log(data, "Seek Data");

    socket.broadcast.to(data.roomId).emit("seek", { seekTime: data.seekTime });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    
    // Remove user from tracking and broadcast update
    for (const [roomId, users] of roomUsers.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        io.to(roomId).emit("users_update", {
          users: Array.from(users).map(([id, name]) => ({
            id,
            username: name
          }))
        });
        break;
      }
    }
  });

  console.log("socket connect", socket.id);
  socket.broadcast.emit("welcome", `Welcome ${socket.id}`);

});

httpServer.listen(PORT, () => {
  console.log(`Socket.io server is running on port ${PORT}`);
});
