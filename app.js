const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

// Handle file uploads and broadcast file link
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;
  const senderId = req.body.senderId;  // Get the sender's ID

  io.emit('file shared', {
    senderId,
    fileName,
    fileUrl,
  });

  res.json({ fileUrl });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle text sharing
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Broadcast text message to all users
  socket.on('share text', (text) => {
    io.emit('text shared', {
      senderId: socket.id,
      text,
    });
  });

  // When a user disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
