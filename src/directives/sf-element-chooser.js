(function(){
  angular.module('schemaForm')
    .directive('sfElementChooser', sfElementChooser);

  function sfElementChooser() {
    return {
      restrict: 'E',
      templateUrl: 'directives/sf-element-chooser.html',
      scope: {
        designMode: '='
      },
      controller: function($scope) {
        $scope.menuItems = [
          {type: "text", label: "Text Element"},
          {type: "datepicker", label: "Date Element"},
          {type: "fieldset", label: "Section Element"}
        ];

        $scope.addElement = function(type) {
          $scope.$emit('sf-adding-element', { type: type });
        }
      }
    }
  }
})();
