FW.configure( { ENV: 'prod' } );
FW.log("Floodwatch Initialized.");

var histFocus = false; // global to keep track of when history tab is fired
var optIn = "";
var html5rocks = {};
var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
var initTimestamp = new Date().getTime();
var sessionID = '';
var firstInstalled = new Date();
var screenshot = {};
var pendingImpressions = [];
var images = [];
var token = "";
var colorThief = new ColorThief();
var popUp = false;
var notificationPopUp = false;
var currentURL = "";
var openHistory = false;
var badSite = false;

var adsCollectedByTab = {};
chrome.tabs.onUpdated.addListener(function(tabId) {
  adsCollectedByTab[tabId] = 0;
  chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 0]});
  chrome.browserAction.setBadgeText({text:''});
});
chrome.tabs.onRemoved.addListener(function(tabId) {
    delete adsCollectedByTab[tabId];
});
chrome.tabs.onActivated.addListener(function(activeInfo){
    chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
    if(adsCollectedByTab[activeInfo.tabId] > 0) chrome.browserAction.setBadgeText({text:Math.min(999,adsCollectedByTab[activeInfo.tabId])+''});
    else chrome.browserAction.setBadgeText({text:''});
});


if ('webkitIndexedDB' in window && !window.IDBTransaction && !window.IDBKeyRange) {
  window.IDBTransaction = window.webkitIDBTransaction;
  window.IDBKeyRange = window.webkitIDBKeyRange;
}

html5rocks.indexedDB = {};
html5rocks.indexedDB.db = null;

html5rocks.indexedDB.open = function() {
  var v = 5;
  var request = indexedDB.open("floodwatch", v);
  FW.log("indexedDB.open( floodwatch ) called");

  request.onupgradeneeded = function(event) {

    FW.log("DB on upgrade called.");

    html5rocks.indexedDB.db = event.target.result;
    var db = html5rocks.indexedDB.db;

    if (db.objectStoreNames.contains("adImpressions")) {
      db.deleteObjectStore("adImpressions");
      FW.log("deleted a previously-extant objectStore called adImpressions");
    }

    FW.log("Creating adImpressions object store");
      var store = db.createObjectStore("adImpressions", {
        keyPath:"impression.placement_id"
      });

  };

  request.onsuccess = function(e) {
    FW.log("We're in indexedDB.open() onsuccess function");
    html5rocks.indexedDB.db = e.target.result;
    var db = html5rocks.indexedDB.db;
    FW.log("DB:" + db);
    // We can only create Object stores in a setVersion transaction;
  };
  request.onerror = html5rocks.indexedDB.onerror;
};

html5rocks.indexedDB.recordImpression = function(theImpression) {
  FW.log("RECORD IMPRESSION FUNCTION");
  var db = html5rocks.indexedDB.db;
  FW.log("GOT DB: " + db);
  var trans = db.transaction(["adImpressions"], "readwrite");
  var store = trans.objectStore("adImpressions");
  var data = {
    "impression": theImpression
  };
  var request = store.put(data);
  request.onsuccess = function(e) {
    FW.log("[AdImpressions] added " + theImpression.placement_id + " at " + theImpression.timestamp);
  };

  request.onerror = function(e) {
    FW.log("Error Adding: ", e);
  };

};

html5rocks.indexedDB.deleteImpression = function(id) {
  var db = html5rocks.indexedDB.db;
  var trans = db.transaction(["adImpressions"], "readwrite");
  var store = trans.objectStore("adImpressions");

  var request = store.delete(id);

  request.onsuccess = function(e) {
    html5rocks.indexedDB.getAllImpressions();
  };

  request.onerror = function(e) {
    FW.log("Error Removing Ad: ", e);
  };
};

html5rocks.indexedDB.onerror = function(e) {
  FW.log("Dammit! We're in background.indexedDB.onerror call.");
  FW.log(e);
};

html5rocks.indexedDB.getAllImpressions= function(callback) {
  var allImpressionsBackground = [];
  FW.log("background.getAllImpressions() begin");
  var db = html5rocks.indexedDB.db;
  var trans = db.transaction(["adImpressions"], "readonly");
  var store = trans.objectStore("adImpressions");
  // Get everything in the store;
  trans.oncomplete = function(event) {
        callback(allImpressionsBackground);
  };
  var keyRange = IDBKeyRange.lowerBound(0);
  var cursorRequest = store.openCursor(keyRange);
  cursorRequest.onerror = html5rocks.indexedDB.onerror;
  cursorRequest.onsuccess = function(e) {
    var result = e.target.result;
    if ( !! result === false) {
      FW.log("background.getAllImpressions() end");
      return;
    }
      allImpressionsBackground.push(result.value);
    result.continue();
  };
};

function initDB() {
  html5rocks.indexedDB.open();
  FW.log("executed indexedDB.open() in background page");
}

initDB();

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    FW.log(sender.tab ? "incoming message from a content script:" + sender.tab.url : "incoming message from the extension");
    if (request.whatKind === "recordAd") {
        FW.log("optIn is: " + optIn);
        if(badSite) {
            FW.log("this site is on the badWebsites list");
        } else {
            FW.log("site is not on badWebsites list");
            var theAd = request.theAd;
            var placementURI = request.theHash.toString() + CryptoJS.MD5(theAd.src).toString();

            verifyPlacement(placementURI, function(response) {
                if (response.status === "FOUND") {
                    var impression = makeImpression(placementURI, theAd.timestamp);
                    if (optIn) {
                        postImpression(impression, sender.tab);
                    } else {
                        html5rocks.indexedDB.recordImpression(impression);
                    }
                } else if (response.status  === "HOLD") {
                    pendingImpressions.push(makeImpression(placementURI, theAd.timestamp));
                } else if (response.status === "POST_P") {
                    if (optIn) {
                        postPlacement(makePlacement(placementURI, request.theHash.toString(), theAd.src, "Null for now", theAd.url, theAd.adAnchor), function(){
                            postImpression(makeImpression(placementURI, theAd.timestamp), sender.tab);
                        });
                    } else {
                        pendingImpressions.push(makeImpression(placementURI, theAd.timestamp));
                    }
                } else if (response.status === "POST_I") {
                    if (optIn) {
                        chrome.tabs.getSelected(null, function(tab) {
                            chrome.tabs.sendMessage(tab.id, {"whatKind" : "send_pixels", "id" : request.theHash}, function(response) {
                                if (response.pixels) {
                                    makeImage(request.theHash, response.pixels, response.adSize, function(img) {
                                        if (img.color) {
                                            uploadImage(img, function(result) {
                                                postPlacement(makePlacement(placementURI, result.id, theAd.src, "Null for now", theAd.url, theAd.adAnchor), function(){
                                                    postImpression(makeImpression(placementURI, theAd.timestamp), sender.tab);
                                                });
                                            });
                                        } else {
                                            FW.log("could not calculate color");
                                        }
                                    });
                                } else {
                                    FW.log("could not grab source");
                                }
                            });
                        });
                    } else {
                        pendingImpressions.push(makeImpression(placementURI, theAd.timestamp));
                    }
                }
                sendResponse({
                    "status": "Background received ad: " + request.theAd.id,
                });
            });
        }
    }

    if (request.whatKind === "checkOptIn") {
        checkOptIn(function(response){
            sendResponse({
                "status": response
            });
        });
        return true;
    }
    if (request.whatKind === "checkDemo") {
        checkDemo(function(response){
             sendResponse({
                "status": response
            });
        });
        return true;
    }
    if (request.whatKind === "popUpFalse") {
        FW.log("Popup false");
        sendResponse({
            "status": "popUp set to false"
        });
        popUp = false;
    }
     if(request.whatKind === "showHistory") {
        // just return all the DB contents
        FW.log("JUST RECEIVED showHistory from history.js to background.js");
        html5rocks.indexedDB.getAllImpressions(function(allImpressionsBackground) {
            FW.log("PAYLOAD" + allImpressionsBackground);
            sendResponse({
                "status": "Background.js responding to showHistory with payload of size " + allImpressionsBackground.length,
                "payload": allImpressionsBackground,
                "dateInstalled": firstInstalled.toLocaleDateString(),
            });
        });
        return true;
    }

  if(request.whatKind === "setUserToken") {
    localStorage.setItem('token', request.token);
    token = request.token;
    FW.log("TOKEN SET");
    if (openHistory == true) {
      chrome.tabs.create({ url: chrome.extension.getURL('history.html')});
      openHistory = false;
    }
    sendResponse({
      "status": "Token set"
    });
    return true;
  }
  if(request.whatKind === "getTagTree") {
    getTag(request.tag_id, function(){
      sendResponse({
        "status": "tag tree grabbed"
      });
    });
  }
  if(request.whatKind === "getUntagged") {
    getUntagged(function(results){
      sendResponse({
        "placements": results.items
      });
    });
    return true;
  }
  if(request.whatKind === "getMyUntagged") {
    getMyUntagged(function(results){
      sendResponse({
        "placements": results.items
      });
    });
    return true;
  }
  if(request.whatKind === "getTopTags") {
    getTopTags(function(results){
      sendResponse({
        "tags": results.items
      });
    });
    return true;
  }
  if(request.whatKind === "retrieveImpressions") {
    if (optIn) {
      retrieveImpressions(function(history){
        sendResponse(history);
      });
      return true;
    } else {
      html5rocks.indexedDB.getAllImpressions(function(history){
         sendResponse({"items" : history});
      });
      return true;
    }
  }

  if(request.whatKind === "retrievePlacementData") {
    retrievePlacementData(request.placementId, function(placement){
      sendResponse(placement);
    });
    return true;
  }

  if(request.whatKind === "downloadData") {
    downloadData(request.data, function(status){
      sendResponse({"status" : status});
    });
    return true;
  }

  if(request.whatKind === "retrievePlacements") {
    retrievePlacements(request.page, request.num, function(placements){
      sendResponse(placements);
    });
    return true;
  }

  if(request.whatKind === "setCurrentURL") {
    currentURL = request.currentURL
    sendResponse({
      "status" : "currentURL set"
    });
    for (var b in badWebsites) {
      var site = badWebsites[b];
      FW.log("SITE IS: " + site);
      if(currentURL.indexOf(site) != -1) {
        FW.log("SITE IS ON BADSITES LIST");
        badSite = true;
        break;
      } else {
        FW.log("SITE IS NOT ON BADSITES LIST");
        badSite = false;
      }
    }
  }

  if(request.whatKind === "retrieveImage") {
    retrieveImage(request.imgId, function(image){
      sendResponse(image);
    });
    return true;
  }

  if(request.whatKind === "retrieveThumbnail") {
    retrieveThumbnail(request.imgId, function(image){
      sendResponse(image);
    });
    return true;
  }

  if(request.whatKind === "getImage") {
     retrievePlacementData(request.placement_id, function(placement){
        retrieveImage(placement.img_id, function(pixels){
            sendResponse({
               "pixels": pixels
            });
        });
      });
    return true;
  }
  if(request.whatKind === "tagPlacement") {
        FW.log("Placement ID " + request.placement_id + "Tag ID" + request.tag_id);
        updateTag(request.placement_id, request.tag_id, function(){
            sendResponse({
               "status": "updated tag"
            });
        });
    return true;
  }
  if(request.whatKind === "flagAd") {
        flagAd(request.placement_id, request.reason, function(){
            sendResponse({
               "status": "flagged ad"
            });
        });
    return true;
  }
  if(request.whatKind === "retrieveUserTree") {
        retrieveUserTree(function(){
            sendResponse({
               "status": "retrieved"
            });
        });
    return true;
  }
  if(request.whatKind === "setOptIn") {
        optIn = request.optIn;
        updateOptIn(request.optIn, function(){
            sendResponse({
               "status": "updated optin"
            });
        });
    return true;
   }
   if(request.whatKind === "updateDemo") {
        updateDemo(request.demo, function(){
            sendResponse({
               "status": "updated demographics"
            });
        });
    return true;
   }
    if(request.whatKind === "updateColor") {
        updateColor(request.imgID, request.color, function(){
            sendResponse({
               "status": "updated color"
            });
        });
    return true;
  }
});

chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab){
  if(changeInfo.status === "complete" && tab.url === "chrome://history/"){
    histFocus = true;
    FW.log("HISTORY PAGE LOADING");
  } else {
    histFocus = false;
  }
});

chrome.browserAction.onClicked.addListener(function(activeTab){
    if (token == "" || token == "null" || !token){
        popUp = false;
        getLogin();
        openHistory = true;
    } else {
        chrome.tabs.create({ url: chrome.extension.getURL('history.html')});
    }
});

chrome.runtime.onStartup.addListener(function() {
    token = localStorage.getItem('token');
    if (token == "" || token == "null" || !token){
        getLogin();
    } else {
        checkOptIn();
    }
});

chrome.runtime.onInstalled.addListener(function(report) {
  if (report.reason === "install") {
    chrome.tabs.create({ url: chrome.extension.getURL('disclaimer.html')});
    firstInstalled = new Date();
    FW.log("Date first installed: " + firstInstalled);
  }
});

//once every hour, check for pending impressions that can be posted
if (optIn) {
  window.setInterval(function(){
    FW.log("Attempting to update impressions....")
    for (i = pendingImpressions.length - 1; i >= 0 ; i--){
         verifyPending(pendingImpressions[i].placement_uri, function(response){
             if (response.status === "FOUND") {
                postImpression(pendingImpressions[i]);
                pendingImpressions.splice(i, 1);
             } else if (response.status === "IGNORE"){
                pendingImpressions.splice(i, 1);
             }
         });
     }
  }, 3600000);
}

window.setInterval(function(){
  if (notificationPopUp === true){
    notificationPopUp = false;
  }
}, 3600000);


var URLS ={
  dev:{baseUrl:'https://floodwatch-dev.o-c-r.org/'},
  prod:{baseUrl:'https://floodwatch.o-c-r.org/'},
  local:{baseUrl:'http://localhost:5000/'},

  endpoints:{
    updateDemo: 'update_demo/'
  },
  buildEndpoint: function(endpoint){
    return URLS[FW.options.ENV].baseUrl + URLS.endpoints[endpoint];
  },
  buildUrl: function(url) {
    return URLS[FW.options.ENV].baseUrl + url;
  }

};

var apiCall = function(info) {
  info.dataType = info.dataType || 'json';
  info.type = info.type || "GET";
  info.url = URLS.buildUrl(info.url);

  // Add Authorization header
  var _beforeSend = info.beforeSend;
  info.beforeSend = function (xhr) {
    xhr.setRequestHeader("Authorization", "Basic " + btoa(token+ ":unused"));
    if (_beforeSend)
      _beforeSend(xhr);
  };

  $.ajax(info);
};


function updateDemo(demo_changes, callback) {
  var updatedDemo = JSON.stringify(demo_changes);
  apiCall({
        url: URLS.buildEndpoint('updateDemo') ,
        type: "POST",
        data: updatedDemo,
        contentType: "application/json",
        success:function(result){
            FW.log("success updating");
            FW.log(JSON.stringify(result));
            callback;
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
        }
  });
}

function checkOptIn(callback) {

  apiCall({
        url: "check_optin/",
        success:function(result){
            FW.log("OptIn set to: " + result.opt_in);
            optIn = result.opt_in;
            if(callback) callback(optIn)
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLogin();
            }
            if(callback) callback(null,error);
        }
  });
}

function checkDemo(callback) {
  apiCall({
        url: "check_demo/",
        success:function(result){
            FW.log("Demo set to: " + result.demo_info);
            demo = result.demo_info;
            if(callback) callback(demo)
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLogin();
            }
            if(callback) callback(null,error);
        }
  });
}

function verifyPlacement(theHash, callback){
   apiCall({
        url: "verify_placement/" + theHash.toString(),
        success:function(result){
            FW.log(JSON.stringify(result));
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
        }
  });
}

function verifyPending(theHash, callback){
   apiCall({
        url: "verify_pending/" + theHash.toString(),
        success:function(result){
            FW.log(JSON.stringify(result));
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
        }
  });
}

function postImpression(impression, tab) {
  apiCall({
        url: "impressions/",
        type: "POST",
        data: JSON.stringify(impression),
        contentType: "application/json",
        success:function(result){
            FW.log("success posting");
            FW.log(JSON.stringify(result));
            if(tab){
              adsCollectedByTab[tab.id] ++;
              if(tab.active && tab.highlighted){
                chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
                chrome.browserAction.setBadgeText({text:Math.min(999,adsCollectedByTab[tab.id])+''});
              }
            }
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
        }
  });
}

function postPlacement(placement, callback) {
  apiCall({
        url: "register_placement/",
        type: "POST",
        data: JSON.stringify(placement),
        contentType: "application/json",
        success:function(result){
            FW.log("success posting placement: " + JSON.stringify(result));
            callback();
        },
        error:function(xhr,status,error){
            FW.log(status, error);
             if (error == "UNAUTHORIZED"){
              // getLogin();
              getLoginNotification();
            }
        }
  });
}

function updateOptIn(optIn, callback) {
  var opt = {"opt_in" : optIn};
  apiCall({
        url: "update_optin/",
        type: "POST",
        data: JSON.stringify(opt),
        contentType: "application/json",
        success:function(result){
            FW.log(JSON.stringify(result));
            callback();
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}


function uploadImage(image, callback) {
  var imgData = JSON.stringify(image);
  FW.log(imgData);
  apiCall({
        url: "images/",
        type: "POST",
        data: imgData,
        contentType: "application/json",
        success:function(result){
            FW.log("success posting" + result.url + " " + result.thumb_url);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
        }
  });
}

function flagAd(placementURI, reason, callback) {
  var badAd = JSON.stringify({"placement_uri" : placementURI, "reason" : reason});
  apiCall({
        url: "flag_ad/",
        type: "POST",
        data: badAd,
        contentType: "application/json",
        success:function(result){
            FW.log("success posting blacklist request: " + result);
            callback();
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrieveImpressions(callback) {
  apiCall({
        url: "impressions/",
        success:function(result){
            FW.log("Retrieved Impression records: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrievePlacementData(placementID, callback) {
  apiCall({
        url: "retrieve_placement/" + placementID,
        success:function(result){
            FW.log("Retrieved Placement record: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrievePlacements(page, num, callback) {
  apiCall({
        url: "retrieve_placements/" + page + "_" + num,
        success:function(result){
            FW.log("Retrieved Placement records: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrieveImage(imgID, callback) {
  apiCall({
        url: "retrieve_image/" + imgID,
        success:function(result){
            FW.log("Retrieved Image: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrieveThumbnail(imgID, callback) {
  apiCall({
        url: "retrieve_thumbnail/" + imgID,
        success:function(result){
            FW.log("Retrieved Image: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function retrieveUserTree(callback) {
  apiCall({
        url: "retrieve_user_tree/",
        success:function(result){
            FW.log("Retrieved tree: " + result.items);
            callback(result.items);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function getTag(tagID, callback) {
  apiCall({
        url: "retrieve_tag_tree/" + tagID,
        success:function(result){
            FW.log("Retrieved Tag Tree: " + result);
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}


function updateTag(placementID, tagID, callback) {
  var tagData = JSON.stringify({"tag_id" : tagID, "placement_id" : placementID});
  FW.log("TAG DATA :" + tagData);
  apiCall({
        url: "update_placement_tag/",
        type: "post",
        data: tagData,
        contentType: "application/json",
        success:function(result){
            FW.log("success updating tag");
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function updateColor(imgID, color, callback) {
  var imgData = JSON.stringify({"img_id" : imgID, "dom_color" : color});
  apiCall({
        url: "update_color/",
        type: "post",
        data: imgData,
        contentType: "application/json",
        success:function(result){
            FW.log("success updating tag");
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            // if(callback) callback(null,error);
        }
  });
}

function getUntagged(callback) {
  apiCall({
        url: "get_untagged/",
        success:function(result){
            FW.log("Got untagged items");
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function getMyUntagged(callback) {
  apiCall({
        url: "get_my_untagged/",
        success:function(result){
            FW.log("Got untagged items");
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function downloadData(data, callback) {
 apiCall({
        url: "download_archive/",
        type: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        success:function(response, status, xhr){
            callback("success");
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            callback("error");
        }
      });
}

function getTopTags(callback) {
  apiCall({
        url: "get_top_tags/",
        success:function(result){
            FW.log("Got top user tags");
            callback(result);
        },
        error:function(xhr,status,error){
            FW.log(status, error);
            if (error == "UNAUTHORIZED"){
              getLoginNotification();
            }
            if(callback) callback(null,error);
        }
  });
}

function makeImpression(placementID, timestamp) {
     var i = {};
     i.placement_id = placementID;
     i.timestamp = timestamp;
     return i;
}

function makePlacement(placementURI, imgID, adURI, adRef, pageURL, adAnchor){
  var p = {};
  p.placement_id = placementURI;
  p.img_id = imgID;
  p.ad_uri = adURI;
  p.ad_ref = adRef;
  p.page_url = pageURL;
  p.page_top = currentURL;
  p.ad_anchor = adAnchor;
  return p;
}

function makeImage(hash, pixels, size, callback) {
  var i = {};
  calculateColor(pixels, function(domColor, color){
    i.dom_color = domColor.toString();
    i.color = color.toString();
    convertToDataURL(pixels, function(blob){
        i.img_id = hash;
        i.pixels = blob;
        FW.log(blob);
        i.size = size;
        callback(i);
    });
  });
}

function convertToDataURL(pixels, callback){
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open('GET', pixels, true);
  xhr.onload = function(e) {
   if (xhr.status == 200 && xhr.readyState == 4) {
     var myBlob = this.response;
     var reader = new FileReader();
     reader.onload = function(event){
      callback(this.result);
     };
     reader.readAsDataURL(myBlob);
    }
  };
  xhr.send();
}

function getLogin(){
    if (!popUp) {
     chrome.tabs.create({url: chrome.extension.getURL('login.html')});
     popUp = true;
   }
}

function getLoginNotification(){
  var opt = {
    type: "basic",
    title: "Floodwatch was unable to authorize your connection.",
    message: "Please log in so we can resume ad collection.",
    iconUrl: "logo.png",
    buttons: [{
            title: "Log in",
            iconUrl: "logo.png"}]
  }
  var notify = chrome.notifications.create('floodwatchLoggedOff',opt,function(){});
  notificationPopUp = true;
}

chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
    if (btnIdx === 0 && !popUp) {
        chrome.tabs.create({url: chrome.extension.getURL('login.html')});
        popUp = true;
    }
});

function calculateColor(pixels, callback){
  var img = new Image();
  img.onload = function(){
    var domColor = colorThief.getColor(this, 3);
    var palette = colorThief.getPalette(this, 4, 5);
    callback(domColor, palette);
  };
  img.onerror = function(e){
    FW.log("ERROR" + e.message);
  };
  img.src = pixels;
}
