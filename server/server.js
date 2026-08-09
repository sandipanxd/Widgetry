const express = require('express');
const cors = require('cors');
const path = require('path');
const widgetRoutes = require('./routes/widgets');
const authRoutes = require('./routes/auth');
const { handleGraphQL } = require('./graphql');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// Load API routes
app.use('/api/widgets', widgetRoutes);
app.use('/api/auth', authRoutes);
app.post('/graphql', handleGraphQL);

// Serve Static Assets in Production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Fallback to React index.html for unknown web paths (useful for direct deep linking in built state)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next(); // Don't serve HTML on API calls
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      // If client build isn't created yet or static serving fails, send a default message
      res
        .status(200)
        .send('API Server is running. Frontend build not detected.');
    }
  });
});

const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Expose io on app object for other routers (e.g. webhooks)
app.set('io', io);

// Socket.io Real-time Collaboration Logic
io.on('connection', (socket) => {
  // Join a widget room
  socket.on('join-widget', (widgetId) => {
    socket.join(widgetId);
  });

  // Broadcast layout/config changes to other collaborators in room
  socket.on('edit-config', ({ widgetId, name, config }) => {
    socket.to(widgetId).emit('config-updated', { name, config });
  });

  // Broadcast whiteboard events
  socket.on('draw-line', ({ widgetId, from, to, color, size }) => {
    socket.to(widgetId).emit('line-drawn', { from, to, color, size });
  });

  socket.on('clear-whiteboard', ({ widgetId }) => {
    socket.to(widgetId).emit('whiteboard-cleared');
  });
});

server.listen(PORT, () => {
  console.log(`Widgetry Backend listening on http://localhost:${PORT}`);
});
