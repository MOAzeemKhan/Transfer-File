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

  // Display the "End Room" button for the creator
  if (isRoomCreator) {
    const endRoomButton = document.createElement('button');
    endRoomButton.textContent = 'End Room';
    endRoomButton.id = 'endRoomButton';
    endRoomButton.onclick = () => {
      if (confirm(`Are you sure you want to end the room ${roomName}?`)) {
        socket.emit('end room', roomName);
      }
    };
    sharedContent.appendChild(endRoomButton);
  }
});

// Handle room join
socket.on('room joined', (roomName) => {
  currentRoom = roomName;
  sharedContent.innerHTML = `<p>You have joined the room: ${roomName}</p>`;
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

// Handle file upload
const fileForm = document.getElementById('fileForm');
fileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const file = document.getElementById('fileInput').files[0];
  if (file && currentRoom) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('senderId', socket.id);
    formData.append('roomName', currentRoom);

    fetch('/upload', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      document.getElementById('fileInput').value = '';  // Clear file input
    });
  }
});

// Display incoming file messages
socket.on('file shared', (data) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.innerHTML = `
    <strong>User ${data.senderId.substring(0, 5)}:</strong>
    <a href="${data.fileUrl}" class="file-link" download>${data.fileName}</a>
  `;
  sharedContent.appendChild(messageElement);
  sharedContent.scrollTop = sharedContent.scrollHeight;  // Auto scroll
});

// Handle room end event
socket.on('room ended', (roomName) => {
  alert(`Room "${roomName}" has been ended by the creator.`);
  sharedContent.innerHTML = '';  // Clear the room's content
  currentRoom = '';  // Clear the current room
  isRoomCreator = false;  // Reset creator status
});

// Handle room errors
socket.on('room error', (message) => {
  alert(message);  // Display error message to the user
});
