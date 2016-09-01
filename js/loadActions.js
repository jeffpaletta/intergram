chrome.runtime.onInstalled.addListener( function() {
  var url = localStorage.getItem( "openOnInstall" );
  if ( url ) {
    console.log( "open on install URL set, opening tab to " + url );
    localStorage.removeItem( "openOnInstall" );
    chrome.tabs.create( { url: url } );
  }
} );
