const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store room data (room name, password, and users)
const rooms = {};

// Set up multer storage engine for file uploads
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));

// Handle file uploads and broadcast file link within the room
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;
  const roomName = req.body.roomName;  // Room name is passed along with the form

  io.to(roomName).emit('file shared', {
    senderId: req.body.senderId,
    fileName,
    fileUrl,
  });

  res.json({ fileUrl });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle socket connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send available rooms to the client
  socket.emit('rooms available', rooms);

  // Create or join a room
  socket.on('create room', (data) => {
    const { roomName, password } = data;

    // Check if the room already exists
    if (rooms[roomName]) {
      socket.emit('room error', 'Room already exists. Try another name.');
      return;
    }

    // Create the room with the password
    rooms[roomName] = { password, users: [] };
    socket.join(roomName);
    rooms[roomName].users.push(socket.id);
    io.emit('rooms available', rooms);  // Update all clients about the new room
    socket.emit('room created', roomName);  // Notify the client they created the room
  });

  // Join an existing room
  socket.on('join room', (data) => {
    const { roomName, password } = data;

    // Check if the room exists
    if (!rooms[roomName]) {
      socket.emit('room error', 'Room does not exist.');
      return;
    }

    // Check the password
    if (rooms[roomName].password !== password) {
      socket.emit('room error', 'Incorrect password.');
      return;
    }

    // Join the room
    socket.join(roomName);
    rooms[roomName].users.push(socket.id);
    socket.emit('room joined', roomName);  // Notify the client they joined the room
  });

  // Handle text sharing in the room
  socket.on('share text', (data) => {
    const { roomName, text } = data;
    io.to(roomName).emit('text shared', {
      senderId: socket.id,
      text,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove the user from rooms
    for (const roomName in rooms) {
      const room = rooms[roomName];
      room.users = room.users.filter(userId => userId !== socket.id);

      // If the room is empty, delete the room
      if (room.users.length === 0) {
        delete rooms[roomName];
        io.emit('rooms available', rooms);  // Update all clients about available rooms
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
