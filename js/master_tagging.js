var untaggedAds = [];
var currentCategory = {};
var currentImg = {};
var verbose = false;

$(document).ready(function() {
	if (verbose) console.log("DOCUMENT READY");
	chrome.extension.sendMessage({"whatKind":"getUntagged"}, function(response){
		if (response.placements.length != 0) {
		   untaggedAds = response.placements;
		   currentImg = untaggedAds.pop();
	       setImage(currentImg);
	       createButtons(0);
           setClickBehavior();
        } else {
        	$('#categoryDisplay').html("<p>No ads to tag!</p>");
        } 
	});
	setDoneButton();
	setBackButton();
	setSkipButton();
	setFlagButton();
});

function setImage(imgRec){
   $("#imageToTag").html("");
   chrome.extension.sendMessage({"whatKind":"getImage", "placement_id" : currentImg.placement_id }, function(response){
   	    var image = new Image;
   	    image.onload = function(){
   	    	$('#imageToTag').prepend(image);
		};
		image.src = response.pixels.file;
   });
}

function createButtons(tagID){
	$('#tagButtons').html("");
	var children = [];
    for (var i = 0; i < adWords.length; i++) {
		if (adWords[i].parent_id == tagID){
			children.push(adWords[i]);
		}
	}
	for (i = children.length - 1; i >= 0; i--){
		$('#tagButtons').prepend("<button id='" + children[i].tag_id + "'class=tag title=" + children[i].tag_name +">" + children[i].tag_name +"</button>" );
	}
	setClickBehavior();
}

function setClickBehavior(){
	$('.tag').click(function() {
		var find = parseInt($(this).attr("id"));
		var cat = $.grep(adWords, function(e){ 
			return e.tag_id == find; 
		});
		currentCategory = cat[0];
		if (verbose) console.log("Current Cat" + currentCategory);
		$('#categoryDisplay').html("<p>" + $(this).attr("title") + "</p>");
		createButtons(currentCategory.tag_id);
	}); 
}

function setDoneButton(){
	$('#doneButton').click(function() {
	   if (currentCategory != 0 && currentImg.placement_id) {
		chrome.extension.sendMessage( { "whatKind": "tagPlacement", "tag_id": currentCategory.tag_id, "placement_id" : currentImg.placement_id }, function(status){
			$('#tagButtons').html("<p>Thanks!</p>");
			setTimeout(function(){
				currentImg = untaggedAds.pop();
			    setImage(currentImg);
			    createButtons(0);
			}, 500);
		});
	   } else {
	   	  $('#categoryDisplay').html("<p>Please select a category first!</p>");
	   }
	});
}

function setBackButton(){
	$('#backButton').click(function() {
		if (currentCategory.parent_id != 0 && currentCategory != {}) {
		 var tag = $.grep(adWords, function(e){ 
			return e.tag_id == currentCategory.parent_id;
		 });
		 currentCategory = tag[0];
		 $('#categoryDisplay').html("<p>" + tag[0].tag_name + "</p>");
			createButtons(currentCategory.tag_id);
	    } else {
           currentCategory = {};
		  $('#categoryDisplay').html("");
		  createButtons(0);
	    }
	});
}

function setSkipButton(){
	$('#skipButton').click(function() {
		currentImg = untaggedAds.pop();
	    setImage(currentImg);
	    createButtons(0);
	});
}

function setFlagButton(){
	$('#flagButton').click(function() {
		chrome.extension.sendMessage( { "whatKind": "flagAd", "placement_id" : currentImg.placement_id, "reason" : "false_positive" }, function(status){
			$('#tagButtons').html("<p>Thanks!</p>");
			setTimeout(function(){
				currentImg = untaggedAds.pop();
			    setImage(currentImg);
			    createButtons(0);
			}, 500);
		});
	});
}
