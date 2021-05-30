function getIRIParameterValue(requestedKey) {
    let pageIRI = window.location.search.substring(1);
    let pageIRIVariables = pageIRI.split('&');
    for (let i = 0; i < pageIRIVariables.length; i++) {
        let data = pageIRIVariables[i].split('=');
        let key = data[0];
        let value = data[1];
        if (key === requestedKey) {
            return value;
        }
    }
    return null;
}

let username = decodeURI(getIRIParameterValue('username'));
if ((typeof username == 'undefined') || (username === null) || (username === "null")) {
    username = "Anonymous_" + Math.floor(Math.random() * 1000);
}

let chatRoom = decodeURI(getIRIParameterValue('game_id'));
if ((typeof chatRoom == 'undefined') || (chatRoom === null) || (chatRoom === "null")) {
    chatRoom = "Lobby";
}
// $('#messages').prepend('<b>'+ username + ':</b>');
$('#WelcomeUsername').prepend('<b>' + 'Welcome ' + username + '!</b>');

/** Set up the socket.io connection to the server */
let socket = io();
socket.on('log', function(array) {
    console.log.apply(console, array);
});

function makeInviteButton() {
    let newHTML = "<button type='button' class='btn btn-outline-primary'> Invite </button>";
    let newNode = $(newHTML);
    return newNode;
}

socket.on('join_room_response', function(payload) {
    if (typeof payload == "undefined" || payload === null) {
        console.log('Server did not send a payload')
        return;
    }
    if (payload.result === 'fail') {
        console.log(payload.message)
        return;
    }

    /** If we are being notified our ourselves then ignore the message and return */
    if (payload.socket_id === socket.id) {
        return;
    }
    let domElements = $('.socket_' + payload.socket_id);
    /** If we are being repeat notified then return */
    if (domElements.length !== 0) {
        return;
    }

    /*
    <div class="pt-3 pb-3 w-100 border-bottom d-flex">
        <div class="col text-start"> Wenwen</div>
        <div class="col text-end"> 
           <button type="button" class="btn btn-primary"> Invite </button>
        </div>
    </div>
    */
    let nodeA = $("<div></div>");
    //nodeA.addClass("pt-3");
    //nodeA.addClass("pb-3");
    nodeA.addClass("w-100");
    //nodeA.addClass("border-bottom");
    nodeA.addClass("d-flex");
    nodeA.addClass("socket_" + payload.socket_id);
    nodeA.hide();

    let nodeB = $("<div></div>");
    nodeB.addClass("col");
    nodeB.addClass("text-start");
    nodeB.addClass("pt-12rem");
    nodeB.addClass("pb-3");
    nodeB.addClass("border-bottom");
    nodeB.addClass("text-muted");

    nodeB.addClass("socket_" + payload.socket_id);
    nodeB.append('<strong>' + payload.username + '</strong>');

    let nodeC = $("<div></div>");
    nodeC.addClass("col");
    nodeC.addClass("text-end");
    nodeC.addClass("pt-3");
    nodeC.addClass("pb-3");
    nodeC.addClass("border-bottom");
    nodeC.addClass("socket_" + payload.socket_id);

    let buttonC = makeInviteButton();
    nodeC.append(buttonC);
    nodeA.append(nodeB);
    nodeA.append(nodeC);

    $("#players").append(nodeA);
    nodeA.show("fade", 1000);

    /** Announcing in the chat that someone has arrived */
    let newHTML = '<p class = \'join_room_response\'>' + payload.username + ' joined the ' + payload.room + '. (There are ' + payload.count + ' users in this room) </p>';
    let newNode = $(newHTML);
    newNode.hide();
    $('#messages').prepend(newNode);
    newNode.show('fade', 500)
});


socket.on('player_disconnected', (payload) => {
    if (typeof payload == "undefined" || payload === null) {
        console.log('Server did not send a payload')
        return;
    }

    if (payload.socket_id === socket.id) {
        return;
    }

    let domElements = $('.socket_' + payload.socket_id);
    if (domElements.length !== 0) {
        domElements.hide("fade", 500);
    }

    let newHTML = '<p class = \'join_room_response\'>' + payload.username + ' left the ' + payload.room + '. (There are ' + payload.count + ' users in this room) </p>';
    let newNode = $(newHTML);
    newNode.hide();
    $('#messages').prepend(newNode);
    newNode.show('fade', 500)
});



function sendChatMessage() {
    let request = {}
    request.room = chatRoom;
    request.username = username;
    request.message = $('#chatMessage').val();
    console.log('***** client log message, sending \'send_chat_message\' commad: ' + JSON.stringify(request));
    socket.emit('send_chat_message', request);
    $('#chatMessage').val("");
}

socket.on('send_chat_message_response', (payload) => {
    if (typeof payload == "undefined" || payload === null) {
        console.log('Server did not send a payload')
        return;
    }

    if (payload.result === 'fail') {
        console.log(payload.message)
        return;
    }

    let newHTML = '<p class =\'chat_message\'><b>' + payload.username + '</b>: ' + payload.message + ' </p>';
    let newNode = $(newHTML);
    newNode.hide();
    $('#messages').prepend(newNode);
    newNode.show('fade', 500);
});


let old_board = [
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?'],
    ['?', '?', '?', '?', '?', '?', '?', '?']
];

socket.on('game_update', (payload) => {
    if (typeof payload == "undefined" || payload === null) {
        console.log('Server did not send a payload');
        return;
    }

    if (payload.result === 'fail') {
        console.log(payload.message);
        return;
    }

    let board = payload.game.board;
    if ((typeof board == 'undefined') || (board === null)) {
        console.log('Server did not send a valid board to display');
        return;
    }

    /** Update my color */


    /** Animate change to the board */
    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 8; column++) {
            /** Check to see if the server changed any space on the board */
            if (old_board[row][column] !== board[row][column]) {
                let graphic = "";
                let altTag = "";
                if ((old_board[row][column] === '?') && (board[row][column] === ' ')) {
                    graphic = "empty.gif";
                    altTag = "empty space";
                } else if ((old_board[row][column] === '?') && (board[row][column] === 'w')) {
                    graphic = "empty_to_blue.gif";
                    altTag = "blue token";
                } else if ((old_board[row][column] === '?') && (board[row][column] === 'b')) {
                    graphic = "empty_to_red.gif";
                    altTag = "red token";
                } else if ((old_board[row][column] === ' ') && (board[row][column] === 'w')) {
                    graphic = "empty_to_blue.gif";
                    altTag = "blue token";
                } else if ((old_board[row][column] === ' ') && (board[row][column] === 'b')) {
                    graphic = "empty_to_red.gif";
                    altTag = "red token";
                } else if ((old_board[row][column] === 'w') && (board[row][column] === ' ')) {
                    graphic = "blue_to_empty.gif";
                    altTag = "empty space";
                } else if ((old_board[row][column] === 'b') && (board[row][column] === ' ')) {
                    graphic = "red_to_empty.gif";
                    altTag = "empty space";
                } else if ((old_board[row][column] === 'w') && (board[row][column] === 'b')) {
                    graphic = "blue_to_red.gif";
                    altTag = "blue token";
                } else if ((old_board[row][column] === 'b') && (board[row][column] === 'w')) {
                    graphic = "red_to_blue.gif";
                    altTag = "red token";
                } else {
                    graphic = "error.gif";
                    altTag = "error";
                }

                const t = Date.now();
                $('#' + row + '_' + column).html('<img class="img-fluid" src="images/' + graphic + '?time=' + t + '" alt="' + altTag + '" />');
            }
        }
    }
    old_board = board;
});


/******* Request to join the chat room */
$(() => {
    let request = {}
    request.room = chatRoom;
    request.username = username;
    console.log('***** Client log message, sending \'join_room\' commad: ' + JSON.stringify(request));
    socket.emit('join_room', request);

    $('#lobbyTitle').html(username + "'s Lobby");

    $('#chatMessage').keypress(function(e) {
        let key = e.which;
        if (key == 13) {
            //the enter key
            $('button[id = chatButton]').click();
            return false;
        }
    });

});