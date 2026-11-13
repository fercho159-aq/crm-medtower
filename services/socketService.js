let io = null;

const init = (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
        cors: {
            origin: ['https://medtower.com.mx', 'https://crmmedtower.mawsoluciones.com', 'http://localhost:3000', 'http://localhost:8443'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Cliente conectado: ${socket.id}`);
        
        socket.on('join_lead_chat', (leadId) => {
            socket.join(`lead_${leadId}`);
            console.log(`[Socket] Cliente se unió a la sala: lead_${leadId}`);
        });

        socket.on('leave_lead_chat', (leadId) => {
            socket.leave(`lead_${leadId}`);
            console.log(`[Socket] Cliente salió de la sala: lead_${leadId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => io;

const emitToAll = (event, data) => {
    if (io) io.emit(event, data);
};

const emitToRoom = (room, event, data) => {
    if (io) io.to(room).emit(event, data);
};

module.exports = {
    init,
    getIo,
    emitToAll,
    emitToRoom
};
