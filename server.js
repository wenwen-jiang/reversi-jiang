/*********************************************/
/* Set up the static file server */
let static = require('node-static');

/** Set up the http server library*/
let http = require('http');

/** Assume that we are running on Heroku */
let port = process.env.PORT;
let directory = __dirname + '/public';

/** If not on Heroku, then need to adjust the port and directory */
if ((typeof port == 'undefined') || (port === null)) {
    port = 8080;
    directory = './public';
}

/** Set up static file web server to deliver files from the filesystem */
let file = new static.Server(directory);

let app = http.createServer(
    function(request, response) {
        request.addListener('end',
            function() {
                file.serve(request, response);
            }
        ).resume();
    }
).listen(port);

console.log('The server is running');




/*********************************************/
/** Set up the web soket server and send it to the clients */

/*** Set up a registry of player information and their socket ids */
let players = [];

const { Server } = require("socket.io");
const { isPrimitive } = require("util");
const { Socket } = require('dgram');
const io = new Server(app);

io.on('connection', (socket) => {

    /**Output a log message on the server and send it to the clients */
    function serverLog(...message) {
        io.emit("log", ["**** Message from the server:\n"]);
        message.forEach((item) => {
            io.emit("log", ["****\t" + item]);
            console.log(item);
        });
    }

    serverLog('a page conneted to the server: ' + socket.id);

    /***********************************************************/
    /********************Chat room connection*****************/

    /**join_room command handler */
    /** expected payload:
     * {
     *  'room': the room to be joined
     *  'username': the name of the user joining the room
     * }
     */

    /** join_room response:
     * {
     *  'result': sucess,
     *  'room': room that we joined,
     *  'username': the user that joined the room
     *  'count': the number of the users in the chat room
     *  'socket_id': the socket of the user that just joined the room
     * }
     * or
     * {
     *  'result': 'fail',
     *  'message': the reason for failure
     * }
     */

    socket.on('join_room', (payload) => {
        serverLog('Server received a command', '\'join_room\'', JSON.stringify(payload));
        /** Check that the data coming from the client is good */
        if (typeof payload == "undefined" || payload === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a payload";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }

        let room = payload.room;
        let username = payload.username;
        if (typeof room == "undefined" || room === null) {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid room to join";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }

        if (typeof username == "undefined" || username === null || username == "null") {
            response = {};
            response.result = "fail";
            response.message = "client did not send a valid username to join the chat room";
            socket.emit("join_room_response", response);
            serverLog("join_room command failed", JSON.stringify(response));
            return;
        }

        /** handle the command */
        socket.join(room);

        /**make sure the client was put in the room */
        io.in(room).fetchSockets().then((sockets) => {
            serverLog("There are " + sockets.length + " clients in the room, " + room);
            /** socket didn't join the room */
            if ((typeof sockets == "undefined") || (sockets === null) || !sockets.includes(socket)) {
                response = {};
                response.result = "fail";
                response.message = "server internal error joining chat room";
                socket.emit("join_room_response", response);
                serverLog("join_room command failed", JSON.stringify(response));
            } /** socket did join the room */
            else {
                players[socket.id] = {
                        username: username,
                        room: room
                    }
                    /** Announce to everyone that is in the room, who else is in the room */
                for (const member of sockets) {
                    response = {
                            result: 'success',
                            socket_id: member.id,
                            room: players[member.id].room,
                            username: players[member.id].username,
                            count: sockets.length
                        }
                        /** tell everyone that a new user has joined the chat room */
                    io.of("/").to(room).emit("join_room_response", response);
                    serverLog("join_room succeeded ", JSON.stringify(response));
                    if (room !== "Lobby") {
                        send_game_update(socket, room, 'initial update');
                    }
                }
            }
        });
    });

    socket.on('disconnect', () => {
        serverLog('a page disconneted from the server: ' + socket.id);
        if ((typeof players[socket.id] != 'undefined') && (players[socket.id] != null)) {
            let payload = {
                username: players[socket.id].username,
                room: players[socket.id].room,
                count: Object.keys(players).length - 1,
                socket_id: socket.id
            };
            let room = players[socket.id].room;
            delete players[socket.id];
            /**Tell everyone who left the room */
            io.of("/").to(room).emit('player_disconnected', payload);
            serverLog('player_disconnected succeeded ', JSON.stringify(payload));
        }
    });

    /**send_chat_message command handler */
    /** expected payload:
     * {
     *  'room': the room to which the message should be sent
     *  'username': the name of the user joining the room
     *  'message': the message to broadcast
     * }
     */

    /** send_chat_message response:
     * {
     *  'result': sucess,
     *  'username': the user that sent the message
     *  'message': the message that was sent
     * }
     * or
     * {
     *  'result': 'fail',
     *  'message': the reason for failure
     * }
     */

    socket.on("send_chat_message", (payload) => {
        serverLog(
            "Server received a command",
            "'send_chat_message'",
            JSON.stringify(payload)
        );
        if (typeof payload == "undefined" || payload === null) {
            let response = {};
            response.result = "fail";
            response.message = "client did not send a payloda";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }

        let room = payload.room;
        let username = payload.username;
        let message = payload.message;
        if (typeof room == "undefined" || room === null) {
            let response = {};
            response.result = "fail";
            response.message = "client did not send a valid room to message";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }

        if (typeof username == "undefined" || username === null || username == "") {
            let response = {};
            response.result = "fail";
            response.message = "client did not send a valid username to message";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }

        if (typeof message == "undefined" || message === null || message == "") {
            let response = {};
            response.result = "fail";
            response.message = "client did not send a valid message";
            socket.emit("send_chat_message_response", response);
            serverLog("send_chat_message command failed", JSON.stringify(response));
            return;
        }

        /** handle the command */
        // socket.join(room);
        let response = {};
        response.result = "success";
        response.username = username;
        response.room = room;
        response.message = message;
        // tell everyone in the room what the message is
        io.of("/").to(room).emit("send_chat_message_response", response);
        serverLog("send_chat_message command succeeded", JSON.stringify(response));
    });
});








/********************************/
/** Code related to game state */

let game = [];

function create_new_game() {
    let new_game = {};
    new_game.player_white = {};
    new_game.player_white.socket = "";
    new_game.player_white.username = "";
    new_game.player_black = {};
    new_game.player_black.socket = "";
    new_game.player_black.username = "";

    var d = new Date();
    new_game.last_move_time = d.getTime();

    new_game.whose_turn = "white";

    new_game.board = [
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', 'w', 'b', ' ', ' ', ' '],
        [' ', ' ', ' ', 'b', 'w', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ']
    ];
    return new_game;
}


function send_game_update(socket, game_id, message) {
    /** Check to see if a game with game_id exists */
    /** Make sure that only 2 people are in the room */
    /** Assign this socket a color */
    /** Send game update */
    /** Check if the game is over */

    /** Check to see if a game with game_id exists */
    if ((typeof games[game_id] == 'undefined') || (games[game_id] === null)) {
        console.log("No game exists with game_id:" + game_id + ". Making a new game for " + socket_id);
        games[game_id] = create_new_game();
    }

    /** Send game update */
    let payload = {
        result: 'success',
        game_id: game_id,
        game: games[game_id],
        message: message
    }
    io.of("/").to(game_id).emit('game_update', payload);
}