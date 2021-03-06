/*
FIXME: real documentation
<form sf-form="form"  sf-schema="schema" sf-decorator="foobar"></form>
*/

angular.module('schemaForm')
       .directive('sfSchema',
['$compile', 'schemaForm', 'schemaFormDecorators', 'sfSelect', 'sfPath',
  function($compile,  schemaForm,  schemaFormDecorators, sfSelect, sfPath) {

    var SNAKE_CASE_REGEXP = /[A-Z]/g;
    var snakeCase = function(name, separator) {
      separator = separator || '_';
      return name.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
        return (pos ? separator : '') + letter.toLowerCase();
      });
    };

    return {
      scope: {
        schema: '=sfSchema',
        initialForm: '=sfForm',
        model: '=sfModel',
        options: '=sfOptions',
        designMode: '=sfDesignMode'
      },
      controller: ['$scope', function($scope) {
        this.evalInParentScope = function(expr, locals) {
          return $scope.$parent.$eval(expr, locals);
        };
      }],
      replace: false,
      restrict: 'A',
      transclude: true,
      require: '?form',
      link: function(scope, element, attrs, formCtrl, transclude) {

        //expose form controller on scope so that we don't force authors to use name on form
        scope.formCtrl = formCtrl;

        //We'd like to handle existing markup,
        //besides using it in our template we also
        //check for ng-model and add that to an ignore list
        //i.e. even if form has a definition for it or form is ["*"]
        //we don't generate it.
        var ignore = {};
        transclude(scope, function(clone) {
          clone.addClass('schema-form-ignore');
          element.prepend(clone);

          if (element[0].querySelectorAll) {
            var models = element[0].querySelectorAll('[ng-model]');
            if (models) {
              for (var i = 0; i < models.length; i++) {
                var key = models[i].getAttribute('ng-model');
                //skip first part before .
                ignore[key.substring(key.indexOf('.') + 1)] = true;
              }
            }
          }
        });

        scope.$on('sf-remove-element', function(event, args){
          var element = args.element;
          var newSchema = angular.copy(scope.schema);
          var newForm = angular.copy(scope.initialForm);
          delete newSchema.properties[element.key[0]];
          removeKeyFromFormArray(element.key[0], newForm);

          scope.schema = newSchema;
          scope.initialForm = newForm;
        });

        scope.$on('sf-element-added', function(event, args){
          var newSchema = angular.copy(scope.schema);
          var newForm = angular.copy(scope.initialForm);
          args.element.key = [args.element.key];

          if(args.parentKey) {
            addToParent(newForm, args.parentKey, args.element);
          } else {
            newForm.push(args.element);
          }


          if(args.element.type != 'fieldset') {
            newSchema.properties[args.element.key[0]] = args.schemaItem;
            scope.model[element.key] = "";
          }

          scope.schema = newSchema;
          scope.initialForm = newForm;
        });

        function addToParent(array, parentKey, element) {
          for(index in array) {
            if(array[index].key[0] == parentKey[0]) {
              array[index].items.push(element);
            } else if(array[index].type == 'fieldset') {
              addToParent(array[index].items, parentKey, element);
            }
          }
        }

        function removeKeyFromFormArray(key, array) {
          var index = -1;
          for(var i = 0; i < array.length; i++) {
            if(array[i].key && key == array[i].key[0]) {
              index = i;
            }
            if(array[i].type == 'fieldset') {
              removeKeyFromFormArray(key, array[i].items);
            }
          }
          if(index > -1) {
            array.splice(index, 1);
          }
        }
        //Since we are dependant on up to three
        //attributes we'll do a common watch
        var lastDigest = {};
        var childScope;
        scope.$watch(function() {

          var schema = scope.schema;
          var form   = scope.initialForm || ['*'];

          //The check for schema.type is to ensure that schema is not {}
          if (form && schema && schema.type &&
              (lastDigest.form !== form || lastDigest.schema !== schema) &&
              Object.keys(schema.properties).length > 0) {
            lastDigest.schema = schema;
            lastDigest.form = form;

            var merged = schemaForm.merge(schema, form, ignore, scope.options);
            var frag = document.createDocumentFragment();

            // Create a new form and destroy the old one.
            // Not doing keeps old form elements hanging around after
            // they have been removed from the DOM
            // https://github.com/Textalk/angular-schema-form/issues/200
            if (childScope) {
              childScope.$destroy();
            }
            childScope = scope.$new();

            //make the form available to decorators
            childScope.schemaForm  = {form:  merged, schema: schema};

            //clean all but pre existing html.
            element.children(':not(.schema-form-ignore)').remove();

            // Find all slots.
            var slots = {};
            var slotsFound = element[0].querySelectorAll('*[sf-insert-field]');

            for (var i = 0; i < slotsFound.length; i++) {
              slots[slotsFound[i].getAttribute('sf-insert-field')] = slotsFound[i];
            }

            //Create directives from the form definition
            angular.forEach(merged, function(obj, i) {
              var n = document.createElement(attrs.sfDecorator ||
                                             snakeCase(schemaFormDecorators.defaultDecorator, '-'));
              n.setAttribute('form','schemaForm.form['+i+']');

              // Check if there is a slot to put this in...
              if (obj.key) {
                var slot = slots[sfPath.stringify(obj.key)];
                if (slot) {
                  while (slot.firstChild) {
                    slot.removeChild(slot.firstChild);
                  }
                  slot.appendChild(n);
                  return;
                }
              }

              // ...otherwise add it to the frag
              frag.appendChild(n);

            });

            var elementChooser = document.createElement('sf-element-chooser');
            elementChooser.setAttribute('design-mode', 'designMode');
            frag.appendChild(elementChooser);

            element[0].appendChild(frag);

            //compile only children
            $compile(element.children())(childScope);

            //ok, now that that is done let's set any defaults
            schemaForm.traverseSchema(schema, function(prop, path) {
              if (angular.isDefined(prop['default'])) {
                var val = sfSelect(path, scope.model);
                if (angular.isUndefined(val)) {
                  sfSelect(path, scope.model, prop['default']);
                }
              }
            });
          };
          scope.$emit('sf-render-finished', element);
        });
      }
    };
  }
]);
