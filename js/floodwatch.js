FW.configure( {} );
var sessionID, currentURL = '';
var localImgCopies = {};
var startInt;
var toggled = false;
var foundAds = [];
var adsRecorded = 0;

function adRecord(src, w, h) { // this is the main structure we send to indexedDB
  this.src = src;
  this.w = w;
  this.h = h;
}

// try to set the currentURL for all messages, for iFrame
if (window.self === window.top) {
    var path = window.location.href;
    currentURL = path.split("//")[1];
    topURL = currentURL.split("/")[0];
    if (currentURL.split(".")[0] == "www") {
      currentURL = currentURL.split(".")[1];
    } else {
      currentURL = currentURL.split(".")[0];
    }
    chrome.extension.sendMessage({
    "whatKind": "setCurrentURL",
    "currentURL" : topURL
      }, function(response) {
      FW.log("Current URL set to:" + topURL);
      });

}

$(document).ready(function() {
  startInt = setInterval(startFloodwatch, 1000);
  FW.log("START INTERVAL");
});   // end of document.onReady()

function startFloodwatch() {
  FW.log("START FLOODWATCH");
  clearInterval(startInt);
  var ignore = false;
  var isHttps = window.self.location.href.split(":")[0];
  sessionID = Math.round(+new Date()/1000);
  if((isHttps.length === 5) && (isHttps.charAt(isHttps.length - 1))) {
    FW.log("It's https");
    ignore = true;
  }
  if(!ignore) {
    FW.log("DOCUMENT IS READY......! ");
      var adImages = [];
      FW.log("LOOKING FOR ADS......!");
      $('iframe').each(function(index) {
        try {
          var contents = $(this).contents();
          var imgs = contents[0].getElementsByTagName('img');
          for (var i = 0; i < imgs.length; i++) {
            FW.log("frame candidate:" + $(imgs[i]).attr('src'));
            adImages.push(imgs[i]);
          }
        } catch(err) {

        }
      });
      //Select all images in the main document
      $('img').each(function(index) {
        adImages.push(this);
        FW.log("candidate:" + $(this).attr('src'));
      });
      FW.log("FINISHED FINDING ADS......!");

      buildRecords(adImages);

      FW.log("DONE......!");
  } // end of if(!ignore)
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.whatKind == "send_pixels") {
    var image = localImgCopies[request.id];
    if(image) {
      sendResponse({
        "pixels": window.URL.createObjectURL(image.pixels),
        "adSize": image.imgSize,
      });
    } else {
      FW.log("could not retrieve image");
    }
  }
});

//toggle highlighting & rollover for troubleshooting ad collection
//  $(document).keydown(function (e){
//   if (e.which === 192) {
//     FW.log("Toggling troubleshooting mode");
//     toggleHighlight();
//   }
// });

//toggle highlighting on ads tagged
function toggleHighlight(){
  if (!toggled) {
    //$(".highlightAd").css("border-width", "3px !important");
    for (i = 0; i < foundAds.length; i++){
      $(foundAds[i]).attr('style', function(i,s) { return s + 'border-width: 5px !important;' });
    }
    toggled = true;
    $('body').append("<div id='testForm'><iframe src='https://docs.google.com/forms/d/1thIcsERtIb0LvZbVyOJgrJyibYmsov3WCRbOFBLPfjM/viewform?embedded=true' width='760' height='500' frameborder='0' marginheight='0' marginwidth='0'>Loading...</iframe></div>");
  } else {
    //$(".highlightAd").css("border-width", "0px !important");
        toggled = false;
        for (i = 0; i < foundAds.length; i++){
      $(foundAds[i]).attr('style', function(i,s) { return s + 'border-width: 0px !important;' });
    }
    $('#testForm').remove();
  }
}

//Function to make a JS object based on a DOM element
function adRecord(adElement) {
  var r = {};
  //The basics
  r.timestamp = sessionID;
  r.src = $(adElement).attr('src');
  if ($(adElement).parent().is('a')){
    r.adAnchor = $(adElement).parent().attr("href");
  } else {
    r.adAnchor = "Null for now";
  }
  r.url = window.location.href;
  r.pageTitle = document.title;
  r.adId = r.timestamp + "_" + r.src;
  //If this is null, it's likely a .SWF embedded in an object tag, so let's get the .SWF path from that.
  if (r.src === undefined) {
    $(adElement).find("param").each(function() {
      if ($(this).attr("name") == "movie")  r.src = $(this).attr("value");
    });
  }
  r.w = $(adElement).width();
  r.h = $(adElement).height();
  //The in-page context
  r.id = $(adElement).attr('id');
  r.adPosition = findPos(adElement);
  r.tagType = $(adElement).tagName;
  return(r);
}

function scrapeImages(adRecord, callback) {
  var src = adRecord.src;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", src, true);
  xhr.responseType = 'blob';
  xhr.onload = function(e){
    if (this.status == 200) {
    var theImg = this.response;
    var f = new FileReader();
    f.readAsBinaryString(this.response);
    f.onloadend = function () {
      var hashedIMG = CryptoJS.MD5(f.result);
      callback(hashedIMG, theImg, adRecord);
    };
    }
  };
  xhr.send();
}

function buildRecords(adList) {
  var recordList = [];
  for(var i = 0; i < adList.length; i++) {
    //Send the ad to the background.js file, which adds it to the local DB
    var ar = adRecord(adList[i]);
    recordList.push(ar);
  }
  FW.log("FILTERING ADS......!" + recordList.length);
  //Filter the ads based on our magical criteria
  recordList = filterAds(recordList, adList);
  FW.log("DONE FILTERING ADS......!" + recordList.length);
    //Send the records
  for(var j = 0; j < recordList.length; j++) {
    scrapeImages(recordList[j], function(hashI, image, adRecord){
    localImgCopies[hashI.toString()] = {"pixels" : image, "imgSize" : [adRecord.w, adRecord.h]};
    recordAd(adRecord, hashI.toString());
    });
  }
}

function filterAds(recordList, adList) {
  var out = [];
  for(var i = 0; i < recordList.length; i++) {
    var filterResult = filterAd(recordList[i], adList[i]);
    if(filterResult[0]) {
      FW.log("Why was this flagged?" + filterResult[1]);
      $(adList[i]).addClass("highlightAd");
      foundAds.push(adList[i]);
      $(adList[i]).addClass(filterResult[1]);
      out.push(recordList[i]);
      FW.log("VALID AD!");
    }
  }
  FW.log("********************* TOTAL ADS FOUND:" + out.length);
  return(out);
}

function filterAd(record, element) {
  //Logic to determine wether this thing is a valid ad image or not
  var score = 0;
  var reason = {
    "adBlockMatch" : 0,
    "adBlockTopMatch" : 0,
    "adSizeMatch" : 0,
    "adURLMatch" : 0
  };
  var maxR = "";
  //FW.log(record.id);
  //1. Check domains against known ad domains
  for (var i = 0; i < adBlockPlusTLList.length; i++) {
    if (record.src !== undefined && record.src.indexOf(adBlockPlusTLList[i]) != -1) {
      if ((window.self === window.top) && ((adBlockPlusTLList[i]).indexOf(currentURL) != -1 || record.src.split(".")[1] == currentURL)) {
        score -= 4;
        reason["adBlockTopMatch"] -= 4;
        break;
      }
      FW.log("***** AD FOUND: Matched adBlockPlusTLList");
      FW.log("**** MATCHED THIS adBLockrecord:" + adBlockPlusTLList[i]);
      score += 4;
      reason["adBlockTopMatch"] += 4;
      break;
    }
  }

  //these are the spammy portions of URLs
  for (var i = 0; i < adBlockPlusList.length; i++) {
    if (record.src !== undefined && record.src.indexOf(adBlockPlusList[i]) != -1) {
      FW.log("***** AD FOUND: Matched adBlockPlusList");
      FW.log("**** MATCHED THIS adBLockrecord:" + adBlockPlusList[i]);
      //console.log(record.src);
      score += 6;
      reason["adBlockMatch"] += 6;
    }
  }
  for (var i = 0; i < adBlockSureThing.length; i++) {
    if (record.src !== undefined && record.src.indexOf(adBlockSureThing[i]) != -1) {
      FW.log("***** AD FOUND: Matched adBlockSureThingList");
      FW.log("**** MATCHED THIS adBLockrecord:" + adBlockSureThing[i]);
      //console.log(record.src);
      score += 30;
      reason["adBlockMatch"] += 30;
    }
  }
  for (var i = 0; i < adDomains.length; i++) {
    if (record.src !== undefined && record.src.indexOf(adDomains[i]) != -1) {
      FW.log("***** AD FOUND: Matched adBlockPlusList");
      FW.log("**** MATCHED THIS adBLockrecord:" + adDomains[i]);
      //console.log(record.src);
      score += 8;
      reason["adBlockMatch"] += 8;
    }
  }

  //2. Check element dimensions against common  dimensions
  var matchedSize = false;
  for (var i = 0; i < adSizes.length; i++) {
    if (record.w + " x " + record.h == adSizes[i]) {
      score += 6;
      FW.log("**** AD FOUND: Matched ad size");
      reason["adSizeMatch"] += 5;
      matchedSize = true;
    } else if (record.w <= 25 || record.y <= 25) {
      score -= 10;
      reason["adSizeMatch"] -= 10;
      if (record.w < 10 && record.h < 10) {
        score -= 100;
        reason["adSizeMatch"] -= 100;
        //we found a tracking pixel
        break;
      }
    } else if (record.w >= 1000 || record.h >= 1000){
        score -= 100;
        reason["adSizeMatch"] -= 100;
        break;
        // we grabbed some sort of giant page div
    }
  }

  if (!matchedSize) {
    score -= 5
  }


  //3. Check element name, div name against the word 'ad' or ''

  if (record.id !== undefined && record.id.toLowerCase().indexOf("ad")) {
    score+= 4;
    reason["adURLMatch"] += 4;
  }
  if (record.class !== undefined && record.class.toLowerCase().indexOf("ad")) {
    score+= 4;
    reason["adURLMatch"] += 4;
  }

  if ($(element).children().length > 1){
    //you caught an enclosing div, not the ad
    //score = 0;
  }

  for (var i = 0; i < adBlockBlacklist.length; i++) {
    if (record.src !== undefined && record.src.indexOf(adBlockBlacklist[i]) != -1) {
      FW.log("***** AD MATCHED BLACKLIST");
      score = 0;
      break;
    }
  }

  FW.log(record.src);
  FW.log("adBlockTopMatch score: " + reason["adBlockTopMatch"]);
  FW.log("adBlockMatch score: " + reason["adBlockMatch"]);
  FW.log("adSizeMatch score: " + reason["adSizeMatch"]);
  FW.log("adUrlMatch score: " + reason["adURLMatch"]);
  FW.log("Total score: " + score);

  if (score > 7) {
    maxR = "adBlockTopMatch";
    //console.log(record.adAnchor);
    for (var key in reason){
      if (reason[key] > reason[maxR]) {
        maxR = key;
      }
    }

  }
    return([score > 7, maxR]);
}

// Runs once per ad - sends the adRecord object to the background page
function recordAd(thisAd, md5) {
  FW.log("floodwatch.recordAd called");
  FW.log(thisAd);
  chrome.extension.sendMessage({
    "whatKind": "recordAd",
    "theAd": thisAd,
    "theHash": md5
  }, function(response) {
    FW.log(response.status);
  });
}

//Function to find position of a DOM Object
function findPos(obj) {
  //  console.log(obj);
  var curleft = curtop = 0;
  if(obj && obj.offsetParent) {
    do {
      curleft += obj.offsetLeft;
      curtop += obj.offsetTop;
    } while (obj = obj.offsetParent);
  }
  return [curleft, curtop];
}

// escape by Colin Snover
RegExp.escape = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

