function setVisibility(id) {
var e = document.getElementById(id);
				
				if(e.style.display == 'block') 
					e.style.display = 'none';
				else
					e.style.display = 'block';
    	}
    	

var untaggedAds = [],
	currentCategory = {},
	currentImg = {},
	tagManager,
	tagTree,
	optIn,
	impressions,
    adPoolThreshold = 1000,
    simultaneousLoading = 100,
    lastTag = '',
    lastImg;

var verbose = false;

document.addEventListener("DOMContentLoaded", setup, false);

function setup() {

    d3.select('#taggingBody').style('display','block');

	tagTree = new TagTree();
	tagManager = new TagManager();

	chrome.extension.sendMessage( { "whatKind":"checkOptIn"}, function(response){
        
        optIn = response.status;
        if(!optIn) {
            d3.select('#statusBar div.status p')
                .text('No ads to tag!');
            return;
        }

        chrome.extension.sendMessage({"whatKind":"retrieveImpressions"}, function(response){
            impressions = new ImpressionManager(response).init();
            loadImpressions();
        });

        chrome.extension.sendMessage({"whatKind":"getUntagged"}, function(response){
            if (response.placements.length != 0) {
                untaggedAds = response.placements;
                currentImg = untaggedAds.pop();
                initImage(currentImg);
                initStatus();
                updateStatus();
            } else {
                d3.select('#statusBar div.status p')
                    .text('No ads to tag!')
            } 
        });
    });   
}

function initStatus(){

    d3.selectAll('#statusBar div.btn')
        .on('mouseout',function(){updateStatus()});

    d3.select('#statusBar div.back')
        .on('click',function(){
            tagManager.sendTag();
            tagManager.popLevel(tagManager)
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Back to previous tag');
        });

    d3.select('#statusBar div.done')
        .on('click',function(){
            tagManager.confirm();
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Confirm selected tag.');
        });

    d3.select('#statusBar div.skip')
        .on('click',function(){
            tagManager.sendTag();
            tagManager.skip(false);
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Tag this ad later.');
        });

    d3.select('#statusBar div.flagButton')
        .on('click',function(){
            tagManager.sendTag();
            tagManager.skip(true);
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('This is not an ad.');
        });

}

function updateStatus(){
    if(tagManager.path.length == 0){

        if(lastTag == ''){
            d3.select('#statusBar div.status p')
                .text('Select a tag from the tree below to categorize this ad.')
        } else {
            d3.select('#statusBar div.status p')
                .text('Last ad categorized as ' + lastTag + '. <span>Cancel?</span>');
            d3.select('#statusBar div.status p span')
                .style('curosr','pointer')
                .on('click',function(){
                    tagManager.cancel();
                });
        }

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','0');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','0');

    } else {
        d3.select('#statusBar div.status p')
            .text('Selected \'' + tagManager.path[tagManager.path.length-1] + '\'');

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','50px');
    }

    d3.select('#statusBar div.done')
            .style('background-color','rgba(255,190,3,0)')
}


var loadImpressions = function loadImpressions(){
    if(impressions.loading) {
        impressions.load();
    }
    requestAnimationFrame(loadImpressions);
}


function initImage(imgRec){
   d3.select("#imageToTag").html("");
   chrome.extension.sendMessage({"whatKind":"getImage", "placement_id" : currentImg.placement_id }, function(response){
        var s = response.pixels.size;
        s = s.substring(1,s.length-1);
        s = s.split(',');

   	    d3.select('#imageToTag').append('img')
   	    	.attr('src',response.pixels.file)
            .attr('width',0)
            .attr('height',0)
            .transition()
            .attr('width',parseFloat(s[0]))
            .attr('height',parseFloat(s[1]))
   	    tagManager.init();
        updateStatus();
   });
}

TagManager = function(){

	this.container = d3.select('#tagging div.horizontalPan');
	this.container.append('div')
		.classed('level',true);
	this.tags = tagTree.topLevel;
    this.path = [];
    this.offset = 0;

}

TagManager.prototype = {

	constructor: TagManager,

	init: function(){

        var _this = this;
        this.path = [];

        d3.select('#tagging')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        this.sortTags(this.tags);


		d3.select('#tagging div.horizontalPan div.level').selectAll('div.tag')
            .data(this.tags)
            .enter()
            .append('div')
            .classed('tag',true)
            .text(function(d,i){return d.name})
            .on('click',function(){_this.onClick(d3.select(this))})
            .on('mouseover',function(){_this.onMouseOver(d3.select(this))})
            .on('mouseout',function(){_this.onMouseOut(d3.select(this))})
            .style('cursor','pointer')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        return this;
    },

    addLevel: function(source){

        this.sendTag();

        var _this = this;
        var level = source.datum().level;

        this.path[level] = source.datum().name;
        while(this.path.length > level+1) this.path.pop();

        this.sortTags(source.datum().children);

        for(var i = level+2; i<=this.container.node().children.length; i++){
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').selectAll('div.tag')
                .style('background-color','rgba(255,190,3,0)')
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').remove();
        }

        for(var i = level+1; i<=this.container.node().children.length; i++){
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').selectAll('div.tag')
                .filter(function(){return this != source.node();})
                .style('background-color','rgba(255,190,3,0)')
        }

        // if(source.datum().children.length == 0) return;

        if(this.container.node().children.length <= level+1){
            var d = d3.select('#tagging div.horizontalPan')
                .append('div')
                .classed('level',true)
        }

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+1) +')').selectAll('div.tag')
            .each(function(d,i){
                if(_this.path[level] != d.name) _this.onMouseOut(d3.select(this));
            })        

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+2) +')').selectAll('div.tag')
            .data(source.datum().children)
            .enter()
            .append('div')
            .classed('tag',true)
            .on('click',function(){_this.onClick(d3.select(this))})
            .on('mouseover',function(){_this.onMouseOver(d3.select(this))})
            .on('mouseout',function(){_this.onMouseOut(d3.select(this))})
            .style('cursor','pointer')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+2) +')').selectAll('div.tag')
            .text(function(d,i){return d.name})


        this.translate(source);
        // updateStatus();

        this.updateStatus();

	},

    popLevel: function(_this){

        if(_this.container.node().children.length-1 <= _this.path.length){
            d3.selectAll('#tagging div.horizontalPan div.level').selectAll('div.tag')
                .filter(function(d,i){return d.name == _this.path[_this.path.length-1]})
                .transition()
                .style('background-color','rgba(255,190,3,0)')
            _this.path.pop();
        }
        if(_this.path.length == 0) {
            d3.select('#statusBar div.back')
                .transition()
                .style('max-width',0);
            d3.select('#statusBar div.done')
                .transition()
                .style('max-width',0);
            // return;
        }

        if(_this.container.node().children.length > 1) d3.selectAll('#tagging div.horizontalPan div.level:last-child').remove();

        this.translate(d3.select('#tagging div.horizontalPan div.level:nth-child('+ (_this.path.length) +')').selectAll('div.tag'));
    },

    updateStatus: function(){
        d3.select('#statusBar div.status p')
            .text('Selected \'' + tagManager.path[tagManager.path.length-1] + '\'. Click again to confirm.');

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .style('background-color','rgba(255,190,3,0.3)')
    },

	sortTags: function(tags){
		tags.sort(function(a,b){return b.score-a.score})
	},

    translate: function(source){

        var level = d3.selectAll('div.level')[0].length;

        var cw = d3.select('#statusBar').style('width');
        cw = parseFloat(cw.substring(0,cw.length-2));

        var w = 0;
        var lw = 0;
        for(var i = 0; i < level; i++){
            var lw = d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i+1) +')').style('width');
            lw = parseFloat(lw.substring(0,lw.length-2))+20;
            w += lw;
        }

        w -= 10;

        this.offset = 0;
        if(cw - this.offset < w) {
            this.offset = (cw + this.offset) - w;
        }

        d3.select('#tagging div.horizontalPan')
                .style('left',this.offset);

    },

    confirm: function(){

        lastTag = this.path[this.path.length-1];
        lastImg = currentImg;
        this.path = [];
        updateStatus();
        var _this = this;

        d3.select('#statusBar div.done')
            .style('background-color','rgba(255,190,3,1)')

        d3.selectAll('#tagging div.horizontalPan div.level')
            .transition()
            .style('opacity',0);

        d3.select('#imageToTag img')
            .transition()
            .attr('width',0)
            .attr('height',0)
            .each('end',function(){

                d3.selectAll('#tagging div.horizontalPan div').remove();
                _this.container.append('div')
                    .classed('level',true);

                if(untaggedAds.length > 0){
                    currentImg = untaggedAds.pop();
                    initImage(currentImg);
                    initStatus();
                } else {
                    d3.select('#statusBar div.status p')
                        .text('No more ads to tag. Thanks for your help!')
                }

                updateStatus();
                _this.translate(d3.select('#tagging div.horizontalPan div.level:last-child').selectAll('div.tag'));
            })

    },

    skip: function(notAnAd){

        if(notAnAd){
            chrome.extension.sendMessage( { "whatKind": "flagAd", "placement_id" : currentImg.placement_id, "reason" : "false_positive" }, function(status){
                if (verbose) console.log(status);
            });
        }

        this.path = [];
        updateStatus();
        var _this = this;

        d3.selectAll('#tagging div.horizontalPan div.level')
            .transition()
            .style('opacity',0);

        d3.select('#imageToTag img')
            .transition()
            .attr('width',0)
            .attr('height',0)
            .each('end',function(){

                d3.selectAll('#tagging div.horizontalPan div').remove();
                _this.container.append('div')
                    .classed('level',true);

                if(untaggedAds.length > 0){
                    currentImg = untaggedAds.pop();
                    initImage(currentImg);
                    initStatus();
                } else {
                    d3.select('#statusBar div.status p')
                        .text('No more ads to tag. Thanks for your help!')
                }

                updateStatus();
                _this.translate(d3.select('#tagging div.horizontalPan div.level:last-child').selectAll('div.tag'));
            })

        lastImg = null;
        lastTag = '';

    },

    cancel: function(){

        lastTag = '';
        this.path = [];
        updateStatus();
        var _this = this;

        currentImg = lastImg;

        d3.select('#statusBar div.done')
            .style('background-color','rgba(255,190,3,1)')

        d3.selectAll('#tagging div.horizontalPan div.level')
            .transition()
            .style('opacity',0);

        d3.select('#imageToTag img')
            .transition()
            .attr('width',0)
            .attr('height',0)
            .each('end',function(){

                d3.selectAll('#tagging div.horizontalPan div').remove();
                _this.container.append('div')
                    .classed('level',true);
                
                initImage(currentImg);
                initStatus();
                updateStatus();
                _this.translate(d3.select('#tagging div.horizontalPan div.level:last-child').selectAll('div.tag'));

            })

        lastImg = null;

    },

    sendTag: function(){

        if(!lastTag || !lastImg) return;
        chrome.extension.sendMessage( { "whatKind": "tagPlacement", "tag_id": tagTree.ids[lastTag], "placement_id" : lastImg.placement_id }, function(status){
            if (verbose) console.log(status);
        });
        lastTag = null;
        lastImg = null;

    },

    onClick: function(source){
        var level = source.datum().level;
        if(this.path[this.path.length-1] != source.datum().name) this.addLevel(source);
        else {
            this.confirm();
            source.style('background-color','rgba(255,255,255,1)')
        }
    },

    onMouseOver: function(source){
        source
            .style('background-color','rgba(255,190,3,0.9)')
            .style('opacity',1)

        if(source.datum().name == this.path[this.path.length-1]) this.updateStatus();
        else updateStatus();
    },

    onMouseOut: function(source){
        var level = source.datum().level;
        source
            .transition()
            .duration(150)
            .style('background-color','rgba(255,190,3,' + (this.path[level] == source.datum().name ? 0.3 : 0.0) + ')')
        updateStatus();
    }


}


TagTree = function(){

    this.keys = {};
    this.ids = {};
    this.topLevel = [];

    var len = adWords.length;
    for(var i = 0; i<len; i++){
        var k = {id: adWords[i].tag_id, name: adWords[i].tag_name, parent: adWords[i].parent_id, children: [], score: 0}
        this.keys[k.id] = k;
        this.ids[k.name] = k.id;
        if(k.parent == 0) this.topLevel.push(k);
    }

    for(key in this.keys){
        var k = this.keys[key];
        if(k.parent != 0) this.keys[k.parent].children.push(k);
    }

    var setLevel = function(tags, level){
    	var len = tags.length;
    	for(var i =0; i<len; i++){
    		var t = tags[i];
    		t.level = level;
    		setLevel(t.children,level+1);
    	}
    }
    setLevel(this.topLevel, 0);

}


TagTree.prototype = {

    constructor: TagTree

}





ImpressionManager = function(historyResponse){

    this.all = [];
    this.loadingPool = [];
    this.loadingQueue = [];
    this.loadedPool = []; 
 
    this.timeRange = [10000000000, 0];
    var len = Math.round(historyResponse.items.length);
    for(var i = len-1; i>=0; i--){
        var a = new AdImpression(historyResponse.items[i]);
        this.all.push(a);
    }
}

ImpressionManager.prototype = {

    constructor: ImpressionManager,

    init: function(){

        this.loadedPool = [];
        this.loadingQueue = [];
        this.loadingPool = [];

        var len = this.all.length;
        for(var i = 0; i<len; i++){
            var impression = this.all[i];
            if(impression.ready){
                this.loadedPool.push(impression);
            } else {
                this.loadingQueue.push(impression);
                this.loading = true;
            }
        }
        return this;
    },

    load: function(){
        for(var i = 0; i<simultaneousLoading - this.loadingPool.length; i++){
            if(this.loadingQueue.length == 0) break;
            imp = this.loadingQueue[0];
            this.loadingPool.push(imp);
            this.loadingQueue.shift();
            imp.init();
        }

        var len = this.loadingPool.length;
        for( var i = 0; i<len; i++){
            var imp = this.loadingPool[i];
            if(imp.error){
                this.loadingPool.splice(i,1);
                i--;
                len--;
            } else if(imp.ready){
                this.loadedPool.push(imp);
                this.loadingPool.splice(i,1);
                i--;
                len--;
            }
        }

        if(this.loadedPool.length > adPoolThreshold || (this.loadingPool.length == 0 && this.loadingQueue == 0)) {
        	this.loading = false;
        	if (verbose) console.log('Loading done with ' + this.loadedPool.length + ' ads stored.');
        }
    }
}



AdImpression = function(impressionResponse){

    // impression response
    // {"id":25,"placement_id":"0458a23ececbcc9654d728fc9b5bfbefcb60a9fa854b5d6bf842ec886f016eb9","timeStamp":"Wed, 14 May 2014 14:54:26 GMT"}

    this.placement_id = optIn ? impressionResponse.placement_id : impressionResponse.impression.placement_id;
    this.date = optIn ? impressionResponse.timestamp : impressionResponse.impression.timestamp;

    this.timeStamp = optIn ? Date.parse(this.date)/1000 : this.date;
    this.actualSize = [];

    this.ready = false;
    this.error = false;

    this.publisher = ""; 

}

AdImpression.prototype = {

    constructor: AdImpression,

    init: function(){
        var _this = this;
        chrome.extension.sendMessage({"whatKind":"retrievePlacementData","placementId":this.placement_id}, function(placementResponse){
            // placement response
            // {ad_uri: "http://graphics8.nytimes.com/adx/images/ADS/37/28/ad.372833/CRS-1789_Retarg_arrow_hd_120x90_ER1.jpg", img_id: "b9dd1de0face49d462c42191ba700234", keywords: null, page_url: "http://www.nytimes.com/"}
            
            if(placementResponse == null){
                _this.error = true;
                return;
            }

            _this.keywords = placementResponse.keywords.split(',');
            if(tagTree.keys[_this.keywords[0]]){
                var id = _this.keywords[0];
                _this.keywords = [];
                while(id != 0){
                    _this.keywords.push(+id);
                    id = tagTree.keys[id].parent;
                }
            } else _this.keywords = [];
            
            var len = _this.keywords.length;
            for(var i = 0; i<len; i++){
            	try{
            		tagTree.keys[_this.keywords[i]].score ++;
            	} catch(e){
            		if (verbose) console.log(e + ' ' + _this.keywords[i] + ' ' + impressions.loadedPool.length)
            	}
            }

            _this.ready = true;

        });
    }
}








