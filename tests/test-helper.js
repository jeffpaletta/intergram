$( function() {
  $( "button.reload" ).click( function() {
    localStorage.setItem( "openOnInstall", chrome.extension.getURL( window.location.pathname.slice(1) ) );
    chrome.runtime.reload();
  } );
} );
