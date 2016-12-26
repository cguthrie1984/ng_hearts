"use strict";

var hearts = angular.module('hearts', []);

hearts.controller('hearts_table', function($scope, $http){
  $http.get('http://localdev:12345/game/').then(function(response) {
    $scope.data = response.data;
  });
});

