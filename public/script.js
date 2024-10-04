const socket = io();
const sharedContent = document.getElementById('sharedContent');
const roomList = document.getElementById('roomList');
let currentRoom = '';
let isRoomCreator = false;  // Track if the user is the room creator

// Toggle navbar functionality
const toggleNavbarButton = document.getElementById('toggleNavbarButton');
const navbar = document.getElementById('navbar');
toggleNavbarButton.addEventListener('click', () => {
  navbar.classList.toggle('active');  // Slide the navbar in and out
});

// Display global online user count
const onlineUserCountElement = document.getElementById('onlineUserCount');
socket.on('user count', (count) => {
  onlineUserCountElement.textContent = count;
});

// Create a room when clicking the plus sign
const createRoomButton = document.getElementById('createRoomButton');
createRoomButton.addEventListener('click', () => {
  const roomName = prompt("Enter Room Name:");
  const roomPassword = prompt("Enter Room Password:");
  if (roomName && roomPassword) {
    socket.emit('create room', { roomName, password: roomPassword });
    isRoomCreator = true;  // Mark this user as the room creator
  }
});

// Join a room
const joinRoomButton = document.getElementById('joinRoomButton');
joinRoomButton.addEventListener('click', () => {
  const roomName = document.getElementById('joinRoomName').value;
  const roomPassword = document.getElementById('joinRoomPassword').value;
  if (roomName && roomPassword) {
    socket.emit('join room', { roomName, password: roomPassword });
    isRoomCreator = false;  // If the user is joining, they are not the creator
  }
});

// Display available rooms in the right navbar
socket.on('rooms available', (rooms) => {
  roomList.innerHTML = '';
  for (const roomName in rooms) {
    const li = document.createElement('li');
    li.textContent = roomName;
    li.onclick = () => {
      const roomPassword = prompt("Enter Room Password:");
      if (roomPassword) {
        socket.emit('join room', { roomName, password: roomPassword });
        isRoomCreator = false;  // If joining, the user is not the creator
      }
    };
    roomList.appendChild(li);
  }
});

// Handle room creation
socket.on('room created', (roomName) => {
  currentRoom = roomName;
  sharedContent.innerHTML = `<p>You have created and joined the room: ${roomName}</p>`;
});

// Handle room join and display room history
socket.on('room joined', (roomName) => {
  currentRoom = roomName;
  sharedContent.innerHTML = `<p>You have joined the room: ${roomName}</p>`;
});

// Load room history when joining
socket.on('room history', (history) => {
  history.forEach(item => {
    if (item.type === 'text') {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.innerHTML = `
        <strong>User ${item.senderId.substring(0, 5)}:</strong>
        <p>${item.text}</p>
      `;
      sharedContent.appendChild(messageElement);
    } else if (item.type === 'file') {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.innerHTML = `
        <strong>User ${item.senderId.substring(0, 5)}:</strong>
        <a href="${item.fileUrl}" class="file-link" download>${item.fileName}</a>
      `;

      // Add delete button if the user is the creator
      if (isRoomCreator) {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete File';
        deleteButton.onclick = () => {
          if (confirm(`Are you sure you want to delete this file: ${item.fileName}?`)) {
            socket.emit('delete file', currentRoom, item.fileUrl);
          }
        };
        messageElement.appendChild(deleteButton);
      }

      sharedContent.appendChild(messageElement);
    }
  });
});

// Handle text sharing
const shareTextButton = document.getElementById('shareTextButton');
shareTextButton.addEventListener('click', () => {
  const text = document.getElementById('textInput').value;
  if (text && currentRoom) {
    socket.emit('share text', { roomName: currentRoom, text });
    document.getElementById('textInput').value = '';
  }
});

// Display incoming text messages
socket.on('text shared', (data) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.innerHTML = `
    <strong>User ${data.senderId.substring(0, 5)}:</strong>
    <p>${data.text}</p>
  `;
  sharedContent.appendChild(messageElement);
  sharedContent.scrollTop = sharedContent.scrollHeight;  // Auto scroll
});

// Display incoming file messages
socket.on('file shared', (data) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.innerHTML = `
    <strong>User ${data.senderId.substring(0, 5)}:</strong>
    <a href="${data.fileUrl}" class="file-link" download>${data.fileName}</a>
  `;

  // Add delete button if the user is the creator
  if (isRoomCreator) {
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete File';
    deleteButton.onclick = () => {
      if (confirm(`Are you sure you want to delete this file: ${data.fileName}?`)) {
        socket.emit('delete file', currentRoom, data.fileUrl);
      }
    };
    messageElement.appendChild(deleteButton);
  }

  sharedContent.appendChild(messageElement);
  sharedContent.scrollTop = sharedContent.scrollHeight;  // Auto scroll
});

// Handle file deletion
socket.on('file deleted', (fileUrl) => {
  // Remove the deleted file from the UI
  const fileElements = document.querySelectorAll(`a[href="${fileUrl}"]`);
  fileElements.forEach(element => {
    element.parentElement.remove();  // Remove the message element containing the file
  });
});

// Handle room errors
socket.on('room error', (message) => {
  alert(message);  // Display error message to the user
});
