var express = require( 'express' );
var cors = require('cors');

var server = express();
server.use(cors());

server.use( '/client', express.static( 'client' ) );
server.use( express.bodyParser() ); // Exposes req.body as JSON object from POST data

var game = null;

function respond( res, msg ){
  if ( msg ){
    res.send({
      "success" : false,
      "message" : msg
    });
  }
  else{
    res.send({
      "success" : true,
      "message" : "OK"
    });
  }
}

function cleargame(){
  game = {
    "players" : [],
    "passdirection" : "left",
    "heartsbroken" : false,
    "trick" : {
      "leader" : null,
      "cards" : [ null, null, null, null ]
    }
  };
     
  for( var i = 0; i < 4; i++ ){
    game.players.push({ 
      "total_points" : 0,
      "round_points" : 0,
      "state" : "mustpass",
      "hand" : [],
      "passed_cards" : []
    });
  }

  dealcards( game.players );
}

function dealcards( players ){
  var deck = [];
  var suits = [ "H", "S", "D", "C" ];
  var ranks = [ "2", "3", "4", "5", "6", "7", "8", "9", "0", "J", "Q", "K", "A" ];
  suits.forEach( function( suit ){
    ranks.forEach( function( rank ){
      deck.push( suit + rank );
    });
  });

  players.forEach( function( player ){
    player.hand = [];
    for( var i = 0; i < 13; i++ ){
      player.hand.push( draw_random_card( deck ) );
    }
  });
}

function validate_player_id( req, res ){
  var player_id = req.params.player_id;
  if ( isNaN( player_id ) ){
    respond( res, "Error: not a valid player ID" );
    return null;
  }
  player_id = Number(req.params.player_id);
  if( ( player_id < 0 ) || ( player_id > 3 ) ){
    respond( res, "Error: not a valid player ID" );
    return null;
  }
  return game.players[ player_id ];
}

function draw_random_card( deck ){
  if ( deck.length < 1 ){
    console.log( "WARNING: Drawing from empty deck." );
    return null;
  }
  var idx = Math.floor( Math.random() * deck.length );
  var card = deck[idx];
  deck.splice( idx, 1 ); // Delete one element from deck 
  return card;
}

function can_pass_cards( player, cards ){
  var can_pass = true;
  cards.forEach( function( passcard ){
    if( !player_has_card_in_hand( player, passcard ) ){
      can_pass = false;
    }
  });
  return can_pass;
}

// TODO
function check_duplicate_cards( cards ){

}

function player_has_card_in_hand( player, card ){
  var has_card = false;
  player.hand.forEach( function( handcard ){
    if( handcard === card ){
      has_card = true;
    }
  });
  return has_card;
}

function player_has_suit_in_hand( player, suit ){
  var has_suit = false;
  player.hand.forEach( function( handcard ){
    if( handcard.substr(0,1) === suit ){
      has_suit = true;
    }
  });
  return has_suit;
}

function start_game_if_possible(){
  var can_start = true;
  game.players.forEach( function( player ){
    if( player.state !== "waitpass" ){
      can_start = false;
    }
  });
  if( !can_start )
    return;

  // Ready to start
  // Change global pass direction
  if( game.passdirection === "left" ){
    game.passdirection = "right";
  }
  else if( game.passdirection === "right" ){
    game.passdirection = "across";
  }
  else if( game.passdirection === "across" ){
    game.passdirection = "none";
  }
  else if( game.passdirection === "none" ){
    game.passdirection = "left";
  }
  // Reset hearts broken flag
  game.heartsbroken = false;

  // Update each player
  game.players.forEach( function( player, player_id ){

    // Pull in passed cards
    player.passed_cards.forEach( function( card ){
      player.hand.push( card );
    });
    player.passed_cards = [];
    player.state = "waitplay";

    // Is this player the leader?
    if( player_has_card_in_hand( player, "C2" )){
      game.trick.leader = player_id;
      player.state = "mustplay";
    }
  });
}

function can_play_card( player, card, res ){
  if( !player_has_card_in_hand( player, card ) ){
    respond( res, "Error: You don't have that card" );
    return false;
  }
  if( player_has_card_in_hand( player, "C2" ) && ( card !== "C2" ) ){
    respond( res, "Error: You must lead this trick with the two of clubs" );
    return false;
  }
  var suit_played = card.substr(0,1);

  // Check if not leading trick
  if( player !== game.players[game.trick.leader] ){
    var leading_suit = game.trick.cards[game.trick.leader].substr(0,1);
    if( player_has_suit_in_hand( player, leading_suit ) ){
      respond( res, "Error: You must follow suit" );
      return false;
    }
  }
  else{
    // We're leading. See if we can lead w/ hearts
    if( ( suit_played === "H" ) && !game.heartsbroken ){
      var has_only_hearts = true;
      // TODO: Clean this up
      player.hand.forEach(function(handcard){
        if ( handcard.substr(0,1) !== "H" ){
          has_only_hearts = false;
        }
      });
      if( !has_only_hearts ){
        respond( res, "Error: You cannot break hearts yet" );
        return false;
      }
    }
  }
  return true;
}

function perform_pass( from_player_id, cards ){

  // Determine which player to pass to
  var to_player_id = from_player_id;
  var from_player = game.players[from_player_id];
  if( game.passdirection === "left" ){
    to_player_id--;
  }
  else if( game.passdirection === "right" ){
    to_player_id++;
  }
  else if( game.passdirection === "across" ){
    to_player_id+=2;
  }
  var to_player = game.players[to_player_id & 3];

  // Copy passed cards to receiving player
  cards.forEach( function( card ){
    to_player.passed_cards.push( card );
  });

  // remove passed cards from passing player hand
  cards.forEach( function(card){
    for( var i = 0; i < from_player.hand.length; i++ ){
      if( card === from_player.hand[i] ){
        from_player.hand.splice( i, 1 );
        break;
      }
    }
  });

  // Indicate that this player has already passed his cards
  from_player.state = "waitpass";
}

function remove_card_from_hand( player, card ){
  for( var i = 0; i < player.hand.length; i++ ){
    if( player.hand[i] === card ){
      player.hand.splice( i, 1 );
      break;
    }
  }
}

function is_trick_complete(){
  var is_complete = true;
  game.trick.cards.forEach( function( trickcard ){
    if( trickcard === null ){
      is_complete = false;
    }
  });
  return is_complete;
}

function perform_play( player_id, card ){
  var player = game.players[player_id];
  remove_card_from_hand( player, card );
  player.state = "waitplay";
  game.trick.cards[player_id] = card;
  // Signal next player's turn if trick not complete
  if( !is_trick_complete() ){
    game.players[( player_id+1 & 3 ) ].state = "mustplay";
    return;
  }
  process_trick();
}

function is_higher_rank( rank1, rank2 ){
  var ranks = [ "2", "3", "4", "5", "6", "7", "8", "9", "0", "J", "Q", "K", "A" ];
  var rank_obj = {};
  ranks.forEach( function( rank, idx ){
    rank_obj[rank] = idx;
  });
  return rank_obj[rank1] > rank_obj[rank2];
}

function process_trick(){
  //Determine who took highest of leading suit
  var trick_taker_idx = null;
  var leading_suit = game.trick.cards[game.trick.leader].substr(0,1);
  game.trick.cards.forEach( function( card, player_id ){
    if( card.substr( 0,1 ) === leading_suit ){
      if( trick_taker_idx === null ){
        // If trick taker is not set, this is currently the highest
        trick_taker_idx = player_id;
      }
      else{
        // Determine if this card is the largest
        if( is_higher_rank( card.substr(1,1), game.trick.cards[trick_taker_idx].substr(1,1) ) ){
          trick_taker_idx = player_id;
        }
      }
    }
  });
  // Trick taker index is index of one who played highest card
  var trick_taker = game.players[trick_taker_idx];
  game.trick.cards.forEach( function( card ){
    if( card.substr(0,1) === "H" ){
      trick_taker.round_points++;
    }
    else if( card === "SQ" ){
      trick_taker.round_points+=13;
    }
  });
  // Clear table
  game.trick.cards = [ null, null, null, null ];
  
  if( trick_taker.hand.length === 0 ){
    // We've reached the end of the round; we need to re-deal
    game.players.forEach( function( player ){
      if( player.round_points === 26 ){
        player.round_points = 0;
        game.player.forEach(function( other_player ){
          if( other_player !== player ){
            other_player.total_points += 26;
          }
        });
      }
      else{
        player.total_points += player.round_points;
        player.round_points = 0;
      }
    });
    // Reset table for next round
    dealcards( game.players );
    game.players.forEach( function(player){
      player.state = game.passdirection === "none" ? "waitpass" : "mustpass";
    });
    start_game_if_possible();
  }
  else{
    //Set leader for next round
    game.players.forEach(function(player){
      player.state = "waitplay";
    });
    trick_taker.state = "mustplay";
    game.trick.leader = trick_taker_idx;
  }
}

server.post( '/game', function( req, res ){
  cleargame();
  respond(res);
});

server.get( '/game', function( req, res ){
  res.send( game );
});

server.get( '/player/:player_id', function( req, res ){
  var player = validate_player_id( req, res );
  if( player === null )
    return;

  res.send( player );
});

server.post( '/player/:player_id/pass', function( req, res ){
  var player = validate_player_id( req, res );
  if( player === null )
    return;
  
  if( player.state !== "mustpass" ){
    respond( res, "Error: not currently passing" );
    return;
  }
  var cards = req.body.cards;
  if ( !Array.isArray( cards ) ){
    respond( res, "Error: Need array of cards to pass" );
    return;
  }
  if( cards.length != 3 ){
    respond( res, "Error: Must pass three cards" );
    return;
  }
  // TODO: Check duplicate cards
  if ( !can_pass_cards( player, cards ) ){
    respond( res, "Error: Invalid cards to pass" );
    return;
  }
  perform_pass( Number( req.params.player_id ), cards );
  start_game_if_possible();
  respond( res );
});

server.post( '/player/:player_id/play', function( req, res ){
  var player = validate_player_id( req, res );
  if( player === null )
    return;
  
  if( player.state !== "mustplay" ){
    respond( res, "Error: not your turn" );
    return;
  }
  var card = req.body.card;
  if( !card ){
    respond( res, "Error: Invalid card" );
    return;
  }
  if( !can_play_card( player, card, res ) ){
    return;
  }
  perform_play( Number( req.params.player_id ), card );
  respond( res );
});
/*
server.get( '/', function( req, res ){
  res.statusCode = 302;
  res.setHeader( 'Location', '/client/index.html' );
  res.end();
});
*/
cleargame();
server.listen(12345);

console.log( "Listening on port 12345" );

