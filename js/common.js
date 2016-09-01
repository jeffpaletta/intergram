var FW = (function( exports ) {
  var options = {
    verbose: false,
    ENV: 'prod'
  };

  exports.options = options;
  exports.log = log;
  exports.configure = configure;
  return exports;



  function log() {
    if ( options.verbose ) console.log.apply( console, arguments );
  }

  function configure( config ) {
    for ( var o in config ) {
      if ( config.hasOwnProperty( o ) && options.hasOwnProperty( o ) ) {
        options[ o ] = config[ o ];
      }
    }
  }
})({});
