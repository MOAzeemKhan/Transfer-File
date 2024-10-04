const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set the storage engine for file uploads
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));

// Handle file upload via POST request
app.post('/upload', upload.single('file'), (req, res) => {
  const filePath = `/uploads/${req.file.filename}`;
  io.emit('file shared', {
    fileName: req.file.originalname,
    fileUrl: filePath,
  });
  res.json({ fileUrl: filePath });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle copied text sharing
io.on('connection', (socket) => {
  console.log('A user connected');

  // Broadcast shared text to all connected clients
  socket.on('share text', (text) => {
    io.emit('text shared', text);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
