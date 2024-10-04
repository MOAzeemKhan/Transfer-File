const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');  // To delete files

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store room data (room name, password, users, history, and files)
const rooms = {};
let onlineUsers = 0;  // Track global online user count

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
  const roomName = req.body.roomName;

  // Store the file and message in room history
  if (rooms[roomName]) {
    rooms[roomName].history.push({
      type: 'file',
      senderId: req.body.senderId,
      fileName,
      fileUrl,
      filePath: path.join(__dirname, `uploads/${req.file.filename}`)
    });
    io.to(roomName).emit('file shared', {
      senderId: req.body.senderId,
      fileName,
      fileUrl
    });
  }

  res.json({ fileUrl });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle socket connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  onlineUsers++;  // Increment global online user count

  // Send the updated online user count to all clients
  io.emit('user count', onlineUsers);

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

    // Create the room with the password, track users, and store history
    rooms[roomName] = { password, users: [socket.id], creator: socket.id, history: [] };
    socket.join(roomName);
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

    // Join the room and send room history to the user
    socket.join(roomName);
    rooms[roomName].users.push(socket.id);
    socket.emit('room joined', roomName);

    // Send the room's history to the user who joined
    socket.emit('room history', rooms[roomName].history);
  });

  // Handle text sharing in the room and add to history
  socket.on('share text', (data) => {
    const { roomName, text } = data;

    // Save the text message to the room's history
    rooms[roomName].history.push({
      type: 'text',
      senderId: socket.id,
      text
    });

    // Broadcast the message to all users in the room
    io.to(roomName).emit('text shared', {
      senderId: socket.id,
      text
    });
  });

  // Handle file deletion by the room creator
  socket.on('delete file', (roomName, fileUrl) => {
    if (rooms[roomName] && rooms[roomName].creator === socket.id) {
      // Find and remove the file from history
      const fileIndex = rooms[roomName].history.findIndex(item => item.type === 'file' && item.fileUrl === fileUrl);

      if (fileIndex !== -1) {
        const filePath = rooms[roomName].history[fileIndex].filePath;

        // Delete the file from the file system
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file: ${filePath}`, err);
            return;
          }

          // Remove the file from the room history
          rooms[roomName].history.splice(fileIndex, 1);

          // Notify all users in the room that the file has been deleted
          io.to(roomName).emit('file deleted', fileUrl);
        });
      }
    } else {
      socket.emit('room error', 'Only the room creator can delete files.');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    onlineUsers--;  // Decrement global online user count

    // Send the updated online user count to all clients
    io.emit('user count', onlineUsers);

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
