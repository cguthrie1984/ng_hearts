"use strict";

var suits = {
  "C" : "\u2663",
  "S" : "\u2660",
  "D" : "\u2666",
  "H" : "\u2665"
};
angular.module('hearts').filter('parse_card', function() {
  return function(cardstr) {
    var suit = cardstr.substr(0,1);
    var rank = cardstr.substr(1,1);
    rank = rank === "0" ? "10" : rank;
    suit = suits[suit];
    var class_str = ( suit === "C" || suit === "S" ) ? "black" : "red";
    return "<span class=\"" + class_str + "\">" + rank + suit + "</span>";
  };
});
