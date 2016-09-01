////////////////////////////////////////////////////////////////////////////////
// Manage iframe loading
var testSites = [],
    loadedSites = [],
    expectedTestSites = [
      "http://www.boston.com/",
      "http://www.huffingtonpost.com/",
      "http://www.cnn.com/",
      "http://www.nytimes.com/",
      "http://www.gothamist.com/",
      "http://www.timeout.com/",
      "http://www.amazon.com/",
      "http://www.pitchfork.com/",
      "http://www.mashable.com/"
    ].sort()
;

$(function(){
  var $testSites = $(".test-site"),
      nSites = $testSites.length,
      nLoaded = 0,
      $progress = $("#progress")
  ;

  $testSites.each( function() {
    testSites.push( this.src );
  } );

  $testSites.load(function() {
    if ( ++nLoaded >= nSites ) $(".loading").remove();
    loadedSites.push( this.src );
    $progress.css("width", (nLoaded / nSites) * 100 + "%");
  });
});

////////////////////////////////////////////////////////////////////////////////
// Tests

var recordedAds = []
;

// Remove X-Frame-Options header so we can embed all sites
chrome.webRequest.onHeadersReceived.addListener(
  function(info) {
    var headers = info.responseHeaders;
    for (var i=headers.length-1; i>=0; --i) {
      var header = headers[i].name.toLowerCase();
      if (header == 'x-frame-options' || header == 'frame-options') {
        headers.splice(i, 1); // Remove header
      }
    }
    return {responseHeaders: headers};
  },
  {
    urls: [ '*://*/*' ], // Pattern to match all http(s) pages
    types: [ 'sub_frame' ]
  },
  ['blocking', 'responseHeaders']
);

// Listen to our extension to monitor its behavior
chrome.extension.onMessage.addListener( function( request, sender, sendResponse ) {
  if ( request.whatKind === 'recordAd' ) {
    $("#num-ads").text( recordedAds.length + " ads detected" );
    recordedAds.push( { request: request, sender: sender } );
  }
} );

QUnit.test( "at least one ad was recorded", function( assert ) {
  assert.ok( recordedAds.length > 1, recordedAds.length + " ads recorded" );
});

QUnit.test( "all test sites were at least attempted", function( assert ) {
  assert.deepEqual( testSites.sort(), expectedTestSites );
});

expectedTestSites.forEach( function( site ) {
  QUnit.test( site + " was loaded", function( assert ) {
    assert.ok( loadedSites.indexOf( site ) !== -1, loadedSites + " expected to include " + site );
  });
});
